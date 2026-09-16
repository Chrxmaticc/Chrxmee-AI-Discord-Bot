/* cogs/automation/scheduler.js — fires scheduled automations every minute */

const store = require('./store');
const engine = require('./engine');

const TICK_MS = 60000;
const FIRE_WINDOW = 5; // minutes — catches 9:00 even if we tick at 9:03
const CLEANUP_EVERY = 5 * 60000;
const COOLDOWN_TTL = 10 * 60000;

/* ───── should this flow fire right now? ───── */
function shouldFire(flow, now) {
  const t = flow.trigger || {};
  const last = flow.lastFiredAt || 0;
  const d = new Date(now);
  const current = d.getHours() * 60 + d.getMinutes();

  if (t.mode === 'interval') {
    const minutes = Math.max(1, t.minutes || 5);
    return now - last >= minutes * 60000;
  }

  if (t.mode === 'daily') {
    const target = (t.hour || 0) * 60 + (t.minute || 0);
    const inWindow = current >= target && current < target + FIRE_WINDOW;
    const alreadyFiredToday = firedOnSameDay(last, d);
    return inWindow && !alreadyFiredToday;
  }

  if (t.mode === 'weekly') {
    if (d.getDay() !== (t.day ?? 1)) return false;
    const target = (t.hour || 0) * 60 + (t.minute || 0);
    const inWindow = current >= target && current < target + FIRE_WINDOW;
    const alreadyFiredToday = firedOnSameDay(last, d);
    return inWindow && !alreadyFiredToday;
  }

  return false;
}

function firedOnSameDay(lastMs, d) {
  if (!lastMs) return false;
  const l = new Date(lastMs);
  return (
    l.getFullYear() === d.getFullYear() &&
    l.getMonth() === d.getMonth() &&
    l.getDate() === d.getDate()
  );
}

/* ───── tick: fire any due scheduled automations ───── */
async function tick(client) {
  const now = Date.now();
  const flows = store.allScheduled();

  for (const flow of flows) {
    if (!shouldFire(flow, now)) continue;

    try {
      const guild = client.guilds.cache.get(flow.guildId);
      if (!guild) continue;

      console.log(`[automation] scheduled fire #${flow.id} "${flow.name}"`);

      await engine.runActions(flow, {
        eventType: 'scheduled',
        client,
        guild,
        channel: null,
        member: null,
        user: { id: 'system', username: 'system' },
      }, 0);

      store.recordFire(flow.id, { userId: 'system', ok: true });
    } catch (err) {
      console.error(`[automation] scheduled #${flow.id} errored:`, err.message);
      store.bumpError(flow.id);
      store.recordFire(flow.id, { userId: 'system', ok: false, error: err.message });
    }
  }
}

/* ───── cleanup: nothing to clean in this version.
   recentFires map lives inside engine.js and is bounded
   by unique (flowId:userId) pairs — not a leak in practice.
   kept this hook in case you add a store cleanup later. ───── */
function cleanup() {
  // no-op for now
}

/* ───── start ───── */
function start(client) {
  console.log('[automation] scheduler started');
  setInterval(
    () => tick(client).catch(e => console.error('[automation] scheduler tick:', e)),
    TICK_MS
  );
  setInterval(cleanup, CLEANUP_EVERY);
}

module.exports = { start, tick, shouldFire };
