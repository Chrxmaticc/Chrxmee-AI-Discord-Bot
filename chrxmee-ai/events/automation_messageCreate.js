const { engine } = require('../cogs/automation');

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    if (!message.guild || message.author.bot || !message.member) return;
    engine.run('message', {
      eventType: 'message', client: message.client,
      message, member: message.member, user: message.author,
      guild: message.guild, channel: message.channel,
    }).catch(() => {});
  },
};
