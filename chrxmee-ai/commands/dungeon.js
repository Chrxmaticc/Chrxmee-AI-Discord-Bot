const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require('discord.js');

const ROOM_THEMES = [
  "🌲 Enchanted Forest", "🪦 Haunted Crypt", "🏛️ Ancient Ruins", "🔥 Lava Cavern",
  "❄️ Frozen Tundra", "🌊 Sunken Temple", "🏰 Abandoned Throne Room", "🕸️ Spider Nest"
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dungeon')
    .setDescription('Infinite chaotic dungeon RPG')
    .addSubcommand(sub => sub.setName('start').setDescription('Begin a new run'))
    .addSubcommand(sub => sub.setName('stats').setDescription('Your full profile'))
    .addSubcommand(sub => sub.setName('shop').setDescription('Buy upgrades'))
    .addSubcommand(sub => sub.setName('bank-account').setDescription('Check gold'))
    .addSubcommand(sub => sub.setName('inventory').setDescription('Equipped gear'))
    .addSubcommand(sub => sub.setName('view').setDescription('Current room'))
    .addSubcommand(sub => sub.setName('leave').setDescription('Escape'))
    .addSubcommand(sub => sub.setName('prestige').setDescription('Prestige for power'))
    .addSubcommand(sub => sub.setName('reset').setDescription('Reset your dungeon data'))
    .addSubcommandGroup(group =>
      group.setName('party')
        .setDescription('Manage party / co-op mode')
        .addSubcommand(sub => sub.setName('solo').setDescription('Play solo (default)'))
        .addSubcommand(sub => sub.setName('open').setDescription('Open to everyone in channel'))
        .addSubcommand(sub => sub.setName('invite').setDescription('Invite a specific user').addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true)))
        .addSubcommand(sub => sub.setName('leave').setDescription('Leave current party'))
        .addSubcommand(sub => sub.setName('status').setDescription('View party mode & members')))
    .addSubcommandGroup(group =>
      group.setName('configure')
        .setDescription('Server settings')
        .addSubcommand(sub => sub.setName('allow').setDescription('Enable/disable dungeon'))
        .addSubcommand(sub => sub.setName('channel').setDescription('Set dungeon channel'))
        .addSubcommand(sub => sub.setName('prestige-cosmetic').setDescription('Set prestige role'))),

  async execute(interaction, client) {
    await interaction.deferReply({ ephemeral: false });

    const userId = interaction.user.id;
    const guildId = interaction.guild.id;

    let data = client.memory.get(`dungeon_${guildId}_${userId}`) || {
      prestige: 0,
      level: 1,
      xp: 0,
      gold: 0,
      hp: 100,
      maxHp: 100,
      damage: 10,
      equippedSword: "Wooden Stick",
      equippedArmor: "Cloth Robe",
      prestigeRole: null,
      title: "Newbie",
      inDungeon: false,
      currentRoom: 0,
      totalRoomsCleared: 0,
      partyMode: 'solo', // 'solo', 'open', 'invite'
      party: [userId],
      invited: []
    };

    const sub = interaction.options.getSubcommand();
    const group = interaction.options.getSubcommandGroup();

    // ==================== PARTY MANAGEMENT ====================
    if (group === 'party') {
      if (sub === 'solo') {
        data.partyMode = 'solo';
        data.party = [userId];
        data.invited = [];
        client.memory.set(`dungeon_${guildId}_${userId}`, data);
        return interaction.editReply('Party mode set to **Solo**. Only you can interact with buttons.');
      }

      if (sub === 'open') {
        data.partyMode = 'open';
        data.party = [userId];
        data.invited = [];
        client.memory.set(`dungeon_${guildId}_${userId}`, data);
        return interaction.editReply('Party mode set to **Open**. Everyone in this channel can join and click buttons.');
      }

      if (sub === 'invite') {
        const target = interaction.options.getUser('user');
        if (target.bot || target.id === userId) return interaction.editReply({ content: 'Cannot invite bots or yourself.', ephemeral: true });

        if (!data.invited.includes(target.id)) data.invited.push(target.id);
        data.partyMode = 'invite';
        client.memory.set(`dungeon_${guildId}_${userId}`, data);
        return interaction.editReply(`Invited **${target.username}** to your party. They can now click buttons.`);
      }

      if (sub === 'leave') {
        data.inDungeon = false;
        data.party = [userId];
        data.invited = [];
        data.partyMode = 'solo';
        client.memory.set(`dungeon_${guildId}_${userId}`, data);
        return interaction.editReply('You left the party/dungeon.');
      }

      if (sub === 'status') {
        const modeText = data.partyMode === 'solo' ? 'Solo' :
                         data.partyMode === 'open' ? 'Open to channel' : 'Invite-only';
        const partyList = data.party.map(id => `<@${id}>`).join(', ') || 'None';
        const invitedList = data.invited.map(id => `<@${id}>`).join(', ') || 'None';
        return interaction.editReply(`**Party Status**\nMode: ${modeText}\nParty members: ${partyList}\nInvited: ${invitedList}`);
      }
    }

    // ==================== START ====================
    if (sub === 'start') {
      if (data.inDungeon) return interaction.editReply({ content: 'You are already in a run! Use /dungeon leave or /dungeon reset.', ephemeral: true });

      data.inDungeon = true;
      data.currentRoom = 1;
      data.hp = data.maxHp;
      data.party = [userId];

      client.memory.set(`dungeon_${guildId}_${userId}`, data);

      const roomTheme = ROOM_THEMES[Math.floor(Math.random() * ROOM_THEMES.length)];

      const embed = new EmbedBuilder()
        .setColor('#2f3136')
        .setTitle(`🏰 Room ${data.currentRoom} — ${roomTheme}`)
        .setDescription('Choose your action. Party mode: ' + data.partyMode)
        .addFields(
          { name: '❤️ HP', value: `${data.hp}/${data.maxHp}`, inline: true },
          { name: '⚔️ Damage', value: `${data.damage}`, inline: true },
          { name: '💰 Gold', value: `${data.gold}`, inline: true }
        );

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('d_fight').setLabel('Fight').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('d_sneak').setLabel('Sneak').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('d_loot').setLabel('Loot').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('d_surrender').setLabel('Surrender').setStyle(ButtonStyle.Secondary)
      );

      const msg = await interaction.editReply({ embeds: [embed], components: [row] });

      const collector = msg.createMessageComponentCollector({ time: 900000 });

      collector.on('collect', async btn => {
        await btn.deferUpdate();

        const isInParty = data.party.includes(btn.user.id);
        const isInvited = data.invited.includes(btn.user.id);
        const isOpen = data.partyMode === 'open';
        const isInChannel = btn.channelId === interaction.channelId;

        if (data.partyMode === 'solo' && btn.user.id !== userId) {
          return btn.followUp({ content: 'This run is solo-only.', ephemeral: true });
        }

        if (data.partyMode === 'invite' && !isInParty && !isInvited) {
          return btn.followUp({ content: 'You are not invited to this run.', ephemeral: true });
        }

        if (!isInChannel && !isOpen) {
          return btn.followUp({ content: 'This run is restricted to the starting channel.', ephemeral: true });
        }

        let result = '';
        let hpLoss = 0;
        let goldGain = 0;

        if (btn.customId === 'd_fight') {
          hpLoss = Math.floor(Math.random() * 25) + 10;
          goldGain = Math.floor(Math.random() * 60) + 30;
          result = `You fought a beast! -${hpLoss} HP, +${goldGain} gold!`;
        } else if (btn.customId === 'd_sneak') {
          goldGain = Math.floor(Math.random() * 40) + 15;
          result = `You sneaked past! +${goldGain} gold.`;
        } else if (btn.customId === 'd_loot') {
          if (Math.random() > 0.6) {
            goldGain = Math.floor(Math.random() * 120) + 50;
            result = `Jackpot! +${goldGain} gold!`;
          } else {
            hpLoss = Math.floor(Math.random() * 45) + 20;
            result = `Trap! -${hpLoss} HP`;
          }
        } else if (btn.customId === 'd_surrender') {
          result = 'You fled safely.';
          data.inDungeon = false;
        }

        data.hp -= hpLoss;
        data.gold += goldGain;
        data.gold = Math.max(0, data.gold);

        if (data.hp <= 0) {
          result += '\n\n💀 **You died...** Revived at entrance (50% gold loss)';
          data.hp = Math.floor(data.maxHp * 0.6);
          data.gold = Math.floor(data.gold * 0.5);
          data.currentRoom = 1;
        } else {
          data.currentRoom++;
        }

        data.totalRoomsCleared++;
        client.memory.set(`dungeon_${guildId}_${userId}`, data);

        const newEmbed = new EmbedBuilder()
          .setColor('#2f3136')
          .setTitle(`🏰 Room ${data.currentRoom} — ${ROOM_THEMES[Math.floor(Math.random() * ROOM_THEMES.length)]}`)
          .setDescription(result)
          .addFields(
            { name: '❤️ HP', value: `${data.hp}/${data.maxHp}`, inline: true },
            { name: '⚔️ Damage', value: `${data.damage}`, inline: true },
            { name: '💰 Gold', value: `${data.gold}`, inline: true }
          );

        await btn.editReply({ embeds: [newEmbed], components: [row] });
      });

      collector.on('end', async () => {
        const disabledRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('d_fight').setLabel('Fight').setStyle(ButtonStyle.Danger).setDisabled(true),
          new ButtonBuilder().setCustomId('d_sneak').setLabel('Sneak').setStyle(ButtonStyle.Primary).setDisabled(true),
          new ButtonBuilder().setCustomId('d_loot').setLabel('Loot').setStyle(ButtonStyle.Success).setDisabled(true),
          new ButtonBuilder().setCustomId('d_surrender').setLabel('Surrender').setStyle(ButtonStyle.Secondary).setDisabled(true)
        );

        await msg.edit({ components: [disabledRow] }).catch(() => {});
      });
    }

    // ==================== RESET ====================
    if (sub === 'reset') {
      client.memory.delete(`dungeon_${guildId}_${userId}`);
      return interaction.editReply('Dungeon data reset. Use /dungeon start to begin fresh.');
    }

    // ==================== FALLBACK ====================
    return interaction.editReply({ content: 'This subcommand is coming soon!', ephemeral: true });
  }
};
