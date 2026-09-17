const { automod, store, engine, modlog } = require('../cogs/moderation');

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    if (!message.guild || message.author.bot || !message.member) return;
    const config = store.getConfig(message.guild.id);
    if (!config.enabled || !config.automodEnabled) return;

    try {
      const result = await automod.process(message);
      if (!result) return;

      /* delete the message */
      await message.delete().catch(() => {});

      /* take action */
      const reason = `automod: ${result.reasons.join(', ')}`;
      if (config.automodAction === 'warn') {
        await engine.warn(message.member, message.client.user.id, reason);
      } else if (config.automodAction === 'timeout') {
        await engine.timeout(message.member, message.client.user.id, 600000, reason);
      }

      /* notify channel */
      const notice = await message.channel.send({
        content: `<@${message.author.id}> — ${reason}`,
      }).catch(() => null);
      if (notice) setTimeout(() => notice.delete().catch(() => {}), 5000);

      /* log */
      await modlog.log(message.guild.id, {
        type: 'warn',
        caseId: '(auto)',
        targetId: message.author.id,
        modId: 'auto-escalation',
        reason,
        extra: `channel: <#${message.channel.id}>`,
      }, message.client);
    } catch (e) {
      console.error('[moderation] messageCreate:', e.message);
    }
  },
};
