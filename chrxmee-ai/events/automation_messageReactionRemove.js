const { engine } = require('../cogs/automation');

module.exports = {
  name: 'messageReactionRemove',
  async execute(reaction, user) {
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch().catch(() => {});
    const guild = reaction.message.guild;
    if (!guild) return;
    const member = await guild.members.fetch(user.id).catch(() => null);
    if (!member) return;

    engine.run('reaction_remove', {
      eventType: 'reaction_remove', client: reaction.message.client,
      message: reaction.message, member, user, guild,
      channel: reaction.message.channel, reaction,
    }).catch(() => {});
  },
};
