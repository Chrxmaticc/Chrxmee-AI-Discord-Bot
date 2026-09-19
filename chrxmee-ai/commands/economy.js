const {
  SlashCommandBuilder, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize,
  MessageFlags,
} = require('discord.js');

const { store, engine, constants } = require('../cogs/economy');
const {
  OWNER_ID, EMOJI, JOBS, SHOP_ITEMS, ACHIEVEMENTS, PRESTIGE_TIERS,
  DAILY_BASE, DAILY_STREAK_BONUS, DAILY_STREAK_MAX,
  display, totalSheckles, fromSheckles, prestigeFromEarned,
} = constants;

const V2_E = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;

const errBox = (m) => new ContainerBuilder().setAccentColor(0xff3b3b)
  .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${EMOJI.error} ${m}`));
const okBox = (m) => new ContainerBuilder().setAccentColor(0x57f287)
  .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${EMOJI.success} ${m}`));

const money = (cash, sheckles = 0) => display(cash, sheckles);
const totalMoney = (shecklesTotal) => {
  const { cash, sheckles } = fromSheckles(shecklesTotal);
  return money(cash, sheckles);
};

async function preflight(interaction) {
  await interaction.deferReply({ flags: V2_E }).catch(() => {});
  if (interaction.client?.pool) {
    try { store.setPool(interaction.client.pool); } catch {}
  }
}

