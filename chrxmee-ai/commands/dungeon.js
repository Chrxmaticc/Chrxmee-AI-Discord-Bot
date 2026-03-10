const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const ROOM_THEMES = [
  "🌲 Enchanted Forest", "🪦 Haunted Crypt", "🏛️ Ancient Ruins", "🔥 Lava Cavern",
  "❄️ Frozen Tundra", "🌊 Sunken Temple", "🏰 Abandoned Throne Room", "🕸️ Spider Nest"
];

const MAZE_LAYOUTS = [
  "```\n🟩🟩🟩🟩🟩\n🟩🟡🟩🪙🟩\n🟩🌲👹🟩🟩\n🟩🟩🟩🟩🟩```",
  "```\n🪦🪦🪦🪦🪦\n🪦🟡🪦🪙🪦\n🪦🪦👹🪦🪦\n🪦🪦🪦🪦🪦```",
  "```\n🏛️🏛️🏛️🏛️🏛️\n🏛️🟡🏛️🪙🏛️\n🏛️🗿👹🏛️🏛️\n🏛️🏛️🏛️🏛️🏛️```",
  "```\n🔥🔥🔥🔥🔥\n🔥🟡🔥🪙🔥\n🔥🌋👹🔥🔥\n🔥🔥🔥🔥🔥```",
  "```\n❄️❄️❄️❄️❄️\n❄️🟡❄️🪙❄️\n❄️🧊👹❄️❄️\n❄️❄️❄️❄️❄️```",
  "```\n🌊🌊🌊🌊🌊\n🌊🟡🌊🪙🌊\n🌊🦑👹🌊🌊\n🌊🌊🌊🌊🌊```",
  "```\n👑👑👑👑👑\n👑🟡👑🪙👑\n👑🪑👹👑👑\n👑👑👑👑👑```",
  "```\n🕸️🕸️🕸️🕸️🕸️\n🕸️🟡🕸️🪙🕸️\n🕸️🕷️👹🕸️🕸️\n🕸️🕸️🕸️🕸️🕸️```"
];

function getDieBar(hp) {
  const full = Math.floor(hp / 11);
  return '🎲'.repeat(full) + '⚪'.repeat(9 - full);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dungeon')
    .setDescription('Dungeon RPG – infinite rooms')
    .addSubcommand(sub => sub.setName('start').setDescription('Begin a new run'))
    .addSubcommand(sub => sub.setName('view').setDescription('See current status'))
    .addSubcommand(sub => sub.setName('leave').setDescription('Escape the dungeon'))
    .addSubcommand(sub => sub.setName('reset').setDescription('Force-reset data')),

  async execute(interaction, client) {
    try {
      await interaction.deferReply({ ephemeral: false });
    } catch (err) {
      console.error('Defer failed:', err);
      return interaction.reply({ content: 'Failed to start.', ephemeral: true }).catch(() => {});
    }

    const userId = interaction.user.id;
    const guildId = interaction.guild.id;

    let data = client.memory.get(`dungeon_${guildId}_${userId}`) || {
      inDungeon: false,
      currentRoom: 0,
      hp: 100,
      gold: 0,
      starterId: userId
    };

    if (!data.starterId) data.starterId = userId;

    const sub = interaction.options.getSubcommand();

    if (sub === 'reset') {
      client.memory.delete(`dungeon_${guildId}_${userId}`);
      return interaction.editReply('✅ Dungeon fully reset.');
    }

    if (sub === 'leave') {
      data.inDungeon = false;
      client.memory.set(`dungeon_${guildId}_${userId}`, data);
      return interaction.editReply('🚪 You escaped the dungeon.');
    }

    if (sub === 'view') {
      if (!data.inDungeon) return interaction.editReply('❌ You are not in a dungeon.');
      return interaction.editReply(`📍 Room: **${data.currentRoom}** | ❤️ HP: **${data.hp}** | 🪙 Gold: **${data.gold}**`);
    }

    if (sub === 'start') {
      if (data.inDungeon) {
        return interaction.editReply('⚠️ Already in a run! Use `/dungeon leave` or `/dungeon reset`.');
      }

      data.inDungeon = true;
      data.currentRoom = 1;
      data.hp = 100;
      data.gold = 0;
      data.starterId = userId;

      client.memory.set(`dungeon_${guildId}_${userId}`, data);

      // FIX: Get the message from editReply and pass it into performRoom
      // so all future edits use msg.edit() — no more interaction token conflicts
      const msg = await interaction.editReply({ content: '⚔️ Entering dungeon...' });
      await performRoom(msg, client, data, guildId, userId);
    }
  }
};

