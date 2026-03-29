require("dotenv").config();
const { Client, GatewayIntentBits, Collection, EmbedBuilder } = require("discord.js");
const { LavalinkManager } = require("lavalink-client");
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { setupAntinukeEvents } = require("./antinukeEvents");

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

// ==================== LAVALINK ====================
client.lavalink = new LavalinkManager({
  nodes: [
    {
      host: process.env.LAVA_HOST || "localhost",
      port: parseInt(process.env.LAVA_PORT) || 2333,
      authorization: process.env.LAVA_PASS || "chrxmaticc2026",
      secure: false,
      id: "main",
    },
  ],
  sendToShard: (guildId, payload) => {
    const guild = client.guilds.cache.get(guildId);
    if (guild) guild.shard.send(payload);
  },
  client: {
    id: process.env.CLIENT_ID,
    username: "Chrxmaticc AI",
  },
  playerOptions: {
    defaultSearchPlatform: "ytsearch",
    onDisconnect: { destroyPlayer: true },
    onEmptyQueue: { destroyAfterMs: 30000 },
  },
});

client.lavalink.on("nodeConnect", (node) =>
  console.log(`Lavalink node "${node.id}" connected!`)
);
client.lavalink.on("nodeError", (node, err) =>
  console.error(`Lavalink node "${node.id}" error:`, err.message)
);
client.lavalink.on("trackStart", (player, track) => {
  const channel = client.channels.cache.get(player.textChannelId);
  if (!channel) return;
  channel.send({
    embeds: [
      new EmbedBuilder()
        .setColor("#5865F2")
        .setTitle("🎵 Now Playing")
        .setDescription(`**[${track.info.title}](${track.info.uri})**`)
        .addFields(
          { name: "Author", value: track.info.author, inline: true },
          { name: "Duration", value: msToTime(track.info.duration), inline: true },
          { name: "Requested by", value: `<@${track.info.requester?.id || "Unknown"}>`, inline: true }
        )
        .setThumbnail(track.info.artworkUrl)
        .setTimestamp(),
    ],
  }).catch(() => {});
});
client.lavalink.on("queueEnd", (player) => {
  const channel = client.channels.cache.get(player.textChannelId);
  if (channel) channel.send("✅ Queue finished! Add more songs with `/play`.").catch(() => {});
});

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

    await client.lavalink.init({ id: client.user.id, username: client.user.username });
    console.log("Lavalink manager initialized!");

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
          title = "Music";
          desc = "`/play` — Play a song\n`/join` — Join your VC\n`/leave` — Leave VC\n`/skip` — Skip current song\n`/stop` — Stop and clear queue\n`/pause` — Pause/resume\n`/nowplaying` — Now playing\n`/queue` — View queue\n`/volume` — Set volume\n`/loop` — Loop mode\n`/filter` — Audio filters\n`/shuffle` — Shuffle queue\n`/search` — Search and pick\n`/autoplay` — Toggle autoplay\n`/lyrics` — Get lyrics\n`/remove` — Remove a song\n`/move` — Move a song\n`/seek` — Seek to timestamp\n`/replay` — Restart song\n`/clearqueue` — Clear queue\n`/previous` — Previous song\n`/voteskip` — Vote to skip\n`/save` — DM yourself the song\n`/247` — 24/7 mode\n`/playlist` — Manage playlists";
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

// ==================== LAVALINK VOICE STATE UPDATE ====================
client.on("raw", (d) => {
  if (d.t === "VOICE_SERVER_UPDATE" || d.t === "VOICE_STATE_UPDATE") {
    client.lavalink.sendRawData(d);
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

// ==================== LOGIN ====================
console.log("BOT_TOKEN value:", process.env.BOT_TOKEN ? `exists, length: ${process.env.BOT_TOKEN.length}` : "MISSING OR EMPTY");

client.login(process.env.BOT_TOKEN).then(() => {
  console.log("Discord login successful!");
}).catch((err) => {
  console.error("Discord login FAILED:", err.message);
  console.error("Full error:", err);
});
