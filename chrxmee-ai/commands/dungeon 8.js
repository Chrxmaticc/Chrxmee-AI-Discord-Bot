const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const OWNER_ID = '902685494247325776';

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

// 7 armors — max 7500g
const ARMOR_SHOP = [
  { id: 'leather',   name: '🟤 Leather Armor',  cost: 200,  hpBonus: 1, desc: '+1 DEF' },
  { id: 'iron',      name: '⚙️ Iron Armor',      cost: 500,  hpBonus: 2, desc: '+2 DEF' },
  { id: 'gold',      name: '🟡 Gold Armor',      cost: 1000, hpBonus: 3, desc: '+3 DEF' },
  { id: 'diamond',   name: '💎 Diamond Armor',   cost: 2000, hpBonus: 4, desc: '+4 DEF' },
  { id: 'obsidian',  name: '🌑 Obsidian Armor',  cost: 3500, hpBonus: 5, desc: '+5 DEF' },
  { id: 'mythril',   name: '🔱 Mythril Armor',   cost: 5500, hpBonus: 6, desc: '+6 DEF' },
  { id: 'celestial', name: '👼 Celestial Armor', cost: 7500, hpBonus: 7, desc: '+7 DEF' },
];

// Swords — replace Fight button, scale damage
const SWORDS = [
  { id: 'rusty',     name: '🗡️ Rusty Sword',     cost: 1225, bonusDmg: 5,  desc: '+5 bonus fight damage' },
  { id: 'steel',     name: '⚔️ Steel Sword',      cost: 2500, bonusDmg: 10, desc: '+10 bonus fight damage' },
  { id: 'enchanted', name: '✨ Enchanted Sword',  cost: 5000, bonusDmg: 18, desc: '+18 bonus fight damage' },
  { id: 'diamond',   name: '💎 Diamond Sword',    cost: 7500, bonusDmg: 25, desc: '+25 bonus fight damage' },
];

const POTIONS = [
  { id: 'health', name: '🧪 Health Potion', cost: 75,  desc: 'Restores 30 HP' },
  { id: 'damage', name: '⚔️ Damage Potion', cost: 100, desc: 'Doubles your next boss attack' },
  { id: 'cash',   name: '💰 Cash Potion',   cost: 80,  desc: 'Instantly grants 100 gold' },
];

const SPELLS = [
  { id: 'zoltrarok',  name: '✨ Zoltrarok',  cost: 200, damage: 20, selfDamage: 0,  desc: 'Frieren beam — 20 boss dmg' },
  { id: 'jilwer',     name: '🌊 Jilwer',     cost: 250, damage: 25, selfDamage: 0,  desc: 'Water current — 25 boss dmg' },
  { id: 'granat',     name: '❄️ Granat',     cost: 300, damage: 15, selfDamage: 0,  desc: 'Ice bind — 15 dmg, boss skips turn' },
  { id: 'judradjim',  name: '🔥 Judradjim',  cost: 350, damage: 30, selfDamage: 10, desc: '30 boss dmg, you take 10 HP' },
  { id: 'vollzanbel', name: '🌑 Vollzanbel', cost: 400, damage: 40, selfDamage: 15, desc: '40 boss dmg, you take 15 HP' },
];

// Pet definitions — stored in /pet command's memory, read here for buffs
const PETS = [
  { id: 'wolf',   name: '🐺 Wolf',        desc: '+10 bonus combat damage in dungeon' },
  { id: 'dragon', name: '🐉 Baby Dragon', desc: '+8 combat dmg + 50g per boss kill' },
  { id: 'cat',    name: '🐱 Cat',         desc: '+15g every room' },
  { id: 'fox',    name: '🦊 Fox',         desc: '20% chance to steal +30 extra gold per room' },
  { id: 'bear',   name: '🐻 Bear',        desc: 'Reduces ALL damage taken by 3' },
];

function getPetBuffs(client, guildId, userId) {
  // Reads active pets from the shared pet memory key
  const petData = client.memory.get(`pets_${guildId}_${userId}`);
  if (!petData || !petData.active) return [];
  return petData.active; // array of pet ids
}

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
    equippedSword: null,
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
  if (!('equippedSword' in data)) data.equippedSword = null;
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

