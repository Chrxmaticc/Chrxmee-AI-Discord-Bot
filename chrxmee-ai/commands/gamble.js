const {
  SlashCommandBuilder, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize,
  MessageFlags,
} = require('discord.js');

const gambling = require('../cogs/gambling');
const { store, engine, constants } = gambling;
const { GAME_EMOJI, EMOJI, MIN_BET, MAX_BET, COOLDOWN_SECONDS, BIG_WIN_THRESHOLD } = constants;

const V2_E = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;

const errBox = (m) => new ContainerBuilder().setAccentColor(0xff3b3b)
  .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${EMOJI.error} ${m}`));
const okBox = (m) => new ContainerBuilder().setAccentColor(0x57f287)
  .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${EMOJI.success} ${m}`));
const cash = (n) => `${EMOJI.cash} **${Number(n).toLocaleString()}**`;

async function validateBet(userId, amount) {
  if (!amount || amount < MIN_BET) return { ok: false, reason: `minimum bet is ${MIN_BET}` };
  if (amount > MAX_BET) return { ok: false, reason: `maximum bet is ${MAX_BET.toLocaleString()}` };
  const wallet = await store.loadUser(userId);
  if (wallet.balance < amount) return { ok: false, reason: `you only have ${EMOJI.cash} ${wallet.balance.toLocaleString()}` };
  if (Date.now() - wallet.lastBetAt < COOLDOWN_SECONDS * 1000) {
    const wait = Math.ceil((COOLDOWN_SECONDS * 1000 - (Date.now() - wallet.lastBetAt)) / 1000);
    return { ok: false, reason: `cooldown — wait ${wait}s` };
  }
  return { ok: true };
}

