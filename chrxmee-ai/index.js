require("dotenv").config();
const { Client, GatewayIntentBits, Collection, EmbedBuilder } = require("discord.js");
const { ChrxmeeServer } = require("chrxmeestream");
const WebSocket = require("ws");
const { PassThrough } = require("stream");
const { joinVoiceChannel, createAudioPlayer, createAudioResource, StreamType, VoiceConnectionStatus, entersState } = require("@discordjs/voice");
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { setupAntinukeEvents } = require("./antinukeEvents");
const { scheduleMarkers, stopEndMarkerWatcher, stopAllWatchers } = require("./songMarkers");

// ==================== CRASH CATCHER ====================
process.on("uncaughtException", (err) => {
  console.error("💥 UNCAUGHT EXCEPTION:", err.message, err.stack);
});
process.on("unhandledRejection", (reason) => {
  console.error("💥 UNHANDLED REJECTION:", reason);
});

// ==================== CONFIG LOADING ====================
let chrxmeeConfig;
try {
  chrxmeeConfig = require("./chrxmee.config.json");
  console.log("📄 Loaded chrxmee.config.json");
} catch {
  console.warn("⚠️ chrxmee.config.json not found, using defaults");
  chrxmeeConfig = { server: { port: 2333, host: "127.0.0.1", password: "chrxmee", audioDir: "./audio" } };
}

// ==================== HELPERS ====================
function msToTime(ms) {
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor(ms / (1000 * 60 * 60));
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

// ==================== KEEP-ALIVE SERVER ====================
const http = require("http");
const keepAliveServer = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Chrxmee AI is alive! 🚀");
});
const PORT = process.env.PORT || 3000;
keepAliveServer.listen(PORT, "0.0.0.0", () => console.log(`Keep-alive server on port ${PORT}`));
keepAliveServer.on("error", (err) => {
  console.error("Keep-alive error:", err.message);
  setTimeout(() => keepAliveServer.listen(PORT, "0.0.0.0"), 5000);
});

// ==================== CLIENT ====================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [1, 3],
});

client.commands = new Collection();
client.memory = new Map();
client.snipes = new Map();
client.msToTime = msToTime;
client.audioStreams = new Map();
client.voiceConnections = new Map();
client.audioPlayers = new Map();
client.playerMarkers = new Map();

// ==================== POSTGRES ====================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10, idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000,
  keepAlive: true, keepAliveInitialDelayMillis: 10000,
});
pool.on("error", (err) => console.error("Postgres error:", err.message));
setInterval(async () => {
  try { const c = await pool.connect(); await c.query("SELECT 1"); c.release(); } catch (err) { console.error("Postgres keep-alive failed:", err.message); }
}, 30000);
client.pool = pool;

// ==================== CHRXMEESTREAM ====================
const CHRXMEE_PORT = parseInt(process.env.CHRXMEE_INTERNAL_PORT) || chrxmeeConfig.server?.port || 2333;
const CHRXMEE_HOST = process.env.CHRXMEE_INTERNAL_HOST || chrxmeeConfig.server?.host || "127.0.0.1";
const CHRXMEE_PASS = process.env.CHRXMEE_INTERNAL_PASS || chrxmeeConfig.server?.password || "chrxmee";
const CHRXMEE_DIR  = process.env.CHRXMEE_AUDIO_DIR     || chrxmeeConfig.server?.audioDir || "./audio";

if (CHRXMEE_HOST !== "127.0.0.1" && CHRXMEE_HOST !== "localhost") {
  console.warn(`⚠️ SECURITY: ChrxmeeStream on ${CHRXMEE_HOST}. Use 127.0.0.1.`);
}
if (CHRXMEE_PASS.length < 6) { console.error("❌ Password too short."); process.exit(1); }
if (CHRXMEE_PASS === "chrxmee") console.warn("⚠️ Using default password.");

