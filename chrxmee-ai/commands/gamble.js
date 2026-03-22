const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const OWNER_ID = '902685494247325776';

// ── COOLDOWNS ──────────────────────────────────────────────────────────────
const cooldowns = new Map();
const COOLDOWN_MS = 7000;

function checkCooldown(userId, game) {
  const key = `${userId}_${game}`;
  const last = cooldowns.get(key);
  if (last && Date.now() - last < COOLDOWN_MS) {
    return Math.ceil((COOLDOWN_MS - (Date.now() - last)) / 1000);
  }
  cooldowns.set(key, Date.now());
  return 0;
}

// ── DEFAULT DATA ───────────────────────────────────────────────────────────
function getDefaultGambleData() {
  return {
    coins: 5000, // start with 5000 coins — easy to get going
    debt: 0,
    totalWon: 0,
    totalLost: 0,
    gamesPlayed: 0,
  };
}

function migrateGambleData(data) {
  if (!data.coins && data.coins !== 0) data.coins = 5000;
  if (!data.debt && data.debt !== 0) data.debt = 0;
  if (!data.totalWon) data.totalWon = 0;
  if (!data.totalLost) data.totalLost = 0;
  if (!data.gamesPlayed) data.gamesPlayed = 0;
  return data;
}

// ── DEBT CHECK ─────────────────────────────────────────────────────────────
function hasDebt(data) {
  return data.debt > 0;
}

// ── SLOTS CONFIG ───────────────────────────────────────────────────────────
const SLOT_EMOJIS = ['🍒', '🍋', '🍊', '🍇', '💎', '7️⃣', '🎰', '⭐'];
const SLOT_MULTIPLIERS = {
  '💎💎💎': 50, '7️⃣7️⃣7️⃣': 25, '🎰🎰🎰': 20, '⭐⭐⭐': 15,
  '🍇🍇🍇': 10, '🍊🍊🍊': 8, '🍋🍋🍋': 6, '🍒🍒🍒': 4,
};

function spinSlots() {
  return [
    SLOT_EMOJIS[Math.floor(Math.random() * SLOT_EMOJIS.length)],
    SLOT_EMOJIS[Math.floor(Math.random() * SLOT_EMOJIS.length)],
    SLOT_EMOJIS[Math.floor(Math.random() * SLOT_EMOJIS.length)],
  ];
}

function getSlotMultiplier(reels) {
  const key = reels.join('');
  if (SLOT_MULTIPLIERS[key]) return SLOT_MULTIPLIERS[key];
  if (reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2]) return 2;
  return 0;
}

// ── ROULETTE CONFIG ────────────────────────────────────────────────────────
const RED_NUMBERS = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
function getRouletteColor(n) {
  if (n === 0) return 'green';
  return RED_NUMBERS.includes(n) ? 'red' : 'black';
}

// ── GIVE GAMBLE COINS (reward for playing) ─────────────────────────────────
function awardPlayCoins(data, won) {
  // Everyone gets coins for playing — winners get more
  const base = Math.floor(Math.random() * 200) + 100; // 100-300 base
  const bonus = won ? Math.floor(Math.random() * 500) + 200 : 0; // 200-700 bonus for winning
  data.coins += base + bonus;
  return base + bonus;
}

