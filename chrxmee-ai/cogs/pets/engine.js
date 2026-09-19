/* cogs/pets/engine.js */

const store = require('./store');
const {
  SPECIES, FOODS, DRINKS, MEDICINE,
  DECAY_PER_TICK, POOP_AFTER_MEALS, POOP_PENALTY_HAPPINESS, POOP_PENALTY_HYGIENE,
  SICK_THRESHOLD, CRITICAL_THRESHOLD, HEALTH_DECAY_CRITICAL, DEATH_AFTER_CRITICAL_TICKS,
  SICK_CHANCE_PER_TICK, SLEEP_ENERGY_REGEN, AUTO_SLEEP_ENERGY,
  COOLDOWNS,
} = require('./constants');

function clamp(v, min = 0, max = 100) { return Math.max(min, Math.min(max, v)); }
function speciesById(id) { return SPECIES.find(s => s.id === id); }

/* ── apply one tick of decay to a pet ── */
function applyTick(pet) {
  const sp = speciesById(pet.species) || SPECIES[0];
  const asleep = pet.asleep;
  const decayMul = asleep ? 0.3 : 1.0;

  pet.hunger = clamp(pet.hunger - DECAY_PER_TICK * sp.hungerRate * decayMul);
  pet.thirst = clamp(pet.thirst - DECAY_PER_TICK * sp.thirstRate * decayMul);
  pet.happiness = clamp(pet.happiness - DECAY_PER_TICK * decayMul);
  pet.hygiene = clamp(pet.hygiene - DECAY_PER_TICK * decayMul);

  if (asleep) {
    pet.energy = clamp(pet.energy + SLEEP_ENERGY_REGEN);
    if (pet.energy >= 100) pet.asleep = false;
  } else {
    pet.energy = clamp(pet.energy - DECAY_PER_TICK * decayMul);
    if (pet.energy <= AUTO_SLEEP_ENERGY) pet.asleep = true;
  }

  /* poop passive penalties */
  if (pet.poops > 0) {
    pet.happiness = clamp(pet.happiness - POOP_PENALTY_HAPPINESS * Math.min(pet.poops, 5));
    pet.hygiene = clamp(pet.hygiene - POOP_PENALTY_HYGIENE * Math.min(pet.poops, 5));
  }

  /* sick chance */
  const lowStats = [pet.hunger, pet.thirst, pet.happiness, pet.energy, pet.hygiene].filter(v => v < SICK_THRESHOLD).length;
  if (lowStats > 0 && !pet.sick && Math.random() < SICK_CHANCE_PER_TICK * lowStats) {
    pet.sick = true;
  }

  /* health decay */
  const criticalStats = [pet.hunger, pet.thirst, pet.happiness, pet.energy, pet.hygiene].filter(v => v < CRITICAL_THRESHOLD);
  let healthLoss = 0;
  if (criticalStats.length > 0) healthLoss += HEALTH_DECAY_CRITICAL;
  if (pet.sick) healthLoss += 2;
  if (healthLoss > 0) {
    pet.health = clamp(pet.health - healthLoss);
    pet.criticalTicks = (pet.criticalTicks || 0) + 1;
  } else {
    /* health regens slowly when not in danger */
    pet.health = clamp(pet.health + 1);
    pet.criticalTicks = Math.max(0, (pet.criticalTicks || 0) - 1);
  }

  /* death check */
  if (pet.health <= 0 || (pet.criticalTicks || 0) >= DEATH_AFTER_CRITICAL_TICKS) {
    pet.alive = false;
    pet.diedAt = Date.now();
    pet.causeOfDeath = pet.sick ? 'illness' : 'neglect';
  }

  pet.lastTickAt = Date.now();
  return pet;
}

/* ── feed / drink / play / wash / sleep / wake / medicine / pet ── */
function checkCooldown(pet, action) {
  const cd = COOLDOWNS[action] || 0;
  const map = {
    feed: 'lastFedAt', drink: 'lastDrankAt', play: 'lastPlayedAt',
    wash: 'lastWashedAt', sleep: 'lastSleptAt', medicine: 'lastMedicineAt',
    pet: null,
  };
  const key = map[action];
  if (!key) return { ok: true };
  const last = pet[key] || 0;
  const left = cd - (Date.now() - last);
  if (left > 0) return { ok: false, msLeft: left };
  return { ok: true };
}

