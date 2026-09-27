/* cogs/verification/antiRaid.js */

const configMod = require('./config');
const log = require('./log');

const joinBuckets = new Map();
const raidState = new Map();

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

async function checkOnJoin(guild, client) {
  const cfg = await configMod.get(guild.id);
  if (!cfg.antiraidEnabled) return false;

  const joins = recordJoin(guild.id);
  const now = Date.now();
  const inWindow = joins.filter(t => now - t < cfg.antiraidWindowSeconds * 1000).length;

  if (inWindow >= cfg.antiraidThreshold && !isActive(guild.id)) {
    trigger(guild.id, cfg.antiraidDurationMinutes);
    await log.log(client, guild.id, {
      color: 0xff3b3b,
      title: 'raid mode activated',
      body: `${inWindow} joins in ${cfg.antiraidWindowSeconds}s\n-# raid mode for ${cfg.antiraidDurationMinutes} minutes`,
    });
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

module.exports = { recordJoin, isActive, trigger, checkOnJoin, status };
