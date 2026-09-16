const { bloxlinkTrap } = require('../cogs/verification');

module.exports = {
  name: 'guildMemberUpdate',
  async execute(oldMember, newMember) {
    const added = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
    for (const [, role] of added) {
      bloxlinkTrap.detect(newMember, role).catch(e => console.error('[verify] bloxlink:', e));
    }
  },
};
