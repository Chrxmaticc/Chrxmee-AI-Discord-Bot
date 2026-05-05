const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const OWNER_IDS = ['902685494247325776', '954709865698312213']; // multiple owners

// ── DEPTHS ─────────────────────────────────────────────────────────────────
const DEPTHS = [
  { level: 1, name: '🌿 Surface',         caveInBase: 0.05, xpMult: 1.0, pickaxeReq: 'wooden'    },
  { level: 2, name: '🪨 Shallow Cave',    caveInBase: 0.08, xpMult: 1.2, pickaxeReq: 'stone'     },
  { level: 3, name: '⛏️ Deep Cave',       caveInBase: 0.11, xpMult: 1.5, pickaxeReq: 'iron'      },
  { level: 4, name: '🌑 Underground',     caveInBase: 0.15, xpMult: 1.8, pickaxeReq: 'gold'      },
  { level: 5, name: '🕳️ Dark Depths',    caveInBase: 0.20, xpMult: 2.2, pickaxeReq: 'diamond'   },
  { level: 6, name: '💎 Crystal Cavern',  caveInBase: 0.25, xpMult: 2.7, pickaxeReq: 'netherite' },
  { level: 7, name: '🔥 Magma Zone',      caveInBase: 0.30, xpMult: 3.3, pickaxeReq: 'obsidian'  },
  { level: 8, name: '🏛️ Ancient Ruins',  caveInBase: 0.35, xpMult: 4.0, pickaxeReq: 'void'      },
  { level: 9, name: '👁️ Void Edge',      caveInBase: 0.42, xpMult: 5.0, pickaxeReq: 'celestial' },
  { level: 10,name: '🌀 The Abyss',      caveInBase: 0.50, xpMult: 6.5, pickaxeReq: 'celestial'  },
];

// ── PICKAXES ───────────────────────────────────────────────────────────────
const PICKAXES = [
  { id: 'wooden',    name: '🪵 Wooden',     cost: 0,      resist: 0,    durability: 80,  repairCost: 10  },
  { id: 'stone',     name: '🪨 Stone',      cost: 200,    resist: 0.05, durability: 100, repairCost: 25  },
  { id: 'iron',      name: '⚙️ Iron',       cost: 500,    resist: 0.10, durability: 120, repairCost: 60  },
  { id: 'gold',      name: '🟡 Gold',       cost: 1000,   resist: 0.15, durability: 100, repairCost: 100 },
  { id: 'diamond',   name: '💎 Diamond',    cost: 2500,   resist: 0.20, durability: 150, repairCost: 200 },
  { id: 'netherite', name: '🔱 Netherite',  cost: 5000,   resist: 0.30, durability: 200, repairCost: 350 },
  { id: 'obsidian',  name: '🌑 Obsidian',   cost: 8000,   resist: 0.38, durability: 180, repairCost: 450 },
  { id: 'void',      name: '👁️ Void',       cost: 12000,  resist: 0.45, durability: 220, repairCost: 600 },
  { id: 'celestial', name: '✨ Celestial',  cost: 18000,  resist: 0.55, durability: 300, repairCost: 800 },
];

const PICKAXE_ORDER = PICKAXES.map(p => p.id);

// ── ORES ───────────────────────────────────────────────────────────────────
const ORES = [
  { id: 'stone',     name: '🪨 Stone',      baseChance: 0.27, baseValue: 5,    minDepth: 1, smeltable: false },
  { id: 'granite',   name: '🟤 Granite',    baseChance: 0.16, baseValue: 10,   minDepth: 1, smeltable: false },
  { id: 'quartz',    name: '⬜ Quartz',     baseChance: 0.13, baseValue: 18,   minDepth: 1, smeltable: false },
  { id: 'copper',    name: '🟠 Copper',     baseChance: 0.10, baseValue: 25,   minDepth: 1, smeltable: true  },
  { id: 'iron',      name: '⚙️ Iron',       baseChance: 0.08, baseValue: 40,   minDepth: 2, smeltable: true  },
  { id: 'emerald',   name: '💚 Emerald',    baseChance: 0.07, baseValue: 65,   minDepth: 2, smeltable: false },
  { id: 'silver',    name: '⚪ Silver',     baseChance: 0.06, baseValue: 90,   minDepth: 3, smeltable: true  },
  { id: 'gold',      name: '🟡 Gold',       baseChance: 0.04, baseValue: 130,  minDepth: 3, smeltable: true  },
  { id: 'ruby',      name: '🔴 Ruby',       baseChance: 0.035,baseValue: 180,  minDepth: 4, smeltable: false },
  { id: 'sapphire',  name: '🔵 Sapphire',   baseChance: 0.030,baseValue: 220,  minDepth: 4, smeltable: false },
  { id: 'diamond',   name: '💎 Diamond',    baseChance: 0.025,baseValue: 280,  minDepth: 5, smeltable: false },
  { id: 'bloodstone',name: '🩸 Bloodstone', baseChance: 0.020,baseValue: 380,  minDepth: 5, smeltable: false },
  { id: 'shadow',    name: '🌑 Shadow Ore', baseChance: 0.015,baseValue: 480,  minDepth: 6, smeltable: true  },
  { id: 'mana',      name: '🔮 Mana Crystal', baseChance: 0.012, baseValue: 650, minDepth: 7, smeltable: false },
  { id: 'voidite',   name: '👁️ Voidite',    baseChance: 0.008,baseValue: 900,  minDepth: 8, smeltable: true  },
  { id: 'celestite', name: '⭐ Celestite',  baseChance: 0.004,baseValue: 1600, minDepth: 9, smeltable: false },
  { id: 'starcore',  name: '🌟 Starcore',   baseChance: 0.002,baseValue: 3000, minDepth: 10,smeltable: false },
];

