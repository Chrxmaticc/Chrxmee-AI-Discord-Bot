/* cogs/verification/config.js — async wrappers around store */

const store = require('./store');

module.exports = {
  get: (guildId) => store.getConfig(guildId),
  set: (guildId, patch) => store.updateConfig(guildId, patch),
  reset: (guildId) => store.resetConfig(guildId),

  async isReady(guildId) {
    const c = await store.getConfig(guildId);
    return c.enabled && c.roleVerified && c.roleUnverified && c.methods.length > 0;
  },

  async missingSetup(guildId) {
    const c = await store.getConfig(guildId);
    const missing = [];
    if (!c.roleVerified) missing.push('verified role');
    if (!c.roleUnverified) missing.push('unverified role');
    if (!c.methods.length) missing.push('at least one method');
    if (!c.panelChannel) missing.push('panel channel (recommended)');
    return missing;
  },
};
