const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// ── PET DEFINITIONS ────────────────────────────────────────────────────────
// Games each pet supports: dungeon, mining, farm
const PETS = [
  {
    id: 'wolf',
    name: '🐺 Wolf',
    cost: 1500,
    rarity: 'Rare',
    games: ['dungeon'],
    passive: '+10 bonus combat damage in dungeon fights & boss strikes',
  },
  {
    id: 'dragon',
    name: '🐉 Baby Dragon',
    cost: 3000,
    rarity: 'Epic',
    games: ['dungeon'],
    passive: '+8 combat damage & +50 gold bonus on every boss kill',
  },
  {
    id: 'cat',
    name: '🐱 Cat',
    cost: 1000,
    rarity: 'Uncommon',
    games: ['dungeon'],
    passive: '+15 gold every dungeon room passively',
  },
  {
    id: 'fox',
    name: '🦊 Fox',
    cost: 1200,
    rarity: 'Uncommon',
    games: ['dungeon'],
    passive: '20% chance to steal +30 extra gold per dungeon room',
  },
  {
    id: 'bear',
    name: '🐻 Bear',
    cost: 2000,
    rarity: 'Rare',
    games: ['dungeon'],
    passive: 'Reduces ALL damage taken by 3 in dungeon (stacks with armor)',
  },
  {
    id: 'owl',
    name: '🦉 Owl',
    cost: 1800,
    rarity: 'Rare',
    games: ['mining'],
    passive: 'Warns you when cave-in risk hits 50%+ while mining',
  },
  {
    id: 'frog',
    name: '🐸 Frog',
    cost: 800,
    rarity: 'Common',
    games: ['farm'],
    passive: 'All crops grow 25% faster on your farm',
  },
];

function getDefaultPetData() {
  return {
    owned: [],    // array of pet ids
    active: [],   // array of active pet ids (multiple allowed)
  };
}

function migratePetData(data) {
  if (!data.owned) data.owned = [];
  if (!data.active) data.active = [];
  return data;
}

function getGameTag(games) {
  return games.map(g => {
    if (g === 'dungeon') return '⚔️ Dungeon';
    if (g === 'mining')  return '⛏️ Mining';
    if (g === 'farm')    return '🌾 Farm';
    return g;
  }).join(', ');
}

function getRarityColor(rarity) {
  switch (rarity) {
    case 'Common':   return '#aaaaaa';
    case 'Uncommon': return '#4caf50';
    case 'Rare':     return '#2196f3';
    case 'Epic':     return '#9c27b0';
    default:         return '#2f3136';
  }
}

function buildPetShopEmbed(data, dungeonData) {
  const gold = dungeonData?.gold || 0;
  const lines = PETS.map(p => {
    const owned = data.owned.includes(p.id);
    const active = data.active.includes(p.id);
    const status = owned ? (active ? ' ✅ Active' : ' 🔒 Owned') : '';
    return `${p.name} — **${p.cost}g** — ${getGameTag(p.games)}\n  └ *${p.passive}*${status}`;
  });
  return new EmbedBuilder()
    .setColor('#f0a500')
    .setTitle('🐾 Pet Shop')
    .setDescription(lines.join('\n\n'))
    .addFields({ name: '🪙 Your Dungeon Gold', value: `${gold}`, inline: true })
    .setFooter({ text: 'Pets are bought with dungeon gold. Multiple pets can be active at once!' });
}

