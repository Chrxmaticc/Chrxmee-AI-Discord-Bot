const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getSkillBonus, getPrestigeBonus, getRoomXP, getBossXP, xpForLevel, getPrestigeKey, NIGHTMARE_ROOMS, PRESTIGE_BOSSES } = require('./dungeon-prestige');

const OWNER_ID = '902685494247325776';

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
];

const BOSSES = [
  { emoji: '🧙', name: 'Forest Witch',   flavor: 'She cackles as the trees close in around you...' },
  { emoji: '💀', name: 'Undead Knight',  flavor: 'His hollow eyes glow red. The ground shakes.' },
  { emoji: '🌋', name: 'Lava Titan',     flavor: 'Magma drips from his fists. The air is on fire.' },
  { emoji: '🐉', name: 'Frost Wyrm',     flavor: 'Its icy breath freezes the walls solid.' },
  { emoji: '🦑', name: 'Kraken',         flavor: 'Tentacles erupt from the flooded floor.' },
  { emoji: '👑', name: 'Fallen King',    flavor: 'He ruled this dungeon once. Now he rules only death.' },
  { emoji: '💎', name: 'Ancient Dragon', flavor: 'Its scales shimmer. One breath could end everything.' },
  { emoji: '🔥', name: 'Infernal Demon', flavor: 'Flames pour from its eyes. The walls melt.' },
  { emoji: '⚡', name: 'Storm Giant',    flavor: 'Lightning crackles with every step it takes.' },
  { emoji: '👁️', name: 'Void Walker',   flavor: 'It stares into your soul. Reality bends around it.' },
];

function getBoss(room) {
  if (room % 10 !== 0) return null;
  const index = Math.floor(room / 10) - 1;
  const base = BOSSES[index % BOSSES.length];
  const hp = 60 + (room * 4);
  return { ...base, maxHp: hp, currentHp: hp };
}

const ARMOR_SHOP = [
  { id: 'leather',   name: '🟤 Leather Armor',  cost: 200,   hpBonus: 1,  desc: '+1 DEF' },
  { id: 'iron',      name: '⚙️ Iron Armor',      cost: 500,   hpBonus: 2,  desc: '+2 DEF' },
  { id: 'gold',      name: '🟡 Gold Armor',      cost: 1000,  hpBonus: 3,  desc: '+3 DEF' },
  { id: 'diamond',   name: '💎 Diamond Armor',   cost: 2000,  hpBonus: 4,  desc: '+4 DEF' },
  { id: 'obsidian',  name: '🌑 Obsidian Armor',  cost: 3500,  hpBonus: 5,  desc: '+5 DEF' },
  { id: 'mythril',   name: '🔱 Mythril Armor',   cost: 5500,  hpBonus: 6,  desc: '+6 DEF' },
  { id: 'celestial', name: '👼 Celestial Armor', cost: 7500,  hpBonus: 7,  desc: '+7 DEF' },
  { id: 'infernal',  name: '🔥 Infernal Armor',  cost: 9000,  hpBonus: 8,  desc: '+8 DEF' },
  { id: 'storm',     name: '⚡ Storm Armor',      cost: 12000, hpBonus: 9,  desc: '+9 DEF' },
  { id: 'void',      name: '👁️ Void Armor',      cost: 15000, hpBonus: 10, desc: '+10 DEF' },
];

const SWORDS = [
  { id: 'rusty',    name: '🗡️ Rusty Sword',     cost: 1225,  bonusDmg: 5  },
  { id: 'steel',    name: '⚔️ Steel Sword',      cost: 2500,  bonusDmg: 10 },
  { id: 'enchanted',name: '✨ Enchanted Sword',  cost: 5000,  bonusDmg: 18 },
  { id: 'diamond',  name: '💎 Diamond Sword',    cost: 7500,  bonusDmg: 25 },
  { id: 'moon',     name: '🌙 Moonblade',        cost: 10000, bonusDmg: 30 },
  { id: 'inferno',  name: '🔥 Inferno Blade',    cost: 12500, bonusDmg: 38 },
  { id: 'void',     name: '👁️ Voidreaper',       cost: 15000, bonusDmg: 48 },
];

const POTIONS = [
  { id: 'health', name: '🧪 Health Potion', cost: 75,  desc: 'Restores 30 HP (heals ALL party members)' },
  { id: 'damage', name: '⚔️ Damage Potion', cost: 100, desc: 'Doubles your next boss attack' },
  { id: 'cash',   name: '💰 Cash Potion',   cost: 80,  desc: 'Instantly grants 100 gold' },
];

const SPELLS = [
  { id: 'zoltrarok',  name: '✨ Zoltrarok',  cost: 200, damage: 20, selfDamage: 0,  desc: 'Frieren beam — 20 boss dmg' },
  { id: 'jilwer',     name: '🌊 Jilwer',     cost: 250, damage: 25, selfDamage: 0,  desc: 'Water current — 25 boss dmg' },
  { id: 'granat',     name: '❄️ Granat',     cost: 300, damage: 15, selfDamage: 0,  desc: 'Ice bind — 15 dmg, boss skips turn' },
  { id: 'judradjim',  name: '🔥 Judradjim',  cost: 350, damage: 30, selfDamage: 10, desc: '30 boss dmg, you take 10 HP' },
  { id: 'vollzanbel', name: '🌑 Vollzanbel', cost: 400, damage: 40, selfDamage: 15, desc: '40 boss dmg, you take 15 HP' },
  { id: 'sturm',      name: '🌪️ Sturm',      cost: 450, damage: 35, selfDamage: 0,  desc: 'Wind slash — 35 boss dmg' },
  { id: 'blitzregen', name: '⚡ Blitzregen', cost: 500, damage: 45, selfDamage: 20, desc: '45 boss dmg, you take 20 HP' },
  { id: 'abreissen',  name: '👁️ Abreissen',  cost: 600, damage: 55, selfDamage: 25, desc: 'Void tear — 55 boss dmg, you take 25 HP' },
];

// ── HELPERS ────────────────────────────────────────────────────────────────

function isMod(interaction) {
  return interaction.member &&
    (interaction.member.permissions.has('KickMembers') || interaction.member.permissions.has('BanMembers'));
}

function getPetBuffs(client, guildId, userId) {
  const petData = client.memory.get(`pets_${guildId}_${userId}`);
  if (!petData || !petData.active) return [];
  return petData.active;
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
    inDungeon: false, currentRoom: 0, hp: 100, gold: 0,
    starterId: userId, inventory: [], equippedArmor: null, equippedSword: null,
    farthestRoom: 0, totalGoldEarned: 0,
    potions: { health: 0, damage: 0, cash: 0 },
    spells: { zoltrarok: 0, jilwer: 0, granat: 0, judradjim: 0, vollzanbel: 0, sturm: 0, blitzregen: 0, abreissen: 0 },
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
  if (!data.spells) data.spells = {};
  for (const s of SPELLS) { if (!(s.id in data.spells)) data.spells[s.id] = 0; }
  if (!('damageBoostActive' in data)) data.damageBoostActive = false;
  return data;
}

function getDefaultPrestigeData() {
  return { level: 1, xp: 0, skillPoints: 0, skills: [], prestige: 0, revivesUsed: 0 };
}

function applyXP(client, guildId, userId, xpAmount) {
  const pKey = getPrestigeKey(guildId, userId);
  let pData = client.memory.get(pKey) || getDefaultPrestigeData();
  pData.xp += xpAmount;
  let leveledUp = false;
  while (pData.level < 100 && pData.xp >= xpForLevel(pData.level + 1)) {
    pData.xp -= xpForLevel(pData.level + 1);
    pData.level++;
    pData.skillPoints += 2;
    leveledUp = true;
  }
  client.memory.set(pKey, pData);
  return { pData, leveledUp };
}

// ── PARTY HELPERS ──────────────────────────────────────────────────────────

function findPartyByMember(client, guildId, userId) {
  for (const [key, val] of client.memory.entries()) {
    if (key.startsWith(`party_${guildId}_`) && val.members && val.members.some(m => m.userId === userId)) {
      return { key, party: val };
    }
  }
  return null;
}

function getDefaultParty(hostId, hostName) {
  return {
    hostId,
    members: [{ userId: hostId, username: hostName }],
    ready: {},
    status: 'lobby',
    currentRoom: 1,
    memberHp: { [hostId]: 100 },
    memberAlive: { [hostId]: true },
  };
}

// ── POSTGRES ───────────────────────────────────────────────────────────────

async function saveStats(pool, userId, guildId, username, farthestRoom, totalGoldEarned) {
  if (!pool) return;
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS dungeon_stats (
      user_id TEXT NOT NULL, guild_id TEXT NOT NULL, username TEXT,
      farthest_room INT DEFAULT 0, total_gold_earned INT DEFAULT 0,
      PRIMARY KEY (user_id, guild_id)
    )`);
    await pool.query(`INSERT INTO dungeon_stats (user_id, guild_id, username, farthest_room, total_gold_earned)
      VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (user_id, guild_id) DO UPDATE SET
        username = EXCLUDED.username,
        farthest_room = GREATEST(dungeon_stats.farthest_room, EXCLUDED.farthest_room),
        total_gold_earned = GREATEST(dungeon_stats.total_gold_earned, EXCLUDED.total_gold_earned)
    `, [userId, guildId, username, farthestRoom, totalGoldEarned]);
  } catch (err) { console.error('saveStats failed:', err.message); }
}

async function buildLeaderboardEmbed(pool, guildId, scope, metric) {
  const isGlobal = scope === 'global', isGold = metric === 'gold';
  const orderCol = isGold ? 'total_gold_earned' : 'farthest_room';
  let rows = [];
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS dungeon_stats (
      user_id TEXT NOT NULL, guild_id TEXT NOT NULL, username TEXT,
      farthest_room INT DEFAULT 0, total_gold_earned INT DEFAULT 0,
      PRIMARY KEY (user_id, guild_id)
    )`);
    const q = isGlobal
      ? `SELECT username, MAX(farthest_room) AS farthest_room, MAX(total_gold_earned) AS total_gold_earned FROM dungeon_stats GROUP BY username ORDER BY MAX(${orderCol}) DESC LIMIT 10`
      : `SELECT username, farthest_room, total_gold_earned FROM dungeon_stats WHERE guild_id = $1 ORDER BY ${orderCol} DESC LIMIT 10`;
    const result = await pool.query(q, isGlobal ? [] : [guildId]);
    rows = result.rows;
  } catch (err) { console.error('leaderboard failed:', err.message); }
  const medals = ['🥇','🥈','🥉'];
  const lines = rows.length === 0 ? ['No entries yet!'] : rows.map((r,i) => {
    const rank = medals[i] || `**#${i+1}**`;
    const value = isGold ? `🪙 ${r.total_gold_earned}g` : `🗺️ Room ${r.farthest_room}`;
    return `${rank} **${r.username}** — ${value}`;
  });
  return new EmbedBuilder().setColor('#2f3136')
    .setTitle(`${isGlobal ? '🌍 Global' : '🏠 Local'} Leaderboard — ${isGold ? '🪙 Most Gold' : '🗺️ Farthest Room'}`)
    .setDescription(lines.join('\n'));
}

