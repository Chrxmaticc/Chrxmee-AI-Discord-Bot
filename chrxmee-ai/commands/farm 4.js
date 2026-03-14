const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const OWNER_ID = '902685494247325776';

function isMod(interaction) {
  return interaction.member &&
    (interaction.member.permissions.has('KickMembers') ||
     interaction.member.permissions.has('BanMembers'));
}

const CROPS = [
  { id: 'corn',        name: '🌽 Corn',         seedCost: 20,  growTime: 5 * 60 * 1000,        sellValue: 40,   rarity: 'Common',    special: null },
  { id: 'strawberry',  name: '🍓 Strawberry',   seedCost: 50,  growTime: 15 * 60 * 1000,       sellValue: 120,  rarity: 'Uncommon',  special: null },
  { id: 'moonflower',  name: '🌸 Moonflower',   seedCost: 120, growTime: 30 * 60 * 1000,       sellValue: 300,  rarity: 'Rare',      special: '✨ Restores 20 HP when harvested (if in dungeon)' },
  { id: 'gloomshroom', name: '🍄 Gloomshroom',  seedCost: 200, growTime: 60 * 60 * 1000,       sellValue: 500,  rarity: 'Rare',      special: '🌑 Grants +50 dungeon gold bonus on next room' },
  { id: 'crystal',     name: '💎 Crystal Seed', seedCost: 500, growTime: 3 * 60 * 60 * 1000,   sellValue: 1500, rarity: 'Legendary', special: '👑 Huge sell value — rarest crop in the land' },
];

const PLOT_COUNT = 5;

function getFrogMultiplier(client, guildId, userId) {
  const petData = client.memory.get(`pets_${guildId}_${userId}`);
  if (!petData || !petData.active) return 1;
  return petData.active.includes('frog') ? 0.75 : 1;
}

function getDefaultFarmData() {
  return { coins: 100, plots: Array(PLOT_COUNT).fill(null), seeds: {}, harvest: {} };
}

function migrateFarmData(data) {
  if (!data.coins && data.coins !== 0) data.coins = 100;
  if (!data.plots) data.plots = Array(PLOT_COUNT).fill(null);
  while (data.plots.length < PLOT_COUNT) data.plots.push(null);
  if (!data.seeds) data.seeds = {};
  if (!data.harvest) data.harvest = {};
  return data;
}

function getGrowProgress(plot, frogMultiplier) {
  if (!plot) return null;
  const crop = CROPS.find(c => c.id === plot.cropId);
  if (!crop) return null;
  const adjustedGrowTime = crop.growTime * frogMultiplier;
  const elapsed = Date.now() - plot.plantedAt;
  const pct = Math.min(1, elapsed / adjustedGrowTime);
  return { crop, pct, ready: pct >= 1, remaining: Math.max(0, adjustedGrowTime - elapsed), watered: plot.watered };
}