function feed(pet, foodId) {
  const food = FOODS.find(f => f.id === foodId);
  if (!food) return { ok: false, reason: 'unknown food' };
  const cd = checkCooldown(pet, 'feed');
  if (!cd.ok) return { ok: false, reason: `feed cooldown — ${Math.ceil(cd.msLeft / 60000)}m left` };
  pet.hunger = clamp(pet.hunger + food.hunger);
  pet.happiness = clamp(pet.happiness + food.happiness);
  pet.lastFedAt = Date.now();
  pet.mealsSincePoop = (pet.mealsSincePoop || 0) + 1;
  if (pet.mealsSincePoop >= POOP_AFTER_MEALS) {
    pet.poops = (pet.poops || 0) + 1;
    pet.mealsSincePoop = 0;
  }
  return { ok: true, food };
}

function drink(pet, drinkId) {
  const drink = DRINKS.find(d => d.id === drinkId);
  if (!drink) return { ok: false, reason: 'unknown drink' };
  const cd = checkCooldown(pet, 'drink');
  if (!cd.ok) return { ok: false, reason: `drink cooldown — ${Math.ceil(cd.msLeft / 60000)}m left` };
  pet.thirst = clamp(pet.thirst + drink.thirst);
  pet.happiness = clamp(pet.happiness + drink.happiness);
  pet.lastDrankAt = Date.now();
  return { ok: true, drink };
}

function play(pet) {
  const cd = checkCooldown(pet, 'play');
  if (!cd.ok) return { ok: false, reason: `play cooldown — ${Math.ceil(cd.msLeft / 60000)}m left` };
  const sp = speciesById(pet.species) || SPECIES[0];
  const gain = Math.round(15 * sp.playBonus);
  pet.happiness = clamp(pet.happiness + gain);
  pet.energy = clamp(pet.energy - 10);
  pet.hunger = clamp(pet.hunger - 5);
  pet.thirst = clamp(pet.thirst - 5);
  pet.lastPlayedAt = Date.now();
  return { ok: true, gain };
}

function wash(pet) {
  const cd = checkCooldown(pet, 'wash');
  if (!cd.ok) return { ok: false, reason: `wash cooldown — ${Math.ceil(cd.msLeft / 60000)}m left` };
  pet.hygiene = clamp(pet.hygiene + 50);
  pet.happiness = clamp(pet.happiness + 5);
  pet.lastWashedAt = Date.now();
  return { ok: true };
}

function cleanPoop(pet) {
  const cleaned = pet.poops || 0;
  pet.poops = 0;
  pet.hygiene = clamp(pet.hygiene + 10 * cleaned);
  return { ok: true, cleaned };
}

function sleep(pet) {
  if (pet.asleep) return { ok: false, reason: 'already asleep' };
  pet.asleep = true;
  pet.lastSleptAt = Date.now();
  return { ok: true };
}

function wake(pet) {
  if (!pet.asleep) return { ok: false, reason: 'already awake' };
  pet.asleep = false;
  return { ok: true };
}

function medicine(pet) {
  const cd = checkCooldown(pet, 'medicine');
  if (!cd.ok) return { ok: false, reason: `medicine cooldown — ${Math.ceil(cd.msLeft / 60000)}m left` };
  if (!pet.sick) return { ok: false, reason: 'your pet is not sick' };
  pet.sick = false;
  pet.health = clamp(pet.health + 30);
  pet.lastMedicineAt = Date.now();
  return { ok: true };
}

function cuddle(pet) {
  const cd = checkCooldown(pet, 'pet');
  if (!cd.ok) return { ok: false, reason: `cuddle cooldown — ${Math.ceil(cd.msLeft / 60000)}m left` };
  pet.happiness = clamp(pet.happiness + 5);
  return { ok: true };
}

/* ── mood/status text ── */
function moodOf(pet) {
  if (!pet.alive) return 'dead';
  if (pet.sick) return 'sick';
  if (pet.asleep) return 'sleeping';
  if (pet.hunger < CRITICAL_THRESHOLD || pet.thirst < CRITICAL_THRESHOLD || pet.health < 20) return 'critical';
  if (pet.happiness < SICK_THRESHOLD) return 'sad';
  if (pet.happiness > 80 && pet.hunger > 60 && pet.thirst > 60) return 'happy';
  return 'okay';
}

module.exports = {
  applyTick,
  feed, drink, play, wash, cleanPoop, sleep, wake, medicine, cuddle,
  moodOf, speciesById,
};
