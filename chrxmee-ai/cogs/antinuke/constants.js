// cogs/antinuke/constants.js

const E = {
  success:  "<:Verified_Icon:1527194184841167010>",
  error:    "<:no:1530373946795364362>",
  warning:  "<:lowwarning:1559014951975395351>",
  loading:  "<a:emoji_52:1544845538329895032>",
  list:     "<:Folder_Icon:1526542112806539274>",
  timer:    "<:Timer:1559004828733018203>",
  cloud:    "<:cloud1:1559007926952132628>",
  download: "<:download_icon:1559007171914637332>",
  inbox:    "<:inbox:1559008785702457445>",
  trash:    "<:sad_trashcan:1559006806825504779>",
  shield:   "<:Admin_Badge:1527194281234665622>",
  hammer:   "<:hammer:1530375976381448303>",
  lock:     "<:lock:1530377198324945056>",
  unlock:   "<:unlock:1530377714995826831>",
  kick:     "<:Personkick:1530376715698704574>",
  ban:      "<:hammer:1530375976381448303>",
};

const COLORS = {
  command: 0x7c7ce0,
  antinuke: 0xc0392b,
  success: 0x57F287,
  warn:    0xfaa61a,
  error:   0xff4444,
  muted:   0x4f545c,
};

const OWNER_IDS = (process.env.OWNER_IDS || "")
  .split(",").map((s) => s.trim()).filter(Boolean);

/* ═══════════════════════════════════════════════════════════════
   DEFAULTS — every value here is overridable per-guild
   ═══════════════════════════════════════════════════════════════ */

// event key → default threshold (count in window)
const DEFAULT_THRESHOLDS = {
  channelDelete:    3,
  channelCreate:    5,
  channelUpdate:    5,
  roleDelete:       3,
  roleCreate:       5,
  roleUpdate:       5,
  banAdd:           5,
  kick:             5,
  emojiDelete:      5,
  emojiCreate:      10,
  stickerDelete:    5,
  stickerCreate:    10,
  webhookCreate:    3,
  webhookDelete:    5,
  webhookUpdate:    3,
  guildUpdate:      2,
  memberRoleUpdate: 5,
  inviteCreate:     5,
  inviteDelete:     5,
  threadDelete:     5,
  threadCreate:     10,
  permEscalation:   1,   // granting dangerous perms = instant
};

// event key → primary window in ms (how far back to count)
const DEFAULT_WINDOWS = {
  channelDelete:    10_000,
  channelCreate:    10_000,
  channelUpdate:    10_000,
  roleDelete:       10_000,
  roleCreate:       10_000,
  roleUpdate:       10_000,
  banAdd:           10_000,
  kick:             10_000,
  emojiDelete:      10_000,
  emojiCreate:      10_000,
  stickerDelete:    10_000,
  stickerCreate:    10_000,
  webhookCreate:    10_000,
  webhookDelete:    10_000,
  webhookUpdate:    10_000,
  guildUpdate:      30_000,
  memberRoleUpdate: 10_000,
  inviteCreate:     10_000,
  inviteDelete:     10_000,
  threadDelete:     10_000,
  threadCreate:     10_000,
  permEscalation:   5000,
};

// secondary long-window check (catches slow nukes)
const DEFAULT_LONG_WINDOW = {
  enabled:    true,
  windowMs:   5 * 60 * 1000,
  multiplier: 4,   // trigger if count > threshold × multiplier in long window
};

// rate spike fallback — triggers before audit log even resolves
const DEFAULT_RATE_SPIKE = {
  enabled:   true,
  count:     20,
  windowMs:  3000,
};

// audit log retry (handles Discord lag)
const DEFAULT_AUDIT_RETRY = {
  attempts: 3,
  delayMs:  500,
};

// punishment modes
const PUNISHMENTS = {
  log_only:   { label: "log only (no action)", order: 0 },
  strip:      { label: "remove all roles",     order: 1 },
  timeout:    { label: "28-day timeout",       order: 2 },
  kick:       { label: "kick",                 order: 3 },
  ban:        { label: "ban + delete msgs",    order: 4 },
  strip_kick: { label: "strip roles + kick",   order: 5 },
};

