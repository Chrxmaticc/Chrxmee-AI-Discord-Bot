const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder
} = require('discord.js');
const play = require('play-dl');

function generatePlaylistId() {
  return 'PL-' + Math.random().toString(36).substring(2, 6).toUpperCase();
}

function formatDuration(seconds) {
  if (!seconds) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function getUserPlaylists(client, userId) {
  return client.memory.get(`playlists_${userId}`) || {};
}

function saveUserPlaylists(client, userId, playlists) {
  client.memory.set(`playlists_${userId}`, playlists);
}

function cleanupPlaylists(client, userId) {
  const playlists = getUserPlaylists(client, userId);
  const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
  let cleaned = 0;
  for (const [id, pl] of Object.entries(playlists)) {
    if (pl.songs.length < 10 && pl.lastPlayed && pl.lastPlayed < twoWeeksAgo) {
      delete playlists[id];
      cleaned++;
    }
  }
  if (cleaned > 0) saveUserPlaylists(client, userId, playlists);
  return cleaned;
}

function findPlaylist(playlists, query) {
  return Object.values(playlists).find(pl =>
    pl.id === query.toUpperCase() || pl.name.toLowerCase() === query.toLowerCase()
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('playlist')
    .setDescription('Manage your music playlists')
    .addSubcommand(sub =>
      sub.setName('create')
        .setDescription('Create a new playlist')
        .addStringOption(opt => opt.setName('name').setDescription('Playlist name').setRequired(true))
        .addStringOption(opt => opt.setName('privacy').setDescription('Public or private').setRequired(false)
          .addChoices({ name: '🌍 Public', value: 'public' }, { name: '🔒 Private', value: 'private' }))
    )
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Add a song to a playlist')
        .addStringOption(opt => opt.setName('playlist').setDescription('Playlist name or ID').setRequired(true))
        .addStringOption(opt => opt.setName('song').setDescription('Song name or URL').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove a song from a playlist')
        .addStringOption(opt => opt.setName('playlist').setDescription('Playlist name or ID').setRequired(true))
        .addIntegerOption(opt => opt.setName('position').setDescription('Song position').setRequired(true).setMinValue(1))
    )
    .addSubcommand(sub =>
      sub.setName('delete')
        .setDescription('Delete a playlist')
        .addStringOption(opt => opt.setName('playlist').setDescription('Playlist name or ID').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('view')
        .setDescription('View songs in a playlist')
        .addStringOption(opt => opt.setName('playlist').setDescription('Playlist name or ID').setRequired(true))
    )
    .addSubcommand(sub => sub.setName('list').setDescription('View all your playlists'))
    .addSubcommand(sub =>
      sub.setName('share')
        .setDescription('Share a playlist with someone')
        .addStringOption(opt => opt.setName('playlist').setDescription('Playlist name or ID').setRequired(true))
        .addUserOption(opt => opt.setName('user').setDescription('Who to share with').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('play')
        .setDescription('Queue an entire playlist')
        .addStringOption(opt => opt.setName('playlist').setDescription('Playlist name or ID').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('privacy')
        .setDescription('Change playlist privacy')
        .addStringOption(opt => opt.setName('playlist').setDescription('Playlist name or ID').setRequired(true))
        .addStringOption(opt => opt.setName('setting').setDescription('Public or private').setRequired(true)
          .addChoices({ name: '🌍 Public', value: 'public' }, { name: '🔒 Private', value: 'private' }))
    )
    .addSubcommand(sub =>
      sub.setName('rename')
        .setDescription('Rename a playlist')
        .addStringOption(opt => opt.setName('playlist').setDescription('Playlist name or ID').setRequired(true))
        .addStringOption(opt => opt.setName('newname').setDescription('New name').setRequired(true))
    )
    .addSubcommand(sub => sub.setName('cleanup').setDescription('Clean up unused playlists (under 10 songs, not played in 2 weeks)')),

  async execute(interaction, client) {
    try { await interaction.deferReply({ ephemeral: false }); } catch { return; }

    const userId = interaction.user.id;
    const username = interaction.user.username;
    const sub = interaction.options.getSubcommand();

    // Auto-cleanup on every command
    cleanupPlaylists(client, userId);
    const playlists = getUserPlaylists(client, userId);

    // ── CREATE ────────────────────────────────────────────
    if (sub === 'create') {
      const name = interaction.options.getString('name').trim();
      const privacy = interaction.options.getString('privacy') || 'private';

      // Check duplicate name
      if (Object.values(playlists).find(pl => pl.name.toLowerCase() === name.toLowerCase())) {
        return interaction.editReply(`❌ You already have a playlist named **${name}**!`);
      }

      const id = generatePlaylistId();
      playlists[id] = {
        id, name, privacy,
        songs: [],
        createdAt: Date.now(),
        lastPlayed: null,
        owner: userId,
        sharedWith: [],
      };
      saveUserPlaylists(client, userId, playlists);

      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#5865F2').setTitle('✅ Playlist Created!')
        .addFields(
          { name: '📋 Name', value: name, inline: true },
          { name: '🆔 ID', value: `\`${id}\``, inline: true },
          { name: '🔒 Privacy', value: privacy === 'public' ? '🌍 Public' : '🔒 Private', inline: true },
        )
        .setFooter({ text: `Use /playlist add ${id} <song> to add songs!` })] });
    }

    // ── ADD ───────────────────────────────────────────────
    if (sub === 'add') {
      const query = interaction.options.getString('playlist');
      const songQuery = interaction.options.getString('song');
      const pl = findPlaylist(playlists, query);
      if (!pl) return interaction.editReply(`❌ Playlist **${query}** not found!`);
      if (pl.owner !== userId) return interaction.editReply('❌ You can only add songs to your own playlists!');

      await interaction.editReply({ embeds: [new EmbedBuilder().setColor('#5865F2').setTitle('🔍 Searching...')] });

      let song;
      if (songQuery.startsWith('http')) {
        try {
          const info = await play.video_basic_info(songQuery);
          song = { title: info.video_details.title, url: info.video_details.url, duration: info.video_details.durationInSec, thumbnail: info.video_details.thumbnails?.[0]?.url };
        } catch { return interaction.editReply('❌ Invalid URL!'); }
      } else {
        const results = await play.search(songQuery, { limit: 5, source: { youtube: 'video' } }).catch(() => []);
        if (results.length === 0) return interaction.editReply('❌ No results found!');

        const menu = new StringSelectMenuBuilder().setCustomId('pl_add_select').setPlaceholder('Choose a song to add...')
          .addOptions(results.map((r, i) => new StringSelectMenuOptionBuilder().setLabel(r.title.slice(0, 100)).setValue(`${i}`).setDescription(formatDuration(r.durationInSec))));

        await interaction.editReply({ embeds: [new EmbedBuilder().setColor('#5865F2').setTitle('🎵 Select a song to add').setDescription(results.map((r, i) => `**${i+1}.** ${r.title} — ${formatDuration(r.durationInSec)}`).join('\n'))], components: [new ActionRowBuilder().addComponents(menu)] });

        const msg = await interaction.fetchReply();
        const collector = msg.createMessageComponentCollector({ time: 30000, max: 1 });
        collector.on('collect', async sel => {
          try { await sel.deferUpdate(); } catch { return; }
          if (sel.user.id !== userId) return sel.followUp({ content: '❌ Not your search!', ephemeral: true }).catch(() => {});
          const idx = parseInt(sel.values[0]);
          const r = results[idx];
          song = { title: r.title, url: r.url, duration: r.durationInSec, thumbnail: r.thumbnails?.[0]?.url };
          pl.songs.push(song);
          saveUserPlaylists(client, userId, playlists);
          await msg.edit({ embeds: [new EmbedBuilder().setColor('#5865F2').setTitle('✅ Song Added!').setDescription(`**${song.title}** added to **${pl.name}** (${pl.id})\n📋 Playlist now has **${pl.songs.length}** songs`)], components: [] }).catch(() => {});
        });
        collector.on('end', collected => { if (collected.size === 0) msg.edit({ components: [] }).catch(() => {}); });
        return;
      }

      pl.songs.push(song);
      saveUserPlaylists(client, userId, playlists);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#5865F2').setTitle('✅ Song Added!').setDescription(`**${song.title}** added to **${pl.name}** (\`${pl.id}\`)\n📋 Playlist now has **${pl.songs.length}** songs`)] });
    }

    // ── REMOVE ────────────────────────────────────────────
    if (sub === 'remove') {
      const query = interaction.options.getString('playlist');
      const pos = interaction.options.getInteger('position') - 1;
      const pl = findPlaylist(playlists, query);
      if (!pl) return interaction.editReply(`❌ Playlist **${query}** not found!`);
      if (pl.owner !== userId) return interaction.editReply('❌ You can only edit your own playlists!');
      if (pos >= pl.songs.length) return interaction.editReply('❌ Invalid position!');
      const removed = pl.songs.splice(pos, 1)[0];
      saveUserPlaylists(client, userId, playlists);
      return interaction.editReply(`✅ Removed **${removed.title}** from **${pl.name}**!`);
    }

    // ── DELETE ────────────────────────────────────────────
    if (sub === 'delete') {
      const query = interaction.options.getString('playlist');
      const pl = findPlaylist(playlists, query);
      if (!pl) return interaction.editReply(`❌ Playlist **${query}** not found!`);
      if (pl.owner !== userId) return interaction.editReply('❌ You can only delete your own playlists!');
      delete playlists[pl.id];
      saveUserPlaylists(client, userId, playlists);
      return interaction.editReply(`✅ Playlist **${pl.name}** (\`${pl.id}\`) deleted!`);
    }

    // ── VIEW ──────────────────────────────────────────────
    if (sub === 'view') {
      const query = interaction.options.getString('playlist');
      // Search own playlists first, then public ones
      let pl = findPlaylist(playlists, query);
      if (!pl) {
        // Search other users' public playlists
        for (const [key, val] of client.memory.entries()) {
          if (!key.startsWith('playlists_')) continue;
          const otherPls = val;
          const found = Object.values(otherPls).find(p => (p.id === query.toUpperCase() || p.name.toLowerCase() === query.toLowerCase()) && p.privacy === 'public');
          if (found) { pl = found; break; }
        }
      }
      if (!pl) return interaction.editReply(`❌ Playlist **${query}** not found or is private!`);
      if (pl.privacy === 'private' && pl.owner !== userId && !pl.sharedWith?.includes(userId)) {
        return interaction.editReply('❌ This playlist is private!');
      }

      const lines = pl.songs.slice(0, 20).map((s, i) => `**${i+1}.** ${s.title} — ${formatDuration(s.duration)}`);
      if (pl.songs.length > 20) lines.push(`...and ${pl.songs.length - 20} more`);

      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#5865F2').setTitle(`📋 ${pl.name}`)
        .setDescription(lines.join('\n') || 'No songs yet!')
        .addFields(
          { name: '🆔 ID', value: `\`${pl.id}\``, inline: true },
          { name: '🎵 Songs', value: `${pl.songs.length}`, inline: true },
          { name: '🔒 Privacy', value: pl.privacy === 'public' ? '🌍 Public' : '🔒 Private', inline: true },
        )] });
    }

    // ── LIST ──────────────────────────────────────────────
    if (sub === 'list') {
      const entries = Object.values(playlists);
      if (entries.length === 0) return interaction.editReply('📋 No playlists yet! Use `/playlist create` to make one.');
      const lines = entries.map(pl => `${pl.privacy === 'public' ? '🌍' : '🔒'} **${pl.name}** — \`${pl.id}\` — ${pl.songs.length} songs${pl.lastPlayed ? ` — Last played: <t:${Math.floor(pl.lastPlayed/1000)}:R>` : ''}`);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#5865F2').setTitle(`📋 ${username}'s Playlists (${entries.length})`).setDescription(lines.join('\n'))] });
    }

    // ── SHARE ─────────────────────────────────────────────
    if (sub === 'share') {
      const query = interaction.options.getString('playlist');
      const target = interaction.options.getUser('user');
      const pl = findPlaylist(playlists, query);
      if (!pl) return interaction.editReply(`❌ Playlist **${query}** not found!`);
      if (pl.owner !== userId) return interaction.editReply('❌ You can only share your own playlists!');
      if (!pl.sharedWith) pl.sharedWith = [];
      if (pl.sharedWith.includes(target.id)) return interaction.editReply(`❌ Already shared with **${target.username}**!`);
      pl.sharedWith.push(target.id);
      saveUserPlaylists(client, userId, playlists);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#5865F2').setTitle('✅ Playlist Shared!')
        .setDescription(`**${pl.name}** (\`${pl.id}\`) shared with **${target.username}**!\nThey can view and play it using the ID \`${pl.id}\`.`)] });
    }

    // ── PLAY ──────────────────────────────────────────────
    if (sub === 'play') {
      const voiceChannel = interaction.member.voice.channel;
      if (!voiceChannel) return interaction.editReply('❌ You need to be in a voice channel!');

      const query = interaction.options.getString('playlist');
      let pl = findPlaylist(playlists, query);
      if (!pl) {
        for (const [key, val] of client.memory.entries()) {
          if (!key.startsWith('playlists_')) continue;
          const found = Object.values(val).find(p => (p.id === query.toUpperCase() || p.name.toLowerCase() === query.toLowerCase()) && (p.privacy === 'public' || p.sharedWith?.includes(userId)));
          if (found) { pl = found; break; }
        }
      }
      if (!pl) return interaction.editReply(`❌ Playlist **${query}** not found or is private!`);
      if (pl.songs.length === 0) return interaction.editReply('❌ Playlist is empty!');

      const guildId = interaction.guild.id;
      if (!client.musicPlayers) client.musicPlayers = new Map();

      // Use music player
      const musicModule = require('./music');
      const state = client.musicPlayers.get(guildId) || {
        queue: [], current: null, connection: null,
        player: require('@discordjs/voice').createAudioPlayer(),
        volume: 50, loop: 'none', is247: false,
        textChannel: interaction.channel, paused: false,
        startTime: null, inactivityTimer: null, nowPlayingMsg: null, history: [],
      };
      client.musicPlayers.set(guildId, state);

      if (!state.connection) {
        const { joinVoiceChannel, VoiceConnectionStatus, entersState } = require('@discordjs/voice');
        state.connection = joinVoiceChannel({ channelId: voiceChannel.id, guildId, adapterCreator: interaction.guild.voiceAdapterCreator });
        try { await entersState(state.connection, VoiceConnectionStatus.Ready, 15000); }
        catch { return interaction.editReply('❌ Failed to join VC!'); }
        state.connection.subscribe(state.player);
      }

      for (const song of pl.songs) state.queue.push({ ...song, requestedBy: username });
      pl.lastPlayed = Date.now();
      saveUserPlaylists(client, userId, playlists);

      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#5865F2').setTitle('📋 Playlist Queued!')
        .setDescription(`**${pl.name}** (\`${pl.id}\`) — **${pl.songs.length}** songs added to queue!`)] });
    }

    // ── PRIVACY ───────────────────────────────────────────
    if (sub === 'privacy') {
      const query = interaction.options.getString('playlist');
      const setting = interaction.options.getString('setting');
      const pl = findPlaylist(playlists, query);
      if (!pl) return interaction.editReply(`❌ Playlist **${query}** not found!`);
      if (pl.owner !== userId) return interaction.editReply('❌ You can only edit your own playlists!');
      pl.privacy = setting;
      saveUserPlaylists(client, userId, playlists);
      return interaction.editReply(`✅ **${pl.name}** is now **${setting === 'public' ? '🌍 Public' : '🔒 Private'}**!`);
    }

    // ── RENAME ────────────────────────────────────────────
    if (sub === 'rename') {
      const query = interaction.options.getString('playlist');
      const newName = interaction.options.getString('newname').trim();
      const pl = findPlaylist(playlists, query);
      if (!pl) return interaction.editReply(`❌ Playlist **${query}** not found!`);
      if (pl.owner !== userId) return interaction.editReply('❌ You can only rename your own playlists!');
      if (Object.values(playlists).find(p => p.name.toLowerCase() === newName.toLowerCase() && p.id !== pl.id)) {
        return interaction.editReply(`❌ You already have a playlist named **${newName}**!`);
      }
      const oldName = pl.name;
      pl.name = newName;
      saveUserPlaylists(client, userId, playlists);
      return interaction.editReply(`✅ Renamed **${oldName}** → **${newName}** (\`${pl.id}\`)`);
    }

    // ── CLEANUP ───────────────────────────────────────────
    if (sub === 'cleanup') {
      const cleaned = cleanupPlaylists(client, userId);
      return interaction.editReply(`🗑️ Cleaned up **${cleaned}** unused playlist(s)!`);
    }
  }
};
