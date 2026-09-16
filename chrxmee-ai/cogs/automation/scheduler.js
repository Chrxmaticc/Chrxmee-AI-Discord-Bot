/* scheduler — fires scheduled automations every minute */

const store = require('./store');
const engine = require('./engine');

const TICK_MS = 60000;

function shouldFire(flow, now) {
  const t = flow.trigger || {};
  const last = flow.lastFiredAt || 0;

  if (t.mode === 'interval') {
    const minutes = Math.max(1, t.minutes || 5);
    return now - last >= minutes * 60000;
  }

  if (t.mode === 'daily') {
    const d = new Date(now);
    const target = (t.hour || 0) * 60 + (t.minute || 0);
    const current = d.getHours() * 60 + d.getMinutes();
    const alreadyFired = new Date(last).toDateString() === d.toDateString()
      && (new Date(last).getHours() * 60 + new Date(last).getMinutes()) >= target;
    return current === target && !alreadyFired;
  }

  if (t.mode === 'weekly') {
    const d = new Date(now);
    if (d.getDay() !== (t.day ?? 1)) return false;
    const target = (t.hour || 0) * 60 + (t.minute || 0);
    const current = d.getHours() * 60 + d.getMinutes();
    const alreadyFired = new Date(last).toDateString() === d.toDateString();
    return current === target && !alreadyFired;
  }

  return false;
}

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
        client, guild, channel: null, member: null,
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

function start(client) {
  console.log('[automation] scheduler started');
  setInterval(() => tick(client).catch(e => console.error('[automation] scheduler tick:', e)), TICK_MS);
}

module.exports = { start, tick };
