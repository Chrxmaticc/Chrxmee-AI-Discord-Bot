const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} = require('discord.js');
const {
  joinVoiceChannel, createAudioPlayer, createAudioResource,
  AudioPlayerStatus, VoiceConnectionStatus, entersState
} = require('@discordjs/voice');
const play = require('play-dl');

// ── HELPERS ────────────────────────────────────────────────────────────────

function generatePlaylistId() {
  return 'PL-' + Math.random().toString(36).substring(2, 6).toUpperCase();
}

function formatDuration(seconds) {
  if (!seconds) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function progressBar(current, total, length = 15) {
  if (!total) return '▬'.repeat(length);
  const filled = Math.round((current / total) * length);
  return '▰'.repeat(filled) + '▱'.repeat(length - filled);
}

function getPlayer(client, guildId) {
  if (!client.musicPlayers) client.musicPlayers = new Map();
  if (!client.musicPlayers.has(guildId)) {
    client.musicPlayers.set(guildId, {
      queue: [],
      current: null,
      connection: null,
      player: createAudioPlayer(),
      volume: 50,
      loop: 'none', // none, song, queue
      is247: false,
      textChannel: null,
      paused: false,
      startTime: null,
      inactivityTimer: null,
      nowPlayingMsg: null,
      history: [],
    });
  }
  return client.musicPlayers.get(guildId);
}

function isMod(member) {
  return member.permissions.has('ManageMessages') || member.permissions.has('Administrator');
}

function isVcOwner(member, state) {
  // VC owner = person who has been in VC longest or is mod
  return isMod(member);
}

function resetInactivity(client, guildId, state) {
  if (state.inactivityTimer) clearTimeout(state.inactivityTimer);
  if (state.is247) return;
  state.inactivityTimer = setTimeout(() => {
    const s = getPlayer(client, guildId);
    if (!s.current && s.queue.length === 0) {
      if (s.connection) s.connection.destroy();
      if (s.textChannel) s.textChannel.send('👋 Left the VC due to 5 minutes of inactivity!').catch(() => {});
      client.musicPlayers.delete(guildId);
    }
  }, 5 * 60 * 1000);
}

// ── PLAYLISTS ──────────────────────────────────────────────────────────────

function getUserPlaylists(client, userId) {
  return client.memory.get(`playlists_${userId}`) || {};
}

function saveUserPlaylists(client, userId, playlists) {
  client.memory.set(`playlists_${userId}`, playlists);
}

function cleanupPlaylists(client, userId) {
  const playlists = getUserPlaylists(client, userId);
  const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
  let changed = false;
  for (const [id, pl] of Object.entries(playlists)) {
    if (pl.songs.length < 10 && pl.lastPlayed && pl.lastPlayed < twoWeeksAgo) {
      delete playlists[id];
      changed = true;
    }
  }
  if (changed) saveUserPlaylists(client, userId, playlists);
}

// ── NOW PLAYING EMBED ──────────────────────────────────────────────────────

function buildNowPlayingEmbed(state) {
  const song = state.current;
  if (!song) return new EmbedBuilder().setColor('#5865F2').setTitle('Nothing playing');
  const elapsed = state.startTime ? Math.floor((Date.now() - state.startTime) / 1000) : 0;
  const total = song.duration || 0;
  const bar = progressBar(elapsed, total);
  const loopLabel = state.loop === 'song' ? '🔂 Song' : state.loop === 'queue' ? '🔁 Queue' : '➡️ Off';

  return new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle('🎵 Now Playing')
    .setDescription(`**[${song.title}](${song.url})**`)
    .setThumbnail(song.thumbnail || null)
    .addFields(
      { name: '⏱️ Progress', value: `${formatDuration(elapsed)} ${bar} ${formatDuration(total)}`, inline: false },
      { name: '👤 Requested by', value: song.requestedBy || 'Unknown', inline: true },
      { name: '🔁 Loop', value: loopLabel, inline: true },
      { name: '🔊 Volume', value: `${state.volume}%`, inline: true },
      { name: '📋 Queue', value: `${state.queue.length} song(s) up next`, inline: true },
    )
    .setFooter({ text: state.paused ? '⏸️ Paused' : '▶️ Playing' });
}

function buildNowPlayingRow(state) {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('music_prev').setEmoji('⏮️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_pause').setEmoji(state.paused ? '▶️' : '⏸️').setStyle(state.paused ? ButtonStyle.Success : ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('music_skip').setEmoji('⏭️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_loop').setEmoji('🔁').setStyle(state.loop !== 'none' ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_shuffle').setEmoji('🔀').setStyle(ButtonStyle.Secondary),
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('music_voldown').setEmoji('🔉').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_volup').setEmoji('🔊').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_favorite').setEmoji('⭐').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_stop').setLabel('⏹️ Stop').setStyle(ButtonStyle.Danger),
  );
  return [row1, row2];
}

// ── PLAYBACK ───────────────────────────────────────────────────────────────

async function startPlayback(client, guildId) {
  const state = getPlayer(client, guildId);
  if (state.queue.length === 0) {
    state.current = null;
    resetInactivity(client, guildId, state);
    if (state.nowPlayingMsg) {
      state.nowPlayingMsg.edit({ embeds: [new EmbedBuilder().setColor('#5865F2').setTitle('Queue ended!')], components: [] }).catch(() => {});
      state.nowPlayingMsg = null;
    }
    return;
  }

  state.current = state.queue[0];
  state.startTime = Date.now();
  state.paused = false;

  try {
    const stream = await play.stream(state.current.url);
    const resource = createAudioResource(stream.stream, { inputType: stream.type });
    state.player.play(resource);
  } catch (err) {
    console.error('Playback error:', err);
    state.queue.shift();
    state.current = null;
    return startPlayback(client, guildId);
  }

  // Update now playing embed
  if (state.textChannel) {
    const embed = buildNowPlayingEmbed(state);
    const rows = buildNowPlayingRow(state);
    try {
      if (state.nowPlayingMsg) {
        await state.nowPlayingMsg.edit({ embeds: [embed], components: rows }).catch(() => {});
      } else {
        state.nowPlayingMsg = await state.textChannel.send({ embeds: [embed], components: rows });
        setupNowPlayingCollector(client, guildId, state.nowPlayingMsg);
      }
    } catch (err) { console.error('NP embed error:', err); }
  }

  state.player.removeAllListeners(AudioPlayerStatus.Idle);
  state.player.once(AudioPlayerStatus.Idle, () => {
    if (state.loop === 'song') {
      // replay same song
      return startPlayback(client, guildId);
    }
    if (state.loop === 'queue') {
      state.history.push(state.queue.shift());
      state.queue.push(state.history[state.history.length - 1]);
    } else {
      state.history.push(state.queue.shift());
    }
    state.current = null;
    startPlayback(client, guildId);
  });
}

function setupNowPlayingCollector(client, guildId, msg) {
  const collector = msg.createMessageComponentCollector({ time: 3600000 });
  collector.on('collect', async btn => {
    try { await btn.deferUpdate(); } catch (e) { return; }
    const state = getPlayer(client, guildId);
    const member = btn.member;

    const canControl = isVcOwner(member, state) || isMod(member);

    if (btn.customId === 'music_pause') {
      if (!canControl) return btn.followUp({ content: '❌ Only the VC owner or mods can do that!', ephemeral: true }).catch(() => {});
      if (state.paused) { state.player.unpause(); state.paused = false; }
      else { state.player.pause(); state.paused = true; }
    } else if (btn.customId === 'music_skip') {
      if (!canControl) return btn.followUp({ content: '❌ Only the VC owner or mods can skip!', ephemeral: true }).catch(() => {});
      state.player.stop();
    } else if (btn.customId === 'music_prev') {
      if (!canControl) return btn.followUp({ content: '❌ Only the VC owner or mods can do that!', ephemeral: true }).catch(() => {});
      if (state.history.length > 0) {
        const prev = state.history.pop();
        state.queue.unshift(prev);
        if (state.current) state.queue.unshift(state.current);
        state.player.stop();
      }
    } else if (btn.customId === 'music_loop') {
      if (!canControl) return btn.followUp({ content: '❌ Only the VC owner or mods can do that!', ephemeral: true }).catch(() => {});
      if (state.loop === 'none') state.loop = 'song';
      else if (state.loop === 'song') state.loop = 'queue';
      else state.loop = 'none';
      await btn.followUp({ content: `🔁 Loop set to **${state.loop}**`, ephemeral: true }).catch(() => {});
    } else if (btn.customId === 'music_shuffle') {
      if (!canControl) return btn.followUp({ content: '❌ Only the VC owner or mods can do that!', ephemeral: true }).catch(() => {});
      for (let i = state.queue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [state.queue[i], state.queue[j]] = [state.queue[j], state.queue[i]];
      }
      await btn.followUp({ content: '🔀 Queue shuffled!', ephemeral: true }).catch(() => {});
    } else if (btn.customId === 'music_voldown') {
      state.volume = Math.max(0, state.volume - 10);
      await btn.followUp({ content: `🔉 Volume: **${state.volume}%**`, ephemeral: true }).catch(() => {});
    } else if (btn.customId === 'music_volup') {
      state.volume = Math.min(200, state.volume + 10);
      await btn.followUp({ content: `🔊 Volume: **${state.volume}%**`, ephemeral: true }).catch(() => {});
    } else if (btn.customId === 'music_stop') {
      if (!canControl) return btn.followUp({ content: '❌ Only the VC owner or mods can stop!', ephemeral: true }).catch(() => {});
      state.queue = []; state.current = null;
      state.player.stop();
      if (state.connection) state.connection.destroy();
      client.musicPlayers.delete(guildId);
      await msg.edit({ embeds: [new EmbedBuilder().setColor('#ff0000').setTitle('⏹️ Music stopped.')], components: [] }).catch(() => {});
      collector.stop();
      return;
    } else if (btn.customId === 'music_favorite') {
      const userId = btn.user.id;
      const favs = client.memory.get(`music_favs_${userId}`) || [];
      if (state.current) {
        if (!favs.find(f => f.url === state.current.url)) {
          favs.push(state.current);
          client.memory.set(`music_favs_${userId}`, favs);
          await btn.followUp({ content: `⭐ **${state.current.title}** saved to favorites!`, ephemeral: true }).catch(() => {});
        } else {
          await btn.followUp({ content: '⭐ Already in favorites!', ephemeral: true }).catch(() => {});
        }
      }
    }

    // Update embed
    const updatedState = getPlayer(client, guildId);
    if (updatedState.current) {
      await msg.edit({ embeds: [buildNowPlayingEmbed(updatedState)], components: buildNowPlayingRow(updatedState) }).catch(() => {});
    }
  });
}

// ── SEARCH ─────────────────────────────────────────────────────────────────

async function searchSong(query, source) {
  try {
    if (source === 'youtube' || source === 'auto') {
      const results = await play.search(query, { limit: 5, source: { youtube: 'video' } });
      return results.map(r => ({ title: r.title, url: r.url, duration: r.durationInSec, thumbnail: r.thumbnails?.[0]?.url, source: 'youtube' }));
    }
    if (source === 'soundcloud') {
      const results = await play.search(query, { limit: 5, source: { soundcloud: 'tracks' } });
      return results.map(r => ({ title: r.name, url: r.url, duration: r.durationInSec, thumbnail: r.thumbnail, source: 'soundcloud' }));
    }
    if (source === 'spotify') {
      // Search YouTube with spotify query since we can't stream spotify directly
      const results = await play.search(`${query} official audio`, { limit: 5, source: { youtube: 'video' } });
      return results.map(r => ({ title: r.title, url: r.url, duration: r.durationInSec, thumbnail: r.thumbnails?.[0]?.url, source: 'spotify' }));
    }
  } catch (err) {
    console.error('Search error:', err);
    return [];
  }
  return [];
}

// ── MODULE EXPORTS ─────────────────────────────────────────────────────────

module.exports = {
  data: new SlashCommandBuilder()
    .setName('music')
    .setDescription('Music player for your server')
    .addSubcommand(sub =>
      sub.setName('play')
        .setDescription('Play a song or playlist')
        .addStringOption(opt => opt.setName('query').setDescription('Song name, URL, or playlist ID').setRequired(true))
        .addStringOption(opt => opt.setName('source').setDescription('Where to search').setRequired(false)
          .addChoices(
            { name: '▶️ YouTube', value: 'youtube' },
            { name: '🟢 Spotify', value: 'spotify' },
            { name: '🔶 SoundCloud', value: 'soundcloud' },
            { name: '🔗 Direct URL', value: 'url' },
          ))
    )
    .addSubcommand(sub => sub.setName('skip').setDescription('Skip the current song'))
    .addSubcommand(sub => sub.setName('stop').setDescription('Stop music and leave VC'))
    .addSubcommand(sub => sub.setName('pause').setDescription('Pause the music'))
    .addSubcommand(sub => sub.setName('resume').setDescription('Resume the music'))
    .addSubcommand(sub => sub.setName('previous').setDescription('Play the previous song'))
    .addSubcommand(sub =>
      sub.setName('volume')
        .setDescription('Set volume')
        .addIntegerOption(opt => opt.setName('level').setDescription('Volume 0-200').setRequired(true).setMinValue(0).setMaxValue(200))
    )
    .addSubcommand(sub =>
      sub.setName('loop')
        .setDescription('Set loop mode')
        .addStringOption(opt => opt.setName('mode').setDescription('Loop mode').setRequired(true)
          .addChoices(
            { name: '➡️ Off', value: 'none' },
            { name: '🔂 Song', value: 'song' },
            { name: '🔁 Queue', value: 'queue' },
          ))
    )
    .addSubcommand(sub => sub.setName('shuffle').setDescription('Shuffle the queue'))
    .addSubcommand(sub => sub.setName('lyrics').setDescription('Get lyrics for the current song'))
    .addSubcommand(sub => sub.setName('nowplaying').setDescription('Show now playing embed'))
    .addSubcommand(sub => sub.setName('queue').setDescription('View the queue'))
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove a song from the queue')
        .addIntegerOption(opt => opt.setName('position').setDescription('Position in queue').setRequired(true).setMinValue(1))
    )
    .addSubcommand(sub => sub.setName('clear').setDescription('Clear the queue'))
    .addSubcommand(sub => sub.setName('247').setDescription('Toggle 247 mode'))
    .addSubcommand(sub => sub.setName('favorites').setDescription('View your favorite songs')),

  async execute(interaction, client) {
    try { await interaction.deferReply({ ephemeral: false }); } catch { return; }

    const guildId = interaction.guild.id;
    const userId = interaction.user.id;
    const username = interaction.user.username;
    const sub = interaction.options.getSubcommand();
    const state = getPlayer(client, guildId);

    // ── PLAY ──────────────────────────────────────────────
    if (sub === 'play') {
      const voiceChannel = interaction.member.voice.channel;
      if (!voiceChannel) return interaction.editReply('❌ You need to be in a voice channel!');

      const query = interaction.options.getString('query');
      const source = interaction.options.getString('source') || 'youtube';

      // Check if it's a playlist ID
      const playlists = getUserPlaylists(client, userId);
      const playlistById = Object.values(playlists).find(pl => pl.id === query.toUpperCase());
      const playlistByName = Object.values(playlists).find(pl => pl.name.toLowerCase() === query.toLowerCase());
      const playlist = playlistById || playlistByName;

      if (playlist) {
        // Join VC
        if (!state.connection) {
          state.connection = joinVoiceChannel({ channelId: voiceChannel.id, guildId, adapterCreator: interaction.guild.voiceAdapterCreator });
          try { await entersState(state.connection, VoiceConnectionStatus.Ready, 15000); }
          catch { return interaction.editReply('❌ Failed to join VC!'); }
          state.connection.subscribe(state.player);
          state.textChannel = interaction.channel;
        }
        // Queue all songs
        for (const song of playlist.songs) state.queue.push({ ...song, requestedBy: username });
        playlist.lastPlayed = Date.now();
        saveUserPlaylists(client, userId, playlists);
        if (!state.current) await startPlayback(client, guildId);
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#5865F2').setTitle(`📋 Playlist Queued!`).setDescription(`**${playlist.name}** (${playlist.id}) — ${playlist.songs.length} songs added to queue!`)] });
      }

      // Check if direct URL
      if (query.startsWith('http')) {
        if (!state.connection) {
          state.connection = joinVoiceChannel({ channelId: voiceChannel.id, guildId, adapterCreator: interaction.guild.voiceAdapterCreator });
          try { await entersState(state.connection, VoiceConnectionStatus.Ready, 15000); }
          catch { return interaction.editReply('❌ Failed to join VC!'); }
          state.connection.subscribe(state.player);
          state.textChannel = interaction.channel;
        }
        try {
          const info = await play.video_basic_info(query);
          const song = { title: info.video_details.title, url: info.video_details.url, duration: info.video_details.durationInSec, thumbnail: info.video_details.thumbnails?.[0]?.url, requestedBy: username };
          state.queue.push(song);
          if (!state.current) await startPlayback(client, guildId);
          return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#5865F2').setTitle('✅ Added to Queue').setDescription(`**${song.title}**`).setThumbnail(song.thumbnail)] });
        } catch { return interaction.editReply('❌ Invalid URL!'); }
      }

      // Search
      await interaction.editReply({ embeds: [new EmbedBuilder().setColor('#5865F2').setTitle(`🔍 Searching ${source}...`).setDescription(`Query: **${query}**`)] });
      const results = await searchSong(query, source);
      if (results.length === 0) return interaction.editReply('❌ No results found!');

      // Show dropdown of results + user playlists
      const songOptions = results.map((r, i) => new StringSelectMenuOptionBuilder().setLabel(r.title.slice(0, 100)).setValue(`song_${i}`).setDescription(`${formatDuration(r.duration)} • ${r.source}`));
      const playlistOptions = Object.values(playlists).slice(0, 5).map(pl => new StringSelectMenuOptionBuilder().setLabel(`📋 ${pl.name}`).setValue(`pl_${pl.id}`).setDescription(`${pl.songs.length} songs • ${pl.id}`));
      const allOptions = [...songOptions, ...playlistOptions];

      const menu = new StringSelectMenuBuilder().setCustomId('music_search_select').setPlaceholder('Choose a song or playlist...').addOptions(allOptions);
      const row = new ActionRowBuilder().addComponents(menu);

      await interaction.editReply({ embeds: [new EmbedBuilder().setColor('#5865F2').setTitle('🎵 Search Results').setDescription(results.map((r, i) => `**${i+1}.** ${r.title} — ${formatDuration(r.duration)}`).join('\n'))], components: [row] });

      const msg = await interaction.fetchReply();
      const collector = msg.createMessageComponentCollector({ time: 30000, max: 1 });

      collector.on('collect', async sel => {
        try { await sel.deferUpdate(); } catch { return; }
        if (sel.user.id !== userId) return sel.followUp({ content: '❌ Not your search!', ephemeral: true }).catch(() => {});

        const value = sel.values[0];

        // Join VC
        if (!state.connection) {
          state.connection = joinVoiceChannel({ channelId: voiceChannel.id, guildId, adapterCreator: interaction.guild.voiceAdapterCreator });
          try { await entersState(state.connection, VoiceConnectionStatus.Ready, 15000); }
          catch { return interaction.editReply('❌ Failed to join VC!'); }
          state.connection.subscribe(state.player);
          state.textChannel = interaction.channel;
        }

        if (value.startsWith('pl_')) {
          const plId = value.replace('pl_', '');
          const pl = Object.values(playlists).find(p => p.id === plId);
          if (!pl) return;
          for (const song of pl.songs) state.queue.push({ ...song, requestedBy: username });
          pl.lastPlayed = Date.now();
          saveUserPlaylists(client, userId, playlists);
          if (!state.current) await startPlayback(client, guildId);
          await msg.edit({ embeds: [new EmbedBuilder().setColor('#5865F2').setTitle('📋 Playlist Queued!').setDescription(`**${pl.name}** — ${pl.songs.length} songs added!`)], components: [] }).catch(() => {});
        } else {
          const idx = parseInt(value.replace('song_', ''));
          const song = { ...results[idx], requestedBy: username };
          state.queue.push(song);
          if (!state.current) await startPlayback(client, guildId);
          await msg.edit({ embeds: [new EmbedBuilder().setColor('#5865F2').setTitle('✅ Added to Queue').setDescription(`**${song.title}** — Position: ${state.queue.length}`)], components: [] }).catch(() => {});
        }
      });

      collector.on('end', collected => { if (collected.size === 0) msg.edit({ components: [] }).catch(() => {}); });
      return;
    }

    // ── SKIP ──────────────────────────────────────────────
    if (sub === 'skip') {
      if (!isMod(interaction.member)) return interaction.editReply('❌ Only mods/VC owner can skip!');
      if (!state.current) return interaction.editReply('❌ Nothing playing!');
      state.player.stop();
      return interaction.editReply('⏭️ Skipped!');
    }

    // ── STOP ──────────────────────────────────────────────
    if (sub === 'stop') {
      if (!isMod(interaction.member)) return interaction.editReply('❌ Only mods/VC owner can stop!');
      state.queue = []; state.current = null;
      state.player.stop();
      if (state.connection) state.connection.destroy();
      client.musicPlayers.delete(guildId);
      return interaction.editReply('⏹️ Music stopped and left VC!');
    }

    // ── PAUSE ─────────────────────────────────────────────
    if (sub === 'pause') {
      if (!isMod(interaction.member)) return interaction.editReply('❌ Only mods/VC owner can pause!');
      if (state.paused) return interaction.editReply('❌ Already paused!');
      state.player.pause(); state.paused = true;
      return interaction.editReply('⏸️ Paused!');
    }

    // ── RESUME ────────────────────────────────────────────
    if (sub === 'resume') {
      if (!state.paused) return interaction.editReply('❌ Not paused!');
      state.player.unpause(); state.paused = false;
      return interaction.editReply('▶️ Resumed!');
    }

    // ── PREVIOUS ──────────────────────────────────────────
    if (sub === 'previous') {
      if (!isMod(interaction.member)) return interaction.editReply('❌ Only mods/VC owner can do that!');
      if (state.history.length === 0) return interaction.editReply('❌ No previous song!');
      const prev = state.history.pop();
      if (state.current) state.queue.unshift(state.current);
      state.queue.unshift(prev);
      state.player.stop();
      return interaction.editReply('⏮️ Playing previous song!');
    }

    // ── VOLUME ────────────────────────────────────────────
    if (sub === 'volume') {
      const level = interaction.options.getInteger('level');
      state.volume = level;
      return interaction.editReply(`🔊 Volume set to **${level}%**`);
    }

    // ── LOOP ──────────────────────────────────────────────
    if (sub === 'loop') {
      if (!isMod(interaction.member)) return interaction.editReply('❌ Only mods/VC owner can set loop!');
      const mode = interaction.options.getString('mode');
      state.loop = mode;
      const labels = { none: '➡️ Off', song: '🔂 Song', queue: '🔁 Queue' };
      return interaction.editReply(`🔁 Loop set to **${labels[mode]}**`);
    }

    // ── SHUFFLE ───────────────────────────────────────────
    if (sub === 'shuffle') {
      if (!isMod(interaction.member)) return interaction.editReply('❌ Only mods/VC owner can shuffle!');
      if (state.queue.length === 0) return interaction.editReply('❌ Queue is empty!');
      for (let i = state.queue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [state.queue[i], state.queue[j]] = [state.queue[j], state.queue[i]];
      }
      return interaction.editReply('🔀 Queue shuffled!');
    }

    // ── LYRICS ────────────────────────────────────────────
    if (sub === 'lyrics') {
      if (!state.current) return interaction.editReply('❌ Nothing playing!');
      await interaction.editReply({ embeds: [new EmbedBuilder().setColor('#5865F2').setTitle(`🎵 Lyrics — ${state.current.title}`).setDescription('Searching for lyrics...')] });
      try {
        const results = await play.search(`${state.current.title} lyrics`, { limit: 1, source: { youtube: 'video' } });
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#5865F2').setTitle(`🎵 ${state.current.title}`).setDescription(`Lyrics search: [Click here](${results[0]?.url || state.current.url})\n\nUse a lyrics website for full lyrics!`)] });
      } catch {
        return interaction.editReply('❌ Could not find lyrics!');
      }
    }

    // ── NOW PLAYING ───────────────────────────────────────
    if (sub === 'nowplaying') {
      if (!state.current) return interaction.editReply('❌ Nothing playing!');
      const embed = buildNowPlayingEmbed(state);
      const rows = buildNowPlayingRow(state);
      await interaction.editReply({ embeds: [embed], components: rows });
      const msg = await interaction.fetchReply();
      setupNowPlayingCollector(client, guildId, msg);
      return;
    }

    // ── QUEUE ─────────────────────────────────────────────
    if (sub === 'queue') {
      if (state.queue.length === 0 && !state.current) return interaction.editReply('📋 Queue is empty!');
      const lines = state.queue.slice(0, 15).map((s, i) => `**${i+1}.** ${s.title} — ${formatDuration(s.duration)} — *${s.requestedBy}*`);
      if (state.queue.length > 15) lines.push(`...and ${state.queue.length - 15} more`);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#5865F2').setTitle(`📋 Queue — ${state.queue.length} songs`).setDescription(state.current ? `**Now Playing:** ${state.current.title}\n\n${lines.join('\n')}` : lines.join('\n'))] });
    }

    // ── REMOVE ────────────────────────────────────────────
    if (sub === 'remove') {
      if (!isMod(interaction.member)) return interaction.editReply('❌ Only mods/VC owner can remove songs!');
      const pos = interaction.options.getInteger('position') - 1;
      if (pos >= state.queue.length) return interaction.editReply('❌ Invalid position!');
      const removed = state.queue.splice(pos, 1)[0];
      return interaction.editReply(`✅ Removed **${removed.title}** from queue!`);
    }

    // ── CLEAR ─────────────────────────────────────────────
    if (sub === 'clear') {
      if (!isMod(interaction.member)) return interaction.editReply('❌ Only mods/VC owner can clear queue!');
      state.queue = [];
      return interaction.editReply('✅ Queue cleared!');
    }

    // ── 247 ───────────────────────────────────────────────
    if (sub === '247') {
      if (!isMod(interaction.member)) return interaction.editReply('❌ Only mods can toggle 247!');
      state.is247 = !state.is247;
      return interaction.editReply(`${state.is247 ? '✅ 247 mode ON' : '❌ 247 mode OFF'}`);
    }

    // ── FAVORITES ─────────────────────────────────────────
    if (sub === 'favorites') {
      const favs = client.memory.get(`music_favs_${userId}`) || [];
      if (favs.length === 0) return interaction.editReply('⭐ No favorites yet! Click ⭐ on the now playing embed to save songs.');
      const lines = favs.slice(0, 15).map((s, i) => `**${i+1}.** [${s.title}](${s.url}) — ${formatDuration(s.duration)}`);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#FFD700').setTitle(`⭐ ${username}'s Favorites (${favs.length})`).setDescription(lines.join('\n'))] });
    }
  }
};
