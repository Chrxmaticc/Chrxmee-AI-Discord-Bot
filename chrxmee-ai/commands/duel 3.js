const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const OWNER_IDS = ['902685494247325776', '954709865698312213'];
const INTEREST_RATE = 0.05; // 5% per 24 hours
const INTERVAL = 24 * 60 * 60 * 1000;

// ── DUEL ARMORS ────────────────────────────────────────────────────────────
const DUEL_ARMORS = [
  { id: 'leather',   name: '🟤 Leather Plate',   cost: 150,  hpBonus: 5,  defBonus: 1, desc: '+5 HP, -1 dmg taken' },
  { id: 'chainmail', name: '⛓️ Chainmail',        cost: 400,  hpBonus: 10, defBonus: 2, desc: '+10 HP, -2 dmg taken' },
  { id: 'steel',     name: '🔵 Steel Plate',      cost: 800,  hpBonus: 15, defBonus: 3, desc: '+15 HP, -3 dmg taken' },
  { id: 'gold',      name: '🟡 Gold Plate',       cost: 1500, hpBonus: 20, defBonus: 4, desc: '+20 HP, -4 dmg taken' },
  { id: 'diamond',   name: '💎 Diamond Plate',    cost: 2500, hpBonus: 25, defBonus: 5, desc: '+25 HP, -5 dmg taken' },
  { id: 'shadow',    name: '🌑 Shadowforged',     cost: 4000, hpBonus: 30, defBonus: 6, desc: '+30 HP, -6 dmg taken' },
  { id: 'celestial', name: '👼 Celestial Plate',  cost: 6000, hpBonus: 40, defBonus: 8, desc: '+40 HP, -8 dmg taken' },
  { id: 'nxy',       name: '🧞‍♂️ Nxy\'s Plate',    cost: 25600, hpBonus: 67, defBonus: 15, desc: '+67 HP, -15 dmg taken', restricted: true, ownerId: '954709865698312213' },
  { id: 'chrxmee',   name: '👽 Chrxmee\'s Plate', cost: 25600, hpBonus: 70, defBonus: 15, desc: '+70 HP, -15 dmg taken', restricted: true, ownerId: '902685494247325776' }
];

// ── DUEL SWORDS ────────────────────────────────────────────────────────────
const DUEL_SWORDS = [
  {
    id: 'rusty',     name: '🗡️ Rusty Blade',     cost: 200,  bonusDmg: 3,
    effect: 'bleed',     effectDesc: '🩸 Bleed: deals +2 extra dmg next round'
  },
  {
    id: 'steel',     name: '⚔️ Steel Edge',       cost: 800,  bonusDmg: 7,
    effect: 'stun',      effectDesc: '⚡ Stun: 15% chance opponent\'s action is ignored'
  },
  {
    id: 'enchanted', name: '✨ Enchanted Blade',  cost: 2000, bonusDmg: 13,
    effect: 'lifesteal', effectDesc: '💚 Lifesteal: heal 5 HP on every hit you land'
  },
  {
    id: 'wraith',    name: '💀 Wraithblade',      cost: 4000, bonusDmg: 20,
    effect: 'fear',      effectDesc: '😱 Fear: 20% chance to force opponent to Block next round'
  },
  {
    id: 'nxy',       name: '🧞‍♂️ Nxy\'s Blade',    cost: 25600, bonusDmg: 40,
    effect: 'all',       effectDesc: '✨ All enchantments: Bleed + Stun + Lifesteal + Fear',
    restricted: true, ownerId: '954709865698312213'
  },
  {
    id: 'chrxmee',   name: '👽 Chrxmee\'s Blade', cost: 25600, bonusDmg: 40,
    effect: 'all',       effectDesc: '✨ All enchantments: Bleed + Stun + Lifesteal + Fear',
    restricted: true, ownerId: '902685494247325776'
  }
];

// ── DEFAULTS ───────────────────────────────────────────────────────────────
function getDefaultDuelData() {
  return {
    tokens: 0,
    debt: 0,
    debtLastChecked: null,
    inventory: [],
    equippedArmor: null,
    equippedSword: null,
    wins: 0,
    losses: 0,
    totalGoldWon: 0,
    totalGoldLost: 0,
  };
}

function migrateDuelData(data) {
  if (!data.tokens && data.tokens !== 0) data.tokens = 0;
  if (!data.debt && data.debt !== 0) data.debt = 0;
  if (!('debtLastChecked' in data)) data.debtLastChecked = null;
  if (!data.inventory) data.inventory = [];
  if (!('equippedArmor' in data)) data.equippedArmor = null;
  if (!('equippedSword' in data)) data.equippedSword = null;
  if (!data.wins) data.wins = 0;
  if (!data.losses) data.losses = 0;
  if (!data.totalGoldWon) data.totalGoldWon = 0;
  if (!data.totalGoldLost) data.totalGoldLost = 0;
  return data;
}

// ── DEBT INTEREST ──────────────────────────────────────────────────────────
function applyInterest(data) {
  if (data.debt <= 0) return data;
  const now = Date.now();
  if (!data.debtLastChecked) { data.debtLastChecked = now; return data; }
  const intervals = Math.floor((now - data.debtLastChecked) / INTERVAL);
  if (intervals > 0) {
    data.debt = Math.ceil(data.debt * Math.pow(1 + INTEREST_RATE, intervals));
    data.debtLastChecked = now;
  }
  return data;
}

function autoDeductDebt(data, client, guildId, userId) {
  if (data.debt <= 0) return data;
  const dungeonKey = `dungeon_${guildId}_${userId}`;
  const miningKey = `mining_${guildId}_${userId}`;
  const farmKey = `farm_${guildId}_${userId}`;

  const dungeonData = client.memory.get(dungeonKey);
  const miningData = client.memory.get(miningKey);
  const farmData = client.memory.get(farmKey);

  let remaining = data.debt;

  if (dungeonData && dungeonData.gold > 0 && remaining > 0) {
    const take = Math.min(dungeonData.gold, remaining);
    dungeonData.gold -= take;
    remaining -= take;
    client.memory.set(dungeonKey, dungeonData);
  }
  if (miningData && miningData.coins > 0 && remaining > 0) {
    const take = Math.min(miningData.coins, remaining);
    miningData.coins -= take;
    remaining -= take;
    client.memory.set(miningKey, miningData);
  }
  if (farmData && farmData.coins > 0 && remaining > 0) {
    const take = Math.min(farmData.coins, remaining);
    farmData.coins -= take;
    remaining -= take;
    client.memory.set(farmKey, farmData);
  }
  if (data.tokens > 0 && remaining > 0) {
    const take = Math.min(data.tokens, remaining);
    data.tokens -= take;
    remaining -= take;
  }

  data.debt = remaining;
  if (data.debt <= 0) { data.debt = 0; data.debtLastChecked = null; }
  return data;
}