// ── SMELTING RECIPES ───────────────────────────────────────────────────────
const SMELT_RECIPES = [
  { input: 'copper',  amount: 3, output: 'copper_bar',  name: '🟠 Copper Bar',   value: 100 },
  { input: 'iron',    amount: 3, output: 'iron_bar',    name: '⚙️ Iron Bar',      value: 160 },
  { input: 'silver',  amount: 3, output: 'silver_bar',  name: '⚪ Silver Bar',   value: 350 },
  { input: 'gold',    amount: 3, output: 'gold_bar',    name: '🟡 Gold Bar',     value: 500 },
  { input: 'shadow',  amount: 2, output: 'shadow_ingot',name: '🌑 Shadow Ingot', value: 1200 },
  { input: 'voidite', amount: 2, output: 'void_crystal',name: '👁️ Void Crystal', value: 2200 },
];

// ── SKILL TREE ─────────────────────────────────────────────────────────────
const SKILLS = {
  // Tier 1
  lucky_strike:  { name: '🍀 Lucky Strike',   tier: 1, cost: 3,  requires: null,          desc: '15% chance to double ore drops' },
  iron_lungs:    { name: '🫁 Iron Lungs',      tier: 1, cost: 3,  requires: null,          desc: 'Cave-in damage reduced by 30%' },
  // Tier 2
  deep_sense:    { name: '🔍 Deep Sense',      tier: 2, cost: 5,  requires: 'lucky_strike',desc: 'Scout reveals exact ore %' },
  fortified:     { name: '🔩 Fortified',        tier: 2, cost: 5,  requires: 'iron_lungs',  desc: 'Pickaxe durability loss -40%' },
  speed_digger:  { name: '⚡ Speed Digger',     tier: 2, cost: 5,  requires: 'lucky_strike',desc: 'Rush cave-in risk -25%' },
  // Tier 3
  ore_magnet:    { name: '🧲 Ore Magnet',       tier: 3, cost: 8,  requires: 'deep_sense',  desc: 'Rare ore chance +20%' },
  blast_master:  { name: '💥 Blast Master',     tier: 3, cost: 8,  requires: 'speed_digger',desc: 'Blast reward +50%, durability cost -30%' },
  merchant_eye:  { name: '👁️ Merchant Eye',    tier: 3, cost: 8,  requires: 'fortified',   desc: 'Sell ores for 20% more' },
  // Tier 4
  void_sense:    { name: '🌀 Void Sense',       tier: 4, cost: 12, requires: 'ore_magnet',  desc: 'Access depth 10 with celestial pickaxe' },
  master_crafter:{ name: '⚒️ Master Crafter',  tier: 4, cost: 12, requires: 'blast_master',desc: 'Smelt with 1 less ore required' },
  fortune:       { name: '💰 Fortune',          tier: 4, cost: 12, requires: 'merchant_eye',desc: 'Market prices always +10% for you' },
  // Tier 5 (legendary)
  heart_of_mountain:{ name: '❤️ Heart of Mountain', tier: 5, cost: 20, requires: 'void_sense', desc: 'Immune to cave-ins. Legend of the depths.' },
  abyss_walker:  { name: '🌀 Abyss Walker',    tier: 5, cost: 20, requires: 'master_crafter',desc: '+2 ores per mine in The Abyss' },
  golden_touch:  { name: '✨ Golden Touch',     tier: 5, cost: 20, requires: 'fortune',      desc: 'All ore values doubled permanently' },
};

// ── MARKET (6hr rotation) ──────────────────────────────────────────────────
let marketPrices = {};
let lastMarketReset = 0;

function refreshMarket() {
  const now = Date.now();
  if (now - lastMarketReset < 6 * 3600000) return;
  lastMarketReset = now;
  marketPrices = {};
  for (const ore of ORES) {
    const mult = 0.5 + Math.random() * 1.5; // 0.5x to 2x
    marketPrices[ore.id] = Math.round(mult * 100) / 100;
  }
  console.log('[Mining] Market prices refreshed!');
}

function getMarketMultiplier(oreId, skills) {
  refreshMarket();
  let mult = marketPrices[oreId] || 1.0;
  if (skills.includes('fortune')) mult += 0.10;
  if (skills.includes('merchant_eye')) mult *= 1.20;
  if (skills.includes('golden_touch')) mult *= 2.0;
  return mult;
}

// ── MINING EVENTS ──────────────────────────────────────────────────────────
const EVENTS = [
  { id: 'vein',      name: '💎 Rare Ore Vein!',    desc: 'A rare ore vein was discovered! Double drops for 3 actions!', duration: 3 },
  { id: 'lucky_ci',  name: '🍀 Lucky Cave-In!',    desc: 'The cave-in revealed bonus ores! You gain extra loot!', duration: 0 },
  { id: 'earthquake',name: '🌋 Earthquake!',        desc: 'The ground shakes! High risk but massive rewards await!', duration: 2 },
];

function rollEvent(depth) {
  const chance = 0.05 + (depth * 0.01);
  if (Math.random() < chance) return EVENTS[Math.floor(Math.random() * EVENTS.length)];
  return null;
}

