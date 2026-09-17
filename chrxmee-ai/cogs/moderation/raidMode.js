/* cogs/moderation/raidMode.js — join bucket + raid detection */

const store = require('./store');
const modlog = require('./modlog');

const joinBuckets = new Map();   // guildId -> [ts]
const raidState = new Map();     // guildId -> { expiresAt, locked }

function recordJoin(guildId) {
  const now = Date.now();
  const arr = (joinBuckets.get(guildId) || []).filter(t => now - t < 120000);
  arr.push(now);
  joinBuckets.set(guildId, arr);
  return arr;
}

function isActive(guildId) {
  const s = raidState.get(guildId);
  if (!s) return false;
  if (Date.now() > s.expiresAt) { raidState.delete(guildId); return false; }
  return true;
}

function trigger(guildId, durationMinutes) {
  const expiresAt = Date.now() + durationMinutes * 60000;
  raidState.set(guildId, { expiresAt, locked: false });
  return expiresAt;
}

async function checkAndTrigger(guild, client) {
  const config = store.getConfig(guild.id);
  if (!config.raidEnabled) return false;

  const joins = recordJoin(guild.id);
  const now = Date.now();
  const inWindow = joins.filter(t => now - t < config.raidWindowSeconds * 1000).length;

  if (inWindow >= config.raidThreshold && !isActive(guild.id)) {
    trigger(guild.id, config.raidDurationMinutes);
    await modlog.logRaw(guild.id, 'logJoins', {
      color: 0xff3b3b,
      title: "🚨 raid mode activated",
      body: `${inWindow} joins in ${config.raidWindowSeconds}s\n-# raid mode for ${config.raidDurationMinutes} minutes`,
    }, client);
    return true;
  }
  return false;
}

function status(guildId) {
  const s = raidState.get(guildId);
  return {
    active: isActive(guildId),
    expiresAt: s?.expiresAt || null,
    recentJoins: (joinBuckets.get(guildId) || []).length,
  };
}

module.exports = { recordJoin, isActive, trigger, checkAndTrigger, status };
