// ============================================================
// DUNGEON PRESTIGE, LEVELS & SKILL TREE — ADD-ON MODULE
// Drop this file in your commands/ folder as dungeon-prestige.js
// This adds /dungeon level, /dungeon skills, /dungeon learn,
// /dungeon prestige, /dungeon prestigeboard
// The XP/level/skill system hooks into your existing dungeon.js
// via client.memory using the same dungeon_ key
// ============================================================

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const OWNER_ID = '902685494247325776';

// ── PRESTIGE TITLES ────────────────────────────────────────────────────────
const PRESTIGE_TITLES = [
  { level: 0,  badge: '',    title: 'Adventurer',      color: '#2f3136' },
  { level: 1,  badge: '⚔️',  title: 'Warrior',         color: '#e74c3c' },
  { level: 2,  badge: '🛡️',  title: 'Guardian',        color: '#3498db' },
  { level: 3,  badge: '💀',  title: 'Nightmare',       color: '#8e44ad' },
  { level: 4,  badge: '🌑',  title: 'Shadow',          color: '#2c3e50' },
  { level: 5,  badge: '🔥',  title: 'Infernal',        color: '#e67e22' },
  { level: 6,  badge: '⚡',  title: 'Storm',           color: '#f1c40f' },
  { level: 7,  badge: '💎',  title: 'Diamond',         color: '#00bcd4' },
  { level: 8,  badge: '👁️',  title: 'Void',            color: '#6c3483' },
  { level: 9,  badge: '🌟',  title: 'Celestial',       color: '#f9e79f' },
  { level: 10, badge: '🏆',  title: 'LEGEND',          color: '#FFD700' },
];

// ── PRESTIGE STAT BONUSES (cumulative per prestige) ────────────────────────
function getPrestigeBonus(prestige) {
  return {
    bonusDmg:    prestige * 5,
    bonusHp:     prestige * 10,
    bonusGoldPct: prestige * 0.10, // 10% more gold per prestige
  };
}

// ── SKILL TREE ─────────────────────────────────────────────────────────────
const SKILLS = {
  // ── TIER 1 (no requirements) ──────────────────────────
  power_strike: {
    name: '⚔️ Power Strike',   tier: 1, cost: 2, requires: null,
    desc: '+8 damage to all attacks',
  },
  iron_will: {
    name: '🛡️ Iron Will',      tier: 1, cost: 2, requires: null,
    desc: '+20 max HP',
  },
  gold_rush: {
    name: '💰 Gold Rush',      tier: 1, cost: 2, requires: null,
    desc: '+15 gold per room',
  },
  dodge: {
    name: '🌀 Dodge',          tier: 1, cost: 2, requires: null,
    desc: '12% chance to dodge incoming damage',
  },

  // ── TIER 2 ────────────────────────────────────────────
  critical_hit: {
    name: '💥 Critical Hit',   tier: 2, cost: 4, requires: 'power_strike',
    desc: '20% chance to deal 2x damage',
  },
  spell_mastery: {
    name: '🔮 Spell Mastery',  tier: 2, cost: 4, requires: 'iron_will',
    desc: 'Spells with self-damage cost 50% less HP',
  },
  treasure_hunter: {
    name: '🏴‍☠️ Treasure Hunter',tier: 2, cost: 4, requires: 'gold_rush',
    desc: '25% chance for bonus gold drop each room',
  },
  berserker: {
    name: '😡 Berserker',      tier: 2, cost: 4, requires: 'dodge',
    desc: '+15 damage when below 40 HP',
  },

  // ── TIER 3 ────────────────────────────────────────────
  master_striker: {
    name: '🗡️ Master Striker', tier: 3, cost: 6, requires: 'critical_hit',
    desc: 'Critical hits deal 3x damage instead of 2x',
  },
  fortress: {
    name: '🏰 Fortress',       tier: 3, cost: 6, requires: 'spell_mastery',
    desc: 'Dodge chance increased to 22%, +10 more HP',
  },
  gold_magnet: {
    name: '🧲 Gold Magnet',    tier: 3, cost: 6, requires: 'treasure_hunter',
    desc: 'Treasure Hunter triggers 50% of the time instead of 25%',
  },
  void_berserker: {
    name: '👁️ Void Berserker', tier: 3, cost: 6, requires: 'berserker',
    desc: 'Berserker bonus increased to +30 dmg, triggers below 50 HP',
  },

  // ── TIER 4 ────────────────────────────────────────────
  godslayer: {
    name: '⚡ Godslayer',      tier: 4, cost: 10, requires: 'master_striker',
    desc: 'All damage +50% permanently',
  },
  immortal: {
    name: '✨ Immortal',       tier: 4, cost: 10, requires: 'fortress',
    desc: 'Revive once per dungeon run with 50 HP',
  },
  midas: {
    name: '🌟 Midas',          tier: 4, cost: 10, requires: 'gold_magnet',
    desc: 'All gold earned x2',
  },
  abyssal_guardian: {
    name: '🌀 Abyssal Guardian',tier: 4, cost: 10, requires: 'void_berserker',
    desc: '-5 damage from ALL sources permanently',
  },

  // ── TIER 5 (Prestige 3+ required) ────────────────────
  void_reaper: {
    name: '💀 Void Reaper',    tier: 5, cost: 15, requires: 'godslayer',   prestigeReq: 3,
    desc: '30% chance to instantly kill non-boss enemies',
  },
  fortune_god: {
    name: '💎 Fortune God',    tier: 5, cost: 15, requires: 'midas',       prestigeReq: 3,
    desc: 'Boss gold reward x3',
  },
  undying: {
    name: '🔥 Undying',        tier: 5, cost: 15, requires: 'immortal',    prestigeReq: 5,
    desc: 'Revive 3 times per run instead of once',
  },
  legend_of_abyss: {
    name: '🏆 Legend of Abyss',tier: 5, cost: 20, requires: 'abyssal_guardian', prestigeReq: 10,
    desc: 'All stats doubled. Only for true Legends.',
  },
};

