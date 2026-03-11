const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const ROOM_THEMES = [
  "🌲 Enchanted Forest", "🪦 Haunted Crypt", "🏛️ Ancient Ruins", "🔥 Lava Cavern",
  "❄️ Frozen Tundra", "🌊 Sunken Temple", "🏰 Abandoned Throne Room", "🕸️ Spider Nest"
];

const MAZE_LAYOUTS = [
  "```ansi\n🟩🟩🟩🟩🟩\n🟩🟡🟩🪙🟩\n🟩🌲👹🟩🟩\n🟩🟩🟩🟩🟩```",
  "```ansi\n🪦🪦🪦🪦🪦\n🪦🟡🪦🪙🪦\n🪦🪦👹🪦🪦\n🪦🪦🪦🪦🪦```",
  "```ansi\n🏛️🏛️🏛️🏛️🏛️\n🏛️🟡🏛️🪙🏛️\n🏛️🗿👹🏛️🏛️\n🏛️🏛️🏛️🏛️🏛️```",
  "```ansi\n🔥🔥🔥🔥🔥\n🔥🟡🔥🪙🔥\n🔥🌋👹🔥🔥\n🔥🔥🔥🔥🔥```",
  "```ansi\n❄️❄️❄️❄️❄️\n❄️🟡❄️🪙❄️\n❄️🧊👹❄️❄️\n❄️❄️❄️❄️❄️```",
  "```ansi\n🌊🌊🌊🌊🌊\n🌊🟡🌊🪙🌊\n🌊🦑👹🌊🌊\n🌊🌊🌊🌊🌊```",
  "```ansi\n👑👑👑👑👑\n👑🟡👑🪙👑\n👑🪑👹👑👑\n👑👑👑👑👑```",
  "```ansi\n🕸️🕸️🕸️🕸️🕸️\n🕸️🟡🕸️🪙🕸️\n🕸️🕷️👹🕸️🕸️\n🕸️🕸️🕸️🕸️🕸️```"
];

const ARMOR_SHOP = [
  { id: 'leather', name: '🟤 Leather Armor', cost: 50,  hpBonus: 1, desc: '+1 HP protection per fight' },
  { id: 'iron',    name: '⚙️ Iron Armor',    cost: 150, hpBonus: 2, desc: '+2 HP protection per fight' },
  { id: 'gold',    name: '🟡 Gold Armor',    cost: 300, hpBonus: 3, desc: '+3 HP protection per fight' },
  { id: 'diamond', name: '💎 Diamond Armor', cost: 500, hpBonus: 4, desc: '+4 HP protection per fight' },
];

function getDieBar(hp) {
  const full = Math.floor(hp / 11);
  return '🎲'.repeat(full) + '⚪'.repeat(9 - full);
}

function getDefaultData(userId) {
  return {
    inDungeon: false,
    currentRoom: 0,
    hp: 100,
    gold: 0,
    starterId: userId,
    inventory: [],
    equippedArmor: null,
    farthestRoom: 0,
    totalGoldEarned: 0
  };
}

