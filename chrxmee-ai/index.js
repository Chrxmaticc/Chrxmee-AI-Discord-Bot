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
} = require("./songMarkers");

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
client.playerMarkers = new Map(); // guildId -> { start?, end?, loop? }

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
// ── Security: Validate config before starting ────────────────
const CHRXMEE_INTERNAL_PORT = parseInt(process.env.CHRXMEE_INTERNAL_PORT) || 2333;
const CHRXMEE_INTERNAL_HOST = process.env.CHRXMEE_INTERNAL_HOST || "127.0.0.1";
const CHRXMEE_INTERNAL_PASS = process.env.CHRXMEE_INTERNAL_PASS || "chrxmee";

// Security check: only bind to localhost for internal use
if (CHRXMEE_INTERNAL_HOST !== "127.0.0.1" && CHRXMEE_INTERNAL_HOST !== "localhost") {
  console.warn("⚠️  SECURITY: ChrxmeeStream should bind to 127.0.0.1 when running inside the bot.");
  console.warn(`   Current host: ${CHRXMEE_INTERNAL_HOST} — external connections possible.`);
}

console.log("🎵 Starting ChrxmeeStream v2.0.0 inside bot...");
const chrxmeeServer = new ChrxmeeServer({
  port:     CHRXMEE_INTERNAL_PORT,
  host:     CHRXMEE_INTERNAL_HOST,
  password: CHRXMEE_INTERNAL_PASS,
  audioDir: process.env.CHRXMEE_AUDIO_DIR || "./audio",
});
chrxmeeServer.start();
console.log(`🎵 ChrxmeeStream running on ws://${CHRXMEE_INTERNAL_HOST}:${CHRXMEE_INTERNAL_PORT}`);

// ── Internal WebSocket connection ───────────────────────────
let chrxmeeWs = null;
const chrxmeeQueue = new Map();
let chrxmeeReconnectAttempts = 0;
const CHRXMEE_MAX_RECONNECT_ATTEMPTS = 10;
const CHRXMEE_RECONNECT_DELAY = 5000;

// ── Security: Password validation ───────────────────────────
function validateChrxmeePassword(password) {
  if (!password || password.length < 6) {
    console.error("❌ SECURITY: ChrxmeeStream password must be at least 6 characters.");
    return false;
  }
  if (password === "chrxmee") {
    console.warn("⚠️  SECURITY: Using default ChrxmeeStream password. Consider changing it.");
  }
  return true;
}

if (!validateChrxmeePassword(CHRXMEE_INTERNAL_PASS)) {
  console.error("❌ ChrxmeeStream password validation failed. Check your .env file.");
}

