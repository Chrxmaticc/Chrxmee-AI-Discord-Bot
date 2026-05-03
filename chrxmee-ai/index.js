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
process.on("uncaughtException", (err) => console.error("💥 UNCAUGHT:", err.message, err.stack));
process.on("unhandledRejection", (reason) => console.error("💥 REJECTION:", reason));

// ==================== CONFIG ====================
let chrxmeeConfig;
try { chrxmeeConfig = require("./chrxmee.config.json"); console.log("📄 Loaded chrxmee.config.json"); }
catch { chrxmeeConfig = { server: { port: 2333, host: "127.0.0.1", password: "chrxmee", audioDir: "./audio" } }; }

function msToTime(ms) {
  const s = Math.floor((ms / 1000) % 60), m = Math.floor((ms / 60000) % 60), h = Math.floor(ms / 3600000);
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

// ==================== KEEP-ALIVE ====================
require("http").createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Chrxmee AI is alive! 🚀");
}).listen(process.env.PORT || 3000, "0.0.0.0", () => console.log("Keep-alive on port", process.env.PORT || 3000));

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
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});
pool.on("error", (err) => console.error("Postgres error:", err.message));
setInterval(async () => {
  try { const c = await pool.connect(); await c.query("SELECT 1"); c.release(); }
  catch (err) { console.error("Postgres keep-alive failed:", err.message); }
}, 30000);
client.pool = pool;

// ==================== CHRXMEESTREAM ====================
const CHRXMEE_PORT = parseInt(process.env.CHRXMEE_INTERNAL_PORT) || chrxmeeConfig.server?.port || 2333;
const CHRXMEE_HOST = process.env.CHRXMEE_INTERNAL_HOST || chrxmeeConfig.server?.host || "127.0.0.1";
const CHRXMEE_PASS = process.env.CHRXMEE_INTERNAL_PASS || chrxmeeConfig.server?.password || "chrxmee";
const CHRXMEE_DIR  = process.env.CHRXMEE_AUDIO_DIR     || chrxmeeConfig.server?.audioDir || "./audio";

if (CHRXMEE_HOST !== "127.0.0.1" && CHRXMEE_HOST !== "localhost") {
  console.warn(`⚠️ SECURITY: ChrxmeeStream bound to ${CHRXMEE_HOST}. Use 127.0.0.1.`);
}
if (CHRXMEE_PASS.length < 6) { console.error("❌ Password too short."); process.exit(1); }
if (CHRXMEE_PASS === "chrxmee") console.warn("⚠️ Using default ChrxmeeStream password.");

console.log("🎵 Starting ChrxmeeStream v2.0.0...");
const chrxmeeServer = new ChrxmeeServer({
  port: CHRXMEE_PORT,
  host: CHRXMEE_HOST,
  password: CHRXMEE_PASS,
  audioDir: CHRXMEE_DIR,
});
chrxmeeServer.start();
console.log(`🎵 ChrxmeeStream running on ws://${CHRXMEE_HOST}:${CHRXMEE_PORT}`);

// ==================== WEBSOCKET TO CHRXMEESTREAM ====================
let chrxmeeWs = null;
const chrxmeeQueue = new Map();
let reconnectAttempts = 0;
const MAX_RECONNECT = 10;

function connectToChrxmee() {
  if (reconnectAttempts >= MAX_RECONNECT) {
    console.error("❌ Max reconnect attempts reached. Giving up.");
    return;
  }
  reconnectAttempts++;

  chrxmeeWs = new WebSocket(`ws://${CHRXMEE_HOST}:${CHRXMEE_PORT}`, {
    headers: { Authorization: CHRXMEE_PASS },
  });

  chrxmeeWs.on("open", () => {
    console.log("✅ Connected to internal ChrxmeeStream");
    reconnectAttempts = 0;
    for (const [guildId, ops] of chrxmeeQueue) {
      for (const op of ops) {
        chrxmeeWs.send(JSON.stringify({ guildId, ...op }));
      }
    }
    chrxmeeQueue.clear();
  });

  chrxmeeWs.on("message", (data, isBinary) => {
    if (isBinary) {
      try {
        if (data.length < 5) return;
        const guildIdLen = data.readUInt32BE(0);
        if (guildIdLen > 64 || guildIdLen < 1 || data.length < 4 + guildIdLen) return;
        const guildId = data.subarray(4, 4 + guildIdLen).toString("utf8");
        if (!/^\d{17,20}$/.test(guildId)) return;
        const stream = client.audioStreams.get(guildId);
        if (stream) stream.push(data.subarray(4 + guildIdLen));
      } catch {}
    }
  });

  chrxmeeWs.on("close", () => {
    console.warn("⚠️ ChrxmeeStream disconnected. Retrying...");
    chrxmeeWs = null;
    setTimeout(connectToChrxmee, 5000);
  });

  chrxmeeWs.on("error", (err) => {
    chrxmeeWs = null;
    if (err.message.includes("ECONNREFUSED")) {
      setTimeout(connectToChrxmee, 3000);
    }
  });
}