function parseAmount(str) {
  const s = String(str).trim().toLowerCase();
  if (s === 'all') return { all: true };
  if (s === 'half') return { half: true };
  const m = s.match(/^(\d+(?:\.\d+)?)\s*([km])?$/);
  if (!m) return { invalid: true };
  let n = parseFloat(m[1]);
  if (m[2] === 'k') n *= 1000;
  if (m[2] === 'm') n *= 1000000;
  return { value: Math.floor(n) };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('economy')
    .setDescription('the chromed economy')
    .addSubcommand(s => s.setName('balance').setDescription('check your wallet')
      .addUserOption(o => o.setName('user').setDescription('check someone else')))
    .addSubcommand(s => s.setName('bank').setDescription('view your bank'))
    .addSubcommand(s => s.setName('deposit').setDescription('deposit cash into your bank')
      .addStringOption(o => o.setName('amount').setDescription('amount or "all"/"half"').setRequired(true).setMaxLength(12)))
    .addSubcommand(s => s.setName('withdraw').setDescription('withdraw cash from your bank')
      .addStringOption(o => o.setName('amount').setDescription('amount or "all"/"half"').setRequired(true).setMaxLength(12)))
    .addSubcommand(s => s.setName('interest').setDescription('claim your daily bank interest'))
    .addSubcommand(s => s.setName('daily').setDescription('claim your daily reward'))
    .addSubcommand(s => s.setName('work').setDescription('work your job for cash'))
    .addSubcommand(s => s.setName('job').setDescription('set your job')
      .addStringOption(o => o.setName('pick').setDescription('which job?').setRequired(true)
        .addChoices(...JOBS.map(j => ({ name: `${j.label} (${j.pay} / ${Math.round(j.cooldown / 60000)}m)`, value: j.id })))))
    .addSubcommand(s => s.setName('rob').setDescription('try to rob someone')
      .addUserOption(o => o.setName('user').setDescription('who?').setRequired(true)))
    .addSubcommand(s => s.setName('give').setDescription('give cash to someone (2% tax)')
      .addUserOption(o => o.setName('user').setDescription('who?').setRequired(true))
      .addStringOption(o => o.setName('amount').setDescription('amount').setRequired(true).setMaxLength(12)))
    .addSubcommand(s => s.setName('top').setDescription('richest players')
      .addIntegerOption(o => o.setName('page').setDescription('page number').setMinValue(1).setMaxValue(20)))
    .addSubcommand(s => s.setName('history').setDescription('your recent transactions')
      .addUserOption(o => o.setName('user').setDescription('someone else')))
    .addSubcommand(s => s.setName('stats').setDescription('your economy stats')
      .addUserOption(o => o.setName('user').setDescription('someone else')))
    .addSubcommand(s => s.setName('prestige').setDescription('view your prestige tier')
      .addUserOption(o => o.setName('user').setDescription('someone else')))
    .addSubcommand(s => s.setName('achievements').setDescription('your unlocked achievements')
      .addUserOption(o => o.setName('user').setDescription('someone else')))
    .addSubcommand(s => s.setName('shop').setDescription('browse the shop'))
    .addSubcommand(s => s.setName('buy').setDescription('buy something from the shop')
      .addStringOption(o => o.setName('item').setDescription('which item?').setRequired(true)
        .addChoices(...SHOP_ITEMS.map(i => ({ name: `${i.label} (${i.price})`, value: i.id })))))
    .addSubcommand(s => s.setName('info').setDescription('how the economy works'))
    .addSubcommand(s => s.setName('owner-give').setDescription('[owner] give cash')
      .addUserOption(o => o.setName('user').setDescription('target').setRequired(true))
      .addStringOption(o => o.setName('amount').setDescription('amount').setRequired(true).setMaxLength(12)))
    .addSubcommand(s => s.setName('owner-set').setDescription('[owner] set someone\'s balance')
      .addUserOption(o => o.setName('user').setDescription('target').setRequired(true))
      .addStringOption(o => o.setName('amount').setDescription('amount').setRequired(true).setMaxLength(12)))
    .addSubcommand(s => s.setName('owner-reset').setDescription('[owner] reset someone to 0')
      .addUserOption(o => o.setName('user').setDescription('target').setRequired(true)))
    .addSubcommand(s => s.setName('owner-pool').setDescription('[owner] view + drain the tax pool'))
    .addSubcommand(s => s.setName('owner-multiplier').setDescription('[owner] set a global income multiplier')
      .addNumberOption(o => o.setName('multiplier').setDescription('e.g. 1.5').setRequired(true).setMinValue(0.1).setMaxValue(10))
      .addIntegerOption(o => o.setName('hours').setDescription('duration in hours').setRequired(true).setMinValue(1).setMaxValue(168))),

  async execute(interaction) {
    await preflight(interaction);

    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const isOwner = userId === OWNER_ID;

    /* ══════════ BALANCE ══════════ */
    if (sub === 'balance') {
      const target = interaction.options.getUser('user') || interaction.user;
      const w = await store.getWallet(target.id);
      const bank = await store.getBank(target.id);
      const prestige = await store.getPrestige(target.id);
      const tier = prestigeFromEarned(Number(prestige.total_earned) / 100);
      const c = new ContainerBuilder().setAccentColor(0x5b7fd4);
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${EMOJI.cash} ${target.username}`));
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${tier.title} · prestige ${tier.level}`));
      c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `${EMOJI.upvote} **wallet** ${money(w.cash, w.sheckles)}\n${EMOJI.bank} **bank** ${money(Math.floor(bank.balance / 100), bank.balance % 100)}`
      ));
      const netTotal = w.cash * 100 + w.sheckles + Number(bank.balance);
      c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**net worth** ${totalMoney(netTotal)}`));
      return interaction.editReply({ components: [c], flags: V2_E });
    }

    /* ══════════ BANK ══════════ */
    if (sub === 'bank') {
      const bank = await store.getBank(userId);
      const prestige = await store.getPrestige(userId);
      const tier = prestigeFromEarned(Number(prestige.total_earned) / 100);
      const rate = Math.min(0.02, 0.005 + (tier.level - 1) * 0.001);
      const last = bank.last_interest_at ? new Date(bank.last_interest_at).getTime() : 0;
      const nextAt = last + 24 * 60 * 60 * 1000;
      const c = new ContainerBuilder().setAccentColor(0x5b7fd4);
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${EMOJI.bank} your bank`));
      c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `**stored** ${money(Math.floor(bank.balance / 100), bank.balance % 100)}\n**daily rate** \`${(rate * 100).toFixed(2)}%\`\n**next interest** <t:${Math.floor(nextAt / 1000)}:R>`
      ));
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# bank is safe from robbery, but limited to daily interest.`));
      return interaction.editReply({ components: [c], flags: V2_E });
    }

    /* ══════════ DEPOSIT / WITHDRAW ══════════ */
    if (sub === 'deposit' || sub === 'withdraw') {
      const raw = interaction.options.getString('amount');
      const parsed = parseAmount(raw);

      let amount;
      if (parsed.all) {
        if (sub === 'deposit') {
          const w = await store.getWallet(userId);
          amount = Math.floor((w.cash * 100 + w.sheckles) / 100);
        } else {
          const b = await store.getBank(userId);
          amount = Math.floor(Number(b.balance) / 100);
        }
      } else if (parsed.half) {
        if (sub === 'deposit') {
          const w = await store.getWallet(userId);
          amount = Math.floor((w.cash * 100 + w.sheckles) / 200);
        } else {
          const b = await store.getBank(userId);
          amount = Math.floor(Number(b.balance) / 200);
        }
      } else if (parsed.value) {
        amount = parsed.value;
      } else {
        return interaction.editReply({ components: [errBox('invalid amount. use a number, "all", or "half".')], flags: V2_E });
      }

      if (!amount || amount <= 0) return interaction.editReply({ components: [errBox('invalid amount.')], flags: V2_E });

      const r = sub === 'deposit'
        ? await engine.deposit(userId, amount)
        : await engine.withdraw(userId, amount);

      if (!r.ok) return interaction.editReply({ components: [errBox(r.reason)], flags: V2_E });

      const label = sub === 'deposit' ? 'deposited' : 'withdrew';
      const icon = sub === 'deposit' ? EMOJI.upvote : EMOJI.downvote;
      return interaction.editReply({
        components: [new ContainerBuilder().setAccentColor(0x57f287)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${icon} ${label}`))
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `**amount** ${money(amount)}\n**wallet** ${money(r.newWallet.cash, r.newWallet.sheckles)}\n**bank** ${money(r.newBank, 0)}`
          ))],
        flags: V2_E,
      });
    }

    /* ══════════ INTEREST ══════════ */
    if (sub === 'interest') {
      const r = await engine.accrueInterest(userId);
      if (!r.ok) {
        if (r.msLeft) return interaction.editReply({ components: [errBox(`interest on cooldown. next in <t:${Math.floor(r.nextAt / 1000)}:R>`)], flags: V2_E });
        return interaction.editReply({ components: [errBox(r.reason)], flags: V2_E });
      }
      if (r.interest <= 0) return interaction.editReply({ components: [errBox('not enough in the bank to earn interest yet.')], flags: V2_E });
      return interaction.editReply({
        components: [new ContainerBuilder().setAccentColor(0x57f287)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${EMOJI.bank} interest claimed`))
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `**earned** ${money(Math.floor(r.interest / 100), r.interest % 100)}\n**rate** \`${(r.rate * 100).toFixed(2)}%\`\n**new bank** ${money(r.newBank, 0)}`
          ))],
        flags: V2_E,
      });
    }

    /* ══════════ DAILY ══════════ */
    if (sub === 'daily') {
      const r = await engine.claimDaily(userId);
      if (!r.ok) {
        const nextAt = Math.floor((Date.now() + r.msLeft) / 1000);
        return interaction.editReply({ components: [errBox(`already claimed today. next daily <t:${nextAt}:R>`)], flags: V2_E });
      }
      const c = new ContainerBuilder().setAccentColor(0x57f287);
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${EMOJI.daily} daily claimed`));
      c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `**reward** ${money(r.cash, r.sheckles)}\n**streak** \`${r.streak} / ${DAILY_STREAK_MAX}\`${r.brokeStreak ? '\n-# your streak reset because you missed a day' : ''}`
      ));
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# come back tomorrow to keep your streak.`));
      return interaction.editReply({ components: [c], flags: V2_E });
    }

    /* ══════════ WORK ══════════ */
    if (sub === 'work') {
      const r = await engine.work(userId, guildId);
      const c = new ContainerBuilder().setAccentColor(0x57f287);
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${EMOJI.work} ${r.jobEmoji} you worked as a ${r.jobLabel}`));
      c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
      const lines = [`**paid** ${money(r.pay, r.sheckles)}`];
      if (r.multiplier > 1) lines.push(`**event** \`x${r.multiplier}\``);
      if (r.prestigeBonus > 1) lines.push(`**prestige** \`x${r.prestigeBonus.toFixed(2)}\``);
      lines.push(`**cooldown** \`${Math.round(r.cooldownMs / 60000)}m\``);
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')));
      if (!r.job) c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# set a job with \`/economy job\` to earn more.`));
      return interaction.editReply({ components: [c], flags: V2_E });
    }

    /* ══════════ JOB ══════════ */
    if (sub === 'job') {
      const picked = interaction.options.getString('pick');
      const job = JOBS.find(j => j.id === picked);
      if (!job) return interaction.editReply({ components: [errBox('unknown job.')], flags: V2_E });
      const prestige = await store.getPrestige(userId);
      const tier = prestigeFromEarned(Number(prestige.total_earned) / 100);
      if (tier.level < job.prestige) {
        return interaction.editReply({ components: [errBox(`you need prestige **${job.prestige}** for this job. you are prestige \`${tier.level}\`.`)], flags: V2_E });
      }
      await store.setJob(userId, job.id);
      return interaction.editReply({
        components: [new ContainerBuilder().setAccentColor(0x57f287)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${EMOJI.work} ${job.emoji} new job: ${job.label}`))
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `**pay** ${money(job.pay)}\n**cooldown** \`${Math.round(job.cooldown / 60000)}m\`\n-# ${job.desc}`
          ))],
        flags: V2_E,
      });
    }

    /* ══════════ ROB ══════════ */
    if (sub === 'rob') {
      const target = interaction.options.getUser('user');
      const r = await engine.rob(userId, target.id, guildId);
      if (!r.ok) return interaction.editReply({ components: [errBox(r.reason)], flags: V2_E });

      if (r.success) {
        return interaction.editReply({
          components: [new ContainerBuilder().setAccentColor(0x57f287)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${EMOJI.thief} robbery successful`))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`you stole ${money(Math.floor(r.take / 100), r.take % 100)} from <@${target.id}>.`))],
          flags: V2_E,
        });
      }
      return interaction.editReply({
        components: [new ContainerBuilder().setAccentColor(0xff3b3b)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${EMOJI.error} you got caught`))
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`you paid a fine of ${money(Math.floor(r.fine / 100), r.fine % 100)}.`))],
        flags: V2_E,
      });
    }

    /* ══════════ GIVE ══════════ */
    if (sub === 'give') {
      const target = interaction.options.getUser('user');
      const raw = interaction.options.getString('amount');
      const parsed = parseAmount(raw);
      let amount;
      if (parsed.all) {
        const w = await store.getWallet(userId);
        amount = Math.floor((w.cash * 100 + w.sheckles) / 100);
      } else if (parsed.half) {
        const w = await store.getWallet(userId);
        amount = Math.floor((w.cash * 100 + w.sheckles) / 200);
      } else {
        amount = parsed.value;
      }
      if (!amount || amount <= 0) return interaction.editReply({ components: [errBox('invalid amount.')], flags: V2_E });

      const r = await engine.give(userId, target.id, amount);
      if (!r.ok) return interaction.editReply({ components: [errBox(r.reason)], flags: V2_E });

      return interaction.editReply({
        components: [new ContainerBuilder().setAccentColor(0x57f287)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${EMOJI.upvote} sent`))
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `you sent ${money(r.sent)} to <@${target.id}>\n**received** ${money(r.received)} · **tax** ${money(r.tax)}`
          ))],
        flags: V2_E,
      });
    }

    /* ══════════ TOP ══════════ */
    if (sub === 'top') {
      const page = interaction.options.getInteger('page') || 1;
      const limit = 10;
      const offset = (page - 1) * limit;
      const rows = await store.getLeaderboard(limit, offset);
      if (!rows.length) return interaction.editReply({ components: [errBox('nobody here yet.')], flags: V2_E });
      const lines = rows.map((r, i) => {
        const rank = offset + i + 1;
        const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `\`#${rank}\``;
        return `${medal} <@${r.userId}> · ${totalMoney(r.totalSheckles)}`;
      });
      const c = new ContainerBuilder().setAccentColor(0xf5c34a);
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${EMOJI.trophy} richest players · page ${page}`));
      c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')));
      return interaction.editReply({ components: [c], flags: V2_E });
    }

    /* ══════════ HISTORY ══════════ */
    if (sub === 'history') {
      const target = interaction.options.getUser('user') || interaction.user;
      const rows = await store.getHistory(target.id, 15);
      if (!rows.length) return interaction.editReply({ components: [errBox('no transactions yet.')], flags: V2_E });
      const lines = rows.map(h => {
        const icon = ['rob_loss', 'rob_fail', 'shop_buy', 'withdraw', 'give_out'].includes(h.type) ? EMOJI.downvote : EMOJI.upvote;
        const when = `<t:${Math.floor(new Date(h.created_at).getTime() / 1000)}:R>`;
        const counter = h.counterparty_id ? ` · <@${h.counterparty_id}>` : '';
        return `${icon} **${h.type}** · ${money(h.amount)}${counter} · ${when}`;
      });
      const c = new ContainerBuilder().setAccentColor(0x5b7fd4);
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${EMOJI.history} ${target.username} — recent activity`));
      c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')));
      return interaction.editReply({ components: [c], flags: V2_E });
    }

    /* ══════════ STATS ══════════ */
    if (sub === 'stats') {
      const target = interaction.options.getUser('user') || interaction.user;
      const p = await store.getPrestige(target.id);
      const w = await store.getWallet(target.id);
      const bank = await store.getBank(target.id);
      const earned = Number(p.total_earned) / 100;
      const spent = Number(p.total_spent) / 100;
      const given = Number(p.total_given) / 100;
      const received = Number(p.total_received) / 100;
      const tier = prestigeFromEarned(earned);
      const c = new ContainerBuilder().setAccentColor(0x5b7fd4);
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${EMOJI.info} ${target.username} — stats`));
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${tier.title} · prestige ${tier.level}`));
      c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent([
        `${EMOJI.upvote} **earned** ${money(Math.floor(earned))}`,
        `${EMOJI.downvote} **spent** ${money(Math.floor(spent))}`,
        `${EMOJI.friends} **given** ${money(Math.floor(given))}`,
        `${EMOJI.upvote} **received** ${money(Math.floor(received))}`,
        `${EMOJI.bank} **bank** ${money(Math.floor(Number(bank.balance) / 100))}`,
      ].join('\n')));
      return interaction.editReply({ components: [c], flags: V2_E });
    }

    /* ══════════ PRESTIGE ══════════ */
    if (sub === 'prestige') {
      const target = interaction.options.getUser('user') || interaction.user;
      const p = await store.getPrestige(target.id);
      const earned = Number(p.total_earned) / 100;
      const tier = prestigeFromEarned(earned);
      const next = engine.nextPrestigeTier(earned);
      const c = new ContainerBuilder().setAccentColor(0x5b7fd4);
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${EMOJI.promotion} ${target.username}`));
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# **${tier.title}** · level \`${tier.level}\``));
      c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `**total earned** ${money(Math.floor(earned))}`
      ));
      if (next) {
        const pct = Math.min(100, Math.round((earned / next.earned) * 100));
        const filled = Math.round((pct / 100) * 20);
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
          `**next tier** ${next.title} at ${money(next.earned)}\n\`${'█'.repeat(filled)}${'░'.repeat(20 - filled)}\` ${pct}%`
        ));
      } else {
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`${EMOJI.crown} you have reached the highest tier.`));
      }
      return interaction.editReply({ components: [c], flags: V2_E });
    }

    /* ══════════ ACHIEVEMENTS ══════════ */
    if (sub === 'achievements') {
      const target = interaction.options.getUser('user') || interaction.user;
      const unlocked = await store.listAchievements(target.id);
      const unlockedIds = new Set(unlocked.map(u => u.achievement_id));
      const lines = ACHIEVEMENTS.map(a => {
        const done = unlockedIds.has(a.id);
        const icon = done ? EMOJI.success : EMOJI.off;
        return `${icon} **${a.label}** · ${money(a.reward)}\n-# ${a.desc}`;
      });
      const c = new ContainerBuilder().setAccentColor(0x5b7fd4);
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${EMOJI.achievements} ${target.username} — achievements`));
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${unlocked.length} / ${ACHIEVEMENTS.length} unlocked`));
      c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')));
      return interaction.editReply({ components: [c], flags: V2_E });
    }

    /* ══════════ SHOP ══════════ */
    if (sub === 'shop') {
      const lines = SHOP_ITEMS.map(i => `${i.emoji} **${i.label}** · ${money(i.price)}\n-# ${i.desc}${i.consumable ? ' *(consumable)*' : ' *(permanent)*'}`);
      const c = new ContainerBuilder().setAccentColor(0x5b7fd4);
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${EMOJI.shop} shop`));
      c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n\n')));
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# use \`/economy buy\` to purchase`));
      return interaction.editReply({ components: [c], flags: V2_E });
    }

    /* ══════════ BUY ══════════ */
    if (sub === 'buy') {
      const itemId = interaction.options.getString('item');
      const r = await engine.buyItem(userId, itemId);
      if (!r.ok) return interaction.editReply({ components: [errBox(r.reason)], flags: V2_E });
      return interaction.editReply({
        components: [new ContainerBuilder().setAccentColor(0x57f287)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${r.item.emoji} bought ${r.item.label}`))
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `**paid** ${money(r.item.price)}\n**balance** ${money(r.wallet.cash, r.wallet.sheckles)}`
          ))],
        flags: V2_E,
      });
    }

    /* ══════════ INFO ══════════ */
    if (sub === 'info') {
      const c = new ContainerBuilder().setAccentColor(0x5b7fd4);
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${EMOJI.info} how the economy works`));
      c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent([
        `**cash** is your main currency. **sheckles** are 1/100th of a dollar.`,
        `**daily** pays ${money(DAILY_BASE)}+ based on your streak (caps at day ${DAILY_STREAK_MAX}).`,
        `**work** pays per job cooldown. jobs unlock at higher **prestige**.`,
        `**prestige** rises with total lifetime earnings. it boosts work pay, interest, and unlocks jobs.`,
        `**bank** keeps your cash safe from robbers and earns daily interest.`,
        `**rob** has a 45% success rate — fail and you pay 10% of your wallet as a fine.`,
        `**give** transfers with a 2% tax on the recipient side.`,
        `**shop items** can boost income, protect from rob, or unlock cosmetics.`,
      ].join('\n')));
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# everything shares one wallet — gambling and pets use this balance too.`));
      return interaction.editReply({ components: [c], flags: V2_E });
    }

    /* ══════════ OWNER ══════════ */
    if (sub.startsWith('owner-')) {
      if (!isOwner) return interaction.editReply({ components: [errBox('owner only.')], flags: V2_E });

      if (sub === 'owner-give') {
        const target = interaction.options.getUser('user');
        const raw = interaction.options.getString('amount');
        const parsed = parseAmount(raw);
        const amount = parsed.value;
        if (!amount || amount <= 0) return interaction.editReply({ components: [errBox('invalid amount.')], flags: V2_E });
        const w = await store.addValue(target.id, amount);
        await store.trackEarned(target.id, amount);
        await store.logTransaction(target.id, 'owner_give', amount, { counterparty: userId, note: 'owner grant' });
        return interaction.editReply({
          components: [okBox(`gave ${money(amount)} to <@${target.id}>.\n**their balance** ${money(w.cash, w.sheckles)}`)],
          flags: V2_E,
        });
      }

      if (sub === 'owner-set') {
        const target = interaction.options.getUser('user');
        const raw = interaction.options.getString('amount');
        const parsed = parseAmount(raw);
        const amount = parsed.value;
        if (amount === undefined || amount < 0) return interaction.editReply({ components: [errBox('invalid amount.')], flags: V2_E });
        const w = await store.setWallet(target.id, amount, 0);
        await store.logTransaction(target.id, 'owner_set', amount, { counterparty: userId });
        return interaction.editReply({
          components: [okBox(`set <@${target.id}> to ${money(w.cash, w.sheckles)}.`)],
          flags: V2_E,
        });
      }

      if (sub === 'owner-reset') {
        const target = interaction.options.getUser('user');
        await store.setWallet(target.id, 0, 0);
        await store.setBank(target.id, 0);
        await store.logTransaction(target.id, 'owner_reset', 0, { counterparty: userId });
        return interaction.editReply({ components: [okBox(`reset <@${target.id}> to zero.`)], flags: V2_E });
      }

      if (sub === 'owner-pool') {
        const pool = await store.getPool(guildId);
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('econ_drain').setLabel('drain pool').setStyle(ButtonStyle.Danger),
        );
        const c = new ContainerBuilder().setAccentColor(0x5b7fd4);
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${EMOJI.info} tax pool`));
        c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
          `**current pool** ${money(Math.floor(Number(pool.tax_pool) / 100))}\n**global multiplier** \`x${Number(pool.global_multiplier).toFixed(2)}\``
        ));
        c.addActionRowComponents(row);
        await interaction.editReply({ components: [c], flags: V2_E });
        const msg = await interaction.fetchReply();
        const click = await new Promise(resolve => {
          const col = msg.createMessageComponentCollector({ time: 30000, max: 1, filter: i => i.user.id === userId });
          col.on('collect', i => resolve(i));
          col.on('end', (_, r) => { if (r === 'time') resolve(null); });
        });
        if (click && click.customId === 'econ_drain') {
          await click.deferUpdate().catch(() => {});
          const drained = await store.drainPool(guildId);
          const w = await store.addValue(userId, Math.floor(drained / 100));
          return interaction.editReply({
            components: [okBox(`drained ${money(Math.floor(drained / 100))} to your wallet.`)],
            flags: V2_E,
          });
        }
        return;
      }

      if (sub === 'owner-multiplier') {
        const mult = interaction.options.getNumber('multiplier');
        const hours = interaction.options.getInteger('hours');
        await store.setMultiplier(guildId, mult, hours);
        return interaction.editReply({
          components: [okBox(`set global multiplier to \`x${mult.toFixed(2)}\` for **${hours}h**.`)],
          flags: V2_E,
        });
      }
    }
  },
};
