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
  const hp = 60 + (room * 4);
  return { ...base, maxHp: hp, currentHp: hp };
}

const ARMOR_SHOP = [
  { id: 'leather',   name: '🟤 Leather Armor',   cost: 50,   hpBonus: 1, desc: '+1 DEF per fight' },
  { id: 'iron',      name: '⚙️ Iron Armor',       cost: 150,  hpBonus: 2, desc: '+2 DEF per fight' },
  { id: 'gold',      name: '🟡 Gold Armor',       cost: 300,  hpBonus: 3, desc: '+3 DEF per fight' },
  { id: 'diamond',   name: '💎 Diamond Armor',    cost: 500,  hpBonus: 4, desc: '+4 DEF per fight' },
  { id: 'obsidian',  name: '🌑 Obsidian Armor',   cost: 750,  hpBonus: 5, desc: '+5 DEF per fight' },
  { id: 'mythril',   name: '🔱 Mythril Armor',    cost: 1000, hpBonus: 6, desc: '+6 DEF per fight' },
  { id: 'celestial', name: '👼 Celestial Armor',  cost: 1500, hpBonus: 7, desc: '+7 DEF per fight' },
];

const POTIONS = [
  { id: 'health', name: '🧪 Health Potion', cost: 75,  desc: 'Restores 30 HP' },
  { id: 'damage', name: '⚔️ Damage Potion', cost: 100, desc: 'Doubles your next boss attack' },
  { id: 'cash',   name: '💰 Cash Potion',   cost: 80,  desc: 'Instantly grants 100 gold' },
];

const SPELLS = [
  { id: 'zoltrarok',  name: '✨ Zoltrarok',  cost: 200, damage: 20, selfDamage: 0,  desc: 'Frieren beam — 20 boss damage' },
  { id: 'jilwer',     name: '🌊 Jilwer',     cost: 250, damage: 25, selfDamage: 0,  desc: 'Water current — 25 boss damage' },
  { id: 'granat',     name: '❄️ Granat',     cost: 300, damage: 15, selfDamage: 0,  desc: 'Ice bind — 15 damage, boss skips turn' },
  { id: 'judradjim',  name: '🔥 Judradjim',  cost: 350, damage: 30, selfDamage: 10, desc: '30 boss damage, you take 10 HP' },
  { id: 'vollzanbel', name: '🌑 Vollzanbel', cost: 400, damage: 40, selfDamage: 15, desc: 'Strongest spell — 40 boss damage, you take 15 HP' },
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
    totalGoldEarned: 0,
    potions: { health: 0, damage: 0, cash: 0 },
    spells: { zoltrarok: 0, jilwer: 0, granat: 0, judradjim: 0, vollzanbel: 0 },
    damageBoostActive: false,
  };
}

function migrateData(data, userId) {
  if (!data.inventory) data.inventory = [];
  if (!('equippedArmor' in data)) data.equippedArmor = null;
  if (!data.starterId) data.starterId = userId;
  if (!data.farthestRoom) data.farthestRoom = 0;
  if (!data.totalGoldEarned) data.totalGoldEarned = 0;
  if (!data.potions) data.potions = { health: 0, damage: 0, cash: 0 };
  if (!data.spells) data.spells = { zoltrarok: 0, jilwer: 0, granat: 0, judradjim: 0, vollzanbel: 0 };
  if (!('damageBoostActive' in data)) data.damageBoostActive = false;
  return data;
}