// ==================== SEND OP (SECURE) ====================
const ALLOWED_OPS = new Set([
  "play", "stop", "pause", "resume", "volume", "seek", "filter", "destroy",
  "queue_add", "queue_remove", "queue_move", "queue_shuffle", "queue_clear",
  "queue_list", "queue_loop", "autodj_enable", "autodj_disable",
  "history", "history_search", "stats", "diagnostics",
]);

const VALID_FILTERS = new Set([
  "bassboost", "nightcore", "vaporwave", "slowed", "echo", "reverb",
  "normalize", "earrape", "karaoke", "mono", "treble", "soft",
  "underwater", "telephone", "chipmunk", "deep", "robot",
]);

function sendToChrxmee(guildId, op) {
  if (!op?.op || !ALLOWED_OPS.has(op.op)) return;
  if (guildId && !/^\d{17,20}$/.test(guildId)) return;
  if (op.source && (op.source.length > 2000 || /^(file|ftp|data|javascript):/i.test(op.source))) return;
  if (op.op === "volume" && (op.value < 0 || op.value > 200)) return;
  if (op.op === "seek"   && (op.value < 0 || op.value > 86400)) return;
  if (op.filters) for (const f of op.filters) if (!VALID_FILTERS.has(f)) return;

  const payload = JSON.stringify({ guildId, ...op });

  if (chrxmeeWs?.readyState === WebSocket.OPEN) {
    chrxmeeWs.send(payload);
  } else {
    if (!chrxmeeQueue.has(guildId)) chrxmeeQueue.set(guildId, []);
    chrxmeeQueue.get(guildId).push(op);
  }
}

global.sendToChrxmee = sendToChrxmee;

// ==================== VOICE HELPERS ====================
async function ensureVoiceConnection(interaction) {
  const guildId = interaction.guildId;
  const vc = interaction.member?.voice?.channel;

  if (!vc) {
    await interaction.reply({ content: "❌ Join a voice channel first.", ephemeral: true });
    return null;
  }

  let conn = client.voiceConnections.get(guildId);
  if (conn?.state?.status === VoiceConnectionStatus.Ready) return conn;

  conn = joinVoiceChannel({
    channelId: vc.id,
    guildId,
    adapterCreator: interaction.guild.voiceAdapterCreator,
  });

  try {
    await entersState(conn, VoiceConnectionStatus.Ready, 10000);
  } catch {
    try { conn.destroy(); } catch {}
    await interaction.reply({ content: "❌ Could not connect.", ephemeral: true });
    return null;
  }

  client.voiceConnections.set(guildId, conn);

  const stream = new PassThrough();
  client.audioStreams.set(guildId, stream);

  const player = createAudioPlayer();
  player.play(createAudioResource(stream, { inputType: StreamType.Raw }));
  conn.subscribe(player);
  client.audioPlayers.set(guildId, player);

  conn.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      await Promise.race([
        entersState(conn, VoiceConnectionStatus.Signalling, 5000),
        entersState(conn, VoiceConnectionStatus.Connecting, 5000),
      ]);
    } catch {
      try { conn.destroy(); } catch {}
      client.voiceConnections.delete(guildId);
      client.audioStreams.delete(guildId);
      client.audioPlayers.delete(guildId);
      sendToChrxmee(guildId, { op: "destroy" });
    }
  });

  return conn;
}

global.ensureVoiceConnection = ensureVoiceConnection;

// ==================== SNIPE SYSTEM ====================
client.on("messageDelete", (msg) => {
  if (msg.author?.bot || !msg.content) return;
  const snipes = client.snipes.get(msg.channelId) || [];
  snipes.push({ author: msg.author, content: msg.content, timestamp: new Date(), type: "delete" });
  if (snipes.length > 100) snipes.shift();
  client.snipes.set(msg.channelId, snipes);
});

