const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const OWNER_IDS = ['902685494247325776', '954709865698312213'];

function getAllInventories(client, guildId, userId) {
  const farmKey = `farm2_${guildId}_${userId}`;
  const miningKey = `mining2_${guildId}_${userId}`;
  const dungeonKey = `dungeon_${guildId}_${userId}`;
  const duelKey = `duel_${guildId}_${userId}`;
  const petKey = `pets_${guildId}_${userId}`;

  const farmData = client.memory.get(farmKey) || {};
  const miningData = client.memory.get(miningKey) || {};
  const dungeonData = client.memory.get(dungeonKey) || {};
  const duelData = client.memory.get(duelKey) || {};
  const petData = client.memory.get(petKey) || { owned: [], active: [] };

  const inventory = {} 
  if (farmData.inventory) {
    for (const [cropId, qty] of Object.entries(farmData.inventory)) {
      inventory[`farm:crop:${cropId}`] = (inventory[`farm:crop:${cropId}`] || 0) + qty;
    }
  }
  if (farmData.fertilizers) {
    for (const [fertId, qty] of Object.entries(farmData.fertilizers)) {
      if (qty > 0) inventory[`farm:fertilizer:${fertId}`] = (inventory[`farm:fertilizer:${fertId}`] || 0) + qty;
    }
  }
  if (farmData.crystalCrops > 0) {
    inventory['farm:crystal_crop'] = (inventory['farm:crystal_crop'] || 0) + farmData.crystalCrops;
  }
  if (farmData.coins > 0) inventory['farm:coins'] = (inventory['farm:coins'] || 0) + farmData.coins;

  if (miningData.inventory) {
    for (const [oreId, qty] of Object.entries(miningData.inventory)) {
      inventory[`mining:${oreId}`] = (inventory[`mining:${oreId}`] || 0) + qty;
    }
  }
  if (miningData.coins > 0) inventory['mining:coins'] = (inventory['mining:coins'] || 0) + miningData.coins;
  if (dungeonData.inventory) {
    for (const item of dungeonData.inventory) {
      inventory[`dungeon:item:${item}`] = (inventory[`dungeon:item:${item}`] || 0) + 1;
    }
  }
  if (dungeonData.potions) {
    for (const [potionId, qty] of Object.entries(dungeonData.potions)) {
      if (qty > 0) inventory[`dungeon:potion:${potionId}`] = (inventory[`dungeon:potion:${potionId}`] || 0) + qty;
    }
  }
  if (dungeonData.spells) {
    for (const [spellId, qty] of Object.entries(dungeonData.spells)) {
      if (qty > 0) inventory[`dungeon:spell:${spellId}`] = (inventory[`dungeon:spell:${spellId}`] || 0) + qty;
    }
  }
  if (dungeonData.gold > 0) inventory['dungeon:gold'] = (inventory['dungeon:gold'] || 0) + dungeonData.gold;

  if (duelData.tokens > 0) inventory['duel:tokens'] = (inventory['duel:tokens'] || 0) + duelData.tokens;
  if (duelData.inventory) {
    for (const item of duelData.inventory) {
      inventory[`duel:${item}`] = (inventory[`duel:${item}`] || 0) + 1;
    }
  }

  if (petData.owned) {
    for (const petId of petData.owned) {
      inventory[`pet:${petId}`] = (inventory[`pet:${petId}`] || 0) + 1;
    }
  }

  return inventory;
}

