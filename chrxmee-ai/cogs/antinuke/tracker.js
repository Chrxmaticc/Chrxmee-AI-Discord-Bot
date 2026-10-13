// cogs/antinuke/tracker.js
// in-memory sliding window for action counts.
// key: `${guildId}:${executorId}:${action}` → [timestamps]

const { CONFIG } = require("./constants");

const WINDOW = new Map();      // primary window buckets
const LONG_WINDOW = new Map(); // long-window buckets
const RATE_SPIKE = new Map();  // guild-level spike detection (no executor)
const WHITELIST_GRACE = new Map(); // targetId → timestamp when whitelisted

const GC_INTERVAL = 60_000;
const MAX_WINDOW_AGE = 10 * 60 * 1000; // keep 10 min max

function key(guildId, executorId, action) {
  return `${guildId}:${executorId}:${action}`;
}

function spikeKey(guildId, action) {
  return `${guildId}:${action}`;
}

/* ═══════════════════════════════════════════════════════════════
   RECORD
   ═══════════════════════════════════════════════════════════════ */
function record(guildId, executorId, action, ts = Date.now()) {
  // primary
  const k = key(guildId, executorId, action);
  let arr = WINDOW.get(k);
  if (!arr) { arr = []; WINDOW.set(k, arr); }
  arr.push(ts);

  // long window
  const lk = key(guildId, executorId, action);
  let larr = LONG_WINDOW.get(lk);
  if (!larr) { larr = []; LONG_WINDOW.set(lk, larr); }
  larr.push(ts);

  // guild-wide spike
  const sk = spikeKey(guildId, action);
  let sarr = RATE_SPIKE.get(sk);
  if (!sarr) { sarr = []; RATE_SPIKE.set(sk, sarr); }
  sarr.push(ts);
}

/* ═══════════════════════════════════════════════════════════════
   CHECK — count within window
   ═══════════════════════════════════════════════════════════════ */
function countInWindow(guildId, executorId, action, windowMs, now = Date.now()) {
  const arr = WINDOW.get(key(guildId, executorId, action));
  if (!arr?.length) return 0;
  const cutoff = now - windowMs;
  // prune old in place
  while (arr.length && arr[0] < cutoff) arr.shift();
  return arr.length;
}

function countInLongWindow(guildId, executorId, action, windowMs, now = Date.now()) {
  const arr = LONG_WINDOW.get(key(guildId, executorId, action));
  if (!arr?.length) return 0;
  const cutoff = now - windowMs;
  while (arr.length && arr[0] < cutoff) arr.shift();
  return arr.length;
}

function countSpike(guildId, action, windowMs, now = Date.now()) {
  const arr = RATE_SPIKE.get(spikeKey(guildId, action));
  if (!arr?.length) return 0;
  const cutoff = now - windowMs;
  while (arr.length && arr[0] < cutoff) arr.shift();
  return arr.length;
}

/* ═══════════════════════════════════════════════════════════════
   RESET — called after punishment
   ═══════════════════════════════════════════════════════════════ */
function reset(guildId, executorId, action) {
  WINDOW.delete(key(guildId, executorId, action));
  LONG_WINDOW.delete(key(guildId, executorId, action));
}

function resetAllForUser(guildId, executorId) {
  for (const k of WINDOW.keys()) {
    if (k.startsWith(`${guildId}:${executorId}:`)) WINDOW.delete(k);
  }
  for (const k of LONG_WINDOW.keys()) {
    if (k.startsWith(`${guildId}:${executorId}:`)) LONG_WINDOW.delete(k);
  }
}

function resetGuild(guildId) {
  for (const k of WINDOW.keys())      if (k.startsWith(`${guildId}:`)) WINDOW.delete(k);
  for (const k of LONG_WINDOW.keys()) if (k.startsWith(`${guildId}:`)) LONG_WINDOW.delete(k);
  for (const k of RATE_SPIKE.keys())  if (k.startsWith(`${guildId}:`)) RATE_SPIKE.delete(k);
}

/* ═══════════════════════════════════════════════════════════════
   WHITELIST GRACE
   ═══════════════════════════════════════════════════════════════ */
const GRACE_MS = 60 * 60 * 1000; // 60 min

function markWhitelistGrace(targetId) {
  WHITELIST_GRACE.set(targetId, Date.now());
}

function isRecentWhitelist(targetId, now = Date.now()) {
  const t = WHITELIST_GRACE.get(targetId);
  return t ? now - t < GRACE_MS : false;
}

/* ═══════════════════════════════════════════════════════════════
   GC
   ═══════════════════════════════════════════════════════════════ */
function cleanup(now = Date.now()) {
  const cutoff = now - MAX_WINDOW_AGE;
  for (const [k, arr] of WINDOW) {
    while (arr.length && arr[0] < cutoff) arr.shift();
    if (!arr.length) WINDOW.delete(k);
  }
  for (const [k, arr] of LONG_WINDOW) {
    while (arr.length && arr[0] < cutoff) arr.shift();
    if (!arr.length) LONG_WINDOW.delete(k);
  }
  for (const [k, arr] of RATE_SPIKE) {
    while (arr.length && arr[0] < cutoff) arr.shift();
    if (!arr.length) RATE_SPIKE.delete(k);
  }
  for (const [k, t] of WHITELIST_GRACE) {
    if (now - t > GRACE_MS) WHITELIST_GRACE.delete(k);
  }
}

function startGC() {
  const loop = setInterval(cleanup, GC_INTERVAL);
  loop.unref?.();
}

module.exports = {
  record,
  countInWindow, countInLongWindow, countSpike,
  reset, resetAllForUser, resetGuild,
  markWhitelistGrace, isRecentWhitelist,
  cleanup, startGC,
  _internal: { WINDOW, LONG_WINDOW, RATE_SPIKE },
};
