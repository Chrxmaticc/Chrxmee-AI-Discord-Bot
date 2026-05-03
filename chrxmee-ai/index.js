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

// ==================== SONG MARKERS ====================
const {
  applyStartMarker,
  startEndMarkerWatcher,
  stopEndMarkerWatcher,
  getMarkers,
  scheduleMarkers,
  stopEndMarkerWatcher: stopEndMarkerWatcherNew,
  stopAllWatchers,
} = require("./songMarkers");

// ==================== CONFIG LOADING ====================
let chrxmeeConfig;
try {
  chrxmeeConfig = require("./chrxmee.config.json");
  console.log("📄 Loaded chrxmee.config.json");
} catch {
  console.warn("⚠️ chrxmee.config.json not found, using defaults");
  chrxmeeConfig = {
    server: { port: 2333, host: "127.0.0.1", password: "chrxmee", audioDir: "./audio" },
  };
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
console.log("Starting keep-alive server...");
const keepAliveServer = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Chrxmee AI is alive! 🚀");
});
const PORT = process.env.PORT || 3000;
keepAliveServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Keep-alive server listening on port ${PORT}`);
});
keepAliveServer.on("error", (err) => {
  console.error("Keep-alive server error:", err.message);
  setTimeout(() => keepAliveServer.listen(PORT, "0.0.0.0"), 5000);
});

// ==================== CLIENT CREATION ====================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
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

// ==================== POSTGRES POOL ====================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

pool.on("error", (err) => {
  console.error("Postgres pool error:", err.message);
});

setInterval(async () => {
  try {
    const pgClient = await pool.connect();
    await pgClient.query("SELECT 1");
    pgClient.release();
    console.log("Postgres keep-alive ping OK");
  } catch (err) {
    console.error("Postgres keep-alive failed:", err.message);
  }
}, 30000);

client.pool = pool;

// ==================== CHRXMEESTREAM v2.0.0 ====================
// Read from chrxmee.config.json
const CHRXMEE_INTERNAL_PORT = parseInt(process.env.CHRXMEE_INTERNAL_PORT) || chrxmeeConfig.server?.port || 2333;
const CHRXMEE_INTERNAL_HOST = process.env.CHRXMEE_INTERNAL_HOST || chrxmeeConfig.server?.host || "127.0.0.1";
const CHRXMEE_INTERNAL_PASS = process.env.CHRXMEE_INTERNAL_PASS || chrxmeeConfig.server?.password || "chrxmee";
const CHRXMEE_AUDIO_DIR     = process.env.CHRXMEE_AUDIO_DIR     || chrxmeeConfig.server?.audioDir || "./audio";

// Security check: only bind to localhost
if (CHRXMEE_INTERNAL_HOST !== "127.0.0.1" && CHRXMEE_INTERNAL_HOST !== "localhost") {
  console.warn(`⚠️ SECURITY: ChrxmeeStream bound to ${CHRXMEE_INTERNAL_HOST}. Use 127.0.0.1 for internal use.`);
}

// Password validation
if (CHRXMEE_INTERNAL_PASS.length < 6) {
  console.error("❌ ChrxmeeStream password must be at least 6 characters.");
  process.exit(1);
}
if (CHRXMEE_INTERNAL_PASS === "chrxmee") {
  console.warn("⚠️ Using default password. Consider changing CHRXMEE_INTERNAL_PASS.");
}

console.log("🎵 Starting ChrxmeeStream v2.0.0 inside bot...");
const chrxmeeServer = new ChrxmeeServer({
  port:     CHRXMEE_INTERNAL_PORT,
  host:     CHRXMEE_INTERNAL_HOST,
  password: CHRXMEE_INTERNAL_PASS,
  audioDir: CHRXMEE_AUDIO_DIR,
});
chrxmeeServer.start();
console.log(`🎵 ChrxmeeStream running on ws://${CHRXMEE_INTERNAL_HOST}:${CHRXMEE_INTERNAL_PORT}`);

// ==================== INTERNAL WEBSOCKET CONNECTION ====================
let chrxmeeWs = null;
const chrxmeeQueue = new Map();
let chrxmeeReconnectAttempts = 0;
const CHRXMEE_MAX_RECONNECT = 10;
const CHRXMEE_RECONNECT_DELAY = 5000;