client.on("messageUpdate", (oldMsg, newMsg) => {
  if (oldMsg.author?.bot || oldMsg.content === newMsg.content) return;
  const snipes = client.snipes.get(oldMsg.channelId) || [];
  snipes.push({ author: oldMsg.author, content: newMsg.content, oldContent: oldMsg.content, timestamp: new Date(), type: "edit" });
  if (snipes.length > 100) snipes.shift();
  client.snipes.set(oldMsg.channelId, snipes);
});

// ==================== COMMAND LOADING ====================
const commandsPath = path.join(__dirname, "commands");
if (fs.existsSync(commandsPath)) {
  fs.readdirSync(commandsPath)
    .filter((f) => f.endsWith(".js"))
    .forEach((f) => {
      const cmd = require(path.join(commandsPath, f));
      if (cmd.data && cmd.execute) client.commands.set(cmd.data.name, cmd);
    });
}

// ==================== EVENT LOADING ====================
// Load all event files — including your interactionCreate.js
const eventsPath = path.join(__dirname, "events");
if (fs.existsSync(eventsPath)) {
  fs.readdirSync(eventsPath)
    .filter((f) => f.endsWith(".js"))
    .forEach((f) => {
      const evt = require(path.join(eventsPath, f));
      if (evt.once) client.once(evt.name, (...args) => evt.execute(...args, client));
      else client.on(evt.name, (...args) => evt.execute(...args, client));
    });
}

// ==================== HEARTBEAT ====================
let heartbeatCount = 0;
setInterval(() => {
  heartbeatCount++;
  if (client.user) {
    const activities = [
      "Discord World AI Competition",
      "Winning against Chatcord",
      "Smarter than your average bot.",
      `Active for ${Math.floor(process.uptime() / 3600)}h | ${client.guilds.cache.size} Servers`,
      "🎵 ChrxmeeStream v2.0",
    ];
    client.user.setPresence({
      activities: [{ name: activities[Math.floor(Math.random() * activities.length)], type: 0 }],
      status: "online",
    });
  }
}, 300000);

// ==================== READY ====================
client.once("ready", async () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);

  // Connect to internal ChrxmeeStream after a short delay
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
    await pg.query(`ALTER TABLE user_interactions ADD COLUMN IF NOT EXISTS preferred_model TEXT DEFAULT 'genius'`);

    pg.release();
    console.log("✅ Postgres tables ready");
  } catch (err) {
    console.error("Postgres init error:", err.message);
  }

  setupAntinukeEvents(client);

  // Birthday checker
  setInterval(async () => {
    try {
      const today = new Date();
      const result = await pool.query(`SELECT user_id, birthday_date, birthday_role_id, ping_role_id FROM user_birthdays`);
      for (const row of result.rows) {
        const bday = new Date(row.birthday_date);
        if (bday.getMonth() === today.getMonth() && bday.getDate() === today.getDate()) {
          const guild = client.guilds.cache.first();
          if (!guild) continue;
          const member = await guild.members.fetch(row.user_id).catch(() => null);
          if (!member) continue;
          if (row.birthday_role_id) {
            const role = guild.roles.cache.get(row.birthday_role_id);
            if (role) {
              await member.roles.add(role).catch(() => {});
              setTimeout(() => member.roles.remove(role).catch(() => {}), 86400000);
            }
          }
          if (row.ping_role_id) {
            const channel = guild.systemChannel || guild.channels.cache.find((ch) => ch.isTextBased());
            if (channel) await channel.send(`<@&${row.ping_role_id}> Happy birthday to ${member}! 🎂`).catch(() => {});
          }
        }
      }
    } catch {}
  }, 86400000);
});

// ==================== SHUTDOWN ====================
process.on("SIGINT", () => {
  console.log("\n👋 Shutting down...");
  stopAllWatchers();
  for (const [guildId, conn] of client.voiceConnections) {
    try { conn.destroy(); } catch {}
    client.voiceConnections.delete(guildId);
  }
  try { chrxmeeServer.stop(); } catch {}
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n👋 Shutting down...");
  stopAllWatchers();
  for (const [guildId, conn] of client.voiceConnections) {
    try { conn.destroy(); } catch {}
    client.voiceConnections.delete(guildId);
  }
  try { chrxmeeServer.stop(); } catch {}
  process.exit(0);
});

// ==================== LOGIN ====================
client.login(process.env.BOT_TOKEN)
  .then(() => console.log("✅ Discord login successful!"))
  .catch((err) => console.error("Login failed:", err.message));
