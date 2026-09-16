/* cogs/verification/constants.js — method catalog + fail actions + alt signals + error reasons */

/* ═══════════════ verification methods ═══════════════ */
const METHODS = [
  {
    id: 'button',
    label: 'button',
    desc: 'one-click verify, no gate',
    level: 1,
  },
  {
    id: 'reaction',
    label: 'reaction',
    desc: 'react to the panel to verify',
    level: 1,
  },
  {
    id: 'math',
    label: 'math',
    desc: 'solve an arithmetic problem',
    level: 2,
  },
  {
    id: 'captcha',
    label: 'image captcha',
    desc: 'type the distorted code from an image',
    level: 2,
  },
  {
    id: 'quiz',
    label: 'rules quiz',
    desc: 'answer questions about the rules',
    level: 3,
  },
  {
    id: 'dmcode',
    label: 'dm code',
    desc: 'chromed dms a code, user types it back',
    level: 4,
  },
  {
    id: 'manual',
    label: 'manual review',
    desc: 'staff approves each verify',
    level: 4,
  },
];

/* ═══════════════ captcha styles ═══════════════ */
const CAPTCHA_STYLES = [
  {
    id: 'text',
    label: 'distorted text',
    desc: 'classic captcha look — wavy, noisy, hard for bots',
  },
  {
    id: 'math',
    label: 'math',
    desc: 'arithmetic rendered as an image',
  },
];

/* ═══════════════ fail actions ═══════════════ */
const FAIL_ACTIONS = [
  {
    id: 'quarantine',
    label: 'quarantine',
    desc: 'strip perms, drop to quarantine role',
  },
  {
    id: 'kick',
    label: 'kick',
    desc: 'kick from server — can rejoin and retry',
  },
  {
    id: 'manual',
    label: 'manual review',
    desc: 'send to staff channel for approval',
  },
  {
    id: 'none',
    label: 'none',
    desc: 'let them retry',
  },
];

/* ═══════════════ age gate actions ═══════════════ */
const AGE_GATE_ACTIONS = [
  { id: 'captcha',    label: 'force captcha' },
  { id: 'dmcode',     label: 'force dm code' },
  { id: 'manual',     label: 'manual review' },
  { id: 'quarantine', label: 'quarantine' },
  { id: 'kick',       label: 'kick' },
];

/* ═══════════════ alt signals ═══════════════ */
const ALT_SIGNALS = [
  {
    id: 'new_account',
    label: 'new account',
    desc: 'account is less than 7 days old',
    weight: 2,
  },
  {
    id: 'no_mutual',
    label: 'no mutual servers',
    desc: 'shares 0 other servers with chromed',
    weight: 2,
  },
  {
    id: 'default_avatar',
    label: 'default avatar',
    desc: 'still using the default discord avatar',
    weight: 1,
  },
  {
    id: 'digits_in_name',
    label: 'excess digits',
    desc: 'more than 3 numbers in the username',
    weight: 1,
  },
  {
    id: 'homoglyphs',
    label: 'unicode homoglyphs',
    desc: 'username contains non-latin lookalike chars',
    weight: 2,
  },
  {
    id: 'raid_window',
    label: 'joined during raid',
    desc: 'joined while raid mode is active',
    weight: 3,
  },
  {
    id: 'recent_invite',
    label: 'suspicious invite',
    desc: 'joined via a flagged invite code',
    weight: 2,
  },
];

/* ═══════════════ error reasons (for logging) ═══════════════ */
const ERROR_REASONS = {
  EXPIRED:         'captcha expired',
  WRONG:           'incorrect answer',
  MAX_ATTEMPTS:    'too many attempts',
  NOT_CONFIGURED:  'verification not configured',
  ALREADY_VERIFIED:'already verified',
  ACCOUNT_TOO_NEW: 'account too new',
  SUSPICIOUS:      'flagged as suspicious',
  RAID_MODE:       'raid mode active',
  BLOXLINK_TRAP:   'bloxlink detected',
  MANUAL_DENIED:   'denied by staff',
  DM_CLOSED:       'dms closed',
  CANCELLED:       'cancelled by user',
};

/* ═══════════════ lookups (optional convenience) ═══════════════ */
const METHOD_BY_ID = Object.fromEntries(METHODS.map(m => [m.id, m]));
const FAIL_ACTION_BY_ID = Object.fromEntries(FAIL_ACTIONS.map(f => [f.id, f]));
const AGE_ACTION_BY_ID = Object.fromEntries(AGE_GATE_ACTIONS.map(a => [a.id, a]));
const ALT_SIGNAL_BY_ID = Object.fromEntries(ALT_SIGNALS.map(s => [s.id, s]));
const ALT_WEIGHT = Object.fromEntries(ALT_SIGNALS.map(s => [s.id, s.weight]));

module.exports = {
  METHODS,
  CAPTCHA_STYLES,
  FAIL_ACTIONS,
  AGE_GATE_ACTIONS,
  ALT_SIGNALS,
  ERROR_REASONS,
  /* convenience */
  METHOD_BY_ID,
  FAIL_ACTION_BY_ID,
  AGE_ACTION_BY_ID,
  ALT_SIGNAL_BY_ID,
  ALT_WEIGHT,
};
