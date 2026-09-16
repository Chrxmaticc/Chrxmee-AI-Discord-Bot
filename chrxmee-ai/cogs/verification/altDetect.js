/* cogs/verification/altDetect.js — suspicious signal scoring */

const { ALT_SIGNALS } = require('./constants');

const WEIGHT_MAP = Object.fromEntries(ALT_SIGNALS.map(s => [s.id, s.weight]));

async function scoreMember(member, config, extra = {}) {
  const signals = [];
  let total = 0;
  const enabled = new Set(config.altSignals || []);
  const accountAgeDays = Math.floor((Date.now() - member.user.createdTimestamp) / 86400000);

  if (enabled.has('new_account') && accountAgeDays < 7) {
    signals.push('new_account');
    total += WEIGHT_MAP.new_account;
  }

  if (enabled.has('no_mutual')) {
    const mutual = member.client.guilds.cache.reduce(
      (n, g) => n + (g.members.cache.has(member.id) ? 1 : 0),
      0
    );
    if (mutual === 0) {
      signals.push('no_mutual');
      total += WEIGHT_MAP.no_mutual;
    }
  }

  if (enabled.has('default_avatar') && !member.user.avatar) {
    signals.push('default_avatar');
    total += WEIGHT_MAP.default_avatar;
  }

  if (enabled.has('digits_in_name')) {
    const digits = (member.user.username.match(/\d/g) || []).length;
    if (digits > 3) {
      signals.push('digits_in_name');
      total += WEIGHT_MAP.digits_in_name;
    }
  }

  if (enabled.has('homoglyphs')) {
    const hasUnicode = /[^\x00-\x7F]/.test(member.user.username);
    if (hasUnicode) {
      signals.push('homoglyphs');
      total += WEIGHT_MAP.homoglyphs;
    }
  }

  if (enabled.has('raid_window') && extra.raidMode) {
    signals.push('raid_window');
    total += WEIGHT_MAP.raid_window;
  }

  if (enabled.has('recent_invite') && extra.suspiciousInvite) {
    signals.push('recent_invite');
    total += WEIGHT_MAP.recent_invite;
  }

  return { signals, total };
}

function shouldForceStronger(total, config) {
  const threshold = config.altThreshold ?? 4;
  if (total >= threshold + 2) return 'manual';
  if (total >= threshold) return config.altSignalAction || 'captcha';
  return null;
}

module.exports = { scoreMember, shouldForceStronger };