async function removeItems(client, guildId, userId, items) {
  const farmKey = `farm2_${guildId}_${userId}`;
  const miningKey = `mining2_${guildId}_${userId}`;
  const dungeonKey = `dungeon_${guildId}_${userId}`;
  const duelKey = `duel_${guildId}_${userId}`;
  const petKey = `pets_${guildId}_${userId}`;

  let farmData = client.memory.get(farmKey) || {};
  let miningData = client.memory.get(miningKey) || {};
  let dungeonData = client.memory.get(dungeonKey) || {};
  let duelData = client.memory.get(duelKey) || {};
  let petData = client.memory.get(petKey) || { owned: [], active: [] };

  for (const [itemId, amount] of Object.entries(items)) {
    if (itemId.startsWith('farm:crop:')) {
      const cropId = itemId.slice(11);
      if (!farmData.inventory?.[cropId] || farmData.inventory[cropId] < amount) throw new Error(`Not enough crop ${cropId}`);
      farmData.inventory[cropId] -= amount;
      if (farmData.inventory[cropId] <= 0) delete farmData.inventory[cropId];
    }
    else if (itemId.startsWith('farm:fertilizer:')) {
      const fertId = itemId.slice(16);
      if (!farmData.fertilizers?.[fertId] || farmData.fertilizers[fertId] < amount) throw new Error(`Not enough fertilizer ${fertId}`);
      farmData.fertilizers[fertId] -= amount;
    }
    else if (itemId === 'farm:crystal_crop') {
      if (!farmData.crystalCrops || farmData.crystalCrops < amount) throw new Error(`Not enough crystal crops`);
      farmData.crystalCrops -= amount;
    }
    else if (itemId === 'farm:coins') {
      if (!farmData.coins || farmData.coins < amount) throw new Error(`Not enough farm coins`);
      farmData.coins -= amount;
    }
    else if (itemId.startsWith('mining:')) {
      const oreId = itemId.slice(7);
      if (!miningData.inventory?.[oreId] || miningData.inventory[oreId] < amount) throw new Error(`Not enough mining ${oreId}`);
      miningData.inventory[oreId] -= amount;
      if (miningData.inventory[oreId] <= 0) delete miningData.inventory[oreId];
    }
    else if (itemId === 'mining:coins') {
      if (!miningData.coins || miningData.coins < amount) throw new Error(`Not enough mining coins`);
      miningData.coins -= amount;
    }
    else if (itemId.startsWith('dungeon:item:')) {
      const itemName = itemId.slice(14);
      const idx = dungeonData.inventory?.indexOf(itemName);
      if (idx === -1) throw new Error(`Not enough dungeon item ${itemName}`);
      let removed = 0;
      dungeonData.inventory = dungeonData.inventory.filter(i => {
        if (i === itemName && removed < amount) { removed++; return false; }
        return true;
      });
      if (removed < amount) throw new Error(`Not enough ${itemName} (only ${removed})`);
    }
    else if (itemId.startsWith('dungeon:potion:')) {
      const potId = itemId.slice(15);
      if (!dungeonData.potions?.[potId] || dungeonData.potions[potId] < amount) throw new Error(`Not enough potion ${potId}`);
      dungeonData.potions[potId] -= amount;
    }
    else if (itemId.startsWith('dungeon:spell:')) {
      const spellId = itemId.slice(14);
      if (!dungeonData.spells?.[spellId] || dungeonData.spells[spellId] < amount) throw new Error(`Not enough spell ${spellId}`);
      dungeonData.spells[spellId] -= amount;
    }
    else if (itemId === 'dungeon:gold') {
      if (!dungeonData.gold || dungeonData.gold < amount) throw new Error(`Not enough dungeon gold`);
      dungeonData.gold -= amount;
    }
    else if (itemId === 'duel:tokens') {
      if (!duelData.tokens || duelData.tokens < amount) throw new Error(`Not enough duel tokens`);
      duelData.tokens -= amount;
    }
    else if (itemId.startsWith('duel:')) {
      const duelItem = itemId.slice(5);
      const idx = duelData.inventory?.indexOf(duelItem);
      if (idx === -1) throw new Error(`Not enough duel item ${duelItem}`);
      let removed = 0;
      duelData.inventory = duelData.inventory.filter(i => {
        if (i === duelItem && removed < amount) { removed++; return false; }
        return true;
      });
      if (removed < amount) throw new Error(`Not enough ${duelItem}`);
    }
    else if (itemId.startsWith('pet:')) {
      const petId = itemId.slice(4);
      if (!petData.owned?.includes(petId)) throw new Error(`You don't own pet ${petId}`);
      // Remove only if they have enough (assume 1 per pet)
      const count = petData.owned.filter(id => id === petId).length;
      if (count < amount) throw new Error(`Not enough of pet ${petId}`);
      let removed = 0;
      petData.owned = petData.owned.filter(id => {
        if (id === petId && removed < amount) { removed++; return false; }
        return true;
      });
      // Also remove from active if present
      for (let i = 0; i < amount; i++) {
        const activeIdx = petData.active.indexOf(petId);
        if (activeIdx !== -1) petData.active.splice(activeIdx, 1);
      }
    }
    else {
      throw new Error(`Unknown item type: ${itemId}`);
    }
  }

  // Save back
  client.memory.set(farmKey, farmData);
  client.memory.set(miningKey, miningData);
  client.memory.set(dungeonKey, dungeonData);
  client.memory.set(duelKey, duelData);
  client.memory.set(petKey, petData);
}

