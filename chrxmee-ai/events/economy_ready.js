const { store } = require('../cogs/economy');
const {
  BANK_INTEREST_BASE, BANK_INTEREST_PER_PRESTIGE, BANK_INTEREST_MAX,
  BANK_INTEREST_COOLDOWN_MS, prestigeFromEarned,
} = require('../cogs/economy/constants');

const TICK_MS = 15 * 60 * 1000;
let started = false;

async function tick(client) {
  let users;
  try { users = await store.listBankUsers(); }
  catch (e) { console.error('[economy] tick query err:', e.message); return; }

  const now = Date.now();
  let accrued = 0;

  for (const u of users) {
    if (now - u.lastInterestAt < BANK_INTEREST_COOLDOWN_MS) continue;
    if (u.balance <= 0) continue;

    try {
      const prestige = await store.getPrestige(u.userId);
      const level = prestigeFromEarned(Number(prestige.total_earned) / 100).level;
      const rate = Math.min(BANK_INTEREST_MAX, BANK_INTEREST_BASE + (level - 1) * BANK_INTEREST_PER_PRESTIGE);
      const interest = Math.floor(u.balance * rate);

      if (interest <= 0) {
        await store.setBankInterestTime(u.userId, new Date());
        continue;
      }

      await store.setBank(u.userId, u.balance + interest);
      await store.trackEarned(u.userId, interest / 100);
      await store.logTransaction(u.userId, 'interest', interest / 100, { note: `${(rate * 100).toFixed(2)}% auto` });
      await store.setBankInterestTime(u.userId, new Date());
      accrued++;
    } catch (e) {
      console.error(`[economy] interest err for ${u.userId}:`, e.message);
    }
  }

  if (accrued > 0) console.log(`[economy] accrued interest for ${accrued} user(s)`);
}

module.exports = {
  name: 'clientReady',
  once: true,
  async execute(client) {
    if (started) return;
    started = true;

    if (client.pool) store.setPool(client.pool);
    console.log('[economy] ready — pool attached, tick every', TICK_MS / 60000, 'min');

    const iv = setInterval(() => tick(client).catch(e => console.error('[economy] tick err:', e.message)), TICK_MS);
    if (iv.unref) iv.unref();
  },
  _tick: tick,
};