function buildPetListEmbed(data, username) {
  if (data.owned.length === 0) {
    return new EmbedBuilder()
      .setColor('#2f3136')
      .setTitle(`🐾 ${username}'s Pets`)
      .setDescription('You don\'t own any pets yet! Visit `/pet shop` to buy one.')
      .setFooter({ text: 'Pets use dungeon gold to purchase' });
  }

  const lines = data.owned.map(id => {
    const pet = PETS.find(p => p.id === id);
    if (!pet) return null;
    const active = data.active.includes(id);
    return `${pet.name} ${active ? '✅ **Active**' : '💤 Inactive'} — ${getGameTag(pet.games)}\n  └ *${pet.passive}*`;
  }).filter(Boolean);

  return new EmbedBuilder()
    .setColor('#2f3136')
    .setTitle(`🐾 ${username}'s Pets`)
    .setDescription(lines.join('\n\n'))
    .setFooter({ text: 'Use /pet activate or /pet deactivate to manage active pets' });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pet')
    .setDescription('Buy, manage and activate pets across dungeon, mining and farm')
    .addSubcommand(sub => sub.setName('list').setDescription('View your owned pets'))
    .addSubcommand(sub => sub.setName('shop').setDescription('Buy pets with dungeon gold'))
    .addSubcommand(sub =>
      sub.setName('activate')
        .setDescription('Activate a pet')
        .addStringOption(opt =>
          opt.setName('pet').setDescription('Which pet to activate').setRequired(true)
            .addChoices(
              { name: '🐺 Wolf',        value: 'wolf'   },
              { name: '🐉 Baby Dragon', value: 'dragon' },
              { name: '🐱 Cat',         value: 'cat'    },
              { name: '🦊 Fox',         value: 'fox'    },
              { name: '🐻 Bear',        value: 'bear'   },
              { name: '🦉 Owl',         value: 'owl'    },
              { name: '🐸 Frog',        value: 'frog'   }
            )
        )
    )
    .addSubcommand(sub =>
      sub.setName('deactivate')
        .setDescription('Deactivate a pet')
        .addStringOption(opt =>
          opt.setName('pet').setDescription('Which pet to deactivate').setRequired(true)
            .addChoices(
              { name: '🐺 Wolf',        value: 'wolf'   },
              { name: '🐉 Baby Dragon', value: 'dragon' },
              { name: '🐱 Cat',         value: 'cat'    },
              { name: '🦊 Fox',         value: 'fox'    },
              { name: '🐻 Bear',        value: 'bear'   },
              { name: '🦉 Owl',         value: 'owl'    },
              { name: '🐸 Frog',        value: 'frog'   }
            )
        )
    )
    .addSubcommand(sub => sub.setName('info').setDescription('See what every pet does')),

  async execute(interaction, client) {
    try {
      await interaction.deferReply({ ephemeral: false });
    } catch (err) {
      console.error('Pet defer failed:', err);
      return interaction.reply({ content: 'Failed to start.', ephemeral: true }).catch(() => {});
    }

    const userId = interaction.user.id;
    const guildId = interaction.guild.id;
    const username = interaction.user.username;
    const key = `pets_${guildId}_${userId}`;
    const dungeonKey = `dungeon_${guildId}_${userId}`;

    let data = client.memory.get(key) || getDefaultPetData();
    data = migratePetData(data);

    const sub = interaction.options.getSubcommand();

    // ── INFO ───────────────────────────────────────────────
    if (sub === 'info') {
      const lines = PETS.map(p =>
        `${p.name} — **${p.cost}g** *(${p.rarity})* — ${getGameTag(p.games)}\n  └ ${p.passive}`
      );
      const embed = new EmbedBuilder()
        .setColor('#f0a500')
        .setTitle('🐾 All Pets')
        .setDescription(lines.join('\n\n'))
        .setFooter({ text: 'Multiple pets can be active at once. Buy with /pet shop using dungeon gold.' });
      return interaction.editReply({ embeds: [embed] });
    }

    // ── LIST ───────────────────────────────────────────────
    if (sub === 'list') {
      return interaction.editReply({ embeds: [buildPetListEmbed(data, username)] });
    }

    // ── ACTIVATE ───────────────────────────────────────────
    if (sub === 'activate') {
      const petId = interaction.options.getString('pet');
      const pet = PETS.find(p => p.id === petId);
      if (!pet) return interaction.editReply('❌ Unknown pet.');
      if (!data.owned.includes(petId)) return interaction.editReply(`❌ You don't own **${pet.name}**! Buy it from \`/pet shop\`.`);
      if (data.active.includes(petId)) return interaction.editReply(`✅ **${pet.name}** is already active!`);
      data.active.push(petId);
      client.memory.set(key, data);
      return interaction.editReply(`✅ **${pet.name}** is now active!\n*${pet.passive}*`);
    }

    // ── DEACTIVATE ─────────────────────────────────────────
    if (sub === 'deactivate') {
      const petId = interaction.options.getString('pet');
      const pet = PETS.find(p => p.id === petId);
      if (!pet) return interaction.editReply('❌ Unknown pet.');
      if (!data.active.includes(petId)) return interaction.editReply(`💤 **${pet.name}** isn't active.`);
      data.active = data.active.filter(id => id !== petId);
      client.memory.set(key, data);
      return interaction.editReply(`💤 **${pet.name}** deactivated.`);
    }

    // ── SHOP ───────────────────────────────────────────────
    if (sub === 'shop') {
      let dungeonData = client.memory.get(dungeonKey);

      const embed = buildPetShopEmbed(data, dungeonData);

      // Build buy buttons — 2 rows of 4
      const unowned = PETS.filter(p => !data.owned.includes(p.id));
      const rows = [];
      for (let i = 0; i < Math.min(PETS.length, 10); i += 5) {
        const slice = PETS.slice(i, i + 5);
        rows.push(new ActionRowBuilder().addComponents(
          slice.map(p => {
            const owned = data.owned.includes(p.id);
            const canAfford = (dungeonData?.gold || 0) >= p.cost;
            return new ButtonBuilder()
              .setCustomId(`pet_buy_${p.id}`)
              .setLabel(`${owned ? '✅' : ''} ${p.name.split(' ')[1] || p.name} (${p.cost}g)`)
              .setStyle(owned ? ButtonStyle.Secondary : canAfford ? ButtonStyle.Success : ButtonStyle.Danger)
              .setDisabled(owned);
          })
        ));
      }

      await interaction.editReply({ embeds: [embed], components: rows });
      const shopMsg = await interaction.fetchReply();
      const collector = shopMsg.createMessageComponentCollector({ time: 45000 });

      collector.on('collect', async btn => {
        try { await btn.deferUpdate(); } catch (e) { return; }
        if (btn.user.id !== userId) return;

        data = client.memory.get(key) || data;
        dungeonData = client.memory.get(dungeonKey);

        const petId = btn.customId.replace('pet_buy_', '');
        const pet = PETS.find(p => p.id === petId);
        if (!pet) return;

        if (data.owned.includes(petId)) {
          return btn.followUp({ content: `✅ You already own **${pet.name}**!`, ephemeral: true }).catch(() => {});
        }

        const currentGold = dungeonData?.gold || 0;
        if (currentGold < pet.cost) {
          return btn.followUp({
            content: `❌ Need **${pet.cost}g** dungeon gold, you have **${currentGold}g**.\nEarn gold by running \`/dungeon start\`!`,
            ephemeral: true
          }).catch(() => {});
        }

        // Deduct dungeon gold
        if (!dungeonData) {
          return btn.followUp({ content: '❌ You need to start a dungeon run first to register your gold.', ephemeral: true }).catch(() => {});
        }
        dungeonData.gold -= pet.cost;
        client.memory.set(dungeonKey, dungeonData);

        // Add to owned and auto-activate
        data.owned.push(petId);
        if (!data.active.includes(petId)) data.active.push(petId);
        client.memory.set(key, data);

        await btn.followUp({
          embeds: [new EmbedBuilder()
            .setColor(getRarityColor(pet.rarity))
            .setTitle(`🎉 ${pet.name} acquired!`)
            .setDescription(`*${pet.passive}*\n\nYour pet is **automatically active**! Use \`/pet deactivate\` if you want to turn it off.`)
            .addFields(
              { name: '🪙 Gold Spent',  value: `${pet.cost}g`,         inline: true },
              { name: '🪙 Gold Left',   value: `${dungeonData.gold}g`, inline: true },
              { name: '🎮 Works in',    value: getGameTag(pet.games),  inline: true }
            )],
          ephemeral: true
        }).catch(() => {});
      });

      collector.on('end', () => { shopMsg.edit({ components: [] }).catch(() => {}); });
    }
  }
};
