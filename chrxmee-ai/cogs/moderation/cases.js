/* cogs/moderation/cases.js — case helpers */

const store = require('./store');

function fmtDuration(ms) {
  if (!ms) return 'permanent';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  return parts.join(' ') || `${s}s`;
}

function createFromAction(guildId, type, targetId, modId, reason, duration, refCase) {
  return store.createCase(guildId, { type, targetId, modId, reason, duration, refCase });
}

module.exports = { createFromAction, fmtDuration };