function connectToChrxmee() {
  if (chrxmeeReconnectAttempts >= CHRXMEE_MAX_RECONNECT) {
    console.error(`❌ Failed to connect after ${CHRXMEE_MAX_RECONNECT} attempts. Giving up.`);
    return;
  }

  chrxmeeReconnectAttempts++;
  console.log(`🔄 Connecting to ChrxmeeStream (${chrxmeeReconnectAttempts}/${CHRXMEE_MAX_RECONNECT})...`);

  chrxmeeWs = new WebSocket(`ws://${CHRXMEE_INTERNAL_HOST}:${CHRXMEE_INTERNAL_PORT}`, {
    headers: { Authorization: CHRXMEE_INTERNAL_PASS },
  });

  chrxmeeWs.on("open", () => {
    console.log("✅ Connected to internal ChrxmeeStream");
    chrxmeeReconnectAttempts = 0;

    for (const [guildId, ops] of chrxmeeQueue) {
      for (const op of ops) {
        chrxmeeWs.send(JSON.stringify({ guildId, ...op }));
      }
    }
    chrxmeeQueue.clear();
  });

  chrxmeeWs.on("message", (data, isBinary) => {
    if (isBinary) {
      if (data.length < 5) return;
      const guildIdLen = data.readUInt32BE(0);
      if (guildIdLen > 64 || guildIdLen < 1) return;
      if (data.length < 4 + guildIdLen) return;
      const guildId = data.subarray(4, 4 + guildIdLen).toString("utf8");
      if (!/^\d{17,20}$/.test(guildId)) return;
      const pcm = data.subarray(4 + guildIdLen);
      const stream = client.audioStreams.get(guildId);
      if (stream) stream.push(pcm);
    } else {
      try {
        const event = JSON.parse(data.toString());
        if (event.event === "error") console.error(`❌ [${event.guildId}] ${event.data?.message}`);
      } catch {}
    }
  });

  chrxmeeWs.on("close", () => {
    console.warn(`⚠️ ChrxmeeStream disconnected. Retrying in ${CHRXMEE_RECONNECT_DELAY / 1000}s...`);
    chrxmeeWs = null;
    setTimeout(connectToChrxmee, CHRXMEE_RECONNECT_DELAY);
  });

  chrxmeeWs.on("error", (err) => {
    console.error("ChrxmeeStream WS error:", err.message);
    chrxmeeWs = null;
    if (err.message.includes("ECONNREFUSED")) {
      setTimeout(connectToChrxmee, 3000);
    }
  });
}

// ==================== OP VALIDATION ====================
const ALLOWED_OPS = new Set([
  "play", "stop", "pause", "resume", "volume", "seek", "filter", "destroy",
  "queue_add", "queue_remove", "queue_move", "queue_shuffle", "queue_clear",
  "queue_list", "queue_loop", "playlist_create", "playlist_delete",
  "playlist_list", "playlist_get", "playlist_add", "record_start",
  "record_stop", "autodj_enable", "autodj_disable", "silenceguard_enable",
  "silenceguard_disable", "stats", "cache_stats", "diagnostics",
  "history", "history_search", "register",
]);

const VALID_FILTERS = new Set([
  "bassboost", "nightcore", "vaporwave", "slowed", "echo", "reverb",
  "normalize", "earrape", "karaoke", "mono", "treble", "soft",
  "underwater", "telephone", "chipmunk", "deep", "robot",
]);

function sendToChrxmee(guildId, op) {
  if (!op?.op || !ALLOWED_OPS.has(op.op)) { console.error(`❌ Rejected op: ${op?.op}`); return; }
  if (guildId && !/^\d{17,20}$/.test(guildId)) { console.error(`❌ Invalid guildId: ${guildId}`); return; }
  if (op.source && typeof op.source === "string") {
    if (op.source.length > 2000) return;
    if (/^(file|ftp|data|javascript):/i.test(op.source)) return;
  }
  if (op.op === "volume" && (op.value < 0 || op.value > 200)) return;
  if (op.op === "seek"   && (op.value < 0 || op.value > 86400)) return;
  if (op.filters) {
    for (const f of op.filters) { if (!VALID_FILTERS.has(f)) return; }
  }

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
  if (!vc) { await interaction.reply({ content: "❌ Join a voice channel first.", ephemeral: true }); return null; }

  let conn = client.voiceConnections.get(guildId);
  if (conn?.state?.status === VoiceConnectionStatus.Ready) return conn;

  conn = joinVoiceChannel({ channelId: vc.id, guildId, adapterCreator: interaction.guild.voiceAdapterCreator });
  try { await entersState(conn, VoiceConnectionStatus.Ready, 10000); } catch {
    conn.destroy(); await interaction.reply({ content: "❌ Could not connect.", ephemeral: true }); return null;
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
      conn.destroy(); client.voiceConnections.delete(guildId); client.audioStreams.delete(guildId); client.audioPlayers.delete(guildId);
      sendToChrxmee(guildId, { op: "destroy" });
    }
  });

  return conn;
}

global.ensureVoiceConnection = ensureVoiceConnection;

