const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const OWNER_ID = '902685494247325776';
function isMod(interaction) {
  return interaction.member &&
    (interaction.member.permissions.has('KickMembers') ||
     interaction.member.permissions.has('BanMembers'));
}

// ── CROPS ──────────────────────────────────────────────────────────────────
// growTime in milliseconds. sellValue is farm coins earned on sell.
// special: optional effect description shown in view
const CROPS = [
  {
    id: 'corn',
    name: '🌽 Corn',
    seedCost: 20,
    growTime: 5 * 60 * 1000,       // 5 minutes
    sellValue: 40,
    rarity: 'Common',
    special: null
  },
  {
    id: 'strawberry',
    name: '🍓 Strawberry',
    seedCost: 50,
    growTime: 15 * 60 * 1000,      // 15 minutes
    sellValue: 120,
    rarity: 'Uncommon',
    special: null
  },
  {
    id: 'moonflower',
    name: '🌸 Moonflower',
    seedCost: 120,
    growTime: 30 * 60 * 1000,      // 30 minutes
    sellValue: 300,
    rarity: 'Rare',
    special: '✨ Restores 20 HP when harvested (if in dungeon)'
  },
  {
    id: 'gloomshroom',
    name: '🍄 Gloomshroom',
    seedCost: 200,
    growTime: 60 * 60 * 1000,      // 1 hour
    sellValue: 500,
    rarity: 'Rare',
    special: '🌑 Grants +50 dungeon gold bonus on next dungeon room'
  },
  {
    id: 'crystal',
    name: '💎 Crystal Seed',
    seedCost: 500,
    growTime: 3 * 60 * 60 * 1000,  // 3 hours
    sellValue: 1500,
    rarity: 'Legendary',
    special: '👑 Huge sell value — the rarest crop in the land'
  },
];

const PLOT_COUNT = 5; // each player has 5 plots

function getFrogMultiplier(client, guildId, userId) {
  // Check if frog pet is active — speeds up grow time by 25%
  const petData = client.memory.get(`pets_${guildId}_${userId}`);
  if (!petData || !petData.active) return 1;
  return petData.active.includes('frog') ? 0.75 : 1;
}

function getDefaultFarmData() {
  return {
    coins: 100, // start with 100 farm coins
    plots: Array(PLOT_COUNT).fill(null),
    // Each plot when planted: { cropId, plantedAt, watered: false }
  };
}

function migrateFarmData(data) {
  if (!data.coins && data.coins !== 0) data.coins = 100;
  if (!data.plots) data.plots = Array(PLOT_COUNT).fill(null);
  while (data.plots.length < PLOT_COUNT) data.plots.push(null);
  return data;
}

function getGrowProgress(plot, frogMultiplier) {
  if (!plot) return null;
  const crop = CROPS.find(c => c.id === plot.cropId);
  if (!crop) return null;
  const adjustedGrowTime = crop.growTime * frogMultiplier;
  const now = Date.now();
  const elapsed = now - plot.plantedAt;
  const pct = Math.min(1, elapsed / adjustedGrowTime);
  const ready = pct >= 1;
  const remaining = Math.max(0, adjustedGrowTime - elapsed);
  return { crop, pct, ready, remaining, watered: plot.watered };
}