// ── COMBAT RESOLUTION ──────────────────────────────────────────────────────
function resolveRound(actionA, actionB, swordA, swordB, armorA, armorB, stateA, stateB) {
  const defA = armorA ? armorA.defBonus : 0;
  const defB = armorB ? armorB.defBonus : 0;
  const atkA = (swordA ? swordA.bonusDmg : 0);
  const atkB = (swordB ? swordB.bonusDmg : 0);

  const effA = stateA.forcedBlock ? 'block' : actionA;
  const effB = stateB.forcedBlock ? 'block' : actionB;

  let rawDmgToA = 0, rawDmgToB = 0;
  let log = '';

  const actions = `${effA}_vs_${effB}`;

  switch (actions) {
    case 'strike_vs_strike':
      rawDmgToA = Math.max(0, (15 + atkB) - defA);
      rawDmgToB = Math.max(0, (15 + atkA) - defB);
      log = `⚔️ Both struck! Mutual damage!`;
      break;
    case 'strike_vs_block':
      rawDmgToA = 0;
      rawDmgToB = Math.max(0, Math.floor((15 + atkA) / 2) - defB);
      log = `🛡️ Block absorbed the strike! Half damage dealt.`;
      break;
    case 'strike_vs_parry':
      rawDmgToA = Math.max(0, (20 + atkB) - defA);
      rawDmgToB = 0;
      log = `🔰 Parry countered the strike! Striker takes heavy damage!`;
      break;
    case 'strike_vs_heavy':
      rawDmgToA = Math.max(0, (25 + atkB) - defA);
      rawDmgToB = Math.max(0, (15 + atkA) - defB);
      log = `💣 Heavy and Strike clash! Both take damage, heavy hits harder.`;
      break;
    case 'block_vs_strike':
      rawDmgToA = Math.max(0, Math.floor((15 + atkB) / 2) - defA);
      rawDmgToB = 0;
      log = `🛡️ Block absorbed the strike! Half damage dealt.`;
      break;
    case 'block_vs_block':
      rawDmgToA = 0; rawDmgToB = 0;
      log = `🛡️ Both blocked. Stalemate!`;
      break;
    case 'block_vs_parry':
      rawDmgToA = 0; rawDmgToB = 0;
      log = `🛡️🔰 Block meets Parry. Nothing happens.`;
      break;
    case 'block_vs_heavy':
      rawDmgToA = Math.max(0, (25 + atkB) - defA);
      rawDmgToB = 0;
      log = `💣 Heavy attack **breaks through** the block!`;
      break;
    case 'parry_vs_strike':
      rawDmgToA = 0;
      rawDmgToB = Math.max(0, (20 + atkA) - defB);
      log = `🔰 Parry countered the strike! Striker takes heavy damage!`;
      break;
    case 'parry_vs_block':
      rawDmgToA = 0; rawDmgToB = 0;
      log = `🔰🛡️ Parry meets Block. Nothing happens.`;
      break;
    case 'parry_vs_parry':
      rawDmgToA = 5; rawDmgToB = 5;
      log = `🔰 Parry clash! Both take 5 damage.`;
      break;
    case 'parry_vs_heavy':
      rawDmgToA = Math.max(0, (25 + atkB) - defA);
      rawDmgToB = Math.max(0, (10 + atkA) - defB);
      log = `💣 Heavy smashes through the parry! Massive damage!`;
      break;
    case 'heavy_vs_strike':
      rawDmgToA = Math.max(0, (15 + atkB) - defA);
      rawDmgToB = Math.max(0, (25 + atkA) - defB);
      log = `💣 Heavy and Strike clash! Heavy hits harder.`;
      break;
    case 'heavy_vs_block':
      rawDmgToA = 0;
      rawDmgToB = Math.max(0, (25 + atkA) - defB);
      log = `💣 Heavy attack **breaks through** the block!`;
      break;
    case 'heavy_vs_parry':
      rawDmgToA = Math.max(0, (10 + atkB) - defA);
      rawDmgToB = Math.max(0, (25 + atkA) - defB);
      log = `💣 Heavy smashes through the parry! Massive damage!`;
      break;
    case 'heavy_vs_heavy':
      rawDmgToA = Math.max(0, (25 + atkB) - defA);
      rawDmgToB = Math.max(0, (25 + atkA) - defB);
      log = `💥 HEAVY vs HEAVY! Massive mutual damage!`;
      break;
    default:
      rawDmgToA = 5; rawDmgToB = 5;
      log = `Both attacked.`;
  }

  return { dmgToA: rawDmgToA, dmgToB: rawDmgToB, log };
}