// ==================== SNIPE SYSTEM ====================
client.on("messageDelete", (message) => {
  if (message.author?.bot || !message.content) return;
  const snipes = client.snipes.get(message.channelId) || [];
  snipes.push({ author: message.author, content: message.content, timestamp: new Date(), type: "delete" });
  if (snipes.length > 100) snipes.shift();
  client.snipes.set(message.channelId, snipes);

  const text = message.content.toLowerCase();
  let roast = "";
  if (text.includes("kill") || text.includes("die") || text.includes("murder")) roast = `Whoa ${message.author}, threats already? Taking notes... God mode engaged.`;
  else if (text.includes("fuck") || text.includes("bitch") || text.includes("shit")) roast = `God, I guess? ${message.author} typed that with full chest and zero brain cells. Touch grass.`;
  else if (text.includes("ugly") || text.includes("stupid") || text.includes("loser")) roast = `Oof ${message.author}... projecting much? Mirror called, wants its feelings back.`;
  if (roast) message.channel.send(roast).catch(() => {});
});

client.on("messageUpdate", (oldMsg, newMsg) => {
  if (oldMsg.author?.bot || oldMsg.content === newMsg.content) return;
  const snipes = client.snipes.get(oldMsg.channelId) || [];
  snipes.push({ author: oldMsg.author, content: newMsg.content, oldContent: oldMsg.content, timestamp: new Date(), type: "edit" });
  if (snipes.length > 100) snipes.shift();
  client.snipes.set(oldMsg.channelId, snipes);
});

// ==================== COMMAND & EVENT LOADING ====================
const commandsPath = path.join(__dirname, "commands");
if (fs.existsSync(commandsPath)) {
  const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith(".js"));
  for (const file of commandFiles) {
    const cmd = require(path.join(commandsPath, file));
    if (cmd.data && cmd.execute) client.commands.set(cmd.data.name, cmd);
  }
}

const eventsPath = path.join(__dirname, "events");
if (fs.existsSync(eventsPath)) {
  const eventFiles = fs.readdirSync(eventsPath).filter(f => f.endsWith(".js"));
  for (const file of eventFiles) {
    const evt = require(path.join(eventsPath, file));
    if (evt.once) client.once(evt.name, (...args) => evt.execute(...args));
    else client.on(evt.name, (...args) => evt.execute(...args));
  }
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
      "Analyzing the void of existence.",
      `Active for ${Math.floor(process.uptime() / 3600)}h | ${client.guilds.cache.size} Servers`,
      `Handling ${heartbeatCount} heartbeats | High Traffic Mode 🚀`,
      "🎵 ChrxmeeStream v2.0",
    ];
    client.user.setPresence({ activities: [{ name: activities[Math.floor(Math.random() * activities.length)], type: 0 }], status: "online" });
  }
}, 300000);