// ── XP SYSTEM ──────────────────────────────────────────────────────────────
function xpForLevel(level) {
  return Math.floor(80 * Math.pow(1.35, level - 1));
}

function getRoomXP(room, prestige) {
  const base = room <= 10 ? 10 : room <= 50 ? 20 : 35;
  return Math.floor(base * (1 + prestige * 0.1));
}

function getBossXP(room, prestige) {
  return Math.floor(100 * Math.ceil(room / 10) * (1 + prestige * 0.1));
}

// ── SKILL HELPERS ──────────────────────────────────────────────────────────
function getSkillBonus(skills, prestige) {
  const bonus = {
    dmg: 0, hp: 0, goldPerRoom: 0, dodgeChance: 0,
    critChance: 0, critMult: 2, spellDmgMult: 1,
    spellSelfDmgMult: 1, treasureChance: 0, berserkerDmg: 0,
    berserkerThreshold: 0, goldenMult: 1, allDmgMult: 1,
    allGoldMult: 1, dmgReduction: 0, revives: 0, bossGoldMult: 1,
    voidReaperChance: 0,
  };

  const has = (s) => skills.includes(s);

  if (has('power_strike'))   bonus.dmg += 8;
  if (has('iron_will'))      bonus.hp += 20;
  if (has('gold_rush'))      bonus.goldPerRoom += 15;
  if (has('dodge'))          bonus.dodgeChance += 0.12;
  if (has('critical_hit'))   bonus.critChance += 0.20;
  if (has('spell_mastery'))  bonus.spellSelfDmgMult = 0.5;
  if (has('treasure_hunter'))bonus.treasureChance += 0.25;
  if (has('berserker'))      { bonus.berserkerDmg = 15; bonus.berserkerThreshold = 40; }
  if (has('master_striker')) bonus.critMult = 3;
  if (has('fortress'))       { bonus.dodgeChance += 0.10; bonus.hp += 10; }
  if (has('gold_magnet'))    bonus.treasureChance = 0.50;
  if (has('void_berserker')) { bonus.berserkerDmg = 30; bonus.berserkerThreshold = 50; }
  if (has('godslayer'))      bonus.allDmgMult *= 1.5;
  if (has('immortal'))       bonus.revives += 1;
  if (has('midas'))          bonus.allGoldMult *= 2;
  if (has('abyssal_guardian'))bonus.dmgReduction += 5;
  if (has('void_reaper'))    bonus.voidReaperChance = 0.30;
  if (has('fortune_god'))    bonus.bossGoldMult *= 3;
  if (has('undying'))        bonus.revives += 2;
  if (has('legend_of_abyss')){ bonus.dmg *= 2; bonus.hp *= 2; bonus.allDmgMult *= 2; bonus.allGoldMult *= 2; }

  // Prestige bonuses
  const pb = getPrestigeBonus(prestige);
  bonus.dmg += pb.bonusDmg;
  bonus.hp += pb.bonusHp;
  bonus.allGoldMult *= (1 + pb.bonusGoldPct);

  return bonus;
}