// FIX: Accept `msg` instead of `interaction` — msg.edit() is stable across all rooms
async function performRoom(msg, client, data, guildId, userId) {
  const roomTheme = ROOM_THEMES[Math.floor(Math.random() * ROOM_THEMES.length)];
  const mazeIndex = Math.min(data.currentRoom - 1, MAZE_LAYOUTS.length - 1);
  const maze = MAZE_LAYOUTS[mazeIndex];

  const embed = new EmbedBuilder()
    .setColor('#2f3136')
    .setTitle(`Room ${data.currentRoom} — ${roomTheme}`)
    .setDescription(`${maze}\n\nChoose one action:`)
    .addFields(
      { name: 'HP Bar', value: getDieBar(data.hp), inline: false },
      { name: '🪙 Gold', value: `${data.gold}`, inline: true }
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('d_fight').setLabel('⚔️ Fight').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('d_sneak').setLabel('🥷 Sneak').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('d_loot').setLabel('💰 Loot').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('d_surrender').setLabel('🏳️ Surrender').setStyle(ButtonStyle.Secondary)
  );

  // FIX: Use msg.edit() consistently — no more stale interaction reference
  await msg.edit({ embeds: [embed], components: [row] }).catch(err => {
    console.error('msg.edit (room display) failed:', err);
  });

  const collector = msg.createMessageComponentCollector({ time: 45000, max: 1 });

  collector.on('collect', async btn => {
    try {
      await btn.deferUpdate();
    } catch (err) {
      if (err.code === 10062) return; // Expired, silently ignore
      console.error('deferUpdate failed:', err);
      return;
    }

    // Only the starter can interact
    if (btn.user.id !== data.starterId) {
      return btn.followUp({ content: '🔒 This dungeon run belongs to someone else.', ephemeral: true }).catch(() => {});
    }

    let result = '';
    let hpLoss = 0;
    let goldGain = 0;

    if (btn.customId === 'd_fight') {
      hpLoss = 15;
      goldGain = 40;
      result = '⚔️ You fought bravely! **-15 HP**, **+40 gold**';
    } else if (btn.customId === 'd_sneak') {
      goldGain = 25;
      result = '🥷 Sneaked past safely! **+25 gold**';
    } else if (btn.customId === 'd_loot') {
      goldGain = 60;
      result = '💰 Looted the room! **+60 gold**';
    } else if (btn.customId === 'd_surrender') {
      data.inDungeon = false;
      client.memory.set(`dungeon_${guildId}_${userId}`, data);

      const endEmbed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('🏳️ You surrendered.')
        .setDescription(`Final room: **${data.currentRoom}** | Gold kept: **${data.gold}**`);

      await msg.edit({ embeds: [endEmbed], components: [] }).catch(() => {});
      return;
    }

    data.hp -= hpLoss;
    data.gold += goldGain;

    if (data.hp <= 0) {
      result += '\n\n💀 You died! Revived at room 1 with **50% gold penalty**.';
      data.hp = 50;
      data.gold = Math.floor(data.gold * 0.5);
      data.currentRoom = 1;
    } else {
      data.currentRoom++;
    }

    client.memory.set(`dungeon_${guildId}_${userId}`, data);

    const resultEmbed = new EmbedBuilder()
      .setColor('#f0a500')
      .setTitle(`Room result`)
      .setDescription(result + '\n\n*Loading next room...*')
      .addFields(
        { name: 'HP Bar', value: getDieBar(data.hp), inline: false },
        { name: '🪙 Gold', value: `${data.gold}`, inline: true }
      );

    // FIX: Use msg.edit() — buttons removed cleanly, NO end handler conflict
    await msg.edit({ embeds: [resultEmbed], components: [] }).catch(() => {});

    setTimeout(() => {
      if (data.inDungeon) performRoom(msg, client, data, guildId, userId);
    }, 2000);
  });

  // FIX: ONLY disable buttons on TIMEOUT — NOT after a successful click
  // Old code ran this every time, overwriting the result embed right after a click
  collector.on('end', collected => {
    if (collected.size === 0) {
      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('d_fight').setLabel('⚔️ Fight').setStyle(ButtonStyle.Danger).setDisabled(true),
        new ButtonBuilder().setCustomId('d_sneak').setLabel('🥷 Sneak').setStyle(ButtonStyle.Primary).setDisabled(true),
        new ButtonBuilder().setCustomId('d_loot').setLabel('💰 Loot').setStyle(ButtonStyle.Success).setDisabled(true),
        new ButtonBuilder().setCustomId('d_surrender').setLabel('🏳️ Surrender').setStyle(ButtonStyle.Secondary).setDisabled(true)
      );
      msg.edit({ components: [disabledRow] }).catch(() => {});
    }
    // If collected.size > 0, a button was clicked — msg.edit() already handled it, do nothing
  });