function formatTime(ms) {
  if (ms <= 0) return 'Ready!';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function buildFarmEmbed(data, client, guildId, userId, username) {
  const frogMult = getFrogMultiplier(client, guildId, userId);
  const hasFrog = frogMult < 1;

  const plotLines = data.plots.map((plot, i) => {
    if (!plot) return `**Plot ${i + 1}:** 🟫 Empty`;
    const progress = getGrowProgress(plot, frogMult);
    if (!progress) return `**Plot ${i + 1}:** ❓ Unknown`;
    const bar = buildGrowBar(progress.pct);
    const waterNote = progress.watered ? ' 💧 Watered' : '';
    if (progress.ready) {
      return `**Plot ${i + 1}:** ${progress.crop.name} — ✅ **READY TO HARVEST!**${waterNote}`;
    }
    return `**Plot ${i + 1}:** ${progress.crop.name} — ${bar} ${Math.floor(progress.pct * 100)}% (${formatTime(progress.remaining)})${waterNote}`;
  });

  return new EmbedBuilder()
    .setColor('#4caf50')
    .setTitle(`🌾 ${username}'s Farm`)
    .setDescription(plotLines.join('\n'))
    .addFields(
      { name: '🌾 Farm Coins', value: `${data.coins}`, inline: true },
      { name: '🐸 Frog Boost', value: hasFrog ? '✅ 25% faster growth' : 'None', inline: true }
    )
    .setFooter({ text: 'Use /farm plant, /farm water, /farm harvest, /farm sell' });
}

function buildGrowBar(pct) {
  const filled = Math.round(pct * 8);
  return '🟩'.repeat(filled) + '🟫'.repeat(8 - filled);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('farm')
    .setDescription('Plant, grow and harvest crops for farm coins')
    .addSubcommand(sub => sub.setName('view').setDescription('View your farm plots'))
    .addSubcommand(sub =>
      sub.setName('plant')
        .setDescription('Plant a seed in an empty plot')
        .addIntegerOption(opt =>
          opt.setName('plot').setDescription('Plot number (1-5)').setRequired(true).setMinValue(1).setMaxValue(5)
        )
        .addStringOption(opt =>
          opt.setName('crop').setDescription('Which crop to plant').setRequired(true)
            .addChoices(
              { name: '🌽 Corn (20c, 5min)',           value: 'corn'        },
              { name: '🍓 Strawberry (50c, 15min)',     value: 'strawberry'  },
              { name: '🌸 Moonflower (120c, 30min)',    value: 'moonflower'  },
              { name: '🍄 Gloomshroom (200c, 1hr)',     value: 'gloomshroom' },
              { name: '💎 Crystal Seed (500c, 3hr)',    value: 'crystal'     }
            )
        )
    )
    .addSubcommand(sub =>
      sub.setName('water')
        .setDescription('Water a plot to boost its sell value by 20%')
        .addIntegerOption(opt =>
          opt.setName('plot').setDescription('Plot number (1-5)').setRequired(true).setMinValue(1).setMaxValue(5)
        )
    )
    .addSubcommand(sub =>
      sub.setName('harvest')
        .setDescription('Harvest a ready crop into your inventory')
        .addIntegerOption(opt =>
          opt.setName('plot').setDescription('Plot number (1-5) or leave blank to harvest all').setRequired(false).setMinValue(1).setMaxValue(5)
        )
    )
    .addSubcommand(sub =>
      sub.setName('sell')
        .setDescription('Sell harvested crops for farm coins')
    )
    .addSubcommand(sub => sub.setName('shop').setDescription('Buy seeds with farm coins'))
    .addSubcommand(sub => sub.setName('reset').setDescription('Reset your farm data'))
    .addSubcommand(sub =>
      sub.setName('give')
        .setDescription('(Owner/Mod) Give farm coins to a user')
        .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
        .addIntegerOption(opt => opt.setName('amount').setDescription('Amount of farm coins').setRequired(true).setMinValue(1))
    ),

  async execute(interaction, client) {
    try {
      await interaction.deferReply({ ephemeral: false });
    } catch (err) {
      console.error('Farm defer failed:', err);
      return interaction.reply({ content: 'Failed to start.', ephemeral: true }).catch(() => {});
    }

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
      const tKey = `farm_${guildId}_${target.id}`;
      let tData = client.memory.get(tKey) || getDefaultFarmData();
      tData = migrateFarmData(tData);
      tData.coins += amount;
      client.memory.set(tKey, tData);
      return interaction.editReply(`✅ Gave **${amount} farm coins** to **${target.username}**! They now have **${tData.coins}c**.`);
    }

    // ── RESET ──────────────────────────────────────────────
    if (sub === 'reset') {
      client.memory.delete(key);
      return interaction.editReply('✅ Farm data fully reset. Plots cleared, coins back to 100!');
    }

    // ── GIVE (owner + mod)
    if (sub === 'give') {
      if (userId !== OWNER_ID && !isMod(interaction)) {
        return interaction.editReply('❌ You need to be a moderator or the bot owner to use this command.');
      }
      const target = interaction.options.getUser('user');
      const amount = interaction.options.getInteger('amount');
      const tKey = `farm_${guildId}_${target.id}`;
      let tData = client.memory.get(tKey) || getDefaultFarmData();
      tData = migrateFarmData(tData);
      tData.coins += amount;
      client.memory.set(tKey, tData);
      return interaction.editReply(`✅ Gave **${amount} farm coins** to **${target.username}**! They now have **${tData.coins}c**.`);
    }

    // ── RESET
    if (sub === 'reset') {
      client.memory.delete(key);
      return interaction.editReply('✅ Farm data fully reset! You start fresh with 100 farm coins.');
    }

    // ── GIVE (owner + mod)
    if (sub === 'give') {
      if (userId !== OWNER_ID && !isMod(interaction)) {
        return interaction.editReply('❌ You need to be a moderator or the bot owner to use this command.');
      }
      const target = interaction.options.getUser('user');
      const amount = interaction.options.getInteger('amount');
      const tKey = `farm_${guildId}_${target.id}`;
      let tData = client.memory.get(tKey) || getDefaultFarmData();
      tData = migrateFarmData(tData);
      tData.coins += amount;
      client.memory.set(tKey, tData);
      return interaction.editReply(`✅ Gave **${amount} farm coins** to **${target.username}**! They now have **${tData.coins}c**.`);
    }

    // ── RESET
    if (sub === 'reset') {
      client.memory.delete(key);
      return interaction.editReply('✅ Farm data fully reset! You start fresh with 100 farm coins.');
    }

    // ── VIEW ───────────────────────────────────────────────
    if (sub === 'view') {
      const embed = buildFarmEmbed(data, client, guildId, userId, username);

      // Quick harvest-all button if anything is ready
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

        data.plots = data.plots.map((plot, i) => {
          if (!plot) return null;
          const prog = getGrowProgress(plot, frogM);
          if (prog && prog.ready) {
            harvested.push({ cropId: plot.cropId, watered: plot.watered });
            return null;
          }
          return plot;
        });

        if (!data.harvest) data.harvest = {};
        for (const h of harvested) {
          data.harvest[h.cropId] = (data.harvest[h.cropId] || 0) + 1;
          if (h.watered) data.harvest[`${h.cropId}_watered`] = (data.harvest[`${h.cropId}_watered`] || 0) + 1;
        }

        client.memory.set(key, data);

        // Apply Moonflower dungeon HP effect
        const moonCount = harvested.filter(h => h.cropId === 'moonflower').length;
        if (moonCount > 0) {
          const dungeonKey = `dungeon_${guildId}_${userId}`;
          const dungeonData = client.memory.get(dungeonKey);
          if (dungeonData && dungeonData.inDungeon) {
            dungeonData.hp = Math.min(100, dungeonData.hp + (20 * moonCount));
            client.memory.set(dungeonKey, dungeonData);
          }
        }

        // Apply Gloomshroom dungeon bonus
        const gloomCount = harvested.filter(h => h.cropId === 'gloomshroom').length;
        if (gloomCount > 0) {
          const dungeonKey = `dungeon_${guildId}_${userId}`;
          const dungeonData = client.memory.get(dungeonKey);
          if (dungeonData) {
            dungeonData.gloomshroomBonus = (dungeonData.gloomshroomBonus || 0) + (50 * gloomCount);
            client.memory.set(dungeonKey, dungeonData);
          }
        }

        const harvestSummary = harvested.map(h => {
          const c = CROPS.find(x => x.id === h.cropId);
          return c ? c.name : h.cropId;
        }).join(', ');

        await btn.followUp({
          content: `🌾 Harvested: **${harvestSummary}**!\nUse \`/farm sell\` to sell them for farm coins.${moonCount > 0 ? `\n✨ Moonflower healed you **+${20 * moonCount} HP** in dungeon!` : ''}${gloomCount > 0 ? `\n🍄 Gloomshroom granted **+${50 * gloomCount} dungeon gold bonus!**` : ''}`,
          ephemeral: true
        }).catch(() => {});

        collector.stop();
      });

      collector.on('end', () => { viewMsg.edit({ components: [] }).catch(() => {}); });
      return;
    }

    // ── SHOP ───────────────────────────────────────────────
    if (sub === 'shop') {
      const cropLines = CROPS.map(c => `${c.name} — **${c.seedCost}c** seed — sells for **${c.sellValue}c** — *(${c.rarity})*${c.special ? `\n  └ ${c.special}` : ''}`);
      const embed = new EmbedBuilder()
        .setColor('#4caf50')
        .setTitle('🏪 Farm Shop — Seeds')
        .setDescription(cropLines.join('\n\n'))
        .addFields({ name: '🌾 Your Farm Coins', value: `${data.coins}`, inline: true })
        .setFooter({ text: 'Use /farm plant <plot> <crop> to plant a seed' });

      const row1 = new ActionRowBuilder().addComponents(
        CROPS.slice(0, 5).map(c =>
          new ButtonBuilder()
            .setCustomId(`farmshop_${c.id}`)
            .setLabel(`Buy ${c.name.split(' ')[1]} (${c.seedCost}c)`)
            .setStyle(c.rarity === 'Legendary' ? ButtonStyle.Danger : c.rarity === 'Rare' ? ButtonStyle.Primary : ButtonStyle.Success)
        )
      );

      await interaction.editReply({ embeds: [embed], components: [row1] });
      const shopMsg = await interaction.fetchReply();
      const collector = shopMsg.createMessageComponentCollector({ time: 30000 });

      collector.on('collect', async btn => {
        try { await btn.deferUpdate(); } catch (e) { return; }
        if (btn.user.id !== userId) return;

        data = client.memory.get(key) || data;
        const cropId = btn.customId.replace('farmshop_', '');
        const crop = CROPS.find(c => c.id === cropId);
        if (!crop) return;

        if (data.coins < crop.seedCost) {
          return btn.followUp({ content: `❌ Need **${crop.seedCost}c**, you have **${data.coins}c**.`, ephemeral: true }).catch(() => {});
        }

        data.coins -= crop.seedCost;
        if (!data.seeds) data.seeds = {};
        data.seeds[cropId] = (data.seeds[cropId] || 0) + 1;
        client.memory.set(key, data);

        await btn.followUp({
          content: `✅ Bought a **${crop.name}** seed! (${data.seeds[cropId]} in bag)\n🌾 Farm coins left: **${data.coins}**\nUse \`/farm plant <plot> ${cropId}\` to plant it.`,
          ephemeral: true
        }).catch(() => {});
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

      if (data.plots[plotNum]) {
        return interaction.editReply(`❌ Plot ${plotNum + 1} is already occupied! Harvest it first.`);
      }

      // Check if they have seed in bag or auto-buy
      if (!data.seeds) data.seeds = {};
      if ((data.seeds[cropId] || 0) <= 0) {
        // Auto-buy seed if they have coins
        if (data.coins < crop.seedCost) {
          return interaction.editReply(`❌ You have no **${crop.name}** seeds and not enough coins to buy one.\nNeed **${crop.seedCost}c**, you have **${data.coins}c**.\nVisit \`/farm shop\` to buy seeds.`);
        }
        data.coins -= crop.seedCost;
      } else {
        data.seeds[cropId]--;
      }

      const frogMult = getFrogMultiplier(client, guildId, userId);
      const adjustedTime = crop.growTime * frogMult;

      data.plots[plotNum] = { cropId, plantedAt: Date.now(), watered: false };
      client.memory.set(key, data);

      const readyAt = new Date(Date.now() + adjustedTime);
      const timeStr = formatTime(adjustedTime);

      return interaction.editReply(
        `🌱 Planted **${crop.name}** in Plot ${plotNum + 1}!\n` +
        `⏱️ Ready in **${timeStr}**${frogMult < 1 ? ' *(🐸 Frog boost applied!)*' : ''}\n` +
        `💡 Water it with \`/farm water ${plotNum + 1}\` for a 20% sell bonus!`
      );
    }

    // ── WATER ──────────────────────────────────────────────
    if (sub === 'water') {
      const plotNum = interaction.options.getInteger('plot') - 1;
      const plot = data.plots[plotNum];

      if (!plot) return interaction.editReply(`❌ Plot ${plotNum + 1} is empty!`);
      if (plot.watered) return interaction.editReply(`💧 Plot ${plotNum + 1} is already watered!`);

      const frogMult = getFrogMultiplier(client, guildId, userId);
      const progress = getGrowProgress(plot, frogMult);
      if (progress?.ready) return interaction.editReply(`✅ Plot ${plotNum + 1} is already ready to harvest!`);

      data.plots[plotNum].watered = true;
      client.memory.set(key, data);

      const crop = CROPS.find(c => c.id === plot.cropId);
      return interaction.editReply(
        `💧 Watered **${crop?.name}** in Plot ${plotNum + 1}!\n` +
        `📈 Sell value boosted by **20%** when harvested!`
      );
    }

    // ── HARVEST ────────────────────────────────────────────
    if (sub === 'harvest') {
      const plotNum = interaction.options.getInteger('plot');
      const frogMult = getFrogMultiplier(client, guildId, userId);
      if (!data.harvest) data.harvest = {};
      if (!data.seeds) data.seeds = {};

      let harvested = [];

      if (plotNum !== null) {
        // Harvest specific plot
        const idx = plotNum - 1;
        const plot = data.plots[idx];
        if (!plot) return interaction.editReply(`❌ Plot ${plotNum} is empty!`);
        const prog = getGrowProgress(plot, frogMult);
        if (!prog?.ready) {
          return interaction.editReply(`⏱️ Plot ${plotNum} isn't ready yet! (${formatTime(prog?.remaining || 0)} left)`);
        }
        harvested.push({ cropId: plot.cropId, watered: plot.watered });
        data.plots[idx] = null;
      } else {
        // Harvest all ready plots
        data.plots = data.plots.map(plot => {
          if (!plot) return null;
          const prog = getGrowProgress(plot, frogMult);
          if (prog?.ready) {
            harvested.push({ cropId: plot.cropId, watered: plot.watered });
            return null;
          }
          return plot;
        });
      }

      if (harvested.length === 0) {
        return interaction.editReply('⏱️ Nothing is ready to harvest yet! Check `/farm view` for timers.');
      }

      for (const h of harvested) {
        data.harvest[h.cropId] = (data.harvest[h.cropId] || 0) + 1;
        if (h.watered) data.harvest[`${h.cropId}_watered`] = (data.harvest[`${h.cropId}_watered`] || 0) + 1;
      }

      client.memory.set(key, data);

      // Special effects
      const moonCount = harvested.filter(h => h.cropId === 'moonflower').length;
      if (moonCount > 0) {
        const dungeonKey = `dungeon_${guildId}_${userId}`;
        const dungeonData = client.memory.get(dungeonKey);
        if (dungeonData && dungeonData.inDungeon) {
          dungeonData.hp = Math.min(100, dungeonData.hp + (20 * moonCount));
          client.memory.set(dungeonKey, dungeonData);
        }
      }
      const gloomCount = harvested.filter(h => h.cropId === 'gloomshroom').length;
      if (gloomCount > 0) {
        const dungeonKey = `dungeon_${guildId}_${userId}`;
        const dungeonData = client.memory.get(dungeonKey);
        if (dungeonData) {
          dungeonData.gloomshroomBonus = (dungeonData.gloomshroomBonus || 0) + (50 * gloomCount);
          client.memory.set(dungeonKey, dungeonData);
        }
      }

      const summary = harvested.map(h => CROPS.find(c => c.id === h.cropId)?.name || h.cropId).join(', ');
      return interaction.editReply(
        `🌾 Harvested: **${summary}**!\n` +
        `Use \`/farm sell\` to sell them for farm coins.` +
        (moonCount > 0 ? `\n✨ Moonflower healed **+${20 * moonCount} HP** in dungeon!` : '') +
        (gloomCount > 0 ? `\n🍄 Gloomshroom granted **+${50 * gloomCount} dungeon gold bonus!**` : '')
      );
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

        const normalEarnings = normalCount * crop.sellValue;
        const wateredEarnings = Math.floor(wateredCount * crop.sellValue * 1.2);
        const total = normalEarnings + wateredEarnings;
        totalEarned += total;

        if (wateredCount > 0) {
          sellLines.push(`${crop.name} x${count} — **${total}c** *(${wateredCount} watered +20%)*`);
        } else {
          sellLines.push(`${crop.name} x${count} — **${total}c**`);
        }
      }

      data.coins += totalEarned;
      data.harvest = {};
      client.memory.set(key, data);

      const embed = new EmbedBuilder()
        .setColor('#4caf50')
        .setTitle('💰 Crops Sold!')
        .setDescription(sellLines.join('\n'))
        .addFields(
          { name: '🌾 Total Earned', value: `**${totalEarned}c**`, inline: true },
          { name: '🌾 Farm Coins',   value: `${data.coins}c`,      inline: true }
        );

      return interaction.editReply({ embeds: [embed] });
    }
  }
};
// PATCH — this file needs reset and give subcommands added
// The following is appended to the existing farm.js exports