function connectToChrxmee() {
  if (chrxmeeReconnectAttempts >= CHRXMEE_MAX_RECONNECT_ATTEMPTS) {
    console.error(`❌ Failed to connect to ChrxmeeStream after ${CHRXMEE_MAX_RECONNECT_ATTEMPTS} attempts. Giving up.`);
    return;
  }

  chrxmeeReconnectAttempts++;
  console.log(`🔄 Connecting to ChrxmeeStream (attempt ${chrxmeeReconnectAttempts}/${CHRXMEE_MAX_RECONNECT_ATTEMPTS})...`);

  chrxmeeWs = new WebSocket(`ws://${CHRXMEE_INTERNAL_HOST}:${CHRXMEE_INTERNAL_PORT}`, {
    headers: { Authorization: CHRXMEE_INTERNAL_PASS },
  });

  chrxmeeWs.on("open", () => {
    console.log("✅ Connected to internal ChrxmeeStream");
    chrxmeeReconnectAttempts = 0;

    // Flush queued messages
    for (const [guildId, ops] of chrxmeeQueue) {
      for (const op of ops) {
        chrxmeeWs.send(JSON.stringify({ guildId, ...op }));
      }
    }
    chrxmeeQueue.clear();
  });

  chrxmeeWs.on("message", (data, isBinary) => {
    if (isBinary) {
      // ── Security: Validate binary frame length ──────────
      if (data.length < 5) {
        console.warn("⚠️  Received invalid binary frame (too short)");
        return;
      }

      const guildIdLen = data.readUInt32BE(0);

      // Security: Prevent buffer overflow on malformed frames
      if (guildIdLen > 64 || guildIdLen < 1) {
        console.warn(`⚠️  Invalid guildId length in binary frame: ${guildIdLen}`);
        return;
      }
      if (data.length < 4 + guildIdLen) {
        console.warn("⚠️  Binary frame too short for claimed guildId length");
        return;
      }

      const guildId = data.subarray(4, 4 + guildIdLen).toString("utf8");
      const pcm = data.subarray(4 + guildIdLen);

      // Security: Validate guildId format (numeric Discord ID)
      if (!/^\d{17,20}$/.test(guildId)) {
        console.warn(`⚠️  Invalid guildId format in binary frame: ${guildId}`);
        return;
      }

      const stream = client.audioStreams.get(guildId);
      if (stream) stream.push(pcm);
    } else {
      try {
        const event = JSON.parse(data.toString());
        handleChrxmeeEvent(event);
      } catch (err) {
        console.error("❌ Failed to parse ChrxmeeStream event:", err.message);
      }
    }
  });

  chrxmeeWs.on("close", (code) => {
    console.warn(`⚠️ ChrxmeeStream disconnected (code: ${code}). Reconnecting in ${CHRXMEE_RECONNECT_DELAY / 1000}s...`);
    chrxmeeWs = null;
    setTimeout(connectToChrxmee, CHRXMEE_RECONNECT_DELAY);
  });

  chrxmeeWs.on("error", (err) => {
    console.error("ChrxmeeStream WS error:", err.message);
    chrxmeeWs = null;
  });
}

// ── Security: Op validation before sending ──────────────────
const ALLOWED_OPS = new Set([
  "play", "stop", "pause", "resume", "volume", "seek", "filter", "destroy",
  "queue_add", "queue_remove", "queue_move", "queue_shuffle", "queue_clear",
  "queue_list", "queue_loop", "playlist_create", "playlist_delete",
  "playlist_list", "playlist_get", "playlist_add", "record_start",
  "record_stop", "autodj_enable", "autodj_disable", "silenceguard_enable",
  "silenceguard_disable", "stats", "cache_stats", "diagnostics",
  "history", "history_search", "register",
]);

function sendToChrxmee(guildId, op) {
  // Security: Validate op type
  if (!op || !op.op) {
    console.error("❌ Invalid ChrxmeeStream op: missing op type");
    return;
  }
  if (!ALLOWED_OPS.has(op.op)) {
    console.error(`❌ Unknown ChrxmeeStream op rejected: ${op.op}`);
    return;
  }

  // Security: Validate guildId
  if (guildId && !/^\d{17,20}$/.test(guildId)) {
    console.error(`❌ Invalid guildId format: ${guildId}`);
    return;
  }

  // Security: Sanitize source string
  if (op.source && typeof op.source === "string") {
    if (op.source.length > 2000) {
      console.error("❌ Source URL too long (max 2000 chars)");
      return;
    }
    // Block potentially dangerous protocols
    if (/^(file|ftp|data|javascript):/i.test(op.source)) {
      console.error(`❌ Blocked potentially dangerous source protocol: ${op.source.slice(0, 50)}`);
      return;
    }
  }

  // Security: Validate volume range
  if (op.value !== undefined && op.op === "volume") {
    if (op.value < 0 || op.value > 200) {
      console.error(`❌ Volume out of range: ${op.value}`);
      return;
    }
  }

  // Security: Validate seek value
  if (op.value !== undefined && op.op === "seek") {
    if (op.value < 0 || op.value > 86400) {
      console.error(`❌ Seek value out of range: ${op.value}`);
      return;
    }
  }

  // Security: Validate filter names
  if (op.filters && Array.isArray(op.filters)) {
    const VALID_FILTERS = new Set([
      "bassboost", "nightcore", "vaporwave", "slowed", "echo", "reverb",
      "normalize", "earrape", "karaoke", "mono", "treble", "soft",
      "underwater", "telephone", "chipmunk", "deep", "robot",
    ]);
    for (const f of op.filters) {
      if (!VALID_FILTERS.has(f)) {
        console.error(`❌ Unknown filter rejected: ${f}`);
        return;
      }
    }
  }

  const payload = JSON.stringify({ guildId, ...op });

  if (chrxmeeWs && chrxmeeWs.readyState === WebSocket.OPEN) {
    chrxmeeWs.send(payload);
  } else {
    // Queue for when connection opens
    if (!chrxmeeQueue.has(guildId)) chrxmeeQueue.set(guildId, []);
    chrxmeeQueue.get(guildId).push(op);
  }
}

