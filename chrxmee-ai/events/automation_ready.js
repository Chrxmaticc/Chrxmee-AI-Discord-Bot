const { scheduler } = require('../cogs/automation');

module.exports = {
  name: 'clientReady', // hi
  once: true,
  async execute(client) {
    scheduler.start(client);
  },
};
