/* cogs/automation/scheduler.js */
const store = require('./store');
const engine = require('./engine');

const TICK_MS = 60000;
const FIRE_WINDOW = 5;

function firedOnSameDay(lastMs, d) {
  if (!lastMs) return false;
  const l = new Date(lastMs);
  return l.getFullYear() === d.getFullYear() && l.getMonth() === d.getMonth() && l.getDate() === d.getDate();
}

function shouldFire(flow, now) {
  const t = flow.trigger || {};
  const last = flow.createdAt || 0;
  const d = new Date(now);
  const current = d.getHours() * 60 + d.getMinutes();
  if (t.mode === 'interval') {
    const minutes = Math.max(1, t.minutes || 5);
    return now - last >= minutes * 60000;
  }
  if (t.mode === 'daily') {
    const target = (t.hour || 0) * 60 + (t.minute || 0);
    return current >= target && current < target + FIRE_WINDOW && !firedOnSameDay(last, d);
  }
  if (t.mode === 'weekly') {
    if (d.getDay() !== (t.day ?? 1)) return false;
    const target = (t.hour || 0) * 60 + (t.minute || 0);
    return current >= target && current < target + FIRE_WINDOW && !firedOnSameDay(last, d);
  }
  return false;
}

async function tick(client) {
  const now = Date.now();
  let flows;
  try { flows = await store.allScheduled(); }
  catch (e) { console.error('[automation] scheduler query err:', e.message); return; }
  for (const flow of flows) {
    if (!shouldFire(flow, now)) continue;
    try {
      const guild = client.guilds.cache.get(flow.guildId);
      if (!guild) continue;
      console.log(`[automation] scheduled fire #${flow.id} "${flow.name}"`);
      await engine.runActions(flow, { eventType: 'scheduled', client, guild, channel: null, member: null, user: { id: 'system', username: 'system' } }, 0);
      await store.recordFire(flow.id, { userId: 'system', ok: true });
    } catch (err) {
      console.error(`[automation] scheduled #${flow.id} err:`, err.message);
      try { await store.bumpError(flow.id); } catch {}
    }
  }
}

function start(client) {
  if (!client || !client.pool) {
    console.error('[automation] scheduler: client.pool missing, cannot start');
    return;
  }
  store.setPool(client.pool);
  console.log('[automation] scheduler started');
  setInterval(() => tick(client).catch(e => console.error('[automation] tick err:', e.message)), TICK_MS);
}

module.exports = { start, tick, shouldFire };
