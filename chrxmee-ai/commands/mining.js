const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// ── PICKAXES ───────────────────────────────────────────────────────────────
// mineBonus: extra rolls per mine click
// caveInResist: reduces cave-in chance (0.0 - 1.0)
const PICKAXES = [
  { id: 'wooden',    name: '🪵 Wooden Pickaxe',    cost: 0,    mineBonus: 0, caveInResist: 0.00, desc: 'Starter pickaxe' },
  { id: 'stone',     name: '🪨 Stone Pickaxe',      cost: 200,  mineBonus: 1, caveInResist: 0.05, desc: '+1 ore roll, -5% cave-in' },
  { id: 'iron',      name: '⚙️ Iron Pickaxe',       cost: 500,  mineBonus: 2, caveInResist: 0.10, desc: '+2 ore rolls, -10% cave-in' },
  { id: 'gold',      name: '🟡 Gold Pickaxe',       cost: 1000, mineBonus: 3, caveInResist: 0.15, desc: '+3 ore rolls, -15% cave-in' },
  { id: 'diamond',   name: '💎 Diamond Pickaxe',    cost: 2500, mineBonus: 4, caveInResist: 0.25, desc: '+4 ore rolls, -25% cave-in' },
  { id: 'netherite', name: '🔱 Netherite Pickaxe',  cost: 5000, mineBonus: 5, caveInResist: 0.40, desc: '+5 ore rolls, -40% cave-in' },
];

// ── ORES ───────────────────────────────────────────────────────────────────
// chance: base probability per roll (0.0 - 1.0), must sum to <= 1.0
// sellValue: mine coins per ore
const ORES = [
  { id: 'stone',     name: '⛏️ Stone',         chance: 0.35, sellValue: 5,    rarity: 'Common'    },
  { id: 'granite',   name: '🪨 Granite',        chance: 0.20, sellValue: 10,   rarity: 'Common'    },
  { id: 'copper',    name: '🟤 Copper Ore',     chance: 0.15, sellValue: 20,   rarity: 'Uncommon'  },
  { id: 'iron',      name: '🪨 Iron Ore',       chance: 0.10, sellValue: 35,   rarity: 'Uncommon'  },
  { id: 'silver',    name: '✨ Silver Ore',     chance: 0.08, sellValue: 60,   rarity: 'Rare'      },
  { id: 'gold',      name: '🟡 Gold Ore',       chance: 0.05, sellValue: 100,  rarity: 'Rare'      },
  { id: 'diamond',   name: '💎 Diamond Ore',    chance: 0.03, sellValue: 250,  rarity: 'Epic'      },
  { id: 'shadow',    name: '💀 Shadowstone',    chance: 0.02, sellValue: 400,  rarity: 'Epic'      },
  { id: 'mana',      name: '🔮 Mana Crystal',   chance: 0.015, sellValue: 600, rarity: 'Legendary' },
  { id: 'celestite', name: '👑 Celestite',      chance: 0.005, sellValue: 1500, rarity: 'Legendary' },
];

// Base cave-in chance per mine click, grows with depth
const BASE_CAVE_IN_CHANCE = 0.08;
const CAVE_IN_GROWTH = 0.04; // +4% per mine click in the same session

function getDefaultMiningData() {
  return {
    coins: 50,
    pickaxe: 'wooden',
    inventory: {},   // { oreId: count }
    session: null,   // active mining session
  };
}

function migrateMiningData(data) {
  if (!data.coins && data.coins !== 0) data.coins = 50;
  if (!data.pickaxe) data.pickaxe = 'wooden';
  if (!data.inventory) data.inventory = {};
  if (!('session' in data)) data.session = null;
  return data;
}

function rollOre() {
  const rand = Math.random();
  let cumulative = 0;
  for (const ore of ORES) {
    cumulative += ore.chance;
    if (rand <= cumulative) return ore;
  }
  return ORES[0]; // fallback to stone
}