console.log("🎵 Starting ChrxmeeStream v2.0.0...");
const chrxmeeServer = new ChrxmeeServer({ port: CHRXMEE_PORT, host: CHRXMEE_HOST, password: CHRXMEE_PASS, audioDir: CHRXMEE_DIR });
chrxmeeServer.start();
console.log(`🎵 ChrxmeeStream on ws://${CHRXMEE_HOST}:${CHRXMEE_PORT}`);

// ==================== WEBSOCKET TO CHRXMEESTREAM ====================
let chrxmeeWs = null;
const chrxmeeQueue = new Map();
let reconnectAttempts = 0;
const MAX_RECONNECT = 10;

function connectToChrxmee() {
  if (reconnectAttempts >= MAX_RECONNECT) { console.error("❌ Max reconnect attempts reached."); return; }
  reconnectAttempts++;
  chrxmeeWs = new WebSocket(`ws://${CHRXMEE_HOST}:${CHRXMEE_PORT}`, { headers: { Authorization: CHRXMEE_PASS } });

  chrxmeeWs.on("open", () => {
    console.log("✅ Connected to ChrxmeeStream");
    reconnectAttempts = 0;
    for (const [gid, ops] of chrxmeeQueue) for (const op of ops) chrxmeeWs.send(JSON.stringify({ guildId: gid, ...op }));
    chrxmeeQueue.clear();
  });

  chrxmeeWs.on("message", (data, isBinary) => {
    if (isBinary) {
      try {
        if (data.length < 5) return;
        const len = data.readUInt32BE(0);
        if (len > 64 || len < 1 || data.length < 4 + len) return;
        const gid = data.subarray(4, 4 + len).toString("utf8");
        if (!/^\d{17,20}$/.test(gid)) return;
        const stream = client.audioStreams.get(gid);
        if (stream) stream.push(data.subarray(4 + len));
      } catch {}
    }
  });

  chrxmeeWs.on("close", () => { chrxmeeWs = null; setTimeout(connectToChrxmee, 5000); });
  chrxmeeWs.on("error", (err) => { chrxmeeWs = null; if (err.message.includes("ECONNREFUSED")) setTimeout(connectToChrxmee, 3000); });
}

// ==================== SEND OP ====================
const ALLOWED_OPS = new Set(["play","stop","pause","resume","volume","seek","filter","destroy","queue_add","queue_remove","queue_move","queue_shuffle","queue_clear","queue_list","queue_loop","autodj_enable","autodj_disable","history"]);
const VALID_FILTERS = new Set(["bassboost","nightcore","vaporwave","slowed","echo","reverb","normalize","earrape","karaoke","mono","treble","soft","underwater","telephone","chipmunk","deep","robot"]);

function sendToChrxmee(guildId, op) {
  if (!op?.op || !ALLOWED_OPS.has(op.op)) return;
  if (guildId && !/^\d{17,20}$/.test(guildId)) return;
  if (op.source && (op.source.length > 2000 || /^(file|ftp|data|javascript):/i.test(op.source))) return;
  if (op.op === "volume" && (op.value < 0 || op.value > 200)) return;
  if (op.op === "seek" && (op.value < 0 || op.value > 86400)) return;
  if (op.filters) for (const f of op.filters) if (!VALID_FILTERS.has(f)) return;

  const payload = JSON.stringify({ guildId, ...op });
  if (chrxmeeWs?.readyState === WebSocket.OPEN) chrxmeeWs.send(payload);
  else { if (!chrxmeeQueue.has(guildId)) chrxmeeQueue.set(guildId, []); chrxmeeQueue.get(guildId).push(op); }
}
global.sendToChrxmee = sendToChrxmee;

