const { engine } = require('../cogs/automation');

module.exports = {
  name: 'guildMemberRemove',
  async execute(member) {
    engine.run('member_leave', {
      eventType: 'member_leave', client: member.client,
      member, user: member.user, guild: member.guild, channel: null,
    }).catch(() => {});
  },
};