// ==================== CLIENT READY ====================
client.once("ready", async () => {
  try {
    console.log(`Logged in as ${client.user.tag}`);

    // Connect to internal ChrxmeeStream after a short delay
    setTimeout(() => connectToChrxmee(), 2000);

    const pgClient = await pool.connect();
    console.log("Postgres connected!");

    await pgClient.query(`CREATE TABLE IF NOT EXISTS guild_settings (guild_id BIGINT PRIMARY KEY, wake_up_mode TEXT DEFAULT 'default', auto_respond BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT NOW())`);
    await pgClient.query(`CREATE TABLE IF NOT EXISTS user_birthdays (user_id BIGINT PRIMARY KEY, birthday_date DATE NOT NULL, timezone TEXT NOT NULL, birthday_role_id BIGINT, ping_role_id BIGINT, set_at TIMESTAMP DEFAULT NOW())`);
    await pgClient.query(`CREATE TABLE IF NOT EXISTS user_interactions (user_id BIGINT PRIMARY KEY, custom_prompt TEXT DEFAULT '', preferred_model TEXT DEFAULT 'genius', created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())`);
    await pgClient.query(`CREATE TABLE IF NOT EXISTS user_personal_info (user_id BIGINT PRIMARY KEY, personal_info TEXT DEFAULT '{}', created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())`);
    await pgClient.query(`CREATE TABLE IF NOT EXISTS processed_messages (message_id BIGINT PRIMARY KEY, processed_at TIMESTAMP DEFAULT NOW())`);
    await pgClient.query(`CREATE TABLE IF NOT EXISTS keyword_responder (id SERIAL PRIMARY KEY, guild_id BIGINT NOT NULL, keyword TEXT NOT NULL, response TEXT NOT NULL, match_type TEXT DEFAULT 'contains', created_by BIGINT, created_at TIMESTAMP DEFAULT NOW(), UNIQUE (guild_id, keyword))`);
    await pgClient.query(`CREATE TABLE IF NOT EXISTS user_xp (user_id BIGINT NOT NULL, guild_id BIGINT NOT NULL, xp INTEGER DEFAULT 0, level INTEGER DEFAULT 0, prestige INTEGER DEFAULT 0, PRIMARY KEY (user_id, guild_id))`);
    await pgClient.query(`CREATE TABLE IF NOT EXISTS xp_blacklisted_channels (guild_id BIGINT NOT NULL, channel_id BIGINT NOT NULL, PRIMARY KEY (guild_id, channel_id))`);
    await pgClient.query(`CREATE TABLE IF NOT EXISTS xp_multipliers (guild_id BIGINT NOT NULL, role_id BIGINT NOT NULL, multiplier NUMERIC DEFAULT 1, PRIMARY KEY (guild_id, role_id))`);
    await pgClient.query(`CREATE TABLE IF NOT EXISTS xp_level_roles (guild_id BIGINT NOT NULL, level INTEGER NOT NULL, role_id BIGINT NOT NULL, PRIMARY KEY (guild_id, level))`);
    await pgClient.query(`CREATE TABLE IF NOT EXISTS playlists (id SERIAL PRIMARY KEY, user_id BIGINT NOT NULL, name TEXT NOT NULL, is_public BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT NOW(), UNIQUE (user_id, name))`);
    await pgClient.query(`CREATE TABLE IF NOT EXISTS playlist_tracks (id SERIAL PRIMARY KEY, playlist_id INTEGER REFERENCES playlists(id) ON DELETE CASCADE, title TEXT NOT NULL, uri TEXT NOT NULL, author TEXT, duration BIGINT, added_at TIMESTAMP DEFAULT NOW())`);
    await pgClient.query(`ALTER TABLE user_interactions ADD COLUMN IF NOT EXISTS preferred_model TEXT DEFAULT 'genius'`);

    pgClient.release();
    console.log("All tables ready.");

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
              if (role) { await member.roles.add(role).catch(() => {}); setTimeout(() => member.roles.remove(role).catch(() => {}), 86400000); }
            }
            if (row.ping_role_id) {
              const channel = guild.systemChannel || guild.channels.cache.find(ch => ch.isTextBased());
              if (channel) await channel.send(`<@&${row.ping_role_id}> Happy birthday to ${member}! 🎂`).catch(() => {});
            }
          }
        }
      } catch {}
    }, 86400000);

    // Interaction handler
    client.on("interactionCreate", async (i) => {
      if (i.isCommand()) {
        const cmd = client.commands.get(i.commandName);
        if (!cmd) return;
        try { await cmd.execute(i, client); } catch (err) {
          console.error(`Command ${i.commandName}:`, err.message);
          if (!i.replied && !i.deferred) await i.reply({ content: "❌ Error executing command.", ephemeral: true }).catch(() => {});
        }
      }

      if (!i.isStringSelectMenu() || i.customId !== "help_select") return;
      await i.deferReply({ ephemeral: true });

      let title = "", desc = "";
      switch (i.values[0]) {
        case "help_ai": title = "AI-Powered Commands"; desc = "`/ask` `/chat` `/summarize` `/translate` `/debate` `/dream` `/model` `/news` `/oracle` `/code-generate`"; break;
        case "help_visual": title = "Visual"; desc = "`/image` `/imagine` `/generate-qr` `/avatar`"; break;
        case "help_fun": title = "Fun & Games"; desc = "`/roast` `/roastme` `/burn @user` `/coinflip` `/dice` `/poll` `/trivia` `/ship` `/8ball`"; break;
        case "help_music": title = "🎵 Music (ChrxmeeStream v2.0)"; desc = "`/music play` `/music stop` `/music pause` `/music resume` `/music skip` `/music volume` `/music seek` `/music filter` `/music loop` `/music shuffle` `/music queue` `/music clearqueue` `/music autoplay` `/music leave` `/music player-set` `/music player-end` `/music player-loop` `/music nowplaying` `/music lyrics`"; break;
        case "help_utility": title = "Utility"; desc = "`/snipe` `/ping` `/serverinfo` `/user @user` `/remind-me` `/quote` `/status` `/history`"; break;
        case "help_mod": title = "Moderation"; desc = "`/auto-respond` `/guild-settings` `/dashboard` `/brain-dump` `/clear-brain`"; break;
        default: return i.editReply({ content: "Unknown section.", ephemeral: true });
      }
      return i.editReply({ embeds: [new EmbedBuilder().setColor("#2f3136").setTitle(title).setDescription(desc)], ephemeral: true });
    });

  } catch (err) {
    console.error("READY EVENT CRASHED:", err);
  }
});

// ==================== SHUTDOWN ====================
process.on("SIGINT", () => { stopAllWatchers(); chrxmeeServer.stop(); process.exit(0); });
process.on("SIGTERM", () => { stopAllWatchers(); chrxmeeServer.stop(); process.exit(0); });

// ==================== LOGIN ====================
client.login(process.env.BOT_TOKEN).then(() => console.log("Discord login successful!")).catch(err => console.error("Login failed:", err.message));
