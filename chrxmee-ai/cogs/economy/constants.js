/* cogs/economy/constants.js */

const OWNER_ID = process.env.OWNER_ID || '';

const EMOJI = {
  success:      "<:Verified_Icon:1527194184841167010>",
  error:        "<:no:1530373946795364362>",
  cash:         "<:Cash:1550663536223584330>",
  sheckles:     "<:Sheckles:1546579888666841180>",
  daily:        "<:Daily:1546639742525771878>",
  work:         "<:Work:1546638759762595950>",
  thief:        "<:thief:1546640335743094815>",
  shop:         "<:Shop:1546639313373233244>",
  promotion:    "<:Promotion:1546639930397171803>",
  bank:         "<:Bank:1550900707169673319>",
  history:      "<:History:1550901727547498579>",
  achievements: "<a:Achievements:1550901463117594825>",
  info:         "<:Information:1550902238443077777>",
  upvote:       "<:upvote:1546580303664123956>",
  downvote:     "<:Downvote:1546580379954188378>",
  trophy:       "<:GiveawayTrophy:1546601598405447749>",
  chip:         "<:Casino_Chip:1550664596065620018>",
  crown:        "<:Holographic_owner_crown:1527401510487461969>",
  file:         "<:File_Icon:1526542046213570681>",
  on:           "<:on:1545571641684135946>",
  off:          "<:off:1545571608897265726>",
  friends:      "<:Friends:1550655356445659226>",
};

/* ── daily rewards (scaled by streak) ── */
const DAILY_BASE = 100;              // day 1 cash
const DAILY_STREAK_BONUS = 25;       // +25 cash per consecutive day
const DAILY_STREAK_MAX = 30;         // streak caps at 30 days
const DAILY_SCHECKLES_BONUS = 5;     // +5 sheckles per day
const DAILY_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/* ── jobs ── */
const JOBS = [
  { id: 'fastfood',  label: 'fast food',   emoji: '🍔', pay: 30,  cooldown: 5 * 60 * 1000,  prestige: 1,  desc: 'flip burgers' },
  { id: 'retail',    label: 'retail',      emoji: '🛒', pay: 60,  cooldown: 10 * 60 * 1000, prestige: 2,  desc: 'stock shelves' },
  { id: 'delivery',  label: 'delivery',    emoji: '🚚', pay: 100, cooldown: 15 * 60 * 1000, prestige: 3,  desc: 'drop off packages' },
  { id: 'server',    label: 'server',      emoji: '🍽️', pay: 150, cooldown: 20 * 60 * 1000, prestige: 5,  desc: 'wait tables' },
  { id: 'dev',       label: 'developer',   emoji: '💻', pay: 400, cooldown: 30 * 60 * 1000, prestige: 10, desc: 'write code' },
  { id: 'trader',    label: 'trader',      emoji: '📈', pay: 900, cooldown: 45 * 60 * 1000, prestige: 20, desc: 'move markets' },
  { id: 'exec',      label: 'executive',   emoji: '💼', pay: 2500, cooldown: 60 * 60 * 1000, prestige: 40, desc: 'sign papers' },
  { id: 'ceo',       label: 'ceo',         emoji: '👑', pay: 8000, cooldown: 90 * 60 * 1000, prestige: 70, desc: 'run the company' },
];

const WORK_COOLDOWN_MS = 5 * 60 * 1000;
const WORK_BASE_PAY = 25;

/* ── prestige tiers ── */
const PRESTIGE_TIERS = [
  { level: 1,   earned: 0,        title: 'novice' },
  { level: 5,   earned: 10000,    title: 'worker' },
  { level: 10,  earned: 50000,    title: 'hustler' },
  { level: 20,  earned: 250000,   title: 'entrepreneur' },
  { level: 30,  earned: 1000000,  title: 'tycoon' },
  { level: 40,  earned: 5000000,  title: 'magnate' },
  { level: 50,  earned: 25000000, title: 'mogul' },
  { level: 65,  earned: 100000000, title: 'whale' },
  { level: 80,  earned: 500000000, title: 'legend' },
  { level: 95,  earned: 2000000000, title: 'mythic' },
];

/* ── bank ── */
const BANK_INTEREST_BASE = 0.005;    // 0.5% per day at prestige 1
const BANK_INTEREST_PER_PRESTIGE = 0.001; // +0.1% per level
const BANK_INTEREST_MAX = 0.02;      // hard cap at 2%
const BANK_INTEREST_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/* ── rob ── */
const ROB_COOLDOWN_MS = 15 * 60 * 1000;
const ROB_SUCCESS_CHANCE = 0.45;
const ROB_MIN_TARGET = 100;           // target needs at least this in wallet
const ROB_MAX_TAKE = 0.15;            // 15% of target's wallet
const ROB_FINE = 0.10;                // fine = 10% of your own wallet if caught

/* ── tax ── */
const GIVE_TAX_RATE = 0.02;           // 2% transfer tax

