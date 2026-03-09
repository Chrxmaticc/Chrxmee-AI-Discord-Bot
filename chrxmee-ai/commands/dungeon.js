const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const ROOM_THEMES = [
  "🌲 Enchanted Forest", "🪦 Haunted Crypt", "🏛️ Ancient Ruins", "🔥 Lava Cavern",
  "❄️ Frozen Tundra", "🌊 Sunken Temple", "🏰 Abandoned Throne Room", "🕸️ Spider Nest"
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dungeon')
    .setDescription('Dungeon RPG – safe one-click per room')
    .addSubcommand(sub => sub.setName('start').setDescription('Begin a new run'))
    .addSubcommand(sub => sub.setName('view').setDescription('See current status'))
    .addSubcommand(sub => sub.setName('leave').setDescription('Escape the dungeon'))
    .addSubcommand(sub => sub.setName('reset').setDescription('Force-reset data')),

  async execute(interaction, client) {
    try {
      await interaction.deferReply({ ephemeral: false });
      console.log(`[${new Date().toISOString()}] DUNGEON deferred OK for ${interaction.user.tag}`);
    } catch (err) {
      console.error('Top defer failed:', err);
      return interaction.reply({ content: 'Failed to start.', ephemeral: true }).catch(() => {});
    }

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
      return interaction.editReply('Dungeon reset. No more expired/stuck runs.');
    }

    if (sub === 'leave') {
      data.inDungeon = false;
      client.memory.set(`dungeon_${guildId}_${userId}`, data);
      return interaction.editReply('Left the dungeon.');
    }

    if (sub === 'view') {
      if (!data.inDungeon) return interaction.editReply('Not in dungeon.');
      return interaction.editReply(`Room: ${data.currentRoom} | HP: ${data.hp} | Gold: ${data.gold}`);
    }

    // ==================== START ====================
    if (sub === 'start') {
      if (data.inDungeon) return interaction.editReply({ content: 'Already in run! Use /dungeon leave or reset.', ephemeral: true });

      data.inDungeon = true;
      data.currentRoom = 1;
      data.hp = 100;
      data.gold = 0;

      client.memory.set(`dungeon_${guildId}_${userId}`, data);

      await performRoom(interaction, client, data, guildId, userId);
    }
  }
};

// One room = one safe click → auto next
async function performRoom(interaction, client, data, guildId, userId) {
  const roomTheme = ROOM_THEMES[Math.floor(Math.random() * ROOM_THEMES.length)];

  const embed = new EmbedBuilder()
    .setColor('#2f3136')
    .setTitle(`Room ${data.currentRoom} — ${roomTheme}`)
    .setDescription('Pick **one** action (buttons lock after click):')
    .addFields(
      { name: 'HP', value: `${data.hp}/100`, inline: true },
      { name: 'Gold', value: `${data.gold}`, inline: true }
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('d_fight').setLabel('Fight').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('d_sneak').setLabel('Sneak').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('d_loot').setLabel('Loot').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('d_surrender').setLabel('Surrender').setStyle(ButtonStyle.Secondary)
  );

  let msg;
  try {
    msg = await interaction.editReply({ embeds: [embed], components: [row] });
  } catch (err) {
    console.error('editReply failed:', err);
    return interaction.followUp({ content: 'Room failed to load.', ephemeral: true }).catch(() => {});
  }

  const collector = msg.createMessageComponentCollector({ time: 45000, max: 1 }); // 45s, only 1 click allowed

  collector.on('collect', async btn => {
    console.log(`[${new Date().toISOString()}] Click: ${btn.customId} by ${btn.user.tag}`);

    try {
      await btn.deferUpdate();
      console.log('deferUpdate success');
    } catch (err) {
      if (err.code === 10062) {
        console.log('Click expired before defer (10062) – safe ignore');
        return;
      }
      console.error('deferUpdate error:', err);
      return btn.followUp({ content: 'Click timed out.', ephemeral: true }).catch(() => {});
    }

    let result = '';
    let hpLoss = 0;
    let goldGain = 0;

    if (btn.customId === 'd_fight') {
      hpLoss = Math.floor(Math.random() * 25) + 10;
      goldGain = Math.floor(Math.random() * 60) + 30;
      result = `Fought! -${hpLoss} HP, +${goldGain} gold!`;
    } else if (btn.customId === 'd_sneak') {
      goldGain = Math.floor(Math.random() * 40) + 15;
      result = `Sneaked! +${goldGain} gold.`;
    } else if (btn.customId === 'd_loot') {
      if (Math.random() > 0.6) {
        goldGain = Math.floor(Math.random() * 120) + 50;
        result = `Jackpot! +${goldGain} gold!`;
      } else {
        hpLoss = Math.floor(Math.random() * 45) + 20;
        result = `Trap! -${hpLoss} HP`;
      }
    } else if (btn.customId === 'd_surrender') {
      result = 'Surrendered. Run ended.';
      data.inDungeon = false;
      client.memory.set(`dungeon_${guildId}_${userId}`, data);
      await btn.editReply({ content: result, embeds: [], components: [] });
      return;
    }

    data.hp -= hpLoss;
    data.gold += goldGain;
    data.gold = Math.max(0, data.gold);

    if (data.hp <= 0) {
      result += '\n\n💀 **Died...** Revived at start (50% gold loss)';
      data.hp = 50;
      data.gold = Math.floor(data.gold * 0.5);
      data.currentRoom = 1;
    } else {
      data.currentRoom++;
    }

    client.memory.set(`dungeon_${guildId}_${userId}`, data);

    const newEmbed = new EmbedBuilder()
      .setColor('#2f3136')
      .setTitle(`Room ${data.currentRoom}`)
      .setDescription(result + '\n\nNext room...')
      .addFields(
        { name: 'HP', value: `${data.hp}/100`, inline: true },
        { name: 'Gold', value: `${data.gold}`, inline: true }
      );

    try {
      await btn.editReply({ embeds: [newEmbed], components: [] });
    } catch (err) {
      console.error('editReply after action failed:', err);
    }

    // Auto next room
    setTimeout(() => {
      if (data.inDungeon) {
        performRoom(interaction, client, data, guildId, userId);
      }
    }, 2000);
  });

  collector.on('end', () => {
    const disabledRow = new ActionRowBuilder().addComponents(
      row.components.map(b => ButtonBuilder.from(b).setDisabled(true))
    );
    msg.edit({ components: [disabledRow] }).catch(() => {});
  });
}
