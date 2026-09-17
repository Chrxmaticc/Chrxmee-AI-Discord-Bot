/* cogs/moderation/escalation.js — warn thresholds trigger actions */

const store = require('./store');
const modlog = require('./modlog');

async function evaluate(member, warnCount, client) {
  const guildId = member.guild.id;
  const config = store.getConfig(guildId);
  const rules = (config.escalation || []).slice().sort((a, b) => a.warns - b.warns);

  /* highest matching rule */
  let triggered = null;
  for (const r of rules) if (warnCount >= r.warns) triggered = r;
  if (!triggered) return;

  /* ── LOOP GUARD: check for existing active auto-escalation at this warn count ── */
  const previous = store.listCases(guildId, { targetId: member.id, limit: 100 });
  const reasonKey = `auto-escalation at ${warnCount} warns`;
  const alreadyFired = previous.some(c =>
    c.modId === 'auto-escalation' &&
    c.reason === reasonKey &&
    c.status === 'active'
  );
  if (alreadyFired) return;

  try {
    if (triggered.action === 'timeout' && member.moderatable) {
      await member.timeout(triggered.duration || 3600000, reasonKey).catch(() => {});
    } else if (triggered.action === 'mute' && member.moderatable) {
      await member.timeout(triggered.duration || 3600000, reasonKey).catch(() => {});
    } else if (triggered.action === 'kick' && member.kickable) {
      await member.kick(reasonKey).catch(() => {});
    } else if (triggered.action === 'ban' && member.bannable) {
      await member.ban({ reason: reasonKey }).catch(() => {});
    } else if (triggered.action === 'tempban' && member.bannable) {
      await member.ban({ reason: reasonKey }).catch(() => {});
    }

    const c = store.createCase(guildId, {
      type: triggered.action,
      targetId: member.id,
      modId: 'auto-escalation',
      reason: reasonKey,
      duration: triggered.duration || null,
    });

    await modlog.log(guildId, {
      type: triggered.action,
      caseId: c.id,
      targetId: member.id,
      modId: 'auto-escalation',
      reason: reasonKey,
      duration: triggered.duration,
    }, member.client);
  } catch (e) {
    console.error('[mod] escalation error:', e.message);
  }
}

module.exports = { evaluate };