// ── DEFAULT DATA ───────────────────────────────────────────────────────────
function getDefaultMiningData() {
  return {
    coins: 0,
    inventory: {},
    crafted: {},
    pickaxe: 'wooden',
    pickaxeDurability: 80,
    depth: 1,
    xp: 0,
    level: 1,
    skillPoints: 0,
    skills: [],
    inMine: false,
    currentHaul: {},
    caveInRisk: 0.15,
    reinforced: 0,
    exhausted: false,
    eventActive: null,
    eventDuration: 0,
    totalMined: 0,
    totalSold: 0,
  };
}

function migrateData(data) {
  const def = getDefaultMiningData();
  for (const k of Object.keys(def)) {
    if (!(k in data)) data[k] = def[k];
  }
  return data;
}

function xpForLevel(level) { return Math.floor(100 * Math.pow(1.4, level - 1)); }
function getDepthUnlockLevel(depthLevel) { return (depthLevel - 1) * 5; } // depth 2 = level 5, depth 3 = level 10, etc.

function pickaxeIndex(id) { return PICKAXE_ORDER.indexOf(id); }
function canAccessDepth(data, depthLevel) {
  const depth = DEPTHS[depthLevel - 1];
  const pick = PICKAXES.find(p => p.id === data.pickaxe);
  const reqIdx = PICKAXE_ORDER.indexOf(depth.pickaxeReq);
  const ownIdx = PICKAXE_ORDER.indexOf(data.pickaxe);
  const levelReq = getDepthUnlockLevel(depthLevel);
  return ownIdx >= reqIdx && data.level >= levelReq;
}

function getAvailableOres(depthLevel, skills) {
  let ores = ORES.filter(o => o.minDepth <= depthLevel);
  // Deeper = higher chance for rare ores
  return ores.map(o => {
    let chance = o.baseChance;
    if (skills.includes('ore_magnet') && o.minDepth >= 5) chance *= 1.20;
    if (skills.includes('lucky_strike') && Math.random() < 0.15) chance *= 2;
    return { ...o, chance };
  });
}

function mineOre(depthLevel, skills, count = 1) {
  const available = getAvailableOres(depthLevel, skills);
  const results = {};
  for (let i = 0; i < count; i++) {
    const roll = Math.random();
    let cumulative = 0;
    for (const ore of available) {
      cumulative += ore.chance;
      if (roll < cumulative) {
        results[ore.id] = (results[ore.id] || 0) + 1;
        break;
      }
    }
    if (Object.keys(results).length === 0) results['stone'] = (results['stone'] || 0) + 1;
  }
  return results;
}

function buildMineEmbed(data, action, result, event) {
  const depth = DEPTHS[data.depth - 1];
  const pick = PICKAXES.find(p => p.id === data.pickaxe);
  const durPct = Math.round((data.pickaxeDurability / pick.durability) * 100);
  const durBar = '█'.repeat(Math.floor(durPct / 10)) + '░'.repeat(10 - Math.floor(durPct / 10));
  const riskPct = Math.round(data.caveInRisk * 100);
  const xpNeeded = xpForLevel(data.level + 1);

  const haulLines = Object.entries(data.currentHaul).map(([id, qty]) => {
    const ore = ORES.find(o => o.id === id) || SMELT_RECIPES.flatMap(r => [{ id: r.output, name: r.name }]).find(o => o.id === id);
    return `${ore?.name || id} x${qty}`;
  }).join('\n') || 'Nothing yet';

  const embed = new EmbedBuilder()
    .setColor('#8B4513')
    .setTitle(`⛏️ Mining — ${depth.name}`)
    .addFields(
      { name: '🎯 Last Action', value: action || 'None', inline: false },
      { name: '⛏️ Pickaxe', value: `${pick.name} [${durBar}] ${durPct}%`, inline: false },
      { name: '📊 Depth', value: `${depth.name} (${data.depth}/10)`, inline: true },
      { name: '⚠️ Cave-in Risk', value: `${riskPct}%`, inline: true },
      { name: '💰 Coins', value: data.coins.toLocaleString(), inline: true },
      { name: '⭐ XP', value: `${data.xp}/${xpNeeded}`, inline: true },
      { name: '🏆 Level', value: `${data.level}`, inline: true },
      { name: '🎒 Current Haul', value: haulLines, inline: false },
    );

  if (event) embed.addFields({ name: `🎉 EVENT: ${event.name}`, value: event.desc, inline: false });
  if (data.exhausted) embed.addFields({ name: '😴 EXHAUSTED', value: 'Use Rest to recover before rushing again!', inline: false });
  if (data.reinforced > 0) embed.addFields({ name: '🔩 Reinforced', value: `${data.reinforced} actions remaining`, inline: false });
  if (result) embed.addFields({ name: '⛏️ Result', value: result, inline: false });

  return embed;
}

