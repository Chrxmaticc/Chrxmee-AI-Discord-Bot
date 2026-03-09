const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require('discord.js');

const ROOM_THEMES = [
  "🌲 Enchanted Forest", "🪦 Haunted Crypt", "🏛️ Ancient Ruins", "🔥 Lava Cavern",
  "❄️ Frozen Tundra", "🌊 Sunken Temple", "🏰 Abandoned Throne Room", "🕸️ Spider Nest"
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dungeon')
    .setDescription('Infinite dungeon RPG – fixed "not for you" & expired issues')
    .addSubcommand(sub => sub.setName('start').setDescription('Begin a new run'))
    .addSubcommand(sub => sub.setName('view').setDescription('See current status'))
    .addSubcommand(sub => sub.setName('leave').setDescription('Escape the dungeon'))
    .addSubcommand(sub => sub.setName('reset').setDescription('Force-reset your dungeon data'))
    .addSubcommandGroup(group =>
      group.setName('party')
        .setDescription('Party options')
        .addSubcommand(sub => sub.setName('solo').setDescription('Play solo (default)'))
        .addSubcommand(sub => sub.setName('open').setDescription('Open to channel'))
        .addSubcommand(sub => sub.setName('invite').setDescription('Invite user').addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true))))
    .addSubcommandGroup(group =>
      group.setName('configure')
        .setDescription('Server config (mods only)')
        .addSubcommand(sub => sub.setName('allow').setDescription('Enable/disable dungeon'))),

  async execute(interaction, client) {
    // Defer right away — no more expired before response
    try {
      await interaction.deferReply({ ephemeral: false });
    } catch (err) {
      console.error('Defer failed:', err);
      return interaction.reply({ content: 'Failed to start – try again.', ephemeral: true }).catch(() => {});
    }

    console.log(`[${new Date().toISOString()}] DUNGEON started by ${interaction.user.tag} | sub: ${interaction.options.getSubcommand() || 'unknown'}`);

    const userId = interaction.user.id;
    const guildId = interaction.guild.id;

    let data = client.memory.get(`dungeon_${guildId}_${userId}`) || {
      inDungeon: false,
      currentRoom: 0,
      hp: 100,
      gold: 0,
      partyMode: 'solo',
      party: [userId]
    };

    const sub = interaction.options.getSubcommand();
    const group = interaction.options.getSubcommandGroup();

    // ==================== RESET ====================
    if (sub === 'reset') {
      client.memory.delete(`dungeon_${guildId}_${userId}`);
      return interaction.editReply('Dungeon data fully reset. Use /dungeon start to begin fresh.');
    }

    // ==================== PARTY OPTIONS ====================
    if (group === 'party') {
      if (sub === 'solo') {
        data.partyMode = 'solo';
        data.party = [userId];
        client.memory.set(`dungeon_${guildId}_${userId}`, data);
        return interaction.editReply('Party mode: **Solo** (only you can click).');
      }

      if (sub === 'open') {
        data.partyMode = 'open';
        client.memory.set(`dungeon_${guildId}_${userId}`, data);
        return interaction.editReply('Party mode: **Open** (everyone in channel can click).');
      }

      if (sub === 'invite') {
        const target = interaction.options.getUser('user');
        if (target.bot || target.id === userId) return interaction.editReply({ content: 'Cannot invite bots or yourself.', ephemeral: true });

        if (!data.party.includes(target.id)) data.party.push(target.id);
        data.partyMode = 'invite';
        client.memory.set(`dungeon_${guildId}_${userId}`, data);
        return interaction.editReply(`Invited **${target.username}**.`);
      }
    }

    // ==================== START ====================
    if (sub === 'start') {
      if (data.inDungeon) return interaction.editReply({ content: 'Already in a run! Use /dungeon leave or /dungeon reset.', ephemeral: true });

      data.inDungeon = true;
      data.currentRoom = 1;
      data.hp = 100;
      data.gold = 0;
      data.party = [userId];

      client.memory.set(`dungeon_${guildId}_${userId}`, data);

      const roomTheme = ROOM_THEMES[Math.floor(Math.random() * ROOM_THEMES.length)];

      const embed = new EmbedBuilder()
        .setColor('#2f3136')
        .setTitle(`🏰 Room ${data.currentRoom} — ${roomTheme}`)
        .setDescription('Choose your action:')
        .addFields(
          { name: '❤️ HP', value: `${data.hp}/100`, inline: true },
          { name: '💰 Gold', value: `${data.gold}`, inline: true }
        );

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('d_fight').setLabel('Fight').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('d_sneak').setLabel('Sneak').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('d_loot').setLabel('Loot').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('d_surrender').setLabel('Surrender').setStyle(ButtonStyle.Secondary)
      );

      const msg = await interaction.editReply({ embeds: [embed], components: [row] });

      const collector = msg.createMessageComponentCollector({ time: 300000 });

      collector.on('collect', async btn => {
        try {
          await btn.deferUpdate();
        } catch (err) {
          if (err.code === 10062) {
            console.log('Button expired (10062) – ignoring');
            return;
          }
          console.error('deferUpdate failed:', err);
          return btn.followUp({ content: 'Button expired.', ephemeral: true }).catch(() => {});
        }

        // Permission check – very lenient by default
        const isAllowed = data.party.includes(btn.user.id) ||
                         data.partyMode === 'open' ||
                         data.partyMode === 'solo' && btn.user.id === userId;

        if (!isAllowed) {
          return btn.followUp({ content: 'This run is not open to you.', ephemeral: true });
        }

        let result = '';
        if (btn.customId === 'd_fight') result = 'You fought... won 20 gold!';
        if (btn.customId === 'd_sneak') result = 'Sneaked safely.';
        if (btn.customId === 'd_loot') result = 'Looted 30 gold!';
        if (btn.customId === 'd_surrender') {
          result = 'You surrendered and left.';
          data.inDungeon = false;
        }

        data.gold += 20;
        client.memory.set(`dungeon_${guildId}_${userId}`, data);

        const updatedEmbed = new EmbedBuilder()
          .setColor('#2f3136')
          .setTitle(`🏰 Room ${data.currentRoom}`)
          .setDescription(result)
          .addFields({ name: 'Gold', value: `${data.gold}` });

        await btn.editReply({ embeds: [updatedEmbed], components: [row] }).catch(err => {
          console.error('editReply failed:', err);
        });
      });

      collector.on('end', async () => {
        try {
          const disabledRow = new ActionRowBuilder().addComponents(
            row.components.map(b => ButtonBuilder.from(b).setDisabled(true))
          );
          await msg.edit({ components: [disabledRow] }).catch(() => {});
        } catch (err) {
          console.error('Collector cleanup failed:', err);
        }
      });
    }

    // ==================== VIEW / LEAVE ====================
    if (sub === 'view') {
      if (!data.inDungeon) return interaction.editReply('Not in a dungeon.');
      return interaction.editReply(`Room: ${data.currentRoom} | HP: ${data.hp} | Gold: ${data.gold}`);
    }

    if (sub === 'leave') {
      data.inDungeon = false;
      client.memory.set(`dungeon_${guildId}_${userId}`, data);
      return interaction.editReply('You left the dungeon.');
    }

    return interaction.editReply({ content: 'Coming soon!', ephemeral: true });
  }
};
