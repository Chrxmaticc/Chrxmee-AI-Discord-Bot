const { engine } = require('../cogs/verification');

module.exports = {
  name: 'guildMemberAdd',
  async execute(member) {
    engine.onJoin(member).catch(e => console.error('[verify] onJoin:', e));
  },
};