// Apply sword effects – extended for the "all" enchantment (nxy’s blade & chrxmee’s blade)
function applySwordEffects(swordA, swordB, dmgToA, dmgToB, hpA, hpB, stateA, stateB, effA, effB) {
  let extraLog = '';

  // Bleed carryover
  if (stateA.bleed > 0) { hpA = Math.max(0, hpA - stateA.bleed); extraLog += `\n🩸 Bleed hits A for ${stateA.bleed} dmg!`; stateA.bleed = 0; }
  if (stateB.bleed > 0) { hpB = Math.max(0, hpB - stateB.bleed); extraLog += `\n🩸 Bleed hits B for ${stateB.bleed} dmg!`; stateB.bleed = 0; }

  stateA.forcedBlock = false;
  stateB.forcedBlock = false;

  // Helper to apply all effects
  function applyAllEffects(attacker, target, isAttackerA) {
    let log = '';
    // bleed
    if (isAttackerA) { stateB.bleed = 2; log += `\n🩸 Bleed applied to B!`; }
    else { stateA.bleed = 2; log += `\n🩸 Bleed applied to A!`; }
    // stun (15% chance)
    if (Math.random() < 0.15) {
      if (isAttackerA) { stateB.stunned = true; log += `\n⚡ B is stunned next round!`; }
      else { stateA.stunned = true; log += `\n⚡ A is stunned next round!`; }
    }
    // lifesteal
    if (isAttackerA) { hpA = Math.min(hpA + 5, 200); log += `\n💚 A lifesteals 5 HP!`; }
    else { hpB = Math.min(hpB + 5, 200); log += `\n💚 B lifesteals 5 HP!`; }
    // fear (20% chance)
    if (Math.random() < 0.2) {
      if (isAttackerA) { stateB.forcedBlock = true; log += `\n😱 B is feared — forced to Block!`; }
      else { stateA.forcedBlock = true; log += `\n😱 A is feared — forced to Block!`; }
    }
    return log;
  }

  // Apply sword A effects if A dealt damage
  if (dmgToB > 0 && swordA) {
    if (swordA.effect === 'all') {
      extraLog += applyAllEffects(true, false, true);
    } else {
      if (swordA.effect === 'bleed') { stateB.bleed = 2; extraLog += `\n🩸 Bleed applied to B!`; }
      if (swordA.effect === 'stun' && Math.random() < 0.15) { stateB.stunned = true; extraLog += `\n⚡ B is stunned next round!`; }
      if (swordA.effect === 'lifesteal') { hpA = Math.min(hpA + 5, 200); extraLog += `\n💚 A lifesteals 5 HP!`; }
      if (swordA.effect === 'fear' && Math.random() < 0.2) { stateB.forcedBlock = true; extraLog += `\n😱 B is feared — forced to Block!`; }
    }
  }

  // Apply sword B effects if B dealt damage
  if (dmgToA > 0 && swordB) {
    if (swordB.effect === 'all') {
      extraLog += applyAllEffects(false, true, false);
    } else {
      if (swordB.effect === 'bleed') { stateA.bleed = 2; extraLog += `\n🩸 Bleed applied to A!`; }
      if (swordB.effect === 'stun' && Math.random() < 0.15) { stateA.stunned = true; extraLog += `\n⚡ A is stunned next round!`; }
      if (swordB.effect === 'lifesteal') { hpB = Math.min(hpB + 5, 200); extraLog += `\n💚 B lifesteals 5 HP!`; }
      if (swordB.effect === 'fear' && Math.random() < 0.2) { stateA.forcedBlock = true; extraLog += `\n😱 A is feared — forced to Block!`; }
    }
  }

  return { hpA, hpB, stateA, stateB, extraLog };
}

function getBaseHP(armorId) {
  const armor = DUEL_ARMORS.find(a => a.id === armorId);
  return 100 + (armor ? armor.hpBonus : 0);
}

function getActionEmoji(action) {
  const map = { strike: '⚔️', block: '🛡️', parry: '🔰', heavy: '💣', forfeit: '🏃' };
  return map[action] || '❓';
}

function buildHPBar(hp, max) {
  const pct = Math.max(0, hp / max);
  const full = Math.round(pct * 8);
  return '❤️'.repeat(full) + '🖤'.repeat(8 - full);
}

