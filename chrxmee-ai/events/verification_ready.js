const { antiRaid } = require('../cogs/verification');

module.exports = {
  name: 'clientReady',
  once: true,
  async execute(client) {
    console.log('[verify] verification cog ready');
    /* periodic raid mode sweep — clears stale raid state */
    setInterval(() => {
      for (const guild of client.guilds.cache.values()) {
        antiRaid.isRaidActive(guild.id); /* triggers cleanup inside */
      }
    }, 60 * 1000);
  },
};
