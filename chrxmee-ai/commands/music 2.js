const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder, ComponentType
} = require('discord.js');

function isMod(member) {
  return member.permissions.has('ManageMessages') || member.permissions.has('Administrator');
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('music')
    .setDescription('Chrxmee AI Music System')
    .addSubcommand(sub =>
      sub.setName('play')
        .setDescription('Play a song, playlist, or search')
        .addStringOption(opt => opt.setName('query').setDescription('Song name, URL, or your Playlist ID').setRequired(true))
    )
    .addSubcommand(sub => sub.setName('skip').setDescription('Skip the current song'))
    .addSubcommand(sub => sub.setName('stop').setDescription('Stop music and clear queue'))
    .addSubcommand(sub => sub.setName('pause').setDescription('Pause the music'))
    .addSubcommand(sub => sub.setName('resume').setDescription('Resume the music'))
    .addSubcommand(sub => sub.setName('nowplaying').setDescription('Show detailed info about the current song'))
    .addSubcommand(sub => sub.setName('queue').setDescription('View the current music queue'))
    .addSubcommand(sub => sub.setName('shuffle').setDescription('Shuffle the queue'))
    .addSubcommand(sub => 
        sub.setName('volume')
            .setDescription('Set volume (0-100)')
            .addIntegerOption(opt => opt.setName('amount').setDescription('Volume level').setRequired(true).setMinValue(0).setMaxValue(100))
    )
    .addSubcommand(sub => sub.setName('favorites').setDescription('View your saved songs')),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const distube = client.distube;
    if (!distube) {
      return interaction.reply({
        content: '❌ Music is currently unavailable. Install dependencies and restart the bot.',
        ephemeral: true
      });
    }

    // Check Voice Channel for all commands except "favorites"
    if (sub !== 'favorites') {
        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) return interaction.reply({ content: '❌ You must be in a voice channel!', ephemeral: true });
    }

    await interaction.deferReply();

    // ── PLAY LOGIC ──────────────────────────────────────────
    if (sub === 'play') {
      const query = interaction.options.getString('query');
      const voiceChannel = interaction.member.voice.channel;

      // 1. Check for User Playlists in memory first
      const userPlaylists = client.memory.get(`playlists_${interaction.user.id}`) || {};
      const targetPlaylist = Object.values(userPlaylists).find(p => p.id === query.toUpperCase() || p.name.toLowerCase() === query.toLowerCase());

      if (targetPlaylist) {
          await interaction.editReply(`📋 Loading your playlist: **${targetPlaylist.name}**...`);
          // DisTube can play custom arrays of URLs
          for (const song of targetPlaylist.songs) {
              await distube.play(voiceChannel, song.url, { member: interaction.member, textChannel: interaction.channel });
          }
          return interaction.editReply(`✅ Queued **${targetPlaylist.songs.length}** songs from your playlist!`);
      }

      // 2. Perform a Search if it's not a direct URL
      if (!query.startsWith('http')) {
        if (typeof distube.search !== 'function') {
          return interaction.editReply('❌ Search is unavailable in this music setup. Please use a direct track URL for now.');
        }

        const results = await distube.search(query, { limit: 5 });
        if (!results?.length) return interaction.editReply('❌ No results found for that search.');
        
        const menu = new StringSelectMenuBuilder()
          .setCustomId('search_select')
          .setPlaceholder('Select the version to play')
          .addOptions(results.map((s, i) => 
            new StringSelectMenuOptionBuilder()
              .setLabel(`${i + 1}. ${s.name.slice(0, 80)}`)
              .setValue(s.url)
              .setDescription(s.formattedDuration)
          ));

        const row = new ActionRowBuilder().addComponents(menu);
        const searchEmbed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('🔍 Search Results')
            .setDescription(`Results for: **${query}**\nSelect an option below to play.`);

        const msg = await interaction.editReply({ embeds: [searchEmbed], components: [row] });

        const collector = msg.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 30000 });

        collector.on('collect', async i => {
          if (i.user.id !== interaction.user.id) return i.reply({ content: 'Not your search!', ephemeral: true });
          await i.deferUpdate();
          await distube.play(voiceChannel, i.values[0], { member: interaction.member, textChannel: interaction.channel });
          await interaction.editReply({ content: `🎶 Selection queued!`, embeds: [], components: [] });
        });

        collector.on('end', () => interaction.editReply({ components: [] }).catch(() => {}));
        return;
      }

      // 3. Direct URL Play
      try {
        await distube.play(voiceChannel, query, { member: interaction.member, textChannel: interaction.channel });
        return interaction.editReply('🔍 Searching for your link...');
      } catch (e) {
        return interaction.editReply(`❌ Error: ${e.message}`);
      }
    }

    // ── QUEUE LOGIC ─────────────────────────────────────────
    if (sub === 'queue') {
      const queue = distube.getQueue(interaction.guild.id);
      if (!queue) return interaction.editReply('📋 The queue is currently empty!');

      const q = queue.songs
        .slice(0, 10)
        .map((song, i) => `${i === 0 ? '▶️' : `**${i}.**`} ${song.name} - \`${song.formattedDuration}\``)
        .join('\n');

      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`Queue for ${interaction.guild.name}`)
        .setDescription(q)
        .setFooter({ text: `${queue.songs.length} songs in queue | Volume: ${queue.volume}%` });

      return interaction.editReply({ embeds: [embed] });
    }

    // ── SKIP ────────────────────────────────────────────────
    if (sub === 'skip') {
      const queue = distube.getQueue(interaction.guild.id);
      if (!queue) return interaction.editReply('❌ Nothing to skip!');
      try {
        await queue.skip();
        return interaction.editReply('⏭️ Skipped!');
      } catch (e) {
        return interaction.editReply('❌ No more songs in queue to skip to!');
      }
    }

    // ── STOP ────────────────────────────────────────────────
    if (sub === 'stop') {
        const queue = distube.getQueue(interaction.guild.id);
        if (!queue) return interaction.editReply('❌ Bot is not playing!');
        queue.stop();
        return interaction.editReply('⏹️ Stopped and cleared the queue.');
    }

    // ── VOLUME ──────────────────────────────────────────────
    if (sub === 'volume') {
        const queue = distube.getQueue(interaction.guild.id);
        const amount = interaction.options.getInteger('amount');
        if (!queue) return interaction.editReply('❌ Nothing playing!');
        queue.setVolume(amount);
        return interaction.editReply(`🔊 Volume set to **${amount}%**`);
    }

    // ── FAVORITES ───────────────────────────────────────────
    if (sub === 'favorites') {
        const favs = client.memory.get(`music_favs_${interaction.user.id}`) || [];
        if (favs.length === 0) return interaction.editReply('⭐ You haven\'t favorited any songs yet!');

        const favList = favs.slice(0, 15).map((s, i) => `**${i+1}.** [${s.title}](${s.url})`).join('\n');
        const embed = new EmbedBuilder()
            .setTitle('⭐ Your Favorites')
            .setColor('#FFD700')
            .setDescription(favList || 'Empty');
        
        return interaction.editReply({ embeds: [embed] });
    }
  }
};