// ── LEADERBOARD ────────────────────────────────────────────────────────────
async function ensureTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS duel_stats (
      user_id TEXT NOT NULL, guild_id TEXT NOT NULL, username TEXT,
      wins INT DEFAULT 0, losses INT DEFAULT 0,
      total_gold_won INT DEFAULT 0, total_gold_lost INT DEFAULT 0,
      debt INT DEFAULT 0,
      PRIMARY KEY (user_id, guild_id)
    )
  `);
}

async function saveStats(pool, userId, guildId, username, data) {
  if (!pool) return;
  try {
    await ensureTable(pool);
    await pool.query(`
      INSERT INTO duel_stats (user_id, guild_id, username, wins, losses, total_gold_won, total_gold_lost, debt)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (user_id, guild_id) DO UPDATE SET
        username = EXCLUDED.username,
        wins = EXCLUDED.wins,
        losses = EXCLUDED.losses,
        total_gold_won = EXCLUDED.total_gold_won,
        total_gold_lost = EXCLUDED.total_gold_lost,
        debt = EXCLUDED.debt
    `, [userId, guildId, username, data.wins, data.losses, data.totalGoldWon, data.totalGoldLost, data.debt]);
  } catch (err) {
    console.error('duel saveStats failed:', err.message);
  }
}

async function buildLeaderboard(pool, guildId) {
  try {
    await ensureTable(pool);
    const result = await pool.query(
      `SELECT username, wins, losses, total_gold_won, total_gold_lost, debt
       FROM duel_stats WHERE guild_id = $1 ORDER BY wins DESC LIMIT 10`,
      [guildId]
    );
    const medals = ['🥇', '🥈', '🥉'];
    const lines = result.rows.length === 0
      ? ['No duels yet! Challenge someone with `/duel challenge`']
      : result.rows.map((r, i) => {
          const rank = medals[i] || `**#${i + 1}**`;
          const debt = r.debt > 0 ? ` 💸 **IN DEBT: ${r.debt}g**` : '';
          return `${rank} **${r.username}** — ${r.wins}W/${r.losses}L — 🪙 +${r.total_gold_won}g${debt}`;
        });
    return new EmbedBuilder()
      .setColor('#f0a500')
      .setTitle('⚔️ Duel Leaderboard')
      .setDescription(lines.join('\n'))
      .setFooter({ text: '💸 = currently in debt' });
  } catch (err) {
    console.error('duel leaderboard failed:', err.message);
    return new EmbedBuilder().setColor('#ff0000').setDescription('Failed to load leaderboard.');
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('duel')
    .setDescription('Challenge players to duels, earn tokens, buy gear')
    .addSubcommand(sub =>
      sub.setName('challenge')
        .setDescription('Challenge another player to a duel')
        .addUserOption(opt => opt.setName('opponent').setDescription('Who to challenge').setRequired(true))
        .addIntegerOption(opt => opt.setName('bet').setDescription('Gold to bet (dungeon gold)').setRequired(true).setMinValue(1))
    )
    .addSubcommand(sub => sub.setName('stats').setDescription('View your duel stats'))
    .addSubcommand(sub => sub.setName('leaderboard').setDescription('View the duel leaderboard'))
    .addSubcommand(sub => sub.setName('shop').setDescription('Buy duel armor and swords with duel tokens'))
    .addSubcommand(sub => sub.setName('inventory').setDescription('View your duel gear'))
    .addSubcommand(sub =>
      sub.setName('equip')
        .setDescription('Equip duel armor or sword')
        .addStringOption(opt =>
          opt.setName('item').setDescription('Item to equip').setRequired(true)
            .addChoices(
              { name: '🟤 Leather Plate',      value: 'armor_leather'   },
              { name: '⛓️ Chainmail',          value: 'armor_chainmail' },
              { name: '🔵 Steel Plate',        value: 'armor_steel'     },
              { name: '🟡 Gold Plate',         value: 'armor_gold'      },
              { name: '💎 Diamond Plate',      value: 'armor_diamond'   },
              { name: '🌑 Shadowforged',       value: 'armor_shadow'    },
              { name: '👼 Celestial Plate',    value: 'armor_celestial' },
              { name: '🧞‍♂️ Nxy\'s Plate',      value: 'armor_nxy'       },
              { name: '👽 Chrxmee\'s Plate',   value: 'armor_chrxmee'   },
              { name: '🗡️ Rusty Blade',        value: 'sword_rusty'     },
              { name: '⚔️ Steel Edge',         value: 'sword_steel'     },
              { name: '✨ Enchanted Blade',    value: 'sword_enchanted' },
              { name: '💀 Wraithblade',        value: 'sword_wraith'    },
              { name: '🧞‍♂️ Nxy\'s Blade',      value: 'sword_nxy'       },
              { name: '👽 Chrxmee\'s Blade',   value: 'sword_chrxmee'   }
            )
        )
    )
    .addSubcommand(sub =>
      sub.setName('pay')
        .setDescription('Manually pay off your debt')
        .addStringOption(opt =>
          opt.setName('currency').setDescription('Which currency to pay with').setRequired(true)
            .addChoices(
              { name: '🪙 Dungeon Gold',  value: 'dungeon' },
              { name: '⛏️ Mine Coins',   value: 'mining'  },
              { name: '🌾 Farm Coins',   value: 'farm'    },
              { name: '🎟️ Duel Tokens',  value: 'tokens'  }
            )
        )
        .addIntegerOption(opt => opt.setName('amount').setDescription('Amount to pay').setRequired(true).setMinValue(1))
    )
    .addSubcommand(sub => sub.setName('reset').setDescription('Reset your duel data (clears tokens, gear and stats)'))
    .addSubcommand(sub =>
      sub.setName('give')
        .setDescription('(Owner only) Give duel tokens to a user')
        .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
        .addIntegerOption(opt => opt.setName('amount').setDescription('Amount of tokens').setRequired(true).setMinValue(1))
    ),

  async execute(interaction, client) {
    try {
      await interaction.deferReply({ ephemeral: false });
    } catch (err) {
      console.error('Duel defer failed:', err);
      return interaction.reply({ content: 'Failed to start.', ephemeral: true }).catch(() => {});
    }

    const userId = interaction.user.id;
    const guildId = interaction.guild.id;
    const username = interaction.user.username;
    const key = `duel_${guildId}_${userId}`;

    let data = client.memory.get(key) || getDefaultDuelData();
    data = migrateDuelData(data);
    data = applyInterest(data);
    client.memory.set(key, data);

    const sub = interaction.options.getSubcommand();

    // ── RESET ──────────────────────────────────────────────
    if (sub === 'reset') {
      client.memory.delete(key);
      return interaction.editReply('✅ Duel data fully reset. Tokens, gear and stats cleared!');
    }

    // ── GIVE (owner only) ──────────────────────────────────
    if (sub === 'give') {
      if (!OWNER_IDS.includes(userId)) return interaction.editReply('❌ Owner only.');
      const target = interaction.options.getUser('user');
      const amount = interaction.options.getInteger('amount');
      const tKey = `duel_${guildId}_${target.id}`;
      let tData = client.memory.get(tKey) || getDefaultDuelData();
      tData = migrateDuelData(tData);
      tData.tokens += amount;
      client.memory.set(tKey, tData);
      return interaction.editReply(`✅ Gave **${amount} duel tokens** to **${target.username}**! They now have **${tData.tokens}** tokens.`);
    }

    // ── STATS ──────────────────────────────────────────────
    if (sub === 'stats') {
      const armor = DUEL_ARMORS.find(a => a.id === data.equippedArmor);
      const sword = DUEL_SWORDS.find(s => s.id === data.equippedSword);
      const embed = new EmbedBuilder()
        .setColor(data.debt > 0 ? '#ff0000' : '#f0a500')
        .setTitle(`⚔️ ${username}'s Duel Stats`)
        .addFields(
          { name: '🏆 Wins',         value: `${data.wins}`,         inline: true },
          { name: '💀 Losses',       value: `${data.losses}`,       inline: true },
          { name: '🎟️ Tokens',       value: `${data.tokens}`,       inline: true },
          { name: '🪙 Gold Won',     value: `${data.totalGoldWon}`, inline: true },
          { name: '🪙 Gold Lost',    value: `${data.totalGoldLost}`,inline: true },
          { name: '💸 Debt',         value: data.debt > 0 ? `**${data.debt}g** ⚠️ +5%/day` : 'None', inline: true },
          { name: '🛡️ Duel Armor',   value: armor ? armor.name : 'None', inline: true },
          { name: '⚔️ Duel Sword',   value: sword ? `${sword.name} — ${sword.effectDesc}` : 'None', inline: false },
        );
      return interaction.editReply({ embeds: [embed] });
    }

    // ── LEADERBOARD ────────────────────────────────────────
    if (sub === 'leaderboard') {
      if (!client.pool) return interaction.editReply('❌ Database not available.');
      const embed = await buildLeaderboard(client.pool, guildId);
      return interaction.editReply({ embeds: [embed] });
    }

    // ── SHOP ───────────────────────────────────────────────
    if (sub === 'shop') {
      if (data.debt > 0) {
        return interaction.editReply(`❌ You're in debt (**${data.debt}g**)! Pay it off with \`/duel pay\` before shopping.`);
      }

      const armorLines = DUEL_ARMORS.map(a => {
        const owned = data.inventory.includes(`armor_${a.id}`);
        let line = `${a.name} — **${a.cost} tokens** — ${a.desc}${owned ? ' ✅' : ''}`;
        if (a.restricted && a.ownerId !== userId) {
          const masterName = a.ownerId === '954709865698312213' ? 'nxy' : 'chrxmee';
          const emoji = a.ownerId === '954709865698312213' ? '🧞‍♂️' : '👽';
          line += ` 🔒 (${emoji} ${masterName} only)`;
        }
        return line;
      });
      const swordLines = DUEL_SWORDS.map(s => {
        const owned = data.inventory.includes(`sword_${s.id}`);
        let line = `${s.name} — **${s.cost} tokens** — +${s.bonusDmg} dmg — ${s.effectDesc}${owned ? ' ✅' : ''}`;
        if (s.restricted && s.ownerId !== userId) {
          const masterName = s.ownerId === '954709865698312213' ? 'nxy' : 'chrxmee';
          const emoji = s.ownerId === '954709865698312213' ? '🧞‍♂️' : '👽';
          line += ` 🔒 (${emoji} ${masterName} only)`;
        }
        return line;
      });

      const embed = new EmbedBuilder()
        .setColor('#f0a500')
        .setTitle('🏪 Duel Shop')
        .addFields(
          { name: '🛡️ Duel Armor', value: armorLines.join('\n'), inline: false },
          { name: '⚔️ Duel Swords', value: swordLines.join('\n'), inline: false },
          { name: '🎟️ Your Tokens', value: `${data.tokens}`, inline: true }
        );

      // Armor buttons – 5 rows (5 + 4)
      const armorRow1 = new ActionRowBuilder().addComponents(
        DUEL_ARMORS.slice(0, 5).map(a => {
          const owned = data.inventory.includes(`armor_${a.id}`);
          const label = `${owned ? '✅' : '🛡️'} ${a.name.split(' ').slice(1).join(' ')}`;
          return new ButtonBuilder()
            .setCustomId(`dshop_armor_${a.id}`)
            .setLabel(label.substring(0, 80))
            .setStyle(owned ? ButtonStyle.Secondary : ButtonStyle.Primary)
            .setDisabled(owned);
        })
      );
      const armorRow2 = new ActionRowBuilder().addComponents(
        DUEL_ARMORS.slice(5, 9).map(a => {
          const owned = data.inventory.includes(`armor_${a.id}`);
          const label = `${owned ? '✅' : '🛡️'} ${a.name.split(' ').slice(1).join(' ')}`;
          return new ButtonBuilder()
            .setCustomId(`dshop_armor_${a.id}`)
            .setLabel(label.substring(0, 80))
            .setStyle(owned ? ButtonStyle.Secondary : ButtonStyle.Primary)
            .setDisabled(owned);
        })
      );

      // Swords – 6 items (5 + 1)
      const swordRow1 = new ActionRowBuilder().addComponents(
        DUEL_SWORDS.slice(0, 5).map(s => {
          const owned = data.inventory.includes(`sword_${s.id}`);
          const label = `${owned ? '✅' : '⚔️'} ${s.name.split(' ').slice(1).join(' ')}`;
          return new ButtonBuilder()
            .setCustomId(`dshop_sword_${s.id}`)
            .setLabel(label.substring(0, 80))
            .setStyle(owned ? ButtonStyle.Secondary : ButtonStyle.Danger)
            .setDisabled(owned);
        })
      );
      const swordRow2 = new ActionRowBuilder().addComponents(
        DUEL_SWORDS.slice(5, 6).map(s => {
          const owned = data.inventory.includes(`sword_${s.id}`);
          const label = `${owned ? '✅' : '⚔️'} ${s.name.split(' ').slice(1).join(' ')}`;
          return new ButtonBuilder()
            .setCustomId(`dshop_sword_${s.id}`)
            .setLabel(label.substring(0, 80))
            .setStyle(owned ? ButtonStyle.Secondary : ButtonStyle.Danger)
            .setDisabled(owned);
        })
      );

      await interaction.editReply({ embeds: [embed], components: [armorRow1, armorRow2, swordRow1, swordRow2] });
      const shopMsg = await interaction.fetchReply();
      const collector = shopMsg.createMessageComponentCollector({ time: 45000 });

      collector.on('collect', async btn => {
        try { await btn.deferUpdate(); } catch (e) { return; }
        if (btn.user.id !== userId) return;
        data = client.memory.get(key) || data;

        const cid = btn.customId;
        let reply = '';

        if (cid.startsWith('dshop_armor_')) {
          const armorId = cid.replace('dshop_armor_', '');
          const armor = DUEL_ARMORS.find(a => a.id === armorId);
          if (!armor) return;
          const invKey = `armor_${armorId}`;
          if (data.inventory.includes(invKey)) { reply = '❌ Already owned!'; }
          else if (armor.restricted && armor.ownerId !== userId) {
            const masterName = armor.ownerId === '954709865698312213' ? 'nxy' : 'chrxmee';
            const emoji = armor.ownerId === '954709865698312213' ? '🧞‍♂️' : '👽';
            reply = `${emoji} legend says only the master ${masterName} can buy this armor.`;
          }
          else if (data.tokens < armor.cost) { reply = `❌ Need **${armor.cost} tokens**, you have **${data.tokens}**.`; }
          else { data.tokens -= armor.cost; data.inventory.push(invKey); reply = `✅ Bought **${armor.name}**!\n🎟️ Tokens left: **${data.tokens}**`; }
        } else if (cid.startsWith('dshop_sword_')) {
          const swordId = cid.replace('dshop_sword_', '');
          const sword = DUEL_SWORDS.find(s => s.id === swordId);
          if (!sword) return;
          const invKey = `sword_${swordId}`;
          if (data.inventory.includes(invKey)) { reply = '❌ Already owned!'; }
          else if (sword.restricted && sword.ownerId !== userId) {
            const masterName = sword.ownerId === '954709865698312213' ? 'nxy' : 'chrxmee';
            const emoji = sword.ownerId === '954709865698312213' ? '🧞‍♂️' : '👽';
            reply = `${emoji} legend says only the master ${masterName} can buy this blade.`;
          }
          else if (data.tokens < sword.cost) { reply = `❌ Need **${sword.cost} tokens**, you have **${data.tokens}**.`; }
          else { data.tokens -= sword.cost; data.inventory.push(invKey); reply = `✅ Bought **${sword.name}**!\n🎟️ Tokens left: **${data.tokens}**`; }
        }

        client.memory.set(key, data);
        if (reply) await btn.followUp({ content: reply, ephemeral: true }).catch(() => {});
      });

      collector.on('end', () => { shopMsg.edit({ components: [] }).catch(() => {}); });
      return;
    }

    // ── INVENTORY ──────────────────────────────────────────
    if (sub === 'inventory') {
      const ownedArmor = data.inventory.filter(i => i.startsWith('armor_')).map(i => {
        const a = DUEL_ARMORS.find(x => `armor_${x.id}` === i);
        return a ? `${a.name} — ${a.desc}${data.equippedArmor === a.id ? ' ✅ Equipped' : ''}` : null;
      }).filter(Boolean);
      const ownedSwords = data.inventory.filter(i => i.startsWith('sword_')).map(i => {
        const s = DUEL_SWORDS.find(x => `sword_${x.id}` === i);
        return s ? `${s.name} — ${s.effectDesc}${data.equippedSword === s.id ? ' ✅ Equipped' : ''}` : null;
      }).filter(Boolean);

      const embed = new EmbedBuilder()
        .setColor('#2f3136')
        .setTitle(`🎒 ${username}'s Duel Inventory`)
        .addFields(
          { name: '🛡️ Armor', value: ownedArmor.length > 0 ? ownedArmor.join('\n') : 'None', inline: false },
          { name: '⚔️ Swords', value: ownedSwords.length > 0 ? ownedSwords.join('\n') : 'None', inline: false },
          { name: '🎟️ Tokens', value: `${data.tokens}`, inline: true },
          { name: '💸 Debt', value: data.debt > 0 ? `${data.debt}g` : 'None', inline: true }
        );
      return interaction.editReply({ embeds: [embed] });
    }

    // ── EQUIP ──────────────────────────────────────────────
    if (sub === 'equip') {
      const item = interaction.options.getString('item');
      const [type, id] = item.split('_');
      const invKey = `${type}_${id}`;
      if (!data.inventory.includes(invKey)) return interaction.editReply(`❌ You don't own that item! Visit \`/duel shop\`.`);

      if (type === 'armor') {
        const armor = DUEL_ARMORS.find(a => a.id === id);
        if (armor && armor.restricted && armor.ownerId !== userId) {
          const masterName = armor.ownerId === '954709865698312213' ? 'nxy' : 'chrxmee';
          const emoji = armor.ownerId === '954709865698312213' ? '🧞‍♂️' : '👽';
          return interaction.editReply(`${emoji} legend says only the master ${masterName} can wear this armor.`);
        }
        data.equippedArmor = id;
        client.memory.set(key, data);
        return interaction.editReply(`✅ Equipped **${armor.name}**! ${armor.desc}`);
      } else if (type === 'sword') {
        const sword = DUEL_SWORDS.find(s => s.id === id);
        if (sword && sword.restricted && sword.ownerId !== userId) {
          const masterName = sword.ownerId === '954709865698312213' ? 'nxy' : 'chrxmee';
          const emoji = sword.ownerId === '954709865698312213' ? '🧞‍♂️' : '👽';
          return interaction.editReply(`${emoji} legend says only the master ${masterName} can wield this blade.`);
        }
        data.equippedSword = id;
        client.memory.set(key, data);
        return interaction.editReply(`✅ Equipped **${sword.name}**! ${sword.effectDesc}`);
      }
    }

    // ── PAY DEBT ───────────────────────────────────────────
    if (sub === 'pay') {
      if (data.debt <= 0) return interaction.editReply('✅ You have no debt!');
      const currency = interaction.options.getString('currency');
      const amount = interaction.options.getInteger('amount');
      let paid = 0;

      if (currency === 'dungeon') {
        const dData = client.memory.get(`dungeon_${guildId}_${userId}`);
        if (!dData || dData.gold < amount) return interaction.editReply(`❌ Not enough dungeon gold! You have **${dData?.gold || 0}g**.`);
        dData.gold -= amount; paid = amount;
        client.memory.set(`dungeon_${guildId}_${userId}`, dData);
      } else if (currency === 'mining') {
        const mData = client.memory.get(`mining_${guildId}_${userId}`);
        if (!mData || mData.coins < amount) return interaction.editReply(`❌ Not enough mine coins! You have **${mData?.coins || 0}c**.`);
        mData.coins -= amount; paid = amount;
        client.memory.set(`mining_${guildId}_${userId}`, mData);
      } else if (currency === 'farm') {
        const fData = client.memory.get(`farm_${guildId}_${userId}`);
        if (!fData || fData.coins < amount) return interaction.editReply(`❌ Not enough farm coins! You have **${fData?.coins || 0}c**.`);
        fData.coins -= amount; paid = amount;
        client.memory.set(`farm_${guildId}_${userId}`, fData);
      } else if (currency === 'tokens') {
        if (data.tokens < amount) return interaction.editReply(`❌ Not enough duel tokens! You have **${data.tokens}**.`);
        data.tokens -= amount; paid = amount;
      }

      data.debt = Math.max(0, data.debt - paid);
      if (data.debt <= 0) { data.debt = 0; data.debtLastChecked = null; }
      client.memory.set(key, data);
      await saveStats(client.pool, userId, guildId, username, data);

      return interaction.editReply(
        `💸 Paid **${paid}** toward your debt!\n` +
        (data.debt > 0 ? `⚠️ Remaining debt: **${data.debt}g** (5%/day interest)` : `✅ Debt fully cleared! You're free!`)
      );
    }

    // ── CHALLENGE ──────────────────────────────────────────
    if (sub === 'challenge') {
      const opponent = interaction.options.getUser('opponent');
      const bet = interaction.options.getInteger('bet');

      if (opponent.id === userId) return interaction.editReply('❌ You can\'t duel yourself!');
      if (opponent.bot) return interaction.editReply('❌ You can\'t duel a bot!');

      const challDungeonData = client.memory.get(`dungeon_${guildId}_${userId}`);
      if (!challDungeonData || challDungeonData.gold < bet) {
        return interaction.editReply(`❌ You need **${bet}g** dungeon gold to bet. You have **${challDungeonData?.gold || 0}g**.`);
      }

      const challengeEmbed = new EmbedBuilder()
        .setColor('#f0a500')
        .setTitle('⚔️ Duel Challenge!')
        .setDescription(`**${username}** has challenged **${opponent.username}** to a duel!\n\nBet: **${bet} dungeon gold**\nFormat: Best of 3 rounds`)
        .addFields(
          { name: '⚔️ Challenger', value: `<@${userId}>`, inline: true },
          { name: '🎯 Opponent',   value: `<@${opponent.id}>`, inline: true }
        )
        .setFooter({ text: `${opponent.username} has 60 seconds to accept or decline.` });

      const acceptRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`duel_accept_${userId}_${opponent.id}_${bet}`).setLabel('✅ Accept').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`duel_decline_${userId}_${opponent.id}`).setLabel('❌ Decline').setStyle(ButtonStyle.Danger)
      );

      await interaction.editReply({ embeds: [challengeEmbed], components: [acceptRow] });
      const challengeMsg = await interaction.fetchReply();
      const collector = challengeMsg.createMessageComponentCollector({ time: 60000 });

      collector.on('collect', async btn => {
        try { await btn.deferUpdate(); } catch (e) { return; }

        if (btn.customId.startsWith('duel_decline_')) {
          if (btn.user.id !== opponent.id && btn.user.id !== userId) return;
          collector.stop('declined');
          await challengeMsg.edit({
            embeds: [new EmbedBuilder().setColor('#ff0000').setTitle('⚔️ Duel Declined').setDescription(`**${opponent.username}** declined the duel.`)],
            components: []
          }).catch(() => {});
          return;
        }

        if (btn.customId.startsWith('duel_accept_')) {
          if (btn.user.id !== opponent.id) {
            return btn.followUp({ content: '❌ Only the challenged player can accept!', ephemeral: true }).catch(() => {});
          }

          const oppDungeonData = client.memory.get(`dungeon_${guildId}_${opponent.id}`);
          if (!oppDungeonData || oppDungeonData.gold < bet) {
            collector.stop('no_gold');
            await challengeMsg.edit({
              embeds: [new EmbedBuilder().setColor('#ff0000').setTitle('❌ Duel Cancelled').setDescription(`**${opponent.username}** doesn't have enough dungeon gold to cover the bet!`)],
              components: []
            }).catch(() => {});
            return;
          }

          collector.stop('accepted');
          await startDuel(challengeMsg, client, guildId, userId, username, opponent.id, opponent.username, bet);
        }
      });

      collector.on('end', (_, reason) => {
        if (reason === 'time') {
          challengeMsg.edit({
            embeds: [new EmbedBuilder().setColor('#888888').setTitle('⚔️ Duel Expired').setDescription('The challenge was not accepted in time.')],
            components: []
          }).catch(() => {});
        }
      });
    }
  }
};

