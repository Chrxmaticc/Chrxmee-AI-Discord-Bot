/* cogs/economy/engine.js */

const store = require('./store');
const {
  DAILY_BASE, DAILY_STREAK_BONUS, DAILY_STREAK_MAX, DAILY_SCHECKLES_BONUS, DAILY_COOLDOWN_MS,
  JOBS, WORK_COOLDOWN_MS, WORK_BASE_PAY,
  PRESTIGE_TIERS,
  BANK_INTEREST_BASE, BANK_INTEREST_PER_PRESTIGE, BANK_INTEREST_MAX, BANK_INTEREST_COOLDOWN_MS,
  ROB_COOLDOWN_MS, ROB_SUCCESS_CHANCE, ROB_MIN_TARGET, ROB_MAX_TAKE, ROB_FINE,
  GIVE_TAX_RATE,
  ACHIEVEMENTS, SHOP_ITEMS,
  totalSheckles, fromSheckles, prestigeFromEarned,
} = require('./constants');

/* ── helpers ── */
function clampSheckles(n) { return Math.max(0, Math.floor(Number(n) || 0)); }

/* ── daily ── */
async function claimDaily(userId) {
  const streakData = await store.getStreak(userId);
  const last = streakData.last_daily_at ? new Date(streakData.last_daily_at).getTime() : 0;
  const elapsed = Date.now() - last;

  if (elapsed < DAILY_COOLDOWN_MS) {
    return { ok: false, nextAt: last + DAILY_COOLDOWN_MS, msLeft: DAILY_COOLDOWN_MS - elapsed };
  }

  /* streak continuity: if over 48h since last, reset */
  const broke = last > 0 && elapsed > DAILY_COOLDOWN_MS * 2;
  const newStreak = broke ? 1 : Math.min((streakData.streak || 0) + 1, DAILY_STREAK_MAX);
  const cash = DAILY_BASE + (newStreak - 1) * DAILY_STREAK_BONUS;
  const sheckles = DAILY_SCHECKLES_BONUS * Math.min(newStreak, 10);

  /* apply */
  await store.addValue(userId, cash);
  await store.addSheckles(userId, sheckles);
  await store.setStreak(userId, newStreak, (streakData.total_dailies || 0) + 1);
  await store.trackEarned(userId, cash);
  await store.logTransaction(userId, 'daily', cash, { note: `streak ${newStreak}` });

  /* achievement checks */
  const totalDailies = (streakData.total_dailies || 0) + 1;
  if (totalDailies >= 7) await tryGrantAchievement(userId, 'daily_7');
  if (totalDailies >= 30) await tryGrantAchievement(userId, 'daily_30');

  return { ok: true, cash, sheckles, streak: newStreak, brokeStreak: broke };
}

/* ── work ── */
async function work(userId, guildId) {
  const prestige = await store.getPrestige(userId);
  const myLevel = prestigeFromEarned(Number(prestige.total_earned) / 100).level;
  const job = await store.getJob(userId);

  let pay = WORK_BASE_PAY;
  let usedJob = null;
  let cooldownMs = WORK_COOLDOWN_MS;

  if (job) {
    const jobDef = JOBS.find(j => j.id === job.job_id);
    if (jobDef && myLevel >= jobDef.prestige) {
      pay = jobDef.pay;
      cooldownMs = jobDef.cooldown;
      usedJob = jobDef;
    }
  }

  /* multiplier from pool */
  const mult = await store.getMultiplier(guildId);
  pay = Math.floor(pay * mult);

  /* item boost */
  const items = await store.getItems(userId);
  const hasWorkBoost = items.some(i => i.item_id === 'work_boost' && i.quantity > 0);
  if (hasWorkBoost) pay = Math.floor(pay * 1.25);

  /* prestige multiplier: +5% per tier above 1 */
  const prestigeBonus = 1 + (myLevel - 1) * 0.05;
  pay = Math.floor(pay * prestigeBonus);

  /* sheckle bonus: random 5-25% of pay */
  const sheckles = Math.floor(pay * (0.05 + Math.random() * 0.2));

  await store.addValue(userId, pay);
  if (sheckles > 0) await store.addSheckles(userId, sheckles);
  await store.trackEarned(userId, pay);
  await store.logTransaction(userId, 'work', pay, { note: usedJob ? usedJob.id : 'base work' });

  /* achievements */
  const wf = await store.getPrestige(userId); // re-read to keep state
  // work counter isn't tracked yet; we do a poor man's check via transactions
  const history = await store.getHistory(userId, 100);
  const workCount = history.filter(h => h.type === 'work').length;
  if (workCount >= 10) await tryGrantAchievement(userId, 'work_10');
  if (workCount >= 100) await tryGrantAchievement(userId, 'work_100');

  /* sheckle conversion achievements */
  const wallet = await store.getWallet(userId);
  const total = totalSheckles(wallet.cash, wallet.sheckles);
  if (total >= 100000) await tryGrantAchievement(userId, 'first_1k');
  if (total >= 1000000) await tryGrantAchievement(userId, 'first_10k');
  if (total >= 10000000) await tryGrantAchievement(userId, 'first_100k');
  if (total >= 100000000) await tryGrantAchievement(userId, 'first_1m');

  return {
    ok: true,
    pay,
    sheckles,
    job: usedJob,
    jobLabel: usedJob ? usedJob.label : 'odd jobs',
    jobEmoji: usedJob ? usedJob.emoji : '💼',
    cooldownMs,
    multiplier: mult,
    prestigeBonus,
  };
}