function formatTime(ms) {
  if (ms <= 0) return 'Ready!';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function buildGrowBar(pct) {
  const filled = Math.round(pct * 8);
  return '🟩'.repeat(filled) + '🟫'.repeat(8 - filled);
}

function buildFarmEmbed(data, client, guildId, userId, username) {
  const frogMult = getFrogMultiplier(client, guildId, userId);
  const hasFrog = frogMult < 1;
  const plotLines = data.plots.map((plot, i) => {
    if (!plot) return `**Plot ${i + 1}:** 🟫 Empty`;
    const progress = getGrowProgress(plot, frogMult);
    if (!progress) return `**Plot ${i + 1}:** ❓ Unknown`;
    const bar = buildGrowBar(progress.pct);
    const waterNote = progress.watered ? ' 💧' : '';
    if (progress.ready) return `**Plot ${i + 1}:** ${progress.crop.name} — ✅ **READY!**${waterNote}`;
    return `**Plot ${i + 1}:** ${progress.crop.name} — ${bar} ${Math.floor(progress.pct * 100)}% (${formatTime(progress.remaining)})${waterNote}`;
  });
  return new EmbedBuilder()
    .setColor('#4caf50')
    .setTitle(`🌾 ${username}'s Farm`)
    .setDescription(plotLines.join('\n'))
    .addFields(
      { name: '🌾 Farm Coins', value: `${data.coins}`, inline: true },
      { name: '🐸 Frog Boost', value: hasFrog ? '✅ 25% faster' : 'None', inline: true }
    )
    .setFooter({ text: '/farm plant | /farm water | /farm harvest | /farm sell | /farm shop' });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('farm')
    .setDescription('Plant, grow and harvest crops for farm coins')
    .addSubcommand(sub => sub.setName('view').setDescription('View your farm plots'))
    .addSubcommand(sub =>
      sub.setName('plant')
        .setDescription('Plant a seed in an empty plot')
        .addIntegerOption(opt => opt.setName('plot').setDescription('Plot number (1-5)').setRequired(true).setMinValue(1).setMaxValue(5))
        .addStringOption(opt =>
          opt.setName('crop').setDescription('Which crop to plant').setRequired(true)
            .addChoices(
              { name: '🌽 Corn (20c, 5min)',          value: 'corn'        },
              { name: '🍓 Strawberry (50c, 15min)',    value: 'strawberry'  },
              { name: '🌸 Moonflower (120c, 30min)',   value: 'moonflower'  },
              { name: '🍄 Gloomshroom (200c, 1hr)',    value: 'gloomshroom' },
              { name: '💎 Crystal Seed (500c, 3hr)',   value: 'crystal'     }
            )
        )
    )
    .addSubcommand(sub =>
      sub.setName('water')
        .setDescription('Water a plot for +20% sell value')
        .addIntegerOption(opt => opt.setName('plot').setDescription('Plot number (1-5)').setRequired(true).setMinValue(1).setMaxValue(5))
    )
    .addSubcommand(sub =>
      sub.setName('harvest')
        .setDescription('Harvest ready crops')
        .addIntegerOption(opt => opt.setName('plot').setDescription('Specific plot (leave blank = harvest all)').setRequired(false).setMinValue(1).setMaxValue(5))
    )
    .addSubcommand(sub => sub.setName('sell').setDescription('Sell harvested crops for farm coins'))
    .addSubcommand(sub => sub.setName('shop').setDescription('Buy seeds with farm coins'))
    .addSubcommand(sub => sub.setName('reset').setDescription('Reset all your farm data'))
    .addSubcommand(sub =>
      sub.setName('give')
        .setDescription('(Owner/Mod) Give farm coins to a user')
        .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
        .addIntegerOption(opt => opt.setName('amount').setDescription('Amount of farm coins').setRequired(true).setMinValue(1))
    ),

  async execute(interaction, client) {
    try { await interaction.deferReply({ ephemeral: false }); }
    catch (err) { return interaction.reply({ content: 'Failed to start.', ephemeral: true }).catch(() => {}); }

    const userId = interaction.user.id;
    const guildId = interaction.guild.id;
    const username = interaction.user.username;
    const key = `farm_${guildId}_${userId}`;

    let data = client.memory.get(key) || getDefaultFarmData();
    data = migrateFarmData(data);

    const sub = interaction.options.getSubcommand();

    // ── GIVE (owner + mod) ─────────────────────────────────
    if (sub === 'give') {
      if (userId !== OWNER_ID && !isMod(interaction)) return interaction.editReply('❌ You need to be a moderator or the bot owner.');
      const target = interaction.options.getUser('user');
      const amount = interaction.options.getInteger('amount');
      const MOD_CAP = 5000;
      const isOwnerGive = userId === OWNER_ID;
      if (!isOwnerGive && amount > MOD_CAP) {
        return interaction.editReply(`❌ Moderators can only give up to **${MOD_CAP} farm coins** at a time. Ask the bot owner for more.`);
      }
      const tKey = `farm_${guildId}_${target.id}`;
      let tData = client.memory.get(tKey) || getDefaultFarmData();
      tData = migrateFarmData(tData);
      tData.coins += amount;
      client.memory.set(tKey, tData);
      try {
        const logConfig = client.memory.get(`givelogs_${guildId}`);
        if (logConfig?.enabled && logConfig?.channelId) {
          const logChannel = await client.channels.fetch(logConfig.channelId).catch(() => null);
          if (logChannel) {
            const { EmbedBuilder: LE } = require('discord.js');
            await logChannel.send({ embeds: [new LE()
              .setColor(isOwnerGive ? '#FFD700' : '#2196f3')
              .setTitle(`📋 Give Log — Farm`)
              .addFields(
                { name: '👤 Given by', value: `<@${userId}> (${interaction.user.username})`, inline: true },
                { name: '🎯 Given to', value: `<@${target.id}> (${target.username})`, inline: true },
                { name: '💰 Amount',   value: `${amount} farm coins`, inline: true },
                { name: '🔑 Role',     value: isOwnerGive ? '👑 Owner' : '🛡️ Moderator', inline: true },
                { name: '🕐 Time',     value: new Date().toUTCString(), inline: false }
              )]}).catch(() => {});
          }
        }
      } catch (e) { console.error('give log failed:', e.message); }
      return interaction.editReply(`✅ Gave **${amount} farm coins** to **${target.username}**! They now have **${tData.coins}**.`);
    }
    // ── RESET ──────────────────────────────────────────────
    if (sub === 'reset') {
      client.memory.delete(key);
      return interaction.editReply('✅ Farm fully reset! Plots cleared, coins back to 100.');
    }

    // ── VIEW ───────────────────────────────────────────────
    if (sub === 'view') {
      const embed = buildFarmEmbed(data, client, guildId, userId, username);
      const frogMult = getFrogMultiplier(client, guildId, userId);
      const anyReady = data.plots.some(p => p && getGrowProgress(p, frogMult)?.ready);
      const components = [];
      if (anyReady) {
        components.push(new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('farm_harvest_all').setLabel('🌾 Harvest All Ready').setStyle(ButtonStyle.Success)
        ));
      }
      await interaction.editReply({ embeds: [embed], components });
      if (!anyReady) return;
      const viewMsg = await interaction.fetchReply();
      const collector = viewMsg.createMessageComponentCollector({ time: 30000 });
      collector.on('collect', async btn => {
        try { await btn.deferUpdate(); } catch (e) { return; }
        if (btn.user.id !== userId) return;
        data = client.memory.get(key) || data;
        const frogM = getFrogMultiplier(client, guildId, userId);
        let harvested = [];
        data.plots = data.plots.map(plot => {
          if (!plot) return null;
          const prog = getGrowProgress(plot, frogM);
          if (prog?.ready) { harvested.push({ cropId: plot.cropId, watered: plot.watered }); return null; }
          return plot;
        });
        if (!data.harvest) data.harvest = {};
        for (const h of harvested) {
          data.harvest[h.cropId] = (data.harvest[h.cropId] || 0) + 1;
          if (h.watered) data.harvest[`${h.cropId}_watered`] = (data.harvest[`${h.cropId}_watered`] || 0) + 1;
        }
        applySpecialEffects(harvested, client, guildId, userId);
        client.memory.set(key, data);
        const moonCount = harvested.filter(h => h.cropId === 'moonflower').length;
        const gloomCount = harvested.filter(h => h.cropId === 'gloomshroom').length;
        const summary = harvested.map(h => CROPS.find(c => c.id === h.cropId)?.name || h.cropId).join(', ');
        await btn.followUp({ content: `🌾 Harvested: **${summary}**!\nUse \`/farm sell\` to cash in.${moonCount > 0 ? `\n✨ Moonflower healed **+${20 * moonCount} HP**!` : ''}${gloomCount > 0 ? `\n🍄 Gloomshroom granted **+${50 * gloomCount} dungeon gold bonus!**` : ''}`, ephemeral: true }).catch(() => {});
        collector.stop();
      });
      collector.on('end', () => { viewMsg.edit({ components: [] }).catch(() => {}); });
      return;
    }

    // ── SHOP ───────────────────────────────────────────────
    if (sub === 'shop') {
      const cropLines = CROPS.map(c => `${c.name} — **${c.seedCost}c** — sells **${c.sellValue}c** *(${c.rarity})*${c.special ? `\n  └ ${c.special}` : ''}`);
      const embed = new EmbedBuilder()
        .setColor('#4caf50')
        .setTitle('🏪 Farm Shop — Seeds')
        .setDescription(cropLines.join('\n\n'))
        .addFields({ name: '🌾 Your Farm Coins', value: `${data.coins}`, inline: true });
      const row = new ActionRowBuilder().addComponents(
        CROPS.map(c => new ButtonBuilder()
          .setCustomId(`farmshop_${c.id}`)
          .setLabel(`Buy ${c.name.split(' ')[1]} (${c.seedCost}c)`)
          .setStyle(c.rarity === 'Legendary' ? ButtonStyle.Danger : c.rarity === 'Rare' ? ButtonStyle.Primary : ButtonStyle.Success)
        )
      );
      await interaction.editReply({ embeds: [embed], components: [row] });
      const shopMsg = await interaction.fetchReply();
      const collector = shopMsg.createMessageComponentCollector({ time: 30000 });
      collector.on('collect', async btn => {
        try { await btn.deferUpdate(); } catch (e) { return; }
        if (btn.user.id !== userId) return;
        data = client.memory.get(key) || data;
        const cropId = btn.customId.replace('farmshop_', '');
        const crop = CROPS.find(c => c.id === cropId);
        if (!crop) return;
        if (data.coins < crop.seedCost) return btn.followUp({ content: `❌ Need **${crop.seedCost}c**, you have **${data.coins}c**.`, ephemeral: true }).catch(() => {});
        data.coins -= crop.seedCost;
        if (!data.seeds) data.seeds = {};
        data.seeds[cropId] = (data.seeds[cropId] || 0) + 1;
        client.memory.set(key, data);
        await btn.followUp({ content: `✅ Bought a **${crop.name}** seed! (${data.seeds[cropId]} in bag)\n🌾 Coins left: **${data.coins}**`, ephemeral: true }).catch(() => {});
      });
      collector.on('end', () => { shopMsg.edit({ components: [] }).catch(() => {}); });
      return;
    }

    // ── PLANT ──────────────────────────────────────────────
    if (sub === 'plant') {
      const plotNum = interaction.options.getInteger('plot') - 1;
      const cropId = interaction.options.getString('crop');
      const crop = CROPS.find(c => c.id === cropId);
      if (!crop) return interaction.editReply('❌ Unknown crop.');
      if (data.plots[plotNum]) return interaction.editReply(`❌ Plot ${plotNum + 1} is occupied! Harvest it first.`);
      if (!data.seeds) data.seeds = {};
      if ((data.seeds[cropId] || 0) <= 0) {
        if (data.coins < crop.seedCost) return interaction.editReply(`❌ No seeds and not enough coins. Need **${crop.seedCost}c**, have **${data.coins}c**.`);
        data.coins -= crop.seedCost;
      } else {
        data.seeds[cropId]--;
      }
      const frogMult = getFrogMultiplier(client, guildId, userId);
      const adjustedTime = crop.growTime * frogMult;
      data.plots[plotNum] = { cropId, plantedAt: Date.now(), watered: false };
      client.memory.set(key, data);
      return interaction.editReply(`🌱 Planted **${crop.name}** in Plot ${plotNum + 1}!\n⏱️ Ready in **${formatTime(adjustedTime)}**${frogMult < 1 ? ' *(🐸 Frog boost!)*' : ''}\n💡 Use \`/farm water ${plotNum + 1}\` for +20% sell bonus!`);
    }

    // ── WATER ──────────────────────────────────────────────
    if (sub === 'water') {
      const plotNum = interaction.options.getInteger('plot') - 1;
      const plot = data.plots[plotNum];
      if (!plot) return interaction.editReply(`❌ Plot ${plotNum + 1} is empty!`);
      if (plot.watered) return interaction.editReply(`💧 Plot ${plotNum + 1} is already watered!`);
      const frogMult = getFrogMultiplier(client, guildId, userId);
      if (getGrowProgress(plot, frogMult)?.ready) return interaction.editReply(`✅ Already ready — just harvest it!`);
      data.plots[plotNum].watered = true;
      client.memory.set(key, data);
      const crop = CROPS.find(c => c.id === plot.cropId);
      return interaction.editReply(`💧 Watered **${crop?.name}** in Plot ${plotNum + 1}! Sell value boosted **+20%**.`);
    }

    // ── HARVEST ────────────────────────────────────────────
    if (sub === 'harvest') {
      const plotNum = interaction.options.getInteger('plot');
      const frogMult = getFrogMultiplier(client, guildId, userId);
      if (!data.harvest) data.harvest = {};
      let harvested = [];
      if (plotNum !== null) {
        const idx = plotNum - 1;
        const plot = data.plots[idx];
        if (!plot) return interaction.editReply(`❌ Plot ${plotNum} is empty!`);
        const prog = getGrowProgress(plot, frogMult);
        if (!prog?.ready) return interaction.editReply(`⏱️ Plot ${plotNum} not ready yet! (${formatTime(prog?.remaining || 0)} left)`);
        harvested.push({ cropId: plot.cropId, watered: plot.watered });
        data.plots[idx] = null;
      } else {
        data.plots = data.plots.map(plot => {
          if (!plot) return null;
          const prog = getGrowProgress(plot, frogMult);
          if (prog?.ready) { harvested.push({ cropId: plot.cropId, watered: plot.watered }); return null; }
          return plot;
        });
      }
      if (harvested.length === 0) return interaction.editReply('⏱️ Nothing ready yet! Check `/farm view`.');
      for (const h of harvested) {
        data.harvest[h.cropId] = (data.harvest[h.cropId] || 0) + 1;
        if (h.watered) data.harvest[`${h.cropId}_watered`] = (data.harvest[`${h.cropId}_watered`] || 0) + 1;
      }
      applySpecialEffects(harvested, client, guildId, userId);
      client.memory.set(key, data);
      const moonCount = harvested.filter(h => h.cropId === 'moonflower').length;
      const gloomCount = harvested.filter(h => h.cropId === 'gloomshroom').length;
      const summary = harvested.map(h => CROPS.find(c => c.id === h.cropId)?.name || h.cropId).join(', ');
      return interaction.editReply(`🌾 Harvested: **${summary}**!\nUse \`/farm sell\` to sell.${moonCount > 0 ? `\n✨ Moonflower healed **+${20 * moonCount} HP** in dungeon!` : ''}${gloomCount > 0 ? `\n🍄 Gloomshroom granted **+${50 * gloomCount} dungeon gold bonus!**` : ''}`);
    }

    // ── SELL ───────────────────────────────────────────────
    if (sub === 'sell') {
      if (!data.harvest || Object.keys(data.harvest).filter(k => !k.includes('_watered')).length === 0) {
        return interaction.editReply('🌾 Nothing to sell! Use `/farm harvest` first.');
      }
      let totalEarned = 0;
      const sellLines = [];
      for (const cropId of Object.keys(data.harvest)) {
        if (cropId.includes('_watered')) continue;
        const count = data.harvest[cropId];
        if (count <= 0) continue;
        const crop = CROPS.find(c => c.id === cropId);
        if (!crop) continue;
        const wateredCount = data.harvest[`${cropId}_watered`] || 0;
        const normalCount = count - wateredCount;
        const total = (normalCount * crop.sellValue) + Math.floor(wateredCount * crop.sellValue * 1.2);
        totalEarned += total;
        sellLines.push(`${crop.name} x${count} — **${total}c**${wateredCount > 0 ? ` *(${wateredCount} watered +20%)*` : ''}`);
      }
      data.coins += totalEarned;
      data.harvest = {};
      client.memory.set(key, data);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#4caf50').setTitle('💰 Crops Sold!').setDescription(sellLines.join('\n')).addFields({ name: '🌾 Total Earned', value: `**${totalEarned}c**`, inline: true }, { name: '🌾 Farm Coins', value: `${data.coins}c`, inline: true })] });
    }
  }
};

function applySpecialEffects(harvested, client, guildId, userId) {
  const moonCount = harvested.filter(h => h.cropId === 'moonflower').length;
  if (moonCount > 0) {
    const dKey = `dungeon_${guildId}_${userId}`;
    const dData = client.memory.get(dKey);
    if (dData?.inDungeon) { dData.hp = Math.min(100, dData.hp + (20 * moonCount)); client.memory.set(dKey, dData); }
  }
  const gloomCount = harvested.filter(h => h.cropId === 'gloomshroom').length;
  if (gloomCount > 0) {
    const dKey = `dungeon_${guildId}_${userId}`;
    const dData = client.memory.get(dKey);
    if (dData) { dData.gloomshroomBonus = (dData.gloomshroomBonus || 0) + (50 * gloomCount); client.memory.set(dKey, dData); }
  }
}