function buildActionRow(data) {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('mine_careful').setLabel('⛏️ Careful Dig').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('mine_rush').setLabel('🏃 Rush').setStyle(ButtonStyle.Warning || ButtonStyle.Primary).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('mine_blast').setLabel('💥 Blast').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('mine_scout').setLabel('🔍 Scout').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('mine_reinforce').setLabel('🔩 Reinforce').setStyle(ButtonStyle.Success)
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('mine_rest').setLabel('😴 Rest').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('mine_depth_up').setLabel('⬇️ Go Deeper').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('mine_depth_down').setLabel('⬆️ Go Up').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('mine_surface').setLabel('🚪 Surface & Sell').setStyle(ButtonStyle.Success)
  );
  return [row1, row2];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mining')
    .setDescription('Mine ores, smelt bars, and build your mining empire')
    .addSubcommand(sub => sub.setName('start').setDescription('Start or resume mining'))
    .addSubcommand(sub => sub.setName('stats').setDescription('View your mining stats'))
    .addSubcommand(sub => sub.setName('inventory').setDescription('View your ore inventory'))
    .addSubcommand(sub => sub.setName('sell').setDescription('Sell all your ores at market price'))
    .addSubcommand(sub =>
      sub.setName('smelt')
        .setDescription('Smelt ores into bars')
        .addStringOption(opt => opt.setName('ore').setDescription('Ore to smelt').setRequired(true)
          .addChoices(
            { name: '🟠 Copper → Copper Bar (x3)', value: 'copper' },
            { name: '⚙️ Iron → Iron Bar (x3)', value: 'iron' },
            { name: '⚪ Silver → Silver Bar (x3)', value: 'silver' },
            { name: '🟡 Gold → Gold Bar (x3)', value: 'gold' },
            { name: '🌑 Shadow Ore → Shadow Ingot (x2)', value: 'shadow' },
            { name: '👁️ Voidite → Void Crystal (x2)', value: 'voidite' },
          ))
    )
    .addSubcommand(sub => sub.setName('shop').setDescription('Buy pickaxes'))
    .addSubcommand(sub => sub.setName('repair').setDescription('Repair your pickaxe'))
    .addSubcommand(sub => sub.setName('depth').setDescription('View available depths and requirements'))
    .addSubcommand(sub => sub.setName('market').setDescription('View current ore market prices'))
    .addSubcommand(sub => sub.setName('skills').setDescription('View and unlock skill tree nodes'))
    .addSubcommand(sub =>
      sub.setName('learn')
        .setDescription('Learn a skill tree node')
        .addStringOption(opt => opt.setName('skill').setDescription('Skill to learn').setRequired(true)
          .addChoices(...Object.entries(SKILLS).map(([id, s]) => ({ name: `${s.name} (${s.cost}pts)`, value: id })))
        )
    )
    .addSubcommand(sub => sub.setName('reset').setDescription('Reset your mining data'))
    .addSubcommand(sub =>
      sub.setName('give')
        .setDescription('(Owner/Mod) Give mining coins')
        .addUserOption(opt => opt.setName('user').setDescription('Target').setRequired(true))
        .addIntegerOption(opt => opt.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1))
    ),

  async execute(interaction, client) {
    try { await interaction.deferReply({ ephemeral: false }); }
    catch (err) { return interaction.reply({ content: 'Failed.', ephemeral: true }).catch(() => {}); }

    const userId = interaction.user.id;
    const guildId = interaction.guild.id;
    const username = interaction.user.username;
    const key = `mining2_${guildId}_${userId}`;

    let data = client.memory.get(key) || getDefaultMiningData();
    data = migrateData(data);

    const sub = interaction.options.getSubcommand();

    // ── GIVE ──────────────────────────────────────────────
    if (sub === 'give') {
      const isOwner = OWNER_IDS.includes(userId);
      const isMod = interaction.member?.permissions?.has('KickMembers');
      if (!isOwner && !isMod) return interaction.editReply('❌ Mods only.');
      const target = interaction.options.getUser('user');
      const amount = interaction.options.getInteger('amount');
      if (!isOwner && amount > 5000) return interaction.editReply('❌ Mods capped at 5,000.');
      const tKey = `mining2_${guildId}_${target.id}`;
      let tData = client.memory.get(tKey) || getDefaultMiningData();
      tData = migrateData(tData);
      tData.coins += amount;
      client.memory.set(tKey, tData);
      return interaction.editReply(`✅ Gave **${amount.toLocaleString()}c** to **${target.username}**!`);
    }

    // ── RESET ─────────────────────────────────────────────
    if (sub === 'reset') {
      client.memory.delete(key);
      return interaction.editReply('✅ Mining data reset!');
    }

    // ── STATS ─────────────────────────────────────────────
    if (sub === 'stats') {
      const pick = PICKAXES.find(p => p.id === data.pickaxe);
      const durPct = Math.round((data.pickaxeDurability / pick.durability) * 100);
      const xpNeeded = xpForLevel(data.level + 1);
      const xpBar = '█'.repeat(Math.floor((data.xp / xpNeeded) * 10)) + '░'.repeat(10 - Math.floor((data.xp / xpNeeded) * 10));
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#8B4513').setTitle(`⛏️ ${username}'s Mining Stats`)
        .addFields(
          { name: '💰 Coins',       value: data.coins.toLocaleString(),        inline: true },
          { name: '🏆 Level',       value: `${data.level}`,                    inline: true },
          { name: '⭐ XP',          value: `${data.xp}/${xpNeeded}\n${xpBar}`, inline: true },
          { name: '🎯 Skill Pts',   value: `${data.skillPoints}`,              inline: true },
          { name: '⛏️ Pickaxe',     value: `${pick.name} (${durPct}% dur)`,   inline: true },
          { name: '📊 Depth',       value: `${DEPTHS[data.depth-1].name}`,     inline: true },
          { name: '🧠 Skills',      value: data.skills.length > 0 ? data.skills.map(s => SKILLS[s]?.name).join(', ') : 'None', inline: false },
          { name: '⛏️ Total Mined', value: data.totalMined.toLocaleString(),   inline: true },
          { name: '💸 Total Sold',  value: data.totalSold.toLocaleString(),    inline: true },
        )] });
    }

    // ── INVENTORY ─────────────────────────────────────────
    if (sub === 'inventory') {
      const oreLines = Object.entries(data.inventory).map(([id, qty]) => {
        const ore = ORES.find(o => o.id === id);
        const bar = SMELT_RECIPES.find(r => r.output === id);
        const name = ore?.name || bar?.name || id;
        const val = ore?.baseValue || bar?.value || 0;
        return `${name} x**${qty}** — ${val}c each`;
      });
      if (oreLines.length === 0) return interaction.editReply('📦 Your inventory is empty! Use `/mining start` to mine.');
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#8B4513').setTitle('📦 Mining Inventory').setDescription(oreLines.join('\n')).addFields({ name: '💰 Coins', value: data.coins.toLocaleString(), inline: true })] });
    }

    // ── SELL ──────────────────────────────────────────────
    if (sub === 'sell') {
      refreshMarket();
      if (Object.keys(data.inventory).length === 0) return interaction.editReply('📦 Nothing to sell!');
      let total = 0;
      const lines = [];
      for (const [id, qty] of Object.entries(data.inventory)) {
        const ore = ORES.find(o => o.id === id);
        const bar = SMELT_RECIPES.find(r => r.output === id);
        const baseVal = ore?.baseValue || bar?.value || 0;
        const mult = getMarketMultiplier(id, data.skills);
        const earned = Math.floor(baseVal * qty * mult);
        total += earned;
        const name = ore?.name || bar?.name || id;
        lines.push(`${name} x${qty} → **${earned}c** (${mult.toFixed(2)}x)`);
      }
      data.coins += total;
      data.totalSold += total;
      data.inventory = {};
      client.memory.set(key, data);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#00ff00').setTitle('💰 Ores Sold!').setDescription(lines.join('\n')).addFields({ name: '💵 Total Earned', value: `${total.toLocaleString()}c`, inline: true }, { name: '💰 Balance', value: data.coins.toLocaleString(), inline: true })] });
    }

    // ── SMELT ─────────────────────────────────────────────
    if (sub === 'smelt') {
      const oreId = interaction.options.getString('ore');
      const recipe = SMELT_RECIPES.find(r => r.input === oreId);
      if (!recipe) return interaction.editReply('❌ Unknown recipe!');
      let required = recipe.amount;
      if (data.skills.includes('master_crafter')) required = Math.max(1, required - 1);
      const owned = data.inventory[oreId] || 0;
      if (owned < required) return interaction.editReply(`❌ Need **${required}x** ${oreId} but you only have **${owned}**!`);
      const batches = Math.floor(owned / required);
      data.inventory[oreId] -= batches * required;
      if (data.inventory[oreId] <= 0) delete data.inventory[oreId];
      data.inventory[recipe.output] = (data.inventory[recipe.output] || 0) + batches;
      client.memory.set(key, data);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#ff9900').setTitle('🔥 Smelting Complete!').addFields({ name: '⚒️ Produced', value: `${recipe.name} x**${batches}**`, inline: true }, { name: '💰 Est. Value', value: `${(recipe.value * batches).toLocaleString()}c`, inline: true })] });
    }

    // ── SHOP ──────────────────────────────────────────────
    if (sub === 'shop') {
      const lines = PICKAXES.map(p => {
        const owned = data.pickaxe === p.id || pickaxeIndex(data.pickaxe) >= pickaxeIndex(p.id);
        return `${p.name} — **${p.cost}c** — Resist: ${Math.round(p.resist*100)}% | Dur: ${p.durability}${owned ? ' ✅' : ''}`;
      });
      const row = new ActionRowBuilder().addComponents(
        PICKAXES.slice(0, 5).map(p => {
          const owned = pickaxeIndex(data.pickaxe) >= pickaxeIndex(p.id);
          return new ButtonBuilder().setCustomId(`buy_pick_${p.id}`).setLabel(p.name.split(' ')[1]).setStyle(owned ? ButtonStyle.Secondary : ButtonStyle.Primary).setDisabled(owned);
        })
      );
      const row2 = new ActionRowBuilder().addComponents(
        PICKAXES.slice(5).map(p => {
          const owned = pickaxeIndex(data.pickaxe) >= pickaxeIndex(p.id);
          return new ButtonBuilder().setCustomId(`buy_pick_${p.id}`).setLabel(p.name.split(' ')[1]).setStyle(owned ? ButtonStyle.Secondary : ButtonStyle.Primary).setDisabled(owned);
        })
      );
      await interaction.editReply({ embeds: [new EmbedBuilder().setColor('#8B4513').setTitle('⛏️ Pickaxe Shop').setDescription(lines.join('\n')).addFields({ name: '💰 Your Coins', value: data.coins.toLocaleString(), inline: true })], components: [row, row2] });
      const msg = await interaction.fetchReply();
      const collector = msg.createMessageComponentCollector({ time: 30000 });
      collector.on('collect', async btn => {
        try { await btn.deferUpdate(); } catch (e) { return; }
        if (btn.user.id !== userId) return;
        const pickId = btn.customId.replace('buy_pick_', '');
        const pick = PICKAXES.find(p => p.id === pickId);
        if (!pick) return;
        if (data.coins < pick.cost) return btn.followUp({ content: `❌ Need **${pick.cost}c**, have **${data.coins}c**.`, ephemeral: true }).catch(() => {});
        data.coins -= pick.cost;
        data.pickaxe = pick.id;
        data.pickaxeDurability = pick.durability;
        client.memory.set(key, data);
        await btn.followUp({ content: `✅ Bought **${pick.name}**!`, ephemeral: true }).catch(() => {});
      });
      collector.on('end', () => { msg.edit({ components: [] }).catch(() => {}); });
      return;
    }

    // ── REPAIR ────────────────────────────────────────────
    if (sub === 'repair') {
      const pick = PICKAXES.find(p => p.id === data.pickaxe);
      if (data.pickaxeDurability >= pick.durability) return interaction.editReply('✅ Pickaxe is already at full durability!');
      const missing = pick.durability - data.pickaxeDurability;
      const cost = Math.floor(missing * pick.repairCost / 10);
      if (data.coins < cost) return interaction.editReply(`❌ Need **${cost}c** to repair. Have **${data.coins}c**.`);
      data.coins -= cost;
      data.pickaxeDurability = pick.durability;
      client.memory.set(key, data);
      return interaction.editReply(`✅ **${pick.name}** fully repaired! Cost: **${cost}c**\n💰 Balance: **${data.coins}c**`);
    }

    // ── DEPTH ─────────────────────────────────────────────
    if (sub === 'depth') {
      const lines = DEPTHS.map(d => {
        const canAccess = canAccessDepth(data, d.level);
        const levelReq = getDepthUnlockLevel(d.level);
        const pickReq = PICKAXES.find(p => p.id === d.pickaxeReq);
        return `${canAccess ? '✅' : '🔒'} **${d.name}** — Req: ${pickReq.name}, Lvl ${levelReq} | Risk: ${Math.round(d.caveInBase*100)}% | XP: ${d.xpMult}x`;
      });
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#8B4513').setTitle('📊 Mining Depths').setDescription(lines.join('\n')).addFields({ name: '📊 Your Depth', value: DEPTHS[data.depth-1].name, inline: true }, { name: '🏆 Your Level', value: `${data.level}`, inline: true })] });
    }

    // ── MARKET ────────────────────────────────────────────
    if (sub === 'market') {
      refreshMarket();
      const nextReset = new Date(lastMarketReset + 6*3600000);
      const lines = ORES.map(o => {
        const mult = getMarketMultiplier(o.id, data.skills);
        const currentVal = Math.floor(o.baseValue * mult);
        const trend = mult >= 1.5 ? '📈' : mult <= 0.7 ? '📉' : '➡️';
        return `${trend} ${o.name} — **${currentVal}c** (${mult.toFixed(2)}x)`;
      });
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#00ff00').setTitle('💹 Ore Market').setDescription(lines.join('\n')).setFooter({ text: `Resets at ${nextReset.toUTCString()}` })] });
    }

    // ── SKILLS ────────────────────────────────────────────
    if (sub === 'skills') {
      const lines = Object.entries(SKILLS).map(([id, s]) => {
        const owned = data.skills.includes(id);
        const reqMet = !s.requires || data.skills.includes(s.requires);
        const status = owned ? '✅' : reqMet ? '🔓' : '🔒';
        return `${status} **${s.name}** (Tier ${s.tier}, ${s.cost}pts) — ${s.desc}${s.requires ? ` *(req: ${SKILLS[s.requires]?.name})*` : ''}`;
      });
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#9b59b6').setTitle('🧠 Mining Skill Tree').setDescription(lines.join('\n')).addFields({ name: '🎯 Skill Points', value: `${data.skillPoints}`, inline: true }, { name: '📊 Level', value: `${data.level}`, inline: true })] });
    }

    // ── LEARN ─────────────────────────────────────────────
    if (sub === 'learn') {
      const skillId = interaction.options.getString('skill');
      const skill = SKILLS[skillId];
      if (!skill) return interaction.editReply('❌ Unknown skill!');
      if (data.skills.includes(skillId)) return interaction.editReply('❌ Already learned!');
      if (skill.requires && !data.skills.includes(skill.requires)) return interaction.editReply(`❌ Requires **${SKILLS[skill.requires]?.name}** first!`);
      if (data.skillPoints < skill.cost) return interaction.editReply(`❌ Need **${skill.cost} skill points**, have **${data.skillPoints}**.`);
      data.skillPoints -= skill.cost;
      data.skills.push(skillId);
      client.memory.set(key, data);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#9b59b6').setTitle(`✅ Skill Learned: ${skill.name}`).setDescription(skill.desc).addFields({ name: '🎯 Points Left', value: `${data.skillPoints}`, inline: true })] });
    }

    // ── START (main mining loop) ───────────────────────────
    if (sub === 'start') {
      if (data.pickaxeDurability <= 0) return interaction.editReply('❌ Your pickaxe is broken! Use `/mining repair` first.');

      data.inMine = true;
      data.currentHaul = data.currentHaul || {};
      client.memory.set(key, data);

      const depth = DEPTHS[data.depth - 1];
      const event = rollEvent(data.depth);
      if (event) { data.eventActive = event.id; data.eventDuration = event.duration; }

      await interaction.editReply({ embeds: [buildMineEmbed(data, '⛏️ You entered the mine!', null, event)], components: buildActionRow(data) });
      const mineMsg = await interaction.fetchReply();
      const collector = mineMsg.createMessageComponentCollector({ time: 120000 });

      collector.on('collect', async btn => {
        try { await btn.deferUpdate(); } catch (e) { return; }
        if (btn.user.id !== userId) return btn.followUp({ content: '❌ Not your mine!', ephemeral: true }).catch(() => {});

        data = client.memory.get(key) || data;
        const pick = PICKAXES.find(p => p.id === data.pickaxe);
        const depth = DEPTHS[data.depth - 1];
        let actionText = '';
        let newEvent = null;

        // ── DEPTH NAVIGATION ──────────────────────────────
        if (btn.customId === 'mine_depth_up') {
          if (data.depth <= 1) return btn.followUp({ content: '❌ Already at surface!', ephemeral: true }).catch(() => {});
          data.depth--;
          actionText = `⬆️ Moved up to **${DEPTHS[data.depth-1].name}**`;
        } else if (btn.customId === 'mine_depth_down') {
          if (data.depth >= 10) return btn.followUp({ content: '❌ Already at max depth!', ephemeral: true }).catch(() => {});
          if (!canAccessDepth(data, data.depth + 1)) {
            const nextDepth = DEPTHS[data.depth];
            const reqPick = PICKAXES.find(p => p.id === nextDepth.pickaxeReq);
            const levelReq = getDepthUnlockLevel(data.depth + 1);
            return btn.followUp({ content: `❌ Need **${reqPick.name}** and **Level ${levelReq}** to go deeper!`, ephemeral: true }).catch(() => {});
          }
          data.depth++;
          actionText = `⬇️ Descended to **${DEPTHS[data.depth-1].name}**!`;
        }

        // ── SURFACE & SELL ────────────────────────────────
        else if (btn.customId === 'mine_surface') {
          collector.stop('surfaced');
          data.inMine = false;
          if (Object.keys(data.currentHaul).length === 0) {
            client.memory.set(key, data);
            await mineMsg.edit({ embeds: [new EmbedBuilder().setColor('#8B4513').setTitle('🚪 Surfaced').setDescription('You came up with nothing!')], components: [] }).catch(() => {});
            return;
          }
          refreshMarket();
          let total = 0;
          const lines = [];
          for (const [id, qty] of Object.entries(data.currentHaul)) {
            const ore = ORES.find(o => o.id === id);
            if (!ore) continue;
            const mult = getMarketMultiplier(id, data.skills);
            const earned = Math.floor(ore.baseValue * qty * mult);
            total += earned;
            data.inventory[id] = (data.inventory[id] || 0) + qty;
            lines.push(`${ore.name} x${qty} → **${earned}c**`);
          }
          data.coins += total;
          data.totalSold += total;
          data.currentHaul = {};
          client.memory.set(key, data);
          await mineMsg.edit({ embeds: [new EmbedBuilder().setColor('#00ff00').setTitle('🚪 Surfaced & Sold!').setDescription(lines.join('\n')).addFields({ name: '💵 Total', value: `${total.toLocaleString()}c`, inline: true }, { name: '💰 Balance', value: data.coins.toLocaleString(), inline: true })], components: [] }).catch(() => {});
          return;
        }

        // ── REST ──────────────────────────────────────────
        else if (btn.customId === 'mine_rest') {
          data.exhausted = false;
          data.caveInRisk = Math.max(depth.caveInBase, data.caveInRisk - 0.05);
          actionText = '😴 You rested. Exhaustion cleared and risk reduced.';
        }

        // ── REINFORCE ─────────────────────────────────────
        else if (btn.customId === 'mine_reinforce') {
          data.reinforced = 2;
          data.caveInRisk = Math.max(0.02, data.caveInRisk - 0.10);
          actionText = '🔩 Reinforced! Cave-in risk reduced for 2 actions.';
        }

        // ── SCOUT ─────────────────────────────────────────
        else if (btn.customId === 'mine_scout') {
          const available = getAvailableOres(data.depth, data.skills);
          const deepSense = data.skills.includes('deep_sense');
          const topOres = available.sort((a,b) => b.chance - a.chance).slice(0, deepSense ? 8 : 5);
          const scoutLines = topOres.map(o => `${o.name}: ${deepSense ? `${Math.round(o.chance*100)}%` : 'possible'}`).join('\n');
          actionText = `🔍 Scout result:\n${scoutLines}`;
        }

        // ── CAREFUL DIG ───────────────────────────────────
        else if (btn.customId === 'mine_careful') {
          const ores = mineOre(data.depth, data.skills, 1);
          let durLoss = 1;
          if (data.skills.includes('fortified')) durLoss = Math.ceil(durLoss * 0.6);
          data.pickaxeDurability = Math.max(0, data.pickaxeDurability - durLoss);
          const xpGain = Math.floor(5 * depth.xpMult);
          data.xp += xpGain;
          data.totalMined++;
          const oreText = Object.entries(ores).map(([id, qty]) => { const o = ORES.find(x => x.id === id); data.currentHaul[id] = (data.currentHaul[id]||0)+qty; return `${o?.name||id} x${qty}`; }).join(', ');
          actionText = `⛏️ Careful dig: ${oreText} | +${xpGain} XP`;
          newEvent = rollEvent(data.depth);
        }

        // ── RUSH ──────────────────────────────────────────
        else if (btn.customId === 'mine_rush') {
          if (data.exhausted) return btn.followUp({ content: '❌ You are exhausted! Use Rest first.', ephemeral: true }).catch(() => {});
          let riskMult = 2.0;
          if (data.skills.includes('speed_digger')) riskMult = 1.5;
          if (data.reinforced > 0) { riskMult *= 0.7; data.reinforced--; }
          const caveInChance = Math.min(0.9, data.caveInRisk * riskMult);
          let durLoss = 4;
          if (data.skills.includes('fortified')) durLoss = Math.ceil(durLoss * 0.6);
          data.pickaxeDurability = Math.max(0, data.pickaxeDurability - durLoss);

          if (Math.random() < caveInChance) {
            // Cave-in!
            if (data.skills.includes('heart_of_mountain')) {
              actionText = '🌋 Cave-in! But **Heart of Mountain** saved you!';
            } else if (data.eventActive === 'lucky_ci') {
              const bonusOres = mineOre(data.depth, data.skills, 3);
              Object.entries(bonusOres).forEach(([id, qty]) => { data.currentHaul[id] = (data.currentHaul[id]||0)+qty; });
              actionText = '🍀 Lucky Cave-in! Bonus ores revealed!';
              data.eventActive = null;
            } else {
              const lost = Math.floor(Object.keys(data.currentHaul).length * 0.3);
              const keys = Object.keys(data.currentHaul);
              for (let i = 0; i < lost; i++) { const k = keys[Math.floor(Math.random()*keys.length)]; if (data.currentHaul[k]) data.currentHaul[k] = Math.max(0, data.currentHaul[k]-1); }
              actionText = `💥 CAVE-IN! Lost some haul! ${data.skills.includes('iron_lungs') ? '(Iron Lungs reduced loss!)' : ''}`;
              data.exhausted = true;
              data.caveInRisk += 0.05;
            }
          } else {
            const count = data.eventActive === 'vein' ? 3 : 2;
            const ores = mineOre(data.depth, data.skills, count);
            const xpGain = Math.floor(15 * depth.xpMult);
            data.xp += xpGain;
            data.totalMined += count;
            if (data.eventActive === 'vein') { data.eventDuration--; if (data.eventDuration <= 0) data.eventActive = null; }
            const oreText = Object.entries(ores).map(([id, qty]) => { const o = ORES.find(x => x.id === id); data.currentHaul[id] = (data.currentHaul[id]||0)+qty; return `${o?.name||id} x${qty}`; }).join(', ');
            actionText = `🏃 Rush: ${oreText} | +${xpGain} XP`;
            data.caveInRisk += 0.03;
            newEvent = rollEvent(data.depth);
          }
        }

        // ── BLAST ─────────────────────────────────────────
        else if (btn.customId === 'mine_blast') {
          let durLoss = 10;
          if (data.skills.includes('fortified')) durLoss = Math.ceil(durLoss * 0.6);
          if (data.skills.includes('blast_master')) durLoss = Math.ceil(durLoss * 0.7);
          data.pickaxeDurability = Math.max(0, data.pickaxeDurability - durLoss);

          let caveChance = data.caveInRisk * 1.5;
          if (data.reinforced > 0) { caveChance *= 0.7; data.reinforced--; }

          if (Math.random() < caveChance && !data.skills.includes('heart_of_mountain')) {
            const lost = Math.floor(Object.keys(data.currentHaul).length * 0.5);
            const keys = Object.keys(data.currentHaul);
            for (let i = 0; i < lost; i++) { const k = keys[Math.floor(Math.random()*keys.length)]; if (data.currentHaul[k]) data.currentHaul[k] = Math.max(0, data.currentHaul[k]-1); }
            actionText = `💥 BLAST CAVE-IN! Lost 50% of haul!`;
            data.exhausted = true;
          } else {
            let count = data.eventActive === 'earthquake' ? 6 : 4;
            if (data.skills.includes('blast_master')) count = Math.floor(count * 1.5);
            const ores = mineOre(data.depth, data.skills, count);
            const xpGain = Math.floor(25 * depth.xpMult);
            data.xp += xpGain;
            data.totalMined += count;
            if (data.eventActive === 'earthquake') { data.eventDuration--; if (data.eventDuration <= 0) data.eventActive = null; }
            const oreText = Object.entries(ores).map(([id, qty]) => { const o = ORES.find(x => x.id === id); data.currentHaul[id] = (data.currentHaul[id]||0)+qty; return `${o?.name||id} x${qty}`; }).join(', ');
            actionText = `💥 BLAST! ${oreText} | +${xpGain} XP`;
            data.caveInRisk += 0.08;
          }
          newEvent = rollEvent(data.depth);
        }

        // ── LEVEL UP CHECK ────────────────────────────────
        let leveledUp = false;
        while (data.xp >= xpForLevel(data.level + 1)) {
          data.xp -= xpForLevel(data.level + 1);
          data.level++;
          data.skillPoints += 3;
          leveledUp = true;
        }
        if (leveledUp) actionText += `\n🎉 **LEVEL UP! You are now Level ${data.level}! +3 Skill Points!**`;

        // ── PICKAXE BROKE CHECK ───────────────────────────
        if (data.pickaxeDurability <= 0) {
          actionText += '\n⚠️ **Your pickaxe is broken! Surface and repair it!**';
        }

        if (newEvent) { data.eventActive = newEvent.id; data.eventDuration = newEvent.duration; }
        client.memory.set(key, data);
        await mineMsg.edit({ embeds: [buildMineEmbed(data, actionText, null, newEvent)], components: data.pickaxeDurability > 0 ? buildActionRow(data) : [] }).catch(() => {});
      });

      collector.on('end', (_, reason) => {
        if (reason !== 'surfaced') {
          mineMsg.edit({ components: [] }).catch(() => {});
        }
      });
    }
  }
};
