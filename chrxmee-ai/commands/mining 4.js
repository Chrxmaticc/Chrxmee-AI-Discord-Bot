const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const OWNER_ID = '902685494247325776';

function isMod(interaction) {
  return interaction.member &&
    (interaction.member.permissions.has('KickMembers') ||
     interaction.member.permissions.has('BanMembers'));
}

// ── PICKAXES ───────────────────────────────────────────────────────────────
const PICKAXES = [
  { id: 'wooden',    name: '🪵 Wooden Pickaxe',    cost: 0,     mineBonus: 0, caveInResist: 0.00, desc: 'Starter — pure suffering' },
  { id: 'stone',     name: '🪨 Stone Pickaxe',      cost: 200,   mineBonus: 1, caveInResist: 0.02, desc: '+1 ore roll, -2% cave-in' },
  { id: 'iron',      name: '⚙️ Iron Pickaxe',       cost: 500,   mineBonus: 2, caveInResist: 0.04, desc: '+2 ore rolls, -4% cave-in' },
  { id: 'gold',      name: '🟡 Gold Pickaxe',       cost: 1000,  mineBonus: 3, caveInResist: 0.07, desc: '+3 ore rolls, -7% cave-in' },
  { id: 'diamond',   name: '💎 Diamond Pickaxe',    cost: 2500,  mineBonus: 4, caveInResist: 0.15, desc: '+4 ore rolls, -15% cave-in (3% on click 1)' },
  { id: 'netherite', name: '🔱 Netherite Pickaxe',  cost: 5000,  mineBonus: 5, caveInResist: 0.25, desc: '+5 ore rolls, -25% cave-in' },
  { id: 'obsidian',  name: '🌑 Obsidian Pickaxe',   cost: 8000,  mineBonus: 6, caveInResist: 0.35, desc: '+6 ore rolls, -35% cave-in' },
  { id: 'celestial', name: '👼 Celestial Pickaxe',  cost: 12000, mineBonus: 7, caveInResist: 0.45, desc: '+7 ore rolls, -45% cave-in' },
  { id: 'void',      name: '👁️ Void Pickaxe',       cost: 18000, mineBonus: 8, caveInResist: 0.55, desc: '+8 ore rolls, -55% cave-in (top tier)' },
];

// ── ORES ───────────────────────────────────────────────────────────────────
// Chances sum to ~0.927, fallback to stone for remainder
const ORES = [
  { id: 'stone',     name: '⛏️ Stone',            chance: 0.28,  sellValue: 5,    rarity: 'Common'    },
  { id: 'granite',   name: '🪨 Granite',           chance: 0.17,  sellValue: 10,   rarity: 'Common'    },
  { id: 'copper',    name: '🟤 Copper Ore',        chance: 0.13,  sellValue: 20,   rarity: 'Uncommon'  },
  { id: 'iron',      name: '🪨 Iron Ore',          chance: 0.09,  sellValue: 35,   rarity: 'Uncommon'  },
  { id: 'obsidian',  name: '🌑 Obsidian Shard',    chance: 0.03,  sellValue: 45,   rarity: 'Uncommon'  },
  { id: 'silver',    name: '✨ Silver Ore',        chance: 0.07,  sellValue: 60,   rarity: 'Rare'      },
  { id: 'gold',      name: '🟡 Gold Ore',          chance: 0.05,  sellValue: 100,  rarity: 'Rare'      },
  { id: 'titanite',  name: '🔩 Titanite',          chance: 0.02,  sellValue: 150,  rarity: 'Rare'      },
  { id: 'diamond',   name: '💎 Diamond Ore',       chance: 0.03,  sellValue: 250,  rarity: 'Epic'      },
  { id: 'shadow',    name: '💀 Shadowstone',       chance: 0.02,  sellValue: 400,  rarity: 'Epic'      },
  { id: 'voidstone', name: '🌀 Voidstone',         chance: 0.01,  sellValue: 550,  rarity: 'Epic'      },
  { id: 'mana',      name: '🔮 Mana Crystal',      chance: 0.015, sellValue: 600,  rarity: 'Legendary' },
  { id: 'starfire',  name: '🌟 Starfire Ore',      chance: 0.005, sellValue: 1000, rarity: 'Legendary' },
  { id: 'celestite', name: '👑 Celestite',         chance: 0.005, sellValue: 1500, rarity: 'Legendary' },
  { id: 'ethereal',  name: '💠 Ethereal Crystal',  chance: 0.002, sellValue: 2500, rarity: 'Mythic'    },
];

