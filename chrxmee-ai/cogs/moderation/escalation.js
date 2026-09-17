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

  /* prevent duplicates: check if we already fired this rule */
  const prevCase = store.listCases(guildId, { targetId: member.id, limit: 1 })[0];
  if (prevCase?.meta?.escalation === triggered.warns) return;

  try {
    if (triggered.action === 'timeout' && member.moderatable) {
      await member.timeout(triggered.duration || 3600000, `escalation: ${warnCount} warns`).catch(() => {});
    } else if (triggered.action === 'mute' && member.moderatable) {
      await member.timeout(triggered.duration || 3600000, `escalation: ${warnCount} warns`).catch(() => {});
    } else if (triggered.action === 'kick' && member.kickable) {
      await member.kick(`escalation: ${warnCount} warns`).catch(() => {});
    } else if (triggered.action === 'ban' && member.bannable) {
      await member.ban({ reason: `escalation: ${warnCount} warns` }).catch(() => {});
    } else if (triggered.action === 'tempban' && member.bannable) {
      await member.ban({ reason: `escalation: ${warnCount} warns` }).catch(() => {});
    }

    const c = store.createCase(guildId, {
      type: triggered.action,
      targetId: member.id,
      modId: 'auto-escalation',
      reason: `auto-escalation at ${warnCount} warns`,
      duration: triggered.duration || null,
    });
    c.meta = { escalation: triggered.warns };

    await modlog.log(guildId, {
      type: triggered.action,
      caseId: c.id,
      targetId: member.id,
      modId: 'auto-escalation',
      reason: `auto-escalation at ${warnCount} warns`,
      duration: triggered.duration,
    }, member.client);
  } catch (e) {
    console.error('[mod] escalation error:', e.message);
  }
}

module.exports = { evaluate };