async function handleResult(interaction, userId, bet, payout, gameName, detail) {
  const wallet = await store.loadUser(userId);
  const win = payout > bet;
  const loss = payout === 0;

  if (win) {
    await store.applyWin(userId, payout);
  } else if (loss) {
    await store.applyLoss(userId);
  } else {
    /* refund / tie */
    await store.applyWin(userId, payout);
  }
  const after = await store.loadUser(userId);

  const color = win ? 0x57f287 : (loss ? 0xff3b3b : 0xf5c34a);
  const c = new ContainerBuilder().setAccentColor(color);
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${gameName}${win ? ' — win' : loss ? ' — loss' : ' — tie'}`));
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(detail));
  c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
    `**bet:** ${cash(bet)}\n**payout:** ${cash(payout)}\n**balance:** ${cash(after.balance)}`
  ));

  /* big win announcement */
  if (payout >= BIG_WIN_THRESHOLD) {
    try {
      await interaction.channel.send({
        components: [new ContainerBuilder().setAccentColor(0xf5c34a)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${EMOJI.jackpot} **big win!** ${EMOJI.jackpot}`))
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`<@${userId}> just won ${cash(payout)} playing **${gameName}**`))],
        flags: MessageFlags.IsComponentsV2,
      }).catch(() => {});
    } catch {}
  }

  await store.applyBet(userId, -bet).catch(() => {}); // adjust wagered stat only if not already counted
  return interaction.editReply({ components: [c], flags: V2_E });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gamble')
    .setDescription('gamble your cash')
    .addSubcommand(s => s.setName('balance').setDescription('check your balance')
      .addUserOption(o => o.setName('user').setDescription('check someone else')))
    .addSubcommand(s => s.setName('daily').setDescription('claim your daily cash'))
    .addSubcommand(s => s.setName('stats').setDescription('your gambling stats'))
    .addSubcommand(s => s.setName('leaderboard').setDescription('richest gamblers'))
    .addSubcommand(s => s.setName('slots').setDescription('spin the slots')
      .addIntegerOption(o => o.setName('bet').setDescription('bet amount').setRequired(true).setMinValue(MIN_BET).setMaxValue(MAX_BET)))
    .addSubcommand(s => s.setName('coinflip').setDescription('flip a coin')
      .addIntegerOption(o => o.setName('bet').setDescription('bet amount').setRequired(true).setMinValue(MIN_BET).setMaxValue(MAX_BET))
      .addStringOption(o => o.setName('pick').setDescription('heads or tails').setRequired(true)
        .addChoices({ name: 'heads', value: 'heads' }, { name: 'tails', value: 'tails' })))
    .addSubcommand(s => s.setName('dice').setDescription('roll higher than the bot')
      .addIntegerOption(o => o.setName('bet').setDescription('bet amount').setRequired(true).setMinValue(MIN_BET).setMaxValue(MAX_BET)))
    .addSubcommand(s => s.setName('roulette').setDescription('spin the roulette')
      .addIntegerOption(o => o.setName('bet').setDescription('bet amount').setRequired(true).setMinValue(MIN_BET).setMaxValue(MAX_BET))
      .addStringOption(o => o.setName('on').setDescription('what to bet on').setRequired(true)
        .addChoices(
          { name: 'red (x2)', value: 'red' },
          { name: 'black (x2)', value: 'black' },
          { name: 'green (x14)', value: 'green' },
          { name: 'odd (x2)', value: 'odd' },
          { name: 'even (x2)', value: 'even' },
          { name: '1-12 (x3)', value: 'first12' },
          { name: '13-24 (x3)', value: 'second12' },
          { name: '25-36 (x3)', value: 'third12' },
        )))
    .addSubcommand(s => s.setName('wheel').setDescription('spin the wheel of fortune')
      .addIntegerOption(o => o.setName('bet').setDescription('bet amount').setRequired(true).setMinValue(MIN_BET).setMaxValue(MAX_BET)))
    .addSubcommand(s => s.setName('crash').setDescription('cash out before the crash')
      .addIntegerOption(o => o.setName('bet').setDescription('bet amount').setRequired(true).setMinValue(MIN_BET).setMaxValue(MAX_BET))
      .addNumberOption(o => o.setName('target').setDescription('cash out at this multiplier (e.g. 2.0)').setRequired(true).setMinValue(1.01).setMaxValue(50)))
    .addSubcommand(s => s.setName('horse').setDescription('pick a horse')
      .addIntegerOption(o => o.setName('bet').setDescription('bet amount').setRequired(true).setMinValue(MIN_BET).setMaxValue(MAX_BET))
      .addIntegerOption(o => o.setName('horse').setDescription('pick 1-6').setRequired(true).setMinValue(1).setMaxValue(6)))
    .addSubcommand(s => s.setName('blackjack').setDescription('play blackjack')
      .addIntegerOption(o => o.setName('bet').setDescription('bet amount').setRequired(true).setMinValue(MIN_BET).setMaxValue(MAX_BET))),

  async execute(interaction) {
    await interaction.deferReply({ flags: V2_E }).catch(() => {});
    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    const guildId = interaction.guildId;

    /* ── balance ── */
    if (sub === 'balance') {
      const target = interaction.options.getUser('user') || interaction.user;
      const wallet = await store.loadUser(target.id);
      const c = new ContainerBuilder().setAccentColor(0x5b7fd4);
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${EMOJI.cash} ${target.username}`));
      c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `**balance:** ${cash(wallet.balance)}\n**total wagered:** ${cash(wallet.wagered)}\n**wins:** \`${wallet.wins}\` · **losses:** \`${wallet.losses}\`\n**biggest win:** ${cash(wallet.biggestWin)}`
      ));
      return interaction.editReply({ components: [c], flags: V2_E });
    }

    /* ── daily ── */
    if (sub === 'daily') {
      const r = await store.claimDaily(userId);
      if (!r.ok) {
        return interaction.editReply({ components: [errBox(`already claimed. next daily <t:${Math.floor(r.nextAt / 1000)}:R>`)], flags: V2_E });
      }
      return interaction.editReply({ components: [okBox(`claimed ${cash(r.amount)}. balance: ${cash(r.balance)}`)], flags: V2_E });
    }

    /* ── stats ── */
    if (sub === 'stats') {
      const w = await store.getStats(userId);
      const c = new ContainerBuilder().setAccentColor(0x5b7fd4);
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${EMOJI.file} your gambling stats`));
      c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
      const wins = w.wins || 0;
      const losses = w.losses || 0;
      const total = wins + losses;
      const rate = total > 0 ? Math.round((wins / total) * 100) : 0;
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `**balance:** ${cash(w.balance)}\n**wagered:** ${cash(w.wagered)}\n**wins:** \`${wins}\` · **losses:** \`${losses}\` · **winrate:** \`${rate}%\`\n**biggest win:** ${cash(w.biggestWin)}`
      ));
      return interaction.editReply({ components: [c], flags: V2_E });
    }

    /* ── leaderboard ── */
    if (sub === 'leaderboard') {
      const rows = await store.getLeaderboard(10);
      if (!rows.length) return interaction.editReply({ components: [errBox('nobody has gambled yet.')], flags: V2_E });
      const lines = rows.map((r, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `\`#${i + 1}\``;
        return `${medal} <@${r.userId}> · ${cash(r.balance)}`;
      });
      const c = new ContainerBuilder().setAccentColor(0xf5c34a);
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${EMOJI.crown} richest gamblers`));
      c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')));
      return interaction.editReply({ components: [c], flags: V2_E });
    }

    /* ── slots ── */
    if (sub === 'slots') {
      const bet = interaction.options.getInteger('bet');
      const v = await validateBet(userId, bet);
      if (!v.ok) return interaction.editReply({ components: [errBox(v.reason)], flags: V2_E });
      await store.applyBet(userId, bet);

      const r = engine.spinSlots();
      const payout = Math.floor(bet * r.mult);
      const reels = r.reels.join(' ');
      return handleResult(interaction, userId, bet, payout, `${GAME_EMOJI.slots} slots`, `**${reels}**\n-# ${r.matchLabel}${r.mult > 0 ? ` · x${r.mult}` : ''}`);
    }

    /* ── coinflip ── */
    if (sub === 'coinflip') {
      const bet = interaction.options.getInteger('bet');
      const pick = interaction.options.getString('pick');
      const v = await validateBet(userId, bet);
      if (!v.ok) return interaction.editReply({ components: [errBox(v.reason)], flags: V2_E });
      await store.applyBet(userId, bet);

      const r = engine.flipCoin(pick);
      const payout = r.win ? bet * 2 : 0;
      return handleResult(interaction, userId, bet, payout, `${GAME_EMOJI.coinflip} coinflip`, `landed **${r.result}** — you picked **${pick}**`);
    }

    /* ── dice ── */
    if (sub === 'dice') {
      const bet = interaction.options.getInteger('bet');
      const v = await validateBet(userId, bet);
      if (!v.ok) return interaction.editReply({ components: [errBox(v.reason)], flags: V2_E });
      await store.applyBet(userId, bet);

      const r = engine.rollDice();
      let payout = 0;
      if (r.result === 'win') payout = bet * 2;
      else if (r.result === 'tie') payout = bet;
      return handleResult(interaction, userId, bet, payout, `${GAME_EMOJI.dice} dice`, `you rolled **${r.user}** · bot rolled **${r.bot}** · **${r.result}**`);
    }

    /* ── roulette ── */
    if (sub === 'roulette') {
      const bet = interaction.options.getInteger('bet');
      const on = interaction.options.getString('on');
      const v = await validateBet(userId, bet);
      if (!v.ok) return interaction.editReply({ components: [errBox(v.reason)], flags: V2_E });
      await store.applyBet(userId, bet);

      const r = engine.roulettePayout(bet, on);
      const colorDot = r.color === 'red' ? '🔴' : r.color === 'black' ? '⚫' : '🟢';
      return handleResult(interaction, userId, bet, r.payout, `${GAME_EMOJI.roulette} roulette`,
        `landed on **${r.number}** ${colorDot} \`${r.color}\`\nyou bet on \`${on}\`${r.mult > 0 ? ` · x${r.mult}` : ''}`);
    }

    /* ── wheel ── */
    if (sub === 'wheel') {
      const bet = interaction.options.getInteger('bet');
      const v = await validateBet(userId, bet);
      if (!v.ok) return interaction.editReply({ components: [errBox(v.reason)], flags: V2_E });
      await store.applyBet(userId, bet);

      const r = engine.spinWheel();
      const payout = Math.floor(bet * r.mult);
      return handleResult(interaction, userId, bet, payout, `${GAME_EMOJI.wheel} wheel of fortune`,
        `landed on **${r.label}**${r.mult > 0 ? ` · x${r.mult}` : ''}`);
    }

    /* ── crash ── */
    if (sub === 'crash') {
      const bet = interaction.options.getInteger('bet');
      const target = interaction.options.getNumber('target');
      const v = await validateBet(userId, bet);
      if (!v.ok) return interaction.editReply({ components: [errBox(v.reason)], flags: V2_E });
      await store.applyBet(userId, bet);

      const r = engine.playCrash(target);
      const payout = r.win ? Math.floor(bet * target) : 0;
      return handleResult(interaction, userId, bet, payout, `${GAME_EMOJI.crash} crash`,
        `crashed at **x${r.crashPoint}** · you cashed out at **x${target}**`);
    }

    /* ── horse ── */
    if (sub === 'horse') {
      const bet = interaction.options.getInteger('bet');
      const pick = interaction.options.getInteger('horse');
      const v = await validateBet(userId, bet);
      if (!v.ok) return interaction.editReply({ components: [errBox(v.reason)], flags: V2_E });
      await store.applyBet(userId, bet);

      const r = engine.runHorseRace(pick);
      const payout = r.win ? bet * 5 : 0;
      return handleResult(interaction, userId, bet, payout, `${GAME_EMOJI.horse} horse race`,
        `winner: **horse #${r.winner}** · you picked **#${pick}**${r.win ? ' · x5!' : ''}`);
    }

    /* ── blackjack (interactive) ── */
    if (sub === 'blackjack') {
      const bet = interaction.options.getInteger('bet');
      const v = await validateBet(userId, bet);
      if (!v.ok) return interaction.editReply({ components: [errBox(v.reason)], flags: V2_E });
      await store.applyBet(userId, bet);

      const game = engine.newBlackjack(guildId, userId, bet);
      const buildView = (g, revealDealer = false) => {
        const c = new ContainerBuilder().setAccentColor(0x5b7fd4);
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${GAME_EMOJI.blackjack} blackjack`));
        c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
          `**dealer:** ${engine.formatHand(g.dealer, !revealDealer)}${revealDealer ? ` · total \`${engine.handTotal(g.dealer)}\`` : ''}\n**you:** ${engine.formatHand(g.player)} · total \`${engine.handTotal(g.player)}\`\n**bet:** ${cash(g.bet)}`
        ));
        return c;
      };
      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('bj_hit').setLabel('hit').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('bj_stand').setLabel('stand').setStyle(ButtonStyle.Secondary),
      );

      await interaction.editReply({ components: [buildView(game), buttons], flags: V2_E });
      const msg = await interaction.fetchReply();

      /* interact */
      while (!game.done) {
        const click = await new Promise(resolve => {
          const col = msg.createMessageComponentCollector({ time: 120000, max: 1, filter: i => i.user.id === userId });
          col.on('collect', i => resolve(i));
          col.on('end', (_, r) => { if (r === 'time') resolve(null); });
        });
        if (!click) {
          engine.endBlackjack(guildId, userId);
          return interaction.editReply({ components: [errBox('blackjack timed out — bet forfeited.')], flags: V2_E }).catch(() => {});
        }
        if (click.customId === 'bj_hit') {
          await click.deferUpdate().catch(() => {});
          engine.bjHit(game);
          if (game.done) break;
          await interaction.editReply({ components: [buildView(game), buttons], flags: V2_E });
          continue;
        }
        if (click.customId === 'bj_stand') {
          await click.deferUpdate().catch(() => {});
          engine.bjStand(game);
          break;
        }
      }

      const r = engine.bjResult(game);
      engine.endBlackjack(guildId, userId);
      const payout = r.payout;
      return handleResult(interaction, userId, bet, payout, `${GAME_EMOJI.blackjack} blackjack`,
        `dealer: ${engine.formatHand(game.dealer)} · total \`${engine.handTotal(game.dealer)}\`\nyou: ${engine.formatHand(game.player)} · total \`${engine.handTotal(game.player)}\`\n-# ${r.outcome.replace(/_/g, ' ')}`);
    }
  },
};