/* ── rob ── */
async function rob(robberId, targetId, guildId) {
  if (robberId === targetId) return { ok: false, reason: 'you cannot rob yourself.' };

  const targetWallet = await store.getWallet(targetId);
  const targetTotal = totalSheckles(targetWallet.cash, targetWallet.sheckles);
  if (targetTotal < ROB_MIN_TARGET * 100) return { ok: false, reason: 'target does not have enough cash.' };

  const robberWallet = await store.getWallet(robberId);
  const robberTotal = totalSheckles(robberWallet.cash, robberWallet.sheckles);

  /* rob shield check */
  const targetItems = await store.getItems(targetId);
  const hasShield = targetItems.some(i => i.item_id === 'shield' && i.quantity > 0);
  if (hasShield) return { ok: false, reason: 'target has a rob shield active.' };

  const success = Math.random() < ROB_SUCCESS_CHANCE;

  if (success) {
    const take = Math.floor(targetTotal * ROB_MAX_TAKE * (0.75 + Math.random() * 0.5));
    const newTarget = targetTotal - take;
    const tw = fromSheckles(newTarget);
    await store.setWallet(targetId, tw.cash, tw.sheckles);
    const newRobber = robberTotal + take;
    const rw = fromSheckles(newRobber);
    await store.setWallet(robberId, rw.cash, rw.sheckles);

    await store.trackEarned(robberId, Math.floor(take / 100));
    await store.trackSpent(targetId, Math.floor(take / 100));
    await store.logTransaction(robberId, 'rob_win', Math.floor(take / 100), { counterparty: targetId, note: 'successful rob' });
    await store.logTransaction(targetId, 'rob_loss', Math.floor(take / 100), { counterparty: robberId, note: 'robbed' });

    /* achievements */
    const history = await store.getHistory(robberId, 100);
    const robWins = history.filter(h => h.type === 'rob_win').length;
    if (robWins >= 1) await tryGrantAchievement(robberId, 'rob_1');
    if (robWins >= 10) await tryGrantAchievement(robberId, 'rob_10');

    return { ok: true, success: true, take, total: take };
  }

  /* caught — pay a fine */
  const fine = Math.floor(robberTotal * ROB_FINE);
  const newRobber = Math.max(0, robberTotal - fine);
  const rw = fromSheckles(newRobber);
  await store.setWallet(robberId, rw.cash, rw.sheckles);
  await store.trackSpent(robberId, Math.floor(fine / 100));
  await store.logTransaction(robberId, 'rob_fail', Math.floor(fine / 100), { counterparty: targetId, note: 'caught robbing' });

  return { ok: true, success: false, fine };
}

/* ── transfer (give) ── */
async function give(fromId, toId, dollars) {
  if (fromId === toId) return { ok: false, reason: 'you cannot give cash to yourself.' };
  if (dollars <= 0) return { ok: false, reason: 'amount must be positive.' };

  const cost = Math.round(dollars * 100);
  const fromWallet = await store.getWallet(fromId);
  const fromTotal = totalSheckles(fromWallet.cash, fromWallet.sheckles);
  if (fromTotal < cost) return { ok: false, reason: 'not enough cash.' };

  const tax = Math.floor(cost * GIVE_TAX_RATE);
  const netTo = cost - tax;

  /* deduct full cost from sender */
  const afterFrom = fromTotal - cost;
  const fw = fromSheckles(afterFrom);
  await store.setWallet(fromId, fw.cash, fw.sheckles);

  /* credit net */
  const toWallet = await store.getWallet(toId);
  const toTotal = totalSheckles(toWallet.cash, toWallet.sheckles);
  const afterTo = toTotal + netTo;
  const tw = fromSheckles(afterTo);
  await store.setWallet(toId, tw.cash, tw.sheckles);

  await store.trackGiven(fromId, dollars);
  await store.trackReceived(toId, Math.floor(netTo / 100));
  await store.logTransaction(fromId, 'give_out', dollars, { counterparty: toId, tax: Math.floor(tax / 100) });
  await store.logTransaction(toId, 'give_in', Math.floor(netTo / 100), { counterparty: fromId });

  /* achievements */
  const senderHistory = await store.getHistory(fromId, 100);
  const giveCount = senderHistory.filter(h => h.type === 'give_out').length;
  if (giveCount >= 1) await tryGrantAchievement(fromId, 'give_1');

  const senderPrestige = await store.getPrestige(fromId);
  if (Number(senderPrestige.total_given) >= 10000000) await tryGrantAchievement(fromId, 'give_100');

  return { ok: true, sent: dollars, received: Math.floor(netTo / 100), tax: Math.floor(tax / 100) };
}

