/* cogs/pets/constants.js */

const SPECIES = [
  { id: 'cat',     label: 'cat',     emoji: '<a:Cat:1550886134219804773>',     hungerRate: 1.0, thirstRate: 1.0, playBonus: 1.0, price: 500,  desc: 'aloof, low maintenance, purrs when happy' },
  { id: 'dog',     label: 'dog',     emoji: '<a:Dog:1550885332742840350>',     hungerRate: 1.2, thirstRate: 1.1, playBonus: 1.3, price: 500,  desc: 'loves play, gets hungry fast, super loyal' },
  { id: 'dragon',  label: 'dragon',  emoji: '<a:Dragon:1550885947363557376>',  hungerRate: 1.5, thirstRate: 1.3, playBonus: 1.2, price: 5000, desc: 'expensive to feed, sleeps a LOT, powerful' },
  { id: 'bunny',   label: 'bunny',   emoji: '<a:Bunny:1550886553046224988>',   hungerRate: 0.9, thirstRate: 1.2, playBonus: 1.5, price: 800,  desc: 'tiny, needs lots of play, drinks often' },
  { id: 'hamster', label: 'hamster', emoji: '<a:Hamster:1550886303522881596>', hungerRate: 0.8, thirstRate: 0.9, playBonus: 1.4, price: 600,  desc: 'small, cheeks full of snacks, sleepy' },
  { id: 'fox',     label: 'fox',     emoji: '<a:Fox:1550886775927603321>',     hungerRate: 1.0, thirstRate: 1.0, playBonus: 1.4, price: 1500, desc: 'playful, clever, easy to please' },
  { id: 'penguin', label: 'penguin', emoji: '<a:Penguin:1550886951022895237>', hungerRate: 1.1, thirstRate: 0.9, playBonus: 1.1, price: 2000, desc: 'chill, doesn\'t need much water, cute waddle' },
];

const FOODS = [
  { id: 'soup',     label: 'soup',     emoji: '<:Soup:1550892462187487345>',              price: 10,  hunger: 15, happiness: 0,  tier: 'basic' },
  { id: 'steak',    label: 'steak',    emoji: '<:Steak:1550892284034154556>',             price: 60,  hunger: 40, happiness: 10, tier: 'standard' },
  { id: 'sushi',    label: 'sushi',    emoji: '<:Sushi:1550889941037219843>',             price: 80,  hunger: 45, happiness: 15, tier: 'standard' },
  { id: 'cake',     label: 'cake',     emoji: '<:Cake:1550889816466395237>',              price: 100, hunger: 50, happiness: 25, tier: 'premium' },
  { id: 'cupcake',  label: 'cupcake',  emoji: '<:Cupcake:1550891361870553131>',           price: 250, hunger: 100, happiness: 40, tier: 'premium' },
];

const DRINKS = [
  { id: 'water',     label: 'water',     emoji: '<:Water:1550887325213524008>',   price: 5,  thirst: 25, happiness: 0 },
  { id: 'juice',     label: 'juice',     emoji: '<a:Juice:1550891062996902052>',  price: 30, thirst: 60, happiness: 10 },
  { id: 'milkshake', label: 'milkshake', emoji: '<:Milkshake:1550889378774261820>', price: 50, thirst: 100, happiness: 20 },
];

const MEDICINE = { id: 'medicine', label: 'medicine', emoji: '<a:Medicine:1550888991526621336>', price: 150 };

const PET_EMOJI = {
  hunger:    '<:Halloweenghostpizza:1550885026680545371>',
  thirst:    '<:Water:1550887325213524008>',
  happiness: '<:Happy:1550887990715486208>',
  energy:    '<:Energy:1550887563378819244>',
  hygiene:   '<:Soap:1550885127780049026>',
  health:    '<:Health:1550892012562157671>',
  poop:      '<:Cutepoopemoji:1550884788624298055>',
  sleep:     '<a:Sleeping:1550888271410626620>',
  sick:      '<:Sick:1550888485949538335>',
};

const EMOJI = {
  success:  "<:Verified_Icon:1527194184841167010>",
  error:    "<:no:1530373946795364362>",
  cash:     "<:Cash:1550663536223584330>",
  chip:     "<:Casino_Chip:1550664596065620018>",
  file:     "<:File_Icon:1526542046213570681>",
  folder:   "<:Folder_Icon:1526542112806539274>",
  compass:  "<:Compass_Discover_Icon:1526542192494248067>",
  crown:    "<:Holographic_owner_crown:1527401510487461969>",
  on:       "<:on:1545571641684135946>",
  off:      "<:off:1545571608897265726>",
  friends:  "<:Friends:1550655356445659226>",
  settings: "<:Settings:1525601248278216725>",
};

const TICK_MS = 10 * 60 * 1000;          // real 10 min = 1 pet hour
const STARTING_STATS = 100;
const DECAY_PER_TICK = 1;                // base units lost per stat per tick
const POOP_AFTER_MEALS = 3;              // poop after N meals
const POOP_PENALTY_HAPPINESS = 5;
const POOP_PENALTY_HYGIENE = 10;
const SICK_THRESHOLD = 20;               // any stat below this = risk of sick
const CRITICAL_THRESHOLD = 5;            // below this = health drops
const HEALTH_DECAY_CRITICAL = 5;         // health lost per tick in critical
const DEATH_AFTER_CRITICAL_TICKS = 6;    // 6 ticks (1h) in critical = death
const SLEEP_START_HOUR = 22;             // pet hour when auto-sleep kicks in
const SLEEP_END_HOUR = 7;

const COOLDOWNS = {
  feed:    30 * 60 * 1000,
  drink:   15 * 60 * 1000,
  play:    30 * 60 * 1000,
  wash:    2 * 60 * 60 * 1000,
  sleep:   6 * 60 * 60 * 1000,
  medicine: 1 * 60 * 60 * 1000,
  pet:     10 * 60 * 1000,
};

module.exports = {
  SPECIES, FOODS, DRINKS, MEDICINE,
  PET_EMOJI, EMOJI,
  TICK_MS, STARTING_STATS, DECAY_PER_TICK,
  POOP_AFTER_MEALS, POOP_PENALTY_HAPPINESS, POOP_PENALTY_HYGIENE,
  SICK_THRESHOLD, CRITICAL_THRESHOLD, HEALTH_DECAY_CRITICAL, DEATH_AFTER_CRITICAL_TICKS,
  SLEEP_START_HOUR, SLEEP_END_HOUR,
  COOLDOWNS,
};
