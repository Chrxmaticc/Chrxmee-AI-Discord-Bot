// cogs/persona/constants.js

const E = {
  success:  "<:Verified_Icon:1527194184841167010>",
  error:    "<:no:1530373946795364362>",
  warning:  "<:lowwarning:1559014951975395351>",
  loading:  "<a:emoji_52:1544845538329895032>",
  list:     "<:Folder_Icon:1526542112806539274>",

  // persona-specific
  server:   "<:Channel:1531901854361849929>",
  user:     "<:Friends:1550655356445659226>",
  brain:    "<:Brain:1560402629014716558>",
  speak:    "<:reply:1560405605686972516>",
  chance:   "<:pixel_symbol_percent:1560405457045168238>",
  timer:    "<:Timer:1559004828733018203>",
  gif:      "<:gif:1560405126705979394>",
  mention:  "<:discord_mention:1560403284391497801>",
  filter:   "<:Filter:1560402991985729662>",
  edit:     "<:pencil:1560405746904997929>",
  settings: "<:settings:1560405283178684508>",
  backfill: "<:download_icon:1559007171914637332>",
  reset:    "<:sad_trashcan:1559006806825504779>",
  on:       "<:on:1545571641684135946>",
  off:      "<:off:1545571608897265726>",
};

const COLORS = {
  command: 0x7c7ce0,
  persona: 0xa78bfa,
  success: 0x57F287,
  warn:    0xfaa61a,
  error:   0xff4444,
  muted:   0x4f545c,
};

const OWNER_IDS = (process.env.OWNER_IDS || "")
  .split(",").map((s) => s.trim()).filter(Boolean);

/* ═══════════════════════════════════════════════════════════════
   DEFAULTS
   ═══════════════════════════════════════════════════════════════ */
const DEFAULTS = {
  // server persona
  serverEnabled: false,
  serverChannels: [],              // channel ids to learn from
  serverMinMessages: 40,           // messages before speaking
  serverChance: 5,                 // % chance to reply (0-100)
  serverCooldownMs: 30_000,        // per-channel cooldown
  serverGifs: true,
  serverMentions: true,            // reply when @mentioned (bypasses %)
  serverIgnoreBots: true,

  // user persona
  userEnabled: true,               // allow user personas at all
  userMinMessages: 40,             // per-user default
  userMaxCorpus: 2000,             // per-user per-guild message cap

  // learning
  extractionEvery: 50,             // re-extract profile every N new messages
  corpusMaxPerChannel: 2000,       // cap per channel
  backfillMax: 1000,               // how many messages to backfill per command

  // confidence curve
  confidenceMin: 40,               // below this → confidence ~0
  confidenceMax: 2000,             // at this → confidence ~95%

  // mention boost
  mentionBoost: 20,                // % added when @mentioned
  questionBoost: 10,               // % added when message ends with ?
  topicMatchMultiplier: 2,         // multiply chance if topic matches
};

const CONTEXT_WINDOW = 15;         // recent messages passed to LLM

/* ═══════════════════════════════════════════════════════════════
   BLOCKED WORDS — hardcoded, CANNOT be removed
   Organized by category. Add to this list at will.
   ═══════════════════════════════════════════════════════════════ */

// ⚠️ This is the hardcoded slur list. It's intentionally broad.
// Whenever chromed reads a message for learning, if it contains
// any of these words, the message is skipped.
// Whenever chromed is about to speak, if its output contains any
// of these words, they're stripped or the message is regen'd.
const HARD_BLOCKED = [
  // racial + ethnic slurs
  "nigger", "nigga", "niglet", "kike", "spic", "wetback", "chink",
  "gook", "jap", "raghead", "towelhead", "sandnigger", "coon",
  "darkie", "porch monkey", "beaner", "gringo", "cracker", "honky",
  "redskin", "injun", "half-breed",

  // homophobic + transphobic slurs
  "faggot", "fag", "dyke", "tranny", "shemale", "homo", "queer" /* only as slur context */,
  "fudgepacker", "battyboy",

  // antisemitic
  "kike", "yid", "heeb", "sheeny",

  // islamophobic
  "raghead", "towelhead", "camel jockey",

  // ableist
  "retard", "retarded", "spastic", "spaz", "window licker", "mongoloid",

  // CSAM-adjacent (do not expand)
  "cp", "child porn", "childporn", "csam", "loli", "shota" /* when referring to real minors */,
  "jailbait",

  // hard drug sales
  "buy meth", "buy coke", "buy heroin", "fentanyl for sale", "plug for weed",
  "telegram plug", "wickr me", "session app plug",

  // doxxing patterns
  "ssn is", "social security is", "home address is", "credit card is",
];

// Soft-blocked — obey the guild's existing swear_block table + these
const SOFT_BLOCKED_EXTRA = [
  // common slurs you can toggle off if you want
  "slut", "whore", "cunt", "bitch", "bastard",
];

/* ═══════════════════════════════════════════════════════════════
   DEFAULT STYLE PROFILE SHAPE
   ═══════════════════════════════════════════════════════════════ */
function emptyProfile() {
  return {
    tone: "",
    avg_length: 0,
    phrases: [],
    punctuation: "",
    emoji_style: "",
    topics: [],
    avoid: [],
    sample_messages: [],
    confidence: 0,
    sample_count: 0,
  };
}

/* ═══════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════ */
function confidenceFromSamples(samples) {
  const { confidenceMin, confidenceMax } = DEFAULTS;
  if (samples <= confidenceMin) return 0;
  if (samples >= confidenceMax) return 95;
  // log curve — climbs fast early, slows near cap
  const t = (samples - confidenceMin) / (confidenceMax - confidenceMin);
  return Math.round(95 * Math.log(1 + 9 * t) / Math.log(10));
}

function formatMs(ms) {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

module.exports = {
  E, COLORS, OWNER_IDS,
  DEFAULTS, CONTEXT_WINDOW,
  HARD_BLOCKED, SOFT_BLOCKED_EXTRA,
  emptyProfile,
  confidenceFromSamples,
  formatMs,
};
