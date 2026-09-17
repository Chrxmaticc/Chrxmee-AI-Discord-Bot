const { raidMode, store, modlog } = require('../cogs/moderation');

module.exports = {
  name: 'guildMemberAdd',
  async execute(member) {
    const config = store.getConfig(member.guild.id);
    if (!config.enabled) return;

    try {
      const raidTriggered = await raidMode.checkAndTrigger(member.guild, member.client);

      /* if raid mode active, potentially gate */
      if (raidMode.isActive(member.guild.id)) {
        /* hook into verification cog if present */
        try {
          const verify = require('../cogs/verification');
          if (config.raidForceCaptcha && verify?.engine) {
            /* verification cog handles its own gating via onJoin */
          }
        } catch {}
      }

      await modlog.logRaw(member.guild.id, 'logJoins', {
        color: 0x5b7fd4,
        title: `member joined`,
        body: `<@${member.id}> · ${member.user.username} · \`${member.user.id}\`\n-# account created <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
      }, member.client);

      if (store.isWatched(member.guild.id, member.id)) {
        await modlog.logRaw(member.guild.id, 'logJoins', {
          color: 0xff3b3b,
          title: `watched user joined`,
          body: `<@${member.id}> is on the watchlist`,
        }, member.client);
      }
    } catch (e) {
      console.error('[moderation] guildMemberAdd:', e.message);
    }
  },
};
