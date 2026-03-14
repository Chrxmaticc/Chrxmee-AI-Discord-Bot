require("dotenv").config();
const { Client, GatewayIntentBits, Collection, EmbedBuilder } = require("discord.js");
const fs = require("fs");
const path = require("path");
const { Pool } = require('pg');

// ==================== SECURE STARTUP LOGGING ====================
console.log('=== SECURE STARTUP DEBUG ===');
console.log(`BOT_TOKEN exists? ${!!process.env.BOT_TOKEN}`);
console.log(`BOT_TOKEN length: ${process.env.BOT_TOKEN?.length || 'MISSING'}`);
console.log(`DATABASE_URL prefix: ${process.env.DATABASE_URL?.substring(0, 15) || 'MISSING'}...`);
console.log(`Node version: ${process.version}`);
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
console.log('=== DEBUG END ===');

// ==================== KEEP-ALIVE SERVER ====================
const http = require('http');
console.log("Starting keep-alive server...");
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Chrxmee AI is alive! 🚀');
});
const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Keep-alive server listening on port ${PORT}`);
});

server.on('error', (err) => {
  console.error('Keep-alive server error:', err.message);
  setTimeout(() => server.listen(PORT, '0.0.0.0'), 5000);
});

// ==================== HEARTBEAT & PRESENCE ====================
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
}, 300000);

// ==================== POSTGRES POOL – HARDENED + LOGGED ====================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000
});

// Secure error handler – prevent bot crash
pool.on('error', (err, client) => {
  console.error('Postgres pool error:', err.message);
  if (client) client.release();
});

// Keep-alive ping with secure stats logging
setInterval(async () => {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    console.log(`[${new Date().toISOString()}] Postgres keep-alive ping OK | Active: ${pool.totalCount}, Idle: ${pool.idleCount}, Queued: ${pool.waitingCount}`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Postgres keep-alive failed:`, err.message);
  }
}, 30000);

// ==================== CLIENT CREATION ====================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [1, 3],
});

// NOW assign pool to client (this is the fix – moved after client is defined)
client.pool = pool;

client.commands = new Collection();
client.memory = new Map();

// ==================== SNIPE SYSTEM ====================
client.snipes = new Map();

client.on('messageDelete', message => {
  if (message.author.bot || !message.content) return;

  const snipes = client.snipes.get(message.channelId) || [];
  snipes.push({
    author: message.author,
    content: message.content,
    timestamp: new Date(),
    type: 'delete'
  });
  if (snipes.length > 100) snipes.shift();
  client.snipes.set(message.channelId, snipes);

  // roast logic stays the same...
});

client.on('messageUpdate', (oldMsg, newMsg) => {
  if (oldMsg.author.bot || oldMsg.content === newMsg.content) return;

  const snipes = client.snipes.get(oldMsg.channelId) || [];
  snipes.push({
    author: oldMsg.author,
    content: newMsg.content,
    oldContent: oldMsg.content,
    timestamp: new Date(),
    type: 'edit'
  });
  if (snipes.length > 100) snipes.shift();
  client.snipes.set(oldMsg.channelId, snipes);
});

// ==================== COMMAND & EVENT LOADING ====================
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".js"));
for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  if ("data" in command && "execute" in command) {
    client.commands.set(command.data.name, command);
  }
}

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

// ==================== CLIENT READY ====================
client.once('clientReady', async () => {
  console.log(`[${new Date().toISOString()}] Logged in as ${client.user.tag}`);
  console.log(`[${new Date().toISOString()}] Chrxmee AI ready as ${client.user.tag}`);

  // Pre-warm & setup tables
  try {
    const pgClient = await pool.connect();
    console.log(`[${new Date().toISOString()}] Postgres connected successfully on ready!`);

    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS guild_settings (
        guild_id BIGINT PRIMARY KEY,
        wake_up_mode TEXT DEFAULT 'default',
        auto_respond BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log(`[${new Date().toISOString()}] guild_settings table ready`);

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
    console.log(`[${new Date().toISOString()}] user_birthdays table ready`);

    await pgClient.query('SELECT 1');
    console.log(`[${new Date().toISOString()}] Test query worked`);

    pgClient.release();
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Postgres setup failed in clientReady:`, err.message);
  }

  // Your presence code...
});

// ==================== LOGIN WITH DEBUG ====================
console.log(`[${new Date().toISOString()}] Attempting login...`);
client.login(process.env.BOT_TOKEN).catch(err => {
  console.error(`[${new Date().toISOString()}] LOGIN FAILED:`, err.message);
});

// ==================== GLOBAL ERROR HANDLERS ====================
process.on('unhandledRejection', (reason, promise) => {
  console.error(`[${new Date().toISOString()}] Unhandled Rejection at:`, promise, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
  console.error(`[${new Date().toISOString()}] Uncaught Exception thrown:`, err);
});
