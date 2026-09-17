/* cogs/moderation/constants.js */

const CASE_TYPES = [
  { id: 'warn',     label: 'warn',      color: 0xf5c34a, emoji: 'warn' },
  { id: 'timeout',  label: 'timeout',   color: 0xe67e22, emoji: 'lock' },
  { id: 'mute',     label: 'mute',      color: 0xe67e22, emoji: 'lock' },
  { id: 'kick',     label: 'kick',      color: 0xff8c42, emoji: 'kick' },
  { id: 'ban',      label: 'ban',       color: 0xff3b3b, emoji: 'ban' },
  { id: 'tempban',  label: 'temp ban',  color: 0xff3b3b, emoji: 'ban' },
  { id: 'softban',  label: 'soft ban',  color: 0xff3b3b, emoji: 'ban' },
  { id: 'unban',    label: 'unban',     color: 0x57f287, emoji: 'unlock' },
  { id: 'unmute',   label: 'unmute',    color: 0x57f287, emoji: 'unlock' },
  { id: 'unwarn',   label: 'unwarn',    color: 0x57f287, emoji: 'success' },
  { id: 'note',     label: 'note',      color: 0x5b7fd4, emoji: 'file' },
  { id: 'purge',    label: 'purge',     color: 0x5b7fd4, emoji: 'folder' },
];

const AUTOMOD_RULES = [
  { id: 'mention_cap',   label: 'mention cap',      desc: 'max mentions per message',        weight: 2 },
  { id: 'caps',          label: 'caps filter',      desc: 'percent of message that is caps', weight: 1 },
  { id: 'spam',          label: 'spam filter',      desc: 'duplicate msgs in X seconds',     weight: 3 },
  { id: 'invite',        label: 'invite links',     desc: 'discord.gg invites',              weight: 2 },
  { id: 'links',         label: 'external links',   desc: 'non-whitelisted urls',            weight: 2 },
  { id: 'zalgo',         label: 'zalgo filter',     desc: 'combining diacritics spam',       weight: 2 },
  { id: 'emoji_spam',    label: 'emoji spam',       desc: 'too many emojis in a row',        weight: 1 },
];

const ESCALATION_PRESETS = [
  {
    id: 'chill',
    label: 'chill',
    desc: 'warn-only. no auto action.',
    rules: [],
  },
  {
    id: 'standard',
    label: 'standard',
    desc: '3 warns → 1h timeout, 5 → 1d, 7 → kick, 10 → ban',
    rules: [
      { warns: 3, action: 'timeout', duration: 3600000 },
      { warns: 5, action: 'timeout', duration: 86400000 },
      { warns: 7, action: 'kick' },
      { warns: 10, action: 'ban' },
    ],
  },
  {
    id: 'strict',
    label: 'strict',
    desc: '2 warns → 1h mute, 4 → 1d ban, 6 → permanent',
    rules: [
      { warns: 2, action: 'timeout', duration: 3600000 },
      { warns: 4, action: 'tempban', duration: 86400000 },
      { warns: 6, action: 'ban' },
    ],
  },
];

const FAIL_ACTIONS = [
  { id: 'none',       label: 'none',        desc: 'let staff handle manually' },
  { id: 'warn',       label: 'auto warn',   desc: 'add a warning' },
  { id: 'timeout',    label: 'auto timeout', desc: '1h timeout' },
  { id: 'quarantine', label: 'quarantine',  desc: 'requires verification cog' },
];

module.exports = {
  CASE_TYPES,
  AUTOMOD_RULES,
  ESCALATION_PRESETS,
  FAIL_ACTIONS,
  CASE_BY_ID: Object.fromEntries(CASE_TYPES.map(c => [c.id, c])),
  AUTOMOD_BY_ID: Object.fromEntries(AUTOMOD_RULES.map(r => [r.id, r])),
};