// ── CAVE-IN REBALANCE ──────────────────────────────────────────────────────
// Diamond click 1 = 3%, click 5 = 43% — actually scary now
// Netherite click 1 = ~1%, click 5 = 33%
const BASE_CAVE_IN_CHANCE = 0.18;
const CAVE_IN_GROWTH      = 0.08;

function getDefaultMiningData() {
  return { coins: 50, pickaxe: 'wooden', inventory: {}, session: null };
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
  return ORES[0];
}

function getCaveInChance(session, pickaxe) {
  const resist = pickaxe ? pickaxe.caveInResist : 0;
  const depth  = session ? session.clicks : 0;
  return Math.max(0, Math.min(0.95, BASE_CAVE_IN_CHANCE + (depth * CAVE_IN_GROWTH) - resist));
}

function buildRiskBar(chance) {
  const filled = Math.round(chance * 10);
  const color  = chance < 0.3 ? '🟩' : chance < 0.6 ? '🟨' : '🟥';
  return color.repeat(filled) + '⬛'.repeat(10 - filled);
}

function buildMiningEmbed(data, session, username) {
  const pickaxe      = PICKAXES.find(p => p.id === data.pickaxe) || PICKAXES[0];
  const caveInChance = session ? getCaveInChance(session, pickaxe) : BASE_CAVE_IN_CHANCE - pickaxe.caveInResist;
  const riskBar      = buildRiskBar(Math.max(0, caveInChance));

  const embed = new EmbedBuilder()
    .setColor('#5c3317')
    .setTitle(`⛏️ ${username}'s Mine`)
    .addFields(
      { name: '⛏️ Pickaxe',    value: pickaxe.name,    inline: true },
      { name: '💰 Mine Coins', value: `${data.coins}`, inline: true },
    );

  if (session) {
    const sessionLines = Object.entries(session.haul)
      .filter(([, c]) => c > 0)
      .map(([id, c]) => { const ore = ORES.find(o => o.id === id); return ore ? `${ore.name} x${c}` : null; })
      .filter(Boolean);
    embed.addFields(
      { name: '🎯 Session Depth', value: `${session.clicks} clicks deep`, inline: true },
      { name: '⚠️ Cave-In Risk',  value: `${riskBar} ${Math.floor(Math.max(0, caveInChance) * 100)}%`, inline: false },
      { name: '🪨 Current Haul',  value: sessionLines.length > 0 ? sessionLines.join(', ') : 'Nothing yet', inline: false },
    );
  }

  const invLines = Object.entries(data.inventory)
    .filter(([, c]) => c > 0)
    .map(([id, c]) => { const ore = ORES.find(o => o.id === id); return ore ? `${ore.name} x${c}` : null; })
    .filter(Boolean);
  if (invLines.length > 0) embed.addFields({ name: '🎒 Inventory', value: invLines.join(' | '), inline: false });

  return embed;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mining')
    .setDescription('Mine ores, sell them and upgrade your pickaxe')
    .addSubcommand(sub => sub.setName('view').setDescription('View your mine stats and inventory'))
    .addSubcommand(sub => sub.setName('mine').setDescription('Start or continue a mining session'))
    .addSubcommand(sub => sub.setName('sell').setDescription('Sell all ores in your inventory'))
    .addSubcommand(sub => sub.setName('inventory').setDescription('Check your ore inventory'))
    .addSubcommand(sub => sub.setName('shop').setDescription('Buy pickaxe upgrades'))
    .addSubcommand(sub => sub.setName('reset').setDescription('Reset all your mining data'))
    .addSubcommand(sub =>
      sub.setName('give')
        .setDescription('(Owner/Mod) Give mine coins to a user')
        .addUserOption(opt => opt.setName('user').setDescription('Who to give coins to').setRequired(true))
        .addIntegerOption(opt => opt.setName('amount').setDescription('Amount of mine coins').setRequired(true).setMinValue(1))
    ),

  async execute(interaction, client) {
    try {
      await interaction.deferReply({ ephemeral: false });
    } catch (err) {
      console.error('Mining defer failed:', err);
      return interaction.reply({ content: 'Failed to start.', ephemeral: true }).catch(() => {});
    }

    const userId   = interaction.user.id;
    const guildId  = interaction.guild.id;
    const username = interaction.user.username;
    const key      = `mining_${guildId}_${userId}`;

    let data = client.memory.get(key) || getDefaultMiningData();
    data = migrateMiningData(data);

    const sub = interaction.options.getSubcommand();

    // ── GIVE (owner + mod) ─────────────────────────────────
    if (sub === 'give') {
      if (userId !== OWNER_ID && !isMod(interaction)) return interaction.editReply('❌ You need to be a moderator or the bot owner.');
      const target = interaction.options.getUser('user');
      const amount = interaction.options.getInteger('amount');
      const MOD_CAP = 5000;
      const isOwnerGive = userId === OWNER_ID;
      if (!isOwnerGive && amount > MOD_CAP) {
        return interaction.editReply(`❌ Moderators can only give up to **${MOD_CAP} mine coins** at a time. Ask the bot owner for more.`);
      }
      const tKey = `mining_${guildId}_${target.id}`;
      let tData = client.memory.get(tKey) || getDefaultMiningData();
      tData = migrateMiningData(tData);
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
              .setTitle(`📋 Give Log — Mining`)
              .addFields(
                { name: '👤 Given by', value: `<@${userId}> (${interaction.user.username})`, inline: true },
                { name: '🎯 Given to', value: `<@${target.id}> (${target.username})`, inline: true },
                { name: '💰 Amount',   value: `${amount} mine coins`, inline: true },
                { name: '🔑 Role',     value: isOwnerGive ? '👑 Owner' : '🛡️ Moderator', inline: true },
                { name: '🕐 Time',     value: new Date().toUTCString(), inline: false }
              )]}).catch(() => {});
          }
        }
      } catch (e) { console.error('give log failed:', e.message); }
      return interaction.editReply(`✅ Gave **${amount} mine coins** to **${target.username}**! They now have **${tData.coins}**.`);
    }
    // ── RESET ──────────────────────────────────────────────
    if (sub === 'reset') {
      client.memory.delete(key);
      return interaction.editReply('✅ Mining data fully reset! You start fresh with 50 mine coins and a Wooden Pickaxe.');
    }

    // ── VIEW ───────────────────────────────────────────────
    if (sub === 'view') {
      const embed = buildMiningEmbed(data, data.session, username);
      embed.setFooter({ text: 'Use /mining mine to start! Risk grows each click — escape before it\'s too late.' });
      return interaction.editReply({ embeds: [embed] });
    }

    // ── INVENTORY ──────────────────────────────────────────
    if (sub === 'inventory') {
      const lines = Object.entries(data.inventory)
        .filter(([, c]) => c > 0)
        .map(([id, c]) => {
          const ore = ORES.find(o => o.id === id);
          if (!ore) return null;
          return `${ore.name} x${c} — **${ore.sellValue * c}c** *(${ore.rarity})*`;
        }).filter(Boolean);
      const totalValue = Object.entries(data.inventory).reduce((sum, [id, c]) => {
        const ore = ORES.find(o => o.id === id);
        return sum + (ore ? ore.sellValue * c : 0);
      }, 0);
      const embed = new EmbedBuilder()
        .setColor('#5c3317')
        .setTitle(`🎒 ${username}'s Ore Inventory`)
        .setDescription(lines.length > 0 ? lines.join('\n') : 'Empty! Go `/mining mine`.')
        .addFields(
          { name: '💰 Mine Coins',  value: `${data.coins}`,  inline: true },
          { name: '📦 Total Value', value: `${totalValue}c`, inline: true }
        );
      return interaction.editReply({ embeds: [embed] });
    }

    // ── SHOP ───────────────────────────────────────────────
    if (sub === 'shop') {
      const currentPickaxe = PICKAXES.find(p => p.id === data.pickaxe) || PICKAXES[0];
      const currentIndex   = PICKAXES.indexOf(currentPickaxe);

      const lines = PICKAXES.map((p, i) => {
        const owned   = i <= currentIndex;
        const equipped = p.id === data.pickaxe;
        return `${p.name} — **${p.cost === 0 ? 'Free' : p.cost + 'c'}** — ${p.desc}${equipped ? ' ✅ Equipped' : owned ? ' ✅ Owned' : ''}`;
      });

      const embed = new EmbedBuilder()
        .setColor('#5c3317')
        .setTitle('🏪 Mining Shop — Pickaxes (9 tiers)')
        .setDescription(lines.join('\n'))
        .addFields({ name: '💰 Your Mine Coins', value: `${data.coins}`, inline: true })
        .setFooter({ text: 'Buy next tier pickaxe to reduce cave-in risk and get more ore rolls.' });

      const nextPickaxe = PICKAXES[currentIndex + 1];
      const components  = [];
      if (nextPickaxe) {
        const canAfford = data.coins >= nextPickaxe.cost;
        components.push(new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`mine_buy_${nextPickaxe.id}`)
            .setLabel(`Upgrade to ${nextPickaxe.name} (${nextPickaxe.cost}c)`)
            .setStyle(canAfford ? ButtonStyle.Success : ButtonStyle.Secondary)
            .setDisabled(!canAfford)
        ));
      }

      await interaction.editReply({ embeds: [embed], components });
      if (!nextPickaxe) return;

      const shopMsg   = await interaction.fetchReply();
      const collector = shopMsg.createMessageComponentCollector({ time: 30000 });

      collector.on('collect', async btn => {
        try { await btn.deferUpdate(); } catch (e) { return; }
        if (btn.user.id !== userId) return;
        data = client.memory.get(key) || data;
        const pickaxeId = btn.customId.replace('mine_buy_', '');
        const pickaxe   = PICKAXES.find(p => p.id === pickaxeId);
        if (!pickaxe) return;
        if (data.coins < pickaxe.cost) {
          return btn.followUp({ content: `❌ Need **${pickaxe.cost}c**, you have **${data.coins}c**.`, ephemeral: true }).catch(() => {});
        }
        data.coins -= pickaxe.cost;
        data.pickaxe = pickaxe.id;
        client.memory.set(key, data);
        await btn.followUp({ content: `✅ Upgraded to **${pickaxe.name}**!\n${pickaxe.desc}\n💰 Mine coins left: **${data.coins}**`, ephemeral: true }).catch(() => {});
        collector.stop();
      });

      collector.on('end', () => { shopMsg.edit({ components: [] }).catch(() => {}); });
      return;
    }

    // ── SELL ───────────────────────────────────────────────
    if (sub === 'sell') {
      const entries = Object.entries(data.inventory).filter(([, c]) => c > 0);
      if (entries.length === 0) return interaction.editReply('🎒 Nothing to sell! Go `/mining mine` first.');
      let totalEarned = 0;
      const sellLines = [];
      for (const [oreId, count] of entries) {
        const ore = ORES.find(o => o.id === oreId);
        if (!ore) continue;
        const earned = ore.sellValue * count;
        totalEarned += earned;
        sellLines.push(`${ore.name} x${count} — **${earned}c** *(${ore.rarity})*`);
        data.inventory[oreId] = 0;
      }
      data.coins += totalEarned;
      client.memory.set(key, data);
      const embed = new EmbedBuilder()
        .setColor('#5c3317')
        .setTitle('💰 Ores Sold!')
        .setDescription(sellLines.join('\n'))
        .addFields(
          { name: '💰 Total Earned', value: `**${totalEarned}c**`, inline: true },
          { name: '💰 Mine Coins',   value: `${data.coins}c`,      inline: true }
        );
      return interaction.editReply({ embeds: [embed] });
    }

    // ── MINE ───────────────────────────────────────────────
    if (sub === 'mine') {
      const pickaxe = PICKAXES.find(p => p.id === data.pickaxe) || PICKAXES[0];
      if (!data.session) { data.session = { clicks: 0, haul: {} }; client.memory.set(key, data); }

      const session      = data.session;
      const caveInChance = getCaveInChance(session, pickaxe);
      const embed        = buildMiningEmbed(data, session, username);

      // Owl pet warning
      const petData  = client.memory.get(`pets_${guildId}_${userId}`);
      const hasOwl   = petData?.active?.includes('owl');
      if (hasOwl && caveInChance >= 0.5) {
        embed.setDescription('🦉 **Owl Warning: Cave-in risk is HIGH! Consider escaping!**');
      }

      const mineRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('mine_click').setLabel('⛏️ Mine').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('mine_escape').setLabel('🏃 Escape with loot').setStyle(ButtonStyle.Success)
      );

      await interaction.editReply({ embeds: [embed], components: [mineRow] });
      const mineMsg   = await interaction.fetchReply();
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
          for (const [oreId, count] of Object.entries(data.session?.haul || {})) {
            data.inventory[oreId] = (data.inventory[oreId] || 0) + count;
          }
          const haulLines = Object.entries(data.session?.haul || {})
            .filter(([, c]) => c > 0)
            .map(([id, c]) => { const ore = ORES.find(o => o.id === id); return ore ? `${ore.name} x${c}` : null; })
            .filter(Boolean);
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

          const caveChance = getCaveInChance(data.session, currentPickaxe);
          const caveRoll   = Math.random();

          if (caveRoll < caveChance) {
            // CAVE-IN
            collector.stop('cave_in');
            const lostLines = Object.entries(data.session.haul)
              .filter(([, c]) => c > 0)
              .map(([id, c]) => { const ore = ORES.find(o => o.id === id); return ore ? `${ore.name} x${c}` : null; })
              .filter(Boolean);
            data.session = null;
            client.memory.set(key, data);
            await btn.followUp({
              embeds: [new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('💥 CAVE-IN!')
                .setDescription(
                  `The tunnel collapsed! You barely escaped with your life.\n\n` +
                  `**Lost:** ${lostLines.length > 0 ? lostLines.join(', ') : 'Nothing (you had nothing yet)'}\n\n` +
                  `*Upgrade your pickaxe or escape earlier next time!*`
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

          // Mine successfully
          const rolls = 1 + currentPickaxe.mineBonus;
          const found = [];
          for (let i = 0; i < rolls; i++) {
            const ore = rollOre();
            data.session.haul[ore.id] = (data.session.haul[ore.id] || 0) + 1;
            found.push(ore);
          }
          data.session.clicks++;

          const newCaveChance = getCaveInChance(data.session, currentPickaxe);
          const owlPetData    = client.memory.get(`pets_${guildId}_${userId}`);
          const owlActive     = owlPetData?.active?.includes('owl');
          let warning = '';
          if (owlActive && newCaveChance >= 0.5) warning = '\n\n🦉 **Owl Warning: Cave-in risk is HIGH! Escape now!**';

          client.memory.set(key, data);

          const uniqueFound   = [...new Set(found.map(o => o.name))].join(', ');
          const updatedEmbed  = buildMiningEmbed(data, data.session, username);
          if (warning) updatedEmbed.setDescription(`*Found: **${uniqueFound}***${warning}`);
          else updatedEmbed.setDescription(`*Found: **${uniqueFound}***`);

          const riskLevel = newCaveChance >= 0.7 ? ' — ☠️ **DANGER ZONE! Escape NOW!**' : newCaveChance >= 0.5 ? ' — ⚠️ Getting very risky!' : newCaveChance >= 0.3 ? ' — caution recommended' : '';

          await mineMsg.edit({ embeds: [updatedEmbed], components: [mineRow] }).catch(() => {});
          await btn.followUp({
            content: `⛏️ Mined **${uniqueFound}**!\n⚠️ Cave-in risk: **${Math.floor(newCaveChance * 100)}%**${riskLevel}`,
            ephemeral: true
          }).catch(() => {});
        }
      });

      collector.on('end', (collected, reason) => {
        if (reason === 'time') {
          // Auto-escape on timeout
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