// ── HELPER: ADD ITEMS TO STORAGE ──────────────────────────────────────────
async function addItems(client, guildId, userId, items) {
  const farmKey = `farm2_${guildId}_${userId}`;
  const miningKey = `mining2_${guildId}_${userId}`;
  const dungeonKey = `dungeon_${guildId}_${userId}`;
  const duelKey = `duel_${guildId}_${userId}`;
  const petKey = `pets_${guildId}_${userId}`;

  let farmData = client.memory.get(farmKey) || {};
  let miningData = client.memory.get(miningKey) || {};
  let dungeonData = client.memory.get(dungeonKey) || {};
  let duelData = client.memory.get(duelKey) || {};
  let petData = client.memory.get(petKey) || { owned: [], active: [] };

  for (const [itemId, amount] of Object.entries(items)) {
    if (itemId.startsWith('farm:crop:')) {
      const cropId = itemId.slice(11);
      farmData.inventory = farmData.inventory || {};
      farmData.inventory[cropId] = (farmData.inventory[cropId] || 0) + amount;
    }
    else if (itemId.startsWith('farm:fertilizer:')) {
      const fertId = itemId.slice(16);
      farmData.fertilizers = farmData.fertilizers || {};
      farmData.fertilizers[fertId] = (farmData.fertilizers[fertId] || 0) + amount;
    }
    else if (itemId === 'farm:crystal_crop') {
      farmData.crystalCrops = (farmData.crystalCrops || 0) + amount;
    }
    else if (itemId === 'farm:coins') {
      farmData.coins = (farmData.coins || 0) + amount;
    }
    else if (itemId.startsWith('mining:')) {
      const oreId = itemId.slice(7);
      miningData.inventory = miningData.inventory || {};
      miningData.inventory[oreId] = (miningData.inventory[oreId] || 0) + amount;
    }
    else if (itemId === 'mining:coins') {
      miningData.coins = (miningData.coins || 0) + amount;
    }
    else if (itemId.startsWith('dungeon:item:')) {
      const itemName = itemId.slice(14);
      dungeonData.inventory = dungeonData.inventory || [];
      for (let i = 0; i < amount; i++) dungeonData.inventory.push(itemName);
    }
    else if (itemId.startsWith('dungeon:potion:')) {
      const potId = itemId.slice(15);
      dungeonData.potions = dungeonData.potions || {};
      dungeonData.potions[potId] = (dungeonData.potions[potId] || 0) + amount;
    }
    else if (itemId.startsWith('dungeon:spell:')) {
      const spellId = itemId.slice(14);
      dungeonData.spells = dungeonData.spells || {};
      dungeonData.spells[spellId] = (dungeonData.spells[spellId] || 0) + amount;
    }
    else if (itemId === 'dungeon:gold') {
      dungeonData.gold = (dungeonData.gold || 0) + amount;
    }
    else if (itemId === 'duel:tokens') {
      duelData.tokens = (duelData.tokens || 0) + amount;
    }
    else if (itemId.startsWith('duel:')) {
      const duelItem = itemId.slice(5);
      duelData.inventory = duelData.inventory || [];
      for (let i = 0; i < amount; i++) duelData.inventory.push(duelItem);
    }
    else if (itemId.startsWith('pet:')) {
      const petId = itemId.slice(4);
      for (let i = 0; i < amount; i++) petData.owned.push(petId);
      // Optionally auto-activate? We'll not auto-activate to avoid conflicts.
    }
    else {
      // Owner-added custom items – just store as a generic custom item attached to duel module? We'll store in duel inventory with prefix "custom_"
      // To keep it simple, we'll append to duel inventory as `custom_${itemId}`
      duelData.inventory = duelData.inventory || [];
      for (let i = 0; i < amount; i++) duelData.inventory.push(`custom_${itemId}`);
    }
  }

  client.memory.set(farmKey, farmData);
  client.memory.set(miningKey, miningData);
  client.memory.set(dungeonKey, dungeonData);
  client.memory.set(duelKey, duelData);
  client.memory.set(petKey, petData);
}

