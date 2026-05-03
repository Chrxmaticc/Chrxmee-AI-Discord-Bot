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
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Chrxmee AI is alive! 🚀");
});
const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Keep-alive server listening on port ${PORT}`);
});
server.on("error", (err) => {
  console.error("Keep-alive server error:", err.message);
  setTimeout(() => server.listen(PORT, "0.0.0.0"), 5000);
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

// ChrxmeeStream state
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

// ==================== CHRXMEESTREAM ====================
let chrxmeeConfig;
try {
  chrxmeeConfig = require("./chrxmee.config.json");
  console.log("📄 Loaded chrxmee.config.json");
} catch {
  chrxmeeConfig = { server: { port: 2333, host: "127.0.0.1", password: "chrxmee", audioDir: "./audio" } };
}

const CHRXMEE_PORT = parseInt(process.env.CHRXMEE_INTERNAL_PORT) || chrxmeeConfig.server?.port || 2333;
const CHRXMEE_HOST = process.env.CHRXMEE_INTERNAL_HOST || chrxmeeConfig.server?.host || "127.0.0.1";
const CHRXMEE_PASS = process.env.CHRXMEE_INTERNAL_PASS || chrxmeeConfig.server?.password || "chrxmee";
const CHRXMEE_DIR  = process.env.CHRXMEE_AUDIO_DIR     || chrxmeeConfig.server?.audioDir || "./audio";

console.log("🎵 Starting ChrxmeeStream v2.0.0 inside bot...");
const chrxmeeServer = new ChrxmeeServer({
  port: CHRXMEE_PORT,
  host: CHRXMEE_HOST,
  password: CHRXMEE_PASS,
  audioDir: CHRXMEE_DIR,
});
chrxmeeServer.start();
console.log(`🎵 ChrxmeeStream running on ws://${CHRXMEE_HOST}:${CHRXMEE_PORT}`);

// Internal WebSocket connection
let chrxmeeWs = null;
const chrxmeeQueue = new Map();

function connectToChrxmee() {
  chrxmeeWs = new WebSocket(`ws://${CHRXMEE_HOST}:${CHRXMEE_PORT}`, {
    headers: { Authorization: CHRXMEE_PASS },
  });

  chrxmeeWs.on("open", () => {
    console.log("✅ Connected to internal ChrxmeeStream");
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
    console.warn("⚠️ ChrxmeeStream disconnected. Retrying in 5s...");
    chrxmeeWs = null;
    setTimeout(connectToChrxmee, 5000);
  });

  chrxmeeWs.on("error", (err) => {
    chrxmeeWs = null;
    if (err.message.includes("ECONNREFUSED")) setTimeout(connectToChrxmee, 3000);
  });
}

function sendToChrxmee(guildId, op) {
  if (!op?.op) return;
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
    await interaction.reply({ content: "❌ You need to be in a voice channel first.", ephemeral: true });
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
    await interaction.reply({ content: "❌ Could not connect to voice channel.", ephemeral: true });
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
client.on("messageDelete", (message) => {
  if (message.author?.bot || !message.content) return;
  const snipes = client.snipes.get(message.channelId) || [];
  snipes.push({ author: message.author, content: message.content, timestamp: new Date(), type: "delete" });
  if (snipes.length > 100) snipes.shift();
  client.snipes.set(message.channelId, snipes);

  const text = message.content.toLowerCase();
  let roast = "";
  if (text.includes("kill") || text.includes("die") || text.includes("murder")) {
    roast = `Whoa ${message.author}, threats already? Taking notes... God mode engaged.`;
  } else if (text.includes("fuck") || text.includes("bitch") || text.includes("shit")) {
    roast = `God, I guess? ${message.author} typed that with full chest and zero brain cells. Touch grass.`;
  } else if (text.includes("ugly") || text.includes("stupid") || text.includes("loser")) {
    roast = `Oof ${message.author}... projecting much? Mirror called, wants its feelings back.`;
  }
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
const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith(".js"));
for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  if ("data" in command && "execute" in command) {
    client.commands.set(command.data.name, command);
  }
}

const eventsPath = path.join(__dirname, "events");
const eventFiles = fs.readdirSync(eventsPath).filter((file) => file.endsWith(".js"));
for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  const event = require(filePath);
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
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
    ];
    const activity = activities[Math.floor(Math.random() * activities.length)];
    client.user.setPresence({ activities: [{ name: activity, type: 0 }], status: "online" });
    console.log(`[HEARTBEAT #${heartbeatCount}] Presence: ${activity}`);
  }
}, 300000);