// ── SHOP ───────────────────────────────────────────────────────────────────

function buildShopEmbed(data) {
  const armorLines = ARMOR_SHOP.map(a => `${a.name} — **${a.cost}g** — ${a.desc}${data.inventory.includes(a.id) ? ' ✅' : ''}`);
  const swordLines = SWORDS.map(s => {
    const owned = data.inventory.includes(`sword_${s.id}`);
    return `${s.name} — **${s.cost}g** — +${s.bonusDmg} dmg${owned ? (data.equippedSword === s.id ? ' ✅ Equipped' : ' ✅ Owned') : ''}`;
  });
  const potionLines = POTIONS.map(p => `${p.name} — **${p.cost}g** — ${p.desc} (own: ${data.potions[p.id]||0})`);
  const spellLines = SPELLS.map(s => `${s.name} — **${s.cost}g** — ${s.desc} (own: ${data.spells[s.id]||0})`);
  return new EmbedBuilder().setColor('#f0a500').setTitle('🏪 Dungeon Shop')
    .addFields(
      { name: '🛡️ Armor (10 tiers)', value: armorLines.join('\n'), inline: false },
      { name: '⚔️ Swords (7 tiers)', value: swordLines.join('\n'), inline: false },
      { name: '🧪 Potions', value: potionLines.join('\n'), inline: false },
      { name: '🔮 Spells (boss rooms only)', value: spellLines.join('\n'), inline: false },
      { name: '🪙 Your Gold', value: `${data.gold}`, inline: true }
    ).setFooter({ text: 'Spells can also drop from boss kills! | /dungeon shop2 for more spells' });
}

function buildShopRows(data) {
  const rows = [];
  rows.push(new ActionRowBuilder().addComponents(ARMOR_SHOP.slice(0,5).map(a => {
    const owned = data.inventory.includes(a.id);
    return new ButtonBuilder().setCustomId(`shop_armor_${a.id}`)
      .setLabel(`${owned?'✅':'🛡️'} ${a.name.split(' ').slice(1,3).join(' ')}`)
      .setStyle(owned ? ButtonStyle.Secondary : ButtonStyle.Primary).setDisabled(owned);
  })));
  rows.push(new ActionRowBuilder().addComponents(ARMOR_SHOP.slice(5).map(a => {
    const owned = data.inventory.includes(a.id);
    return new ButtonBuilder().setCustomId(`shop_armor_${a.id}`)
      .setLabel(`${owned?'✅':'🛡️'} ${a.name.split(' ').slice(1,3).join(' ')}`)
      .setStyle(owned ? ButtonStyle.Secondary : ButtonStyle.Primary).setDisabled(owned);
  })));
  rows.push(new ActionRowBuilder().addComponents(SWORDS.slice(0,5).map(s => {
    const owned = data.inventory.includes(`sword_${s.id}`);
    return new ButtonBuilder().setCustomId(`shop_sword_${s.id}`)
      .setLabel(`${owned?'✅':'⚔️'} ${s.name.split(' ').slice(1,3).join(' ')}`)
      .setStyle(owned ? ButtonStyle.Secondary : ButtonStyle.Danger).setDisabled(owned);
  })));
  rows.push(new ActionRowBuilder().addComponents([
    ...SWORDS.slice(5).map(s => {
      const owned = data.inventory.includes(`sword_${s.id}`);
      return new ButtonBuilder().setCustomId(`shop_sword_${s.id}`)
        .setLabel(`${owned?'✅':'⚔️'} ${s.name.split(' ').slice(1,3).join(' ')}`)
        .setStyle(owned ? ButtonStyle.Secondary : ButtonStyle.Danger).setDisabled(owned);
    }),
    ...POTIONS.map(p => new ButtonBuilder().setCustomId(`shop_potion_${p.id}`)
      .setLabel(`Buy ${p.name.split(' ')[1]}`).setStyle(ButtonStyle.Success))
  ]));
  rows.push(new ActionRowBuilder().addComponents(SPELLS.slice(0,5).map(s =>
    new ButtonBuilder().setCustomId(`shop_spell_${s.id}`)
      .setLabel(`Buy ${s.name.split(' ')[1]}`).setStyle(ButtonStyle.Primary)
  )));
  return rows;
}

function buildShopRows2() {
  return [new ActionRowBuilder().addComponents(SPELLS.slice(5).map(s =>
    new ButtonBuilder().setCustomId(`shop_spell_${s.id}`)
      .setLabel(`Buy ${s.name.split(' ')[1]} (${s.cost}g)`).setStyle(ButtonStyle.Primary)
  ))];
}

