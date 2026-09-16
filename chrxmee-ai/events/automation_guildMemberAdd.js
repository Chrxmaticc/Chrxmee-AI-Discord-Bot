const { engine } = require('../cogs/automation');

module.exports = {
  name: 'guildMemberAdd',
  async execute(member) {
    engine.run('member_join', {
      eventType: 'member_join', client: member.client,
      member, user: member.user, guild: member.guild, channel: null,
    }).catch(() => {});
  },
};
