const { store, modlog } = require('../cogs/moderation');

module.exports = {
  name: 'guildMemberRemove',
  async execute(member) {
    const config = store.getConfig(member.guild.id);
    if (!config.enabled) return;

    try {
      await modlog.logRaw(member.guild.id, 'logLeaves', {
        color: 0xff8c42,
        title: `member left`,
        body: `<@${member.id}> · ${member.user.username}\n-# joined <t:${Math.floor((member.joinedTimestamp || Date.now()) / 1000)}:R>`,
      }, member.client);
    } catch (e) {
      console.error('[moderation] guildMemberRemove:', e.message);
    }
  },
};