// ── DUEL SESSION ───────────────────────────────────────────────────────────
async function startDuel(msg, client, guildId, userAId, userAName, userBId, userBName, bet) {
  const keyA = `duel_${guildId}_${userAId}`;
  const keyB = `duel_${guildId}_${userBId}`;

  let dataA = migrateDuelData(client.memory.get(keyA) || getDefaultDuelData());
  let dataB = migrateDuelData(client.memory.get(keyB) || getDefaultDuelData());

  const armorA = DUEL_ARMORS.find(a => a.id === dataA.equippedArmor) || null;
  const armorB = DUEL_ARMORS.find(a => a.id === dataB.equippedArmor) || null;
  const swordA = DUEL_SWORDS.find(s => s.id === dataA.equippedSword) || null;
  const swordB = DUEL_SWORDS.find(s => s.id === dataB.equippedSword) || null;

  const maxHpA = getBaseHP(dataA.equippedArmor);
  const maxHpB = getBaseHP(dataB.equippedArmor);
  let hpA = maxHpA, hpB = maxHpB;

  let winsA = 0, winsB = 0;
  let round = 1;

  let stateA = { bleed: 0, stunned: false, forcedBlock: false };
  let stateB = { bleed: 0, stunned: false, forcedBlock: false };

  async function playRound() {
    const roundEmbed = new EmbedBuilder()
      .setColor('#f0a500')
      .setTitle(`⚔️ Duel — Round ${round} of Best of 3`)
      .setDescription(`Both players pick their action secretly! You have **30 seconds**.`)
      .addFields(
        { name: `${userAName}`, value: `${buildHPBar(hpA, maxHpA)} ${hpA}/${maxHpA} HP\n${armorA ? armorA.name : 'No armor'} | ${swordA ? swordA.name : 'Fists'}`, inline: true },
        { name: `${userBName}`, value: `${buildHPBar(hpB, maxHpB)} ${hpB}/${maxHpB} HP\n${armorB ? armorB.name : 'No armor'} | ${swordB ? swordB.name : 'Fists'}`, inline: true },
        { name: '🏆 Score', value: `${userAName}: **${winsA}** | ${userBName}: **${winsB}**`, inline: false }
      );

    const actionRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('da_strike').setLabel('⚔️ Strike').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('da_block').setLabel('🛡️ Block').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('da_parry').setLabel('🔰 Parry').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('da_heavy').setLabel('💣 Heavy').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('da_forfeit').setLabel('🏃 Forfeit').setStyle(ButtonStyle.Secondary)
    );

    await msg.edit({ embeds: [roundEmbed], components: [actionRow] }).catch(() => {});

    let actionA = null, actionB = null;

    const collector = msg.createMessageComponentCollector({ time: 30000 });

    await new Promise(resolve => {
      const timer = setTimeout(() => {
        if (!actionA) actionA = ['strike', 'block', 'parry', 'heavy'][Math.floor(Math.random() * 4)];
        if (!actionB) actionB = ['strike', 'block', 'parry', 'heavy'][Math.floor(Math.random() * 4)];
        collector.stop('timeout');
        resolve();
      }, 30000);

      collector.on('collect', async btn => {
        try { await btn.deferUpdate(); } catch (e) { return; }

        if (btn.user.id !== userAId && btn.user.id !== userBId) return;

        const action = btn.customId.replace('da_', '');

        if (btn.user.id === userAId && !actionA) {
          actionA = action;
          await btn.followUp({ content: `✅ You chose **${getActionEmoji(action)} ${action}**! Waiting for opponent...`, ephemeral: true }).catch(() => {});
        } else if (btn.user.id === userBId && !actionB) {
          actionB = action;
          await btn.followUp({ content: `✅ You chose **${getActionEmoji(action)} ${action}**! Waiting for opponent...`, ephemeral: true }).catch(() => {});
        }

        if (actionA && actionB) {
          clearTimeout(timer);
          collector.stop('both_picked');
          resolve();
        }
      });
    });

    if (actionA === 'forfeit' || actionB === 'forfeit') {
      const forfeitWinner = actionA === 'forfeit' ? userBName : userAName;
      const forfeitLoser = actionA === 'forfeit' ? userAName : userBName;
      if (actionA === 'forfeit') winsB = 2;
      else winsA = 2;

      await msg.edit({
        embeds: [new EmbedBuilder().setColor('#888888').setTitle('🏃 Forfeit!')
          .setDescription(`**${forfeitLoser}** forfeited! **${forfeitWinner}** wins the duel!`)],
        components: []
      }).catch(() => {});
      return await finalizeDuel(msg, client, guildId, userAId, userAName, userBId, userBName, winsA, winsB, bet, dataA, dataB);
    }

    if (stateA.stunned) { actionA = 'block'; stateA.stunned = false; }
    if (stateB.stunned) { actionB = 'block'; stateB.stunned = false; }

    const { dmgToA, dmgToB, log } = resolveRound(actionA, actionB, swordA, swordB, armorA, armorB, stateA, stateB);
    hpA = Math.max(0, hpA - dmgToA);
    hpB = Math.max(0, hpB - dmgToB);

    const effects = applySwordEffects(swordA, swordB, dmgToA, dmgToB, hpA, hpB, stateA, stateB, actionA, actionB);
    hpA = effects.hpA; hpB = effects.hpB;
    stateA = effects.stateA; stateB = effects.stateB;

    let roundResult = '';
    if (hpA <= 0 && hpB <= 0) {
      roundResult = `💥 Both knocked out! No point awarded.`;
    } else if (hpA <= 0) {
      winsB++;
      hpA = maxHpA; hpB = maxHpB;
      stateA = { bleed: 0, stunned: false, forcedBlock: false };
      stateB = { bleed: 0, stunned: false, forcedBlock: false };
      roundResult = `💀 **${userAName}** was knocked out! **${userBName}** takes round ${round}!`;
    } else if (hpB <= 0) {
      winsA++;
      hpA = maxHpA; hpB = maxHpB;
      stateA = { bleed: 0, stunned: false, forcedBlock: false };
      stateB = { bleed: 0, stunned: false, forcedBlock: false };
      roundResult = `💀 **${userBName}** was knocked out! **${userAName}** takes round ${round}!`;
    } else {
      roundResult = `Round continues — no knockout yet.`;
    }

    const roundReveal = new EmbedBuilder()
      .setColor('#f0a500')
      .setTitle(`⚔️ Round ${round} Result`)
      .setDescription(
        `${getActionEmoji(actionA)} **${userAName}** chose **${actionA}**\n` +
        `${getActionEmoji(actionB)} **${userBName}** chose **${actionB}**\n\n` +
        `${log}${effects.extraLog}\n\n` +
        `**${userAName}** took **${dmgToA}** damage | **${userBName}** took **${dmgToB}** damage\n\n` +
        `${roundResult}`
      )
      .addFields(
        { name: `${userAName} HP`, value: `${buildHPBar(hpA, maxHpA)} ${hpA}/${maxHpA}`, inline: true },
        { name: `${userBName} HP`, value: `${buildHPBar(hpB, maxHpB)} ${hpB}/${maxHpB}`, inline: true },
        { name: '🏆 Score', value: `${userAName}: **${winsA}** | ${userBName}: **${winsB}**`, inline: false }
      );

    await msg.edit({ embeds: [roundReveal], components: [] }).catch(() => {});

    if (winsA >= 2 || winsB >= 2) {
      await new Promise(r => setTimeout(r, 3000));
      return await finalizeDuel(msg, client, guildId, userAId, userAName, userBId, userBName, winsA, winsB, bet, dataA, dataB);
    }

    round++;
    await new Promise(r => setTimeout(r, 3000));
    await playRound();
  }

  await playRound();
}

