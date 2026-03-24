console.log('🚀 chrxmee-ai STARTING...');
console.log('TOKEN:', process.env.BOT_TOKEN ? '✅' : '❌');

process.on('uncaughtException', err => { console.error('💥 CRASH:', err); });
process.on('unhandledRejection', err => { console.error('💥 PROMISE:', err); });

require("dotenv").config();
const { Client, GatewayIntentBits, Collection, EmbedBuilder, Partials } = require("discord.js");
const fs = require("fs");
const path = require("path");
const { Pool } = require('pg');
const { setupAntinukeEvents } = require('./antinukeEvents');
const { DisTube } = require('distube');

// FIX: Switched to @distube/yt-dlp for better stability
const { YtDlpPlugin } = require('@distube/yt-dlp');
// FIX: Added ffmpeg-static requirement
const ffmpeg = require('ffmpeg-static');

// ==================== EXPRESS SERVER ====================
const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('Chrxmee AI is alive! 🚀'));
app.listen(process.env.PORT || 3000, '0.0.0.0', () => {
  console.log('🌐 Web server OK');
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
pool.on('error', (err) => { console.error('Postgres pool error:', err.message); });
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

// ==================== DISTUBE SETUP ====================
client.distube = new DisTube(client, {
  // FIX: Added explicit ffmpeg path to prevent "ffmpeg not found" errors
  ffmpeg: { path: ffmpeg }, 
  plugins: [new YtDlpPlugin({ updateOnStart: true })],
  emitNewSongOnly: true,
  nsfw: false,
  joinNewVoiceChannel: true,
});

function buildNowPlayingEmbed(song, queue) {
  const loopLabel = queue.repeatMode === 2 ? '🔁 Queue' : queue.repeatMode === 1 ? '🔂 Song' : '➡️ Off';
  return {
    title: '🎵 Now Playing',
    description: `**[${song.name}](${song.url})**`,
    thumbnail: { url: song.thumbnail },
    fields: [
      { name: '⏱️ Duration', value: song.formattedDuration, inline: true },
      { name: '👤 Requested by', value: song.user?.tag || 'Unknown', inline: true },
      { name: '🔁 Loop', value: loopLabel, inline: true },
      { name: '🔊 Volume', value: `${queue.volume}%`, inline: true },
      { name: '📋 Queue', value: `${queue.songs.length - 1} song(s) up next`, inline: true },
    ],
    color: 0x5865F2
  };
}

client.distube
  .on('playSong', (queue, song) => {
    if (!queue.textChannel) return;
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('music_prev').setEmoji('⏮️').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('music_pause').setEmoji('⏸️').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('music_skip').setEmoji('⏭️').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('music_loop').setEmoji('🔁').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('music_shuffle').setEmoji('🔀').setStyle(ButtonStyle.Secondary),
    );
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('music_voldown').setEmoji('🔉').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('music_volup').setEmoji('🔊').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('music_favorite').setEmoji('⭐').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('music_stop').setLabel('⏹️ Stop').setStyle(ButtonStyle.Danger),
    );
    queue.textChannel.send({ embeds: [buildNowPlayingEmbed(song, queue)], components: [row1, row2] }).then(msg => {
      client.memory.set(`np_msg_${queue.id}`, msg.id);
      const collector = msg.createMessageComponentCollector({ time: 3600000 });
      collector.on('collect', async btn => {
        try { await btn.deferUpdate(); } catch { return; }
        const q = client.distube.getQueue(btn.guild);
        const isMod = btn.member.permissions.has('ManageMessages') || btn.member.permissions.has('Administrator');
        if (!isMod && ['music_pause','music_skip','music_prev','music_loop','music_shuffle','music_stop'].includes(btn.customId)) {
          return btn.followUp({ content: '❌ Only mods/VC owner can do that!', ephemeral: true }).catch(() => {});
        }
        if (!q) return;
        if (btn.customId === 'music_pause') {
          if (q.paused) { q.resume(); await btn.followUp({ content: '▶️ Resumed!', ephemeral: true }).catch(() => {}); }
          else { q.pause(); await btn.followUp({ content: '⏸️ Paused!', ephemeral: true }).catch(() => {}); }
        } else if (btn.customId === 'music_skip') {
          await q.skip(); await btn.followUp({ content: '⏭️ Skipped!', ephemeral: true }).catch(() => {});
        } else if (btn.customId === 'music_prev') {
          await q.previous(); await btn.followUp({ content: '⏮️ Previous!', ephemeral: true }).catch(() => {});
        } else if (btn.customId === 'music_loop') {
          const next = (q.repeatMode + 1) % 3;
          q.setRepeatMode(next);
          const labels = ['➡️ Off', '🔂 Song', '🔁 Queue'];
          await btn.followUp({ content: `🔁 Loop: **${labels[next]}**`, ephemeral: true }).catch(() => {});
        } else if (btn.customId === 'music_shuffle') {
          q.shuffle(); await btn.followUp({ content: '🔀 Shuffled!', ephemeral: true }).catch(() => {});
        } else if (btn.customId === 'music_voldown') {
          const vol = Math.max(0, q.volume - 10); q.setVolume(vol);
          await btn.followUp({ content: `🔉 Volume: **${vol}%**`, ephemeral: true }).catch(() => {});
        } else if (btn.customId === 'music_volup') {
          const vol = Math.min(200, q.volume + 10); q.setVolume(vol);
          await btn.followUp({ content: `🔊 Volume: **${vol}%**`, ephemeral: true }).catch(() => {});
        } else if (btn.customId === 'music_stop') {
          q.stop(); await btn.followUp({ content: '⏹️ Stopped!', ephemeral: true }).catch(() => {});
          collector.stop();
        } else if (btn.customId === 'music_favorite') {
          const favs = client.memory.get(`music_favs_${btn.user.id}`) || [];
          const cur = q.songs[0];
          if (cur && !favs.find(f => f.url === cur.url)) {
            favs.push({ title: cur.name, url: cur.url, duration: cur.duration, thumbnail: cur.thumbnail });
            client.memory.set(`music_favs_${btn.user.id}`, favs);
            await btn.followUp({ content: `⭐ **${cur.name}** saved to favorites!`, ephemeral: true }).catch(() => {});
          } else {
            await btn.followUp({ content: '⭐ Already in favorites!', ephemeral: true }).catch(() => {});
          }
        }
      });
    }).catch(() => {});
  })
  .on('addSong', (queue, song) => {
    if (queue.textChannel) queue.textChannel.send(`✅ Added **${song.name}** to the queue — Position: ${queue.songs.length}`).catch(() => {});
  })
  .on('addList', (queue, playlist) => {
    if (queue.textChannel) queue.textChannel.send(`✅ Added playlist **${playlist.name}** (${playlist.songs.length} songs) to the queue!`).catch(() => {});
  })
  .on('finish', queue => {
    if (queue.textChannel) queue.textChannel.send('✅ Queue finished!').catch(() => {});
  })
  .on('disconnect', queue => {
    if (queue.textChannel) queue.textChannel.send('👋 Disconnected from VC!').catch(() => {});
  })
  .on('empty', queue => {
    if (queue.textChannel) queue.textChannel.send('👋 VC is empty — leaving in 5 minutes!').catch(() => {});
  })
  .on('error', (channel, error) => {
    console.error('DisTube Error:', error);
    if (channel) channel.send(`❌ Music error: ${error.message?.slice(0, 100) || 'Unknown error'}`).catch(() => {});
  });

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
if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".js"));
    for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ("data" in command && "execute" in command) {
        client.commands.set(command.data.name, command);
    }
    }
}

