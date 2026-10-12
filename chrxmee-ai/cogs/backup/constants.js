// cogs/backup/constants.js

const E = {
  success:  "<:Verified_Icon:1527194184841167010>",
  error:    "<:no:1530373946795364362>",
  warning:  "<:lowwarning:1559014951975395351>",  // ← your warn emoji
  loading:  "<a:emoji_52:1544845538329895032>",
  list:     "<:Folder_Icon:1526542112806539274>",
  timer:    "<:Timer:1559004828733018203>",
  cloud:    "<:cloud1:1559007926952132628>",
  download: "<:download_icon:1559007171914637332>",
  inbox:    "<:inbox:1559008785702457445>",
  trash:    "<:sad_trashcan:1559006806825504779>",
  shield:   "<:Admin_Badge:1527194281234665622>",
};

// ── colors ──
const COLORS = {
  command: 0x7c7ce0,   // periwinkle — for /commands
  backup:  0x808080,   // grey — for everything /backup
  success: 0x57F287,   // green — restore/create finished ok
  error:   0xff4444,   // red — failures
  muted:   0x4f545c,   // dark grey — dead/cancelled
};

const MB = 1024 * 1024;

const CONFIG = {
  defaultQuotaBytes:   10 * MB,
  quotaFloorBytes:     10 * MB,
  quotaGrantStepBytes: 25 * MB,
  ownerMaxQuotaBytes:  10 * 1024 * MB,

  rateLimitMs:          2 * 60 * 1000,
  confirmTimeoutMs:     60_000,
  restoreOpDelayMs:     300,
  emojiOpDelayMs:       400,
  restoreLockWindowMs:  5 * 60 * 1000,
  schedulerTickMs:      30_000,
  maxListResults:       25,

  payloadVersion: 1,

  FREQ: {
    every_6h:  6 * 60 * 60 * 1000,
    every_12h: 12 * 60 * 60 * 1000,
    daily:     24 * 60 * 60 * 1000,
    weekly:    7 * 24 * 60 * 60 * 1000,
  },
};

const FREQ_LABELS = {
  every_6h:  "every 6 hours",
  every_12h: "every 12 hours",
  daily:     "daily",
  weekly:    "weekly",
};

const QUOTA_MESSAGE = [
  `${E.trash} hey, sorry to say this but you cannot create or schedule any more backups.`,
  ``,
  `you have **10MB** of storage and you blown that, which I am surprised. 🤯`,
  ``,
  `if you need more storage (we get it!) then join the [support server](https://discord.gg/7SCKntW9Qr) ${E.cloud}`,
  ``,
  `-# we aren't really greedy at all, we have limited storage due to our pg host being greedy as shit, this storage limit is designed for speed, light storage for our bot and quick asf. ${E.timer}`,
  ``,
  `-# if you need more storage. the owner can personally give you more support, create a ticket for more storage, tell your situation and you get storage depending on your situation! ${E.inbox}`,
].join("\n");

const OWNER_IDS = (process.env.OWNER_IDS || "")
  .split(",").map((s) => s.trim()).filter(Boolean);

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < MB) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * MB) return `${(n / MB).toFixed(2)} MB`;
  return `${(n / 1024 / MB).toFixed(2)} GB`;
}

module.exports = {
  E, COLORS, CONFIG, QUOTA_MESSAGE, OWNER_IDS, FREQ_LABELS, MB, formatBytes,
};