// ── MODULE EXPORTS ─────────────────────────────────────────────────────────

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dungeon')
    .setDescription('Dungeon RPG – infinite rooms, solo or party')
    .addSubcommand(sub => sub.setName('start').setDescription('Begin a dungeon run (solo or party)'))
    .addSubcommand(sub => sub.setName('party').setDescription('Create a party lobby'))
    .addSubcommand(sub =>
      sub.setName('invite')
        .setDescription('Invite a player to your party')
        .addUserOption(opt => opt.setName('user').setDescription('Player to invite').setRequired(true))
    )
    .addSubcommand(sub => sub.setName('stats').setDescription('See your dungeon stats'))
    .addSubcommand(sub => sub.setName('leave').setDescription('Escape the dungeon'))
    .addSubcommand(sub => sub.setName('reset').setDescription('Force-reset your data'))
    .addSubcommand(sub => sub.setName('inventory').setDescription('Check inventory and use potions'))
    .addSubcommand(sub => sub.setName('shop').setDescription('Buy armor, swords, potions and spells'))
    .addSubcommand(sub => sub.setName('shop2').setDescription('Buy remaining spells (Sturm, Blitzregen, Abreissen)'))
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
              { name: '🔥 Infernal Armor',  value: 'armor_infernal'  },
              { name: '⚡ Storm Armor',     value: 'armor_storm'     },
              { name: '👁️ Void Armor',      value: 'armor_void'      },
              { name: '🗡️ Rusty Sword',     value: 'sword_rusty'     },
              { name: '⚔️ Steel Sword',     value: 'sword_steel'     },
              { name: '✨ Enchanted Sword', value: 'sword_enchanted' },
              { name: '💎 Diamond Sword',   value: 'sword_diamond'   },
              { name: '🌙 Moonblade',       value: 'sword_moon'      },
              { name: '🔥 Inferno Blade',   value: 'sword_inferno'   },
              { name: '👁️ Voidreaper',      value: 'sword_void'      }
            )
        )
    )
    .addSubcommand(sub => sub.setName('leaderboard').setDescription('View the dungeon leaderboard'))
    .addSubcommand(sub =>
      sub.setName('give')
        .setDescription('(Owner/Mod) Give dungeon gold to a user')
        .addUserOption(opt => opt.setName('user').setDescription('Who to give gold to').setRequired(true))
        .addIntegerOption(opt => opt.setName('amount').setDescription('Amount of gold').setRequired(true).setMinValue(1))
    ),

  async execute(interaction, client) {
    try { await interaction.deferReply({ ephemeral: false }); }
    catch (err) { return interaction.reply({ content: 'Failed to start.', ephemeral: true }).catch(() => {}); }

    const userId = interaction.user.id;
    const guildId = interaction.guild.id;
    const username = interaction.user.username;

    let data = client.memory.get(`dungeon_${guildId}_${userId}`) || getDefaultData(userId);
    data = migrateData(data, userId);

    const sub = interaction.options.getSubcommand();

    if (sub === 'give') {
      if (userId !== OWNER_ID && !isMod(interaction)) return interaction.editReply('❌ Moderators or owner only.');
      const target = interaction.options.getUser('user');
      const amount = interaction.options.getInteger('amount');
      const MOD_CAP = 5000;
      const isOwnerGive = userId === OWNER_ID;
      if (!isOwnerGive && amount > MOD_CAP) return interaction.editReply(`❌ Mods can only give up to **${MOD_CAP}g** at a time.`);
      const tKey = `dungeon_${guildId}_${target.id}`;
      let tData = client.memory.get(tKey) || getDefaultData(target.id);
      tData = migrateData(tData, target.id);
      tData.gold += amount;
      if (tData.gold > tData.totalGoldEarned) tData.totalGoldEarned = tData.gold;
      client.memory.set(tKey, tData);
      try {
        const logConfig = client.memory.get(`givelogs_${guildId}`);
        if (logConfig?.enabled && logConfig?.channelId) {
          const logChannel = await client.channels.fetch(logConfig.channelId).catch(() => null);
          if (logChannel) {
            await logChannel.send({ embeds: [new EmbedBuilder().setColor(isOwnerGive ? '#FFD700' : '#2196f3')
              .setTitle('📋 Give Log — Dungeon')
              .addFields(
                { name: '👤 Given by', value: `<@${userId}> (${username})`, inline: true },
                { name: '🎯 Given to', value: `<@${target.id}> (${target.username})`, inline: true },
                { name: '💰 Amount',   value: `${amount}g`, inline: true },
                { name: '🔑 Role',     value: isOwnerGive ? '👑 Owner' : '🛡️ Moderator', inline: true },
                { name: '🕐 Time',     value: new Date().toUTCString(), inline: false }
              )] }).catch(() => {});
          }
        }
      } catch (e) { console.error('give log failed:', e.message); }
      return interaction.editReply(`✅ Gave **${amount}g** to **${target.username}**! They now have **${tData.gold}g**.`);
    }

    if (sub === 'reset') {
      client.memory.delete(`dungeon_${guildId}_${userId}`);
      return interaction.editReply('✅ Dungeon fully reset.');
    }

    if (sub === 'leave') {
      const partyResult = findPartyByMember(client, guildId, userId);
      if (partyResult) {
        const { key, party } = partyResult;
        if (party.status === 'dungeon') {
          const hp = party.memberHp[userId] || 0;
          if (hp < 50) {
            data.gold = Math.max(0, Math.floor(data.gold * 0.75));
            client.memory.set(`dungeon_${guildId}_${userId}`, data);
            await interaction.editReply(`🏃 You fled the party dungeon! **25% gold penalty** applied.\n🪙 Gold left: **${data.gold}**`);
          } else {
            await interaction.editReply('🚪 You left the party dungeon.');
          }
          party.members = party.members.filter(m => m.userId !== userId);
          delete party.memberHp[userId];
          delete party.memberAlive[userId];
          if (party.members.length === 0) client.memory.delete(key);
          else client.memory.set(key, party);
        } else {
          party.members = party.members.filter(m => m.userId !== userId);
          if (party.members.length === 0) client.memory.delete(key);
          else client.memory.set(key, party);
          await interaction.editReply('🚪 You left the party lobby.');
        }
        return;
      }
      data.inDungeon = false;
      client.memory.set(`dungeon_${guildId}_${userId}`, data);
      return interaction.editReply('🚪 You escaped the dungeon.');
    }

    if (sub === 'stats') {
      const armor = ARMOR_SHOP.find(a => a.id === data.equippedArmor);
      const sword = SWORDS.find(s => s.id === data.equippedSword);
      const activePets = getPetBuffs(client, guildId, userId);
      const potionLines = POTIONS.map(p => `${p.name}: **${data.potions[p.id]}**`).join(' | ');
      const spellLines = SPELLS.map(s => `${s.name}: **${data.spells[s.id]}**`).join(' | ');
      const pKey = getPrestigeKey(guildId, userId);
      const pData = client.memory.get(pKey) || getDefaultPrestigeData();
      const embed = new EmbedBuilder().setColor('#2f3136').setTitle(`📊 ${username}'s Dungeon Stats`)
        .addFields(
          { name: '⚔️ Status',         value: data.inDungeon ? `In dungeon (Room ${data.currentRoom})` : 'Not in dungeon', inline: false },
          { name: '❤️ HP',             value: `${data.hp}`,              inline: true },
          { name: '🪙 Gold',           value: `${data.gold}`,            inline: true },
          { name: '🏆 Level',          value: `${pData.level}`,          inline: true },
          { name: '⭐ Prestige',       value: `${pData.prestige}`,       inline: true },
          { name: '🏆 Farthest Room',  value: `${data.farthestRoom}`,    inline: true },
          { name: '💰 Most Gold Ever', value: `${data.totalGoldEarned}`, inline: true },
          { name: '🛡️ Armor',          value: armor ? armor.name : 'None', inline: true },
          { name: '⚔️ Sword',          value: sword ? sword.name : 'Fists', inline: true },
          { name: '🐾 Active Pets',    value: activePets.length > 0 ? activePets.join(', ') : 'None', inline: false },
          { name: '🧪 Potions',        value: potionLines, inline: false },
          { name: '🔮 Spells',         value: spellLines, inline: false },
        );
      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'inventory') {
      const armorLines = data.inventory.filter(id => !id.startsWith('sword_')).map(id => {
        const a = ARMOR_SHOP.find(x => x.id === id);
        return a ? `${a.name} — ${a.desc}${data.equippedArmor === id ? ' ✅ Equipped' : ''}` : null;
      }).filter(Boolean).join('\n') || 'No armor owned.';
      const swordLines = data.inventory.filter(id => id.startsWith('sword_')).map(id => {
        const s = SWORDS.find(x => `sword_${x.id}` === id);
        return s ? `${s.name}${data.equippedSword === s.id ? ' ✅ Equipped' : ''}` : null;
      }).filter(Boolean).join('\n') || 'No swords owned.';
      const potionLines = POTIONS.map(p => `${p.name} x${data.potions[p.id]} — ${p.desc}`).join('\n');
      const spellLines = SPELLS.map(s => `${s.name} x${data.spells[s.id]} — ${s.desc}`).join('\n');
      const embed = new EmbedBuilder().setColor('#2f3136').setTitle('🎒 Your Dungeon Inventory')
        .addFields(
          { name: '🛡️ Armor', value: armorLines, inline: false },
          { name: '⚔️ Swords', value: swordLines, inline: false },
          { name: '🧪 Potions', value: potionLines, inline: false },
          { name: '🔮 Spells', value: spellLines, inline: false },
          { name: '🪙 Gold', value: `${data.gold}`, inline: true },
          { name: '❤️ HP', value: `${data.hp}`, inline: true },
        );
      const potionRow = new ActionRowBuilder().addComponents(POTIONS.map(p =>
        new ButtonBuilder().setCustomId(`inv_use_${p.id}`)
          .setLabel(`Use ${p.name.split(' ')[1]}`)
          .setStyle(p.id === 'health' ? ButtonStyle.Success : p.id === 'damage' ? ButtonStyle.Danger : ButtonStyle.Primary)
          .setDisabled(data.potions[p.id] <= 0)
      ));
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
          if (!data.inDungeon) { data.potions[potionId]++; return btn.followUp({ content: '❌ Health potions only work inside a dungeon!', ephemeral: true }).catch(() => {}); }
          const partyResult = findPartyByMember(client, guildId, userId);
          if (partyResult) {
            const { key, party } = partyResult;
            let healed = [];
            for (const m of party.members) {
              const prevHp = party.memberHp[m.userId] || 0;
              party.memberHp[m.userId] = Math.min(100, prevHp + 30);
              healed.push(`${m.username} +${party.memberHp[m.userId] - prevHp}HP`);
            }
            client.memory.set(key, party);
            result = `🧪 Health Potion healed the whole party!\n${healed.join(', ')}`;
          } else {
            const healed = Math.min(30, 100 - data.hp);
            data.hp = Math.min(100, data.hp + 30);
            result = `🧪 Restored **${healed} HP**. HP: **${data.hp}**`;
          }
        } else if (potionId === 'damage') {
          if (!data.inDungeon) { data.potions[potionId]++; return btn.followUp({ content: '❌ Damage potions only work inside a dungeon!', ephemeral: true }).catch(() => {}); }
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

    if (sub === 'shop' || sub === 'shop2') {
      const isPage2 = sub === 'shop2';
      const embed = buildShopEmbed(data);
      if (isPage2) embed.setTitle('🏪 Dungeon Shop — Spells Page 2');
      const components = isPage2 ? buildShopRows2() : buildShopRows(data);
      await interaction.editReply({ embeds: [embed], components });
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
          else if (data.gold < armor.cost) { reply = `❌ Need **${armor.cost}g**, have **${data.gold}g**.`; }
          else { data.gold -= armor.cost; data.inventory.push(armorId); reply = `✅ Bought **${armor.name}**!\n🪙 Gold left: **${data.gold}**`; }
        } else if (cid.startsWith('shop_sword_')) {
          const swordId = cid.replace('shop_sword_', '');
          const sword = SWORDS.find(s => s.id === swordId);
          if (!sword) return;
          const invKey = `sword_${swordId}`;
          if (data.inventory.includes(invKey)) { reply = '❌ Already owned!'; }
          else if (data.gold < sword.cost) { reply = `❌ Need **${sword.cost}g**, have **${data.gold}g**.`; }
          else { data.gold -= sword.cost; data.inventory.push(invKey); reply = `✅ Bought **${sword.name}**!\n🪙 Gold left: **${data.gold}**`; }
        } else if (cid.startsWith('shop_potion_')) {
          const potionId = cid.replace('shop_potion_', '');
          const potion = POTIONS.find(p => p.id === potionId);
          if (!potion) return;
          if (data.gold < potion.cost) { reply = `❌ Need **${potion.cost}g**, have **${data.gold}g**.`; }
          else { data.gold -= potion.cost; data.potions[potionId]++; reply = `✅ Bought **${potion.name}**! Have **${data.potions[potionId]}**.\n🪙 Gold left: **${data.gold}**`; }
        } else if (cid.startsWith('shop_spell_')) {
          const spellId = cid.replace('shop_spell_', '');
          const spell = SPELLS.find(s => s.id === spellId);
          if (!spell) return;
          if (data.gold < spell.cost) { reply = `❌ Need **${spell.cost}g**, have **${data.gold}g**.`; }
          else { data.gold -= spell.cost; data.spells[spellId]++; reply = `✅ Bought **${spell.name}**! Have **${data.spells[spellId]}**.\n🪙 Gold left: **${data.gold}**`; }
        }
        client.memory.set(`dungeon_${guildId}_${userId}`, data);
        if (reply) await btn.followUp({ content: reply, ephemeral: true }).catch(() => {});
      });
      collector.on('end', () => { shopMsg.edit({ components: [] }).catch(() => {}); });
      return;
    }

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
        return interaction.editReply(`✅ Equipped **${sword.name}**!`);
      }
    }

    if (sub === 'leaderboard') {
      if (!client.pool) return interaction.editReply('❌ Database not available.');
      let scope = 'local', metric = 'room';
      const buildRow = (s, m) => new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('lb_local').setLabel('🏠 Local').setStyle(s==='local'?ButtonStyle.Primary:ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('lb_global').setLabel('🌍 Global').setStyle(s==='global'?ButtonStyle.Primary:ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('lb_room').setLabel('🗺️ Farthest Room').setStyle(m==='room'?ButtonStyle.Success:ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('lb_gold').setLabel('🪙 Most Gold').setStyle(m==='gold'?ButtonStyle.Success:ButtonStyle.Secondary)
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

    if (sub === 'party') {
      const existing = findPartyByMember(client, guildId, userId);
      if (existing) return interaction.editReply('❌ You are already in a party! Use `/dungeon leave` to leave first.');
      const partyKey = `party_${guildId}_${userId}`;
      const party = getDefaultParty(userId, username);
      client.memory.set(partyKey, party);
      const embed = new EmbedBuilder().setColor('#9b59b6')
        .setTitle(`⚔️ ${username}'s Party Lobby`)
        .setDescription('Invite players with `/dungeon invite @user`!\nOnce everyone joins, click **Start & Ready Up**.')
        .addFields({ name: '👥 Members (1/4)', value: `👑 ${username} (Host)`, inline: false })
        .setFooter({ text: 'Maximum 4 players. Host can start when ready.' });
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`party_start_${userId}`).setLabel('✅ Start & Ready Up').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`party_disband_${userId}`).setLabel('❌ Disband').setStyle(ButtonStyle.Danger)
      );
      await interaction.editReply({ embeds: [embed], components: [row] });
      const lobbyMsg = await interaction.fetchReply();
      const collector = lobbyMsg.createMessageComponentCollector({ time: 300000 });
      collector.on('collect', async btn => {
        try { await btn.deferUpdate(); } catch (e) { return; }
        const currentParty = client.memory.get(partyKey);
        if (!currentParty) return;
        if (btn.customId === `party_disband_${userId}`) {
          if (btn.user.id !== userId) return btn.followUp({ content: '❌ Only the host can disband!', ephemeral: true }).catch(() => {});
          collector.stop('disbanded');
          client.memory.delete(partyKey);
          await lobbyMsg.edit({ embeds: [new EmbedBuilder().setColor('#ff0000').setTitle('❌ Party Disbanded').setDescription('The host disbanded the party.')], components: [] }).catch(() => {});
          return;
        }
        if (btn.customId === `party_start_${userId}`) {
          if (btn.user.id !== userId) return btn.followUp({ content: '❌ Only the host can start!', ephemeral: true }).catch(() => {});
          if (currentParty.members.length < 2) return btn.followUp({ content: '❌ Need at least 2 players!', ephemeral: true }).catch(() => {});
          collector.stop('starting');
          currentParty.status = 'readyup';
          client.memory.set(partyKey, currentParty);
          const readyEmbed = new EmbedBuilder().setColor('#f0a500').setTitle('⚔️ Ready Up!').setDescription('All players must ready up to begin!')
            .addFields({ name: '👥 Players', value: currentParty.members.map(m => `${m.userId === userId ? '👑' : '👤'} ${m.username} — ⏳ Waiting`).join('\n'), inline: false });
          const readyRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`party_ready_${userId}`).setLabel('✅ Ready!').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`party_notready_${userId}`).setLabel('❌ Not Ready').setStyle(ButtonStyle.Danger)
          );
          await lobbyMsg.edit({ embeds: [readyEmbed], components: [readyRow] }).catch(() => {});
          const readyStatus = {};
          const readyCollector = lobbyMsg.createMessageComponentCollector({ time: 60000 });
          readyCollector.on('collect', async rbtn => {
            try { await rbtn.deferUpdate(); } catch (e) { return; }
            const rParty = client.memory.get(partyKey);
            if (!rParty) return;
            const isMember = rParty.members.some(m => m.userId === rbtn.user.id);
            if (!isMember) return rbtn.followUp({ content: '❌ You are not in this party!', ephemeral: true }).catch(() => {});
            if (rbtn.customId === `party_ready_${userId}`) readyStatus[rbtn.user.id] = true;
            else if (rbtn.customId === `party_notready_${userId}`) readyStatus[rbtn.user.id] = false;
            const updatedReadyEmbed = new EmbedBuilder().setColor('#f0a500').setTitle('⚔️ Ready Up!').setDescription('All players must ready up to begin!')
              .addFields({ name: '👥 Players', value: rParty.members.map(m => `${m.userId === userId ? '👑' : '👤'} ${m.username} — ${readyStatus[m.userId] === true ? '✅ Ready' : readyStatus[m.userId] === false ? '❌ Not Ready' : '⏳ Waiting'}`).join('\n'), inline: false });
            await lobbyMsg.edit({ embeds: [updatedReadyEmbed], components: [readyRow] }).catch(() => {});
            const allReady = rParty.members.every(m => readyStatus[m.userId] === true);
            if (allReady) {
              readyCollector.stop('all_ready');
              rParty.status = 'dungeon'; rParty.currentRoom = 1;
              for (const m of rParty.members) { rParty.memberHp[m.userId] = 100; rParty.memberAlive[m.userId] = true; }
              client.memory.set(partyKey, rParty);
              await performPartyRoom(lobbyMsg, client, partyKey, guildId);
            }
          });
          readyCollector.on('end', (_, reason) => { if (reason !== 'all_ready') lobbyMsg.edit({ components: [] }).catch(() => {}); });
        }
      });
      collector.on('end', (_, reason) => { if (reason !== 'starting' && reason !== 'disbanded') lobbyMsg.edit({ components: [] }).catch(() => {}); });
      return;
    }

    if (sub === 'invite') {
      const partyResult = findPartyByMember(client, guildId, userId);
      if (!partyResult) return interaction.editReply('❌ You need to create a party first! Use `/dungeon party`.');
      if (partyResult.party.hostId !== userId) return interaction.editReply('❌ Only the host can invite players!');
      const { key: partyKey, party } = partyResult;
      if (party.members.length >= 4) return interaction.editReply('❌ Party is full!');
      const target = interaction.options.getUser('user');
      if (target.id === userId) return interaction.editReply('❌ You can\'t invite yourself!');
      if (target.bot) return interaction.editReply('❌ You can\'t invite a bot!');
      if (party.members.some(m => m.userId === target.id)) return interaction.editReply('❌ Already in party!');
      const inviteEmbed = new EmbedBuilder().setColor('#9b59b6').setTitle('⚔️ Party Invitation!')
        .setDescription(`**${username}** is inviting you to join their dungeon party!\n\nYou have 60 seconds to accept or decline.`)
        .addFields({ name: '👥 Current Members', value: party.members.map(m => `${m.userId === userId ? '👑' : '👤'} ${m.username}`).join('\n'), inline: false });
      const inviteRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`invite_accept_${userId}_${target.id}`).setLabel('✅ Accept').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`invite_decline_${userId}_${target.id}`).setLabel('❌ Decline').setStyle(ButtonStyle.Danger)
      );
      await interaction.editReply({ content: `<@${target.id}>`, embeds: [inviteEmbed], components: [inviteRow] });
      const inviteMsg = await interaction.fetchReply();
      const collector = inviteMsg.createMessageComponentCollector({ time: 60000 });
      collector.on('collect', async btn => {
        try { await btn.deferUpdate(); } catch (e) { return; }
        if (btn.user.id !== target.id) return btn.followUp({ content: '❌ This invite is not for you!', ephemeral: true }).catch(() => {});
        const currentParty = client.memory.get(partyKey);
        if (!currentParty) return btn.followUp({ content: '❌ Party no longer exists!', ephemeral: true }).catch(() => {});
        if (btn.customId === `invite_accept_${userId}_${target.id}`) {
          if (currentParty.members.length >= 4) return btn.followUp({ content: '❌ Party is now full!', ephemeral: true }).catch(() => {});
          currentParty.members.push({ userId: target.id, username: target.username });
          currentParty.memberHp[target.id] = 100; currentParty.memberAlive[target.id] = true;
          client.memory.set(partyKey, currentParty); collector.stop('accepted');
          await inviteMsg.edit({ embeds: [new EmbedBuilder().setColor('#4caf50').setTitle('✅ Invite Accepted!').setDescription(`**${target.username}** joined the party!`).addFields({ name: `👥 Members (${currentParty.members.length}/4)`, value: currentParty.members.map(m => `${m.userId === userId ? '👑' : '👤'} ${m.username}`).join('\n'), inline: false })], components: [] }).catch(() => {});
        } else if (btn.customId === `invite_decline_${userId}_${target.id}`) {
          collector.stop('declined');
          await inviteMsg.edit({ embeds: [new EmbedBuilder().setColor('#ff0000').setTitle('❌ Invite Declined').setDescription(`**${target.username}** declined.`)], components: [] }).catch(() => {});
        }
      });
      collector.on('end', (_, reason) => { if (reason === 'time') inviteMsg.edit({ components: [] }).catch(() => {}); });
      return;
    }

    if (sub === 'start') {
      if (data.inDungeon) return interaction.editReply('⚠️ Already in a solo run! Use `/dungeon leave` first.');
      const partyResult = findPartyByMember(client, guildId, userId);
      const inParty = partyResult !== null;
      const embed = new EmbedBuilder().setColor('#2f3136').setTitle('⚔️ Choose Your Mode').setDescription('How do you want to enter the dungeon?')
        .addFields(
          { name: '🗡️ Solo', value: 'Enter alone. Your own pace, your own glory.', inline: true },
          { name: '⚔️ Party', value: inParty ? `You\'re in a party with ${partyResult.party.members.length} players!` : '❌ You need to be in a party first.\nUse `/dungeon party` to create one.', inline: true }
        );
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('mode_solo').setLabel('🗡️ Solo').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('mode_party').setLabel('⚔️ Party').setStyle(ButtonStyle.Success).setDisabled(!inParty)
      );
      await interaction.editReply({ embeds: [embed], components: [row] });
      const modeMsg = await interaction.fetchReply();
      const collector = modeMsg.createMessageComponentCollector({ time: 30000, max: 1 });
      collector.on('collect', async btn => {
        try { await btn.deferUpdate(); } catch (e) { return; }
        if (btn.user.id !== userId) return;
        if (btn.customId === 'mode_solo') {
          data.inDungeon = true; data.currentRoom = 1; data.hp = 100;
          client.memory.set(`dungeon_${guildId}_${userId}`, data);
          await modeMsg.edit({ content: '⚔️ Entering dungeon solo...', embeds: [], components: [] }).catch(() => {});
          await performRoom(modeMsg, client, data, guildId, userId, username);
        } else if (btn.customId === 'mode_party') {
          const pr = findPartyByMember(client, guildId, userId);
          if (!pr) return btn.followUp({ content: '❌ Party not found!', ephemeral: true }).catch(() => {});
          if (pr.party.hostId !== userId) return btn.followUp({ content: '❌ Only the party host can start!', ephemeral: true }).catch(() => {});
          const { key: partyKey, party } = pr;
          party.status = 'dungeon'; party.currentRoom = 1;
          for (const m of party.members) { party.memberHp[m.userId] = 100; party.memberAlive[m.userId] = true; }
          client.memory.set(partyKey, party);
          await modeMsg.edit({ content: '⚔️ Party entering dungeon...', embeds: [], components: [] }).catch(() => {});
          await performPartyRoom(modeMsg, client, partyKey, guildId);
        }
      });
      collector.on('end', collected => { if (collected.size === 0) modeMsg.edit({ components: [] }).catch(() => {}); });
    }
  }
};

