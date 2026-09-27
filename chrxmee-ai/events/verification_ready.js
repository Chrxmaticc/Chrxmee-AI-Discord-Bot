const { store } = require('../cogs/verification');
const { antiRaid } = require('../cogs/verification');

let started = false;

module.exports = {
  name: 'clientReady',
  once: true,
  async execute(client) {
    if (started) return;
    started = true;

    if (client.pool) store.setPool(client.pool);
    console.log('[verify] ready — pool attached');

    // periodic raid state cleanup every 60s
    const iv = setInterval(() => {
      for (const guild of client.guilds.cache.values()) {
        antiRaid.isActive(guild.id);
      }
    }, 60 * 1000);
    if (iv.unref) iv.unref();
  },
};
