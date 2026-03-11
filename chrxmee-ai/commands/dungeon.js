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

const BOSSES = [
  { emoji: '🧙', name: 'Forest Witch',   flavor: 'She cackles as the trees close in around you...' },
  { emoji: '💀', name: 'Undead Knight',  flavor: 'His hollow eyes glow red. The ground shakes.' },
  { emoji: '🌋', name: 'Lava Titan',     flavor: 'Magma drips from his fists. The air is on fire.' },
  { emoji: '🐉', name: 'Frost Wyrm',     flavor: 'Its icy breath freezes the walls solid.' },
  { emoji: '🦑', name: 'Kraken',         flavor: 'Tentacles erupt from the flooded floor.' },
  { emoji: '👑', name: 'Fallen King',    flavor: 'He ruled this dungeon once. Now he rules only death.' },
  { emoji: '💎', name: 'Ancient Dragon', flavor: 'Its scales shimmer. One breath could end everything.' },
];

function getBoss(room) {
  if (room % 10 !== 0) return null;
  const index = Math.floor(room / 10) - 1;
  const base = BOSSES[index % BOSSES.length];
  // HP scales with room number
  const hp = 60 + (room * 4);
  return { ...base, maxHp: hp, currentHp: hp };
}

const ARMOR_SHOP = [
  { id: 'leather', name: '🟤 Leather Armor', cost: 50,  hpBonus: 1, desc: '+1 HP protection per fight' },
  { id: 'iron',    name: '⚙️ Iron Armor',    cost: 150, hpBonus: 2, desc: '+2 HP protection per fight' },
  { id: 'gold',    name: '🟡 Gold Armor',    cost: 300, hpBonus: 3, desc: '+3 HP protection per fight' },
  { id: 'diamond', name: '💎 Diamond Armor', cost: 500, hpBonus: 4, desc: '+4 HP protection per fight' },
];

function getDieBar(hp, max = 100) {
  const pct = Math.max(0, hp / max);
  const full = Math.round(pct * 9);
  return '🎲'.repeat(full) + '⚪'.repeat(9 - full);
}

