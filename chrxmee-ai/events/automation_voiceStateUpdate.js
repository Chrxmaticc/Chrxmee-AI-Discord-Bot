const { engine } = require('../cogs/automation');

module.exports = {
  name: 'voiceStateUpdate',
  async execute(oldState, newState) {
    const member = newState.member || oldState.member;
    if (!member || member.user.bot) return;

    const joined = !oldState.channelId && newState.channelId;
    const left   = oldState.channelId && !newState.channelId;

    if (joined) {
      engine.run('voice_join', {
        eventType: 'voice_join', client: member.client,
        member, user: member.user, guild: newState.guild,
        channel: newState.channel,
      }).catch(() => {});
    }
    if (left) {
      engine.run('voice_leave', {
        eventType: 'voice_leave', client: member.client,
        member, user: member.user, guild: oldState.guild,
        channel: oldState.channel,
      }).catch(() => {});
    }
  },
};
