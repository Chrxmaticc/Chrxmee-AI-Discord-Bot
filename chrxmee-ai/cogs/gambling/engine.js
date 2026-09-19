/* cogs/gambling/engine.js */
const store = require('./store');
const {
  SLOT_SYMBOLS, WHEEL_SEGMENTS, ROULETTE_RED, ROULETTE_BLACK,
} = require('./constants');

function pickWeighted(items) {
  const total = items.reduce((s, x) => s + x.weight, 0);
  let r = Math.random() * total;
  for (const it of items) { r -= it.weight; if (r <= 0) return it; }
  return items[items.length - 1];
}

/* ── SLOTS ── */
function spinSlots() {
  const reels = [];
  for (let i = 0; i < 3; i++) reels.push(pickWeighted(SLOT_SYMBOLS));
  const [a, b, c] = reels;
  let mult = 0;
  let matchLabel = 'no match';
  if (a === b && b === c) { mult = a.triple; matchLabel = `triple ${a.emoji}`; }
  else if (a === b) { mult = a.double; matchLabel = `pair ${a.emoji}`; }
  else if (b === c) { mult = b.double; matchLabel = `pair ${b.emoji}`; }
  else if (a === c) { mult = a.double; matchLabel = `pair ${a.emoji}`; }
  return { reels: [a.emoji, b.emoji, c.emoji], mult, matchLabel };
}

/* ── COINFLIP ── */
function flipCoin(choice) {
  const result = Math.random() < 0.5 ? 'heads' : 'tails';
  return { result, win: result === choice };
}

/* ── DICE ── */
function rollDice(userRoll, botRoll) {
  const user = userRoll || (Math.floor(Math.random() * 6) + 1);
  const bot = botRoll || (Math.floor(Math.random() * 6) + 1);
  if (user > bot) return { user, bot, result: 'win' };
  if (user < bot) return { user, bot, result: 'loss' };
  return { user, bot, result: 'tie' };
}

/* ── ROULETTE ── */
function spinRoulette() {
  const n = Math.floor(Math.random() * 37);
  let color;
  if (n === 0) color = 'green';
  else if (ROULETTE_RED.includes(n)) color = 'red';
  else color = 'black';
  return { number: n, color };
}

function roulettePayout(bet, betType) {
  const { number, color } = spinRoulette();
  let mult = 0;
  switch (betType) {
    case 'red':     mult = color === 'red' ? 2 : 0; break;
    case 'black':   mult = color === 'black' ? 2 : 0; break;
    case 'green':   mult = color === 'green' ? 14 : 0; break;
    case 'odd':     mult = (number !== 0 && number % 2 === 1) ? 2 : 0; break;
    case 'even':    mult = (number !== 0 && number % 2 === 0) ? 2 : 0; break;
    case 'first12': mult = (number >= 1 && number <= 12) ? 3 : 0; break;
    case 'second12':mult = (number >= 13 && number <= 24) ? 3 : 0; break;
    case 'third12': mult = (number >= 25 && number <= 36) ? 3 : 0; break;
    default: mult = 0;
  }
  return { number, color, mult, payout: mult > 0 ? bet * mult : 0 };
}

/* ── WHEEL ── */
function spinWheel() {
  return pickWeighted(WHEEL_SEGMENTS);
}

/* ── CRASH ── */
function playCrash(targetMult) {
  /* provably-fair-ish: random crash point with house edge */
  const r = Math.random();
  let crashPoint;
  if (r < 0.05) crashPoint = 1.0;
  else crashPoint = Math.min(50, 1 / Math.max(0.01, Math.random() * 0.95));
  crashPoint = Math.round(crashPoint * 100) / 100;
  const win = crashPoint >= targetMult;
  return { crashPoint, targetMult, win, payout: win ? targetMult : 0 };
}

/* ── HORSE ── */
function runHorseRace(userPick) {
  const horses = [1, 2, 3, 4, 5, 6];
  const positions = {};
  for (const h of horses) positions[h] = 0;
  let winner = null;
  let laps = 0;
  while (!winner && laps < 500) {
    laps++;
    for (const h of horses) {
      positions[h] += Math.random() * 1.5;
      if (positions[h] >= 100) { winner = h; break; }
    }
  }
  return { winner, userPick, win: winner === userPick };
}

/* ── BLACKJACK (interactive state held in memory) ── */
const bjGames = new Map(); // `${guildId}:${userId}` -> { deck, player, dealer, bet, userId, guildId }

function newDeck() {
  const suits = ['♠','♥','♦','♣'];
  const ranks = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
  const deck = [];
  for (const s of suits) for (const r of ranks) deck.push({ r, s });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
function cardValue(card, currentTotal) {
  if (card.r === 'A') return currentTotal + 11 > 21 ? 1 : 11;
  if (['J','Q','K'].includes(card.r)) return 10;
  return parseInt(card.r, 10);
}
function handTotal(hand) {
  let total = 0;
  let aces = 0;
  for (const c of hand) {
    if (c.r === 'A') aces++;
    else if (['J','Q','K'].includes(c.r)) total += 10;
    else total += parseInt(c.r, 10);
  }
  for (let i = 0; i < aces; i++) {
    total += (total + 11 > 21) ? 1 : 11;
  }
  return total;
}
function formatHand(hand, hideSecond = false) {
  return hand.map((c, i) => (hideSecond && i === 1) ? '🂠' : `${c.r}${c.s}`).join(' ');
}

function newBlackjack(guildId, userId, bet) {
  const deck = newDeck();
  const player = [deck.pop(), deck.pop()];
  const dealer = [deck.pop(), deck.pop()];
  const game = { deck, player, dealer, bet, userId, guildId, done: false };
  bjGames.set(`${guildId}:${userId}`, game);
  return game;
}
function getBlackjack(guildId, userId) { return bjGames.get(`${guildId}:${userId}`) || null; }
function endBlackjack(guildId, userId) { bjGames.delete(`${guildId}:${userId}`); }

function bjHit(game) {
  game.player.push(game.deck.pop());
  const t = handTotal(game.player);
  if (t > 21) game.done = true;
  return game;
}
function bjStand(game) {
  while (handTotal(game.dealer) < 17) game.dealer.push(game.deck.pop());
  game.done = true;
  return game;
}
function bjResult(game) {
  const p = handTotal(game.player);
  const d = handTotal(game.dealer);
  if (p > 21) return { outcome: 'bust', payout: 0 };
  if (d > 21) return { outcome: 'dealer_bust', payout: game.bet * 2 };
  if (p > d) return { outcome: 'win', payout: game.bet * 2 };
  if (p < d) return { outcome: 'loss', payout: 0 };
  return { outcome: 'tie', payout: game.bet };
}

module.exports = {
  spinSlots,
  flipCoin,
  rollDice,
  roulettePayout,
  spinWheel,
  playCrash,
  runHorseRace,
  newBlackjack, getBlackjack, endBlackjack,
  bjHit, bjStand, bjResult,
  handTotal, formatHand,
};