// ── NIGHTMARE ROOMS (prestige 3+) ─────────────────────────────────────────
const NIGHTMARE_ROOMS = [
  { name: '👻 Haunted Corridor',  dmg: 25, gold: 80,  desc: 'The walls whisper. Every step costs.' },
  { name: '🌋 Magma Chamber',     dmg: 30, gold: 100, desc: 'The floor burns. Move fast or burn.' },
  { name: '🕸️ Spider Sanctum',   dmg: 20, gold: 90,  desc: 'Webs everywhere. You feel watched.' },
  { name: '💀 Bone Pit',          dmg: 35, gold: 120, desc: 'Bones of the fallen line the walls.' },
  { name: '👁️ Void Chamber',     dmg: 40, gold: 150, desc: 'Reality itself attacks you here.' },
];

// ── PRESTIGE BOSSES (prestige 5+) ─────────────────────────────────────────
const PRESTIGE_BOSSES = [
  { emoji: '🧙‍♂️', name: 'Nightmare Witch',    hp: 300, dmg: 35, gold: 1200 },
  { emoji: '💀',  name: 'Lich Knight',          hp: 350, dmg: 40, gold: 1400 },
  { emoji: '🌋',  name: 'Infernal Titan',       hp: 400, dmg: 45, gold: 1600 },
  { emoji: '🐲',  name: 'Ancient Void Dragon',  hp: 500, dmg: 50, gold: 2000 },
  { emoji: '👁️',  name: 'Eternal Void Walker', hp: 600, dmg: 60, gold: 2500 },
];

// ── DEFAULT PRESTIGE DATA ──────────────────────────────────────────────────
function getDefaultPrestigeData() {
  return {
    level: 1,
    xp: 0,
    skillPoints: 0,
    skills: [],
    prestige: 0,
    revivesUsed: 0,
    totalRevives: 0,
  };
}

function getPrestigeKey(guildId, userId) {
  return `dungeon_prestige_${guildId}_${userId}`;
}

function getDungeonKey(guildId, userId) {
  return `dungeon_${guildId}_${userId}`;
}

function getPrestigeTitle(prestige) {
  return PRESTIGE_TITLES[Math.min(prestige, 10)];
}

