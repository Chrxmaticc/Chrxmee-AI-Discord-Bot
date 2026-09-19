/* cogs/economy/store.js */

let pool = null;
function setPool(p) { pool = p; console.log('[economy] pool attached:', !!p); }
function requirePool() { if (!pool) throw new Error('economy store: pool not attached'); }

const STARTING_CASH = 1000;

/* ═══════════ wallet ═══════════ */
async function getWallet(userId) {
  requirePool();
  let r = await pool.query(`SELECT balance, sheckles FROM gamble_wallet WHERE user_id = $1`, [userId]);
  if (!r.rows[0]) {
    r = await pool.query(
      `INSERT INTO gamble_wallet (user_id, balance, sheckles) VALUES ($1, $2, 0)
       ON CONFLICT (user_id) DO UPDATE SET user_id = $1 RETURNING balance, sheckles`,
      [userId, STARTING_CASH]
    );
  }
  return { cash: Number(r.rows[0].balance), sheckles: Number(r.rows[0].sheckles || 0) };
}

async function setWallet(userId, cash, sheckles) {
  requirePool();
  const total = (Number(cash) || 0) * 100 + (Number(sheckles) || 0);
  const c = Math.max(0, Math.floor(total / 100));
  const s = Math.max(0, total % 100);
  await pool.query(
    `INSERT INTO gamble_wallet (user_id, balance, sheckles) VALUES ($1, $2, $3)
     ON CONFLICT (user_id) DO UPDATE SET balance = $2, sheckles = $3`,
    [userId, c, s]
  );
  return { cash: c, sheckles: s };
}

async function spendValue(userId, dollars) {
  const cost = Math.round(Number(dollars) * 100);
  const w = await getWallet(userId);
  const total = w.cash * 100 + w.sheckles;
  if (total < cost) return { ok: false, wallet: w, needed: cost, have: total };
  const after = total - cost;
  const nw = await setWallet(userId, Math.floor(after / 100), after % 100);
  return { ok: true, wallet: nw, spent: cost };
}

async function addValue(userId, dollars) {
  const add = Math.round(Number(dollars) * 100);
  const w = await getWallet(userId);
  const total = w.cash * 100 + w.sheckles + add;
  return setWallet(userId, Math.floor(total / 100), total % 100);
}

async function addSheckles(userId, n) {
  const w = await getWallet(userId);
  const total = w.cash * 100 + w.sheckles + (Number(n) || 0);
  return setWallet(userId, Math.floor(total / 100), total % 100);
}

/* ═══════════ transactions ═══════════ */
async function logTransaction(userId, type, amount, opts = {}) {
  requirePool();
  await pool.query(
    `INSERT INTO economy_transactions (user_id, counterparty_id, type, amount, tax, note) VALUES ($1,$2,$3,$4,$5,$6)`,
    [userId, opts.counterparty || null, type, amount, opts.tax || 0, opts.note || null]
  );
}

async function getHistory(userId, limit = 15) {
  requirePool();
  const r = await pool.query(
    `SELECT * FROM economy_transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [userId, limit]
  );
  return r.rows;
}

/* ═══════════ streaks ═══════════ */
async function getStreak(userId) {
  requirePool();
  const r = await pool.query(`SELECT * FROM economy_streaks WHERE user_id = $1`, [userId]);
  return r.rows[0] || { user_id: userId, streak: 0, last_daily_at: null, total_dailies: 0 };
}

async function setStreak(userId, streak, totalDailies) {
  requirePool();
  await pool.query(
    `INSERT INTO economy_streaks (user_id, streak, last_daily_at, total_dailies) VALUES ($1,$2,NOW(),$3)
     ON CONFLICT (user_id) DO UPDATE SET streak = $2, last_daily_at = NOW(), total_dailies = $3`,
    [userId, streak, totalDailies]
  );
}

/* ═══════════ prestige ═══════════ */
async function getPrestige(userId) {
  requirePool();
  const r = await pool.query(`SELECT * FROM economy_prestige WHERE user_id = $1`, [userId]);
  if (!r.rows[0]) {
    await pool.query(`INSERT INTO economy_prestige (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [userId]);
    return { user_id: userId, level: 1, total_earned: 0, total_spent: 0, total_given: 0, total_received: 0 };
  }
  return r.rows[0];
}

async function trackEarned(userId, dollars) {
  requirePool();
  await pool.query(
    `INSERT INTO economy_prestige (user_id, total_earned) VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET total_earned = economy_prestige.total_earned + $2`,
    [userId, Math.round(dollars * 100)]
  );
}

async function trackSpent(userId, dollars) {
  requirePool();
  await pool.query(
    `INSERT INTO economy_prestige (user_id, total_spent) VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET total_spent = economy_prestige.total_spent + $2`,
    [userId, Math.round(dollars * 100)]
  );
}

async function trackGiven(userId, dollars) {
  requirePool();
  await pool.query(
    `INSERT INTO economy_prestige (user_id, total_given) VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET total_given = economy_prestige.total_given + $2`,
    [userId, Math.round(dollars * 100)]
  );
}

async function trackReceived(userId, dollars) {
  requirePool();
  await pool.query(
    `INSERT INTO economy_prestige (user_id, total_received) VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET total_received = economy_prestige.total_received + $2`,
    [userId, Math.round(dollars * 100)]
  );
}

/* ═══════════ achievements ═══════════ */
async function hasAchievement(userId, id) {
  requirePool();
  const r = await pool.query(`SELECT 1 FROM economy_achievements WHERE user_id = $1 AND achievement_id = $2`, [userId, id]);
  return r.rows.length > 0;
}

