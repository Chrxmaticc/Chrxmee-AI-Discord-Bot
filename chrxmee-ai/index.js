console.log('🚀 STEP 1: Booting Full System...');
require("dotenv").config();
const { 
    Client, GatewayIntentBits, Collection, EmbedBuilder, 
    ActionRowBuilder, ButtonBuilder, ButtonStyle, Partials 
} = require("discord.js");
const { DisTube } = require('distube');
const { YtDlpPlugin } = require('@distube/yt-dlp');
const { Pool } = require('pg');
const fs = require("fs"), path = require("path"), express = require('express'), https = require('https');

// --- PRE-FLIGHT NETWORK TEST ---
https.get('https://discord.com/api/v10/gateway', (res) => {
    console.log(`🌐 NETWORK CHECK: Discord Status: ${res.statusCode}`);
    if (res.statusCode === 429) console.error('⚠️ CRITICAL: YOU ARE RATE LIMITED. WAIT 1 HOUR.');
}).on('error', (e) => console.error('❌ NETWORK ERROR:', e.message));

// --- CLIENT INIT (ALL INTENTS) ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildPresences
    ],
    partials: [Partials.Channel, Partials.Message, Partials.GuildMember, Partials.User]
});

// --- GLOBALS ---
client.commands = new Collection();
client.snipes = new Map();
client.memory = new Map();

// --- DATABASE (POSTGRES) ---
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});
client.pool = pool;

// --- DISTUBE (MUSIC SYSTEM) ---
client.distube = new DisTube(client, {
    plugins: [new YtDlpPlugin()],
    emitNewSongOnly: true,
    leaveOnEmpty: false
});

// --- KEEP-ALIVE SERVER ---
const app = express();
app.get('/', (req, res) => res.send('Chrxmee AI: Full System Online 🚀'));
app.listen(process.env.PORT || 10000, '0.0.0.0', () => console.log('🌐 STEP 3: Web Server Live'));

// --- SNIPE SYSTEM ---
client.on('messageDelete', m => {
    if (!m.content || m.author?.bot) return;
    client.snipes.set(m.channelId, {
        content: m.content,
        author: m.author,
        image: m.attachments.first()?.proxyURL || null,
        time: Date.now()
    });
});

// --- MUSIC BUTTON HANDLER ---
client.on('interactionCreate', async i => {
    if (!i.isButton()) return;
    const queue = client.distube.getQueue(i.guildId);
    if (!queue) return i.reply({ content: 'No music playing.', ephemeral: true });

    try {
        if (i.customId === 'm_pause') {
            queue.paused ? queue.resume() : queue.pause();
            await i.reply({ content: queue.paused ? '⏸️ Paused' : '▶️ Resumed', ephemeral: true });
        } else if (i.customId === 'm_skip') {
            await queue.skip();
            await i.reply({ content: '⏭️ Skipped', ephemeral: true });
        } else if (i.customId === 'm_stop') {
            queue.stop();
            await i.reply({ content: '⏹️ Stopped', ephemeral: true });
        }
    } catch (err) { console.error('Button Error:', err.message); }
});

// --- COMMAND LOADER ---
const foldersPath = path.join(__dirname, 'commands');
if (fs.existsSync(foldersPath)) {
    fs.readdirSync(foldersPath).filter(f => f.endsWith('.js')).forEach(file => {
        const cmd = require(path.join(foldersPath, file));
        if (cmd.data) client.commands.set(cmd.data.name, cmd);
    });
}
console.log(`📦 STEP 4: Loaded ${client.commands.size} commands.`);

// --- READY EVENT & DB SYNC ---
client.once('ready', async () => {
    console.log(`🤖 ONLINE: ${client.user.tag}`);
    try {
        await pool.query('CREATE TABLE IF NOT EXISTS guild_settings (guild_id TEXT PRIMARY KEY, prefix TEXT DEFAULT "!")');
        console.log('🐘 Postgres tables verified.');
    } catch (e) { console.error('⚠️ DB Error:', e.message); }
});

// --- THE LOGIN (THE FINAL BOSS) ---
console.log('🚀 STEP 5: Attempting Discord Login...');
client.login(process.env.BOT_TOKEN)
    .then(() => console.log('✅ STEP 6: DISCORD LOGIN SUCCESSFUL!'))
    .catch(e => {
        console.error('❌ STEP 6: LOGIN FAILED!');
        console.error(`ERROR: ${e.message}`);
    });

// --- ANTI-CRASH ---
process.on('unhandledRejection', e => console.error('💥 REJECTION:', e));
process.on('uncaughtException', e => console.error('💥 EXCEPTION:', e));
