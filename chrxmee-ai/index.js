// 🔥 RENDER WEB SERVICE FIX - ADD THIS FIRST
console.log('🚀 chrxmee-ai STARTING...');
console.log('TOKEN:', process.env.BOT_TOKEN ? '✅' : '❌');
console.log('Music deps loading...');

process.on('uncaughtException', err => {
  console.error('💥 CRASH:', err);
});
process.on('unhandledRejection', err => {
  console.error('💥 PROMISE:', err);
});

require("dotenv").config();
const { Client, GatewayIntentBits, Collection, EmbedBuilder, Partials } = require("discord.js");
const fs = require("fs");
const path = require("path");
const { Pool } = require('pg');
const { setupAntinukeEvents } = require('./antinukeEvents');

// 🌐 EXPRESS SERVER
const express = require('express');
const app = express();

app.get('/', (req, res) => res.send('alive'));

app.listen(process.env.PORT || 3000, '0.0.0.0', () => {
  console.log('🌐 Web OK');
});

// ==================== CLIENT CREATION ====================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel, Partials.Message],
});

client.commands = new Collection();
client.memory = new Map();
client.snipes = new Map();

// ==================== DISTUBE MUSIC ====================
const { DisTube } = require('distube');
const { YtDlpPlugin } = require('@distube/ytdl-core');

client.distube = new DisTube(client, {
  plugins: [new YtDlpPlugin()],
  emitNewSongOnly: true,
});

client.distube
  .on('playSong', (queue, song) => {
    queue.textChannel.send({
      embeds: [{
        title: 'Now Playing',
        description: `[${song.name}](${song.url})`,
        thumbnail: { url: song.thumbnail },
        fields: [
          { name: 'Duration', value: song.formattedDuration, inline: true },
          { name: 'Requested by', value: song.user.tag, inline: true }
        ],
        color: 0x5865F2
      }]
    });
  })
  .on('addSong', (queue, song) => {
    queue.textChannel.send(`🎶 Added **${song.name}** to the queue.`);
  })
  .on('error', (channel, error) => {
    console.error('DisTube Error:', error);
    if (channel) channel.send('❌ Music error occurred.');
  });

// ==================== POSTGRES POOL ====================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000
});

pool.on('error', (err) => {
  console.error('Postgres pool error:', err.message);
});

setInterval(async () => {
  try {
    const pgClient = await pool.connect();
    await pgClient.query('SELECT 1');
    pgClient.release();
    console.log('Postgres keep-alive ping OK');
  } catch (err) {
    console.error('Postgres keep-alive failed:', err.message);
  }
}, 30000);

client.pool = pool;

// ==================== SNIPE SYSTEM ====================
client.on('messageDelete', message => {
  if (message.author?.bot || !message.content) return;

  const snipes = client.snipes.get(message.channelId) || [];
  snipes.push({
    author: message.author,
    content: message.content,
    timestamp: new Date(),
    type: 'delete'
  });

  if (snipes.length > 100) snipes.shift();
  client.snipes.set(message.channelId, snipes);
});

client.on('messageUpdate', (oldMsg, newMsg) => {
  if (oldMsg.author?.bot || oldMsg.content === newMsg.content) return;

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

// ==================== READY ====================
client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  setupAntinukeEvents(client);
});

// ==================== LOGIN ====================
console.log('🔥 ABOUT TO LOGIN...');

client.login(process.env.BOT_TOKEN)
  .then(() => console.log('✅ Discord login successful!'))
  .catch(err => {
    console.error('❌ Discord login FAILED:', err);
  });

console.log('🔥 LOGIN CALLED');
