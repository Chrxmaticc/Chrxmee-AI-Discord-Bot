/* cogs/verification/antiRaid.js — raid detection */

const config = require('./config');

const joinBuckets = new Map();      // guildId -> [timestamps]
const raidMode = new Map();         // guildId -> expiresAt

function recordJoin(guildId) {
  const now = Date.now();
  const arr = (joinBuckets.get(guildId) || []).filter(t => now - t < 120000);
  arr.push(now);
  joinBuckets.set(guildId, arr);
  return arr;
}

function isRaidActive(guildId) {
  const exp = raidMode.get(guildId);
  if (!exp) return false;
  if (Date.now() > exp) {
    raidMode.delete(guildId);
    return false;
  }
  return true;
}

function triggerRaid(guildId, durationMinutes) {
  const exp = Date.now() + durationMinutes * 60000;
  raidMode.set(guildId, exp);
  return exp;
}

function checkOnJoin(guildId) {
  const cfg = config.get(guildId);
  if (!cfg.antiraidEnabled) return false;

  const joins = recordJoin(guildId);
  const window = cfg.antiraidWindowSeconds || 60;
  const threshold = cfg.antiraidThreshold || 15;
  const now = Date.now();
  const inWindow = joins.filter(t => now - t < window * 1000).length;

  if (inWindow >= threshold && !isRaidActive(guildId)) {
    triggerRaid(guildId, cfg.antiraidDurationMinutes || 10);
    return true;
  }
  return false;
}

function raidStatus(guildId) {
  return {
    active: isRaidActive(guildId),
    expiresAt: raidMode.get(guildId) || null,
    recentJoins: (joinBuckets.get(guildId) || []).length,
  };
}

module.exports = { recordJoin, checkOnJoin, isRaidActive, triggerRaid, raidStatus };
