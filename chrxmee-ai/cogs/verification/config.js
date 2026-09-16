/* cogs/verification/config.js — config helpers */

const store = require('./store');

module.exports = {
  get: (guildId) => store.getConfig(guildId),
  set: (guildId, patch) => store.updateConfig(guildId, patch),
  reset: (guildId) => store.resetConfig(guildId),

  isReady(guildId) {
    const c = store.getConfig(guildId);
    return c.enabled && c.roleVerified && c.roleUnverified && c.methods.length > 0;
  },

  missingSetup(guildId) {
    const c = store.getConfig(guildId);
    const missing = [];
    if (!c.roleVerified) missing.push('verified role');
    if (!c.roleUnverified) missing.push('unverified role');
    if (!c.methods.length) missing.push('at least one method');
    if (!c.panelChannel) missing.push('panel channel (recommended)');
    return missing;
  },
};