function buildShopEmbed(data) {
  const armorLines = ARMOR_SHOP.map(a => {
    const owned = data.inventory.includes(a.id);
    return `${a.name} — **${a.cost}g** — ${a.desc}${owned ? ' ✅' : ''}`;
  });
  const swordLines = SWORDS.map(s => {
    const owned = data.inventory.includes(`sword_${s.id}`);
    const equipped = data.equippedSword === s.id;
    return `${s.name} — **${s.cost}g** — ${s.desc}${owned ? (equipped ? ' ✅ Equipped' : ' ✅ Owned') : ''}`;
  });
  const potionLines = POTIONS.map(p => `${p.name} — **${p.cost}g** — ${p.desc} (own: ${data.potions[p.id] || 0})`);
  const spellLines = SPELLS.map(s => `${s.name} — **${s.cost}g** — ${s.desc} (own: ${data.spells[s.id] || 0})`);
  return new EmbedBuilder()
    .setColor('#f0a500')
    .setTitle('🏪 Dungeon Shop')
    .addFields(
      { name: '🛡️ Armor', value: armorLines.join('\n'), inline: false },
      { name: '⚔️ Swords (upgrades Fight)', value: swordLines.join('\n'), inline: false },
      { name: '🧪 Potions', value: potionLines.join('\n'), inline: false },
      { name: '🔮 Spells (Boss Rooms Only)', value: spellLines.join('\n'), inline: false },
    )
    .addFields({ name: '🪙 Your Gold', value: `${data.gold}`, inline: true })
    .setFooter({ text: 'Spells can also drop from boss kills!' });
}

