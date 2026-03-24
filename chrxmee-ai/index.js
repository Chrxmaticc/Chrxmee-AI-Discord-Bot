console.log('🚀 STEP 1: Booting system...');
require("dotenv").config();
const { Client, GatewayIntentBits, Collection, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { DisTube } = require('distube');
const { YtDlpPlugin } = require('@distube/yt-dlp');
const { Pool } = require('pg');
const fs = require("fs"), path = require("path"), express = require('express');

console.log('🚀 STEP 2: Dependencies loaded.');

// --- 6-STEP LOGIN SEQUENCE ---
const client = new Client({ intents: [1, 2, 128, 512, 4096, 32768] }); // Compact Intents
console.log('🚀 STEP 3: Client initialized.');

const token = process.env.BOT_TOKEN;
if (!token) { console.error('❌ STEP 4: BOT_TOKEN missing!'); process.exit(1); }
console.log('🚀 STEP 4: Token found. Connecting...');

console.log('🚀 STEP 5: Logging in...');
client.login(token)
  .then(() => console.log('✅ STEP 6: LOGIN SUCCESSFUL!'))
  .catch(e => { console.error('❌ STEP 6: LOGIN FAILED!', e.message); process.exit(1); });

// --- GLOBALS & KEEP-ALIVE ---
client.commands = new Collection();
client.snipes = new Map();
client.memory = new Map();

express().get('/', (req, res) => res.send('Live🚀')).listen(process.env.PORT || 10000, '0.0.0.0', () => console.log('🌐 Web OK'));

// --- DISTUBE & DB ---
client.distube = new DisTube(client, { plugins: [new YtDlpPlugin()], emitNewSongOnly: true });
client.pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

// --- EVENT HANDLERS ---
client.once('ready', async () => {
  console.log(`🤖 ONLINE: ${client.user.tag}`);
  client.pool.query('CREATE TABLE IF NOT EXISTS stats (id TEXT PRIMARY KEY)').catch(e => console.error('⚠️ DB Error:', e.message));
});

client.on('messageDelete', m => {
  if (m.content && !m.author?.bot) client.snipes.set(m.channelId, { content: m.content, author: m.author, time: Date.now() });
});

// --- COMMAND LOADER ---
try {
  const dir = path.join(__dirname, 'commands');
  fs.readdirSync(dir).filter(f => f.endsWith('.js')).forEach(file => {
    const cmd = require(path.join(dir, file));
    if (cmd.data) client.commands.set(cmd.data.name, cmd);
  });
  console.log(`📦 Commands loaded: ${client.commands.size}`);
} catch (e) { console.error('⚠️ Command load error:', e.message); }

// --- INTERACTION CONTROLLER ---
client.on('interactionCreate', async i => {
  if (i.isChatInputCommand()) {
    const cmd = client.commands.get(i.commandName);
    if (cmd) cmd.execute(i, client).catch(e => { console.error(e); i.reply({ content: 'Error!', ephemeral: true }).catch(()=>{}); });
  } else if (i.isButton()) {
    const q = client.distube.getQueue(i.guildId);
    if (!q) return i.reply({ content: 'No music playing.', ephemeral: true });
    
    if (i.customId === 'm_pause') { q.paused ? q.resume() : q.pause(); i.reply({ content: q.paused ? '⏸️' : '▶️', ephemeral: true }); }
    else if (i.customId === 'm_skip') { q.skip().catch(()=>{}); i.reply({ content: '⏭️', ephemeral: true }); }
    else if (i.customId === 'm_stop') { q.stop(); i.reply({ content: '⏹️', ephemeral: true }); }
  }
});

// --- MUSIC EMBEDS ---
client.distube.on('playSong', (q, song) => {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('m_pause').setEmoji('⏸️').setStyle(2),
    new ButtonBuilder().setCustomId('m_skip').setEmoji('⏭️').setStyle(2),
    new ButtonBuilder().setCustomId('m_stop').setEmoji('⏹️').setStyle(4)
  );
  q.textChannel?.send({ 
    embeds: [new EmbedBuilder().setColor('#5865F2').setDescription(`🎵 **[${song.name}](${song.url})**`).setThumbnail(song.thumbnail)], 
    components: [row] 
  });
});

process.on('unhandledRejection', e => console.error('💥', e));
process.on('uncaughtException', e => console.error('💥', e));