// ── LOG RESULT ─────────────────────────────────────────────────────────────
function logResult(data, bet, won) {
  data.gamesPlayed++;
  if (won) {
    data.totalWon += bet;
    // Reduce debt if any
    if (data.debt > 0) {
      data.debt = Math.max(0, data.debt - Math.floor(bet * 0.5));
    }
  } else {
    data.totalLost += bet;
    // If coins go negative, put into debt
    if (data.coins < 0) {
      data.debt += Math.abs(data.coins);
      data.coins = 0;
    }
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gamble')
    .setDescription('Gamble your coins in various games')
    .addSubcommand(sub => sub.setName('stats').setDescription('View your gambling stats and coin balance'))
    .addSubcommand(sub => sub.setName('daily').setDescription('Claim your daily gambling coins (500-2000)'))
    .addSubcommand(sub =>
      sub.setName('coinflip')
        .setDescription('Flip a coin — 50/50 chance!')
        .addIntegerOption(opt => opt.setName('bet').setDescription('Amount to bet').setRequired(true).setMinValue(1))
        .addStringOption(opt => opt.setName('side').setDescription('Heads or tails').setRequired(true)
          .addChoices({ name: '🪙 Heads', value: 'heads' }, { name: '🪙 Tails', value: 'tails' }))
    )
    .addSubcommand(sub =>
      sub.setName('dice')
        .setDescription('Roll a dice — pick a number 1-6!')
        .addIntegerOption(opt => opt.setName('bet').setDescription('Amount to bet').setRequired(true).setMinValue(1))
        .addIntegerOption(opt => opt.setName('number').setDescription('Pick 1-6').setRequired(true).setMinValue(1).setMaxValue(6))
    )
    .addSubcommand(sub =>
      sub.setName('slots')
        .setDescription('Spin the slot machine!')
        .addIntegerOption(opt => opt.setName('bet').setDescription('Amount to bet').setRequired(true).setMinValue(1))
    )
    .addSubcommand(sub =>
      sub.setName('roulette')
        .setDescription('Bet on red, black or a specific number!')
        .addIntegerOption(opt => opt.setName('bet').setDescription('Amount to bet').setRequired(true).setMinValue(1))
        .addStringOption(opt => opt.setName('choice').setDescription('red, black or a number 0-36').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('blackjack')
        .setDescription('Play blackjack vs the bot!')
        .addIntegerOption(opt => opt.setName('bet').setDescription('Amount to bet').setRequired(true).setMinValue(1))
    )
    .addSubcommand(sub =>
      sub.setName('challenge')
        .setDescription('Challenge another player to blackjack!')
        .addUserOption(opt => opt.setName('opponent').setDescription('Who to challenge').setRequired(true))
        .addIntegerOption(opt => opt.setName('bet').setDescription('Amount to bet').setRequired(true).setMinValue(1))
    )
    .addSubcommand(sub =>
      sub.setName('paydebt')
        .setDescription('Pay off your gambling debt')
        .addIntegerOption(opt => opt.setName('amount').setDescription('Amount to pay').setRequired(true).setMinValue(1))
    )
    .addSubcommand(sub =>
      sub.setName('give')
        .setDescription('(Owner only) Give gamble coins to a user')
        .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
        .addIntegerOption(opt => opt.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1))
    ),

  async execute(interaction, client) {
    try { await interaction.deferReply({ ephemeral: false }); }
    catch (err) { return interaction.reply({ content: 'Failed.', ephemeral: true }).catch(() => {}); }

    const userId = interaction.user.id;
    const guildId = interaction.guild.id;
    const username = interaction.user.username;
    const key = `gamble_${guildId}_${userId}`;

    let data = client.memory.get(key) || getDefaultGambleData();
    data = migrateGambleData(data);

    const sub = interaction.options.getSubcommand();

    // ── GIVE (owner only) ──────────────────────────────────
    if (sub === 'give') {
      if (userId !== OWNER_ID) return interaction.editReply('❌ Owner only.');
      const target = interaction.options.getUser('user');
      const amount = interaction.options.getInteger('amount');
      const tKey = `gamble_${guildId}_${target.id}`;
      let tData = client.memory.get(tKey) || getDefaultGambleData();
      tData = migrateGambleData(tData);
      tData.coins += amount;
      client.memory.set(tKey, tData);
      return interaction.editReply(`✅ Gave **${amount.toLocaleString()} gamble coins** to **${target.username}**!`);
    }

    // ── DAILY ─────────────────────────────────────────────
    if (sub === 'daily') {
      const dailyKey = `gamble_daily_${userId}`;
      const lastDaily = client.memory.get(dailyKey);
      const now = Date.now();
      if (lastDaily && now - lastDaily < 86400000) {
        const remaining = Math.ceil((86400000 - (now - lastDaily)) / 3600000);
        return interaction.editReply(`⏰ Already claimed today! Come back in **${remaining}h**.`);
      }
      const reward = Math.floor(Math.random() * 1500) + 500; // 500-2000
      data.coins += reward;
      client.memory.set(dailyKey, now);
      client.memory.set(key, data);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#FFD700').setTitle('🎁 Daily Coins Claimed!').setDescription(`You received **${reward.toLocaleString()} gamble coins**!`).addFields({ name: '💰 Total Coins', value: data.coins.toLocaleString(), inline: true })] });
    }

    // ── STATS ─────────────────────────────────────────────
    if (sub === 'stats') {
      const embed = new EmbedBuilder()
        .setColor(data.debt > 0 ? '#ff0000' : '#FFD700')
        .setTitle(`🎰 ${username}'s Gambling Stats`)
        .addFields(
          { name: '💰 Coins',       value: data.coins.toLocaleString(),     inline: true },
          { name: '💸 Debt',        value: data.debt > 0 ? `**${data.debt.toLocaleString()}** ⚠️` : 'None', inline: true },
          { name: '🎮 Games Played',value: data.gamesPlayed.toLocaleString(), inline: true },
          { name: '✅ Total Won',   value: data.totalWon.toLocaleString(),   inline: true },
          { name: '❌ Total Lost',  value: data.totalLost.toLocaleString(),  inline: true },
        )
        .setFooter({ text: data.debt > 0 ? '⚠️ Pay your debt with /gamble paydebt to play again!' : 'Use /gamble daily for free coins!' });
      return interaction.editReply({ embeds: [embed] });
    }

    // ── PAY DEBT ───────────────────────────────────────────
    if (sub === 'paydebt') {
      if (data.debt <= 0) return interaction.editReply('✅ You have no debt!');
      const amount = interaction.options.getInteger('amount');
      if (data.coins < amount) return interaction.editReply(`❌ Not enough coins! You have **${data.coins.toLocaleString()}** but need **${amount.toLocaleString()}**.`);
      data.coins -= amount;
      data.debt = Math.max(0, data.debt - amount);
      client.memory.set(key, data);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(data.debt > 0 ? '#ff9900' : '#00ff00').setTitle('💸 Debt Payment').addFields({ name: '💰 Paid', value: amount.toLocaleString(), inline: true }, { name: '💸 Remaining Debt', value: data.debt > 0 ? data.debt.toLocaleString() : 'CLEARED! ✅', inline: true }, { name: '💰 Coins Left', value: data.coins.toLocaleString(), inline: true })] });
    }

    // ── DEBT BLOCK ─────────────────────────────────────────
    if (hasDebt(data)) {
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#ff0000').setTitle('💸 You\'re In Debt!').setDescription(`You owe **${data.debt.toLocaleString()} coins** before you can gamble again!\n\nUse \`/gamble paydebt <amount>\` to pay it off.\nEarn coins with \`/gamble daily\`!`)] });
    }

    // ── COINFLIP ───────────────────────────────────────────
    if (sub === 'coinflip') {
      const cd = checkCooldown(userId, 'coinflip');
      if (cd > 0) return interaction.editReply(`⏰ Wait **${cd}s** before flipping again!`);

      const bet = interaction.options.getInteger('bet');
      const choice = interaction.options.getString('side');
      if (data.coins < bet) return interaction.editReply(`❌ Not enough coins! You have **${data.coins.toLocaleString()}**.`);

      const result = Math.random() < 0.5 ? 'heads' : 'tails';
      const won = result === choice;
      const payout = won ? bet : -bet;
      data.coins += payout;
      const playReward = awardPlayCoins(data, won);
      logResult(data, bet, won);
      client.memory.set(key, data);

      return interaction.editReply({ embeds: [new EmbedBuilder()
        .setColor(won ? '#00ff00' : '#ff0000')
        .setTitle(`🪙 Coinflip — ${won ? 'YOU WIN!' : 'YOU LOSE!'}`)
        .setDescription(`The coin landed on **${result === 'heads' ? '🪙 Heads' : '🪙 Tails'}**!`)
        .addFields(
          { name: '🎯 Your Pick', value: choice, inline: true },
          { name: '🪙 Result', value: result, inline: true },
          { name: won ? '✅ Won' : '❌ Lost', value: `${bet.toLocaleString()} coins`, inline: true },
          { name: '🎁 Play Reward', value: `+${playReward.toLocaleString()} coins`, inline: true },
          { name: '💰 Balance', value: data.coins.toLocaleString(), inline: true },
          { name: '💸 Debt', value: data.debt > 0 ? data.debt.toLocaleString() : 'None', inline: true }
        )] });
    }

    // ── DICE ───────────────────────────────────────────────
    if (sub === 'dice') {
      const cd = checkCooldown(userId, 'dice');
      if (cd > 0) return interaction.editReply(`⏰ Wait **${cd}s**!`);

      const bet = interaction.options.getInteger('bet');
      const pick = interaction.options.getInteger('number');
      if (data.coins < bet) return interaction.editReply(`❌ Not enough coins! You have **${data.coins.toLocaleString()}**.`);

      const roll = Math.floor(Math.random() * 6) + 1;
      const won = roll === pick;
      const payout = won ? bet * 5 : -bet;
      data.coins += payout;
      const playReward = awardPlayCoins(data, won);
      logResult(data, bet, won);
      client.memory.set(key, data);

      return interaction.editReply({ embeds: [new EmbedBuilder()
        .setColor(won ? '#00ff00' : '#ff0000')
        .setTitle(`🎲 Dice Roll — ${won ? 'YOU WIN! 5x!' : 'YOU LOSE!'}`)
        .setDescription(`The dice rolled **${roll}**!`)
        .addFields(
          { name: '🎯 Your Pick', value: `${pick}`, inline: true },
          { name: '🎲 Result', value: `${roll}`, inline: true },
          { name: won ? '✅ Won' : '❌ Lost', value: `${Math.abs(payout).toLocaleString()} coins`, inline: true },
          { name: '🎁 Play Reward', value: `+${playReward.toLocaleString()} coins`, inline: true },
          { name: '💰 Balance', value: data.coins.toLocaleString(), inline: true },
          { name: '💸 Debt', value: data.debt > 0 ? data.debt.toLocaleString() : 'None', inline: true }
        )] });
    }

    // ── SLOTS ──────────────────────────────────────────────
    if (sub === 'slots') {
      const cd = checkCooldown(userId, 'slots');
      if (cd > 0) return interaction.editReply(`⏰ Wait **${cd}s**!`);

      const bet = interaction.options.getInteger('bet');
      if (data.coins < bet) return interaction.editReply(`❌ Not enough coins! You have **${data.coins.toLocaleString()}**.`);

      const reels = spinSlots();
      const multiplier = getSlotMultiplier(reels);
      const won = multiplier > 0;
      const payout = won ? bet * multiplier - bet : -bet;
      data.coins += payout;
      const playReward = awardPlayCoins(data, won);
      logResult(data, bet, won);
      client.memory.set(key, data);

      return interaction.editReply({ embeds: [new EmbedBuilder()
        .setColor(won ? '#FFD700' : '#ff0000')
        .setTitle(`🎰 Slots — ${won ? `${multiplier}x WIN!` : 'NO MATCH!'}`)
        .setDescription(`## ${reels.join(' | ')}`)
        .addFields(
          { name: '🎯 Multiplier', value: won ? `${multiplier}x` : 'None', inline: true },
          { name: won ? '✅ Won' : '❌ Lost', value: `${Math.abs(payout).toLocaleString()} coins`, inline: true },
          { name: '🎁 Play Reward', value: `+${playReward.toLocaleString()} coins`, inline: true },
          { name: '💰 Balance', value: data.coins.toLocaleString(), inline: true },
          { name: '💸 Debt', value: data.debt > 0 ? data.debt.toLocaleString() : 'None', inline: true }
        )
        .setFooter({ text: '💎💎💎 = 50x | 7️⃣7️⃣7️⃣ = 25x | Any pair = 2x' })] });
    }

    // ── ROULETTE ───────────────────────────────────────────
    if (sub === 'roulette') {
      const cd = checkCooldown(userId, 'roulette');
      if (cd > 0) return interaction.editReply(`⏰ Wait **${cd}s**!`);

      const bet = interaction.options.getInteger('bet');
      const choice = interaction.options.getString('choice').toLowerCase().trim();
      if (data.coins < bet) return interaction.editReply(`❌ Not enough coins! You have **${data.coins.toLocaleString()}**.`);

      const spin = Math.floor(Math.random() * 37); // 0-36
      const spinColor = getRouletteColor(spin);
      let won = false, multiplier = 0;

      if (choice === 'red' || choice === 'black') {
        won = spinColor === choice;
        multiplier = 2;
      } else {
        const num = parseInt(choice);
        if (isNaN(num) || num < 0 || num > 36) return interaction.editReply('❌ Choose **red**, **black** or a number **0-36**!');
        won = spin === num;
        multiplier = 35;
      }

      const payout = won ? bet * multiplier - bet : -bet;
      data.coins += payout;
      const playReward = awardPlayCoins(data, won);
      logResult(data, bet, won);
      client.memory.set(key, data);

      const colorEmoji = spinColor === 'red' ? '🔴' : spinColor === 'black' ? '⚫' : '🟢';

      return interaction.editReply({ embeds: [new EmbedBuilder()
        .setColor(won ? '#00ff00' : '#ff0000')
        .setTitle(`🎡 Roulette — ${won ? `${multiplier}x WIN!` : 'YOU LOSE!'}`)
        .setDescription(`The ball landed on **${colorEmoji} ${spin}**!`)
        .addFields(
          { name: '🎯 Your Bet', value: choice, inline: true },
          { name: '🎡 Result', value: `${colorEmoji} ${spin}`, inline: true },
          { name: won ? '✅ Won' : '❌ Lost', value: `${Math.abs(payout).toLocaleString()} coins`, inline: true },
          { name: '🎁 Play Reward', value: `+${playReward.toLocaleString()} coins`, inline: true },
          { name: '💰 Balance', value: data.coins.toLocaleString(), inline: true },
          { name: '💸 Debt', value: data.debt > 0 ? data.debt.toLocaleString() : 'None', inline: true }
        )] });
    }

    // ── BLACKJACK (vs bot) ─────────────────────────────────
    if (sub === 'blackjack') {
      const cd = checkCooldown(userId, 'blackjack');
      if (cd > 0) return interaction.editReply(`⏰ Wait **${cd}s**!`);

      const bet = interaction.options.getInteger('bet');
      if (data.coins < bet) return interaction.editReply(`❌ Not enough coins! You have **${data.coins.toLocaleString()}**.`);

      const deck = () => {
        const v = Math.floor(Math.random() * 13) + 1;
        return Math.min(v, 10);
      };
      const handVal = (hand) => {
        let total = hand.reduce((a, b) => a + b, 0);
        let aces = hand.filter(c => c === 1).length;
        while (total <= 11 && aces > 0) { total += 10; aces--; }
        return total;
      };

      let playerHand = [deck(), deck()];
      let dealerHand = [deck(), deck()];

      const buildBJEmbed = (state = 'playing') => {
        const pVal = handVal(playerHand);
        const dVal = handVal(dealerHand);
        const embed = new EmbedBuilder().setColor('#2f3136').setTitle('🃏 Blackjack vs Bot');
        embed.addFields(
          { name: `🤖 Dealer ${state !== 'playing' ? `(${dVal})` : ''}`, value: state === 'playing' ? `${dealerHand[0]} + ❓` : dealerHand.join(' + '), inline: true },
          { name: `👤 You (${pVal})`, value: playerHand.join(' + '), inline: true }
        );
        if (state !== 'playing') {
          const busted = pVal > 21;
          const dealerBust = dVal > 21;
          const won = !busted && (dealerBust || pVal > dVal);
          const push = !busted && !dealerBust && pVal === dVal;
          embed.setColor(won ? '#00ff00' : push ? '#FFD700' : '#ff0000');
          embed.setTitle(`🃏 Blackjack — ${won ? 'YOU WIN!' : push ? 'PUSH!' : 'YOU LOSE!'}`);
        }
        return embed;
      };

      const bjRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('bj_hit').setLabel('👊 Hit').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('bj_stand').setLabel('🛑 Stand').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('bj_double').setLabel('💰 Double Down').setStyle(ButtonStyle.Success)
      );

      await interaction.editReply({ embeds: [buildBJEmbed()], components: [bjRow] });
      const bjMsg = await interaction.fetchReply();
      const collector = bjMsg.createMessageComponentCollector({ time: 60000 });
      let doubled = false;

      collector.on('collect', async btn => {
        try { await btn.deferUpdate(); } catch (e) { return; }
        if (btn.user.id !== userId) return btn.followUp({ content: '❌ Not your game!', ephemeral: true }).catch(() => {});

        if (btn.customId === 'bj_hit' || (btn.customId === 'bj_double' && !doubled)) {
          if (btn.customId === 'bj_double') {
            if (data.coins < bet * 2) return btn.followUp({ content: '❌ Not enough coins to double down!', ephemeral: true }).catch(() => {});
            doubled = true;
          }
          playerHand.push(deck());
          if (handVal(playerHand) > 21) {
            collector.stop('bust');
            const finalBet = doubled ? bet * 2 : bet;
            data.coins -= finalBet;
            const playReward = awardPlayCoins(data, false);
            logResult(data, finalBet, false);
            client.memory.set(key, data);
            const e = buildBJEmbed('end');
            e.addFields({ name: '💥 BUST!', value: `Lost **${finalBet.toLocaleString()}** coins`, inline: true }, { name: '🎁 Play Reward', value: `+${playReward.toLocaleString()}`, inline: true }, { name: '💰 Balance', value: data.coins.toLocaleString(), inline: true });
            await bjMsg.edit({ embeds: [e], components: [] }).catch(() => {});
          } else {
            await bjMsg.edit({ embeds: [buildBJEmbed()], components: doubled ? [] : [bjRow] }).catch(() => {});
            if (btn.customId === 'bj_double') collector.stop('stand');
          }
        }

        if (btn.customId === 'bj_stand' || btn.customId === 'bj_double' && doubled) {
          collector.stop('stand');
        }
      });

      collector.on('end', async (_, reason) => {
        if (reason === 'bust') return;
        // Dealer plays
        while (handVal(dealerHand) < 17) dealerHand.push(deck());
        const pVal = handVal(playerHand);
        const dVal = handVal(dealerHand);
        const busted = pVal > 21;
        const dealerBust = dVal > 21;
        const won = !busted && (dealerBust || pVal > dVal);
        const push = !busted && !dealerBust && pVal === dVal;
        const finalBet = doubled ? bet * 2 : bet;
        const payout = won ? finalBet : push ? 0 : -finalBet;
        data.coins += payout;
        const playReward = awardPlayCoins(data, won);
        logResult(data, finalBet, won);
        client.memory.set(key, data);

        const e = buildBJEmbed('end');
        e.addFields(
          { name: won ? '✅ Won' : push ? '🤝 Push' : '❌ Lost', value: `${Math.abs(payout).toLocaleString()} coins`, inline: true },
          { name: '🎁 Play Reward', value: `+${playReward.toLocaleString()}`, inline: true },
          { name: '💰 Balance', value: data.coins.toLocaleString(), inline: true },
          { name: '💸 Debt', value: data.debt > 0 ? data.debt.toLocaleString() : 'None', inline: true }
        );
        await bjMsg.edit({ embeds: [e], components: [] }).catch(() => {});
      });
      return;
    }

    // ── CHALLENGE (PvP Blackjack) ──────────────────────────
    if (sub === 'challenge') {
      const opponent = interaction.options.getUser('opponent');
      const bet = interaction.options.getInteger('bet');

      if (opponent.id === userId) return interaction.editReply('❌ You can\'t challenge yourself!');
      if (opponent.bot) return interaction.editReply('❌ You can\'t challenge a bot!');
      if (data.coins < bet) return interaction.editReply(`❌ Not enough coins! You have **${data.coins.toLocaleString()}**.`);

      const oppKey = `gamble_${guildId}_${opponent.id}`;
      let oppData = client.memory.get(oppKey) || getDefaultGambleData();
      oppData = migrateGambleData(oppData);

      if (hasDebt(oppData)) return interaction.editReply(`❌ **${opponent.username}** is in debt and can't gamble!`);
      if (oppData.coins < bet) return interaction.editReply(`❌ **${opponent.username}** doesn't have enough coins!`);

      const challengeEmbed = new EmbedBuilder().setColor('#FFD700')
        .setTitle('🃏 Blackjack Challenge!')
        .setDescription(`**${username}** challenged **${opponent.username}** to Blackjack!\nBet: **${bet.toLocaleString()} coins**`)
        .setFooter({ text: `${opponent.username} has 60 seconds to accept` });

      const acceptRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`bj_accept_${userId}`).setLabel('✅ Accept').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`bj_decline_${userId}`).setLabel('❌ Decline').setStyle(ButtonStyle.Danger)
      );

      await interaction.editReply({ embeds: [challengeEmbed], components: [acceptRow] });
      const challengeMsg = await interaction.fetchReply();
      const collector = challengeMsg.createMessageComponentCollector({ time: 60000 });

      collector.on('collect', async btn => {
        try { await btn.deferUpdate(); } catch (e) { return; }
        if (btn.user.id !== opponent.id) return btn.followUp({ content: '❌ Only the challenged player can respond!', ephemeral: true }).catch(() => {});

        if (btn.customId === `bj_decline_${userId}`) {
          collector.stop('declined');
          await challengeMsg.edit({ embeds: [new EmbedBuilder().setColor('#ff0000').setTitle('🃏 Challenge Declined').setDescription(`**${opponent.username}** declined the blackjack challenge.`)], components: [] }).catch(() => {});
          return;
        }

        if (btn.customId === `bj_accept_${userId}`) {
          collector.stop('accepted');
          // Play PvP blackjack
          const deck = () => Math.min(Math.floor(Math.random() * 13) + 1, 10);
          const handVal = (hand) => {
            let total = hand.reduce((a, b) => a + b, 0);
            let aces = hand.filter(c => c === 1).length;
            while (total <= 11 && aces > 0) { total += 10; aces--; }
            return total;
          };

          const p1Hand = [deck(), deck()];
          const p2Hand = [deck(), deck()];
          const p1Val = handVal(p1Hand);
          const p2Val = handVal(p2Hand);
          const p1Win = p1Val <= 21 && (p2Val > 21 || p1Val > p2Val);
          const push = p1Val === p2Val;

          if (p1Win) {
            data.coins += bet;
            oppData.coins -= bet;
          } else if (!push) {
            data.coins -= bet;
            oppData.coins += bet;
          }

          awardPlayCoins(data, p1Win);
          awardPlayCoins(oppData, !p1Win);
          logResult(data, bet, p1Win);
          logResult(oppData, bet, !p1Win);
          client.memory.set(key, data);
          client.memory.set(oppKey, oppData);

          await challengeMsg.edit({
            embeds: [new EmbedBuilder()
              .setColor(push ? '#FFD700' : p1Win ? '#00ff00' : '#ff0000')
              .setTitle(`🃏 PvP Blackjack — ${push ? 'TIE!' : p1Win ? `${username} wins!` : `${opponent.username} wins!`}`)
              .addFields(
                { name: `${username}`, value: `Hand: ${p1Hand.join(' + ')} = **${p1Val}**`, inline: true },
                { name: `${opponent.username}`, value: `Hand: ${p2Hand.join(' + ')} = **${p2Val}**`, inline: true },
                { name: '💰 Result', value: push ? 'No coins exchanged' : `**${bet.toLocaleString()}** coins transferred`, inline: false }
              )],
            components: []
          }).catch(() => {});
        }
      });

      collector.on('end', (_, reason) => {
        if (reason === 'time') challengeMsg.edit({ components: [] }).catch(() => {});
      });
    }
  }
};