// ── TRADE SESSION CLASS ────────────────────────────────────────────────────
class TradeSession {
  constructor(initiatorId, targetId, guildId) {
    this.initiatorId = initiatorId;
    this.targetId = targetId;
    this.guildId = guildId;
    this.offers = { [initiatorId]: {}, [targetId]: {} };
    this.ready = { [initiatorId]: false, [targetId]: false };
    this.createdAt = Date.now();
    this.active = true;
  }
}

// ── COMMAND ─────────────────────────────────────────────────────────────────
module.exports = {
  data: new SlashCommandBuilder()
    .setName('trade')
    .setDescription('Trade items with another player')
    .addSubcommand(sub =>
      sub.setName('offer')
        .setDescription('Start a trade with someone')
        .addUserOption(opt => opt.setName('user').setDescription('Who to trade with').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Add items to your current trade offer')
        .addStringOption(opt => opt.setName('item').setDescription('Item ID (use /trade inventory to see IDs)').setRequired(true))
        .addIntegerOption(opt => opt.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1))
    )
    .addSubcommand(sub => sub.setName('ready').setDescription('Ready up to finalize the trade'))
    .addSubcommand(sub => sub.setName('cancel').setDescription('Cancel the current trade'))
    .addSubcommand(sub => sub.setName('status').setDescription('View current trade offers'))
    .addSubcommand(sub => sub.setName('inventory').setDescription('Show all tradable items you own (with IDs)')),

  async execute(interaction, client) {
    await interaction.deferReply({ ephemeral: false });
    const userId = interaction.user.id;
    const guildId = interaction.guild.id;
    const sub = interaction.options.getSubcommand();

    // Find existing trade session
    let session = null;
    for (const [key, value] of client.memory.entries()) {
      if (key.startsWith(`trade_${guildId}_`) && value.active && (value.initiatorId === userId || value.targetId === userId)) {
        session = value;
        break;
      }
    }

    // ── INVENTORY ────────────────────────────────────────────────────
    if (sub === 'inventory') {
      const inv = getAllInventories(client, guildId, userId);
      if (Object.keys(inv).length === 0) {
        return interaction.editReply('📦 You have no tradable items. (Crops, ores, potions, tokens, pets, etc.)');
      }
      const lines = Object.entries(inv)
        .sort()
        .map(([id, qty]) => `\`${id}\`: ${qty}`);
      const embeds = [];
      let chunk = '';
      for (const line of lines) {
        if ((chunk + line + '\n').length > 1024) {
          embeds.push(new EmbedBuilder().setColor('#2f3136').setDescription(chunk));
          chunk = '';
        }
        chunk += line + '\n';
      }
      if (chunk) embeds.push(new EmbedBuilder().setColor('#2f3136').setDescription(chunk));
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#9b59b6').setTitle('📋 Your Tradable Items'), ...embeds] });
    }

    // ── OFFER ────────────────────────────────────────────────────────
    if (sub === 'offer') {
      if (session) return interaction.editReply('❌ You are already in a trade. Use `/trade cancel` first.');
      const target = interaction.options.getUser('user');
      if (target.id === userId) return interaction.editReply('❌ You cannot trade with yourself.');
      if (target.bot) return interaction.editReply('❌ Cannot trade with bots.');

      // Check if target is already in a trade
      for (const [key, value] of client.memory.entries()) {
        if (key.startsWith(`trade_${guildId}_`) && value.active && (value.initiatorId === target.id || value.targetId === target.id)) {
          return interaction.editReply(`❌ ${target.username} is already in a trade.`);
        }
      }

      const newSession = new TradeSession(userId, target.id, guildId);
      const sessionKey = `trade_${guildId}_${userId}_${target.id}`;
      client.memory.set(sessionKey, newSession);

      const embed = new EmbedBuilder()
        .setColor('#9b59b6')
        .setTitle('💱 Trade Offer Sent!')
        .setDescription(`**${interaction.user.username}** wants to trade with **${target.username}**.\nThey have 60 seconds to accept or decline.`)
        .addFields({ name: '⏳ To accept', value: `Use \`/trade add\` to add items, then \`/trade ready\`.`, inline: false });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`trade_accept_${sessionKey}`).setLabel('✅ Accept').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`trade_decline_${sessionKey}`).setLabel('❌ Decline').setStyle(ButtonStyle.Danger)
      );

      await interaction.editReply({ content: `<@${target.id}>`, embeds: [embed], components: [row] });
      const msg = await interaction.fetchReply();
      const collector = msg.createMessageComponentCollector({ time: 60000 });
      collector.on('collect', async btn => {
        try { await btn.deferUpdate(); } catch (e) { return; }
        if (btn.user.id !== target.id) return btn.followUp({ content: '❌ Not your trade.', ephemeral: true });
        const currentSession = client.memory.get(sessionKey);
        if (!currentSession || !currentSession.active) return btn.followUp({ content: '❌ Trade session expired.', ephemeral: true });
        if (btn.customId === `trade_accept_${sessionKey}`) {
          collector.stop('accepted');
          await msg.edit({ embeds: [new EmbedBuilder().setColor('#4caf50').setTitle('✅ Trade Accepted!').setDescription(`Trade started between ${interaction.user.username} and ${target.username}. Use \`/trade add\` to add items, then \`/trade ready\`.`)], components: [] }).catch(() => {});
        } else {
          collector.stop('declined');
          currentSession.active = false;
          client.memory.set(sessionKey, currentSession);
          await msg.edit({ embeds: [new EmbedBuilder().setColor('#ff0000').setTitle('❌ Trade Declined')], components: [] }).catch(() => {});
        }
      });
      collector.on('end', (_, reason) => {
        if (reason === 'time') {
          const expiredSession = client.memory.get(sessionKey);
          if (expiredSession) expiredSession.active = false;
          client.memory.set(sessionKey, expiredSession);
          msg.edit({ embeds: [new EmbedBuilder().setColor('#888888').setTitle('⏰ Trade Expired')], components: [] }).catch(() => {});
        }
      });
      return;
    }

    // ── ADD ──────────────────────────────────────────────────────────
    if (sub === 'add') {
      if (!session) return interaction.editReply('❌ You are not in an active trade. Use `/trade offer` first.');
      if (!session.active) return interaction.editReply('❌ This trade session is no longer active.');
      const item = interaction.options.getString('item');
      let amount = interaction.options.getInteger('amount');
      if (amount <= 0) return interaction.editReply('❌ Amount must be positive.');

      const isOwner = OWNER_IDS.includes(userId);
      const currentOffer = session.offers[userId] || {};

      if (!isOwner) {
        const inventory = getAllInventories(client, guildId, userId);
        const currentTotal = currentOffer[item] || 0;
        const available = inventory[item] || 0;
        if (available < currentTotal + amount) {
          return interaction.editReply(`❌ You don't have enough **${item}**. Have ${available}, trying to add ${amount} (already offered ${currentTotal}).`);
        }
      }

      session.offers[userId][item] = (session.offers[userId][item] || 0) + amount;
      if (session.offers[userId][item] <= 0) delete session.offers[userId][item];
      // Reset ready status when adding new items
      session.ready[userId] = false;
      session.ready[session.initiatorId === userId ? session.targetId : session.initiatorId] = false;
      client.memory.set(`trade_${guildId}_${session.initiatorId}_${session.targetId}`, session);

      return interaction.editReply(`✅ Added **${amount}x ${item}** to your offer. Use \`/trade ready\` when done.`);
    }

    // ── READY ────────────────────────────────────────────────────────
    if (sub === 'ready') {
      if (!session) return interaction.editReply('❌ You are not in a trade.');
      if (!session.active) return interaction.editReply('❌ Trade is no longer active.');
      if (session.ready[userId]) return interaction.editReply('✅ You already readied up!');
      session.ready[userId] = true;
      client.memory.set(`trade_${guildId}_${session.initiatorId}_${session.targetId}`, session);

      if (session.ready[session.initiatorId] && session.ready[session.targetId]) {
        // Execute trade
        try {
          // Remove items from both
          await removeItems(client, guildId, session.initiatorId, session.offers[session.initiatorId]);
          await removeItems(client, guildId, session.targetId, session.offers[session.targetId]);
          // Add items to opposite
          await addItems(client, guildId, session.targetId, session.offers[session.initiatorId]);
          await addItems(client, guildId, session.initiatorId, session.offers[session.targetId]);

          session.active = false;
          client.memory.set(`trade_${guildId}_${session.initiatorId}_${session.targetId}`, session);

          const initiatorName = (await client.users.fetch(session.initiatorId).catch(() => ({ username: 'Unknown' }))).username;
          const targetName = (await client.users.fetch(session.targetId).catch(() => ({ username: 'Unknown' }))).username;

          const successEmbed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('✅ Trade Completed!')
            .setDescription(`Items exchanged between **${initiatorName}** and **${targetName}**.`);

          await interaction.editReply({ embeds: [successEmbed] });
        } catch (err) {
          console.error('Trade execution error:', err);
          await interaction.editReply(`❌ Trade failed: ${err.message}. Cancelled.`);
          session.active = false;
          client.memory.set(`trade_${guildId}_${session.initiatorId}_${session.targetId}`, session);
        }
      } else {
        await interaction.editReply('✅ You are ready! Waiting for the other player to ready up.');
      }
    }

    // ── CANCEL ───────────────────────────────────────────────────────
    if (sub === 'cancel') {
      if (!session) return interaction.editReply('❌ You are not in a trade.');
      session.active = false;
      client.memory.set(`trade_${guildId}_${session.initiatorId}_${session.targetId}`, session);
      return interaction.editReply('🚫 Trade cancelled.');
    }

    // ── STATUS ───────────────────────────────────────────────────────
    if (sub === 'status') {
      if (!session) return interaction.editReply('❌ You are not in a trade.');
      if (!session.active) return interaction.editReply('❌ Trade is not active.');
      const initiatorId = session.initiatorId;
      const targetId = session.targetId;
      const initiatorName = (await client.users.fetch(initiatorId).catch(() => ({ username: 'Unknown' }))).username;
      const targetName = (await client.users.fetch(targetId).catch(() => ({ username: 'Unknown' }))).username;

      const initiatorOffers = Object.entries(session.offers[initiatorId]).map(([item, qty]) => `${qty}x ${item}`).join('\n') || 'Nothing';
      const targetOffers = Object.entries(session.offers[targetId]).map(([item, qty]) => `${qty}x ${item}`).join('\n') || 'Nothing';

      const embed = new EmbedBuilder()
        .setColor('#9b59b6')
        .setTitle('💱 Current Trade')
        .addFields(
          { name: `${initiatorName} offers`, value: initiatorOffers, inline: true },
          { name: `${targetName} offers`, value: targetOffers, inline: true },
          { name: '⚡ Ready Status', value: `${initiatorName}: ${session.ready[initiatorId] ? '✅ Ready' : '❌ Not ready'} | ${targetName}: ${session.ready[targetId] ? '✅ Ready' : '❌ Not ready'}`, inline: false }
        );
      return interaction.editReply({ embeds: [embed] });
    }
  }
};
