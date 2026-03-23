// Skidded, YES I SKID NXY
console.log(‘🚀 chrxmee-ai STARTING…’);
console.log(‘TOKEN:’, process.env.BOT_TOKEN ? ‘✅’ : ‘❌’);
console.log(‘Music deps loading…’);

process.on(‘uncaughtException’, err => {
console.error(‘💥 CRASH:’, err);
});
process.on(‘unhandledRejection’, err => {
console.error(‘💥 PROMISE:’, err);
});

require(“dotenv”).config();
const { Client, GatewayIntentBits, Collection, EmbedBuilder, Partials } = require(“discord.js”);
const fs = require(“fs”);
const path = require(“path”);
const { Pool } = require(‘pg’);
const { setupAntinukeEvents } = require(’./antinukeEvents’);

// 🌐 EXPRESS SERVER (RENDER FIX - so tuff)
const express = require(‘express’);
const app = express();

app.get(’/’, (req, res) => res.send(‘alive’));

app.listen(process.env.PORT || 3000, ‘0.0.0.0’, () => {
console.log(‘🌐 Web OK’);
});

// ==================== MUSIC PLAYER CLASS ====================
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, entersState } = require(’@discordjs/voice’);
const play = require(‘play-dl’);
const Genius = require(‘genius-lyrics-api’);

class ChrxmaticcMusicPlayer {
constructor(guildId) {
this.guildId = guildId;
this.queue = [];
this.currentSong = null;
this.connection = null;
this.player = createAudioPlayer();
this.volume = 50;
this.is247 = false;
this.textChannel = null;
}

async join(channel) {
// FIX 1: curly quote replaced with straight quote
if (this.connection && this.connection.joinConfig.channelId !== channel.id) {
return { error: “I’m already in another voice channel in this server. Use /stop first.” };
}

```
if (this.connection) return this.connection;

this.connection = joinVoiceChannel({
  channelId: channel.id,
  guildId: channel.guild.id,
  adapterCreator: channel.guild.voiceAdapterCreator,
});

try {
  await entersState(this.connection, VoiceConnectionStatus.Ready, 15000);
} catch (err) {
  this.connection.destroy();
  return { error: 'Failed to join VC for some reason.. Try again maybe' };
}

this.connection.subscribe(this.player);

this.connection.on(VoiceConnectionStatus.Disconnected, () => {
  if (!this.is247) this.destroy();
});

return this.connection;
```

}

async search(query) {
try {
const results = await play.search(query, { limit: 5 });
return results;
} catch {
return [];
}
}

async play(url, requestedBy, textChannel) {
this.textChannel = textChannel;

```
let song;
try {
  // FIX 2: video_basic_info -> video_info (correct play-dl method)
  const info = await play.video_info(url);
  song = info.video_details;
} catch (err) {
  console.error('video_info error:', err);
  return { error: 'Invalid song URL, incorrect or something idk.' };
}

const track = {
  title: song.title,
  url: song.url,
  duration: song.durationRaw,
  thumbnail: song.thumbnails?.[0]?.url || null,
  requestedBy: requestedBy.tag,
};

this.queue.push(track);

if (this.queue.length === 1 && !this.currentSong) {
  await this.startPlayback();
}

return { added: track, position: this.queue.length };
```

}

async startPlayback() {
if (this.queue.length === 0) {
if (this.is247) return;
this.destroy();
return;
}

```
this.currentSong = this.queue[0];

try {
  const stream = await play.stream(this.currentSong.url);
  const resource = createAudioResource(stream.stream, { inputType: stream.type });
  resource.volume?.setVolume(this.volume / 100);

  this.player.play(resource);

  this.player.removeAllListeners(AudioPlayerStatus.Idle);
  this.player.on(AudioPlayerStatus.Idle, () => {
    this.queue.shift();
    this.currentSong = null;
    this.startPlayback();
  });

  if (this.textChannel) {
    this.textChannel.send({
      embeds: [{
        title: 'Now Playing',
        description: `[${this.currentSong.title}](${this.currentSong.url})`,
        thumbnail: { url: this.currentSong.thumbnail },
        fields: [
          { name: 'Requested by', value: this.currentSong.requestedBy, inline: true },
          { name: 'Duration', value: this.currentSong.duration, inline: true },
        ],
        color: 0x5865F2
      }]
    });
  }
} catch (err) {
  console.error('Playback error:', err);
  this.queue.shift();
  this.startPlayback();
}
```

}

skip() {
this.player.stop();
}

destroy() {
if (this.connection) this.connection.destroy();
this.connection = null;
this.currentSong = null;
this.queue = [];
}

setVolume(vol) {
this.volume = Math.max(0, Math.min(200, vol));
}

toggle247() {
this.is247 = !this.is247;
return this.is247;
}

async getLyrics() {
if (!this.currentSong) return ‘No song playing, find a song to play for the vibe’;
try {
// FIX 3: pass full required Genius options including apiKey and artist
const lyrics = await Genius.getLyrics({
apiKey: process.env.GENIUS_TOKEN,
title: this.currentSong.title,
artist: ‘’,
optimizeQuery: true
});
return lyrics || ‘Lyrics not found.’;
} catch {
return ‘Lyrics not found.’;
}
}
}

