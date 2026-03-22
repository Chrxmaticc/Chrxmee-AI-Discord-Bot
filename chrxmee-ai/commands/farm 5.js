const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const OWNER_ID = '902685494247325776';

// ── SEASONS (rotate every 2 days) ─────────────────────────────────────────
const SEASONS = ['🌸 Spring', '☀️ Summer', '🍂 Fall', '❄️ Winter'];
const SEASON_CROPS = {
  '🌸 Spring': ['wheat', 'carrot', 'strawberry', 'moonflower', 'starberry'],
  '☀️ Summer': ['corn', 'tomato', 'watermelon', 'dragonfruit', 'rainbow_cactus'],
  '🍂 Fall':   ['potato', 'pumpkin', 'mushroom', 'gloomshroom', 'goldenroot'],
  '❄️ Winter': ['pepper', 'blueberry', 'crystal_lotus', 'voidbloom', 'phoenix_blossom'],
};

function getCurrentSeason() {
  const daysSinceEpoch = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
  return SEASONS[Math.floor(daysSinceEpoch / 2) % 4];
}

function getWeather() {
  const roll = Math.random();
  if (roll < 0.15) return { name: '🌧️ Rain',        speedMult: 0.7,  mutationBonus: 0 };
  if (roll < 0.25) return { name: '🌩️ Thunderstorm', speedMult: 0.8,  mutationBonus: 0.05 };
  if (roll < 0.35) return { name: '🌵 Drought',      speedMult: 1.3,  mutationBonus: 0 };
  return { name: '🌤️ Clear',         speedMult: 1.0,  mutationBonus: 0 };
}

// ── CROPS ──────────────────────────────────────────────────────────────────
const CROPS = [
  // Common (30sec - 2min)
  { id: 'wheat',         name: '🌾 Wheat',          cost: 5,    growMs: 30000,    sellBase: 15,   tier: 'common',    season: '🌸 Spring' },
  { id: 'carrot',        name: '🥕 Carrot',          cost: 8,    growMs: 45000,    sellBase: 22,   tier: 'common',    season: '🌸 Spring' },
  { id: 'potato',        name: '🥔 Potato',          cost: 10,   growMs: 60000,    sellBase: 28,   tier: 'common',    season: '🍂 Fall'   },
  { id: 'corn',          name: '🌽 Corn',            cost: 12,   growMs: 75000,    sellBase: 35,   tier: 'common',    season: '☀️ Summer' },
  { id: 'tomato',        name: '🍅 Tomato',          cost: 15,   growMs: 90000,    sellBase: 42,   tier: 'common',    season: '☀️ Summer' },
  { id: 'pepper',        name: '🌶️ Pepper',          cost: 18,   growMs: 120000,   sellBase: 55,   tier: 'common',    season: '❄️ Winter' },
  // Uncommon (3min - 8min)
  { id: 'strawberry',    name: '🍓 Strawberry',      cost: 40,   growMs: 180000,   sellBase: 100,  tier: 'uncommon',  season: '🌸 Spring' },
  { id: 'pumpkin',       name: '🎃 Pumpkin',         cost: 55,   growMs: 240000,   sellBase: 130,  tier: 'uncommon',  season: '🍂 Fall'   },
  { id: 'watermelon',    name: '🍉 Watermelon',      cost: 70,   growMs: 300000,   sellBase: 165,  tier: 'uncommon',  season: '☀️ Summer' },
  { id: 'blueberry',     name: '🫐 Blueberry',       cost: 85,   growMs: 360000,   sellBase: 200,  tier: 'uncommon',  season: '❄️ Winter' },
  { id: 'sunflower',     name: '🌻 Sunflower',       cost: 100,  growMs: 420000,   sellBase: 240,  tier: 'uncommon',  season: '☀️ Summer' },
  { id: 'mushroom',      name: '🍄 Mushroom',        cost: 120,  growMs: 480000,   sellBase: 280,  tier: 'uncommon',  season: '🍂 Fall'   },
  // Rare (10min - 20min)
  { id: 'moonflower',    name: '🌙 Moonflower',      cost: 200,  growMs: 600000,   sellBase: 450,  tier: 'rare',      season: '🌸 Spring', special: 'heal' },
  { id: 'dragonfruit',   name: '🐉 Dragonfruit',     cost: 280,  growMs: 720000,   sellBase: 600,  tier: 'rare',      season: '☀️ Summer' },
  { id: 'gloomshroom',   name: '🍄 Gloomshroom',     cost: 350,  growMs: 900000,   sellBase: 750,  tier: 'rare',      season: '🍂 Fall',   special: 'dungeon_bonus' },
  { id: 'crystal_lotus', name: '💎 Crystal Lotus',   cost: 450,  growMs: 1080000,  sellBase: 950,  tier: 'rare',      season: '❄️ Winter' },
  { id: 'starberry',     name: '⭐ Starberry',        cost: 600,  growMs: 1200000,  sellBase: 1200, tier: 'rare',      season: '🌸 Spring' },
  // Legendary (30min - 1hr)
  { id: 'voidbloom',     name: '🌀 Voidbloom',       cost: 1000, growMs: 1800000,  sellBase: 2200, tier: 'legendary', season: '❄️ Winter' },
  { id: 'goldenroot',    name: '🌟 Goldenroot',      cost: 1500, growMs: 2400000,  sellBase: 3200, tier: 'legendary', season: '🍂 Fall'   },
  { id: 'rainbow_cactus',name: '🌈 Rainbow Cactus',  cost: 2000, growMs: 3000000,  sellBase: 4500, tier: 'legendary', season: '☀️ Summer' },
  { id: 'celestial_fruit',name:'✨ Celestial Fruit',  cost: 3000, growMs: 3600000,  sellBase: 6500, tier: 'legendary', season: null        },
  { id: 'phoenix_blossom',name:'🔥 Phoenix Blossom', cost: 4000, growMs: 3600000,  sellBase: 8000, tier: 'legendary', season: '❄️ Winter' },
];