const eventsPath = path.join(__dirname, "events");
if (fs.existsSync(eventsPath)) {
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
    console.log(`✅ Logged in as ${client.user.tag}`);
    const pgClient = await pool.connect();
    console.log('Postgres connected on ready!');
    await pgClient.query(`CREATE TABLE IF NOT EXISTS guild_settings (
      guild_id BIGINT PRIMARY KEY, wake_up_mode TEXT DEFAULT 'default',
      auto_respond BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT NOW()
    )`);
    await pgClient.query(`CREATE TABLE IF NOT EXISTS user_birthdays (
      user_id BIGINT PRIMARY KEY, birthday_date DATE NOT NULL,
      timezone TEXT NOT NULL, birthday_role_id BIGINT,
      ping_role_id BIGINT, set_at TIMESTAMP DEFAULT NOW()
    )`);
    pgClient.release();
    console.log('Tables ready!');
    setupAntinukeEvents(client);
    client.user.setPresence({ status: 'online', activities: [{ name: "Discord World AI Competition", type: 0 }] });

    // Birthday check
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
              if (role) { await member.roles.add(role).catch(console.error); setTimeout(() => member.roles.remove(role).catch(console.error), 86400000); }
            }
            if (row.ping_role_id) {
              const channel = guild.systemChannel || guild.channels.cache.find(ch => ch.isTextBased());
              if (channel) await channel.send(`<@&${row.ping_role_id}> Happy birthday to ${member}! 🎂`).catch(console.error);
            }
          }
        }
      } catch (err) { console.error('Birthday check failed:', err); }
    }, 86400000);

  } catch (err) {
    console.error('READY EVENT CRASHED:', err);
  }
});

// Help select menu listener
client.on('interactionCreate', async i => {
    if (!i.isStringSelectMenu()) return;
    if (i.customId !== 'help_select') return;
    await i.deferReply({ ephemeral: true });
    let title = '', desc = '';
    switch (i.values[0]) {
      case 'help_ai':     title = 'AI-Powered Commands';   desc = '`/ask` `/chat` `/summarize` `/translate` `/debate` `/dream` `/model` `/news` `/oracle` `/code-generate`'; break;
      case 'help_visual': title = 'Visual Imagination';    desc = '`/image` `/imagine` `/generate-qr` `/avatar`'; break;
      case 'help_fun':    title = 'Fun & Games';           desc = '`/roast` `/roastme` `/burn` `/coinflip` `/dice` `/poll` `/trivia` `/ship` `/8ball`'; break;
      case 'help_utility': title = 'Utility';              desc = '`/snipe` `/ping` `/serverinfo` `/user` `/remind-me` `/quote` `/status` `/history`'; break;
      case 'help_mod':    title = 'Moderation & Advanced'; desc = '`/auto-respond` `/guild-settings` `/dashboard` `/brain-dump` `/clear-brain`'; break;
      default: return i.editReply({ content: 'Unknown section.', ephemeral: true });
    }
    return i.editReply({ embeds: [new EmbedBuilder().setColor('#2f3136').setTitle(title).setDescription(desc)], ephemeral: true });
});

// ==================== RECONNECTION ====================
client.on('disconnect', () => { console.log('Bot disconnected! Reconnecting...'); });
client.on('error', err => { console.error('Discord client error:', err.message); });
client.on('warn', info => { console.warn('Discord warning:', info); });

// ==================== LOGIN ====================
console.log('🔥 LOGGING IN...');
client.login(process.env.BOT_TOKEN)
  .then(() => console.log('✅ Discord login successful!'))
  .catch(err => console.error('❌ Discord login FAILED:', err));
