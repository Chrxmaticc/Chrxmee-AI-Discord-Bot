const { scheduler } = require('../cogs/automation');

module.exports = {
  name: 'clientReady',   // ← swap to 'ready' if your discord.js is pre-v14.16
  once: true,
  async execute(client) {
    scheduler.start(client);
  },
};