/* ── achievements (add more later) ── */
const ACHIEVEMENTS = [
  { id: 'first_1k',     label: 'first 1k',         desc: 'earn your first 1,000 cash',       reward: 500 },
  { id: 'first_10k',    label: 'first 10k',        desc: 'reach 10,000 total earned',        reward: 2000 },
  { id: 'first_100k',   label: 'first 100k',       desc: 'reach 100,000 total earned',       reward: 10000 },
  { id: 'first_1m',     label: 'millionaire',      desc: 'reach 1,000,000 total earned',     reward: 100000 },
  { id: 'daily_7',      label: 'daily habit',      desc: 'claim 7 dailies',                  reward: 500 },
  { id: 'daily_30',     label: 'monthly grinder',  desc: 'claim 30 dailies',                 reward: 5000 },
  { id: 'work_10',      label: 'hard worker',      desc: 'work 10 times',                    reward: 500 },
  { id: 'work_100',     label: 'workaholic',       desc: 'work 100 times',                   reward: 5000 },
  { id: 'rob_1',        label: 'first robbery',    desc: 'successfully rob someone',         reward: 250 },
  { id: 'rob_10',       label: 'serial thief',     desc: 'successfully rob 10 times',        reward: 2500 },
  { id: 'give_1',       label: 'generous',         desc: 'give someone cash',                reward: 100 },
  { id: 'give_100',     label: 'philanthropist',   desc: 'give away 100,000 total',          reward: 10000 },
  { id: 'prestige_10',  label: 'hustler',          desc: 'reach prestige 10',                reward: 5000 },
  { id: 'prestige_30',  label: 'tycoon',           desc: 'reach prestige 30',                reward: 50000 },
  { id: 'pets_1',       label: 'pet owner',        desc: 'adopt your first pet',             reward: 250 },
  { id: 'pets_5',       label: 'pet hoarder',      desc: 'own 5 pets over time',             reward: 2500 },
  { id: 'gamble_big',   label: 'big spender',      desc: 'win 10,000 in one gamble',         reward: 1000 },
  { id: 'bank_first',   label: 'saver',            desc: 'bank your first 1,000',            reward: 100 },
];

/* ── shop items ── */
const SHOP_ITEMS = [
  { id: 'work_boost',  label: 'work boost',     emoji: '⚡', price: 5000,   desc: '+25% work pay for 24h',        consumable: true, duration: 24 * 60 * 60 * 1000 },
  { id: 'lucky_charm', label: 'lucky charm',    emoji: '🍀', price: 10000,  desc: '+5% gamble win rate for 24h',  consumable: true, duration: 24 * 60 * 60 * 1000 },
  { id: 'shield',      label: 'rob shield',     emoji: '🛡️', price: 3000,   desc: 'immune to rob for 12h',        consumable: true, duration: 12 * 60 * 60 * 1000 },
  { id: 'name_color',  label: 'name color',     emoji: '🎨', price: 50000,  desc: 'custom color in economy messages', consumable: false },
  { id: 'vip_badge',   label: 'vip badge',      emoji: '💎', price: 100000, desc: 'vip tag next to your name',    consumable: false },
  { id: 'pet_discount',label: 'pet discount',   emoji: '🐾', price: 25000,  desc: '-25% pet care costs forever',  consumable: false },
];

/* ── helpers ── */
function display(cash, sheckles) {
  const c = Number(cash) || 0;
  const s = Number(sheckles) || 0;
  if (s === 0) return `${EMOJI.cash} **${c.toLocaleString()}**`;
  return `${EMOJI.cash} **${c.toLocaleString()}** ${EMOJI.sheckles} **${s}**`;
}

function totalSheckles(cash, sheckles) { return (Number(cash) || 0) * 100 + (Number(sheckles) || 0); }

function fromSheckles(total) {
  const t = Math.max(0, Math.floor(Number(total) || 0));
  return { cash: Math.floor(t / 100), sheckles: t % 100 };
}

function prestigeFromEarned(earned) {
  let best = PRESTIGE_TIERS[0];
  for (const t of PRESTIGE_TIERS) if (earned >= t.earned) best = t;
  return best;
}

module.exports = {
  OWNER_ID, EMOJI,
  DAILY_BASE, DAILY_STREAK_BONUS, DAILY_STREAK_MAX, DAILY_SCHECKLES_BONUS, DAILY_COOLDOWN_MS,
  JOBS, WORK_COOLDOWN_MS, WORK_BASE_PAY,
  PRESTIGE_TIERS,
  BANK_INTEREST_BASE, BANK_INTEREST_PER_PRESTIGE, BANK_INTEREST_MAX, BANK_INTEREST_COOLDOWN_MS,
  ROB_COOLDOWN_MS, ROB_SUCCESS_CHANCE, ROB_MIN_TARGET, ROB_MAX_TAKE, ROB_FINE,
  GIVE_TAX_RATE,
  ACHIEVEMENTS, SHOP_ITEMS,
  display, totalSheckles, fromSheckles, prestigeFromEarned,
};
