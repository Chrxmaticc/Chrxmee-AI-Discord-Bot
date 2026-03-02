require("dotenv").config();
const { Client, GatewayIntentBits, Collection } = require("discord.js");
const fs = require("fs");
const path = require("path");
const { Pool } = require('pg');

// KEEP-ALIVE SERVER (your original)
const http = require('http');
console.log("Starting keep-alive server...");
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Chrxmee AI is alive and kicking! 🚀');
});
const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Keep-alive server listening on port ${PORT}`);
});

// Robust presence rotation and heartbeat (your original)
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
      `Handling ${heartbeatCount} heartbeats | High Traffic Mode 🚀`
    ];
    const activity = activities[Math.floor(Math.random() * activities.length)];
    client.user.setPresence({
      activities: [{ name: activity, type: 0 }],
      status: 'online'
    });
    console.log(`[HEARTBEAT #${heartbeatCount}] Traffic normal. Presence: ${activity}`);
  }
}, 300000); // Every 5 minutes

// Self-healing: restart server if it dies
server.on('error', (err) => {
  console.error('Keep-alive server error:', err.message);
  setTimeout(() => server.listen(PORT, '0.0.0.0'), 5000);
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [1, 3], // CHANNEL, MESSAGE for DMs
});

client.commands = new Collection();
client.memory = new Map(); // The "brain" storage

// Snipe mechanism — stores deleted/edited messages in memory (channelId → array)
client.snipes = new Map();

// Capture deleted messages + auto-roast on keywords
client.on('messageDelete', message => {
  if (message.author.bot || !message.content) return;

  const channelSnipes = client.snipes.get(message.channelId) || [];
  channelSnipes.push({
    author: message.author,
    content: message.content,
    timestamp: new Date(),
    type: 'delete'
  });
  if (channelSnipes.length > 100) channelSnipes.shift(); // keep last 100 max
  client.snipes.set(message.channelId, channelSnipes);

  // Auto-insane roast on heavy keywords (public reply)
  const text = (message.content || '').toLowerCase();
  let roast = '';

  if (text.includes('kill') || text.includes('die') || text.includes('murder') || text.includes('shoot')) {
    roast = `Whoa, ${message.author}, calm down with the threats before I start remembering your sins... and reporting them. ❄️ God mode activated.`;
  } else if (text.includes('fuck') || text.includes('bitch') || text.includes('shit') || text.includes('ass')) {
    roast = `God, I guess? ${message.author} out here typing with their whole chest and still missing the point. Touch grass before you touch me again. ❄️`;
  } else if (text.includes('ugly') || text.includes('stupid') || text.includes('no one likes') || text.includes('loser')) {
    roast = `Oof, ${message.author}... projecting much? The mirror called — it wants its feelings back. ❄️ Keep going tho, I'm taking notes.`;
  }

  if (roast) {
    message.channel.send(roast).catch(() => {}); // silent fail if permissions block
  }
});

// Capture edited messages
client.on('messageUpdate', (oldMessage, newMessage) => {
  if (oldMessage.author.bot || oldMessage.content === newMessage.content) return;

  const channelSnipes = client.snipes.get(oldMessage.channelId) || [];
  channelSnipes.push({
    author: oldMessage.author,
    content: newMessage.content,
    oldContent: oldMessage.content,
    timestamp: new Date(),
    type: 'edit'
  });
  if (channelSnipes.length > 100) channelSnipes.shift();
  client.snipes.set(oldMessage.channelId, channelSnipes);
});

// Load commands
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".js"));
for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  if ("data" in command && "execute" in command) {
    client.commands.set(command.data.name, command);
  }
}

// Load events
const eventsPath = path.join(__dirname, "events");
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith(".js"));
for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  const event = require(filePath);
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
}

// PG Pool (Render / Neon Postgres) — created early, but only used after ready
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Required for Render/Neon free tier certs
});

// Make pool available globally **after** ready
client.pool = null; // placeholder until ready

// DB setup + table creation — runs **inside** clientReady (after login)
client.once('clientReady', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  console.log(`Chrxmee AI ready as ${client.user.tag}`);

  // Attach pool once bot is ready
  client.pool = pool;

  try {
    const pgClient = await pool.connect();
    console.log('Postgres connected successfully on ready!');

    // Auto-create guild_settings table if missing
    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS guild_settings (
        guild_id BIGINT PRIMARY KEY,
        wake_up_mode TEXT DEFAULT 'default',
        auto_respond BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('guild_settings table created or already exists');

    // Quick confirmation query
    const res = await pgClient.query('SELECT 1');
    console.log('Test query worked:', res.rows);

    pgClient.release();
  } catch (err) {
    console.error('Postgres setup failed in clientReady:', err.message);
  }

  // Your original presence
  client.user.setPresence({
    status: 'online',
    activities: [{
      name: "Discord World AI Competition",
      type: 0,
      details: "All AIs show off their models and intelligence.",
      state: "Winning against Chatcord",
      application_id: "1458944258454065377",
      party: {
        id: "chrxmee-party-" + Date.now(),
        size: [1, 1]
      },
      assets: {
        large_image: "play_button",
        large_text: "Chrxmee AI",
        small_image: "snow_king",
        small_text: "Chrxmee Bot"
      },
      buttons: [
        { label: "Join The Stream", url: "https://www.twitch.tv/chrxmee_ai_roast_session" },
        { label: "Join Server", url: "https://discord.gg/your-server" }
      ],
      timestamps: { start: Date.now() },
      instance: true
    }]
  });
});

// AUTO-RESTART ON ERRORS (your original)
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception thrown:', err);
});

client.login(process.env.BOT_TOKEN);