function buildShopRows(data) {
  const rows = [];

  // Row 1: Armor 1-5
  rows.push(new ActionRowBuilder().addComponents(
    ARMOR_SHOP.slice(0, 5).map(a => {
      const owned = data.inventory.includes(a.id);
      return new ButtonBuilder()
        .setCustomId(`shop_armor_${a.id}`)
        .setLabel(`${owned ? '✅' : '🛡️'} ${a.name.split(' ').slice(1, 3).join(' ')}`)
        .setStyle(owned ? ButtonStyle.Secondary : ButtonStyle.Primary)
        .setDisabled(owned);
    })
  ));

  // Row 2: Armor 6-7 + Swords 1-3
  rows.push(new ActionRowBuilder().addComponents([
    ...ARMOR_SHOP.slice(5).map(a => {
      const owned = data.inventory.includes(a.id);
      return new ButtonBuilder()
        .setCustomId(`shop_armor_${a.id}`)
        .setLabel(`${owned ? '✅' : '🛡️'} ${a.name.split(' ').slice(1, 3).join(' ')}`)
        .setStyle(owned ? ButtonStyle.Secondary : ButtonStyle.Primary)
        .setDisabled(owned);
    }),
    ...SWORDS.slice(0, 3).map(s => {
      const owned = data.inventory.includes(`sword_${s.id}`);
      return new ButtonBuilder()
        .setCustomId(`shop_sword_${s.id}`)
        .setLabel(`${owned ? '✅' : '⚔️'} ${s.name.split(' ').slice(1, 3).join(' ')}`)
        .setStyle(owned ? ButtonStyle.Secondary : ButtonStyle.Danger)
        .setDisabled(owned);
    })
  ]));

  // Row 3: Diamond sword + Potions
  rows.push(new ActionRowBuilder().addComponents([
    ...SWORDS.slice(3).map(s => {
      const owned = data.inventory.includes(`sword_${s.id}`);
      return new ButtonBuilder()
        .setCustomId(`shop_sword_${s.id}`)
        .setLabel(`${owned ? '✅' : '⚔️'} ${s.name.split(' ').slice(1, 3).join(' ')}`)
        .setStyle(owned ? ButtonStyle.Secondary : ButtonStyle.Danger)
        .setDisabled(owned);
    }),
    ...POTIONS.map(p => new ButtonBuilder()
      .setCustomId(`shop_potion_${p.id}`)
      .setLabel(`Buy ${p.name.split(' ')[1]}`)
      .setStyle(ButtonStyle.Success)
    )
  ]));

  // Row 4: Spells
  rows.push(new ActionRowBuilder().addComponents(
    SPELLS.map(s => new ButtonBuilder()
      .setCustomId(`shop_spell_${s.id}`)
      .setLabel(`Buy ${s.name.split(' ')[1]}`)
      .setStyle(ButtonStyle.Primary)
    )
  ));

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
    .addSubcommand(sub => sub.setName('shop').setDescription('Buy armor, swords, potions and spells'))
    .addSubcommand(sub =>
      sub.setName('equip')
        .setDescription('Equip armor or a sword')
        .addStringOption(opt =>
          opt.setName('item').setDescription('What to equip').setRequired(true)
            .addChoices(
              { name: '🟤 Leather Armor',   value: 'armor_leather'   },
              { name: '⚙️ Iron Armor',      value: 'armor_iron'      },
              { name: '🟡 Gold Armor',      value: 'armor_gold'      },
              { name: '💎 Diamond Armor',   value: 'armor_diamond'   },
              { name: '🌑 Obsidian Armor',  value: 'armor_obsidian'  },
              { name: '🔱 Mythril Armor',   value: 'armor_mythril'   },
              { name: '👼 Celestial Armor', value: 'armor_celestial' },
              { name: '🗡️ Rusty Sword',     value: 'sword_rusty'     },
              { name: '⚔️ Steel Sword',     value: 'sword_steel'     },
              { name: '✨ Enchanted Sword', value: 'sword_enchanted'  },
              { name: '💎 Diamond Sword',   value: 'sword_diamond'   }
            )
        )
    )
    .addSubcommand(sub => sub.setName('leaderboard').setDescription('View the dungeon leaderboard'))
    .addSubcommand(sub =>
      sub.setName('gold')
        .setDescription('(Owner only) Give gold to a user')
        .addUserOption(opt => opt.setName('user').setDescription('Who to give gold to').setRequired(true))
        .addIntegerOption(opt => opt.setName('amount').setDescription('Amount of gold to give').setRequired(true).setMinValue(1))
    ),

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

    // ── GOLD (owner only) ──────────────────────────────────
    if (sub === 'gold') {
      if (userId !== OWNER_ID) {
        return interaction.editReply({ content: '❌ Only the bot owner can use this command.', ephemeral: true });
      }
      const target = interaction.options.getUser('user');
      const amount = interaction.options.getInteger('amount');
      const targetKey = `dungeon_${guildId}_${target.id}`;
      let targetData = client.memory.get(targetKey) || getDefaultData(target.id);
      targetData = migrateData(targetData, target.id);
      targetData.gold += amount;
      if (targetData.gold > targetData.totalGoldEarned) targetData.totalGoldEarned = targetData.gold;
      client.memory.set(targetKey, targetData);
      return interaction.editReply(`✅ Gave **${amount} gold** to **${target.username}**! They now have **${targetData.gold}g**.`);
    }

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
      const sword = SWORDS.find(s => s.id === data.equippedSword);
      const activePets = getPetBuffs(client, guildId, userId);
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
          { name: '🛡️ Armor',          value: armor ? armor.name : 'None', inline: true },
          { name: '⚔️ Sword',          value: sword ? sword.name : 'None (fists)', inline: true },
          { name: '🐾 Active Pets',    value: activePets.length > 0 ? activePets.join(', ') : 'None', inline: false },
          { name: '⚡ Damage Boost',   value: data.damageBoostActive ? 'ACTIVE' : 'Inactive', inline: true },
          { name: '🧪 Potions',        value: potionLines, inline: false },
          { name: '🔮 Spells',         value: spellLines, inline: false },
        );
      return interaction.editReply({ embeds: [embed] });
    }

    // ── INVENTORY ──────────────────────────────────────────
    if (sub === 'inventory') {
      const armor = ARMOR_SHOP.find(a => a.id === data.equippedArmor);
      const sword = SWORDS.find(s => s.id === data.equippedSword);
      const armorLines = data.inventory.filter(id => !id.startsWith('sword_')).length > 0
        ? data.inventory.filter(id => !id.startsWith('sword_')).map(id => {
            const a = ARMOR_SHOP.find(x => x.id === id);
            return a ? `${a.name} — ${a.desc}${data.equippedArmor === id ? ' ✅ Equipped' : ''}` : null;
          }).filter(Boolean).join('\n')
        : 'No armor owned.';
      const swordLines = data.inventory.filter(id => id.startsWith('sword_')).length > 0
        ? data.inventory.filter(id => id.startsWith('sword_')).map(id => {
            const s = SWORDS.find(x => `sword_${x.id}` === id);
            return s ? `${s.name} — ${s.desc}${data.equippedSword === s.id ? ' ✅ Equipped' : ''}` : null;
          }).filter(Boolean).join('\n')
        : 'No swords owned.';
      const potionLines = POTIONS.map(p => `${p.name} x${data.potions[p.id]} — ${p.desc}`).join('\n');
      const spellLines = SPELLS.map(s => `${s.name} x${data.spells[s.id]} — ${s.desc}`).join('\n');

      const embed = new EmbedBuilder()
        .setColor('#2f3136')
        .setTitle('🎒 Your Dungeon Inventory')
        .addFields(
          { name: '🛡️ Armor', value: armorLines, inline: false },
          { name: '⚔️ Swords', value: swordLines, inline: false },
          { name: '🧪 Potions', value: potionLines, inline: false },
          { name: '🔮 Spells (Boss Rooms Only)', value: spellLines, inline: false },
          { name: '🪙 Gold', value: `${data.gold}`, inline: true },
          { name: '❤️ HP', value: `${data.hp}`, inline: true },
        );

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
        data = client.memory.get(`dungeon_${guildId}_${userId}`) || data;
        const potionId = btn.customId.replace('inv_use_', '');
        const potion = POTIONS.find(p => p.id === potionId);
        if (!potion || data.potions[potionId] <= 0) return;
        data.potions[potionId]--;
        let result = '';
        if (potionId === 'health') {
          if (!data.inDungeon) { data.potions[potionId]++; return btn.followUp({ content: '❌ Health potions can only be used inside a dungeon!', ephemeral: true }).catch(() => {}); }
          const healed = Math.min(30, 100 - data.hp);
          data.hp = Math.min(100, data.hp + 30);
          result = `🧪 Restored **${healed} HP**. HP is now **${data.hp}**.`;
        } else if (potionId === 'damage') {
          if (!data.inDungeon) { data.potions[potionId]++; return btn.followUp({ content: '❌ Damage potions can only be used inside a dungeon!', ephemeral: true }).catch(() => {}); }
          data.damageBoostActive = true;
          result = '⚔️ Damage Potion active! Next boss attack deals **double damage**!';
        } else if (potionId === 'cash') {
          data.gold += 100;
          if (data.gold > data.totalGoldEarned) data.totalGoldEarned = data.gold;
          result = '💰 **+100 gold** added!';
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
          if (data.inventory.includes(armorId)) { reply = '❌ Already owned!'; }
          else if (data.gold < armor.cost) { reply = `❌ Need **${armor.cost}g**, you have **${data.gold}g**.`; }
          else { data.gold -= armor.cost; data.inventory.push(armorId); reply = `✅ Bought **${armor.name}**! Use \`/dungeon equip\`.\n🪙 Gold left: **${data.gold}**`; }
        } else if (cid.startsWith('shop_sword_')) {
          const swordId = cid.replace('shop_sword_', '');
          const sword = SWORDS.find(s => s.id === swordId);
          if (!sword) return;
          const invKey = `sword_${swordId}`;
          if (data.inventory.includes(invKey)) { reply = '❌ Already owned!'; }
          else if (data.gold < sword.cost) { reply = `❌ Need **${sword.cost}g**, you have **${data.gold}g**.`; }
          else { data.gold -= sword.cost; data.inventory.push(invKey); reply = `✅ Bought **${sword.name}**! Use \`/dungeon equip\` to equip it.\n🪙 Gold left: **${data.gold}**`; }
        } else if (cid.startsWith('shop_potion_')) {
          const potionId = cid.replace('shop_potion_', '');
          const potion = POTIONS.find(p => p.id === potionId);
          if (!potion) return;
          if (data.gold < potion.cost) { reply = `❌ Need **${potion.cost}g**, you have **${data.gold}g**.`; }
          else { data.gold -= potion.cost; data.potions[potionId]++; reply = `✅ Bought **${potion.name}**! You now have **${data.potions[potionId]}**.\n🪙 Gold left: **${data.gold}**`; }
        } else if (cid.startsWith('shop_spell_')) {
          const spellId = cid.replace('shop_spell_', '');
          const spell = SPELLS.find(s => s.id === spellId);
          if (!spell) return;
          if (data.gold < spell.cost) { reply = `❌ Need **${spell.cost}g**, you have **${data.gold}g**.`; }
          else { data.gold -= spell.cost; data.spells[spellId]++; reply = `✅ Bought **${spell.name}**! You now have **${data.spells[spellId]}**.\n🪙 Gold left: **${data.gold}**`; }
        }

        client.memory.set(`dungeon_${guildId}_${userId}`, data);
        if (reply) await btn.followUp({ content: reply, ephemeral: true }).catch(() => {});
      });

      collector.on('end', () => { shopMsg.edit({ components: [] }).catch(() => {}); });
      return;
    }

    // ── EQUIP ──────────────────────────────────────────────
    if (sub === 'equip') {
      const item = interaction.options.getString('item');
      const [type, id] = item.split('_');
      if (type === 'armor') {
        if (!data.inventory.includes(id)) return interaction.editReply(`❌ You don't own that armor!`);
        data.equippedArmor = id;
        client.memory.set(`dungeon_${guildId}_${userId}`, data);
        const armor = ARMOR_SHOP.find(a => a.id === id);
        return interaction.editReply(`✅ Equipped **${armor.name}**!`);
      } else if (type === 'sword') {
        if (!data.inventory.includes(`sword_${id}`)) return interaction.editReply(`❌ You don't own that sword!`);
        data.equippedSword = id;
        client.memory.set(`dungeon_${guildId}_${userId}`, data);
        const sword = SWORDS.find(s => s.id === id);
        return interaction.editReply(`✅ Equipped **${sword.name}**! ${sword.desc}.`);
      }
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
  const sword = SWORDS.find(s => s.id === data.equippedSword);
  return new EmbedBuilder()
    .setColor('#ff4444')
    .setTitle(`⚠️ BOSS ROOM — ${boss.emoji} ${boss.name}`)
    .setDescription(`*${boss.flavor}*\n\n${roundLog ? `**Last round:** ${roundLog}\n` : ''}\nChoose your action:`)
    .addFields(
      { name: `${boss.emoji} Boss HP`, value: `${getBossBar(boss.currentHp, boss.maxHp)} ${boss.currentHp}/${boss.maxHp}`, inline: false },
      { name: '❤️ Your HP Bar',        value: getDieBar(data.hp), inline: false },
      { name: '❤️ HP',   value: `${data.hp}`,  inline: true },
      { name: '🪙 Gold', value: `${data.gold}`, inline: true },
      { name: '🛡️ Armor', value: armor ? armor.name : 'None', inline: true },
      { name: '⚔️ Sword', value: sword ? sword.name : 'Fists', inline: true },
      { name: '⚡ Dmg Boost', value: data.damageBoostActive ? '✅ ACTIVE' : 'None', inline: true }
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
    console.error('boss room edit failed:', err);
  });

  const collector = msg.createMessageComponentCollector({ time: 60000 });

  collector.on('collect', async btn => {
    try { await btn.deferUpdate(); } catch (e) { return; }
    if (btn.user.id !== userId) return;

    const equippedArmor = ARMOR_SHOP.find(a => a.id === data.equippedArmor);
    const equippedSword = SWORDS.find(s => s.id === data.equippedSword);
    const activePets = getPetBuffs(client, guildId, userId);
    const armorBonus = (equippedArmor ? equippedArmor.hpBonus : 0) + (activePets.includes('bear') ? 3 : 0);
    const swordBonus = equippedSword ? equippedSword.bonusDmg : 0;
    const wolfBonus = activePets.includes('wolf') ? 10 : 0;
    const dragonBonus = activePets.includes('dragon') ? 8 : 0;
    const totalAttackBonus = swordBonus + wolfBonus + dragonBonus;
    const bossAction = Math.random() < 0.70 ? 'punch' : 'parry';

    let playerHpLoss = 0;
    let bossHpLoss = 0;
    let roundLog = '';
    const action = btn.customId;

    if (action === 'b_flee') {
      const goldLost = 100;
      data.gold = Math.max(0, data.gold - goldLost);
      collector.stop('fled');
      data.currentRoom++;
      client.memory.set(`dungeon_${guildId}_${userId}`, data);
      await saveStats(client.pool, userId, guildId, username, data.farthestRoom, data.totalGoldEarned);
      await btn.followUp({
        embeds: [new EmbedBuilder().setColor('#888888').setTitle('🏃 You fled!')
          .setDescription(`Lost **${goldLost} gold** in the chaos.`)
          .addFields({ name: '🪙 Gold Left', value: `${data.gold}`, inline: true }, { name: '❤️ HP', value: `${data.hp}`, inline: true })],
        ephemeral: true
      }).catch(() => {});
      setTimeout(() => { if (data.inDungeon) performRoom(msg, client, data, guildId, userId, username); }, 2000);
      return;
    }

    if (action.startsWith('spell_')) {
      const spellId = action.replace('spell_', '');
      const spell = SPELLS.find(s => s.id === spellId);
      if (!spell || data.spells[spellId] <= 0) return;
      data.spells[spellId]--;
      const boost = data.damageBoostActive ? 2 : 1;
      data.damageBoostActive = false;
      bossHpLoss = spell.damage * boost;
      playerHpLoss = spell.selfDamage || 0;
      if (spellId === 'granat') {
        roundLog = `${spell.name} cast! Ice binds the boss — skips their turn! **-${bossHpLoss} Boss HP**`;
      } else {
        roundLog = `${spell.name} cast!${boost > 1 ? ' ⚡ BOOSTED!' : ''} **-${bossHpLoss} Boss HP**${playerHpLoss > 0 ? ` / You take **-${playerHpLoss} HP**` : ''}`;
      }
    } else {
      const boost = data.damageBoostActive ? 2 : 1;
      data.damageBoostActive = false;

      if (action === 'b_strike') {
        if (bossAction === 'punch') {
          playerHpLoss = Math.max(0, 20 - armorBonus);
          bossHpLoss = (25 + totalAttackBonus) * boost;
          roundLog = `You struck! Boss punched. **-${playerHpLoss} HP** / **-${bossHpLoss} Boss HP**${boost > 1 ? ' ⚡ Boosted!' : ''}`;
        } else {
          playerHpLoss = Math.max(0, 10 - armorBonus);
          roundLog = `You struck but boss parried! **-${playerHpLoss} HP** / Boss blocked!`;
        }
      } else if (action === 'b_defend') {
        if (bossAction === 'punch') {
          playerHpLoss = Math.max(0, Math.floor((20 - armorBonus) / 2));
          roundLog = `You defended! Boss punched but blocked. **-${playerHpLoss} HP**`;
        } else {
          roundLog = `Both defending... stalemate. 😐`;
        }
      } else if (action === 'b_explosive') {
        if (bossAction === 'punch') {
          playerHpLoss = Math.max(0, 30 - armorBonus);
          bossHpLoss = (45 + totalAttackBonus) * boost;
          roundLog = `BOOM! Boss punched through it. **-${playerHpLoss} HP** / **-${bossHpLoss} Boss HP**${boost > 1 ? ' ⚡!' : ''}`;
        } else {
          playerHpLoss = Math.max(0, 15 - armorBonus);
          bossHpLoss = (25 + totalAttackBonus) * boost;
          roundLog = `Explosion! Boss half-blocked. **-${playerHpLoss} HP** / **-${bossHpLoss} Boss HP**`;
        }
      } else if (action === 'b_parry') {
        if (bossAction === 'punch') {
          bossHpLoss = (30 + totalAttackBonus) * boost;
          roundLog = `🔰 PERFECT PARRY! Countered! **-${bossHpLoss} Boss HP**${boost > 1 ? ' ⚡!' : ''}`;
        } else {
          playerHpLoss = Math.max(0, 8 - armorBonus);
          bossHpLoss = 8;
          roundLog = `⚡ PARRY CLASH! **-${playerHpLoss} HP** / **-${bossHpLoss} Boss HP**`;
        }
      }
    }

    data.hp = Math.max(0, data.hp - playerHpLoss);
    boss.currentHp = Math.max(0, boss.currentHp - bossHpLoss);

    // Boss defeated
    if (boss.currentHp <= 0) {
      collector.stop('boss_dead');
      const activePets = getPetBuffs(client, guildId, userId);
      const dragonGold = activePets.includes('dragon') ? 50 : 0;
      const goldReward = 450 + dragonGold;
      data.gold += goldReward;
      if (data.gold > data.totalGoldEarned) data.totalGoldEarned = data.gold;
      data.currentRoom++;
      if (data.currentRoom > data.farthestRoom) data.farthestRoom = data.currentRoom;

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
          .setDescription(`${roundLog}\n\n*The boss crumbles!*${dragonGold > 0 ? `\n🐉 Baby Dragon bonus: **+${dragonGold}g!**` : ''}${spellDrop ? `\n🔮 **Spell Drop: ${spellDrop.name}!**` : ''}`)
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
          .setDescription(`**+${goldReward} gold!**${spellDrop ? `\n🔮 **${spellDrop.name} dropped!**` : ''}`)],
        components: []
      }).catch(() => {});

      setTimeout(() => { if (data.inDungeon) performRoom(msg, client, data, guildId, userId, username); }, 3000);
      return;
    }

    // Player died
    if (data.hp <= 0) {
      collector.stop('player_dead');
      await saveStats(client.pool, userId, guildId, username, data.farthestRoom, data.totalGoldEarned);

      await btn.followUp({
        embeds: [new EmbedBuilder().setColor('#ff0000')
          .setTitle(`💀 Slain by ${boss.emoji} ${boss.name}!`)
          .setDescription(`${roundLog}\n\n*You collapse.*`)
          .addFields(
            { name: '🪙 Gold After Penalty', value: `${Math.floor(data.gold * 0.5)}`, inline: true },
            { name: '🏆 Farthest Ever',      value: `${data.farthestRoom}`,           inline: true }
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
        embeds: [new EmbedBuilder().setColor('#ff0000')
          .setTitle(`💀 ${username} slain by ${boss.emoji} ${boss.name}!`)
          .setDescription('Reviving in 4 seconds... 50% gold penalty.')
          .addFields({ name: 'HP Bar', value: getDieBar(0), inline: false })],
        components: [disabledRow]
      }).catch(() => {});

      data.hp = 50;
      data.gold = Math.floor(data.gold * 0.5);
      data.currentRoom = 1;
      client.memory.set(`dungeon_${guildId}_${userId}`, data);
      setTimeout(() => { if (data.inDungeon) performRoom(msg, client, data, guildId, userId, username); }, 4000);
      return;
    }

    // Round continues
    client.memory.set(`dungeon_${guildId}_${userId}`, data);
    await msg.edit({ embeds: [buildBossEmbed(boss, data, roundLog)], components: getBossComponents(data) }).catch(() => {});
  });

  collector.on('end', (collected, reason) => {
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
  if (data.currentRoom % 10 === 0) {
    return performBossRoom(msg, client, data, guildId, userId, username);
  }

  const roomTheme = ROOM_THEMES[Math.floor(Math.random() * ROOM_THEMES.length)];
  const mazeIndex = Math.min(data.currentRoom - 1, MAZE_LAYOUTS.length - 1);
  const maze = MAZE_LAYOUTS[mazeIndex];
  const armor = ARMOR_SHOP.find(a => a.id === data.equippedArmor);
  const sword = SWORDS.find(s => s.id === data.equippedSword);
  const activePets = getPetBuffs(client, guildId, userId);
  const catGold = activePets.includes('cat') ? 15 : 0;

  const embed = new EmbedBuilder()
    .setColor('#2f3136')
    .setTitle(`Room ${data.currentRoom} — ${roomTheme}`)
    .setDescription(`Maze:\n${maze}\n\nChoose one action:`)
    .addFields(
      { name: 'HP Bar', value: getDieBar(data.hp), inline: false },
      { name: '❤️ HP',   value: `${data.hp}`,  inline: true },
      { name: '🪙 Gold', value: `${data.gold}`, inline: true },
      { name: '🛡️ Armor', value: armor ? armor.name : 'None', inline: true },
      { name: '⚔️ Sword', value: sword ? sword.name : 'Fists', inline: true },
      { name: '🐾 Pets',  value: activePets.length > 0 ? activePets.join(', ') : 'None', inline: true }
    );

  // Fight label changes based on equipped sword
  const fightLabel = sword ? `${sword.name.split(' ')[0]} Attack` : 'Fight';

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('d_fight').setLabel(fightLabel).setStyle(ButtonStyle.Danger),
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
    const equippedSword = SWORDS.find(s => s.id === data.equippedSword);
    const activePetsNow = getPetBuffs(client, guildId, userId);
    const armorBonus = (equippedArmor ? equippedArmor.hpBonus : 0) + (activePetsNow.includes('bear') ? 3 : 0);
    const swordBonus = equippedSword ? equippedSword.bonusDmg : 0;
    const wolfBonus = activePetsNow.includes('wolf') ? 10 : 0;
    const catBonus = activePetsNow.includes('cat') ? 15 : 0;
    const foxRoll = activePetsNow.includes('fox') && Math.random() < 0.2;

    let result = '';
    let hpLoss = 0;
    let goldGain = 0;

    if (btn.customId === 'd_fight') {
      hpLoss = Math.max(0, 15 - armorBonus);
      goldGain = 40 + catBonus + (foxRoll ? 30 : 0);
      const totalDmgBonus = swordBonus + wolfBonus;
      result = `⚔️ ${equippedSword ? equippedSword.name : 'Fists'} attack!\nEarned **${goldGain} gold**${armorBonus > 0 ? ` | 🛡️ Blocked **${armorBonus} dmg**` : ''}${totalDmgBonus > 0 ? ` | +${totalDmgBonus} bonus dmg` : ''}${foxRoll ? ' | 🦊 Fox stole **+30g!**' : ''}`;
    } else if (btn.customId === 'd_sneak') {
      goldGain = 25 + catBonus + (foxRoll ? 30 : 0);
      if (Math.random() < 0.25) {
        hpLoss = 3;
        result = `🥷 Sneaked past but got grazed! **+${goldGain} gold** / **-${hpLoss} HP**${foxRoll ? ' | 🦊 Fox stole **+30g!**' : ''}`;
      } else {
        result = `🥷 Sneaked past safely! **+${goldGain} gold**${foxRoll ? ' | 🦊 Fox stole **+30g!**' : ''}`;
      }
    } else if (btn.customId === 'd_loot') {
      goldGain = 60 + catBonus + (foxRoll ? 30 : 0);
      if (Math.random() < 0.25) {
        hpLoss = 3;
        result = `💰 Looted but triggered a trap! **+${goldGain} gold** / **-${hpLoss} HP**${foxRoll ? ' | 🦊 Fox stole **+30g!**' : ''}`;
      } else {
        result = `💰 Looted clean! **+${goldGain} gold**${foxRoll ? ' | 🦊 Fox stole **+30g!**' : ''}`;
      }
    } else if (btn.customId === 'd_surrender') {
      data.inDungeon = false;
      client.memory.set(`dungeon_${guildId}_${userId}`, data);
      await saveStats(client.pool, userId, guildId, username, data.farthestRoom, data.totalGoldEarned);
      await btn.followUp({
        embeds: [new EmbedBuilder().setColor('#ff0000').setTitle('🏳️ You surrendered.')
          .setDescription(`Gave up on room **${data.currentRoom}**.`)
          .addFields(
            { name: '🪙 Gold Kept', value: `${data.gold}`,         inline: true },
            { name: '❤️ HP Left',   value: `${data.hp}`,           inline: true },
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
          .setDescription(`Defeated on room **${data.currentRoom}**.\nEarned **${goldGain} gold** before dying.`)
          .addFields(
            { name: '🪙 Gold After Penalty', value: `${data.gold}`,         inline: true },
            { name: '🏆 Farthest Ever',      value: `${data.farthestRoom}`, inline: true }
          )],
        ephemeral: true
      }).catch(() => {});

      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('d_fight').setLabel(fightLabel).setStyle(ButtonStyle.Danger).setDisabled(true),
        new ButtonBuilder().setCustomId('d_sneak').setLabel('Sneak').setStyle(ButtonStyle.Primary).setDisabled(true),
        new ButtonBuilder().setCustomId('d_loot').setLabel('Loot').setStyle(ButtonStyle.Success).setDisabled(true),
        new ButtonBuilder().setCustomId('d_surrender').setLabel('Surrender').setStyle(ButtonStyle.Secondary).setDisabled(true)
      );
      await msg.edit({
        embeds: [new EmbedBuilder().setColor('#ff0000')
          .setTitle(`💀 ${username} died on Room ${data.currentRoom}!`)
          .setDescription('Reviving in 4 seconds... 50% gold penalty.')
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
            { name: 'HP Bar',     value: getDieBar(data.hp), inline: false },
            { name: '❤️ HP Left', value: `${data.hp}`,       inline: true },
            { name: '🪙 Gold',    value: `${data.gold}`,     inline: true },
            { name: '🛡️ Armor',   value: equippedArmor ? equippedArmor.name : 'None', inline: true }
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
        new ButtonBuilder().setCustomId('d_fight').setLabel(fightLabel).setStyle(ButtonStyle.Danger).setDisabled(true),
        new ButtonBuilder().setCustomId('d_sneak').setLabel('Sneak').setStyle(ButtonStyle.Primary).setDisabled(true),
        new ButtonBuilder().setCustomId('d_loot').setLabel('Loot').setStyle(ButtonStyle.Success).setDisabled(true),
        new ButtonBuilder().setCustomId('d_surrender').setLabel('Surrender').setStyle(ButtonStyle.Secondary).setDisabled(true)
      );
      msg.edit({ components: [disabledRow] }).catch(() => {});
    }
  });
}