function getBossBar(hp, max) {
  const pct = Math.max(0, hp / max);
  const full = Math.round(pct * 10);
  return '🔴'.repeat(full) + '⬛'.repeat(10 - full);
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
        FROM dungeon_stats GROUP BY username
        ORDER BY MAX(${orderCol}) DESC LIMIT 10
      `;
      params = [];
    } else {
      query = `
        SELECT username, farthest_room, total_gold_earned
        FROM dungeon_stats WHERE guild_id = $1
        ORDER BY ${orderCol} DESC LIMIT 10
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
    ? ['No entries yet! Complete a dungeon run to appear here.']
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
    .addSubcommand(sub => sub.setName('stats').setDescription('See your dungeon stats (works anytime)'))
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
    if (!data.inventory) data.inventory = [];
    if (!('equippedArmor' in data)) data.equippedArmor = null;
    if (!data.starterId) data.starterId = userId;
    if (!data.farthestRoom) data.farthestRoom = 0;
    if (!data.totalGoldEarned) data.totalGoldEarned = 0;

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

    if (sub === 'stats') {
      const armor = ARMOR_SHOP.find(a => a.id === data.equippedArmor);
      const embed = new EmbedBuilder()
        .setColor('#2f3136')
        .setTitle(`📊 ${username}'s Dungeon Stats`)
        .addFields(
          { name: '⚔️ Status',         value: data.inDungeon ? `In dungeon (Room ${data.currentRoom})` : 'Not in dungeon', inline: false },
          { name: '❤️ HP',             value: `${data.hp}`,              inline: true },
          { name: '🪙 Gold',           value: `${data.gold}`,            inline: true },
          { name: '🏆 Farthest Room',  value: `${data.farthestRoom}`,    inline: true },
          { name: '💰 Most Gold Ever', value: `${data.totalGoldEarned}`, inline: true },
          { name: '🛡️ Equipped Armor', value: armor ? armor.name : 'None', inline: true },
          { name: '🎒 Armor Owned',    value: data.inventory.length > 0 ? data.inventory.map(id => ARMOR_SHOP.find(a => a.id === id).name).join(', ') : 'None', inline: false }
        );
      return interaction.editReply({ embeds: [embed] });
    }

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
        try { await btn.deferUpdate(); } catch (e) { return; }
        if (btn.user.id !== userId) return;
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

      collector.on('end', () => { shopMsg.edit({ components: [] }).catch(() => {}); });
      return;
    }

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

    if (sub === 'leaderboard') {
      if (!client.pool) return interaction.editReply('❌ Database not available.');
      let scope = 'local';
      let metric = 'room';
      const buildRow = (s, m) => new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('lb_local').setLabel('🏠 Local').setStyle(s === 'local' ? ButtonStyle.Primary : ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('lb_global').setLabel('🌍 Global').setStyle(s === 'global' ? ButtonStyle.Primary : ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('lb_room').setLabel('🗺️ Farthest Room').setStyle(m === 'room' ? ButtonStyle.Success : ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('lb_gold').setLabel('🪙 Most Gold').setStyle(m === 'gold' ? ButtonStyle.Success : ButtonStyle.Secondary)
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
      collector.on('end', () => { lbMsg.edit({ components: [] }).catch(() => {}); });
      return;
    }

    if (sub === 'start') {
      if (data.inDungeon) return interaction.editReply('⚠️ Already in a run! Use `/dungeon leave` or `/dungeon reset`.');
      data.inDungeon = true;
      data.currentRoom = 1;
      data.hp = 100;
      data.starterId = userId;
      client.memory.set(`dungeon_${guildId}_${userId}`, data);
      await interaction.editReply({ content: '⚔️ Entering dungeon...' });
      const msg = await interaction.fetchReply();
      await performRoom(msg, client, data, guildId, userId, username);
    }
  }
};

// ── BOSS FIGHT ─────────────────────────────────────────────────────────────

function buildBossEmbed(boss, data, roundLog) {
  const armor = ARMOR_SHOP.find(a => a.id === data.equippedArmor);
  return new EmbedBuilder()
    .setColor('#ff4444')
    .setTitle(`⚠️ BOSS ROOM — ${boss.emoji} ${boss.name}`)
    .setDescription(`*${boss.flavor}*\n\n${roundLog ? `**Last round:** ${roundLog}\n` : ''}\nChoose your action:`)
    .addFields(
      { name: `${boss.emoji} Boss HP`, value: `${getBossBar(boss.currentHp, boss.maxHp)} ${boss.currentHp}/${boss.maxHp}`, inline: false },
      { name: '❤️ Your HP Bar',        value: getDieBar(data.hp),  inline: false },
      { name: '❤️ Your HP',            value: `${data.hp}`,        inline: true },
      { name: '🪙 Gold',               value: `${data.gold}`,      inline: true },
      { name: '🛡️ Armor',              value: armor ? armor.name : 'None', inline: true }
    );
}

function buildBossRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('b_strike').setLabel('⚔️ Strike').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('b_defend').setLabel('🛡️ Defend').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('b_explosive').setLabel('💣 Explosive').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('b_parry').setLabel('🔰 Parry').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('b_flee').setLabel('🏃 Flee').setStyle(ButtonStyle.Secondary)
  );
}