function getCaveInChance(session, pickaxe) {
  const resist = pickaxe ? pickaxe.caveInResist : 0;
  const depth = session ? session.clicks : 0;
  return Math.max(0, Math.min(0.95, BASE_CAVE_IN_CHANCE + (depth * CAVE_IN_GROWTH) - resist));
}

function buildMiningEmbed(data, session, username) {
  const pickaxe = PICKAXES.find(p => p.id === data.pickaxe) || PICKAXES[0];
  const caveInChance = session ? getCaveInChance(session, pickaxe) : BASE_CAVE_IN_CHANCE;
  const riskBar = buildRiskBar(caveInChance);

  const inventoryLines = Object.entries(data.inventory)
    .filter(([, count]) => count > 0)
    .map(([id, count]) => {
      const ore = ORES.find(o => o.id === id);
      return ore ? `${ore.name} x${count}` : null;
    }).filter(Boolean);

  const embed = new EmbedBuilder()
    .setColor('#5c3317')
    .setTitle(`⛏️ ${username}'s Mine`)
    .addFields(
      { name: '⛏️ Pickaxe',      value: pickaxe.name,    inline: true },
      { name: '💰 Mine Coins',   value: `${data.coins}`, inline: true },
    );

  if (session) {
    const sessionLines = Object.entries(session.haul)
      .filter(([, count]) => count > 0)
      .map(([id, count]) => {
        const ore = ORES.find(o => o.id === id);
        return ore ? `${ore.name} x${count}` : null;
      }).filter(Boolean);

    embed.addFields(
      { name: '🎯 Session Depth', value: `${session.clicks} clicks deep`, inline: true },
      { name: '⚠️ Cave-In Risk',  value: `${riskBar} ${Math.floor(caveInChance * 100)}%`, inline: false },
      { name: '🪨 Current Haul',  value: sessionLines.length > 0 ? sessionLines.join(', ') : 'Nothing yet', inline: false },
    );
  }

  if (inventoryLines.length > 0) {
    embed.addFields({ name: '🎒 Inventory', value: inventoryLines.join(' | '), inline: false });
  }

  return embed;
}