// ==================== VOICE ====================
async function ensureVoiceConnection(interaction) {
  const guildId = interaction.guildId;
  const vc = interaction.member?.voice?.channel;
  if (!vc) { await interaction.reply({ content: "❌ Join a voice channel first.", ephemeral: true }); return null; }

  let conn = client.voiceConnections.get(guildId);
  if (conn?.state?.status === VoiceConnectionStatus.Ready) return conn;

  conn = joinVoiceChannel({ channelId: vc.id, guildId, adapterCreator: interaction.guild.voiceAdapterCreator });
  try { await entersState(conn, VoiceConnectionStatus.Ready, 10000); } catch {
    try { conn.destroy(); } catch {}; await interaction.reply({ content: "❌ Could not connect.", ephemeral: true }); return null;
  }

  client.voiceConnections.set(guildId, conn);
  const stream = new PassThrough();
  client.audioStreams.set(guildId, stream);
  const player = createAudioPlayer();
  player.play(createAudioResource(stream, { inputType: StreamType.Raw }));
  conn.subscribe(player);
  client.audioPlayers.set(guildId, player);

  conn.on(VoiceConnectionStatus.Disconnected, async () => {
    try { await Promise.race([entersState(conn, VoiceConnectionStatus.Signalling, 5000), entersState(conn, VoiceConnectionStatus.Connecting, 5000)]); } catch {
      try { conn.destroy(); } catch {}
      client.voiceConnections.delete(guildId); client.audioStreams.delete(guildId); client.audioPlayers.delete(guildId);
      sendToChrxmee(guildId, { op: "destroy" });
    }
  });

  return conn;
}
global.ensureVoiceConnection = ensureVoiceConnection;

// ==================== SNIPES ====================
client.on("messageDelete", (msg) => {
  if (msg.author?.bot || !msg.content) return;
  const snipes = client.snipes.get(msg.channelId) || [];
  snipes.push({ author: msg.author, content: msg.content, timestamp: new Date(), type: "delete" });
  if (snipes.length > 100) snipes.shift();
  client.snipes.set(msg.channelId, snipes);
});
client.on("messageUpdate", (old, nw) => {
  if (old.author?.bot || old.content === nw.content) return;
  const snipes = client.snipes.get(old.channelId) || [];
  snipes.push({ author: old.author, content: nw.content, oldContent: old.content, timestamp: new Date(), type: "edit" });
  if (snipes.length > 100) snipes.shift();
  client.snipes.set(old.channelId, snipes);
});

// ==================== COMMANDS & EVENTS ====================
const cmdPath = path.join(__dirname, "commands");
if (fs.existsSync(cmdPath)) fs.readdirSync(cmdPath).filter(f => f.endsWith(".js")).forEach(f => { const c = require(path.join(cmdPath, f)); if (c.data && c.execute) client.commands.set(c.data.name, c); });

const evtPath = path.join(__dirname, "events");
if (fs.existsSync(evtPath)) fs.readdirSync(evtPath).filter(f => f.endsWith(".js")).forEach(f => { const e = require(path.join(evtPath, f)); if (e.once) client.once(e.name, (...a) => e.execute(...a)); else client.on(e.name, (...a) => e.execute(...a)); });

// ==================== HEARTBEAT ====================
let hb = 0;
setInterval(() => {
  hb++;
  if (client.user) client.user.setPresence({ activities: [{ name: "🎵 ChrxmeeStream v2.0", type: 0 }], status: "online" });
}, 300000);

