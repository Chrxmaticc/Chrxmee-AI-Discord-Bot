const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} = require('discord.js');

function isMod(member) {
  return member.permissions.has('ManageMessages') || member.permissions.has('Administrator');
}

function formatDuration(ms) {
  if (!ms) return '0:00';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function getUserPlaylists(client, userId) {
  return client.memory.get(`playlists_${userId}`) || {};
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('music')
    .setDescription('Music player')
    .addSubcommand(sub =>
      sub.setName('play')
        .setDescription('Play a song or playlist')
        .addStringOption(opt => opt.setName('query').setDescription('Song name, URL, or playlist ID').setRequired(true))
        .addStringOption(opt => opt.setName('source').setDescription('Source').setRequired(false)
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
    .addSubcommand(sub => sub.setName('previous').setDescription('Play previous song'))
    .addSubcommand(sub =>
      sub.setName('volume')
        .setDescription('Set volume')
        .addIntegerOption(opt => opt.setName('level').setDescription('0-200').setRequired(true).setMinValue(0).setMaxValue(200))
    )
    .addSubcommand(sub =>
      sub.setName('loop')
        .setDescription('Set loop mode')
        .addStringOption(opt => opt.setName('mode').setDescription('Loop mode').setRequired(true)
          .addChoices(
            { name: '➡️ Off', value: '0' },
            { name: '🔂 Song', value: '1' },
            { name: '🔁 Queue', value: '2' },
          ))
    )
    .addSubcommand(sub => sub.setName('shuffle').setDescription('Shuffle the queue'))
    .addSubcommand(sub => sub.setName('nowplaying').setDescription('Show now playing'))
    .addSubcommand(sub => sub.setName('queue').setDescription('View the queue'))
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove a song from queue')
        .addIntegerOption(opt => opt.setName('position').setDescription('Position').setRequired(true).setMinValue(1))
    )
    .addSubcommand(sub => sub.setName('clear').setDescription('Clear the queue'))
    .addSubcommand(sub => sub.setName('247').setDescription('Toggle 247 mode'))
    .addSubcommand(sub => sub.setName('favorites').setDescription('View your favorites')),

  async execute(interaction, client) {
    try { await interaction.deferReply(); } catch { return; }

    const guildId = interaction.guild.id;
    const userId = interaction.user.id;
    const username = interaction.user.username;
    const sub = interaction.options.getSubcommand();
    const distube = client.distube;

    // ── PLAY ──────────────────────────────────────────────
    if (sub === 'play') {
      const voiceChannel = interaction.member.voice.channel;
      if (!voiceChannel) return interaction.editReply('❌ Join a voice channel first!');

      const query = interaction.options.getString('query');

      // Check if it's a playlist ID
      const playlists = getUserPlaylists(client, userId);
      const pl = Object.values(playlists).find(p => p.id === query.toUpperCase() || p.name.toLowerCase() === query.toLowerCase());
      if (pl && pl.songs.length > 0) {
        try {
          for (const song of pl.songs) {
            await distube.play(voiceChannel, song.url, { member: interaction.member, textChannel: interaction.channel });
          }
          pl.lastPlayed = Date.now();
          client.memory.set(`playlists_${userId}`, playlists);
          return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#5865F2').setTitle('📋 Playlist Queued!').setDescription(`**${pl.name}** — ${pl.songs.length} songs added!`)] });
        } catch (err) {
          return interaction.editReply(`❌ Error playing playlist: ${err.message?.slice(0, 100)}`);
        }
      }

      // Show source dropdown + user playlists
      const plOptions = Object.values(playlists).slice(0, 5).map(p =>
        new StringSelectMenuOptionBuilder().setLabel(`📋 ${p.name}`).setValue(`pl_${p.id}`).setDescription(`${p.songs.length} songs • ${p.id}`)
      );
      const sourceOptions = [
        new StringSelectMenuOptionBuilder().setLabel('▶️ YouTube').setValue('youtube').setDescription('Search on YouTube'),
        new StringSelectMenuOptionBuilder().setLabel('🟢 Spotify').setValue('spotify').setDescription('Search Spotify (plays via YouTube)'),
        new StringSelectMenuOptionBuilder().setLabel('🔶 SoundCloud').setValue('soundcloud').setDescription('Search on SoundCloud'),
        new StringSelectMenuOptionBuilder().setLabel('🔗 Play URL directly').setValue('url').setDescription('Use the query as a direct URL'),
      ];

      const allOptions = [...sourceOptions, ...plOptions];
      const menu = new StringSelectMenuBuilder().setCustomId('music_source_select').setPlaceholder('Choose source or playlist...').addOptions(allOptions);
      const row = new ActionRowBuilder().addComponents(menu);

      await interaction.editReply({ embeds: [new EmbedBuilder().setColor('#5865F2').setTitle('🎵 Where to play from?').setDescription(`Query: **${query}**`)], components: [row] });
      const msg = await interaction.fetchReply();
      const collector = msg.createMessageComponentCollector({ time: 30000, max: 1 });

      collector.on('collect', async sel => {
        try { await sel.deferUpdate(); } catch { return; }
        if (sel.user.id !== userId) return sel.followUp({ content: '❌ Not your search!', ephemeral: true }).catch(() => {});

        const value = sel.values[0];

        if (value.startsWith('pl_')) {
          const plId = value.replace('pl_', '');
          const pl2 = Object.values(playlists).find(p => p.id === plId);
          if (!pl2) return;
          try {
            for (const song of pl2.songs) {
              await distube.play(voiceChannel, song.url, { member: interaction.member, textChannel: interaction.channel });
            }
            pl2.lastPlayed = Date.now();
            client.memory.set(`playlists_${userId}`, playlists);
            await msg.edit({ embeds: [new EmbedBuilder().setColor('#5865F2').setTitle('📋 Playlist Queued!').setDescription(`**${pl2.name}** — ${pl2.songs.length} songs added!`)], components: [] }).catch(() => {});
          } catch (err) {
            await msg.edit({ content: `❌ Error: ${err.message?.slice(0, 100)}`, components: [] }).catch(() => {});
          }
          return;
        }

        // Play by source
        try {
          let searchQuery = query;
          if (value === 'soundcloud') searchQuery = `scsearch:${query}`;
          else if (value === 'spotify') searchQuery = `${query} official audio`;
          await distube.play(voiceChannel, searchQuery, { member: interaction.member, textChannel: interaction.channel });
          await msg.edit({ embeds: [new EmbedBuilder().setColor('#5865F2').setTitle('🎵 Searching...').setDescription(`Looking up **${query}**`)], components: [] }).catch(() => {});
        } catch (err) {
          await msg.edit({ content: `❌ Error: ${err.message?.slice(0, 100)}`, components: [] }).catch(() => {});
        }
      });

      collector.on('end', collected => { if (collected.size === 0) msg.edit({ components: [] }).catch(() => {}); });
      return;
    }

    // ── SKIP ──────────────────────────────────────────────
    if (sub === 'skip') {
      if (!isMod(interaction.member)) return interaction.editReply('❌ Only mods/VC owner can skip!');
      const queue = distube.getQueue(guildId);
      if (!queue) return interaction.editReply('❌ Nothing playing!');
      await queue.skip();
      return interaction.editReply('⏭️ Skipped!');
    }

    // ── STOP ──────────────────────────────────────────────
    if (sub === 'stop') {
      if (!isMod(interaction.member)) return interaction.editReply('❌ Only mods/VC owner can stop!');
      const queue = distube.getQueue(guildId);
      if (!queue) return interaction.editReply('❌ Nothing playing!');
      queue.stop();
      return interaction.editReply('⏹️ Stopped and left VC!');
    }

    // ── PAUSE ─────────────────────────────────────────────
    if (sub === 'pause') {
      if (!isMod(interaction.member)) return interaction.editReply('❌ Only mods can pause!');
      const queue = distube.getQueue(guildId);
      if (!queue) return interaction.editReply('❌ Nothing playing!');
      queue.pause();
      return interaction.editReply('⏸️ Paused!');
    }

    // ── RESUME ────────────────────────────────────────────
    if (sub === 'resume') {
      const queue = distube.getQueue(guildId);
      if (!queue) return interaction.editReply('❌ Nothing playing!');
      queue.resume();
      return interaction.editReply('▶️ Resumed!');
    }

    // ── PREVIOUS ──────────────────────────────────────────
    if (sub === 'previous') {
      if (!isMod(interaction.member)) return interaction.editReply('❌ Only mods can do that!');
      const queue = distube.getQueue(guildId);
      if (!queue) return interaction.editReply('❌ Nothing playing!');
      await queue.previous();
      return interaction.editReply('⏮️ Playing previous!');
    }

    // ── VOLUME ────────────────────────────────────────────
    if (sub === 'volume') {
      const queue = distube.getQueue(guildId);
      if (!queue) return interaction.editReply('❌ Nothing playing!');
      const level = interaction.options.getInteger('level');
      queue.setVolume(level);
      return interaction.editReply(`🔊 Volume set to **${level}%**`);
    }

    // ── LOOP ──────────────────────────────────────────────
    if (sub === 'loop') {
      if (!isMod(interaction.member)) return interaction.editReply('❌ Only mods can set loop!');
      const queue = distube.getQueue(guildId);
      if (!queue) return interaction.editReply('❌ Nothing playing!');
      const mode = parseInt(interaction.options.getString('mode'));
      queue.setRepeatMode(mode);
      const labels = ['➡️ Off', '🔂 Song', '🔁 Queue'];
      return interaction.editReply(`🔁 Loop: **${labels[mode]}**`);
    }

    // ── SHUFFLE ───────────────────────────────────────────
    if (sub === 'shuffle') {
      if (!isMod(interaction.member)) return interaction.editReply('❌ Only mods can shuffle!');
      const queue = distube.getQueue(guildId);
      if (!queue) return interaction.editReply('❌ Nothing playing!');
      queue.shuffle();
      return interaction.editReply('🔀 Queue shuffled!');
    }

    // ── NOW PLAYING ───────────────────────────────────────
    if (sub === 'nowplaying') {
      const queue = distube.getQueue(guildId);
      if (!queue || !queue.songs[0]) return interaction.editReply('❌ Nothing playing!');
      const song = queue.songs[0];
      const loopLabel = queue.repeatMode === 2 ? '🔁 Queue' : queue.repeatMode === 1 ? '🔂 Song' : '➡️ Off';
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#5865F2').setTitle('🎵 Now Playing')
        .setDescription(`**[${song.name}](${song.url})**`)
        .setThumbnail(song.thumbnail)
        .addFields(
          { name: '⏱️ Duration', value: song.formattedDuration, inline: true },
          { name: '👤 Requested by', value: song.user?.tag || 'Unknown', inline: true },
          { name: '🔁 Loop', value: loopLabel, inline: true },
          { name: '🔊 Volume', value: `${queue.volume}%`, inline: true },
          { name: '📋 Queue', value: `${queue.songs.length - 1} song(s) up next`, inline: true },
        )] });
    }

    // ── QUEUE ─────────────────────────────────────────────
    if (sub === 'queue') {
      const queue = distube.getQueue(guildId);
      if (!queue || queue.songs.length === 0) return interaction.editReply('📋 Queue is empty!');
      const lines = queue.songs.slice(1, 16).map((s, i) => `**${i+1}.** ${s.name} — ${s.formattedDuration}`);
      if (queue.songs.length > 16) lines.push(`...and ${queue.songs.length - 16} more`);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#5865F2').setTitle(`📋 Queue — ${queue.songs.length - 1} songs up next`).setDescription(`**Now Playing:** ${queue.songs[0].name}\n\n${lines.join('\n') || 'Queue is empty after this song!'}`)] });
    }

    // ── REMOVE ────────────────────────────────────────────
    if (sub === 'remove') {
      if (!isMod(interaction.member)) return interaction.editReply('❌ Only mods can remove songs!');
      const queue = distube.getQueue(guildId);
      if (!queue) return interaction.editReply('❌ Nothing playing!');
      const pos = interaction.options.getInteger('position');
      if (pos >= queue.songs.length) return interaction.editReply('❌ Invalid position!');
      const removed = queue.songs.splice(pos, 1)[0];
      return interaction.editReply(`✅ Removed **${removed.name}**!`);
    }

    // ── CLEAR ─────────────────────────────────────────────
    if (sub === 'clear') {
      if (!isMod(interaction.member)) return interaction.editReply('❌ Only mods can clear!');
      const queue = distube.getQueue(guildId);
      if (!queue) return interaction.editReply('❌ Nothing playing!');
      queue.songs.splice(1);
      return interaction.editReply('✅ Queue cleared!');
    }

    // ── 247 ───────────────────────────────────────────────
    if (sub === '247') {
      if (!isMod(interaction.member)) return interaction.editReply('❌ Only mods can toggle 247!');
      const key = `247_${guildId}`;
      const is247 = !client.memory.get(key);
      client.memory.set(key, is247);
      return interaction.editReply(`${is247 ? '✅ 247 mode ON' : '❌ 247 mode OFF'}`);
    }

    // ── FAVORITES ─────────────────────────────────────────
    if (sub === 'favorites') {
      const favs = client.memory.get(`music_favs_${userId}`) || [];
      if (favs.length === 0) return interaction.editReply('⭐ No favorites yet! Click ⭐ on the now playing embed.');
      const lines = favs.slice(0, 15).map((s, i) => `**${i+1}.** [${s.title}](${s.url})`);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#FFD700').setTitle(`⭐ ${username}'s Favorites (${favs.length})`).setDescription(lines.join('\n'))] });
    }
  }
};