async function saveStats(pool, userId, guildId, username, farthestRoom, totalGoldEarned) {
  if (!pool) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS dungeon_stats (
        user_id TEXT NOT NULL, guild_id TEXT NOT NULL, username TEXT,
        farthest_room INT DEFAULT 0, total_gold_earned INT DEFAULT 0,
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
        user_id TEXT NOT NULL, guild_id TEXT NOT NULL, username TEXT,
        farthest_room INT DEFAULT 0, total_gold_earned INT DEFAULT 0,
        PRIMARY KEY (user_id, guild_id)
      )
    `);
    let query, params;
    if (isGlobal) {
      query = `SELECT username, MAX(farthest_room) AS farthest_room, MAX(total_gold_earned) AS total_gold_earned
               FROM dungeon_stats GROUP BY username ORDER BY MAX(${orderCol}) DESC LIMIT 10`;
      params = [];
    } else {
      query = `SELECT username, farthest_room, total_gold_earned FROM dungeon_stats
               WHERE guild_id = $1 ORDER BY ${orderCol} DESC LIMIT 10`;
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
  return new EmbedBuilder().setColor('#2f3136').setTitle(title).setDescription(lines.join('\n'));
}

// ── SHOP BUILDER ───────────────────────────────────────────────────────────

function buildShopEmbed(data) {
  const armorLines = ARMOR_SHOP.map(a => {
    const owned = data.inventory.includes(a.id);
    return `${a.name} — **${a.cost}g** — ${a.desc}${owned ? ' ✅' : ''}`;
  });
  const potionLines = POTIONS.map(p => {
    const count = data.potions[p.id] || 0;
    return `${p.name} — **${p.cost}g** — ${p.desc} (own: ${count})`;
  });
  const spellLines = SPELLS.map(s => {
    const count = data.spells[s.id] || 0;
    return `${s.name} — **${s.cost}g** — ${s.desc} (own: ${count})`;
  });
  return new EmbedBuilder()
    .setColor('#f0a500')
    .setTitle('🏪 Dungeon Shop')
    .addFields(
      { name: '🛡️ Armor', value: armorLines.join('\n'), inline: false },
      { name: '🧪 Potions', value: potionLines.join('\n'), inline: false },
      { name: '🔮 Spells (Boss Rooms Only)', value: spellLines.join('\n'), inline: false },
    )
    .addFields({ name: '🪙 Your Gold', value: `${data.gold}`, inline: true })
    .setFooter({ text: 'Spells can also drop from boss kills!' });
}

function buildShopRows(data) {
  const rows = [];

  // Row 1: Armor 1-5
  const armorRow1 = new ActionRowBuilder().addComponents(
    ARMOR_SHOP.slice(0, 5).map(a => {
      const owned = data.inventory.includes(a.id);
      return new ButtonBuilder()
        .setCustomId(`shop_armor_${a.id}`)
        .setLabel(`${owned ? '✅' : '🛡️'} ${a.name.split(' ').slice(1, 3).join(' ')}`)
        .setStyle(owned ? ButtonStyle.Secondary : ButtonStyle.Primary)
        .setDisabled(owned);
    })
  );
  rows.push(armorRow1);

  // Row 2: Armor 6-7 + Potions
  const row2Buttons = [
    ...ARMOR_SHOP.slice(5).map(a => {
      const owned = data.inventory.includes(a.id);
      return new ButtonBuilder()
        .setCustomId(`shop_armor_${a.id}`)
        .setLabel(`${owned ? '✅' : '🛡️'} ${a.name.split(' ').slice(1, 3).join(' ')}`)
        .setStyle(owned ? ButtonStyle.Secondary : ButtonStyle.Primary)
        .setDisabled(owned);
    }),
    ...POTIONS.map(p => new ButtonBuilder()
      .setCustomId(`shop_potion_${p.id}`)
      .setLabel(`Buy ${p.name.split(' ')[1]}`)
      .setStyle(ButtonStyle.Success)
    )
  ];
  rows.push(new ActionRowBuilder().addComponents(row2Buttons));

  // Row 3: Spells
  const spellRow = new ActionRowBuilder().addComponents(
    SPELLS.map(s => new ButtonBuilder()
      .setCustomId(`shop_spell_${s.id}`)
      .setLabel(`Buy ${s.name.split(' ')[1]}`)
      .setStyle(ButtonStyle.Danger)
    )
  );
  rows.push(spellRow);

  return rows;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dungeon')
    .setDescription('Dungeon RPG – infinite rooms')
    .addSubcommand(sub => sub.setName('start').setDescription('Begin a new run'))
    .addSubcommand(sub => sub.setName('stats').setDescription('See your dungeon stats (works anytime)'))
    .addSubcommand(sub => sub.setName('leave').setDescription('Escape the dungeon'))
    .addSubcommand(sub => sub.setName('reset').setDescription('Force-reset data'))
    .addSubcommand(sub => sub.setName('inventory').setDescription('Check inventory and use potions/spells'))
    .addSubcommand(sub => sub.setName('shop').setDescription('Buy armor, potions and spells'))
    .addSubcommand(sub =>
      sub.setName('equip')
        .setDescription('Equip an armor from your inventory')
        .addStringOption(opt =>
          opt.setName('armor').setDescription('Which armor to equip').setRequired(true)
            .addChoices(
              { name: '🟤 Leather Armor',  value: 'leather'  },
              { name: '⚙️ Iron Armor',     value: 'iron'     },
              { name: '🟡 Gold Armor',     value: 'gold'     },
              { name: '💎 Diamond Armor',  value: 'diamond'  },
              { name: '🌑 Obsidian Armor', value: 'obsidian' },
              { name: '🔱 Mythril Armor',  value: 'mythril'  },
              { name: '👼 Celestial Armor',value: 'celestial'}
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
    data = migrateData(data, userId);

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

    // ── STATS ──────────────────────────────────────────────
    if (sub === 'stats') {
      const armor = ARMOR_SHOP.find(a => a.id === data.equippedArmor);
      const potionLines = POTIONS.map(p => `${p.name}: **${data.potions[p.id]}**`).join(' | ');
      const spellLines = SPELLS.map(s => `${s.name}: **${data.spells[s.id]}**`).join(' | ');
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
          { name: '⚡ Damage Boost',   value: data.damageBoostActive ? 'ACTIVE' : 'Inactive', inline: true },
          { name: '🧪 Potions',        value: potionLines, inline: false },
          { name: '🔮 Spells',         value: spellLines, inline: false },
          { name: '🎒 Armor Owned',    value: data.inventory.length > 0 ? data.inventory.map(id => ARMOR_SHOP.find(a => a.id === id).name).join(', ') : 'None', inline: false }
        );
      return interaction.editReply({ embeds: [embed] });
    }

    // ── INVENTORY ──────────────────────────────────────────
    if (sub === 'inventory') {
      const armor = ARMOR_SHOP.find(a => a.id === data.equippedArmor);
      const armorLines = data.inventory.length > 0
        ? data.inventory.map(id => {
            const a = ARMOR_SHOP.find(x => x.id === id);
            return `${a.name} — ${a.desc}${data.equippedArmor === id ? ' ✅ **Equipped**' : ''}`;
          }).join('\n')
        : 'No armor owned.';

      const potionLines = POTIONS.map(p => `${p.name} x${data.potions[p.id]} — ${p.desc}`).join('\n');
      const spellLines = SPELLS.map(s => `${s.name} x${data.spells[s.id]} — ${s.desc}`).join('\n');

      const embed = new EmbedBuilder()
        .setColor('#2f3136')
        .setTitle('🎒 Your Dungeon Inventory')
        .addFields(
          { name: '🛡️ Armor', value: armorLines, inline: false },
          { name: '🧪 Potions', value: potionLines, inline: false },
          { name: '🔮 Spells (Boss Rooms Only)', value: spellLines, inline: false },
          { name: '🪙 Gold', value: `${data.gold}`, inline: true },
          { name: '❤️ HP', value: `${data.hp}`, inline: true },
        );

      // Use buttons for potions
      const potionButtons = POTIONS.map(p =>
        new ButtonBuilder()
          .setCustomId(`inv_use_${p.id}`)
          .setLabel(`Use ${p.name.split(' ')[1]}`)
          .setStyle(p.id === 'health' ? ButtonStyle.Success : p.id === 'damage' ? ButtonStyle.Danger : ButtonStyle.Primary)
          .setDisabled(data.potions[p.id] <= 0)
      );
      const potionRow = new ActionRowBuilder().addComponents(potionButtons);

      await interaction.editReply({ embeds: [embed], components: [potionRow] });
      const invMsg = await interaction.fetchReply();
      const collector = invMsg.createMessageComponentCollector({ time: 30000 });

      collector.on('collect', async btn => {
        try { await btn.deferUpdate(); } catch (e) { return; }
        if (btn.user.id !== userId) return;

        // Re-fetch latest data
        data = client.memory.get(`dungeon_${guildId}_${userId}`) || data;

        const potionId = btn.customId.replace('inv_use_', '');
        const potion = POTIONS.find(p => p.id === potionId);
        if (!potion) return;
        if (data.potions[potionId] <= 0) {
          return btn.followUp({ content: `❌ You have no ${potion.name} left!`, ephemeral: true }).catch(() => {});
        }

        data.potions[potionId]--;
        let result = '';

        if (potionId === 'health') {
          if (!data.inDungeon) {
            data.potions[potionId]++; // refund
            return btn.followUp({ content: '❌ Health potions can only be used inside a dungeon!', ephemeral: true }).catch(() => {});
          }
          const healed = Math.min(30, 100 - data.hp);
          data.hp = Math.min(100, data.hp + 30);
          result = `🧪 Used Health Potion! Restored **${healed} HP**. HP is now **${data.hp}**.`;
        } else if (potionId === 'damage') {
          if (!data.inDungeon) {
            data.potions[potionId]++;
            return btn.followUp({ content: '❌ Damage potions can only be used inside a dungeon!', ephemeral: true }).catch(() => {});
          }
          data.damageBoostActive = true;
          result = '⚔️ Damage Potion activated! Your next boss attack deals **double damage**!';
        } else if (potionId === 'cash') {
          data.gold += 100;
          if (data.gold > data.totalGoldEarned) data.totalGoldEarned = data.gold;
          result = '💰 Cash Potion used! Gained **+100 gold**!';
        }

        client.memory.set(`dungeon_${guildId}_${userId}`, data);
        await btn.followUp({ content: result, ephemeral: true }).catch(() => {});
      });

      collector.on('end', () => { invMsg.edit({ components: [] }).catch(() => {}); });
      return;
    }

    // ── SHOP ───────────────────────────────────────────────
    if (sub === 'shop') {
      await interaction.editReply({ embeds: [buildShopEmbed(data)], components: buildShopRows(data) });
      const shopMsg = await interaction.fetchReply();
      const collector = shopMsg.createMessageComponentCollector({ time: 45000 });

      collector.on('collect', async btn => {
        try { await btn.deferUpdate(); } catch (e) { return; }
        if (btn.user.id !== userId) return;

        data = client.memory.get(`dungeon_${guildId}_${userId}`) || data;

        const cid = btn.customId;
        let reply = '';

        if (cid.startsWith('shop_armor_')) {
          const armorId = cid.replace('shop_armor_', '');
          const armor = ARMOR_SHOP.find(a => a.id === armorId);
          if (!armor) return;
          if (data.inventory.includes(armorId)) {
            reply = '❌ You already own this armor!';
          } else if (data.gold < armor.cost) {
            reply = `❌ Need **${armor.cost}g**, you have **${data.gold}g**.`;
          } else {
            data.gold -= armor.cost;
            data.inventory.push(armorId);
            reply = `✅ Bought **${armor.name}**! Use \`/dungeon equip\` to equip it.\n🪙 Gold left: **${data.gold}**`;
          }
        } else if (cid.startsWith('shop_potion_')) {
          const potionId = cid.replace('shop_potion_', '');
          const potion = POTIONS.find(p => p.id === potionId);
          if (!potion) return;
          if (data.gold < potion.cost) {
            reply = `❌ Need **${potion.cost}g**, you have **${data.gold}g**.`;
          } else {
            data.gold -= potion.cost;
            data.potions[potionId]++;
            reply = `✅ Bought **${potion.name}**! You now have **${data.potions[potionId]}**.\n🪙 Gold left: **${data.gold}**`;
          }
        } else if (cid.startsWith('shop_spell_')) {
          const spellId = cid.replace('shop_spell_', '');
          const spell = SPELLS.find(s => s.id === spellId);
          if (!spell) return;
          if (data.gold < spell.cost) {
            reply = `❌ Need **${spell.cost}g**, you have **${data.gold}g**.`;
          } else {
            data.gold -= spell.cost;
            data.spells[spellId]++;
            reply = `✅ Bought **${spell.name}**! You now have **${data.spells[spellId]}**.\n🪙 Gold left: **${data.gold}**`;
          }
        }

        client.memory.set(`dungeon_${guildId}_${userId}`, data);
        if (reply) await btn.followUp({ content: reply, ephemeral: true }).catch(() => {});
      });

      collector.on('end', () => { shopMsg.edit({ components: [] }).catch(() => {}); });
      return;
    }

    // ── EQUIP ──────────────────────────────────────────────
    if (sub === 'equip') {
      const armorId = interaction.options.getString('armor');
      if (!data.inventory.includes(armorId)) {
        return interaction.editReply('❌ You don\'t own that armor! Visit `/dungeon shop` to buy it.');
      }
      data.equippedArmor = armorId;
      client.memory.set(`dungeon_${guildId}_${userId}`, data);
      const armor = ARMOR_SHOP.find(a => a.id === armorId);
      return interaction.editReply(`✅ Equipped **${armor.name}**! ${armor.desc}.`);
    }

    // ── LEADERBOARD ────────────────────────────────────────
    if (sub === 'leaderboard') {
      if (!client.pool) return interaction.editReply('❌ Database not available.');
      let scope = 'local', metric = 'room';
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

    // ── START ──────────────────────────────────────────────
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
      { name: '❤️ Your HP Bar',        value: getDieBar(data.hp), inline: false },
      { name: '❤️ Your HP',            value: `${data.hp}`,       inline: true },
      { name: '🪙 Gold',               value: `${data.gold}`,     inline: true },
      { name: '🛡️ Armor',              value: armor ? armor.name : 'None', inline: true },
      { name: '⚡ Dmg Boost',          value: data.damageBoostActive ? '✅ ACTIVE' : 'None', inline: true }
    );
}

function buildBossActionRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('b_strike').setLabel('⚔️ Strike').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('b_defend').setLabel('🛡️ Defend').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('b_explosive').setLabel('💣 Explosive').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('b_parry').setLabel('🔰 Parry').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('b_flee').setLabel('🏃 Flee').setStyle(ButtonStyle.Secondary)
  );
}

function buildSpellRow(data) {
  const available = SPELLS.filter(s => data.spells[s.id] > 0);
  if (available.length === 0) return null;
  return new ActionRowBuilder().addComponents(
    available.map(s => new ButtonBuilder()
      .setCustomId(`spell_${s.id}`)
      .setLabel(`${s.name.split(' ')[0]} ${s.name.split(' ')[1]} (x${data.spells[s.id]})`)
      .setStyle(ButtonStyle.Primary)
    )
  );
}

function getBossComponents(data) {
  const components = [buildBossActionRow()];
  const spellRow = buildSpellRow(data);
  if (spellRow) components.push(spellRow);
  return components;
}

async function performBossRoom(msg, client, data, guildId, userId, username) {
  const boss = getBoss(data.currentRoom);
  if (!boss) return performRoom(msg, client, data, guildId, userId, username);

  await msg.edit({ embeds: [buildBossEmbed(boss, data, null)], components: getBossComponents(data) }).catch(err => {
    console.error('boss room initial edit failed:', err);
  });

  const collector = msg.createMessageComponentCollector({ time: 60000 });

  collector.on('collect', async btn => {
    try { await btn.deferUpdate(); } catch (e) { return; }
    if (btn.user.id !== userId) return;

    const equippedArmor = ARMOR_SHOP.find(a => a.id === data.equippedArmor);
    const armorBonus = equippedArmor ? equippedArmor.hpBonus : 0;
    const bossAction = Math.random() < 0.70 ? 'punch' : 'parry';

    let playerHpLoss = 0;
    let bossHpLoss = 0;
    let roundLog = '';
    const action = btn.customId;

    // ── FLEE ──────────────────────────────────────────────
    if (action === 'b_flee') {
      const goldLost = 100;
      data.gold = Math.max(0, data.gold - goldLost);
      collector.stop('fled');
      data.currentRoom++;
      client.memory.set(`dungeon_${guildId}_${userId}`, data);
      await saveStats(client.pool, userId, guildId, username, data.farthestRoom, data.totalGoldEarned);
      await btn.followUp({
        embeds: [new EmbedBuilder().setColor('#888888').setTitle('🏃 You fled the boss room!')
          .setDescription(`You escaped but lost **${goldLost} gold**.`)
          .addFields({ name: '🪙 Gold Left', value: `${data.gold}`, inline: true }, { name: '❤️ HP', value: `${data.hp}`, inline: true })],
        ephemeral: true
      }).catch(() => {});
      setTimeout(() => { if (data.inDungeon) performRoom(msg, client, data, guildId, userId, username); }, 2000);
      return;
    }

    // ── SPELLS ────────────────────────────────────────────
    if (action.startsWith('spell_')) {
      const spellId = action.replace('spell_', '');
      const spell = SPELLS.find(s => s.id === spellId);
      if (!spell || data.spells[spellId] <= 0) return;

      data.spells[spellId]--;
      let boost = data.damageBoostActive ? 2 : 1;
      data.damageBoostActive = false;

      bossHpLoss = spell.damage * boost;
      playerHpLoss = spell.selfDamage || 0;

      // Granat: boss skips attack (no bossAction damage)
      if (spellId === 'granat') {
        roundLog = `${spell.name} cast! Ice binds the boss — they cannot attack! **-${bossHpLoss} Boss HP**`;
      } else {
        roundLog = `${spell.name} cast!${boost > 1 ? ' ⚡ **BOOSTED!**' : ''} **-${bossHpLoss} Boss HP**${playerHpLoss > 0 ? ` / You take **-${playerHpLoss} HP**` : ''}`;
      }
    } else {
      // ── NORMAL BOSS ACTIONS ───────────────────────────────
      let boost = data.damageBoostActive ? 2 : 1;
      data.damageBoostActive = false;

      if (action === 'b_strike') {
        if (bossAction === 'punch') {
          playerHpLoss = Math.max(0, 20 - armorBonus);
          bossHpLoss = 25 * boost;
          roundLog = `You struck! Boss punched back. **-${playerHpLoss} HP** / **-${bossHpLoss} Boss HP**${boost > 1 ? ' ⚡ Boosted!' : ''}`;
        } else {
          playerHpLoss = Math.max(0, 10 - armorBonus);
          roundLog = `You struck but boss parried! **-${playerHpLoss} HP** / Boss blocked!`;
        }
      } else if (action === 'b_defend') {
        if (bossAction === 'punch') {
          playerHpLoss = Math.max(0, Math.floor((20 - armorBonus) / 2));
          roundLog = `You defended! Boss punched but you blocked most of it. **-${playerHpLoss} HP**`;
        } else {
          roundLog = `You defended... boss parried too. Stalemate. 😐`;
        }
      } else if (action === 'b_explosive') {
        if (bossAction === 'punch') {
          playerHpLoss = Math.max(0, 30 - armorBonus);
          bossHpLoss = 45 * boost;
          roundLog = `BOOM! Massive hit! Boss punched through it. **-${playerHpLoss} HP** / **-${bossHpLoss} Boss HP**${boost > 1 ? ' ⚡ Boosted!' : ''}`;
        } else {
          playerHpLoss = Math.max(0, 15 - armorBonus);
          bossHpLoss = 25 * boost;
          roundLog = `Explosion! Boss half-blocked. **-${playerHpLoss} HP** / **-${bossHpLoss} Boss HP**${boost > 1 ? ' ⚡ Boosted!' : ''}`;
        }
      } else if (action === 'b_parry') {
        if (bossAction === 'punch') {
          bossHpLoss = 30 * boost;
          roundLog = `🔰 PERFECT PARRY! You countered! **-${bossHpLoss} Boss HP**${boost > 1 ? ' ⚡ Boosted!' : ''}`;
        } else {
          playerHpLoss = Math.max(0, 8 - armorBonus);
          bossHpLoss = 8;
          roundLog = `⚡ PARRY CLASH! **-${playerHpLoss} HP** / **-${bossHpLoss} Boss HP**`;
        }
      }
    }

    data.hp = Math.max(0, data.hp - playerHpLoss);
    boss.currentHp = Math.max(0, boss.currentHp - bossHpLoss);

    // ── BOSS DEFEATED ──────────────────────────────────────
    if (boss.currentHp <= 0) {
      collector.stop('boss_dead');
      const goldReward = 450;
      data.gold += goldReward;
      if (data.gold > data.totalGoldEarned) data.totalGoldEarned = data.gold;
      data.currentRoom++;
      if (data.currentRoom > data.farthestRoom) data.farthestRoom = data.currentRoom;

      // Random spell drop (40% chance)
      let spellDrop = null;
      if (Math.random() < 0.4) {
        const randomSpell = SPELLS[Math.floor(Math.random() * SPELLS.length)];
        data.spells[randomSpell.id]++;
        spellDrop = randomSpell;
      }

      client.memory.set(`dungeon_${guildId}_${userId}`, data);
      await saveStats(client.pool, userId, guildId, username, data.farthestRoom, data.totalGoldEarned);

      await btn.followUp({
        embeds: [new EmbedBuilder().setColor('#FFD700')
          .setTitle(`🏆 ${boss.emoji} ${boss.name} Defeated!`)
          .setDescription(`${roundLog}\n\n*The boss crumbles! Gold spills everywhere!*${spellDrop ? `\n\n🔮 **Spell Drop: ${spellDrop.name}!**` : ''}`)
          .addFields(
            { name: '🪙 Gold Earned', value: `+${goldReward}`, inline: true },
            { name: '🪙 Total Gold',  value: `${data.gold}`,   inline: true },
            { name: '❤️ HP Left',     value: `${data.hp}`,     inline: true }
          )],
        ephemeral: true
      }).catch(() => {});

      await msg.edit({
        embeds: [new EmbedBuilder().setColor('#FFD700')
          .setTitle(`🏆 ${boss.emoji} ${boss.name} slain by ${username}!`)
          .setDescription(`*The dungeon shakes...*\n\n**+${goldReward} gold rewarded!**${spellDrop ? `\n🔮 **${spellDrop.name} dropped!**` : ''}`)],
        components: []
      }).catch(() => {});

      setTimeout(() => { if (data.inDungeon) performRoom(msg, client, data, guildId, userId, username); }, 3000);
      return;
    }

    // ── PLAYER DIED ────────────────────────────────────────
    if (data.hp <= 0) {
      collector.stop('player_dead');
      await saveStats(client.pool, userId, guildId, username, data.farthestRoom, data.totalGoldEarned);

      await btn.followUp({
        embeds: [new EmbedBuilder().setColor('#ff0000')
          .setTitle(`💀 Slain by ${boss.emoji} ${boss.name}!`)
          .setDescription(`${roundLog}\n\n*You collapse. The boss stands victorious.*`)
          .addFields(
            { name: '🪙 Gold After Penalty', value: `${Math.floor(data.gold * 0.5)}`, inline: true },
            { name: '🏆 Farthest Room Ever',  value: `${data.farthestRoom}`,           inline: true }
          )],
        ephemeral: true
      }).catch(() => {});

      const disabledAction = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('b_strike').setLabel('⚔️ Strike').setStyle(ButtonStyle.Danger).setDisabled(true),
        new ButtonBuilder().setCustomId('b_defend').setLabel('🛡️ Defend').setStyle(ButtonStyle.Primary).setDisabled(true),
        new ButtonBuilder().setCustomId('b_explosive').setLabel('💣 Explosive').setStyle(ButtonStyle.Danger).setDisabled(true),
        new ButtonBuilder().setCustomId('b_parry').setLabel('🔰 Parry').setStyle(ButtonStyle.Success).setDisabled(true),
        new ButtonBuilder().setCustomId('b_flee').setLabel('🏃 Flee').setStyle(ButtonStyle.Secondary).setDisabled(true)
      );

      await msg.edit({
        embeds: [new EmbedBuilder().setColor('#ff0000')
          .setTitle(`💀 ${username} was slain by ${boss.emoji} ${boss.name}!`)
          .setDescription('Reviving in 4 seconds... 50% gold penalty applied.')
          .addFields({ name: 'HP Bar', value: getDieBar(0), inline: false })],
        components: [disabledAction]
      }).catch(() => {});

      data.hp = 50;
      data.gold = Math.floor(data.gold * 0.5);
      data.currentRoom = 1;
      client.memory.set(`dungeon_${guildId}_${userId}`, data);
      setTimeout(() => { if (data.inDungeon) performRoom(msg, client, data, guildId, userId, username); }, 4000);
      return;
    }

    // ── ROUND CONTINUES ────────────────────────────────────
    client.memory.set(`dungeon_${guildId}_${userId}`, data);
    await msg.edit({
      embeds: [buildBossEmbed(boss, data, roundLog)],
      components: getBossComponents(data)
    }).catch(() => {});
  });

  collector.on('end', (collected, reason) => {
    if (reason === 'time') {
      const disabledAction = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('b_strike').setLabel('⚔️ Strike').setStyle(ButtonStyle.Danger).setDisabled(true),
        new ButtonBuilder().setCustomId('b_defend').setLabel('🛡️ Defend').setStyle(ButtonStyle.Primary).setDisabled(true),
        new ButtonBuilder().setCustomId('b_explosive').setLabel('💣 Explosive').setStyle(ButtonStyle.Danger).setDisabled(true),
        new ButtonBuilder().setCustomId('b_parry').setLabel('🔰 Parry').setStyle(ButtonStyle.Success).setDisabled(true),
        new ButtonBuilder().setCustomId('b_flee').setLabel('🏃 Flee').setStyle(ButtonStyle.Secondary).setDisabled(true)
      );
      msg.edit({ components: [disabledAction] }).catch(() => {});
    }
  });
}