// Save/update stats to Postgres
async function saveStats(pool, userId, guildId, username, farthestRoom, totalGoldEarned) {
  if (!pool) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS dungeon_stats (
        user_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        username TEXT,
        farthest_room INT DEFAULT 0,
        total_gold_earned INT DEFAULT 0,
        PRIMARY KEY (user_id, guild_id)
      )
    `);
    await pool.query(`
      INSERT INTO dungeon_stats (user_id, guild_id, username, farthest_room, total_gold_earned)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id, guild_id) DO UPDATE SET
        username = EXCLUDED.username,
        farthest_room = GREATEST(dungeon_stats.farthest_room, EXCLUDED.farthest_room),
        total_gold_earned = GREATEST(dungeon_stats.total_gold_earned, EXCLUDED.total_gold_earned)
    `, [userId, guildId, username, farthestRoom, totalGoldEarned]);
  } catch (err) {
    console.error('dungeon saveStats failed:', err.message);
  }
}

// Build leaderboard embed
async function buildLeaderboardEmbed(pool, guildId, scope, metric) {
  const isGlobal = scope === 'global';
  const isGold = metric === 'gold';

  const title = `${isGlobal ? '🌍 Global' : '🏠 Local'} Leaderboard — ${isGold ? '🪙 Most Gold' : '🗺️ Farthest Room'}`;
  const orderCol = isGold ? 'total_gold_earned' : 'farthest_room';

  let rows = [];
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS dungeon_stats (
        user_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        username TEXT,
        farthest_room INT DEFAULT 0,
        total_gold_earned INT DEFAULT 0,
        PRIMARY KEY (user_id, guild_id)
      )
    `);

    let query, params;
    if (isGlobal) {
      query = `
        SELECT username, MAX(farthest_room) AS farthest_room, MAX(total_gold_earned) AS total_gold_earned
        FROM dungeon_stats
        GROUP BY username
        ORDER BY MAX(${orderCol}) DESC
        LIMIT 10
      `;
      params = [];
    } else {
      query = `
        SELECT username, farthest_room, total_gold_earned
        FROM dungeon_stats
        WHERE guild_id = $1
        ORDER BY ${orderCol} DESC
        LIMIT 10
      `;
      params = [guildId];
    }

    const result = await pool.query(query, params);
    rows = result.rows;
  } catch (err) {
    console.error('leaderboard query failed:', err.message);
  }

  const medals = ['🥇', '🥈', '🥉'];
  const lines = rows.length === 0
    ? ['No entries yet! Start a run to appear here.']
    : rows.map((r, i) => {
        const rank = medals[i] || `**#${i + 1}**`;
        const value = isGold ? `🪙 ${r.total_gold_earned}g` : `🗺️ Room ${r.farthest_room}`;
        return `${rank} **${r.username}** — ${value}`;
      });

  return new EmbedBuilder()
    .setColor('#2f3136')
    .setTitle(title)
    .setDescription(lines.join('\n'));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dungeon')
    .setDescription('Dungeon RPG – infinite rooms')
    .addSubcommand(sub => sub.setName('start').setDescription('Begin a new run'))
    .addSubcommand(sub => sub.setName('view').setDescription('See current status'))
    .addSubcommand(sub => sub.setName('leave').setDescription('Escape the dungeon'))
    .addSubcommand(sub => sub.setName('reset').setDescription('Force-reset data'))
    .addSubcommand(sub => sub.setName('inventory').setDescription('Check your dungeon inventory'))
    .addSubcommand(sub => sub.setName('shop').setDescription('Buy armor from the dungeon shop'))
    .addSubcommand(sub =>
      sub.setName('equip')
        .setDescription('Equip an armor from your inventory')
        .addStringOption(opt =>
          opt.setName('armor')
            .setDescription('Which armor to equip')
            .setRequired(true)
            .addChoices(
              { name: '🟤 Leather Armor', value: 'leather' },
              { name: '⚙️ Iron Armor',    value: 'iron'    },
              { name: '🟡 Gold Armor',    value: 'gold'    },
              { name: '💎 Diamond Armor', value: 'diamond' }
            )
        )
    )
    .addSubcommand(sub => sub.setName('leaderboard').setDescription('View the dungeon leaderboard')),

  async execute(interaction, client) {
    try {
      await interaction.deferReply({ ephemeral: false });
    } catch (err) {
      console.error('Defer failed:', err);
      return interaction.reply({ content: 'Failed to start.', ephemeral: true }).catch(() => {});
    }

    const userId = interaction.user.id;
    const guildId = interaction.guild.id;
    const username = interaction.user.username;

    let data = client.memory.get(`dungeon_${guildId}_${userId}`) || getDefaultData(userId);

    // Migrate old saves
    if (!data.inventory) data.inventory = [];
    if (!('equippedArmor' in data)) data.equippedArmor = null;
    if (!data.starterId) data.starterId = userId;
    if (!data.farthestRoom) data.farthestRoom = 0;
    if (!data.totalGoldEarned) data.totalGoldEarned = 0;

    const sub = interaction.options.getSubcommand();

    // ── RESET ──────────────────────────────────────────────
    if (sub === 'reset') {
      client.memory.delete(`dungeon_${guildId}_${userId}`);
      return interaction.editReply('✅ Dungeon fully reset.');
    }

    // ── LEAVE ──────────────────────────────────────────────
    if (sub === 'leave') {
      data.inDungeon = false;
      client.memory.set(`dungeon_${guildId}_${userId}`, data);
      return interaction.editReply('🚪 You escaped the dungeon.');
    }

    // ── VIEW ───────────────────────────────────────────────
    if (sub === 'view') {
      if (!data.inDungeon) return interaction.editReply('❌ You are not in a dungeon.');
      const armor = ARMOR_SHOP.find(a => a.id === data.equippedArmor);
      return interaction.editReply(
        `📍 Room: **${data.currentRoom}** | ❤️ HP: **${data.hp}** | 🪙 Gold: **${data.gold}**\n` +
        `🛡️ Armor: **${armor ? armor.name : 'None'}** | 🏆 Farthest: **Room ${data.farthestRoom}**`
      );
    }

    // ── INVENTORY ──────────────────────────────────────────
    if (sub === 'inventory') {
      if (data.inventory.length === 0) {
        return interaction.editReply('🎒 Your inventory is empty! Visit `/dungeon shop` to buy armor.');
      }
      const lines = data.inventory.map(id => {
        const a = ARMOR_SHOP.find(x => x.id === id);
        return `${a.name} — ${a.desc}${data.equippedArmor === id ? ' ✅ **Equipped**' : ''}`;
      });
      const embed = new EmbedBuilder()
        .setColor('#2f3136')
        .setTitle('🎒 Your Dungeon Inventory')
        .setDescription(lines.join('\n'))
        .addFields(
          { name: '🪙 Gold', value: `${data.gold}`, inline: true },
          { name: '🏆 Farthest Room', value: `${data.farthestRoom}`, inline: true }
        );
      return interaction.editReply({ embeds: [embed] });
    }

    // ── SHOP ───────────────────────────────────────────────
    if (sub === 'shop') {
      const lines = ARMOR_SHOP.map(a => {
        const owned = data.inventory.includes(a.id);
        return `${a.name} — **${a.cost}g** — ${a.desc}${owned ? ' ✅ Owned' : ''}`;
      });

      const buttons = ARMOR_SHOP.map(a => {
        const owned = data.inventory.includes(a.id);
        return new ButtonBuilder()
          .setCustomId(`shop_buy_${a.id}`)
          .setLabel(owned ? `${a.name.split(' ').slice(1).join(' ')} (Owned)` : `Buy ${a.name.split(' ').slice(1).join(' ')}`)
          .setStyle(owned ? ButtonStyle.Secondary : ButtonStyle.Primary)
          .setDisabled(owned);
      });

      const row = new ActionRowBuilder().addComponents(buttons);
      const embed = new EmbedBuilder()
        .setColor('#f0a500')
        .setTitle('🏪 Dungeon Shop')
        .setDescription(lines.join('\n'))
        .addFields({ name: '🪙 Your Gold', value: `${data.gold}`, inline: true })
        .setFooter({ text: 'Click a button to buy. Use /dungeon equip to equip armor.' });

      await interaction.editReply({ embeds: [embed], components: [row] });
      const shopMsg = await interaction.fetchReply();
      const collector = shopMsg.createMessageComponentCollector({ time: 30000 });

      collector.on('collect', async btn => {
        // FIX: deferUpdate first to stop "interaction failed" spam
        try { await btn.deferUpdate(); } catch (e) { return; }

        if (btn.user.id !== userId) {
          return btn.followUp({ content: '🔒 This shop session belongs to someone else.', ephemeral: true }).catch(() => {});
        }

        const armorId = btn.customId.replace('shop_buy_', '');
        const armor = ARMOR_SHOP.find(a => a.id === armorId);
        if (!armor) return;

        data = client.memory.get(`dungeon_${guildId}_${userId}`) || data;

        if (data.inventory.includes(armorId)) {
          return btn.followUp({ content: '❌ You already own this armor!', ephemeral: true }).catch(() => {});
        }
        if (data.gold < armor.cost) {
          return btn.followUp({ content: `❌ Not enough gold! Need **${armor.cost}g**, you have **${data.gold}g**.`, ephemeral: true }).catch(() => {});
        }

        data.gold -= armor.cost;
        data.inventory.push(armorId);
        client.memory.set(`dungeon_${guildId}_${userId}`, data);

        await btn.followUp({
          content: `✅ Purchased **${armor.name}**! Use \`/dungeon equip\` to equip it.\n🪙 Gold remaining: **${data.gold}**`,
          ephemeral: true
        }).catch(() => {});
      });

      collector.on('end', () => {
        shopMsg.edit({ components: [] }).catch(() => {});
      });

      return;
    }

    // ── EQUIP ──────────────────────────────────────────────
    if (sub === 'equip') {
      const armorId = interaction.options.getString('armor');
      if (!data.inventory.includes(armorId)) {
        return interaction.editReply(`❌ You don't own that armor! Visit \`/dungeon shop\` to buy it.`);
      }
      data.equippedArmor = armorId;
      client.memory.set(`dungeon_${guildId}_${userId}`, data);
      const armor = ARMOR_SHOP.find(a => a.id === armorId);
      return interaction.editReply(`✅ Equipped **${armor.name}**! ${armor.desc}.`);
    }

    // ── LEADERBOARD ────────────────────────────────────────
    if (sub === 'leaderboard') {
      if (!client.pool) return interaction.editReply('❌ Database not available.');

      let scope = 'local';
      let metric = 'room';

      const buildRow = (currentScope, currentMetric) => new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('lb_local').setLabel('🏠 Local').setStyle(currentScope === 'local' ? ButtonStyle.Primary : ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('lb_global').setLabel('🌍 Global').setStyle(currentScope === 'global' ? ButtonStyle.Primary : ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('lb_room').setLabel('🗺️ Farthest Room').setStyle(currentMetric === 'room' ? ButtonStyle.Success : ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('lb_gold').setLabel('🪙 Most Gold').setStyle(currentMetric === 'gold' ? ButtonStyle.Success : ButtonStyle.Secondary)
      );

      const embed = await buildLeaderboardEmbed(client.pool, guildId, scope, metric);
      await interaction.editReply({ embeds: [embed], components: [buildRow(scope, metric)] });
      const lbMsg = await interaction.fetchReply();

      const collector = lbMsg.createMessageComponentCollector({ time: 60000 });

      collector.on('collect', async btn => {
        try { await btn.deferUpdate(); } catch (e) { return; }

        if (btn.customId === 'lb_local') scope = 'local';
        else if (btn.customId === 'lb_global') scope = 'global';
        else if (btn.customId === 'lb_room') metric = 'room';
        else if (btn.customId === 'lb_gold') metric = 'gold';

        const newEmbed = await buildLeaderboardEmbed(client.pool, guildId, scope, metric);
        await lbMsg.edit({ embeds: [newEmbed], components: [buildRow(scope, metric)] }).catch(() => {});
      });

      collector.on('end', () => {
        lbMsg.edit({ components: [] }).catch(() => {});
      });

      return;
    }

    // ── START ──────────────────────────────────────────────
    if (sub === 'start') {
      if (data.inDungeon) return interaction.editReply('⚠️ Already in a run! Use `/dungeon leave` or `/dungeon reset`.');

      data.inDungeon = true;
      data.currentRoom = 1;
      data.hp = 100;
      data.starterId = userId;
      // Gold, inventory, farthestRoom, totalGoldEarned persist between runs

      client.memory.set(`dungeon_${guildId}_${userId}`, data);

      await interaction.editReply({ content: '⚔️ Entering dungeon...' });
      const msg = await interaction.fetchReply();
      await performRoom(msg, client, data, guildId, userId, username);
    }
  }
};

async function performRoom(msg, client, data, guildId, userId, username) {
  const roomTheme = ROOM_THEMES[Math.floor(Math.random() * ROOM_THEMES.length)];
  const mazeIndex = Math.min(data.currentRoom - 1, MAZE_LAYOUTS.length - 1);
  const maze = MAZE_LAYOUTS[mazeIndex];
  const armor = ARMOR_SHOP.find(a => a.id === data.equippedArmor);

  const embed = new EmbedBuilder()
    .setColor('#2f3136')
    .setTitle(`Room ${data.currentRoom} — ${roomTheme}`)
    .setDescription(`Maze:\n${maze}\n\nChoose one action (buttons lock after click):`)
    .addFields(
      { name: 'HP Bar', value: getDieBar(data.hp), inline: false },
      { name: '❤️ HP', value: `${data.hp}`, inline: true },
      { name: '🪙 Gold', value: `${data.gold}`, inline: true },
      { name: '🛡️ Armor', value: armor ? armor.name : 'None', inline: true }
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('d_fight').setLabel('Fight').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('d_sneak').setLabel('Sneak').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('d_loot').setLabel('Loot').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('d_surrender').setLabel('Surrender').setStyle(ButtonStyle.Secondary)
  );

  try {
    await msg.edit({ embeds: [embed], components: [row] });
  } catch (err) {
    console.error('msg.edit failed:', err);
    return;
  }

  const collector = msg.createMessageComponentCollector({ time: 45000, max: 1 });

  collector.on('collect', async btn => {
    // FIX: deferUpdate immediately — stops "interaction failed" errors
    try { await btn.deferUpdate(); } catch (e) { return; }

    if (btn.user.id !== data.starterId) {
      return btn.followUp({ content: '🔒 This run is currently solo / invite-only.', ephemeral: true }).catch(() => {});
    }

    const equippedArmor = ARMOR_SHOP.find(a => a.id === data.equippedArmor);
    const armorBonus = equippedArmor ? equippedArmor.hpBonus : 0;
    let result = '';
    let hpLoss = 0;
    let goldGain = 0;

    if (btn.customId === 'd_fight') {
      hpLoss = Math.max(0, 15 - armorBonus);
      goldGain = 40;
      result = `⚔️ You fought to keep yourself alive!\nEarned **${goldGain} gold**${armorBonus > 0 ? ` | 🛡️ Armor blocked **${armorBonus} damage**` : ''}.`;
    } else if (btn.customId === 'd_sneak') {
      goldGain = 25;
      result = `🥷 You snuck past the enemies without a scratch!\nEarned **${goldGain} gold**.`;
    } else if (btn.customId === 'd_loot') {
      goldGain = 60;
      result = `💰 You looted the room clean!\nEarned **${goldGain} gold**.`;
    } else if (btn.customId === 'd_surrender') {
      data.inDungeon = false;
      client.memory.set(`dungeon_${guildId}_${userId}`, data);

      await saveStats(client.pool, userId, guildId, username, data.farthestRoom, data.totalGoldEarned);

      await btn.followUp({
        embeds: [
          new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('🏳️ You surrendered.')
            .setDescription(`You gave up on room **${data.currentRoom}**.`)
            .addFields(
              { name: '🪙 Gold Kept', value: `${data.gold}`, inline: true },
              { name: '❤️ HP Left', value: `${data.hp}`, inline: true },
              { name: '🏆 Farthest Room Ever', value: `${data.farthestRoom}`, inline: true }
            )
        ],
        ephemeral: true
      }).catch(() => {});

      await msg.edit({
        embeds: [
          new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('Run Over')
            .setDescription(`<@${userId}> surrendered on room **${data.currentRoom}**.`)
        ],
        components: []
      }).catch(() => {});
      return;
    }

    data.hp -= hpLoss;
    data.gold += goldGain;
    data.gold = Math.max(0, data.gold);
    data.totalGoldEarned = Math.max(data.totalGoldEarned, data.gold);

    // Track farthest room
    if (data.currentRoom > data.farthestRoom) {
      data.farthestRoom = data.currentRoom;
    }

    let died = false;
    if (data.hp <= 0) {
      died = true;

      // Save stats on death
      await saveStats(client.pool, userId, guildId, username, data.farthestRoom, data.totalGoldEarned);

      // Ephemeral death message
      await btn.followUp({
        embeds: [
          new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('💀 You Died!')
            .setDescription(
              `You were defeated on room **${data.currentRoom}**.\n\n` +
              `You earned **${goldGain} gold** before dying.\n` +
              `Your farthest room this run: **Room ${data.farthestRoom}**`
            )
            .addFields(
              { name: '🪙 Gold After Penalty', value: `${Math.floor(data.gold * 0.5)}`, inline: true },
              { name: '🏆 Farthest Room Ever', value: `${data.farthestRoom}`, inline: true }
            )
        ],
        ephemeral: true
      }).catch(() => {});

      // Disable buttons on the public message
      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('d_fight').setLabel('Fight').setStyle(ButtonStyle.Danger).setDisabled(true),
        new ButtonBuilder().setCustomId('d_sneak').setLabel('Sneak').setStyle(ButtonStyle.Primary).setDisabled(true),
        new ButtonBuilder().setCustomId('d_loot').setLabel('Loot').setStyle(ButtonStyle.Success).setDisabled(true),
        new ButtonBuilder().setCustomId('d_surrender').setLabel('Surrender').setStyle(ButtonStyle.Secondary).setDisabled(true)
      );

      await msg.edit({
        embeds: [
          new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle(`💀 ${username} died on Room ${data.currentRoom}!`)
            .setDescription('Reviving... 50% gold penalty applied.')
            .addFields({ name: 'HP Bar', value: getDieBar(0), inline: false })
        ],
        components: [disabledRow]
      }).catch(() => {});

      data.hp = 50;
      data.gold = Math.floor(data.gold * 0.5);
      data.currentRoom = 1;

    } else {
      data.currentRoom++;

      // Ephemeral result for survive actions
      await btn.followUp({
        embeds: [
          new EmbedBuilder()
            .setColor('#f0a500')
            .setTitle('Room Result')
            .setDescription(result)
            .addFields(
              { name: 'HP Bar', value: getDieBar(data.hp), inline: false },
              { name: '❤️ HP Remaining', value: `${data.hp}`, inline: true },
              { name: '🪙 Gold', value: `${data.gold}`, inline: true },
              { name: '🛡️ Armor', value: equippedArmor ? equippedArmor.name : 'None', inline: true }
            )
        ],
        ephemeral: true
      }).catch(() => {});
    }

    client.memory.set(`dungeon_${guildId}_${userId}`, data);

    setTimeout(() => {
      if (data.inDungeon) performRoom(msg, client, data, guildId, userId, username);
    }, died ? 4000 : 2000);
  });

  collector.on('end', collected => {
    if (collected.size === 0) {
      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('d_fight').setLabel('Fight').setStyle(ButtonStyle.Danger).setDisabled(true),
        new ButtonBuilder().setCustomId('d_sneak').setLabel('Sneak').setStyle(ButtonStyle.Primary).setDisabled(true),
        new ButtonBuilder().setCustomId('d_loot').setLabel('Loot').setStyle(ButtonStyle.Success).setDisabled(true),
        new ButtonBuilder().setCustomId('d_surrender').setLabel('Surrender').setStyle(ButtonStyle.Secondary).setDisabled(true)
      );
      msg.edit({ components: [disabledRow] }).catch(() => {});
    }
  });
}