// ==================== CLIENT READY ====================
client.once("ready", async () => {
  try {
    console.log(`Logged in as ${client.user.tag}`);
    console.log(`Chrxmee AI ready as ${client.user.tag}`);

    setTimeout(() => connectToChrxmee(), 2000);

    const pgClient = await pool.connect();
    console.log("Postgres connected successfully on ready!");

    await pgClient.query(`CREATE TABLE IF NOT EXISTS guild_settings (guild_id BIGINT PRIMARY KEY, wake_up_mode TEXT DEFAULT 'default', auto_respond BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT NOW())`);
    console.log("guild_settings table ready");

    await pgClient.query(`CREATE TABLE IF NOT EXISTS user_birthdays (user_id BIGINT PRIMARY KEY, birthday_date DATE NOT NULL, timezone TEXT NOT NULL, birthday_role_id BIGINT, ping_role_id BIGINT, set_at TIMESTAMP DEFAULT NOW())`);
    console.log("user_birthdays table ready");

    await pgClient.query(`CREATE TABLE IF NOT EXISTS user_interactions (user_id BIGINT PRIMARY KEY, custom_prompt TEXT DEFAULT '', preferred_model TEXT DEFAULT 'genius', created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())`);
    console.log("user_interactions table ready");

    await pgClient.query(`CREATE TABLE IF NOT EXISTS user_personal_info (user_id BIGINT PRIMARY KEY, personal_info TEXT DEFAULT '{}', created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())`);
    console.log("user_personal_info table ready");

    await pgClient.query(`CREATE TABLE IF NOT EXISTS processed_messages (message_id BIGINT PRIMARY KEY, processed_at TIMESTAMP DEFAULT NOW())`);
    console.log("processed_messages table ready");

    await pgClient.query(`CREATE TABLE IF NOT EXISTS keyword_responder (id SERIAL PRIMARY KEY, guild_id BIGINT NOT NULL, keyword TEXT NOT NULL, response TEXT NOT NULL, match_type TEXT DEFAULT 'contains', created_by BIGINT, created_at TIMESTAMP DEFAULT NOW(), UNIQUE (guild_id, keyword))`);
    console.log("keyword_responder table ready");

    await pgClient.query(`CREATE TABLE IF NOT EXISTS user_xp (user_id BIGINT NOT NULL, guild_id BIGINT NOT NULL, xp INTEGER DEFAULT 0, level INTEGER DEFAULT 0, prestige INTEGER DEFAULT 0, PRIMARY KEY (user_id, guild_id))`);
    console.log("user_xp table ready");

    await pgClient.query(`CREATE TABLE IF NOT EXISTS xp_blacklisted_channels (guild_id BIGINT NOT NULL, channel_id BIGINT NOT NULL, PRIMARY KEY (guild_id, channel_id))`);
    console.log("xp_blacklisted_channels table ready");

    await pgClient.query(`CREATE TABLE IF NOT EXISTS xp_multipliers (guild_id BIGINT NOT NULL, role_id BIGINT NOT NULL, multiplier NUMERIC DEFAULT 1, PRIMARY KEY (guild_id, role_id))`);
    console.log("xp_multipliers table ready");

    await pgClient.query(`CREATE TABLE IF NOT EXISTS xp_level_roles (guild_id BIGINT NOT NULL, level INTEGER NOT NULL, role_id BIGINT NOT NULL, PRIMARY KEY (guild_id, level))`);
    console.log("xp_level_roles table ready");

    await pgClient.query(`CREATE TABLE IF NOT EXISTS playlists (id SERIAL PRIMARY KEY, user_id BIGINT NOT NULL, name TEXT NOT NULL, is_public BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT NOW(), UNIQUE (user_id, name))`);
    console.log("playlists table ready");

    await pgClient.query(`CREATE TABLE IF NOT EXISTS playlist_tracks (id SERIAL PRIMARY KEY, playlist_id INTEGER REFERENCES playlists(id) ON DELETE CASCADE, title TEXT NOT NULL, uri TEXT NOT NULL, author TEXT, duration BIGINT, added_at TIMESTAMP DEFAULT NOW())`);
    console.log("playlist_tracks table ready");

    await pgClient.query(`ALTER TABLE user_interactions ADD COLUMN IF NOT EXISTS preferred_model TEXT DEFAULT 'genius'`);

    const res = await pgClient.query("SELECT 1");
    console.log("Test query worked:", res.rows);
    pgClient.release();
    console.log("All tables ready — pool pre-warmed successfully");

    setupAntinukeEvents(client);

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
                await member.roles.add(role).catch(console.error);
                setTimeout(() => member.roles.remove(role).catch(console.error), 86400000);
              }
            }
            if (row.ping_role_id) {
              const channel = guild.systemChannel || guild.channels.cache.find((ch) => ch.isTextBased());
              if (channel) await channel.send(`<@&${row.ping_role_id}> Happy birthday to ${member}! 🎂`).catch(console.error);
            }
          }
        }
      } catch (err) {
        console.error("Birthday check failed:", err);
      }
    }, 86400000);

    client.user.setPresence({
      status: "online",
      activities: [{ name: "Discord World AI Competition", type: 0 }],
    });

  } catch (err) {
    console.error("READY EVENT CRASHED:", err);
    console.error("Stack trace:", err.stack);
  }
});

// ==================== RECONNECTION LOGIC ====================
client.on("disconnect", () => {
  console.log("Bot disconnected! Attempting to reconnect...");
});
client.on("error", (err) => {
  console.error("Discord client error:", err.message);
});
client.on("warn", (info) => {
  console.warn("Discord client warning:", info);
});

// ==================== GLOBAL ERROR HANDLERS ====================
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception thrown:", err);
});

// ==================== GRACEFUL SHUTDOWN ====================
process.on("SIGINT", () => {
  console.log("\n👋 Shutting down gracefully...");
  stopAllWatchers();
  for (const [guildId, conn] of client.voiceConnections) {
    try { conn.destroy(); } catch {}
    client.voiceConnections.delete(guildId);
  }
  try { chrxmeeServer.stop(); } catch {}
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n👋 Shutting down gracefully...");
  stopAllWatchers();
  for (const [guildId, conn] of client.voiceConnections) {
    try { conn.destroy(); } catch {}
    client.voiceConnections.delete(guildId);
  }
  try { chrxmeeServer.stop(); } catch {}
  process.exit(0);
});

// ==================== LOGIN ====================
console.log("BOT_TOKEN value:", process.env.BOT_TOKEN ? `exists, length: ${process.env.BOT_TOKEN.length}` : "MISSING OR EMPTY");

client.login(process.env.BOT_TOKEN).then(() => {
  console.log("Discord login successful!");
}).catch((err) => {
  console.error("Discord login FAILED:", err.message);
  console.error("Full error:", err);
});
