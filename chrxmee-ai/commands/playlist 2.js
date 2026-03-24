const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ComponentType
} = require('discord.js');

// Helper to generate a unique ID
function generatePlaylistId() {
  return 'PL-' + Math.random().toString(36).substring(2, 6).toUpperCase();
}

// Sync with Postgres so Render restarts don't wipe playlists
async function syncToDB(client, userId, playlists) {
  client.memory.set(`playlists_${userId}`, playlists);
  try {
    await client.pool.query(
      'INSERT INTO user_data (user_id, playlists) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET playlists = $2',
      [userId, JSON.stringify(playlists)]
    );
  } catch (e) { console.error('DB Sync Error:', e.message); }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('playlist')
    .setDescription('Manage your custom music collections')
    .addSubcommand(sub =>
      sub.setName('create')
        .setDescription('Create a new playlist')
        .addStringOption(opt => opt.setName('name').setDescription('Name of the playlist').setRequired(true))
        .addStringOption(opt => opt.setName('privacy').setDescription('Public (anyone can play) or Private').setRequired(false)
          .addChoices({ name: '🌍 Public', value: 'public' }, { name: '🔒 Private', value: 'private' }))
    )
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Add a song to your playlist')
        .addStringOption(opt => opt.setName('playlist').setDescription('Name or ID').setRequired(true))
        .addStringOption(opt => opt.setName('song').setDescription('Song name, URL, or "current" to add playing song').setRequired(true))
    )
    .addSubcommand(sub => sub.setName('list').setDescription('View all your playlists'))
    .addSubcommand(sub => 
      sub.setName('view')
        .setDescription('See songs in a playlist')
        .addStringOption(opt => opt.setName('query').setDescription('Name or ID').setRequired(true))
    )
    .addSubcommand(sub => 
        sub.setName('play')
          .setDescription('Queue an entire playlist')
          .addStringOption(opt => opt.setName('query').setDescription('Name or ID').setRequired(true))
    )
    .addSubcommand(sub => 
      sub.setName('delete')
        .setDescription('Permanently delete a playlist')
        .addStringOption(opt => opt.setName('query').setDescription('Name or ID').setRequired(true))
    ),

  async execute(interaction, client) {
    await interaction.deferReply();
    const userId = interaction.user.id;
    const sub = interaction.options.getSubcommand();
    
    // Load playlists from memory (which was synced from DB on bot start)
    let playlists = client.memory.get(`playlists_${userId}`) || {};

    // ── CREATE ────────────────────────────────────────────
    if (sub === 'create') {
      const name = interaction.options.getString('name');
      const privacy = interaction.options.getString('privacy') || 'private';
      
      if (Object.values(playlists).some(p => p.name.toLowerCase() === name.toLowerCase())) {
        return interaction.editReply('❌ You already have a playlist with that name!');
      }

      const id = generatePlaylistId();
      playlists[id] = { id, name, privacy, songs: [], createdAt: Date.now(), owner: userId };
      
      await syncToDB(client, userId, playlists);
      return interaction.editReply(`✅ Created playlist **${name}** (ID: \`${id}\`)`);
    }

    // ── ADD ───────────────────────────────────────────────
    if (sub === 'add') {
      const plQuery = interaction.options.getString('playlist');
      const songQuery = interaction.options.getString('song');
      
      const pl = Object.values(playlists).find(p => p.id === plQuery.toUpperCase() || p.name.toLowerCase() === plQuery.toLowerCase());
      if (!pl) return interaction.editReply('❌ Playlist not found.');

      let songToAdd;

      // Special Case: Add currently playing song
      if (songQuery.toLowerCase() === 'current') {
        const queue = client.distube.getQueue(interaction.guildId);
        if (!queue) return interaction.editReply('❌ Nothing is playing right now!');
        const song = queue.songs[0];
        songToAdd = { title: song.name, url: song.url, duration: song.formattedDuration, thumbnail: song.thumbnail };
      } else {
        // Search for the song
        const results = await client.distube.search(songQuery, { limit: 1 });
        if (!results.length) return interaction.editReply('❌ No songs found.');
        const s = results[0];
        songToAdd = { title: s.name, url: s.url, duration: s.formattedDuration, thumbnail: s.thumbnail };
      }

      pl.songs.push(songToAdd);
      await syncToDB(client, userId, playlists);
      
      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('➕ Song Added')
        .setDescription(`Added **${songToAdd.title}** to **${pl.name}**`)
        .setThumbnail(songToAdd.thumbnail);

      return interaction.editReply({ embeds: [embed] });
    }

    // ── VIEW ──────────────────────────────────────────────
    if (sub === 'view') {
      const query = interaction.options.getString('query');
      const pl = Object.values(playlists).find(p => p.id === query.toUpperCase() || p.name.toLowerCase() === query.toLowerCase());
      
      if (!pl) return interaction.editReply('❌ Playlist not found.');

      const songList = pl.songs.slice(0, 15).map((s, i) => `**${i+1}.** [${s.title}](${s.url}) - \`${s.duration}\``).join('\n');
      
      const embed = new EmbedBuilder()
        .setTitle(`📋 Playlist: ${pl.name}`)
        .setColor('#5865F2')
        .setDescription(songList || 'No songs added yet.')
        .addFields(
            { name: '🆔 ID', value: `\`${pl.id}\``, inline: true },
            { name: '🎵 Total Songs', value: `${pl.songs.length}`, inline: true }
        );

      if (pl.songs[0]) embed.setThumbnail(pl.songs[0].thumbnail);
      
      return interaction.editReply({ embeds: [embed] });
    }

    // ── PLAY (The Heavy Lifter) ───────────────────────────
    if (sub === 'play') {
      const voiceChannel = interaction.member.voice.channel;
      if (!voiceChannel) return interaction.editReply('❌ Join a VC first!');

      const query = interaction.options.getString('query');
      const pl = Object.values(playlists).find(p => p.id === query.toUpperCase() || p.name.toLowerCase() === query.toLowerCase());

      if (!pl || pl.songs.length === 0) return interaction.editReply('❌ Playlist not found or empty.');

      await interaction.editReply(`🎶 Loading **${pl.songs.length}** songs into the queue...`);

      // Use a loop but handle it in batches to avoid crashing Distube
      try {
        for (const song of pl.songs) {
            await client.distube.play(voiceChannel, song.url, {
                member: interaction.member,
                textChannel: interaction.channel,
                skip: false
            });
        }
        return interaction.editReply(`✅ Finished queuing **${pl.name}**!`);
      } catch (e) {
        return interaction.editReply(`❌ Error during playback: ${e.message}`);
      }
    }

    // ── LIST ──────────────────────────────────────────────
    if (sub === 'list') {
        const list = Object.values(playlists).map(p => `• **${p.name}** (\`${p.id}\`) - ${p.songs.length} songs`).join('\n');
        return interaction.editReply({
            embeds: [new EmbedBuilder().setTitle('📂 Your Playlists').setDescription(list || 'No playlists yet.').setColor('#5865F2')]
        });
    }

    // ── DELETE ────────────────────────────────────────────
    if (sub === 'delete') {
        const query = interaction.options.getString('query');
        const pl = Object.values(playlists).find(p => p.id === query.toUpperCase() || p.name.toLowerCase() === query.toLowerCase());
        
        if (!pl) return interaction.editReply('❌ Playlist not found.');
        
        delete playlists[pl.id];
        await syncToDB(client, userId, playlists);
        return interaction.editReply(`🗑️ Deleted playlist **${pl.name}**.`);
    }
  }
};
