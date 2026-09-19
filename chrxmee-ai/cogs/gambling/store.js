/* cogs/gambling/store.js */
const { STARTING_BALANCE, DAILY_AMOUNT, DAILY_COOLDOWN_MS } = require('./constants');

let pool = null;
function setPool(p) { pool = p; console.log('[gamble] pool attached:', !!pool); }
function requirePool() { if (!pool) throw new Error('gambling store: pool not attached'); }

const cache = new Map();

async function loadUser(userId) {
  requirePool();
  if (cache.has(userId)) return cache.get(userId);
  const r = await pool.query(`SELECT * FROM gamble_wallet WHERE user_id = $1`, [userId]);
  if (r.rows[0]) {
    const row = r.rows[0];
    const data = {
      userId,
      balance: Number(row.balance),
      wins: Number(row.wins),
      losses: Number(row.losses),
      wagered: Number(row.wagered),
      biggestWin: Number(row.biggest_win),
      lastBetAt: row.last_bet_at ? new Date(row.last_bet_at).getTime() : 0,
      lastDailyAt: row.last_daily_at ? new Date(row.last_daily_at).getTime() : 0,
    };
    cache.set(userId, data);
    return data;
  }
  const ins = await pool.query(
    `INSERT INTO gamble_wallet (user_id, balance) VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET user_id = $1 RETURNING *`,
    [userId, STARTING_BALANCE]
  );
  const row = ins.rows[0];
  const data = {
    userId,
    balance: Number(row.balance),
    wins: 0, losses: 0, wagered: 0, biggestWin: 0, lastBetAt: 0, lastDailyAt: 0,
  };
  cache.set(userId, data);
  return data;
}

async function saveUser(userId) {
  requirePool();
  const d = cache.get(userId);
  if (!d) return;
  await pool.query(
    `UPDATE gamble_wallet SET balance = $1, wins = $2, losses = $3, wagered = $4, biggest_win = $5, last_bet_at = $6, last_daily_at = $7 WHERE user_id = $8`,
    [d.balance, d.wins, d.losses, d.wagered, d.biggestWin,
     d.lastBetAt ? new Date(d.lastBetAt) : null,
     d.lastDailyAt ? new Date(d.lastDailyAt) : null,
     userId]
  );
}

async function getBalance(userId) {
  const d = await loadUser(userId);
  return d.balance;
}

async function applyBet(userId, amount) {
  const d = await loadUser(userId);
  d.balance -= amount;
  d.wagered += amount;
  d.lastBetAt = Date.now();
  await saveUser(userId);
  return d.balance;
}

async function applyWin(userId, amount) {
  const d = await loadUser(userId);
  d.balance += amount;
  if (amount > d.biggestWin) d.biggestWin = amount;
  if (amount > 0) d.wins++;
  await saveUser(userId);
  return d.balance;
}

async function applyLoss(userId) {
  const d = await loadUser(userId);
  d.losses++;
  await saveUser(userId);
}

async function claimDaily(userId) {
  const d = await loadUser(userId);
  const now = Date.now();
  if (now - d.lastDailyAt < DAILY_COOLDOWN_MS) {
    return { ok: false, retryIn: DAILY_COOLDOWN_MS - (now - d.lastDailyAt), nextAt: d.lastDailyAt + DAILY_COOLDOWN_MS };
  }
  d.balance += DAILY_AMOUNT;
  d.lastDailyAt = now;
  await saveUser(userId);
  return { ok: true, amount: DAILY_AMOUNT, balance: d.balance };
}

async function getLeaderboard(limit = 10) {
  requirePool();
  const r = await pool.query(`SELECT user_id, balance FROM gamble_wallet ORDER BY balance DESC LIMIT $1`, [limit]);
  return r.rows.map(x => ({ userId: x.user_id, balance: Number(x.balance) }));
}

async function getStats(userId) {
  return await loadUser(userId);
}

module.exports = {
  setPool,
  loadUser, saveUser,
  getBalance, applyBet, applyWin, applyLoss,
  claimDaily,
  getLeaderboard, getStats,
};