// ── FERTILIZERS ────────────────────────────────────────────────────────────
const FERTILIZERS = [
  { id: 'basic',    name: '🌿 Basic Fertilizer',    cost: 50,   desc: '2x grow speed',           speedMult: 0.5,  yieldMult: 1, mutBonus: 0    },
  { id: 'super',    name: '💚 Super Fertilizer',    cost: 120,  desc: '3x grow speed',           speedMult: 0.33, yieldMult: 1, mutBonus: 0    },
  { id: 'yield',    name: '🌾 Yield Fertilizer',    cost: 100,  desc: '2x harvest amount',       speedMult: 1,    yieldMult: 2, mutBonus: 0    },
  { id: 'mutation', name: '🧬 Mutation Fertilizer', cost: 150,  desc: '+25% mutation chance',    speedMult: 1,    yieldMult: 1, mutBonus: 0.25 },
  { id: 'rainbow',  name: '🌈 Rainbow Fertilizer',  cost: 300,  desc: 'Random powerful effect!', speedMult: 1,    yieldMult: 1, mutBonus: 0    },
];

// ── MUTATIONS ──────────────────────────────────────────────────────────────
const MUTATIONS = [
  { id: 'giant',   name: '🌟 Giant',   chance: 0.05, desc: '5x sell value!' },
  { id: 'rainbow', name: '🌈 Rainbow', chance: 0.03, desc: 'Random huge payout!' },
  { id: 'poison',  name: '☠️ Poison',  chance: 0.08, desc: 'Harvest within 10 mins or lose it!' },
  { id: 'golden',  name: '🥇 Golden',  chance: 0.02, desc: '+100 dungeon gold permanently!' },
  { id: 'crystal', name: '💎 Crystal', chance: 0.04, desc: 'Used for special crafting!' },
];

// ── PLOT EXPANSION TIERS ───────────────────────────────────────────────────
const PLOT_TIERS = [
  { plots: 5,  cost: 0,     label: 'Starter (5 plots)' },
  { plots: 8,  cost: 2000,  label: 'Expanded (8 plots)' },
  { plots: 10, cost: 5000,  label: 'Large (10 plots)' },
  { plots: 15, cost: 15000, label: 'Mega Farm (15 plots)' },
];

// ── HELPERS ────────────────────────────────────────────────────────────────
function getDefaultFarmData() {
  return {
    coins: 0,
    plots: Array(5).fill(null),
    maxPlots: 5,
    inventory: {},
    fertilizers: { basic: 0, super: 0, yield: 0, mutation: 0, rainbow: 0 },
    totalHarvested: 0,
    totalEarned: 0,
    crystalCrops: 0,
  };
}

function migrateData(data) {
  const def = getDefaultFarmData();
  for (const k of Object.keys(def)) {
    if (!(k in data)) data[k] = def[k];
  }
  if (!data.fertilizers) data.fertilizers = { basic: 0, super: 0, yield: 0, mutation: 0, rainbow: 0 };
  if (!data.crystalCrops) data.crystalCrops = 0;
  return data;
}