async function performBossRoom(msg, client, data, guildId, userId, username) {
  const boss = getBoss(data.currentRoom);
  if (!boss) {
    // Shouldn't happen but fall back to normal room
    return performRoom(msg, client, data, guildId, userId, username);
  }

  // Show initial boss embed
  await msg.edit({ embeds: [buildBossEmbed(boss, data, null)], components: [buildBossRow()] }).catch(err => {
    console.error('boss room initial edit failed:', err);
  });

  // Multi-turn collector — no max, stays open until boss dies, player dies, or flees
  const collector = msg.createMessageComponentCollector({ time: 60000 });

  collector.on('collect', async btn => {
    try { await btn.deferUpdate(); } catch (e) { return; }

    if (btn.user.id !== userId) return;

    const equippedArmor = ARMOR_SHOP.find(a => a.id === data.equippedArmor);
    const armorBonus = equippedArmor ? equippedArmor.hpBonus : 0;

    // Boss decides its action — 70% punch, 30% parry
    const bossAction = Math.random() < 0.70 ? 'punch' : 'parry';
    const bossActionText = bossAction === 'punch' ? '👊 punched' : '🔰 parried';

    let playerHpLoss = 0;
    let bossHpLoss = 0;
    let roundLog = '';

    const action = btn.customId;

    if (action === 'b_flee') {
      const goldLost = 100;
      data.gold = Math.max(0, data.gold - goldLost);
      collector.stop('fled');
      client.memory.set(`dungeon_${guildId}_${userId}`, data);

      await btn.followUp({
        embeds: [new EmbedBuilder()
          .setColor('#888888')
          .setTitle('🏃 You fled the boss room!')
          .setDescription(`You escaped but lost **${goldLost} gold** in the chaos.`)
          .addFields(
            { name: '🪙 Gold Remaining', value: `${data.gold}`, inline: true },
            { name: '❤️ HP', value: `${data.hp}`, inline: true }
          )],
        ephemeral: true
      }).catch(() => {});

      data.currentRoom++;
      client.memory.set(`dungeon_${guildId}_${userId}`, data);
      await saveStats(client.pool, userId, guildId, username, data.farthestRoom, data.totalGoldEarned);

      setTimeout(() => {
        if (data.inDungeon) performRoom(msg, client, data, guildId, userId, username);
      }, 2000);
      return;
    }

    // Resolve combat based on player action vs boss action
    if (action === 'b_strike') {
      if (bossAction === 'punch') {
        // Both hit each other
        playerHpLoss = Math.max(0, 20 - armorBonus);
        bossHpLoss = 25;
        roundLog = `You struck! Boss ${bossActionText} back. **-${playerHpLoss} HP** / **-${bossHpLoss} Boss HP**`;
      } else {
        // Boss parried your strike, still punishes you
        playerHpLoss = Math.max(0, 10 - armorBonus);
        bossHpLoss = 0;
        roundLog = `You struck but boss ${bossActionText} your blade! **-${playerHpLoss} HP** / Boss blocked your hit!`;
      }
    } else if (action === 'b_defend') {
      if (bossAction === 'punch') {
        // Halved damage
        playerHpLoss = Math.max(0, Math.floor((20 - armorBonus) / 2));
        bossHpLoss = 0;
        roundLog = `You defended! Boss ${bossActionText} but you blocked most of it. **-${playerHpLoss} HP**`;
      } else {
        // Both defending — stalemate
        playerHpLoss = 0;
        bossHpLoss = 0;
        roundLog = `You defended... boss ${bossActionText} too. Nothing happened. 😐`;
      }
    } else if (action === 'b_explosive') {
      if (bossAction === 'punch') {
        // Big damage to boss, big damage to player
        playerHpLoss = Math.max(0, 30 - armorBonus);
        bossHpLoss = 45;
        roundLog = `BOOM! Massive hit on the boss! Boss ${bossActionText} through it. **-${playerHpLoss} HP** / **-${bossHpLoss} Boss HP**`;
      } else {
        // Boss half-blocks explosion
        playerHpLoss = Math.max(0, 15 - armorBonus);
        bossHpLoss = 25;
        roundLog = `Explosion! Boss ${bossActionText} and half-blocked it. **-${playerHpLoss} HP** / **-${bossHpLoss} Boss HP**`;
      }
    } else if (action === 'b_parry') {
      if (bossAction === 'punch') {
        // Perfect parry — player safe, boss takes damage
        playerHpLoss = 0;
        bossHpLoss = 30;
        roundLog = `🔰 PERFECT PARRY! You deflected the boss's punch and countered! **-${bossHpLoss} Boss HP**`;
      } else {
        // Both parried — clash, small damage to both
        playerHpLoss = Math.max(0, 8 - armorBonus);
        bossHpLoss = 8;
        roundLog = `⚡ PARRY CLASH! You both parried at the same time! **-${playerHpLoss} HP** / **-${bossHpLoss} Boss HP**`;
      }
    }

    data.hp -= playerHpLoss;
    boss.currentHp -= bossHpLoss;
    data.hp = Math.max(0, data.hp);
    boss.currentHp = Math.max(0, boss.currentHp);

    // ── BOSS DEFEATED ──────────────────────────────────────
    if (boss.currentHp <= 0) {
      collector.stop('boss_dead');
      const goldReward = 450;
      data.gold += goldReward;
      if (data.gold > data.totalGoldEarned) data.totalGoldEarned = data.gold;
      data.currentRoom++;
      if (data.currentRoom > data.farthestRoom) data.farthestRoom = data.currentRoom;
      client.memory.set(`dungeon_${guildId}_${userId}`, data);
      await saveStats(client.pool, userId, guildId, username, data.farthestRoom, data.totalGoldEarned);

      await btn.followUp({
        embeds: [new EmbedBuilder()
          .setColor('#FFD700')
          .setTitle(`🏆 ${boss.emoji} ${boss.name} Defeated!`)
          .setDescription(`${roundLog}\n\n*The boss crumbles before you. Gold spills everywhere!*`)
          .addFields(
            { name: '🪙 Gold Earned', value: `+${goldReward}`, inline: true },
            { name: '🪙 Total Gold', value: `${data.gold}`, inline: true },
            { name: '❤️ HP Remaining', value: `${data.hp}`, inline: true }
          )],
        ephemeral: true
      }).catch(() => {});

      await msg.edit({
        embeds: [new EmbedBuilder()
          .setColor('#FFD700')
          .setTitle(`🏆 ${boss.emoji} ${boss.name} has been slain by ${username}!`)
          .setDescription(`*The dungeon shakes as the boss falls...*\n\n**+${goldReward} gold rewarded!**`)],
        components: []
      }).catch(() => {});

      setTimeout(() => {
        if (data.inDungeon) performRoom(msg, client, data, guildId, userId, username);
      }, 3000);
      return;
    }

    // ── PLAYER DIED ────────────────────────────────────────
    if (data.hp <= 0) {
      collector.stop('player_dead');
      await saveStats(client.pool, userId, guildId, username, data.farthestRoom, data.totalGoldEarned);

      await btn.followUp({
        embeds: [new EmbedBuilder()
          .setColor('#ff0000')
          .setTitle(`💀 You were slain by ${boss.emoji} ${boss.name}!`)
          .setDescription(`${roundLog}\n\n*You collapse. The boss stands victorious.*`)
          .addFields(
            { name: '🪙 Gold After Penalty', value: `${Math.floor(data.gold * 0.5)}`, inline: true },
            { name: '🏆 Farthest Room Ever', value: `${data.farthestRoom}`, inline: true }
          )],
        ephemeral: true
      }).catch(() => {});

      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('b_strike').setLabel('⚔️ Strike').setStyle(ButtonStyle.Danger).setDisabled(true),
        new ButtonBuilder().setCustomId('b_defend').setLabel('🛡️ Defend').setStyle(ButtonStyle.Primary).setDisabled(true),
        new ButtonBuilder().setCustomId('b_explosive').setLabel('💣 Explosive').setStyle(ButtonStyle.Danger).setDisabled(true),
        new ButtonBuilder().setCustomId('b_parry').setLabel('🔰 Parry').setStyle(ButtonStyle.Success).setDisabled(true),
        new ButtonBuilder().setCustomId('b_flee').setLabel('🏃 Flee').setStyle(ButtonStyle.Secondary).setDisabled(true)
      );

      await msg.edit({
        embeds: [new EmbedBuilder()
          .setColor('#ff0000')
          .setTitle(`💀 ${username} was slain by ${boss.emoji} ${boss.name}!`)
          .setDescription('Reviving in 4 seconds... 50% gold penalty applied.')
          .addFields({ name: 'HP Bar', value: getDieBar(0), inline: false })],
        components: [disabledRow]
      }).catch(() => {});

      data.hp = 50;
      data.gold = Math.floor(data.gold * 0.5);
      data.currentRoom = 1;
      client.memory.set(`dungeon_${guildId}_${userId}`, data);

      setTimeout(() => {
        if (data.inDungeon) performRoom(msg, client, data, guildId, userId, username);
      }, 4000);
      return;
    }

    // ── ROUND CONTINUES — update embed ────────────────────
    client.memory.set(`dungeon_${guildId}_${userId}`, data);
    await msg.edit({
      embeds: [buildBossEmbed(boss, data, roundLog)],
      components: [buildBossRow()]
    }).catch(() => {});
  });

  collector.on('end', (collected, reason) => {
    // Only disable on timeout — other endings are handled above
    if (reason === 'time') {
      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('b_strike').setLabel('⚔️ Strike').setStyle(ButtonStyle.Danger).setDisabled(true),
        new ButtonBuilder().setCustomId('b_defend').setLabel('🛡️ Defend').setStyle(ButtonStyle.Primary).setDisabled(true),
        new ButtonBuilder().setCustomId('b_explosive').setLabel('💣 Explosive').setStyle(ButtonStyle.Danger).setDisabled(true),
        new ButtonBuilder().setCustomId('b_parry').setLabel('🔰 Parry').setStyle(ButtonStyle.Success).setDisabled(true),
        new ButtonBuilder().setCustomId('b_flee').setLabel('🏃 Flee').setStyle(ButtonStyle.Secondary).setDisabled(true)
      );
      msg.edit({ components: [disabledRow] }).catch(() => {});
    }
  });
}

