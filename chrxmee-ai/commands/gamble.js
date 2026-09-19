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

/* ── recent bets per user (in-memory) ── */
const recentBets = new Map(); // userId -> [{game, bet, payout, net, at}]
function recordBet(userId, game, bet, payout) {
  const list = recentBets.get(userId) || [];
  list.unshift({ game, bet, payout, net: payout - bet, at: Date.now() });
  if (list.length > 20) list.pop();
  recentBets.set(userId, list);
}

/* ── parse bet: number, "all", "half", "double", or "10k"/"5m" ── */
function parseBet(input, balance, lastBet) {
  const s = String(input).trim().toLowerCase();
  if (s === 'all' || s === 'max') return Math.min(balance, MAX_BET);
  if (s === 'half') return Math.max(MIN_BET, Math.floor(balance / 2));
  if (s === 'double') return Math.max(MIN_BET, Math.min(balance, (lastBet || MIN_BET * 2) * 2));
  if (s === 'min') return MIN_BET;
  const km = s.match(/^(\d+(?:\.\d+)?)\s*([km])?$/);
  if (km) {
    let n = parseFloat(km[1]);
    if (km[2] === 'k') n *= 1000;
    if (km[2] === 'm') n *= 1000000;
    return Math.floor(n);
  }
  return NaN;
}

async function validateBet(userId, amount) {
  if (!Number.isFinite(amount) || amount < MIN_BET) return { ok: false, reason: `minimum bet is ${MIN_BET}` };
  if (amount > MAX_BET) return { ok: false, reason: `maximum bet is ${MAX_BET.toLocaleString()}` };
  const wallet = await store.loadUser(userId);
  if (wallet.balance < amount) return { ok: false, reason: `you only have ${EMOJI.cash} ${wallet.balance.toLocaleString()}` };
  if (Date.now() - wallet.lastBetAt < COOLDOWN_SECONDS * 1000) {
    const wait = Math.ceil((COOLDOWN_SECONDS * 1000 - (Date.now() - wallet.lastBetAt)) / 1000);
    return { ok: false, reason: `cooldown — wait ${wait}s` };
  }
  return { ok: true };
}