// ── BOSS FIGHT ─────────────────────────────────────────────────────────────

function buildBossEmbed(boss, data, roundLog) {
  const armor = ARMOR_SHOP.find(a => a.id === data.equippedArmor);
  const sword = SWORDS.find(s => s.id === data.equippedSword);
  return new EmbedBuilder().setColor('#ff4444')
    .setTitle(`⚠️ BOSS ROOM — ${boss.emoji} ${boss.name}`)
    .setDescription(`*${boss.flavor}*\n\n${roundLog ? `**Last round:** ${roundLog}\n` : ''}\nChoose your action:`)
    .addFields(
      { name: `${boss.emoji} Boss HP`, value: `${getBossBar(boss.currentHp, boss.maxHp)} ${boss.currentHp}/${boss.maxHp}`, inline: false },
      { name: '❤️ Your HP Bar', value: getDieBar(data.hp), inline: false },
      { name: '❤️ HP', value: `${data.hp}`, inline: true },
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
  const available = SPELLS.filter(s => data.spells[s.id] > 0).slice(0, 5);
  if (available.length === 0) return null;
  return new ActionRowBuilder().addComponents(available.map(s =>
    new ButtonBuilder().setCustomId(`spell_${s.id}`)
      .setLabel(`${s.name.split(' ')[0]} ${s.name.split(' ')[1]} (x${data.spells[s.id]})`)
      .setStyle(ButtonStyle.Primary)
  ));
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
  const pKey = getPrestigeKey(guildId, userId);
  let pData = client.memory.get(pKey) || getDefaultPrestigeData();
  const skillBonus = getSkillBonus(pData.skills, pData.prestige);

  await msg.edit({ embeds: [buildBossEmbed(boss, data, null)], components: getBossComponents(data) }).catch(err => console.error('boss edit failed:', err));
  const collector = msg.createMessageComponentCollector({ time: 60000 });

  collector.on('collect', async btn => {
    try { await btn.deferUpdate(); } catch (e) { return; }
    if (btn.user.id !== userId) return;

    pData = client.memory.get(pKey) || getDefaultPrestigeData();
    const sb = getSkillBonus(pData.skills, pData.prestige);

    const equippedArmor = ARMOR_SHOP.find(a => a.id === data.equippedArmor);
    const equippedSword = SWORDS.find(s => s.id === data.equippedSword);
    const activePets = getPetBuffs(client, guildId, userId);
    const armorBonus = (equippedArmor ? equippedArmor.hpBonus : 0) + (activePets.includes('bear') ? 3 : 0) + sb.dmgReduction;
    const swordBonus = equippedSword ? equippedSword.bonusDmg : 0;
    const totalAttackBonus = swordBonus + sb.dmg + (activePets.includes('wolf') ? 10 : 0) + (activePets.includes('dragon') ? 8 : 0);
    const bossAction = Math.random() < 0.70 ? 'punch' : 'parry';
    let playerHpLoss = 0, bossHpLoss = 0, roundLog = '';
    const action = btn.customId;

    if (action === 'b_flee') {
      data.gold = Math.max(0, data.gold - 100);
      collector.stop('fled');
      data.currentRoom++;
      client.memory.set(`dungeon_${guildId}_${userId}`, data);
      await saveStats(client.pool, userId, guildId, username, data.farthestRoom, data.totalGoldEarned);
      await btn.followUp({ embeds: [new EmbedBuilder().setColor('#888888').setTitle('🏃 You fled!').setDescription('Lost **100 gold**.').addFields({ name: '🪙 Gold Left', value: `${data.gold}`, inline: true })], ephemeral: true }).catch(() => {});
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
      bossHpLoss = Math.floor(spell.damage * boost * sb.allDmgMult);
      playerHpLoss = Math.floor((spell.selfDamage || 0) * sb.spellSelfDmgMult);
      roundLog = spellId === 'granat'
        ? `${spell.name} cast! Boss skips turn! **-${bossHpLoss} Boss HP**`
        : `${spell.name} cast!${boost > 1 ? ' ⚡ BOOSTED!' : ''} **-${bossHpLoss} Boss HP**${playerHpLoss > 0 ? ` / You take **-${playerHpLoss} HP**` : ''}`;
    } else {
      const boost = data.damageBoostActive ? 2 : 1;
      data.damageBoostActive = false;
      let baseDmg = 0;
      if (action === 'b_strike') {
        if (bossAction === 'punch') { playerHpLoss = Math.max(0, 20 - armorBonus); baseDmg = 25 + totalAttackBonus; }
        else { playerHpLoss = Math.max(0, 10 - armorBonus); }
      } else if (action === 'b_defend') {
        if (bossAction === 'punch') { playerHpLoss = Math.max(0, Math.floor((20 - armorBonus) / 2)); }
      } else if (action === 'b_explosive') {
        if (bossAction === 'punch') { playerHpLoss = Math.max(0, 30 - armorBonus); baseDmg = 45 + totalAttackBonus; }
        else { playerHpLoss = Math.max(0, 15 - armorBonus); baseDmg = 25 + totalAttackBonus; }
      } else if (action === 'b_parry') {
        if (bossAction === 'punch') { baseDmg = 30 + totalAttackBonus; }
        else { playerHpLoss = Math.max(0, 8 - armorBonus); baseDmg = 8; }
      }

      // Dodge check
      if (playerHpLoss > 0 && sb.dodgeChance > 0 && Math.random() < sb.dodgeChance) {
        playerHpLoss = 0;
        roundLog += ' | 🌀 DODGED!';
      }

      // Critical hit
      let critLabel = '';
      if (baseDmg > 0 && sb.critChance > 0 && Math.random() < sb.critChance) {
        baseDmg = Math.floor(baseDmg * sb.critMult);
        critLabel = ` | 💥 CRIT (${sb.critMult}x)!`;
      }

      // Berserker
      if (data.hp < sb.berserkerThreshold && sb.berserkerDmg > 0) baseDmg += sb.berserkerDmg;

      bossHpLoss = Math.floor(baseDmg * boost * sb.allDmgMult);

      if (action === 'b_strike') {
        if (bossAction === 'punch') roundLog = `Struck! Boss punched. **-${playerHpLoss} HP** / **-${bossHpLoss} Boss HP**${critLabel}`;
        else roundLog = `Struck but boss parried! **-${playerHpLoss} HP**`;
      } else if (action === 'b_defend') {
        if (bossAction === 'punch') roundLog = `Defended! **-${playerHpLoss} HP**`;
        else roundLog = `Both defending... stalemate.`;
      } else if (action === 'b_explosive') {
        if (bossAction === 'punch') roundLog = `BOOM! **-${playerHpLoss} HP** / **-${bossHpLoss} Boss HP**${critLabel}`;
        else roundLog = `Explosion! **-${playerHpLoss} HP** / **-${bossHpLoss} Boss HP**${critLabel}`;
      } else if (action === 'b_parry') {
        if (bossAction === 'punch') roundLog = `🔰 PERFECT PARRY! **-${bossHpLoss} Boss HP**${critLabel}`;
        else roundLog = `⚡ PARRY CLASH! **-${playerHpLoss} HP** / **-${bossHpLoss} Boss HP**${critLabel}`;
      }
    }

    data.hp = Math.max(0, data.hp - playerHpLoss);
    boss.currentHp = Math.max(0, boss.currentHp - bossHpLoss);

    if (boss.currentHp <= 0) {
      collector.stop('boss_dead');
      const dragonGold = getPetBuffs(client, guildId, userId).includes('dragon') ? 50 : 0;
      let goldReward = Math.floor((450 + dragonGold) * sb.bossGoldMult * sb.allGoldMult);
      data.gold += goldReward;
      if (data.gold > data.totalGoldEarned) data.totalGoldEarned = data.gold;
      data.currentRoom++;
      if (data.currentRoom > data.farthestRoom) data.farthestRoom = data.currentRoom;

      // Boss XP
      const { pData: newPData, leveledUp } = applyXP(client, guildId, userId, getBossXP(data.currentRoom, pData.prestige));
      const levelUpText = leveledUp ? `\n🎉 **LEVEL UP! Now Level ${newPData.level}! +2 Skill Points!**` : '';

      let spellDrop = null;
      if (Math.random() < 0.4) { const rs = SPELLS[Math.floor(Math.random() * SPELLS.length)]; data.spells[rs.id]++; spellDrop = rs; }
      client.memory.set(`dungeon_${guildId}_${userId}`, data);
      await saveStats(client.pool, userId, guildId, username, data.farthestRoom, data.totalGoldEarned);
      await btn.followUp({ embeds: [new EmbedBuilder().setColor('#FFD700').setTitle(`🏆 ${boss.emoji} ${boss.name} Defeated!`).setDescription(`${roundLog}\n\n*The boss crumbles!*${spellDrop ? `\n🔮 **${spellDrop.name} dropped!**` : ''}${levelUpText}`).addFields({ name: '🪙 Gold Earned', value: `+${goldReward}`, inline: true }, { name: '❤️ HP Left', value: `${data.hp}`, inline: true })], ephemeral: true }).catch(() => {});
      await msg.edit({ embeds: [new EmbedBuilder().setColor('#FFD700').setTitle(`🏆 ${boss.emoji} ${boss.name} slain by ${username}!`).setDescription(`**+${goldReward} gold!**${spellDrop ? `\n🔮 **${spellDrop.name} dropped!**` : ''}`)], components: [] }).catch(() => {});
      setTimeout(() => { if (data.inDungeon) performRoom(msg, client, data, guildId, userId, username); }, 3000);
      return;
    }

    if (data.hp <= 0) {
      // Check revives
      pData = client.memory.get(pKey) || getDefaultPrestigeData();
      const sb2 = getSkillBonus(pData.skills, pData.prestige);
      if (sb2.revives > 0 && (pData.revivesUsed || 0) < sb2.revives) {
        pData.revivesUsed = (pData.revivesUsed || 0) + 1;
        client.memory.set(pKey, pData);
        data.hp = 50;
        client.memory.set(`dungeon_${guildId}_${userId}`, data);
        await btn.followUp({ embeds: [new EmbedBuilder().setColor('#FFD700').setTitle('✨ REVIVED!').setDescription(`Your **${sb2.revives > 1 ? 'Undying' : 'Immortal'}** skill saved you! Revived with 50 HP.`)], ephemeral: true }).catch(() => {});
        await msg.edit({ embeds: [buildBossEmbed(boss, data, roundLog)], components: getBossComponents(data) }).catch(() => {});
        return;
      }

      collector.stop('player_dead');
      await saveStats(client.pool, userId, guildId, username, data.farthestRoom, data.totalGoldEarned);
      data.hp = 50; data.gold = Math.floor(data.gold * 0.5); data.currentRoom = 1;
      client.memory.set(`dungeon_${guildId}_${userId}`, data);
      await btn.followUp({ embeds: [new EmbedBuilder().setColor('#ff0000').setTitle(`💀 Slain by ${boss.emoji} ${boss.name}!`).setDescription('50% gold penalty. Reviving...')], ephemeral: true }).catch(() => {});
      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('b_strike').setLabel('⚔️ Strike').setStyle(ButtonStyle.Danger).setDisabled(true),
        new ButtonBuilder().setCustomId('b_defend').setLabel('🛡️ Defend').setStyle(ButtonStyle.Primary).setDisabled(true),
        new ButtonBuilder().setCustomId('b_explosive').setLabel('💣 Explosive').setStyle(ButtonStyle.Danger).setDisabled(true),
        new ButtonBuilder().setCustomId('b_parry').setLabel('🔰 Parry').setStyle(ButtonStyle.Success).setDisabled(true),
        new ButtonBuilder().setCustomId('b_flee').setLabel('🏃 Flee').setStyle(ButtonStyle.Secondary).setDisabled(true)
      );
      await msg.edit({ embeds: [new EmbedBuilder().setColor('#ff0000').setTitle(`💀 ${username} slain! Reviving in 4s...`).addFields({ name: 'HP Bar', value: getDieBar(0) })], components: [disabledRow] }).catch(() => {});
      setTimeout(() => { if (data.inDungeon) performRoom(msg, client, data, guildId, userId, username); }, 4000);
      return;
    }

    client.memory.set(`dungeon_${guildId}_${userId}`, data);
    await msg.edit({ embeds: [buildBossEmbed(boss, data, roundLog)], components: getBossComponents(data) }).catch(() => {});
  });

  collector.on('end', (_, reason) => {
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
  if (data.currentRoom % 10 === 0) return performBossRoom(msg, client, data, guildId, userId, username);

  const pKey = getPrestigeKey(guildId, userId);
  let pData = client.memory.get(pKey) || getDefaultPrestigeData();
  const sb = getSkillBonus(pData.skills, pData.prestige);

  const roomTheme = ROOM_THEMES[Math.floor(Math.random() * ROOM_THEMES.length)];
  const maze = MAZE_LAYOUTS[Math.min(data.currentRoom - 1, MAZE_LAYOUTS.length - 1)];
  const armor = ARMOR_SHOP.find(a => a.id === data.equippedArmor);
  const sword = SWORDS.find(s => s.id === data.equippedSword);
  const activePets = getPetBuffs(client, guildId, userId);
  const fightLabel = sword ? `${sword.name.split(' ')[0]} Attack` : 'Fight';

  // Nightmare room check (prestige 3+)
  let nightmareEvent = null;
  if (pData.prestige >= 3 && Math.random() < 0.15) {
    nightmareEvent = NIGHTMARE_ROOMS[Math.floor(Math.random() * NIGHTMARE_ROOMS.length)];
  }

  const embed = new EmbedBuilder().setColor(nightmareEvent ? '#8e44ad' : '#2f3136')
    .setTitle(`Room ${data.currentRoom} — ${nightmareEvent ? nightmareEvent.name : roomTheme}`)
    .setDescription(`${nightmareEvent ? `*${nightmareEvent.desc}*\n\n` : `Maze:\n${maze}\n\n`}Choose one action:`)
    .addFields(
      { name: 'HP Bar', value: getDieBar(data.hp), inline: false },
      { name: '❤️ HP', value: `${data.hp}`, inline: true },
      { name: '🪙 Gold', value: `${data.gold}`, inline: true },
      { name: '🛡️ Armor', value: armor ? armor.name : 'None', inline: true },
      { name: '⚔️ Sword', value: sword ? sword.name : 'Fists', inline: true },
      { name: '🐾 Pets', value: activePets.length > 0 ? activePets.join(', ') : 'None', inline: true },
      { name: '⭐ Level', value: `${pData.level}`, inline: true },
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('d_fight').setLabel(fightLabel).setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('d_sneak').setLabel('Sneak').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('d_loot').setLabel('Loot').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('d_surrender').setLabel('Surrender').setStyle(ButtonStyle.Secondary)
  );

  try { await msg.edit({ embeds: [embed], components: [row] }); } catch (err) { console.error('room edit failed:', err); return; }
  const collector = msg.createMessageComponentCollector({ time: 45000, max: 1 });

  collector.on('collect', async btn => {
    try { await btn.deferUpdate(); } catch (e) { return; }
    if (btn.user.id !== userId) return;

    pData = client.memory.get(pKey) || getDefaultPrestigeData();
    const sbNow = getSkillBonus(pData.skills, pData.prestige);

    const equippedArmor = ARMOR_SHOP.find(a => a.id === data.equippedArmor);
    const equippedSword = SWORDS.find(s => s.id === data.equippedSword);
    const activePetsNow = getPetBuffs(client, guildId, userId);
    const armorBonus = (equippedArmor ? equippedArmor.hpBonus : 0) + (activePetsNow.includes('bear') ? 3 : 0) + sbNow.dmgReduction;
    const catBonus = activePetsNow.includes('cat') ? 15 : 0;
    const foxRoll = activePetsNow.includes('fox') && Math.random() < 0.2;
    let result = '', hpLoss = 0, goldGain = 0;

    if (btn.customId === 'd_fight') {
      hpLoss = Math.max(0, 15 - armorBonus);
      goldGain = 40 + catBonus + (foxRoll ? 30 : 0) + sbNow.goldPerRoom;
      result = `⚔️ ${equippedSword ? equippedSword.name : 'Fists'} attack! **+${goldGain}g**${foxRoll ? ' | 🦊 Fox stole **+30g!**' : ''}`;
    } else if (btn.customId === 'd_sneak') {
      goldGain = 25 + catBonus + (foxRoll ? 30 : 0) + sbNow.goldPerRoom;
      if (Math.random() < 0.25) { hpLoss = 3; result = `🥷 Sneaked but got grazed! **+${goldGain}g** / **-${hpLoss} HP**`; }
      else { result = `🥷 Sneaked safely! **+${goldGain}g**`; }
    } else if (btn.customId === 'd_loot') {
      goldGain = 60 + catBonus + (foxRoll ? 30 : 0) + sbNow.goldPerRoom;
      if (Math.random() < 0.25) { hpLoss = 3; result = `💰 Looted but triggered a trap! **+${goldGain}g** / **-${hpLoss} HP**`; }
      else { result = `💰 Looted clean! **+${goldGain}g**`; }
    } else if (btn.customId === 'd_surrender') {
      data.inDungeon = false;
      client.memory.set(`dungeon_${guildId}_${userId}`, data);
      await saveStats(client.pool, userId, guildId, username, data.farthestRoom, data.totalGoldEarned);
      await btn.followUp({ embeds: [new EmbedBuilder().setColor('#ff0000').setTitle('🏳️ Surrendered.').addFields({ name: '🪙 Gold', value: `${data.gold}`, inline: true }, { name: '🏆 Farthest', value: `${data.farthestRoom}`, inline: true })], ephemeral: true }).catch(() => {});
      await msg.edit({ embeds: [new EmbedBuilder().setColor('#ff0000').setTitle('Run Over').setDescription(`<@${userId}> surrendered on room **${data.currentRoom}**.`)], components: [] }).catch(() => {});
      return;
    }

    // Dodge check
    if (hpLoss > 0 && sbNow.dodgeChance > 0 && Math.random() < sbNow.dodgeChance) {
      hpLoss = 0;
      result += ' | 🌀 DODGED!';
    }

    // Treasure Hunter
    if (sbNow.treasureChance > 0 && Math.random() < sbNow.treasureChance) {
      const bonus = Math.floor(Math.random() * 50) + 30;
      goldGain += bonus;
      result += ` | 🏴‍☠️ Treasure! +${bonus}g`;
    }

    // Nightmare room extra effects
    if (nightmareEvent) {
      hpLoss += nightmareEvent.dmg;
      goldGain += nightmareEvent.gold;
      result += ` | 🌑 **Nightmare: +${nightmareEvent.gold}g / -${nightmareEvent.dmg}HP**`;
    }

    // Apply gold multiplier
    goldGain = Math.floor(goldGain * sbNow.allGoldMult);

    data.hp = Math.max(0, data.hp - hpLoss);
    data.gold = Math.max(0, data.gold + goldGain);
    if (data.gold > data.totalGoldEarned) data.totalGoldEarned = data.gold;
    if (data.currentRoom > data.farthestRoom) data.farthestRoom = data.currentRoom;

    // XP gain
    const { pData: newPData, leveledUp } = applyXP(client, guildId, userId, getRoomXP(data.currentRoom, pData.prestige));
    const levelUpText = leveledUp ? `\n🎉 **LEVEL UP! Now Level ${newPData.level}! +2 Skill Points!**` : '';

    let died = false;
    if (data.hp <= 0) {
      // Check revives
      const sb3 = getSkillBonus(newPData.skills, newPData.prestige);
      if (sb3.revives > 0 && (newPData.revivesUsed || 0) < sb3.revives) {
        newPData.revivesUsed = (newPData.revivesUsed || 0) + 1;
        client.memory.set(pKey, newPData);
        data.hp = 50;
        result += '\n✨ **IMMORTAL skill revived you with 50 HP!**';
      } else {
        died = true;
        data.hp = 50; data.gold = Math.floor(data.gold * 0.5);
        await saveStats(client.pool, userId, guildId, username, data.farthestRoom, data.totalGoldEarned);
        await btn.followUp({ embeds: [new EmbedBuilder().setColor('#ff0000').setTitle('💀 You Died!').addFields({ name: '🪙 Gold After Penalty', value: `${data.gold}`, inline: true })], ephemeral: true }).catch(() => {});
        const disabledRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('d_fight').setLabel(fightLabel).setStyle(ButtonStyle.Danger).setDisabled(true),
          new ButtonBuilder().setCustomId('d_sneak').setLabel('Sneak').setStyle(ButtonStyle.Primary).setDisabled(true),
          new ButtonBuilder().setCustomId('d_loot').setLabel('Loot').setStyle(ButtonStyle.Success).setDisabled(true),
          new ButtonBuilder().setCustomId('d_surrender').setLabel('Surrender').setStyle(ButtonStyle.Secondary).setDisabled(true)
        );
        await msg.edit({ embeds: [new EmbedBuilder().setColor('#ff0000').setTitle(`💀 ${username} died! Reviving in 4s...`).addFields({ name: 'HP Bar', value: getDieBar(0) })], components: [disabledRow] }).catch(() => {});
        data.currentRoom = 1;
      }
    } else {
      data.currentRoom++;
      await btn.followUp({ embeds: [new EmbedBuilder().setColor('#f0a500').setTitle('Room Result').setDescription(result + levelUpText).addFields({ name: 'HP Bar', value: getDieBar(data.hp) }, { name: '❤️ HP', value: `${data.hp}`, inline: true }, { name: '🪙 Gold', value: `${data.gold}`, inline: true })], ephemeral: true }).catch(() => {});
    }

    client.memory.set(`dungeon_${guildId}_${userId}`, data);
    await saveStats(client.pool, userId, guildId, username, data.farthestRoom, data.totalGoldEarned);
    setTimeout(() => { if (data.inDungeon) performRoom(msg, client, data, guildId, userId, username); }, died ? 4000 : 2000);
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

// ── PARTY DUNGEON ──────────────────────────────────────────────────────────

async function performPartyRoom(msg, client, partyKey, guildId) {
  const party = client.memory.get(partyKey);
  if (!party) return;
  const aliveMembers = party.members.filter(m => party.memberAlive[m.userId]);
  if (aliveMembers.length === 0) {
    await msg.edit({ embeds: [new EmbedBuilder().setColor('#ff0000').setTitle('💀 Party Wiped!').setDescription('All members have fallen.')], components: [] }).catch(() => {});
    client.memory.delete(partyKey);
    return;
  }
  if (party.currentRoom % 10 === 0) return performPartyBossRoom(msg, client, partyKey, guildId);
  const roomTheme = ROOM_THEMES[Math.floor(Math.random() * ROOM_THEMES.length)];
  const memberLines = party.members.map(m => { const hp = party.memberHp[m.userId] || 0; const alive = party.memberAlive[m.userId]; return `${alive ? '❤️' : '💀'} **${m.username}**: ${alive ? `${hp}/100 HP` : 'Dead'}`; }).join('\n');
  const embed = new EmbedBuilder().setColor('#9b59b6').setTitle(`⚔️ Party — Room ${party.currentRoom} — ${roomTheme}`).setDescription('Vote on your action! Majority wins. Tie = random.').addFields({ name: '👥 Party Status', value: memberLines, inline: false });
  const voteRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('party_vote_fight').setLabel('⚔️ Fight').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('party_vote_sneak').setLabel('🥷 Sneak').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('party_vote_loot').setLabel('💰 Loot').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('party_vote_surrender').setLabel('🏳️ Surrender').setStyle(ButtonStyle.Secondary)
  );
  await msg.edit({ embeds: [embed], components: [voteRow] }).catch(() => {});
  const votes = {}, voted = new Set(), voteTotals = { fight: 0, sneak: 0, loot: 0, surrender: 0 };
  const totalAlive = aliveMembers.length;
  const collector = msg.createMessageComponentCollector({ time: 30000 });
  collector.on('collect', async btn => {
    try { await btn.deferUpdate(); } catch (e) { return; }
    const isMember = party.members.some(m => m.userId === btn.user.id);
    if (!isMember) return btn.followUp({ content: '❌ You are not in this party!', ephemeral: true }).catch(() => {});
    if (!party.memberAlive[btn.user.id]) return btn.followUp({ content: '❌ You are dead this round!', ephemeral: true }).catch(() => {});
    if (voted.has(btn.user.id)) return btn.followUp({ content: '✅ You already voted!', ephemeral: true }).catch(() => {});
    const action = btn.customId.replace('party_vote_', '');
    votes[btn.user.id] = action; voted.add(btn.user.id); voteTotals[action]++;
    await btn.followUp({ content: `✅ You voted for **${action}**! (${voted.size}/${totalAlive} voted)`, ephemeral: true }).catch(() => {});
    if (voted.size >= totalAlive) collector.stop('all_voted');
  });
  await new Promise(resolve => { collector.on('end', resolve); });
  let winningAction = 'fight', maxVotes = 0;
  for (const [action, count] of Object.entries(voteTotals)) { if (count > maxVotes) { maxVotes = count; winningAction = action; } }
  const tied = Object.entries(voteTotals).filter(([, c]) => c === maxVotes);
  if (tied.length > 1) winningAction = tied[Math.floor(Math.random() * tied.length)][0];
  if (winningAction === 'surrender') {
    if (voteTotals.surrender <= totalAlive / 2) { winningAction = 'fight'; }
    else {
      for (const m of party.members) { const dData = client.memory.get(`dungeon_${guildId}_${m.userId}`); if (dData) { dData.inDungeon = false; client.memory.set(`dungeon_${guildId}_${m.userId}`, dData); } }
      client.memory.delete(partyKey);
      await msg.edit({ embeds: [new EmbedBuilder().setColor('#ff0000').setTitle('🏳️ Party Surrendered').setDescription(`The party gave up on room **${party.currentRoom}**.`)], components: [] }).catch(() => {});
      return;
    }
  }
  let goldGain = 0, hpLossEach = 0, resultDesc = '';
  if (winningAction === 'fight') { goldGain = 40; hpLossEach = 15; resultDesc = `⚔️ Party fought! **+${goldGain}g** / **-${hpLossEach} HP** each.`; }
  else if (winningAction === 'sneak') { goldGain = 25; if (Math.random() < 0.25) { hpLossEach = 3; resultDesc = `🥷 Sneaked but got grazed! **+${goldGain}g** / **-${hpLossEach} HP** each.`; } else { resultDesc = `🥷 Sneaked safely! **+${goldGain}g** each.`; } }
  else if (winningAction === 'loot') { goldGain = 60; if (Math.random() < 0.25) { hpLossEach = 3; resultDesc = `💰 Looted but triggered a trap! **+${goldGain}g** / **-${hpLossEach} HP** each.`; } else { resultDesc = `💰 Looted clean! **+${goldGain}g** each.`; } }
  const deaths = [];
  for (const m of party.members) {
    if (!party.memberAlive[m.userId]) continue;
    party.memberHp[m.userId] = Math.max(0, (party.memberHp[m.userId] || 100) - hpLossEach);
    const dData = client.memory.get(`dungeon_${guildId}_${m.userId}`) || getDefaultData(m.userId);
    dData.gold = Math.max(0, (dData.gold || 0) + goldGain);
    if (party.memberHp[m.userId] <= 0) { deaths.push(m.username); party.memberAlive[m.userId] = false; party.memberHp[m.userId] = 50; dData.gold = Math.floor(dData.gold * 0.5); }
    client.memory.set(`dungeon_${guildId}_${m.userId}`, dData);
    applyXP(client, guildId, m.userId, getRoomXP(party.currentRoom, 0));
  }
  if (deaths.length > 0) resultDesc += `\n💀 **${deaths.join(', ')}** died! Revived with 50 HP and 50% gold penalty.`;
  party.currentRoom++;
  client.memory.set(partyKey, party);
  const stillAlive = party.members.filter(m => party.memberAlive[m.userId]);
  if (stillAlive.length === 0) { await msg.edit({ embeds: [new EmbedBuilder().setColor('#ff0000').setTitle('💀 Party Wiped!').setDescription('All members have fallen!')], components: [] }).catch(() => {}); client.memory.delete(partyKey); return; }
  const updatedMemberLines = party.members.map(m => { const hp = party.memberHp[m.userId] || 0; const alive = party.memberAlive[m.userId]; return `${alive ? '❤️' : '💀'} **${m.username}**: ${alive ? `${hp}/100 HP` : 'Dead (revived next room)'}`; }).join('\n');
  await msg.edit({ embeds: [new EmbedBuilder().setColor('#9b59b6').setTitle(`⚔️ Room ${party.currentRoom - 1} Result`).setDescription(resultDesc).addFields({ name: '👥 Party Status', value: updatedMemberLines, inline: false }).setFooter({ text: 'Next room in 3 seconds...' })], components: [] }).catch(() => {});
  setTimeout(() => performPartyRoom(msg, client, partyKey, guildId), 3000);
}

async function performPartyBossRoom(msg, client, partyKey, guildId) {
  const party = client.memory.get(partyKey);
  if (!party) return;
  const boss = getBoss(party.currentRoom);
  if (!boss) return performPartyRoom(msg, client, partyKey, guildId);
  const memberLines = party.members.map(m => { const hp = party.memberHp[m.userId] || 0; const alive = party.memberAlive[m.userId]; return `${alive ? '❤️' : '💀'} **${m.username}**: ${alive ? `${hp}/100 HP` : 'Dead'}`; }).join('\n');
  const embed = new EmbedBuilder().setColor('#ff4444').setTitle(`⚠️ PARTY BOSS — ${boss.emoji} ${boss.name}`).setDescription(`*${boss.flavor}*\n\nVote on your action! Majority wins.`).addFields({ name: `${boss.emoji} Boss HP`, value: `${getBossBar(boss.currentHp, boss.maxHp)} ${boss.currentHp}/${boss.maxHp}`, inline: false }, { name: '👥 Party Status', value: memberLines, inline: false });
  const bossVoteRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('pboss_strike').setLabel('⚔️ Strike').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('pboss_defend').setLabel('🛡️ Defend').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('pboss_explosive').setLabel('💣 Explosive').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('pboss_parry').setLabel('🔰 Parry').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('pboss_flee').setLabel('🏃 Flee').setStyle(ButtonStyle.Secondary)
  );
  await msg.edit({ embeds: [embed], components: [bossVoteRow] }).catch(() => {});
  const aliveMembers = party.members.filter(m => party.memberAlive[m.userId]);
  const totalAlive = aliveMembers.length;
  const voted = new Set(), voteTotals = { strike: 0, defend: 0, explosive: 0, parry: 0, flee: 0 };
  const collector = msg.createMessageComponentCollector({ time: 30000 });
  collector.on('collect', async btn => {
    try { await btn.deferUpdate(); } catch (e) { return; }
    const isMember = party.members.some(m => m.userId === btn.user.id);
    if (!isMember) return btn.followUp({ content: '❌ You are not in this party!', ephemeral: true }).catch(() => {});
    if (!party.memberAlive[btn.user.id]) return btn.followUp({ content: '❌ You are dead!', ephemeral: true }).catch(() => {});
    if (voted.has(btn.user.id)) return btn.followUp({ content: '✅ Already voted!', ephemeral: true }).catch(() => {});
    const action = btn.customId.replace('pboss_', '');
    voted.add(btn.user.id); voteTotals[action]++;
    await btn.followUp({ content: `✅ Voted **${action}**! (${voted.size}/${totalAlive})`, ephemeral: true }).catch(() => {});
    if (voted.size >= totalAlive) collector.stop('all_voted');
  });
  await new Promise(resolve => collector.on('end', resolve));
  let winAction = 'strike', maxV = 0;
  for (const [a, c] of Object.entries(voteTotals)) { if (c > maxV) { maxV = c; winAction = a; } }
  const tiedActions = Object.entries(voteTotals).filter(([, c]) => c === maxV);
  if (tiedActions.length > 1) winAction = tiedActions[Math.floor(Math.random() * tiedActions.length)][0];
  if (winAction === 'flee') {
    for (const m of aliveMembers) { const dData = client.memory.get(`dungeon_${guildId}_${m.userId}`) || getDefaultData(m.userId); dData.gold = Math.max(0, (dData.gold || 0) - 100); client.memory.set(`dungeon_${guildId}_${m.userId}`, dData); }
    party.currentRoom++; client.memory.set(partyKey, party);
    await msg.edit({ embeds: [new EmbedBuilder().setColor('#888888').setTitle('🏃 Party Fled!').setDescription('Each member lost **100g**!')], components: [] }).catch(() => {});
    setTimeout(() => performPartyRoom(msg, client, partyKey, guildId), 2000);
    return;
  }
  let totalArmorBonus = 0, totalSwordBonus = 0;
  for (const m of aliveMembers) { const dData = client.memory.get(`dungeon_${guildId}_${m.userId}`); if (dData) { const armor = ARMOR_SHOP.find(a => a.id === dData.equippedArmor); const sword = SWORDS.find(s => s.id === dData.equippedSword); if (armor) totalArmorBonus += armor.hpBonus; if (sword) totalSwordBonus += sword.bonusDmg; } }
  const avgArmor = Math.floor(totalArmorBonus / totalAlive), avgSword = Math.floor(totalSwordBonus / totalAlive);
  const bossAction = Math.random() < 0.70 ? 'punch' : 'parry';
  let bossHpLoss = 0, hpLossEach = 0, roundLog = '';
  if (winAction === 'strike') { if (bossAction === 'punch') { hpLossEach = Math.max(0, 20 - avgArmor); bossHpLoss = 25 + avgSword; roundLog = `Party struck! **-${hpLossEach} HP each** / **-${bossHpLoss} Boss HP**`; } else { hpLossEach = Math.max(0, 10 - avgArmor); roundLog = `Party struck but boss parried! **-${hpLossEach} HP each**`; } }
  else if (winAction === 'defend') { if (bossAction === 'punch') { hpLossEach = Math.max(0, Math.floor((20 - avgArmor) / 2)); roundLog = `Party defended! **-${hpLossEach} HP each**`; } else { roundLog = `Stalemate!`; } }
  else if (winAction === 'explosive') { if (bossAction === 'punch') { hpLossEach = Math.max(0, 30 - avgArmor); bossHpLoss = 45 + avgSword; roundLog = `BOOM! **-${hpLossEach} HP each** / **-${bossHpLoss} Boss HP**`; } else { hpLossEach = Math.max(0, 15 - avgArmor); bossHpLoss = 25 + avgSword; roundLog = `Explosion! **-${hpLossEach} HP each** / **-${bossHpLoss} Boss HP**`; } }
  else if (winAction === 'parry') { if (bossAction === 'punch') { bossHpLoss = 30 + avgSword; roundLog = `🔰 PARTY PERFECT PARRY! **-${bossHpLoss} Boss HP**`; } else { hpLossEach = Math.max(0, 8 - avgArmor); bossHpLoss = 8; roundLog = `⚡ PARRY CLASH! **-${hpLossEach} HP each** / **-${bossHpLoss} Boss HP**`; } }
  boss.currentHp = Math.max(0, boss.currentHp - bossHpLoss);
  const deaths = [];
  for (const m of aliveMembers) { party.memberHp[m.userId] = Math.max(0, (party.memberHp[m.userId] || 100) - hpLossEach); const dData = client.memory.get(`dungeon_${guildId}_${m.userId}`) || getDefaultData(m.userId); if (party.memberHp[m.userId] <= 0) { deaths.push(m.username); party.memberAlive[m.userId] = false; party.memberHp[m.userId] = 50; dData.gold = Math.floor((dData.gold || 0) * 0.5); } client.memory.set(`dungeon_${guildId}_${m.userId}`, dData); }
  if (deaths.length > 0) roundLog += `\n💀 **${deaths.join(', ')}** fell!`;
  const stillAlive = party.members.filter(m => party.memberAlive[m.userId]);
  if (boss.currentHp <= 0) {
    const goldPerMember = Math.floor(450 / Math.max(1, stillAlive.length));
    let spellDrop = null;
    if (Math.random() < 0.4) { const rs = SPELLS[Math.floor(Math.random() * SPELLS.length)]; const luckyMember = stillAlive[Math.floor(Math.random() * stillAlive.length)]; const lData = client.memory.get(`dungeon_${guildId}_${luckyMember.userId}`) || getDefaultData(luckyMember.userId); lData.spells[rs.id] = (lData.spells[rs.id] || 0) + 1; client.memory.set(`dungeon_${guildId}_${luckyMember.userId}`, lData); spellDrop = { spell: rs, member: luckyMember.username }; }
    for (const m of stillAlive) { const dData = client.memory.get(`dungeon_${guildId}_${m.userId}`) || getDefaultData(m.userId); dData.gold = (dData.gold || 0) + goldPerMember; if (dData.gold > (dData.totalGoldEarned || 0)) dData.totalGoldEarned = dData.gold; client.memory.set(`dungeon_${guildId}_${m.userId}`, dData); applyXP(client, guildId, m.userId, getBossXP(party.currentRoom, 0)); }
    party.currentRoom++; client.memory.set(partyKey, party);
    const memberTags = party.members.map(m => `<@${m.userId}>`).join(', ');
    await msg.edit({ embeds: [new EmbedBuilder().setColor('#FFD700').setTitle(`🏆 ${boss.emoji} ${boss.name} DEFEATED by the Party!`).setDescription(`${roundLog}\n\n${memberTags}\n**+${goldPerMember}g each!**${spellDrop ? `\n🔮 **${spellDrop.spell.name}** dropped to **${spellDrop.member}**!` : ''}`)], components: [] }).catch(() => {});
    setTimeout(() => performPartyRoom(msg, client, partyKey, guildId), 3000);
    return;
  }
  if (stillAlive.length === 0) { await msg.edit({ embeds: [new EmbedBuilder().setColor('#ff0000').setTitle(`💀 Party Wiped by ${boss.emoji} ${boss.name}!`).setDescription('All members have fallen...')], components: [] }).catch(() => {}); client.memory.delete(partyKey); return; }
  const updatedMemberLines = party.members.map(m => { const hp = party.memberHp[m.userId] || 0; const alive = party.memberAlive[m.userId]; return `${alive ? '❤️' : '💀'} **${m.username}**: ${alive ? `${hp}/100 HP` : 'Dead'}`; }).join('\n');
  client.memory.set(partyKey, party);
  const updatedEmbed = new EmbedBuilder().setColor('#ff4444').setTitle(`⚠️ PARTY BOSS — ${boss.emoji} ${boss.name}`).setDescription(`**Last round:** ${roundLog}\n\nVote on your next action!`).addFields({ name: `${boss.emoji} Boss HP`, value: `${getBossBar(boss.currentHp, boss.maxHp)} ${boss.currentHp}/${boss.maxHp}`, inline: false }, { name: '👥 Party Status', value: updatedMemberLines, inline: false });
  await msg.edit({ embeds: [updatedEmbed], components: [bossVoteRow] }).catch(() => {});
  setTimeout(() => performPartyBossRoom(msg, client, partyKey, guildId), 1000);
}