function formatTime(ms) {
  if (ms < 0) return 'Ready!';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m/60)}h ${m%60}m`;
}

function rollMutation(baseMutChance, fertilizer, weather) {
  let totalChance = baseMutChance + (weather?.mutationBonus || 0);
  if (fertilizer === 'mutation') totalChance += 0.25;
  if (fertilizer === 'rainbow' && Math.random() < 0.3) totalChance += 0.5;
  for (const m of MUTATIONS) {
    if (Math.random() < (m.chance + totalChance * 0.1)) return m;
  }
  return null;
}

function applyRainbowFertilizer() {
  const effects = [
    { speedMult: 0.2, yieldMult: 1, mutBonus: 0,   label: '⚡ LIGHTNING SPEED (5x)!' },
    { speedMult: 1,   yieldMult: 3, mutBonus: 0,   label: '🌾 TRIPLE YIELD!' },
    { speedMult: 0.5, yieldMult: 2, mutBonus: 0.3, label: '🧬 SPEED + MUTATION BOOST!' },
    { speedMult: 1,   yieldMult: 1, mutBonus: 0.5, label: '🌟 MEGA MUTATION CHANCE!' },
    { speedMult: 0.33,yieldMult: 2, mutBonus: 0.2, label: '🌈 RAINBOW BLESSING!' },
  ];
  return effects[Math.floor(Math.random() * effects.length)];
}

function buildFarmEmbed(data, title, desc) {
  const season = getCurrentSeason();
  const weather = getWeather();
  const now = Date.now();
  const plotLines = data.plots.map((plot, i) => {
    if (!plot) return `**Plot ${i+1}:** 🟫 Empty`;
    const crop = CROPS.find(c => c.id === plot.cropId);
    const remaining = plot.readyAt - now;
    const inSeason = crop.season === null || crop.season === season;
    const mutLabel = plot.mutation ? ` [${plot.mutation.name}]` : '';
    const waterLabel = plot.watered ? ' 💧' : '';
    const fertLabel = plot.fertilizer ? ` [${FERTILIZERS.find(f=>f.id===plot.fertilizer)?.name.split(' ')[0]}]` : '';
    if (remaining <= 0) return `**Plot ${i+1}:** ${crop.name}${mutLabel} ✅ READY!${waterLabel}${fertLabel}`;
    return `**Plot ${i+1}:** ${crop.name}${mutLabel} ⏳ ${formatTime(remaining)}${inSeason ? ' 🌸' : ''}${waterLabel}${fertLabel}`;
  }).join('\n');

  const poisonWarnings = data.plots.filter(p => p && p.mutation?.id === 'poison' && p.readyAt - now < 600000 && p.readyAt <= now).map(p => {
    const crop = CROPS.find(c => c.id === p.cropId);
    return `⚠️ ${crop.name} is POISONED — harvest NOW!`;
  });

  return new EmbedBuilder()
    .setColor('#2d8a3e')
    .setTitle(`🌾 ${title}`)
    .setDescription(desc || plotLines)
    .addFields(
      { name: '🌍 Season', value: season, inline: true },
      { name: '🌤️ Weather', value: weather.name, inline: true },
      { name: '💰 Coins', value: data.coins.toLocaleString(), inline: true },
      { name: '📊 Plots', value: `${data.plots.filter(p=>p).length}/${data.maxPlots} used`, inline: true },
    )
    .setFooter({ text: poisonWarnings.length > 0 ? poisonWarnings.join(' | ') : 'Use /farm view to check your crops anytime' });
}

// ── COMMAND ────────────────────────────────────────────────────────────────
module.exports = {
  data: new SlashCommandBuilder()
    .setName('farm')
    .setDescription('Plant, grow and harvest crops on your farm!')
    .addSubcommand(sub => sub.setName('view').setDescription('View your farm'))
    .addSubcommand(sub =>
      sub.setName('plant')
        .setDescription('Plant a crop in an empty plot')
        .addIntegerOption(opt => opt.setName('plot').setDescription('Plot number').setRequired(true).setMinValue(1).setMaxValue(15))
        .addStringOption(opt => opt.setName('crop').setDescription('Crop to plant').setRequired(true)
          .addChoices(...CROPS.map(c => ({ name: `${c.name} (${c.cost}c, ${formatTime(c.growMs)})`, value: c.id })))
        )
        .addStringOption(opt => opt.setName('fertilizer').setDescription('Apply fertilizer (optional)').setRequired(false)
          .addChoices(...FERTILIZERS.map(f => ({ name: f.name, value: f.id })))
        )
    )
    .addSubcommand(sub =>
      sub.setName('water')
        .setDescription('Water a plot for +20% sell bonus')
        .addIntegerOption(opt => opt.setName('plot').setDescription('Plot number').setRequired(true).setMinValue(1).setMaxValue(15))
    )
    .addSubcommand(sub =>
      sub.setName('harvest')
        .setDescription('Harvest a ready crop')
        .addIntegerOption(opt => opt.setName('plot').setDescription('Plot number (or 0 for all)').setRequired(true).setMinValue(0).setMaxValue(15))
    )
    .addSubcommand(sub => sub.setName('sell').setDescription('Sell all harvested crops'))
    .addSubcommand(sub => sub.setName('shop').setDescription('Buy seeds and fertilizers'))
    .addSubcommand(sub => sub.setName('expand').setDescription('Expand your farm plots'))
    .addSubcommand(sub => sub.setName('inventory').setDescription('View harvested crop inventory'))
    .addSubcommand(sub => sub.setName('stats').setDescription('View your farming stats'))
    .addSubcommand(sub =>
      sub.setName('craft')
        .setDescription('Craft fertilizer from harvested crops')
        .addStringOption(opt => opt.setName('type').setDescription('Fertilizer to craft').setRequired(true)
          .addChoices(...FERTILIZERS.map(f => ({ name: f.name, value: f.id })))
        )
    )
    .addSubcommand(sub => sub.setName('reset').setDescription('Reset your farm data'))
    .addSubcommand(sub =>
      sub.setName('give')
        .setDescription('(Owner/Mod) Give farm coins')
        .addUserOption(opt => opt.setName('user').setDescription('Target').setRequired(true))
        .addIntegerOption(opt => opt.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1))
    ),

  async execute(interaction, client) {
    try { await interaction.deferReply({ ephemeral: false }); }
    catch (err) { return interaction.reply({ content: 'Failed.', ephemeral: true }).catch(() => {}); }

    const userId = interaction.user.id;
    const guildId = interaction.guild.id;
    const username = interaction.user.username;
    const key = `farm2_${guildId}_${userId}`;

    let data = client.memory.get(key) || getDefaultFarmData();
    data = migrateData(data);

    const sub = interaction.options.getSubcommand();

    // ── GIVE ──────────────────────────────────────────────
    if (sub === 'give') {
      const isOwner = userId === OWNER_ID;
      const isMod = interaction.member?.permissions?.has('KickMembers');
      if (!isOwner && !isMod) return interaction.editReply('❌ Mods only.');
      const target = interaction.options.getUser('user');
      const amount = interaction.options.getInteger('amount');
      if (!isOwner && amount > 5000) return interaction.editReply('❌ Mods capped at 5,000.');
      const tKey = `farm2_${guildId}_${target.id}`;
      let tData = client.memory.get(tKey) || getDefaultFarmData();
      tData = migrateData(tData);
      tData.coins += amount;
      client.memory.set(tKey, tData);
      return interaction.editReply(`✅ Gave **${amount.toLocaleString()}c** to **${target.username}**!`);
    }

    // ── RESET ─────────────────────────────────────────────
    if (sub === 'reset') {
      client.memory.delete(key);
      return interaction.editReply('✅ Farm reset!');
    }

    // ── STATS ─────────────────────────────────────────────
    if (sub === 'stats') {
      const season = getCurrentSeason();
      const seasonCrops = SEASON_CROPS[season] || [];
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#2d8a3e').setTitle(`🌾 ${username}'s Farm Stats`)
        .addFields(
          { name: '💰 Coins',         value: data.coins.toLocaleString(),       inline: true },
          { name: '📦 Total Harvested',value: data.totalHarvested.toLocaleString(), inline: true },
          { name: '💸 Total Earned',  value: data.totalEarned.toLocaleString(), inline: true },
          { name: '🏡 Plots',         value: `${data.maxPlots}`,               inline: true },
          { name: '💎 Crystal Crops', value: `${data.crystalCrops}`,           inline: true },
          { name: '🌍 Current Season',value: season,                           inline: true },
          { name: '🌸 In-Season Crops',value: seasonCrops.map(id => CROPS.find(c=>c.id===id)?.name).join(', ') || 'All', inline: false },
          { name: '🧪 Fertilizers',   value: Object.entries(data.fertilizers).map(([id,qty]) => `${FERTILIZERS.find(f=>f.id===id)?.name}: ${qty}`).join('\n') || 'None', inline: false },
        )] });
    }

    // ── VIEW ──────────────────────────────────────────────
    if (sub === 'view') {
      const now = Date.now();
      const plotLines = data.plots.map((plot, i) => {
        if (!plot) return `**Plot ${i+1}:** 🟫 Empty`;
        const crop = CROPS.find(c => c.id === plot.cropId);
        const remaining = plot.readyAt - now;
        const season = getCurrentSeason();
        const inSeason = crop.season === null || crop.season === season;
        const mutLabel = plot.mutation ? ` [${plot.mutation.name}]` : '';
        const waterLabel = plot.watered ? ' 💧' : '';
        const fertLabel = plot.fertilizer ? ` [${FERTILIZERS.find(f=>f.id===plot.fertilizer)?.name.split(' ').slice(0,2).join(' ')}]` : '';
        if (remaining <= 0) {
          if (plot.mutation?.id === 'poison') return `**Plot ${i+1}:** ${crop.name} ☠️ POISONED — HARVEST NOW!`;
          return `**Plot ${i+1}:** ${crop.name}${mutLabel} ✅ **READY!**${waterLabel}${fertLabel}`;
        }
        return `**Plot ${i+1}:** ${crop.name}${mutLabel} ⏳ ${formatTime(remaining)}${inSeason ? ' 🌸' : ''}${waterLabel}${fertLabel}`;
      }).join('\n');

      return interaction.editReply({ embeds: [buildFarmEmbed(data, `${username}'s Farm`, plotLines)] });
    }

    // ── PLANT ─────────────────────────────────────────────
    if (sub === 'plant') {
      const plotNum = interaction.options.getInteger('plot') - 1;
      const cropId = interaction.options.getString('crop');
      const fertId = interaction.options.getString('fertilizer');

      if (plotNum >= data.maxPlots) return interaction.editReply(`❌ You only have ${data.maxPlots} plots! Expand with \`/farm expand\`.`);
      if (data.plots[plotNum]) return interaction.editReply(`❌ Plot ${plotNum+1} is already planted!`);

      const crop = CROPS.find(c => c.id === cropId);
      if (!crop) return interaction.editReply('❌ Unknown crop!');
      if (data.coins < crop.cost) return interaction.editReply(`❌ Need **${crop.cost}c**, have **${data.coins}c**.`);

      if (fertId && data.fertilizers[fertId] <= 0) return interaction.editReply(`❌ You don't have any ${FERTILIZERS.find(f=>f.id===fertId)?.name}!`);

      let fert = fertId ? FERTILIZERS.find(f => f.id === fertId) : null;
      let fertEffect = fert;
      let rainbowLabel = '';

      if (fertId === 'rainbow') {
        fertEffect = applyRainbowFertilizer();
        rainbowLabel = `\n🌈 Rainbow Effect: **${fertEffect.label}**`;
      }

      const season = getCurrentSeason();
      const weather = getWeather();
      const inSeason = crop.season === null || crop.season === season;
      let growMs = crop.growMs;

      // Apply speed mults
      if (fert) growMs = Math.floor(growMs * (fertEffect.speedMult || 1));
      if (inSeason) growMs = Math.floor(growMs * 0.5); // in season = 50% faster
      if (weather.speedMult) growMs = Math.floor(growMs * weather.speedMult);

      // Pets (frog = 25% faster)
      const petData = client.memory.get(`pets_${guildId}_${userId}`);
      if (petData?.active?.includes('frog')) growMs = Math.floor(growMs * 0.75);

      const mutation = rollMutation(0.05, fertId, weather);
      const yieldMult = fertEffect?.yieldMult || 1;

      data.coins -= crop.cost;
      if (fertId) data.fertilizers[fertId]--;
      data.plots[plotNum] = {
        cropId,
        plantedAt: Date.now(),
        readyAt: Date.now() + growMs,
        watered: false,
        fertilizer: fertId || null,
        fertEffect: fertId === 'rainbow' ? fertEffect : null,
        mutation,
        yieldMult,
      };

      while (data.plots.length < data.maxPlots) data.plots.push(null);
      client.memory.set(key, data);

      const mutText = mutation ? `\n🧬 **Mutation detected: ${mutation.name}** — ${mutation.desc}` : '';
      const seasonText = inSeason ? `\n🌸 In season! Grows 50% faster!` : '';
      const weatherText = weather.name !== '🌤️ Clear' ? `\n${weather.name} — growth affected!` : '';

      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#2d8a3e').setTitle(`🌱 Planted ${crop.name}!`)
        .setDescription(`Plot **${plotNum+1}** — Ready in **${formatTime(growMs)}**${seasonText}${weatherText}${mutText}${rainbowLabel}`)
        .addFields({ name: '💰 Coins Left', value: data.coins.toLocaleString(), inline: true })] });
    }

    // ── WATER ─────────────────────────────────────────────
    if (sub === 'water') {
      const plotNum = interaction.options.getInteger('plot') - 1;
      if (plotNum >= data.maxPlots || !data.plots[plotNum]) return interaction.editReply(`❌ Plot ${plotNum+1} is empty!`);
      if (data.plots[plotNum].watered) return interaction.editReply('❌ Already watered!');
      if (data.plots[plotNum].readyAt <= Date.now()) return interaction.editReply('❌ Crop is already ready — harvest it first!');
      data.plots[plotNum].watered = true;
      client.memory.set(key, data);
      return interaction.editReply(`💧 Watered Plot **${plotNum+1}**! +20% sell bonus applied.`);
    }

    // ── HARVEST ───────────────────────────────────────────
    if (sub === 'harvest') {
      const plotNum = interaction.options.getInteger('plot');
      const now = Date.now();

      const harvestPlot = (idx) => {
        const plot = data.plots[idx];
        if (!plot) return null;
        const crop = CROPS.find(c => c.id === plot.cropId);
        if (plot.readyAt > now) return null;

        // Poison check
        if (plot.mutation?.id === 'poison' && now - plot.readyAt > 600000) {
          data.plots[idx] = null;
          return { name: crop.name, lost: true };
        }

        let sellVal = crop.sellBase;
        if (plot.watered) sellVal = Math.floor(sellVal * 1.2);

        // Mutation effects
        let mutLabel = '';
        if (plot.mutation) {
          if (plot.mutation.id === 'giant') { sellVal *= 5; mutLabel = ' [🌟 Giant 5x!]'; }
          else if (plot.mutation.id === 'rainbow') { sellVal = Math.floor(sellVal * (2 + Math.random() * 8)); mutLabel = ` [🌈 Rainbow ${Math.round(sellVal/crop.sellBase)}x!]`; }
          else if (plot.mutation.id === 'golden') {
            const dKey = `dungeon_${guildId}_${userId}`;
            const dData = client.memory.get(dKey);
            if (dData) { dData.gold = (dData.gold||0) + 100; client.memory.set(dKey, dData); }
            mutLabel = ' [🥇 Golden +100 dungeon gold!]';
          }
          else if (plot.mutation.id === 'crystal') { data.crystalCrops++; mutLabel = ' [💎 Crystal!]'; }
        }

        // Special crops
        if (crop.special === 'heal') {
          const dKey = `dungeon_${guildId}_${userId}`;
          const dData = client.memory.get(dKey);
          if (dData) { dData.hp = Math.min(100, (dData.hp||100) + 20); client.memory.set(dKey, dData); }
        }
        if (crop.special === 'dungeon_bonus') {
          const dKey = `dungeon_${guildId}_${userId}`;
          const dData = client.memory.get(dKey);
          if (dData) { dData.gloomshroomBonus = (dData.gloomshroomBonus||0) + 50; client.memory.set(dKey, dData); }
        }

        const qty = plot.yieldMult || 1;
        const total = sellVal * qty;
        data.inventory[plot.cropId] = (data.inventory[plot.cropId] || 0) + qty;
        data.coins += total;
        data.totalHarvested += qty;
        data.totalEarned += total;
        data.plots[idx] = null;
        return { name: crop.name + mutLabel, qty, total };
      };

      let results = [];
      if (plotNum === 0) {
        // Harvest all
        for (let i = 0; i < data.maxPlots; i++) {
          const r = harvestPlot(i);
          if (r) results.push(r);
        }
      } else {
        const r = harvestPlot(plotNum - 1);
        if (r) results.push(r);
        else return interaction.editReply(`❌ Plot ${plotNum} is either empty or not ready yet!`);
      }

      if (results.length === 0) return interaction.editReply('❌ No crops are ready to harvest!');

      client.memory.set(key, data);
      const lines = results.map(r => r.lost ? `☠️ ${r.name} — LOST (poisoned too long!)` : `${r.name} x${r.qty} — **${r.total.toLocaleString()}c**`).join('\n');
      const totalEarned = results.filter(r => !r.lost).reduce((a,r) => a+r.total, 0);

      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#2d8a3e').setTitle(`🌾 Harvest Complete!`)
        .setDescription(lines)
        .addFields({ name: '💰 Total Earned', value: `${totalEarned.toLocaleString()}c`, inline: true }, { name: '💰 Balance', value: data.coins.toLocaleString(), inline: true })] });
    }

    // ── SELL ──────────────────────────────────────────────
    if (sub === 'sell') {
      if (Object.keys(data.inventory).length === 0) return interaction.editReply('📦 Nothing to sell! Harvest first.');
      let total = 0;
      const lines = [];
      for (const [id, qty] of Object.entries(data.inventory)) {
        const crop = CROPS.find(c => c.id === id);
        if (!crop) continue;
        const earned = crop.sellBase * qty;
        total += earned;
        lines.push(`${crop.name} x${qty} → **${earned.toLocaleString()}c**`);
      }
      data.coins += total;
      data.totalEarned += total;
      data.inventory = {};
      client.memory.set(key, data);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#00ff00').setTitle('💰 Crops Sold!').setDescription(lines.join('\n')).addFields({ name: '💵 Total', value: `${total.toLocaleString()}c`, inline: true }, { name: '💰 Balance', value: data.coins.toLocaleString(), inline: true })] });
    }

    // ── INVENTORY ─────────────────────────────────────────
    if (sub === 'inventory') {
      if (Object.keys(data.inventory).length === 0) return interaction.editReply('📦 Inventory is empty! Harvest some crops first.');
      const lines = Object.entries(data.inventory).map(([id, qty]) => {
        const crop = CROPS.find(c => c.id === id);
        return `${crop?.name || id} x**${qty}** — ${(crop?.sellBase * qty).toLocaleString()}c`;
      });
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#2d8a3e').setTitle('📦 Farm Inventory').setDescription(lines.join('\n')).addFields({ name: '💰 Coins', value: data.coins.toLocaleString(), inline: true }, { name: '💎 Crystal Crops', value: `${data.crystalCrops}`, inline: true })] });
    }

    // ── SHOP ──────────────────────────────────────────────
    if (sub === 'shop') {
      const season = getCurrentSeason();
      const tiers = ['common', 'uncommon', 'rare', 'legendary'];
      const cropLines = tiers.map(tier => {
        const crops = CROPS.filter(c => c.tier === tier);
        return `**${tier.toUpperCase()}**\n${crops.map(c => `${c.name} — **${c.cost}c** | ${formatTime(c.growMs)} | Sells: ${c.sellBase}c${c.season === season ? ' 🌸' : ''}`).join('\n')}`;
      }).join('\n\n');

      const fertLines = FERTILIZERS.map(f => `${f.name} — **${f.cost}c** — ${f.desc} (own: ${data.fertilizers[f.id]||0})`).join('\n');

      const row1 = new ActionRowBuilder().addComponents(
        FERTILIZERS.map(f => new ButtonBuilder().setCustomId(`farm_buy_fert_${f.id}`).setLabel(`Buy ${f.name.split(' ')[1]}`).setStyle(ButtonStyle.Success))
      );

      await interaction.editReply({ embeds: [new EmbedBuilder().setColor('#2d8a3e').setTitle('🏪 Farm Shop')
        .addFields(
          { name: '🌱 Seeds', value: cropLines.slice(0, 1024), inline: false },
          { name: '🌿 Fertilizers', value: fertLines, inline: false },
          { name: '💰 Your Coins', value: data.coins.toLocaleString(), inline: true },
          { name: '🌍 Season', value: season, inline: true },
        )], components: [row1] });

      const msg = await interaction.fetchReply();
      const collector = msg.createMessageComponentCollector({ time: 30000 });
      collector.on('collect', async btn => {
        try { await btn.deferUpdate(); } catch (e) { return; }
        if (btn.user.id !== userId) return;
        const fertId = btn.customId.replace('farm_buy_fert_', '');
        const fert = FERTILIZERS.find(f => f.id === fertId);
        if (!fert) return;
        if (data.coins < fert.cost) return btn.followUp({ content: `❌ Need **${fert.cost}c**, have **${data.coins}c**.`, ephemeral: true }).catch(() => {});
        data.coins -= fert.cost;
        data.fertilizers[fertId]++;
        client.memory.set(key, data);
        await btn.followUp({ content: `✅ Bought **${fert.name}**! You have **${data.fertilizers[fertId]}**.`, ephemeral: true }).catch(() => {});
      });
      collector.on('end', () => { msg.edit({ components: [] }).catch(() => {}); });
      return;
    }

    // ── EXPAND ────────────────────────────────────────────
    if (sub === 'expand') {
      const currentTier = PLOT_TIERS.findIndex(t => t.plots === data.maxPlots);
      const nextTier = PLOT_TIERS[currentTier + 1];
      if (!nextTier) return interaction.editReply('✅ Your farm is already at maximum size (15 plots)!');
      if (data.coins < nextTier.cost) return interaction.editReply(`❌ Need **${nextTier.cost.toLocaleString()}c** to expand. Have **${data.coins.toLocaleString()}c**.`);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('farm_expand_confirm').setLabel(`✅ Expand to ${nextTier.plots} plots (${nextTier.cost.toLocaleString()}c)`).setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('farm_expand_cancel').setLabel('❌ Cancel').setStyle(ButtonStyle.Secondary)
      );

      await interaction.editReply({ embeds: [new EmbedBuilder().setColor('#2d8a3e').setTitle('🏡 Farm Expansion')
        .setDescription(`Expand from **${data.maxPlots} plots** to **${nextTier.plots} plots**?\n\nCost: **${nextTier.cost.toLocaleString()}c**\nYour balance: **${data.coins.toLocaleString()}c**`)], components: [row] });

      const msg = await interaction.fetchReply();
      const collector = msg.createMessageComponentCollector({ time: 30000, max: 1 });
      collector.on('collect', async btn => {
        try { await btn.deferUpdate(); } catch (e) { return; }
        if (btn.user.id !== userId) return;
        if (btn.customId === 'farm_expand_confirm') {
          data.coins -= nextTier.cost;
          data.maxPlots = nextTier.plots;
          while (data.plots.length < data.maxPlots) data.plots.push(null);
          client.memory.set(key, data);
          await msg.edit({ embeds: [new EmbedBuilder().setColor('#00ff00').setTitle('✅ Farm Expanded!').setDescription(`Your farm now has **${nextTier.plots} plots**!`).addFields({ name: '💰 Balance', value: data.coins.toLocaleString(), inline: true })], components: [] }).catch(() => {});
        } else {
          await msg.edit({ components: [] }).catch(() => {});
        }
      });
      collector.on('end', () => { msg.edit({ components: [] }).catch(() => {}); });
      return;
    }

    // ── CRAFT ─────────────────────────────────────────────
    if (sub === 'craft') {
      const fertId = interaction.options.getString('type');
      const fert = FERTILIZERS.find(f => f.id === fertId);
      if (!fert) return interaction.editReply('❌ Unknown fertilizer!');

      const recipes = {
        basic:    { crops: [{ id: 'wheat', qty: 10 }, { id: 'carrot', qty: 5 }], label: '10x Wheat + 5x Carrot' },
        super:    { crops: [{ id: 'strawberry', qty: 5 }, { id: 'corn', qty: 8 }], label: '5x Strawberry + 8x Corn' },
        yield:    { crops: [{ id: 'pumpkin', qty: 4 }, { id: 'watermelon', qty: 3 }], label: '4x Pumpkin + 3x Watermelon' },
        mutation: { crops: [{ id: 'moonflower', qty: 2 }, { id: 'gloomshroom', qty: 2 }], label: '2x Moonflower + 2x Gloomshroom' },
        rainbow:  { crops: [{ id: 'dragonfruit', qty: 3 }, { id: 'starberry', qty: 2 }], label: '3x Dragonfruit + 2x Starberry' },
      };

      const recipe = recipes[fertId];
      if (!recipe) return interaction.editReply('❌ No recipe for this fertilizer!');

      for (const req of recipe.crops) {
        if ((data.inventory[req.id] || 0) < req.qty) {
          return interaction.editReply(`❌ Need **${req.qty}x** ${CROPS.find(c=>c.id===req.id)?.name} but only have **${data.inventory[req.id]||0}**.`);
        }
      }

      for (const req of recipe.crops) { data.inventory[req.id] -= req.qty; if (data.inventory[req.id] <= 0) delete data.inventory[req.id]; }
      data.fertilizers[fertId]++;
      client.memory.set(key, data);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#2d8a3e').setTitle(`✅ Crafted ${fert.name}!`).setDescription(`Used: **${recipe.label}**`).addFields({ name: '🧪 You now have', value: `${data.fertilizers[fertId]}x ${fert.name}`, inline: true })] });
    }
  }
};
