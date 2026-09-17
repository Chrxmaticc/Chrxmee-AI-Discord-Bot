/* cogs/moderation/warns.js — warn helpers + escalation trigger */

const store = require('./store');
const escalation = require('./escalation');

async function addWarn(member, modId, reason, client) {
  const guildId = member.guild.id;
  const userId = member.id;
  const c = store.createCase(guildId, {
    type: 'warn',
    targetId: userId,
    modId,
    reason,
  });
  store.addWarn(guildId, userId, { caseId: c.id, modId, reason });

  /* escalation check */
  const active = store.countActiveWarns(guildId, userId);
  await escalation.evaluate(member, active, client);

  return c;
}

function removeWarn(member, caseId) {
  return store.removeWarn(member.guild.id, member.id, caseId);
}

function listWarns(member) {
  return store.listWarns(member.guild.id, member.id);
}

module.exports = { addWarn, removeWarn, listWarns };