async function finalizeDuel(msg, client, guildId, userAId, userAName, userBId, userBName, winsA, winsB, bet, dataA, dataB) {
  const winnerId = winsA >= winsB ? userAId : userBId;
  const loserId = winsA >= winsB ? userBId : userAId;
  const winnerName = winsA >= winsB ? userAName : userBName;
  const loserName = winsA >= winsB ? userBName : userAName;

  const keyW = `duel_${guildId}_${winnerId}`;
  const keyL = `duel_${guildId}_${loserId}`;
  let winnerDuel = migrateDuelData(client.memory.get(keyW) || getDefaultDuelData());
  let loserDuel = migrateDuelData(client.memory.get(keyL) || getDefaultDuelData());

  winnerDuel.tokens += 50;
  loserDuel.tokens += 15;
  winnerDuel.wins++;
  loserDuel.losses++;

  const loserDungeonKey = `dungeon_${guildId}_${loserId}`;
  const winnerDungeonKey = `dungeon_${guildId}_${winnerId}`;
  let loserDungeonData = client.memory.get(loserDungeonKey);
  let winnerDungeonData = client.memory.get(winnerDungeonKey);

  let paid = 0;
  let debtAdded = 0;

  if (loserDungeonData) {
    paid = Math.min(loserDungeonData.gold, bet);
    loserDungeonData.gold -= paid;
    client.memory.set(loserDungeonKey, loserDungeonData);
  }

  const remaining = bet - paid;
  if (remaining > 0) {
    let stillOwed = remaining;

    const mKey = `mining_${guildId}_${loserId}`;
    const fKey = `farm_${guildId}_${loserId}`;
    const mData = client.memory.get(mKey);
    const fData = client.memory.get(fKey);

    if (mData && mData.coins > 0 && stillOwed > 0) {
      const take = Math.min(mData.coins, stillOwed);
      mData.coins -= take; stillOwed -= take;
      client.memory.set(mKey, mData);
      paid += take;
    }
    if (fData && fData.coins > 0 && stillOwed > 0) {
      const take = Math.min(fData.coins, stillOwed);
      fData.coins -= take; stillOwed -= take;
      client.memory.set(fKey, fData);
      paid += take;
    }
    if (loserDuel.tokens > 0 && stillOwed > 0) {
      const take = Math.min(loserDuel.tokens, stillOwed);
      loserDuel.tokens -= take; stillOwed -= take;
      paid += take;
    }

    if (stillOwed > 0) {
      debtAdded = stillOwed;
      loserDuel.debt = (loserDuel.debt || 0) + debtAdded;
      loserDuel.debtLastChecked = Date.now();
    }
  }

  if (winnerDungeonData) {
    winnerDungeonData.gold += paid;
    client.memory.set(winnerDungeonKey, winnerDungeonData);
  }

  winnerDuel.totalGoldWon += paid;
  loserDuel.totalGoldLost += paid;

  client.memory.set(keyW, winnerDuel);
  client.memory.set(keyL, loserDuel);

  if (client.pool) {
    await saveStats(client.pool, winnerId, guildId, winnerName, winnerDuel).catch(() => {});
    await saveStats(client.pool, loserId, guildId, loserName, loserDuel).catch(() => {});
  }

  const debtLine = debtAdded > 0 ? `\n\n💸 **${loserName}** couldn't cover the full bet and is now in **debt for ${debtAdded}g**!\n⚠️ Debt grows at **5% per day** until paid off with \`/duel pay\`.` : '';

  await msg.edit({
    embeds: [new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle(`🏆 ${winnerName} wins the duel!`)
      .setDescription(
        `**${winnerName}** defeated **${loserName}** ${winsA}-${winsB}!\n\n` +
        `🪙 **${winnerName}** receives **${paid}g**!\n` +
        `🎟️ Tokens: **${winnerName}** +50 | **${loserName}** +15` +
        debtLine
      )
      .addFields(
        { name: '🏆 Winner', value: `**${winnerName}** — ${winsA >= winsB ? winsA : winsB} rounds`, inline: true },
        { name: '💀 Loser',  value: `**${loserName}** — ${winsA >= winsB ? winsB : winsA} rounds`, inline: true }
      )],
    components: []
  }).catch(() => {});
}
