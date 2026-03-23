require("dotenv").config();
const { Client, GatewayIntentBits, Collection, EmbedBuilder } = require("discord.js");
const fs = require("fs");
const path = require("path");
const { Pool } = require('pg');
const { setupAntinukeEvents } = require('./antinukeEvents');

// ==================== MUSIC PLAYER CLASS====================
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, entersState } = require('@discordjs/voice');
const play = require('play-dl');
const Genius = require('genius-lyrics-api');

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
    // Prevent joining multiple VCs in same guild cuz why not. if fails deleting this
    if (this.connection && this.connection.joinConfig.channelId !== channel.id) {
      return { error: 'I’m already in another voice channel in this server. Use /stop first.' };
    }

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

    let song;
    try {
      song = await play.video_basic_info(url);
    } catch {
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
  }

  async startPlayback() {
    if (this.queue.length === 0) {
      if (this.is247) return;
      this.destroy();
      return;
    }

    this.currentSong = this.queue[0];

    try {
      const stream = await play.stream(this.currentSong.url);
      const resource = createAudioResource(stream.stream, { inputType: stream.type });
      resource.volume?.setVolume(this.volume / 100);

      this.player.play(resource);

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
    if (!this.currentSong) return 'No song playing, find a song to play for the vibe';
    try {
      const lyrics = await Genius.getLyrics({ title: this.currentSong.title });
      return lyrics || 'Lyrics not found.';
    } catch {
      return 'Lyrics not found.';
    }
  }
}