// Expose globally so command files can use it
global.sendToChrxmee = sendToChrxmee;

function handleChrxmeeEvent(event) {
  const { event: type, guildId, data } = event;

  // Security: Validate event type
  if (!type || typeof type !== "string") return;

  switch (type) {
    case "trackStart":
      console.log(`▶️  [${guildId}] Now playing: ${data?.source}`);
      break;
    case "trackEnd":
      console.log(`⏹️  [${guildId}] Track ended`);
      break;
    case "paused":
      console.log(`⏸️  [${guildId}] Paused`);
      break;
    case "resumed":
      console.log(`▶️  [${guildId}] Resumed`);
      break;
    case "stopped":
      console.log(`⏹️  [${guildId}] Stopped`);
      break;
    case "queueUpdated":
      console.log(`📋 [${guildId}] Queue updated (${data?.length || 0} tracks)`);
      break;
    case "queueCleared":
      console.log(`🗑️  [${guildId}] Queue cleared`);
      break;
    case "loopSet":
      console.log(`🔁 [${guildId}] Loop mode: ${data?.mode}`);
      break;
    case "error":
      console.error(`❌ [${guildId}] ChrxmeeStream error: ${data?.message}`);
      break;
    case "lowDataMode":
      console.warn(`📉 [${guildId}] Low Data Mode: ${data?.enabled ? "ON" : "OFF"}`);
      break;
    case "trackStart":
      console.log(`▶️  [${guildId}] Track started: ${data?.source}`);
      break;
    case "trackEnd":
      console.log(`⏹️  [${guildId}] Track ended`);
      break;
    default:
      // Silently ignore unknown events
      break;
  }
}

// ==================== VOICE HELPERS ====================
async function ensureVoiceConnection(interaction) {
  const guildId = interaction.guildId;
  const member = interaction.member;
  const voiceChannel = member?.voice?.channel;

  if (!voiceChannel) {
    await interaction.reply({ content: "❌ You need to be in a voice channel first.", ephemeral: true });
    return null;
  }

  // Already connected?
  let connection = client.voiceConnections.get(guildId);
  if (connection && connection.state?.status === VoiceConnectionStatus.Ready) {
    return connection;
  }

  // Create new connection
  connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId,
    adapterCreator: interaction.guild.voiceAdapterCreator,
  });

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 10000);
  } catch (err) {
    connection.destroy();
    await interaction.reply({ content: "❌ Could not connect to voice channel.", ephemeral: true });
    return null;
  }

  client.voiceConnections.set(guildId, connection);

  // Create audio stream and player
  const audioStream = new PassThrough();
  client.audioStreams.set(guildId, audioStream);

  const audioPlayer = createAudioPlayer();
  const resource = createAudioResource(audioStream, { inputType: StreamType.Raw });
  audioPlayer.play(resource);
  connection.subscribe(audioPlayer);
  client.audioPlayers.set(guildId, audioPlayer);

  // Handle disconnect
  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 5000),
        entersState(connection, VoiceConnectionStatus.Connecting, 5000),
      ]);
    } catch {
      connection.destroy();
      client.voiceConnections.delete(guildId);
      client.audioStreams.delete(guildId);
      client.audioPlayers.delete(guildId);
      sendToChrxmee(guildId, { op: "destroy" });
    }
  });

  return connection;
}