// escalation: same user triggering again within window upgrades punishment
const DEFAULT_ESCALATION = {
  enabled:   true,
  windowMs:  24 * 60 * 60 * 1000,
  upgrade:   "next", // next = one step up the order
};

// dangerous permissions — granting these triggers permEscalation
const DANGEROUS_PERMS = [
  "Administrator",
  "ManageGuild",
  "ManageRoles",
  "ManageChannels",
  "BanMembers",
  "KickMembers",
  "ManageWebhooks",
  "MentionEveryone",
];

// raid mode defaults
const DEFAULT_RAID = {
  enabled:          false,
  joinsPerMinute:   10,
  dmsPerMinute:     5,      // not directly detectable — informational only
  invitesPerMinute: 5,
  autoLockdown:     true,
  lockdownDuration: 10 * 60 * 1000,  // 10 min
  lockdownHide:     true,
  lockdownSlowmode: 30,     // seconds
  lockdownKickNew:  false,  // kick accounts < 7 days old during lockdown
  minAccountAgeDays: 7,
};

// safe mode on new guild join
const DEFAULT_SAFE_MODE = {
  enabled:  true,
  duration: 24 * 60 * 60 * 1000,   // 24h
};

// notification config
const DEFAULT_NOTIFY = {
  logChannel:        null,   // channel id
  dmExecutor:        false,  // DM the punished user
  dmOwner:           true,   // DM the guild owner
  mentionRole:       null,   // role id to ping in log channel
  includeSnapshotId: true,   // show panic snapshot id in alert
  includeAuditUrl:   true,   // link to Discord audit log
};

// default whitelist additions (server owner + chromed auto-added)
const AUTO_WHITELIST_TYPES = ["user", "role", "bot"];

// cross-guild trust defaults
const DEFAULT_TRUST = {
  enabled:          false,      // opt-in per guild
  shareBans:        false,      // push own bans to trusted guilds
  acceptBans:       false,      // accept bans from trusted guilds
  minTrustLevel:    1,          // 1 = direct trust, 2 = mutual, etc
};

/* ═══════════════════════════════════════════════════════════════
   MASTER SETTINGS SHAPE (what gets stored in JSONB)
   ═══════════════════════════════════════════════════════════════ */
function defaultSettings() {
  return {
    enabled:      false,
    mode:         "normal",       // normal | dry-run
    safeMode:     { ...DEFAULT_SAFE_MODE, until: 0 },
    punishment:   "strip_kick",
    thresholds:   { ...DEFAULT_THRESHOLDS },
    windows:      { ...DEFAULT_WINDOWS },
    longWindow:   { ...DEFAULT_LONG_WINDOW },
    rateSpike:    { ...DEFAULT_RATE_SPIKE },
    auditRetry:   { ...DEFAULT_AUDIT_RETRY },
    escalation:   { ...DEFAULT_ESCALATION },
    raid:         { ...DEFAULT_RAID },
    notify:       { ...DEFAULT_NOTIFY },
    trust:        { ...DEFAULT_TRUST },
    ignoreChannels: [],   // channel ids where antinuke is skipped
    ignoreActions:  [],   // action keys to skip entirely
    panicOnTrigger: true, // auto-panic snapshot before punish
    autoRestore:    false,
    updatedAt:      0,
  };
}

module.exports = {
  E, COLORS, OWNER_IDS,
  DEFAULT_THRESHOLDS, DEFAULT_WINDOWS,
  DEFAULT_LONG_WINDOW, DEFAULT_RATE_SPIKE, DEFAULT_AUDIT_RETRY,
  DEFAULT_ESCALATION, DEFAULT_RAID, DEFAULT_SAFE_MODE,
  DEFAULT_NOTIFY, DEFAULT_TRUST, AUTO_WHITELIST_TYPES,
  PUNISHMENTS, DANGEROUS_PERMS,
  defaultSettings,
};