/* ── bank ── */
async function deposit(userId, dollars) {
  if (dollars <= 0) return { ok: false, reason: 'amount must be positive.' };
  const cost = Math.round(dollars * 100);
  const wallet = await store.getWallet(userId);
  const total = totalSheckles(wallet.cash, wallet.sheckles);
  if (total < cost) return { ok: false, reason: 'not enough cash in wallet.' };

  const afterWallet = total - cost;
  const w = fromSheckles(afterWallet);
  await store.setWallet(userId, w.cash, w.sheckles);

  const bank = await store.getBank(userId);
  const newBank = Number(bank.balance) + cost;
  await store.setBank(userId, newBank);
  await store.logTransaction(userId, 'deposit', dollars);

  if (newBank >= 100000) await tryGrantAchievement(userId, 'bank_first');

  return { ok: true, deposited: dollars, newWallet: w, newBank: Math.floor(newBank / 100) };
}

async function withdraw(userId, dollars) {
  if (dollars <= 0) return { ok: false, reason: 'amount must be positive.' };
  const cost = Math.round(dollars * 100);
  const bank = await store.getBank(userId);
  if (bank.balance < cost) return { ok: false, reason: 'not enough in the bank.' };

  const afterBank = Number(bank.balance) - cost;
  await store.setBank(userId, afterBank);

  const wallet = await store.getWallet(userId);
  const total = totalSheckles(wallet.cash, wallet.sheckles) + cost;
  const w = fromSheckles(total);
  await store.setWallet(userId, w.cash, w.sheckles);
  await store.logTransaction(userId, 'withdraw', dollars);

  return { ok: true, withdrew: dollars, newWallet: w, newBank: Math.floor(afterBank / 100) };
}

async function accrueInterest(userId) {
  const bank = await store.getBank(userId);
  if (bank.balance <= 0) return { ok: false, reason: 'no funds in bank.' };

  const last = bank.last_interest_at ? new Date(bank.last_interest_at).getTime() : 0;
  if (Date.now() - last < BANK_INTEREST_COOLDOWN_MS) {
    return { ok: false, msLeft: BANK_INTEREST_COOLDOWN_MS - (Date.now() - last), nextAt: last + BANK_INTEREST_COOLDOWN_MS };
  }

  const prestige = await store.getPrestige(userId);
  const level = prestigeFromEarned(Number(prestige.total_earned) / 100).level;
  const rate = Math.min(BANK_INTEREST_MAX, BANK_INTEREST_BASE + (level - 1) * BANK_INTEREST_PER_PRESTIGE);
  const interest = Math.floor(Number(bank.balance) * rate);

  if (interest > 0) {
    await store.setBank(userId, Number(bank.balance) + interest);
    await store.trackEarned(userId, interest / 100);
    await store.logTransaction(userId, 'interest', interest / 100, { note: `${(rate * 100).toFixed(2)}%` });
  }
  await store.setBankInterestTime(userId, new Date());

  return { ok: true, interest, rate, newBank: Math.floor((Number(bank.balance) + interest) / 100) };
}

/* ── achievements ── */
async function tryGrantAchievement(userId, achievementId) {
  const def = ACHIEVEMENTS.find(a => a.id === achievementId);
  if (!def) return null;
  if (await store.hasAchievement(userId, achievementId)) return null;

  await store.grantAchievement(userId, achievementId);
  if (def.reward > 0) {
    await store.addValue(userId, def.reward);
    await store.trackEarned(userId, def.reward);
    await store.logTransaction(userId, 'achievement_reward', def.reward, { note: def.id });
  }
  return def;
}

/* ── shop ── */
async function buyItem(userId, itemId) {
  const item = SHOP_ITEMS.find(i => i.id === itemId);
  if (!item) return { ok: false, reason: 'unknown item.' };

  /* non-consumables are one-time */
  if (!item.consumable && await store.hasItem(userId, itemId)) {
    return { ok: false, reason: 'you already own this.' };
  }

  const spend = await store.spendValue(userId, item.price);
  if (!spend.ok) return { ok: false, reason: 'not enough cash.' };

  await store.addItem(userId, itemId, 1);
  await store.trackSpent(userId, item.price);
  await store.logTransaction(userId, 'shop_buy', item.price, { note: item.id });

  return { ok: true, item, wallet: spend.wallet };
}

/* ── prestige helpers ── */
function prestigeTierFor(earnedSheckles) {
  return prestigeFromEarned(earnedSheckles);
}
function nextPrestigeTier(earnedSheckles) {
  for (const t of PRESTIGE_TIERS) {
    if (earnedSheckles < t.earned) return t;
  }
  return null;
}

module.exports = {
  claimDaily,
  work,
  rob,
  give,
  deposit, withdraw, accrueInterest,
  tryGrantAchievement,
  buyItem,
  prestigeTierFor, nextPrestigeTier,
};
