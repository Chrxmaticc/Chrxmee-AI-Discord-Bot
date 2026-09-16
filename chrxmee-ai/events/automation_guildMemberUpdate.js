const { engine } = require('../cogs/automation');

module.exports = {
  name: 'guildMemberUpdate',
  async execute(oldMember, newMember) {
    const added   = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
    const removed = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id));

    for (const [, role] of added) {
      engine.run('role_added', {
        eventType: 'role_added', client: newMember.client,
        member: newMember, user: newMember.user,
        guild: newMember.guild, channel: null, role,
      }).catch(() => {});
    }
    for (const [, role] of removed) {
      engine.run('role_removed', {
        eventType: 'role_removed', client: newMember.client,
        member: newMember, user: newMember.user,
        guild: newMember.guild, channel: null, role,
      }).catch(() => {});
    }
  },
};