function buildRiskBar(chance) {
  const filled = Math.round(chance * 10);
  const color = chance < 0.3 ? '🟩' : chance < 0.6 ? '🟨' : '🟥';
  return color.repeat(filled) + '⬛'.repeat(10 - filled);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mining')
    .setDescription('Mine ores, sell them and upgrade your pickaxe')
    .addSubcommand(sub => sub.setName('view').setDescription('View your mine stats and inventory'))
    .addSubcommand(sub => sub.setName('mine').setDescription('Start or continue a mining session'))
    .addSubcommand(sub => sub.setName('sell').setDescription('Sell all ores in your inventory'))
    .addSubcommand(sub => sub.setName('inventory').setDescription('Check your ore inventory'))
    .addSubcommand(sub => sub.setName('shop').setDescription('Buy pickaxe upgrades')),

  async execute(interaction, client) {
    try {
      await interaction.deferReply({ ephemeral: false });
    } catch (err) {
      console.error('Mining defer failed:', err);
      return interaction.reply({ content: 'Failed to start.', ephemeral: true }).catch(() => {});
    }

    const userId = interaction.user.id;
    const guildId = interaction.guild.id;
    const username = interaction.user.username;
    const key = `mining_${guildId}_${userId}`;

    let data = client.memory.get(key) || getDefaultMiningData();
    data = migrateMiningData(data);

    const sub = interaction.options.getSubcommand();

    // ── VIEW ───────────────────────────────────────────────
    if (sub === 'view') {
      const embed = buildMiningEmbed(data, data.session, username);
      embed.setFooter({ text: 'Use /mining mine to start mining! Risk grows each click.' });
      return interaction.editReply({ embeds: [embed] });
    }

    // ── INVENTORY ──────────────────────────────────────────
    if (sub === 'inventory') {
      const lines = Object.entries(data.inventory)
        .filter(([, count]) => count > 0)
        .map(([id, count]) => {
          const ore = ORES.find(o => o.id === id);
          if (!ore) return null;
          return `${ore.name} x${count} — worth **${ore.sellValue * count}c**`;
        }).filter(Boolean);

      const totalValue = Object.entries(data.inventory).reduce((sum, [id, count]) => {
        const ore = ORES.find(o => o.id === id);
        return sum + (ore ? ore.sellValue * count : 0);
      }, 0);

      const embed = new EmbedBuilder()
        .setColor('#5c3317')
        .setTitle(`🎒 ${username}'s Ore Inventory`)
        .setDescription(lines.length > 0 ? lines.join('\n') : 'Your inventory is empty! Go mining.')
        .addFields(
          { name: '💰 Mine Coins',   value: `${data.coins}`,   inline: true },
          { name: '📦 Total Value',  value: `${totalValue}c`,  inline: true }
        );

      return interaction.editReply({ embeds: [embed] });
    }

    // ── SHOP ───────────────────────────────────────────────
    if (sub === 'shop') {
      const currentPickaxe = PICKAXES.find(p => p.id === data.pickaxe) || PICKAXES[0];
      const currentIndex = PICKAXES.indexOf(currentPickaxe);

      const lines = PICKAXES.map((p, i) => {
        const owned = i <= currentIndex;
        const equipped = p.id === data.pickaxe;
        return `${p.name} — **${p.cost === 0 ? 'Free' : p.cost + 'c'}** — ${p.desc}${equipped ? ' ✅ Equipped' : owned ? ' ✅ Owned' : ''}`;
      });

      const embed = new EmbedBuilder()
        .setColor('#5c3317')
        .setTitle('🏪 Mining Shop — Pickaxes')
        .setDescription(lines.join('\n'))
        .addFields({ name: '💰 Your Mine Coins', value: `${data.coins}`, inline: true })
        .setFooter({ text: 'Pickaxes are upgrades — buy the next tier!' });

      // Only show button for next purchasable pickaxe
      const nextPickaxe = PICKAXES[currentIndex + 1];
      const components = [];
      if (nextPickaxe) {
        const canAfford = data.coins >= nextPickaxe.cost;
        components.push(new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`mine_buy_${nextPickaxe.id}`)
            .setLabel(`Buy ${nextPickaxe.name} (${nextPickaxe.cost}c)`)
            .setStyle(canAfford ? ButtonStyle.Success : ButtonStyle.Secondary)
            .setDisabled(!canAfford)
        ));
      }

      await interaction.editReply({ embeds: [embed], components });
      if (!nextPickaxe) return;

      const shopMsg = await interaction.fetchReply();
      const collector = shopMsg.createMessageComponentCollector({ time: 30000 });

      collector.on('collect', async btn => {
        try { await btn.deferUpdate(); } catch (e) { return; }
        if (btn.user.id !== userId) return;

        data = client.memory.get(key) || data;
        const pickaxeId = btn.customId.replace('mine_buy_', '');
        const pickaxe = PICKAXES.find(p => p.id === pickaxeId);
        if (!pickaxe) return;

        if (data.coins < pickaxe.cost) {
          return btn.followUp({ content: `❌ Need **${pickaxe.cost}c**, you have **${data.coins}c**.`, ephemeral: true }).catch(() => {});
        }

        data.coins -= pickaxe.cost;
        data.pickaxe = pickaxe.id;
        client.memory.set(key, data);

        await btn.followUp({
          content: `✅ Upgraded to **${pickaxe.name}**! ${pickaxe.desc}\n💰 Mine coins left: **${data.coins}**`,
          ephemeral: true
        }).catch(() => {});

        collector.stop();
      });

      collector.on('end', () => { shopMsg.edit({ components: [] }).catch(() => {}); });
      return;
    }

    // ── SELL ───────────────────────────────────────────────
    if (sub === 'sell') {
      const entries = Object.entries(data.inventory).filter(([, count]) => count > 0);
      if (entries.length === 0) {
        return interaction.editReply('🎒 Nothing to sell! Go `/mining mine` first.');
      }

      let totalEarned = 0;
      const sellLines = [];

      for (const [oreId, count] of entries) {
        const ore = ORES.find(o => o.id === oreId);
        if (!ore) continue;
        const earned = ore.sellValue * count;
        totalEarned += earned;
        sellLines.push(`${ore.name} x${count} — **${earned}c**`);
        data.inventory[oreId] = 0;
      }

      data.coins += totalEarned;
      client.memory.set(key, data);

      const embed = new EmbedBuilder()
        .setColor('#5c3317')
        .setTitle('💰 Ores Sold!')
        .setDescription(sellLines.join('\n'))
        .addFields(
          { name: '💰 Total Earned',  value: `**${totalEarned}c**`, inline: true },
          { name: '💰 Mine Coins',    value: `${data.coins}c`,      inline: true }
        );

      return interaction.editReply({ embeds: [embed] });
    }

    // ── MINE (main interactive session) ────────────────────
    if (sub === 'mine') {
      const pickaxe = PICKAXES.find(p => p.id === data.pickaxe) || PICKAXES[0];

      // Start a new session if none active
      if (!data.session) {
        data.session = { clicks: 0, haul: {} };
        client.memory.set(key, data);
      }

      const session = data.session;
      const caveInChance = getCaveInChance(session, pickaxe);

      const embed = buildMiningEmbed(data, session, username);

      // Check if owl pet is active — warn at 50%+ cave-in risk
      const petData = client.memory.get(`pets_${guildId}_${userId}`);
      const hasOwl = petData?.active?.includes('owl');
      let owlWarning = '';
      if (hasOwl && caveInChance >= 0.5) {
        owlWarning = '\n\n🦉 **Owl Warning: Cave-in risk is HIGH! Consider escaping!**';
      }

      if (owlWarning) embed.setDescription(owlWarning);

      const mineRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('mine_click').setLabel('⛏️ Mine').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('mine_escape').setLabel('🏃 Escape with loot').setStyle(ButtonStyle.Success)
      );

      await interaction.editReply({ embeds: [embed], components: [mineRow] });
      const mineMsg = await interaction.fetchReply();

      const collector = mineMsg.createMessageComponentCollector({ time: 120000 });

      collector.on('collect', async btn => {
        try { await btn.deferUpdate(); } catch (e) { return; }
        if (btn.user.id !== userId) return;

        data = client.memory.get(key) || data;
        const currentPickaxe = PICKAXES.find(p => p.id === data.pickaxe) || PICKAXES[0];

        // ── ESCAPE ─────────────────────────────────────────
        if (btn.customId === 'mine_escape') {
          collector.stop('escaped');
          if (!data.inventory) data.inventory = {};

          // Move haul to inventory
          for (const [oreId, count] of Object.entries(data.session?.haul || {})) {
            data.inventory[oreId] = (data.inventory[oreId] || 0) + count;
          }

          const haulLines = Object.entries(data.session?.haul || {})
            .filter(([, c]) => c > 0)
            .map(([id, c]) => {
              const ore = ORES.find(o => o.id === id);
              return ore ? `${ore.name} x${c}` : null;
            }).filter(Boolean);

          data.session = null;
          client.memory.set(key, data);

          await btn.followUp({
            embeds: [new EmbedBuilder()
              .setColor('#4caf50')
              .setTitle('🏃 Escaped the mine safely!')
              .setDescription(haulLines.length > 0 ? `You brought back:\n${haulLines.join('\n')}` : 'You escaped but had nothing.')
              .addFields({ name: '💡 Next step', value: 'Use `/mining sell` to sell your ores!', inline: false })],
            ephemeral: true
          }).catch(() => {});

          await mineMsg.edit({ components: [] }).catch(() => {});
          return;
        }

        // ── MINE CLICK ─────────────────────────────────────
        if (btn.customId === 'mine_click') {
          if (!data.session) data.session = { clicks: 0, haul: {} };

          // Check cave-in BEFORE mining
          const caveChance = getCaveInChance(data.session, currentPickaxe);
          const caveRoll = Math.random();

          if (caveRoll < caveChance) {
            // CAVE-IN — wipe the session haul
            collector.stop('cave_in');
            const lostLines = Object.entries(data.session.haul)
              .filter(([, c]) => c > 0)
              .map(([id, c]) => {
                const ore = ORES.find(o => o.id === id);
                return ore ? `${ore.name} x${c}` : null;
              }).filter(Boolean);

            data.session = null;
            client.memory.set(key, data);

            await btn.followUp({
              embeds: [new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('💥 CAVE-IN!')
                .setDescription(
                  `The tunnel collapsed! You barely escaped with your life.\n\n` +
                  `**Lost:** ${lostLines.length > 0 ? lostLines.join(', ') : 'Nothing (you had nothing yet)'}\n\n` +
                  `*Next time escape earlier or upgrade your pickaxe for better resistance!*`
                )],
              ephemeral: true
            }).catch(() => {});

            await mineMsg.edit({
              embeds: [new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle(`💥 Cave-in! ${username} lost their haul!`)
                .setDescription('The mine collapsed. Start a new session with `/mining mine`.')],
              components: []
            }).catch(() => {});
            return;
          }

          // Mine successfully — roll ores based on pickaxe bonus
          const rolls = 1 + currentPickaxe.mineBonus;
          const found = [];
          for (let i = 0; i < rolls; i++) {
            const ore = rollOre();
            data.session.haul[ore.id] = (data.session.haul[ore.id] || 0) + 1;
            found.push(ore);
          }
          data.session.clicks++;

          // Update cave-in chance after click
          const newCaveChance = getCaveInChance(data.session, currentPickaxe);
          const owlPetData = client.memory.get(`pets_${guildId}_${userId}`);
          const owlActive = owlPetData?.active?.includes('owl');
          let warning = '';
          if (owlActive && newCaveChance >= 0.5) {
            warning = '\n\n🦉 **Owl Warning: Cave-in risk is HIGH! Consider escaping now!**';
          }

          client.memory.set(key, data);

          // Unique ores found this click
          const uniqueFound = [...new Set(found.map(o => o.name))].join(', ');

          const updatedEmbed = buildMiningEmbed(data, data.session, username);
          if (warning) updatedEmbed.setDescription(`*Found: **${uniqueFound}***${warning}`);
          else updatedEmbed.setDescription(`*Found: **${uniqueFound}***`);

          await mineMsg.edit({ embeds: [updatedEmbed], components: [mineRow] }).catch(() => {});

          await btn.followUp({
            content: `⛏️ Mined **${uniqueFound}**!\n⚠️ Cave-in risk: **${Math.floor(newCaveChance * 100)}%**${newCaveChance >= 0.7 ? ' — DANGER ZONE! Escape now!' : newCaveChance >= 0.5 ? ' — Getting risky!' : ''}`,
            ephemeral: true
          }).catch(() => {});
        }
      });

      collector.on('end', (collected, reason) => {
        if (reason === 'time') {
          // Timeout — auto-escape with current haul
          if (data.session) {
            if (!data.inventory) data.inventory = {};
            for (const [oreId, count] of Object.entries(data.session.haul || {})) {
              data.inventory[oreId] = (data.inventory[oreId] || 0) + count;
            }
            data.session = null;
            client.memory.set(key, data);
          }
          mineMsg.edit({ components: [] }).catch(() => {});
        }
      });
    }
  }
};