// ==================== KEEP-ALIVE SERVER ====================
const http = require('http');
console.log("Starting keep-alive server...");
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Chrxmee AI is alive! 🚀');
});
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Keep-alive server listening on port ${PORT}`);
});
server.on('error', (err) => {
  console.error('Keep-alive server error:', err.message);
  setTimeout(() => server.listen(PORT, '0.0.0.0'), 5000);
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
  partials: [1, 3],
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

// ==================== MUSIC PLAYER SETUP ====================
client.musicPlayers = new Map();

// ==================== SNIPE SYSTEM ====================
client.on('messageDelete', message => {
  if (message.author?.bot || !message.content) return;
  const snipes = client.snipes.get(message.channelId) || [];
  snipes.push({ author: message.author, content: message.content, timestamp: new Date(), type: 'delete' });
  if (snipes.length > 100) snipes.shift();
  client.snipes.set(message.channelId, snipes);
  const text = message.content.toLowerCase();
  let roast = '';
  if (text.includes('kill') || text.includes('die') || text.includes('murder')) {
    roast = `Whoa ${message.author}, threats already? Taking notes... God mode engaged.`;
  } else if (text.includes('fuck') || text.includes('bitch') || text.includes('shit')) {
    roast = `God, I guess? ${message.author} typed that with full chest and zero brain cells. Touch grass.`;
  } else if (text.includes('ugly') || text.includes('stupid') || text.includes('loser')) {
    roast = `Oof ${message.author}... projecting much? Mirror called, wants its feelings back.`;
  }
  if (roast) message.channel.send(roast).catch(() => {});
});
client.on('messageUpdate', (oldMsg, newMsg) => {
  if (oldMsg.author?.bot || oldMsg.content === newMsg.content) return;
  const snipes = client.snipes.get(oldMsg.channelId) || [];
  snipes.push({ author: oldMsg.author, content: newMsg.content, oldContent: oldMsg.content, timestamp: new Date(), type: 'edit' });
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
      `Handling ${heartbeatCount} heartbeats | High Traffic Mode 🚀`
    ];
    const activity = activities[Math.floor(Math.random() * activities.length)];
    client.user.setPresence({ activities: [{ name: activity, type: 0 }], status: 'online' });
    console.log(`[HEARTBEAT #${heartbeatCount}] Presence: ${activity}`);
  }
}, 300000);
// ==================== CLIENT READY ====================
client.once('ready', async () => {
  try {
    console.log(`Logged in as ${client.user.tag}`);
    console.log(`Chrxmee AI ready as ${client.user.tag}`);
    const pgClient = await pool.connect();
    console.log('Postgres connected successfully on ready!');
    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS guild_settings (
        guild_id BIGINT PRIMARY KEY,
        wake_up_mode TEXT DEFAULT 'default',
        auto_respond BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('guild_settings table ready');
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
    console.log('user_birthdays table ready');
    const res = await pgClient.query('SELECT 1');
    console.log('Test query worked:', res.rows);
    pgClient.release();
    console.log('Pool pre-warmed successfully');
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
              const channel = guild.systemChannel || guild.channels.cache.find(ch => ch.isTextBased());
              if (channel) await channel.send(`<@&${row.ping_role_id}> Happy birthday to ${member}! 🎂`).catch(console.error);
            }
          }
        }
      } catch (err) {
        console.error('Birthday check failed:', err);
      }
    }, 86400000);
    client.user.setPresence({
      status: 'online',
      activities: [{ name: "Discord World AI Competition", type: 0 }]
    });
    client.on('interactionCreate', async i => {
      if (!i.isStringSelectMenu()) return;
      if (i.customId !== 'help_select') return;
      await i.deferReply({ ephemeral: true });
      let title = '', desc = '';
      switch (i.values[0]) {
        case 'help_ai':
          title = 'AI-Powered Commands';
          desc = '`/ask` — Ask anything to the AI\n`/chat` — Chat with the bot\n`/summarize` — Summarize text\n`/translate` — Translate text\n`/debate` — Debate with the bot\n`/dream` — Generate dream/image\n`/model` — Switch AI model\n`/news` — Get news\n`/oracle` — Oracle prediction\n`/code-generate` — Generate code';
          break;
        case 'help_visual':
          title = 'Visual Imagination';
          desc = '`/image` — Search images\n`/imagine` — Imagine something\n`/generate-qr` — QR code\n`/avatar` — User avatar';
          break;
        case 'help_fun':
          title = 'Fun & Games';
          desc = '`/roast` — Roast someone\n`/roastme` — Get roasted\n`/burn @user` — Burn someone\n`/coinflip` — Coin flip\n`/dice` — Roll dice\n`/poll` — Create poll\n`/trivia` — Trivia game\n`/ship` — Ship two users\n`/8ball` — Magic 8-ball';
          break;
        case 'help_utility':
          title = 'Utility';
          desc = '`/snipe` — Snipe messages\n`/ping` — Ping bot\n`/serverinfo` — Server info\n`/user @user` — User info\n`/remind-me` — Reminders\n`/quote` — Random quote\n`/status` — Bot status\n`/history` — Conversation history';
          break;
        case 'help_mod':
          title = 'Moderation & Advanced';
          desc = '`/auto-respond` — Toggle auto-responses\n`/guild-settings` — Server settings\n`/dashboard` — Bot dashboard\n`/brain-dump` — Memory dump\n`/clear-brain` — Clear memory';
          break;
        default:
          return i.editReply({ content: 'Unknown section.', ephemeral: true });
      }
      return i.editReply({ embeds: [new EmbedBuilder().setColor('#2f3136').setTitle(title).setDescription(desc)], ephemeral: true });
    });
  } catch (err) {
    console.error('READY EVENT CRASHED:', err);
    console.error('Stack trace:', err.stack);
  }
});
// ==================== RECONNECTION LOGIC ====================
client.on('disconnect', () => {
  console.log('Bot disconnected! Attempting to reconnect...');
});
client.on('error', (err) => {
  console.error('Discord client error:', err.message);
});
client.on('warn', (info) => {
  console.warn('Discord client warning:', info);
});
// ==================== GLOBAL ERROR HANDLERS ====================
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception thrown:', err);
});
// ==================== LOGIN ====================
console.log('BOT_TOKEN value:', process.env.BOT_TOKEN ? `exists, length: ${process.env.BOT_TOKEN.length}` : 'MISSING OR EMPTY');
client.login(process.env.BOT_TOKEN).then(() => {
  console.log('Discord login successful!');
}).catch(err => {
  console.error('Discord login FAILED:', err.message);
  console.error('Full error:', err);
});