// ── NORMAL ROOM ────────────────────────────────────────────────────────────

async function performRoom(msg, client, data, guildId, userId, username) {
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
      result = `⚔️ You fought to keep yourself alive!\nEarned **${goldGain} gold**${armorBonus > 0 ? ` | 🛡️ Blocked **${armorBonus} dmg**` : ''}.`;
    } else if (btn.customId === 'd_sneak') {
      goldGain = 25;
      // 25% chance of 3 damage
      if (Math.random() < 0.25) {
        hpLoss = 3;
        result = `🥷 You snuck past... but got grazed! **+${goldGain} gold** / **-${hpLoss} HP**`;
      } else {
        result = `🥷 Sneaked past safely! **+${goldGain} gold**`;
      }
    } else if (btn.customId === 'd_loot') {
      goldGain = 60;
      // 25% chance of 3 damage
      if (Math.random() < 0.25) {
        hpLoss = 3;
        result = `💰 Looted the room but triggered a trap! **+${goldGain} gold** / **-${hpLoss} HP**`;
      } else {
        result = `💰 Looted the room clean! **+${goldGain} gold**`;
      }
    } else if (btn.customId === 'd_surrender') {
      data.inDungeon = false;
      client.memory.set(`dungeon_${guildId}_${userId}`, data);
      await saveStats(client.pool, userId, guildId, username, data.farthestRoom, data.totalGoldEarned);
      await btn.followUp({
        embeds: [new EmbedBuilder().setColor('#ff0000').setTitle('🏳️ You surrendered.')
          .setDescription(`You gave up on room **${data.currentRoom}**.`)
          .addFields(
            { name: '🪙 Gold Kept', value: `${data.gold}`, inline: true },
            { name: '❤️ HP Left',   value: `${data.hp}`,   inline: true },
            { name: '🏆 Farthest',  value: `${data.farthestRoom}`, inline: true }
          )],
        ephemeral: true
      }).catch(() => {});
      await msg.edit({
        embeds: [new EmbedBuilder().setColor('#ff0000').setTitle('Run Over')
          .setDescription(`<@${userId}> surrendered on room **${data.currentRoom}**.`)],
        components: []
      }).catch(() => {});
      return;
    }

    data.hp = Math.max(0, data.hp - hpLoss);
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
        embeds: [new EmbedBuilder().setColor('#ff0000').setTitle('💀 You Died!')
          .setDescription(`Defeated on room **${data.currentRoom}**.\nEarned **${goldGain} gold** before dying.\nFarthest this run: **Room ${data.farthestRoom}**`)
          .addFields(
            { name: '🪙 Gold After Penalty', value: `${data.gold}`, inline: true },
            { name: '🏆 Farthest Ever',      value: `${data.farthestRoom}`, inline: true }
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
        embeds: [new EmbedBuilder().setColor('#ff0000')
          .setTitle(`💀 ${username} died on Room ${data.currentRoom}!`)
          .setDescription('Reviving in 4 seconds... 50% gold penalty applied.')
          .addFields({ name: 'HP Bar', value: getDieBar(0), inline: false })],
        components: [disabledRow]
      }).catch(() => {});

      data.currentRoom = 1;
    } else {
      data.currentRoom++;
      await btn.followUp({
        embeds: [new EmbedBuilder().setColor('#f0a500').setTitle('Room Result')
          .setDescription(result)
          .addFields(
            { name: 'HP Bar',         value: getDieBar(data.hp), inline: false },
            { name: '❤️ HP Left',     value: `${data.hp}`,       inline: true },
            { name: '🪙 Gold',        value: `${data.gold}`,     inline: true },
            { name: '🛡️ Armor',       value: equippedArmor ? equippedArmor.name : 'None', inline: true }
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