async function grantAchievement(userId, id) {
  requirePool();
  await pool.query(`INSERT INTO economy_achievements (user_id, achievement_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [userId, id]);
}

async function listAchievements(userId) {
  requirePool();
  const r = await pool.query(`SELECT achievement_id, unlocked_at FROM economy_achievements WHERE user_id = $1 ORDER BY unlocked_at ASC`, [userId]);
  return r.rows;
}

/* ═══════════ jobs ═══════════ */
async function getJob(userId) {
  requirePool();
  const r = await pool.query(`SELECT * FROM economy_jobs WHERE user_id = $1`, [userId]);
  return r.rows[0] || null;
}

async function setJob(userId, jobId) {
  requirePool();
  await pool.query(
    `INSERT INTO economy_jobs (user_id, job_id) VALUES ($1,$2) ON CONFLICT (user_id) DO UPDATE SET job_id = $2, set_at = NOW()`,
    [userId, jobId]
  );
}

/* ═══════════ items ═══════════ */
async function getItems(userId) {
  requirePool();
  const r = await pool.query(`SELECT item_id, quantity, bought_at FROM economy_items WHERE user_id = $1`, [userId]);
  return r.rows;
}

async function addItem(userId, itemId, qty = 1) {
  requirePool();
  await pool.query(
    `INSERT INTO economy_items (user_id, item_id, quantity) VALUES ($1,$2,$3)
     ON CONFLICT (user_id, item_id) DO UPDATE SET quantity = economy_items.quantity + $3`,
    [userId, itemId, qty]
  );
}

async function hasItem(userId, itemId) {
  const items = await getItems(userId);
  return items.some(i => i.item_id === itemId && i.quantity > 0);
}

/* ═══════════ pool + multiplier ═══════════ */
async function getPool(guildId) {
  requirePool();
  const r = await pool.query(`SELECT * FROM economy_pool WHERE guild_id = $1`, [guildId]);
  if (!r.rows[0]) {
    await pool.query(`INSERT INTO economy_pool (guild_id) VALUES ($1) ON CONFLICT DO NOTHING`, [guildId]);
    return { guild_id: guildId, tax_pool: 0, global_multiplier: 1.0, multiplier_expires_at: null };
  }
  return r.rows[0];
}

async function addToPool(guildId, amount) {
  requirePool();
  await pool.query(
    `INSERT INTO economy_pool (guild_id, tax_pool) VALUES ($1,$2)
     ON CONFLICT (guild_id) DO UPDATE SET tax_pool = economy_pool.tax_pool + $2`,
    [guildId, amount]
  );
}

async function drainPool(guildId) {
  const p = await getPool(guildId);
  const amt = Number(p.tax_pool) || 0;
  await pool.query(`UPDATE economy_pool SET tax_pool = 0 WHERE guild_id = $1`, [guildId]);
  return amt;
}

async function setMultiplier(guildId, mult, hours) {
  requirePool();
  const expires = new Date(Date.now() + hours * 60 * 60 * 1000);
  await pool.query(
    `INSERT INTO economy_pool (guild_id, global_multiplier, multiplier_expires_at) VALUES ($1,$2,$3)
     ON CONFLICT (guild_id) DO UPDATE SET global_multiplier = $2, multiplier_expires_at = $3`,
    [guildId, mult, expires]
  );
}

async function getMultiplier(guildId) {
  const p = await getPool(guildId);
  const m = Number(p.global_multiplier) || 1;
  if (p.multiplier_expires_at && new Date(p.multiplier_expires_at).getTime() < Date.now()) return 1;
  return m;
}

/* ═══════════ bank ═══════════ */
async function getBank(userId) {
  requirePool();
  const r = await pool.query(`SELECT * FROM economy_bank WHERE user_id = $1`, [userId]);
  if (!r.rows[0]) {
    await pool.query(`INSERT INTO economy_bank (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [userId]);
    return { user_id: userId, balance: 0, last_interest_at: new Date() };
  }
  return { user_id: userId, balance: Number(r.rows[0].balance), last_interest_at: r.rows[0].last_interest_at };
}

async function setBank(userId, balance) {
  requirePool();
  await pool.query(
    `INSERT INTO economy_bank (user_id, balance) VALUES ($1,$2)
     ON CONFLICT (user_id) DO UPDATE SET balance = $2`,
    [userId, Math.max(0, Math.round(balance))]
  );
}

async function setBankInterestTime(userId, date) {
  requirePool();
  await pool.query(`UPDATE economy_bank SET last_interest_at = $2 WHERE user_id = $1`, [userId, date]);
}

/* ═══════════ leaderboard ═══════════ */
async function getLeaderboard(limit = 10, offset = 0) {
  requirePool();
  const r = await pool.query(
    `SELECT user_id, balance * 100 + sheckles AS total FROM gamble_wallet ORDER BY total DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return r.rows.map(x => ({ userId: x.user_id, totalSheckles: Number(x.total) }));
}

async function listBankUsers() {
  requirePool();
  const r = await pool.query(`SELECT user_id, balance, last_interest_at FROM economy_bank WHERE balance > 0`);
  return r.rows.map(x => ({
    userId: x.user_id,
    balance: Number(x.balance),
    lastInterestAt: x.last_interest_at ? new Date(x.last_interest_at).getTime() : 0,
  }));
}

/* ═══════════ exports ═══════════ */
module.exports = {
  setPool,
  getWallet, setWallet, spendValue, addValue, addSheckles,
  logTransaction, getHistory,
  getStreak, setStreak,
  getPrestige, trackEarned, trackSpent, trackGiven, trackReceived,
  hasAchievement, grantAchievement, listAchievements,
  getJob, setJob,
  getItems, addItem, hasItem,
  getPool, addToPool, drainPool, setMultiplier, getMultiplier,
  getBank, setBank, setBankInterestTime,
  getLeaderboard, listBankUsers,
};