/* ── result view + double-or-nothing ── */
async function handleResult(interaction, userId, bet, payout, gameName, detail) {
  const win = payout > bet;
  const loss = payout === 0;

  if (win) await store.applyWin(userId, payout);
  else if (loss) await store.applyLoss(userId);
  else await store.applyWin(userId, payout);

  const after = await store.loadUser(userId);
  recordBet(userId, gameName, bet, payout);

  const color = win ? 0x57f287 : (loss ? 0xff3b3b : 0xf5c34a);
  const c = new ContainerBuilder().setAccentColor(color);
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${gameName}${win ? ' — win' : loss ? ' — loss' : ' — tie'}`));
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(detail));
  c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SpacerSmall()));
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

  /* offer double-or-nothing if it was a meaningful win */
  if (win && payout >= MIN_BET * 2) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('g_double').setLabel(`double-or-nothing (${(payout).toLocaleString()})`).setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('g_keep').setLabel('keep it').setStyle(ButtonStyle.Secondary),
    );
    c.addActionRowComponents(row);
    await interaction.editReply({ components: [c], flags: V2_E });
    const msg = await interaction.fetchReply();
    const click = await new Promise(resolve => {
      const col = msg.createMessageComponentCollector({ time: 20000, max: 1, filter: i => i.user.id === userId });
      col.on('collect', i => resolve(i));
      col.on('end', (_, r) => { if (r === 'time') resolve(null); });
    });
    if (click && click.customId === 'g_double') {
      await click.deferUpdate().catch(() => {});
      /* 50/50 — double or lose the payout */
      const winDouble = Math.random() < 0.5;
      if (winDouble) {
        await store.applyWin(userId, payout);
      } else {
        await store.applyWin(userId, -payout).catch(() => {});
        /* since applyWin only adds, do a direct subtract */
        const w = await store.loadUser(userId);
        w.balance -= payout;
        if (w.balance < 0) w.balance = 0;
        w.losses++;
        await store.saveUser(userId);
      }
      const after2 = await store.loadUser(userId);
      recordBet(userId, 'double-or-nothing', payout, winDouble ? payout * 2 : 0);
      const c2 = new ContainerBuilder().setAccentColor(winDouble ? 0x57f287 : 0xff3b3b);
      c2.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${winDouble ? EMOJI.jackpot + ' doubled!' : EMOJI.error + ' busted'}`));
      c2.addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `${winDouble ? `you doubled **${payout.toLocaleString()}** → **${(payout * 2).toLocaleString()}**` : `you lost **${payout.toLocaleString()}**`}\n**balance:** ${cash(after2.balance)}`
      ));
      if (winDouble && payout * 2 >= BIG_WIN_THRESHOLD) {
        await interaction.channel.send({
          components: [new ContainerBuilder().setAccentColor(0xf5c34a)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${EMOJI.jackpot} **doubled for a big win!** ${EMOJI.jackpot}`))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`<@${userId}> doubled to ${cash(payout * 2)}`))],
          flags: MessageFlags.IsComponentsV2,
        }).catch(() => {});
      }
      return interaction.editReply({ components: [c2], flags: V2_E });
    }
    /* keep it */
    c.addActionRowComponents(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('g_kept').setLabel('kept').setStyle(ButtonStyle.Success).setDisabled(true)
    ));
    return interaction.editReply({ components: [c], flags: V2_E }).catch(() => {});
  }

  return interaction.editReply({ components: [c], flags: V2_E });
}

function SpacerSmall() { return SeparatorSpacingSize.Small; }

/* ── common game runner ── */
async function runGame(interaction, userId, gameName, betInput, playFn) {
  const wallet = await store.loadUser(userId);
  const last = recentBets.get(userId)?.[0]?.bet;
  const bet = parseBet(betInput, wallet.balance, last);
  const v = await validateBet(userId, bet);
  if (!v.ok) return interaction.editReply({ components: [errBox(v.reason)], flags: V2_E });
  await store.applyBet(userId, bet);
  const result = playFn(bet);
  return handleResult(interaction, userId, bet, result.payout, gameName, result.detail);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gamble')
    .setDescription('gamble your cash')
    .addSubcommand(s => s.setName('balance').setDescription('check your balance')
      .addUserOption(o => o.setName('user').setDescription('check someone else')))
    .addSubcommand(s => s.setName('daily').setDescription('claim your daily cash'))
    .addSubcommand(s => s.setName('topup').setDescription('free cash when you are broke'))
    .addSubcommand(s => s.setName('stats').setDescription('your gambling stats'))
    .addSubcommand(s => s.setName('history').setDescription('your last 10 games'))
    .addSubcommand(s => s.setName('leaderboard').setDescription('richest gamblers'))
    .addSubcommand(s => s.setName('slots').setDescription('spin the slots')
      .addStringOption(o => o.setName('bet').setDescription('amount, "all", "half", "double", "10k"').setRequired(true).setMaxLength(12)))
    .addSubcommand(s => s.setName('coinflip').setDescription('flip a coin')
      .addStringOption(o => o.setName('bet').setDescription('amount or "all"/"half"').setRequired(true).setMaxLength(12))
      .addStringOption(o => o.setName('pick').setDescription('heads or tails').setRequired(true)
        .addChoices({ name: 'heads', value: 'heads' }, { name: 'tails', value: 'tails' })))
    .addSubcommand(s => s.setName('dice').setDescription('roll higher than the bot')
      .addStringOption(o => o.setName('bet').setDescription('amount or "all"/"half"').setRequired(true).setMaxLength(12)))
    .addSubcommand(s => s.setName('roulette').setDescription('spin the roulette')
      .addStringOption(o => o.setName('bet').setDescription('amount or "all"/"half"').setRequired(true).setMaxLength(12))
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
      .addStringOption(o => o.setName('bet').setDescription('amount or "all"/"half"').setRequired(true).setMaxLength(12)))
    .addSubcommand(s => s.setName('crash').setDescription('cash out before the crash')
      .addStringOption(o => o.setName('bet').setDescription('amount or "all"/"half"').setRequired(true).setMaxLength(12))
      .addNumberOption(o => o.setName('target').setDescription('cash out at this multiplier (e.g. 2.0)').setRequired(true).setMinValue(1.01).setMaxValue(50)))
    .addSubcommand(s => s.setName('horse').setDescription('pick a horse')
      .addStringOption(o => o.setName('bet').setDescription('amount or "all"/"half"').setRequired(true).setMaxLength(12))
      .addIntegerOption(o => o.setName('horse').setDescription('pick 1-6').setRequired(true).setMinValue(1).setMaxValue(6)))
    .addSubcommand(s => s.setName('blackjack').setDescription('play blackjack')
      .addStringOption(o => o.setName('bet').setDescription('amount or "all"/"half"').setRequired(true).setMaxLength(12))),

  async execute(interaction) {
    await interaction.deferReply({ flags: V2_E }).catch(() => {});

    /* self-attach the pool so we never need to touch the cog or ready.js */
    if (interaction.client?.pool) {
      try { store.setPool(interaction.client.pool); } catch {}
    }

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
      if (!r.ok) return interaction.editReply({ components: [errBox(`already claimed. next daily <t:${Math.floor(r.nextAt / 1000)}:R>`)], flags: V2_E });
      return interaction.editReply({ components: [okBox(`claimed ${cash(r.amount)}. balance: ${cash(r.balance)}`)], flags: V2_E });
    }

    /* ── topup (broke users) ── */
    if (sub === 'topup') {
      const w = await store.loadUser(userId);
      if (w.balance >= 100) {
        return interaction.editReply({ components: [errBox(`you have ${cash(w.balance)} — topup is only for broke players (<100).`)], flags: V2_E });
      }
      const now = Date.now();
      const lastTopup = w.lastTopupAt || 0;
      if (now - lastTopup < 60 * 60 * 1000) {
        const mins = Math.ceil((60 * 60 * 1000 - (now - lastTopup)) / 60000);
        return interaction.editReply({ components: [errBox(`topup on cooldown — ${mins} min left.`)], flags: V2_E });
      }
      w.balance = 200;
      w.lastTopupAt = now;
      await store.saveUser(userId);
      return interaction.editReply({ components: [okBox(`you were broke so here's **200** to keep playing.`)], flags: V2_E });
    }

    /* ── stats ── */
    if (sub === 'stats') {
      const w = await store.getStats(userId);
      const wins = w.wins || 0;
      const losses = w.losses || 0;
      const total = wins + losses;
      const rate = total > 0 ? Math.round((wins / total) * 100) : 0;
      const net = w.wagered > 0 ? Math.round((w.balance / w.wagered) * 100) : 0;
      const c = new ContainerBuilder().setAccentColor(0x5b7fd4);
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${EMOJI.file} your gambling stats`));
      c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `**balance:** ${cash(w.balance)}\n**wagered:** ${cash(w.wagered)}\n**wins:** \`${wins}\` · **losses:** \`${losses}\` · **winrate:** \`${rate}%\`\n**biggest win:** ${cash(w.biggestWin)}\n-# ROI: \`${net}%\``
      ));
      return interaction.editReply({ components: [c], flags: V2_E });
    }

    /* ── history ── */
    if (sub === 'history') {
      const list = recentBets.get(userId) || [];
      if (!list.length) return interaction.editReply({ components: [errBox('no recent games.')], flags: V2_E });
      const lines = list.slice(0, 10).map(b => {
        const icon = b.net > 0 ? EMOJI.success : b.net < 0 ? EMOJI.error : EMOJI.on;
        const netStr = b.net > 0 ? `+${b.net.toLocaleString()}` : b.net < 0 ? `${b.net.toLocaleString()}` : '0';
        return `${icon} **${b.game}** · bet \`${b.bet.toLocaleString()}\` → \`${b.payout.toLocaleString()}\` · ${netStr} · <t:${Math.floor(b.at / 1000)}:R>`;
      });
      const c = new ContainerBuilder().setAccentColor(0x5b7fd4);
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${EMOJI.folder} your last ${lines.length} game(s)`));
      c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')));
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
      const betInput = interaction.options.getString('bet');
      return runGame(interaction, userId, `${GAME_EMOJI.slots} slots`, betInput, (bet) => {
        const r = engine.spinSlots();
        const payout = Math.floor(bet * r.mult);
        const reels = r.reels.join(' ');
        return { payout, detail: `**${reels}**\n-# ${r.matchLabel}${r.mult > 0 ? ` · x${r.mult}` : ''}` };
      });
    }

    /* ── coinflip ── */
    if (sub === 'coinflip') {
      const betInput = interaction.options.getString('bet');
      const pick = interaction.options.getString('pick');
      return runGame(interaction, userId, `${GAME_EMOJI.coinflip} coinflip`, betInput, (bet) => {
        const r = engine.flipCoin(pick);
        return { payout: r.win ? bet * 2 : 0, detail: `landed **${r.result}** — you picked **${pick}**` };
      });
    }

    /* ── dice ── */
    if (sub === 'dice') {
      const betInput = interaction.options.getString('bet');
      return runGame(interaction, userId, `${GAME_EMOJI.dice} dice`, betInput, (bet) => {
        const r = engine.rollDice();
        let payout = 0;
        if (r.result === 'win') payout = bet * 2;
        else if (r.result === 'tie') payout = bet;
        return { payout, detail: `you rolled **${r.user}** · bot rolled **${r.bot}** · **${r.result}**` };
      });
    }

    /* ── roulette ── */
    if (sub === 'roulette') {
      const betInput = interaction.options.getString('bet');
      const on = interaction.options.getString('on');
      return runGame(interaction, userId, `${GAME_EMOJI.roulette} roulette`, betInput, (bet) => {
        const r = engine.roulettePayout(bet, on);
        const dot = r.color === 'red' ? '🔴' : r.color === 'black' ? '⚫' : '🟢';
        return { payout: r.payout, detail: `landed on **${r.number}** ${dot} \`${r.color}\`\nyou bet on \`${on}\`${r.mult > 0 ? ` · x${r.mult}` : ''}` };
      });
    }

    /* ── wheel ── */
    if (sub === 'wheel') {
      const betInput = interaction.options.getString('bet');
      return runGame(interaction, userId, `${GAME_EMOJI.wheel} wheel of fortune`, betInput, (bet) => {
        const r = engine.spinWheel();
        return { payout: Math.floor(bet * r.mult), detail: `landed on **${r.label}**${r.mult > 0 ? ` · x${r.mult}` : ''}` };
      });
    }

    /* ── crash ── */
    if (sub === 'crash') {
      const betInput = interaction.options.getString('bet');
      const target = interaction.options.getNumber('target');
      return runGame(interaction, userId, `${GAME_EMOJI.crash} crash`, betInput, (bet) => {
        const r = engine.playCrash(target);
        return { payout: r.win ? Math.floor(bet * target) : 0, detail: `crashed at **x${r.crashPoint}** · you cashed out at **x${target}**` };
      });
    }

    /* ── horse ── */
    if (sub === 'horse') {
      const betInput = interaction.options.getString('bet');
      const pick = interaction.options.getInteger('horse');
      return runGame(interaction, userId, `${GAME_EMOJI.horse} horse race`, betInput, (bet) => {
        const r = engine.runHorseRace(pick);
        return { payout: r.win ? bet * 5 : 0, detail: `winner: **horse #${r.winner}** · you picked **#${pick}**${r.win ? ' · x5!' : ''}` };
      });
    }

    /* ── blackjack (interactive) ── */
    if (sub === 'blackjack') {
      const betInput = interaction.options.getString('bet');
      const wallet = await store.loadUser(userId);
      const last = recentBets.get(userId)?.[0]?.bet;
      const bet = parseBet(betInput, wallet.balance, last);
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
      return handleResult(interaction, userId, bet, r.payout, `${GAME_EMOJI.blackjack} blackjack`,
        `dealer: ${engine.formatHand(game.dealer)} · total \`${engine.handTotal(game.dealer)}\`\nyou: ${engine.formatHand(game.player)} · total \`${engine.handTotal(game.player)}\`\n-# ${r.outcome.replace(/_/g, ' ')}`);
    }
  },
};
