const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require('discord.js');

const ROOM_THEMES = [
  "🌲 Enchanted Forest", "🪦 Haunted Crypt", "🏛️ Ancient Ruins", "🔥 Lava Cavern",
  "❄️ Frozen Tundra", "🌊 Sunken Temple", "🏰 Abandoned Throne Room", "🕸️ Spider Nest"
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dungeon')
    .setDescription('Dungeon RPG – one action per room, no spam clicks')
    .addSubcommand(sub => sub.setName('start').setDescription('Begin a new run'))
    .addSubcommand(sub => sub.setName('view').setDescription('See current status'))
    .addSubcommand(sub => sub.setName('leave').setDescription('Escape the dungeon'))
    .addSubcommand(sub => sub.setName('reset').setDescription('Force-reset your dungeon data')),

  async execute(interaction, client) {
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
      gold: 0
    };

    const sub = interaction.options.getSubcommand();

    if (sub === 'reset') {
      client.memory.delete(`dungeon_${guildId}_${userId}`);
      return interaction.editReply('Dungeon data reset. Start fresh with /dungeon start.');
    }

    if (sub === 'leave') {
      data.inDungeon = false;
      client.memory.set(`dungeon_${guildId}_${userId}`, data);
      return interaction.editReply('You left the dungeon.');
    }

    if (sub === 'view') {
      if (!data.inDungeon) return interaction.editReply('Not in a dungeon.');
      return interaction.editReply(`Room: ${data.currentRoom} | HP: ${data.hp} | Gold: ${data.gold}`);
    }

    // ==================== START ====================
    if (sub === 'start') {
      if (data.inDungeon) return interaction.editReply({ content: 'Already in a run! Use /dungeon leave or /dungeon reset.', ephemeral: true });

      data.inDungeon = true;
      data.currentRoom = 1;
      data.hp = 100;
      data.gold = 0;

      client.memory.set(`dungeon_${guildId}_${userId}`, data);

      await performRoomAction(interaction, client, data, guildId, userId);
    }
  }
};

// Helper function – handles one room at a time
async function performRoomAction(interaction, client, data, guildId, userId) {
  const roomTheme = ROOM_THEMES[Math.floor(Math.random() * ROOM_THEMES.length)];

  const embed = new EmbedBuilder()
    .setColor('#2f3136')
    .setTitle(`🏰 Room ${data.currentRoom} — ${roomTheme}`)
    .setDescription('Choose **one** action (buttons disable after choice):')
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

  const collector = msg.createMessageComponentCollector({ time: 60000, max: 1 }); // 60 sec, only 1 click allowed

  collector.on('collect', async btn => {
    try {
      await btn.deferUpdate();
    } catch (err) {
      if (err.code === 10062) return console.log('Expired click ignored');
      console.error('deferUpdate failed:', err);
      return btn.followUp({ content: 'Action expired.', ephemeral: true }).catch(() => {});
    }

    let result = '';
    let hpLoss = 0;
    let goldGain = 0;

    if (btn.customId === 'd_fight') {
      hpLoss = Math.floor(Math.random() * 25) + 10;
      goldGain = Math.floor(Math.random() * 60) + 30;
      result = `You fought... -${hpLoss} HP, +${goldGain} gold!`;
    } else if (btn.customId === 'd_sneak') {
      goldGain = Math.floor(Math.random() * 40) + 15;
      result = `Sneaked safely! +${goldGain} gold.`;
    } else if (btn.customId === 'd_loot') {
      if (Math.random() > 0.6) {
        goldGain = Math.floor(Math.random() * 120) + 50;
        result = `Jackpot! +${goldGain} gold!`;
      } else {
        hpLoss = Math.floor(Math.random() * 45) + 20;
        result = `Trap! -${hpLoss} HP`;
      }
    } else if (btn.customId === 'd_surrender') {
      result = 'You surrendered and left.';
      data.inDungeon = false;
      client.memory.set(`dungeon_${guildId}_${userId}`, data);
      await btn.editReply({ content: result, embeds: [], components: [] });
      return;
    }

    data.hp -= hpLoss;
    data.gold += goldGain;
    data.gold = Math.max(0, data.gold);

    if (data.hp <= 0) {
      result += '\n\n💀 **You died...** Revived at entrance (50% gold loss)';
      data.hp = 50;
      data.gold = Math.floor(data.gold * 0.5);
      data.currentRoom = 1;
    } else {
      data.currentRoom++;
    }

    client.memory.set(`dungeon_${guildId}_${userId}`, data);

    const newEmbed = new EmbedBuilder()
      .setColor('#2f3136')
      .setTitle(`Room ${data.currentRoom} — ${ROOM_THEMES[Math.floor(Math.random() * ROOM_THEMES.length)]}`)
      .setDescription(result + '\n\nNext room loading...')
      .addFields(
        { name: '❤️ HP', value: `${data.hp}/100`, inline: true },
        { name: '💰 Gold', value: `${data.gold}`, inline: true }
      );

    await btn.editReply({ embeds: [newEmbed], components: [] });

    // Auto-move to next room after 3 seconds
    setTimeout(() => {
      if (data.inDungeon) performRoomAction(interaction, client, data, guildId, userId);
    }, 3000);
  });

  collector.on('end', async () => {
    const disabledRow = new ActionRowBuilder().addComponents(
      row.components.map(b => ButtonBuilder.from(b).setDisabled(true))
    );
    await msg.edit({ components: [disabledRow] }).catch(() => {});
  });
}