// ── NORMAL ROOM ────────────────────────────────────────────────────────────

async function performRoom(msg, client, data, guildId, userId, username) {
  // Route to boss room if applicable
  if (data.currentRoom % 10 === 0) {
    return performBossRoom(msg, client, data, guildId, userId, username);
  }

  const roomTheme = ROOM_THEMES[Math.floor(Math.random() * ROOM_THEMES.length)];
  const mazeIndex = Math.min(data.currentRoom - 1, MAZE_LAYOUTS.length - 1);
  const maze = MAZE_LAYOUTS[mazeIndex];
  const armor = ARMOR_SHOP.find(a => a.id === data.equippedArmor);

  const embed = new EmbedBuilder()
    .setColor('#2f3136')
    .setTitle(`Room ${data.currentRoom} — ${roomTheme}`)
    .setDescription(`Maze:\n${maze}\n\nChoose one action:`)
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
    try { await btn.deferUpdate(); } catch (e) { return; }

    if (btn.user.id !== userId) return;

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
        embeds: [new EmbedBuilder()
          .setColor('#ff0000')
          .setTitle('🏳️ You surrendered.')
          .setDescription(`You gave up on room **${data.currentRoom}**.`)
          .addFields(
            { name: '🪙 Gold Kept', value: `${data.gold}`, inline: true },
            { name: '❤️ HP Left', value: `${data.hp}`, inline: true },
            { name: '🏆 Farthest Room Ever', value: `${data.farthestRoom}`, inline: true }
          )],
        ephemeral: true
      }).catch(() => {});

      await msg.edit({
        embeds: [new EmbedBuilder()
          .setColor('#ff0000')
          .setTitle('Run Over')
          .setDescription(`<@${userId}> surrendered on room **${data.currentRoom}**.`)],
        components: []
      }).catch(() => {});
      return;
    }

    data.hp -= hpLoss;
    data.gold += goldGain;
    data.gold = Math.max(0, data.gold);
    if (data.gold > data.totalGoldEarned) data.totalGoldEarned = data.gold;
    if (data.currentRoom > data.farthestRoom) data.farthestRoom = data.currentRoom;

    let died = false;

    if (data.hp <= 0) {
      died = true;
      data.hp = 50;
      data.gold = Math.floor(data.gold * 0.5);

      await saveStats(client.pool, userId, guildId, username, data.farthestRoom, data.totalGoldEarned);

      await btn.followUp({
        embeds: [new EmbedBuilder()
          .setColor('#ff0000')
          .setTitle('💀 You Died!')
          .setDescription(
            `You were defeated on room **${data.currentRoom}**.\n\n` +
            `You earned **${goldGain} gold** before dying.\n` +
            `Your farthest room this run: **Room ${data.farthestRoom}**`
          )
          .addFields(
            { name: '🪙 Gold After Penalty', value: `${data.gold}`, inline: true },
            { name: '🏆 Farthest Room Ever', value: `${data.farthestRoom}`, inline: true }
          )],
        ephemeral: true
      }).catch(() => {});

      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('d_fight').setLabel('Fight').setStyle(ButtonStyle.Danger).setDisabled(true),
        new ButtonBuilder().setCustomId('d_sneak').setLabel('Sneak').setStyle(ButtonStyle.Primary).setDisabled(true),
        new ButtonBuilder().setCustomId('d_loot').setLabel('Loot').setStyle(ButtonStyle.Success).setDisabled(true),
        new ButtonBuilder().setCustomId('d_surrender').setLabel('Surrender').setStyle(ButtonStyle.Secondary).setDisabled(true)
      );

      await msg.edit({
        embeds: [new EmbedBuilder()
          .setColor('#ff0000')
          .setTitle(`💀 ${username} died on Room ${data.currentRoom}!`)
          .setDescription('Reviving in 4 seconds... 50% gold penalty applied.')
          .addFields({ name: 'HP Bar', value: getDieBar(0), inline: false })],
        components: [disabledRow]
      }).catch(() => {});

      data.currentRoom = 1;

    } else {
      data.currentRoom++;

      await btn.followUp({
        embeds: [new EmbedBuilder()
          .setColor('#f0a500')
          .setTitle('Room Result')
          .setDescription(result)
          .addFields(
            { name: 'HP Bar', value: getDieBar(data.hp), inline: false },
            { name: '❤️ HP Remaining', value: `${data.hp}`, inline: true },
            { name: '🪙 Gold', value: `${data.gold}`, inline: true },
            { name: '🛡️ Armor', value: equippedArmor ? equippedArmor.name : 'None', inline: true }
          )],
        ephemeral: true
      }).catch(() => {});
    }

    client.memory.set(`dungeon_${guildId}_${userId}`, data);
    await saveStats(client.pool, userId, guildId, username, data.farthestRoom, data.totalGoldEarned);

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
