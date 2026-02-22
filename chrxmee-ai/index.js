require("dotenv").config();
const { Client, GatewayIntentBits, Collection } = require("discord.js");
const fs = require("fs");
const path = require("path");
const { Pool } = require('pg'); // Using Pool for better serverless handling

// KEEP-ALIVE SERVER (your original, untouched)
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

// Robust presence rotation and heartbeat (your original, untouched)
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

// Self-healing: restart server if it dies (your original)
server.on('error', (err) => {
  console.error('Keep-alive server error:', err.message);
  setTimeout(() => server.listen(PORT, '0.0.0.0'), 5000);
});

// Postgres Pool (Render managed DB — no local port)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Needed for Render Postgres on starter/free tier
});

// Startup connection test + table check/create
(async () => {
  try {
    const client = await pool.connect();
    console.log('Render Postgres connected successfully on startup!');

    // Auto-create guild-settings table if missing
    await client.query(`
      CREATE TABLE IF NOT EXISTS guild_settings (
        guild_id BIGINT PRIMARY KEY,
        wake_up_mode TEXT DEFAULT 'default',
        auto_respond BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('guild_settings table created or already exists');

    // Quick existence check
    const res = await client.query(
      'SELECT table_name FROM information_schema.tables WHERE table_name = $1',
      ['guild_settings']
    );
    console.log('guild_settings exists:', res.rowCount > 0 ? 'YES' : 'NO');

    client.release();
  } catch (err) {
    console.error('Startup Postgres error:', err.message);
  }
})();

// Make pool globally available (your guild-settings / advanced commands use this)
client.pool = pool;

// Your original bot setup
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

client.once('clientReady', () => {
  console.log(`Logged in as ${client.user.tag}`);
  console.log(`Chrxmee AI ready as ${client.user.tag}`);
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