// Expose globally
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
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
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

    // Connect to internal ChrxmeeStream
    connectToChrxmee();

    const pgClient = await pool.connect();
    console.log("Postgres connected successfully on ready!");

    // ── Core Settings ──────────────────────────────────────────
    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS guild_settings (
        guild_id BIGINT PRIMARY KEY,
        wake_up_mode TEXT DEFAULT 'default',
        auto_respond BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("guild_settings table ready");

    // ── Birthdays ──────────────────────────────────────────────
    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS user_birthdays (
        user_id BIGINT PRIMARY KEY,
        birthday_date DATE NOT NULL,
        timezone TEXT NOT NULL,
        birthday_role_id BIGINT,
        ping_role_id BIGINT,
        set_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("user_birthdays table ready");

    // ── AI Interactions ────────────────────────────────────────
    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS user_interactions (
        user_id BIGINT PRIMARY KEY,
        custom_prompt TEXT DEFAULT '',
        preferred_model TEXT DEFAULT 'genius',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("user_interactions table ready");

    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS user_personal_info (
        user_id BIGINT PRIMARY KEY,
        personal_info TEXT DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("user_personal_info table ready");

    // ── Message Deduplication ──────────────────────────────────
    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS processed_messages (
        message_id BIGINT PRIMARY KEY,
        processed_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("processed_messages table ready");

    // ── Keyword Responder ──────────────────────────────────────
    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS keyword_responder (
        id SERIAL PRIMARY KEY,
        guild_id BIGINT NOT NULL,
        keyword TEXT NOT NULL,
        response TEXT NOT NULL,
        match_type TEXT DEFAULT 'contains',
        created_by BIGINT,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE (guild_id, keyword)
      )
    `);
    console.log("keyword_responder table ready");

    // ── XP System ─────────────────────────────────────────────
    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS user_xp (
        user_id BIGINT NOT NULL,
        guild_id BIGINT NOT NULL,
        xp INTEGER DEFAULT 0,
        level INTEGER DEFAULT 0,
        prestige INTEGER DEFAULT 0,
        PRIMARY KEY (user_id, guild_id)
      )
    `);
    console.log("user_xp table ready");

    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS xp_blacklisted_channels (
        guild_id BIGINT NOT NULL,
        channel_id BIGINT NOT NULL,
        PRIMARY KEY (guild_id, channel_id)
      )
    `);
    console.log("xp_blacklisted_channels table ready");

    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS xp_multipliers (
        guild_id BIGINT NOT NULL,
        role_id BIGINT NOT NULL,
        multiplier NUMERIC DEFAULT 1,
        PRIMARY KEY (guild_id, role_id)
      )
    `);
    console.log("xp_multipliers table ready");

    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS xp_level_roles (
        guild_id BIGINT NOT NULL,
        level INTEGER NOT NULL,
        role_id BIGINT NOT NULL,
        PRIMARY KEY (guild_id, level)
      )
    `);
    console.log("xp_level_roles table ready");

    // ── Playlists ──────────────────────────────────────────────
    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS playlists (
        id SERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        name TEXT NOT NULL,
        is_public BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE (user_id, name)
      )
    `);
    console.log("playlists table ready");

    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS playlist_tracks (
        id SERIAL PRIMARY KEY,
        playlist_id INTEGER REFERENCES playlists(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        uri TEXT NOT NULL,
        author TEXT,
        duration BIGINT,
        added_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("playlist_tracks table ready");

    // ── Migrations ─────────────────────────────────────────────
    await pgClient.query(`ALTER TABLE user_interactions ADD COLUMN IF NOT EXISTS preferred_model TEXT DEFAULT 'genius'`);

    const res = await pgClient.query("SELECT 1");
    console.log("Test query worked:", res.rows);
    pgClient.release();
    console.log("All tables ready — pool pre-warmed successfully");

    setupAntinukeEvents(client);

    // ── Birthday Checker ───────────────────────────────────────
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

    client.on("interactionCreate", async (i) => {
      if (i.isCommand()) {
        const command = client.commands.get(i.commandName);
        if (!command) return;
        try {
          await command.execute(i, client);
        } catch (err) {
          console.error(`Command ${i.commandName} error:`, err);
          if (!i.replied && !i.deferred) {
            await i.reply({ content: "❌ An error occurred while executing this command.", ephemeral: true }).catch(() => {});
          }
        }
      }

      if (!i.isStringSelectMenu()) return;
      if (i.customId !== "help_select") return;
      await i.deferReply({ ephemeral: true });

      let title = "", desc = "";
      switch (i.values[0]) {
        case "help_ai":
          title = "AI-Powered Commands";
          desc = "`/ask` — Ask anything to the AI\n`/chat` — Chat with the bot\n`/summarize` — Summarize text\n`/translate` — Translate text\n`/debate` — Debate with the bot\n`/dream` — Generate dream/image\n`/model` — Switch AI model\n`/news` — Get news\n`/oracle` — Oracle prediction\n`/code-generate` — Generate code";
          break;
        case "help_visual":
          title = "Visual Imagination";
          desc = "`/image` — Search images\n`/imagine` — Imagine something\n`/generate-qr` — QR code\n`/avatar` — User avatar";
          break;
        case "help_fun":
          title = "Fun & Games";
          desc = "`/roast` — Roast someone\n`/roastme` — Get roasted\n`/burn @user` — Burn someone\n`/coinflip` — Coin flip\n`/dice` — Roll dice\n`/poll` — Create poll\n`/trivia` — Trivia game\n`/ship` — Ship two users\n`/8ball` — Magic 8-ball";
          break;
        case "help_music":
          title = "🎵 Music (ChrxmeeStream v2.0)";
          desc = "`/music play` — Play a song\n`/music stop` — Stop playback\n`/music pause` — Pause\n`/music resume` — Resume\n`/music skip` — Skip track\n`/music volume` — Set volume\n`/music seek` — Seek to position\n`/music filter` — Apply filters\n`/music loop` — Loop mode\n`/music shuffle` — Shuffle queue\n`/music queue` — View queue\n`/music clearqueue` — Clear queue\n`/music autoplay` — Toggle Auto DJ\n`/music leave` — Leave VC\n`/music player-set` — Set start marker\n`/music player-end` — Set end marker\n`/music player-loop` — Toggle marker loop\n`/music nowplaying` — Now playing\n`/music lyrics` — Get lyrics";
          break;
        case "help_utility":
          title = "Utility";
          desc = "`/snipe` — Snipe messages\n`/ping` — Ping bot\n`/serverinfo` — Server info\n`/user @user` — User info\n`/remind-me` — Reminders\n`/quote` — Random quote\n`/status` — Bot status\n`/history` — Conversation history";
          break;
        case "help_mod":
          title = "Moderation & Advanced";
          desc = "`/auto-respond` — Toggle auto-responses\n`/guild-settings` — Server settings\n`/dashboard` — Bot dashboard\n`/brain-dump` — Memory dump\n`/clear-brain` — Clear memory";
          break;
        default:
          return i.editReply({ content: "Unknown section.", ephemeral: true });
      }

      return i.editReply({
        embeds: [new EmbedBuilder().setColor("#2f3136").setTitle(title).setDescription(desc)],
        ephemeral: true,
      });
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
  chrxmeeServer.stop();
  for (const [guildId, connection] of client.voiceConnections) {
    connection.destroy();
    client.voiceConnections.delete(guildId);
  }
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n👋 Shutting down gracefully...");
  chrxmeeServer.stop();
  for (const [guildId, connection] of client.voiceConnections) {
    connection.destroy();
    client.voiceConnections.delete(guildId);
  }
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