// ==================== READY ====================
client.once("ready", async () => {
  console.log(`🤖 ${client.user.tag} ready`);
  setTimeout(() => connectToChrxmee(), 2000);

  try {
    const pg = await pool.connect();
    await pg.query(`CREATE TABLE IF NOT EXISTS guild_settings (guild_id BIGINT PRIMARY KEY, wake_up_mode TEXT DEFAULT 'default', auto_respond BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT NOW())`);
    await pg.query(`CREATE TABLE IF NOT EXISTS user_birthdays (user_id BIGINT PRIMARY KEY, birthday_date DATE NOT NULL, timezone TEXT NOT NULL, birthday_role_id BIGINT, ping_role_id BIGINT, set_at TIMESTAMP DEFAULT NOW())`);
    await pg.query(`CREATE TABLE IF NOT EXISTS user_interactions (user_id BIGINT PRIMARY KEY, custom_prompt TEXT DEFAULT '', preferred_model TEXT DEFAULT 'genius', created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())`);
    await pg.query(`CREATE TABLE IF NOT EXISTS user_personal_info (user_id BIGINT PRIMARY KEY, personal_info TEXT DEFAULT '{}', created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())`);
    await pg.query(`CREATE TABLE IF NOT EXISTS processed_messages (message_id BIGINT PRIMARY KEY, processed_at TIMESTAMP DEFAULT NOW())`);
    await pg.query(`CREATE TABLE IF NOT EXISTS keyword_responder (id SERIAL PRIMARY KEY, guild_id BIGINT NOT NULL, keyword TEXT NOT NULL, response TEXT NOT NULL, match_type TEXT DEFAULT 'contains', created_by BIGINT, created_at TIMESTAMP DEFAULT NOW(), UNIQUE (guild_id, keyword))`);
    await pg.query(`CREATE TABLE IF NOT EXISTS user_xp (user_id BIGINT NOT NULL, guild_id BIGINT NOT NULL, xp INTEGER DEFAULT 0, level INTEGER DEFAULT 0, prestige INTEGER DEFAULT 0, PRIMARY KEY (user_id, guild_id))`);
    await pg.query(`CREATE TABLE IF NOT EXISTS playlists (id SERIAL PRIMARY KEY, user_id BIGINT NOT NULL, name TEXT NOT NULL, is_public BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT NOW(), UNIQUE (user_id, name))`);
    await pg.query(`CREATE TABLE IF NOT EXISTS playlist_tracks (id SERIAL PRIMARY KEY, playlist_id INTEGER REFERENCES playlists(id) ON DELETE CASCADE, title TEXT NOT NULL, uri TEXT NOT NULL, author TEXT, duration BIGINT, added_at TIMESTAMP DEFAULT NOW())`);
    pg.release();
    console.log("✅ Postgres tables ready");
  } catch (err) { console.error("Postgres init error:", err.message); }

  setupAntinukeEvents(client);

  client.on("interactionCreate", async (i) => {
    if (i.isCommand()) {
      const cmd = client.commands.get(i.commandName);
      if (!cmd) return;
      try { await cmd.execute(i, client); } catch (err) {
        console.error(`Command ${i.commandName}:`, err.message);
        if (!i.replied && !i.deferred) await i.reply({ content: "❌ Error.", ephemeral: true }).catch(() => {});
      }
    }
    if (i.isStringSelectMenu() && i.customId === "help_select") {
      await i.deferReply({ ephemeral: true });
      let title = "", desc = "";
      switch (i.values[0]) {
        case "help_music": title = "🎵 Music (ChrxmeeStream v2.0)"; desc = "`/music play` `/music stop` `/music pause` `/music resume` `/music skip` `/music volume` `/music seek` `/music filter` `/music loop` `/music shuffle` `/music queue` `/music clearqueue` `/music autoplay` `/music leave` `/music player-set` `/music player-end` `/music player-loop` `/music nowplaying` `/music lyrics`"; break;
        default: title = "Help"; desc = "Select a category."; break;
      }
      await i.editReply({ embeds: [new EmbedBuilder().setColor("#2f3136").setTitle(title).setDescription(desc)], ephemeral: true });
    }
  });
});

// ==================== SHUTDOWN ====================
process.on("SIGINT", () => { stopAllWatchers(); try { chrxmeeServer.stop(); } catch {}; process.exit(0); });
process.on("SIGTERM", () => { stopAllWatchers(); try { chrxmeeServer.stop(); } catch {}; process.exit(0); });

// ==================== LOGIN ====================
client.login(process.env.BOT_TOKEN).then(() => console.log("✅ Logged in")).catch(err => console.error("Login failed:", err.message));