// ==================== CLIENT CREATION ====================
const client = new Client({
intents: [
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.MessageContent,
GatewayIntentBits.DirectMessages,
GatewayIntentBits.GuildMembers,
],
// FIX 4: use Partials constants instead of raw numbers
partials: [Partials.Channel, Partials.Message],
});
client.commands = new Collection();
client.memory = new Map();
client.snipes = new Map();

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
pool.on(‘error’, (err) => {
console.error(‘Postgres pool error:’, err.message);
});
setInterval(async () => {
try {
const pgClient = await pool.connect();
await pgClient.query(‘SELECT 1’);
pgClient.release();
console.log(‘Postgres keep-alive ping OK’);
} catch (err) {
console.error(‘Postgres keep-alive failed:’, err.message);
}
}, 30000);
client.pool = pool;

// ==================== MUSIC PLAYER SETUP ====================
client.musicPlayers = new Map();

// ==================== SNIPE SYSTEM ====================
client.on(‘messageDelete’, message => {
if (message.author?.bot || !message.content) return;
const snipes = client.snipes.get(message.channelId) || [];
snipes.push({ author: message.author, content: message.content, timestamp: new Date(), type: ‘delete’ });
if (snipes.length > 100) snipes.shift();
client.snipes.set(message.channelId, snipes);

const text = message.content.toLowerCase();
let roast = ‘’;
if (text.includes(‘kill’) || text.includes(‘die’) || text.includes(‘murder’)) {
roast = `Whoa ${message.author}, threats already? Taking notes... God mode engaged.`;
} else if (text.includes(‘fuck’) || text.includes(‘bitch’) || text.includes(‘shit’)) {
roast = `God, I guess? ${message.author} typed that with full chest and zero brain cells. Touch grass.`;
} else if (text.includes(‘ugly’) || text.includes(‘stupid’) || text.includes(‘loser’)) {
roast = `Oof ${message.author}... projecting much? Mirror called, wants its feelings back.`;
}
if (roast) message.channel.send(roast).catch(() => {});
});

client.on(‘messageUpdate’, (oldMsg, newMsg) => {
if (oldMsg.author?.bot || oldMsg.content === newMsg.content) return;
const snipes = client.snipes.get(oldMsg.channelId) || [];
snipes.push({ author: oldMsg.author, content: newMsg.content, oldContent: oldMsg.content, timestamp: new Date(), type: ‘edit’ });
if (snipes.length > 100) snipes.shift();
client.snipes.set(oldMsg.channelId, snipes);
});

// ==================== COMMAND & EVENT LOADING ====================
const commandsPath = path.join(__dirname, “commands”);
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(”.js”));
for (const file of commandFiles) {
const filePath = path.join(commandsPath, file);
const command = require(filePath);
if (“data” in command && “execute” in command) {
client.commands.set(command.data.name, command);
}
}

const eventsPath = path.join(__dirname, “events”);
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith(”.js”));
for (const file of eventFiles) {
const filePath = path.join(eventsPath, file);
const event = require(filePath);
if (event.once) {
client.once(event.name, (…args) => event.execute(…args));
} else {
client.on(event.name, (…args) => event.execute(…args));
}
}

// ==================== LOGIN ====================
console.log(‘BOT_TOKEN value:’, process.env.BOT_TOKEN ? `exists, length: ${process.env.BOT_TOKEN.length}` : ‘MISSING OR EMPTY’);

client.login(process.env.BOT_TOKEN)
.then(() => console.log(‘Discord login successful!’))
.catch(err => {
console.error(‘Discord login FAILED:’, err.message);
console.error(‘Full error:’, err);
});