// ── MODULE EXPORTS ─────────────────────────────────────────────────────────
module.exports = {
  data: new SlashCommandBuilder()
    .setName('dungeon-prestige')
    .setDescription('Dungeon leveling, skills and prestige system')
    .addSubcommand(sub => sub.setName('level').setDescription('View your dungeon level and XP'))
    .addSubcommand(sub => sub.setName('skills').setDescription('View your skill tree'))
    .addSubcommand(sub =>
      sub.setName('learn')
        .setDescription('Learn a skill tree node')
        .addStringOption(opt => opt.setName('skill').setDescription('Skill to learn').setRequired(true)
          .addChoices(...Object.entries(SKILLS).map(([id, s]) => ({ name: `${s.name} (${s.cost}pts)`, value: id })))
        )
    )
    .addSubcommand(sub => sub.setName('prestige').setDescription('Prestige — reset for permanent bonuses (requires Level 100)'))
    .addSubcommand(sub => sub.setName('prestigeboard').setDescription('View the prestige leaderboard'))
    .addSubcommand(sub => sub.setName('bonuses').setDescription('View all your active bonuses from skills and prestige')),

  async execute(interaction, client) {
    try { await interaction.deferReply({ ephemeral: false }); }
    catch (err) { return interaction.reply({ content: 'Failed.', ephemeral: true }).catch(() => {}); }

    const userId = interaction.user.id;
    const guildId = interaction.guild.id;
    const username = interaction.user.username;
    const pKey = getPrestigeKey(guildId, userId);
    const dKey = getDungeonKey(guildId, userId);

    let pData = client.memory.get(pKey) || getDefaultPrestigeData();
    if (!pData.level) pData.level = 1;
    if (!pData.xp) pData.xp = 0;
    if (!pData.skillPoints) pData.skillPoints = 0;
    if (!pData.skills) pData.skills = [];
    if (!pData.prestige) pData.prestige = 0;
    if (!pData.revivesUsed) pData.revivesUsed = 0;

    const sub = interaction.options.getSubcommand();
    const title = getPrestigeTitle(pData.prestige);
    const bonus = getSkillBonus(pData.skills, pData.prestige);

    // ── LEVEL ─────────────────────────────────────────────
    if (sub === 'level') {
      const xpNeeded = xpForLevel(pData.level + 1);
      const xpPct = Math.min(1, pData.xp / xpNeeded);
      const xpBar = '█'.repeat(Math.floor(xpPct * 10)) + '░'.repeat(10 - Math.floor(xpPct * 10));
      const pb = getPrestigeBonus(pData.prestige);

      return interaction.editReply({ embeds: [new EmbedBuilder()
        .setColor(title.color)
        .setTitle(`${title.badge} ${username} — ${title.title}`)
        .addFields(
          { name: '🏆 Level',         value: `${pData.level}/100`,                    inline: true },
          { name: '⭐ Prestige',       value: `${pData.prestige}/10`,                  inline: true },
          { name: '🎯 Skill Points',   value: `${pData.skillPoints}`,                  inline: true },
          { name: '📊 XP',            value: `${pData.xp}/${xpNeeded}\n${xpBar}`,     inline: false },
          { name: '🔥 Prestige Bonuses',value: `+${pb.bonusDmg} dmg | +${pb.bonusHp} HP | +${Math.round(pb.bonusGoldPct*100)}% gold`, inline: false },
          { name: '🧠 Skills Learned', value: pData.skills.length > 0 ? pData.skills.map(s => SKILLS[s]?.name).join(', ') : 'None', inline: false },
        )
        .setFooter({ text: pData.level >= 100 ? '✅ Max level! Use /dungeon-prestige prestige to prestige!' : `Earn XP by completing dungeon rooms and killing bosses` })] });
    }

    // ── SKILLS ────────────────────────────────────────────
    if (sub === 'skills') {
      const tiers = [1,2,3,4,5];
      const lines = tiers.map(tier => {
        const tierSkills = Object.entries(SKILLS).filter(([,s]) => s.tier === tier);
        const tierLines = tierSkills.map(([id, s]) => {
          const owned = pData.skills.includes(id);
          const reqMet = !s.requires || pData.skills.includes(s.requires);
          const presReq = s.prestigeReq ? pData.prestige >= s.prestigeReq : true;
          let status = '🔒';
          if (owned) status = '✅';
          else if (reqMet && presReq) status = '🔓';
          const presLabel = s.prestigeReq ? ` [P${s.prestigeReq}+]` : '';
          return `${status} **${s.name}** (${s.cost}pts)${presLabel} — ${s.desc}`;
        }).join('\n');
        return `**── Tier ${tier} ──**\n${tierLines}`;
      }).join('\n\n');

      return interaction.editReply({ embeds: [new EmbedBuilder()
        .setColor(title.color)
        .setTitle(`🧠 ${username}'s Skill Tree`)
        .setDescription(lines.slice(0, 4096))
        .addFields(
          { name: '🎯 Skill Points', value: `${pData.skillPoints}`, inline: true },
          { name: '⭐ Prestige',     value: `${pData.prestige}/10`, inline: true },
        )
        .setFooter({ text: '✅ = Owned | 🔓 = Available | 🔒 = Locked | [P#] = Prestige required' })] });
    }

    // ── LEARN ─────────────────────────────────────────────
    if (sub === 'learn') {
      const skillId = interaction.options.getString('skill');
      const skill = SKILLS[skillId];
      if (!skill) return interaction.editReply('❌ Unknown skill!');
      if (pData.skills.includes(skillId)) return interaction.editReply('❌ Already learned!');
      if (skill.requires && !pData.skills.includes(skill.requires)) {
        return interaction.editReply(`❌ Requires **${SKILLS[skill.requires]?.name}** first!`);
      }
      if (skill.prestigeReq && pData.prestige < skill.prestigeReq) {
        return interaction.editReply(`❌ Requires **Prestige ${skill.prestigeReq}**! You are Prestige ${pData.prestige}.`);
      }
      if (pData.skillPoints < skill.cost) {
        return interaction.editReply(`❌ Need **${skill.cost} skill points**, have **${pData.skillPoints}**.`);
      }
      pData.skillPoints -= skill.cost;
      pData.skills.push(skillId);
      client.memory.set(pKey, pData);

      return interaction.editReply({ embeds: [new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle(`✅ Skill Learned: ${skill.name}`)
        .setDescription(skill.desc)
        .addFields({ name: '🎯 Points Left', value: `${pData.skillPoints}`, inline: true })] });
    }

    // ── PRESTIGE ──────────────────────────────────────────
    if (sub === 'prestige') {
      if (pData.level < 100) return interaction.editReply(`❌ You need to reach **Level 100** to prestige! You are Level **${pData.level}**.`);
      if (pData.prestige >= 10) return interaction.editReply('🏆 You are already at max prestige (10)! You are a true Legend.');

      const nextPrestige = pData.prestige + 1;
      const nextTitle = getPrestigeTitle(nextPrestige);
      const nextBonus = getPrestigeBonus(nextPrestige);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('prestige_confirm').setLabel(`✅ Prestige to ${nextTitle.badge} ${nextTitle.title}`).setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('prestige_cancel').setLabel('❌ Cancel').setStyle(ButtonStyle.Secondary)
      );

      await interaction.editReply({ embeds: [new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('⭐ PRESTIGE!')
        .setDescription(`Are you sure you want to prestige?\n\n**This will reset:**\n- Your level back to 1\n- All your dungeon gold\n- Your dungeon inventory\n- All skill points and skills\n\n**You will gain:**\n- ${nextTitle.badge} **${nextTitle.title}** title\n- **+${nextBonus.bonusDmg} permanent damage**\n- **+${nextBonus.bonusHp} permanent HP**\n- **+${Math.round(nextBonus.bonusGoldPct*100)}% permanent gold bonus**\n${nextPrestige >= 3 ? '- 🌑 **Nightmare rooms unlocked!**' : ''}${nextPrestige >= 5 ? '\n- 💀 **Prestige bosses unlocked!**' : ''}`)
        .setFooter({ text: 'This cannot be undone!' })], components: [row] });

      const msg = await interaction.fetchReply();
      const collector = msg.createMessageComponentCollector({ time: 30000, max: 1 });

      collector.on('collect', async btn => {
        try { await btn.deferUpdate(); } catch (e) { return; }
        if (btn.user.id !== userId) return;

        if (btn.customId === 'prestige_confirm') {
          // Reset dungeon data
          const dData = client.memory.get(dKey);
          if (dData) {
            dData.gold = 0;
            dData.inventory = [];
            dData.equippedArmor = null;
            dData.equippedSword = null;
            dData.potions = { health: 0, damage: 0, cash: 0 };
            dData.spells = {};
            dData.inDungeon = false;
            dData.currentRoom = 0;
            dData.hp = 100;
            client.memory.set(dKey, dData);
          }

          // Update prestige data
          pData.prestige = nextPrestige;
          pData.level = 1;
          pData.xp = 0;
          pData.skillPoints = 0;
          pData.skills = [];
          pData.revivesUsed = 0;
          client.memory.set(pKey, pData);

          // Save to postgres if available
          if (client.pool) {
            try {
              await client.pool.query(`
                CREATE TABLE IF NOT EXISTS dungeon_prestige (
                  user_id TEXT NOT NULL, guild_id TEXT NOT NULL, username TEXT,
                  prestige INT DEFAULT 0, PRIMARY KEY (user_id, guild_id)
                )
              `);
              await client.pool.query(`
                INSERT INTO dungeon_prestige (user_id, guild_id, username, prestige)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (user_id, guild_id) DO UPDATE SET username = $3, prestige = $4
              `, [userId, guildId, username, nextPrestige]);
            } catch (err) { console.error('prestige save failed:', err.message); }
          }

          await msg.edit({ embeds: [new EmbedBuilder()
            .setColor(nextTitle.color)
            .setTitle(`${nextTitle.badge} PRESTIGE ${nextPrestige} — ${nextTitle.title}!`)
            .setDescription(`**${username}** has ascended to **${nextTitle.badge} ${nextTitle.title}**!\n\nYour dungeon data has been reset. Your journey begins anew — but stronger than ever.`)
            .addFields(
              { name: '🔥 Permanent Bonuses', value: `+${nextBonus.bonusDmg} dmg | +${nextBonus.bonusHp} HP | +${Math.round(nextBonus.bonusGoldPct*100)}% gold`, inline: false },
              { name: '🎯 Next Step', value: 'Reach Level 100 again to prestige further!', inline: false },
            )], components: [] }).catch(() => {});

        } else {
          await msg.edit({ embeds: [new EmbedBuilder().setColor('#888888').setTitle('Prestige cancelled.')], components: [] }).catch(() => {});
        }
      });

      collector.on('end', collected => { if (collected.size === 0) msg.edit({ components: [] }).catch(() => {}); });
      return;
    }

    // ── PRESTIGE LEADERBOARD ───────────────────────────────
    if (sub === 'prestigeboard') {
      let rows = [];
      if (client.pool) {
        try {
          await client.pool.query(`
            CREATE TABLE IF NOT EXISTS dungeon_prestige (
              user_id TEXT NOT NULL, guild_id TEXT NOT NULL, username TEXT,
              prestige INT DEFAULT 0, PRIMARY KEY (user_id, guild_id)
            )
          `);
          const result = await client.pool.query(`
            SELECT username, prestige FROM dungeon_prestige
            WHERE guild_id = $1 ORDER BY prestige DESC LIMIT 10
          `, [guildId]);
          rows = result.rows;
        } catch (err) { console.error('prestigeboard failed:', err.message); }
      }

      if (rows.length === 0) {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#FFD700').setTitle('⭐ Prestige Leaderboard').setDescription('Nobody has prestiged yet! Be the first!')] });
      }

      const medals = ['🥇','🥈','🥉'];
      const lines = rows.map((r, i) => {
        const t = getPrestigeTitle(r.prestige);
        return `${medals[i] || `**#${i+1}**`} ${t.badge} **${r.username}** — Prestige ${r.prestige} — ${t.title}`;
      });

      return interaction.editReply({ embeds: [new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('⭐ Dungeon Prestige Leaderboard')
        .setDescription(lines.join('\n'))] });
    }

    // ── BONUSES ───────────────────────────────────────────
    if (sub === 'bonuses') {
      const pb = getPrestigeBonus(pData.prestige);
      return interaction.editReply({ embeds: [new EmbedBuilder()
        .setColor(title.color)
        .setTitle(`${title.badge} ${username}'s Active Bonuses`)
        .addFields(
          { name: '⭐ Prestige Bonuses', value: `+${pb.bonusDmg} damage\n+${pb.bonusHp} HP\n+${Math.round(pb.bonusGoldPct*100)}% gold`, inline: true },
          { name: '🧠 Skill Bonuses', value: [
            bonus.dmg > pb.bonusDmg ? `+${bonus.dmg - pb.bonusDmg} skill damage` : '',
            bonus.hp > pb.bonusHp ? `+${bonus.hp - pb.bonusHp} skill HP` : '',
            bonus.dodgeChance > 0 ? `${Math.round(bonus.dodgeChance*100)}% dodge chance` : '',
            bonus.critChance > 0 ? `${Math.round(bonus.critChance*100)}% crit chance (${bonus.critMult}x)` : '',
            bonus.goldPerRoom > 0 ? `+${bonus.goldPerRoom} gold/room` : '',
            bonus.treasureChance > 0 ? `${Math.round(bonus.treasureChance*100)}% treasure chance` : '',
            bonus.revives > 0 ? `${bonus.revives} revive(s) per run` : '',
            bonus.allGoldMult > 1 ? `${bonus.allGoldMult.toFixed(1)}x all gold` : '',
            bonus.allDmgMult > 1 ? `${bonus.allDmgMult.toFixed(1)}x all damage` : '',
            bonus.dmgReduction > 0 ? `-${bonus.dmgReduction} damage taken` : '',
            bonus.bossGoldMult > 1 ? `${bonus.bossGoldMult}x boss gold` : '',
          ].filter(Boolean).join('\n') || 'No skill bonuses yet', inline: true },
          { name: '🔓 Unlocks', value: [
            pData.prestige >= 3 ? '🌑 Nightmare Rooms' : '',
            pData.prestige >= 5 ? '💀 Prestige Bosses' : '',
            pData.prestige >= 10 ? '🏆 Legend Status' : '',
          ].filter(Boolean).join('\n') || 'None yet (requires Prestige 3+)', inline: false },
        )] });
    }
  },

  // ── EXPORTS FOR USE IN dungeon.js ─────────────────────────────────────────
  getSkillBonus,
  getPrestigeBonus,
  getPrestigeTitle,
  getRoomXP,
  getBossXP,
  xpForLevel,
  getPrestigeKey,
  NIGHTMARE_ROOMS,
  PRESTIGE_BOSSES,
  SKILLS,
};
