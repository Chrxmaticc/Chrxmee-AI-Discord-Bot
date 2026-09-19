/* cogs/gambling/constants.js */

const GAME_EMOJI = {
  slots:     '<:Lottery:1546640064317235311>',
  coinflip:  '<:wumpus_coin:1541899215893041243>',
  dice:      '<:dice:1541902912853381200>',
  blackjack: '<:BlackJack:1550663023956467723>',
  roulette:  '<:Target:1550873144728879215>',
  crash:     '<:Downvote:1546580379954188373>',
  wheel:     '<:Wheel:1550668217524166697>',
  horse:     '<:MonkeyonHorsie:1550662338032697424>',
};

const EMOJI = {
  success:  "<:Verified_Icon:1527194184841167010>",
  error:    "<:no:1530373946795364362>",
  cash:     "<:Cash:1550663536223584330>",
  chip:     "<:Casino_Chip:1550664596065620018>",
  jackpot:  "<:Gamble_Golden:1550665187336523786>",
  money:    "<:Money_Cry_Son:1526538340264841257>",
  file:     "<:File_Icon:1526542046213570681>",
  folder:   "<:Folder_Icon:1526542112806539274>",
  compass:  "<:Compass_Discover_Icon:1526542192494248067>",
  crown:    "<:Holographic_owner_crown:1527401510487461969>",
  on:       "<:on:1545571641684135946>",
  off:      "<:off:1545571608897265726>",
  laugh:    "<:Cringe_Laughing_Son:1526539082564374710>",
  agree:    "<:agreed:1525639597135237131>",
};

const STARTING_BALANCE = 1000;
const MIN_BET = 10;
const MAX_BET = 1000000;
const COOLDOWN_SECONDS = 3;
const BIG_WIN_THRESHOLD = 10000;
const DAILY_AMOUNT = 500;
const DAILY_COOLDOWN_MS = 24 * 60 * 60 * 1000;

const SLOT_SYMBOLS = [
  { emoji: '<:SlotsItem1:1550662633814888488>', weight: 30, triple: 3,  double: 0.5 },
  { emoji: '<:SlotsItem2:1550662701619879936>', weight: 25, triple: 4,  double: 0.5 },
  { emoji: '<:SlotsItem3:1550662780775047211>', weight: 20, triple: 6,  double: 0.5 },
  { emoji: '<:SlotsItem4:1550662856708595742>', weight: 15, triple: 10, double: 1 },
  { emoji: '<:SlotsItem5:1550662942905602088>', weight: 10, triple: 25, double: 2 },
];

const WHEEL_SEGMENTS = [
  { mult: 0,   weight: 3, label: 'bust' },
  { mult: 0.5, weight: 3, label: 'x0.5' },
  { mult: 1,   weight: 3, label: 'x1' },
  { mult: 1.5, weight: 2, label: 'x1.5' },
  { mult: 2,   weight: 2, label: 'x2' },
  { mult: 3,   weight: 1, label: 'x3' },
  { mult: 5,   weight: 1, label: 'x5' },
  { mult: 10,  weight: 1, label: 'x10' },
];

const ROULETTE_RED = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
const ROULETTE_BLACK = [2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35];

module.exports = {
  GAME_EMOJI, EMOJI,
  STARTING_BALANCE, MIN_BET, MAX_BET, COOLDOWN_SECONDS, BIG_WIN_THRESHOLD,
  DAILY_AMOUNT, DAILY_COOLDOWN_MS,
  SLOT_SYMBOLS, WHEEL_SEGMENTS,
  ROULETTE_RED, ROULETTE_BLACK,
};
