/* cogs/pets/store.js */

let pool = null;
function setPool(p) { pool = p; console.log('[pets] pool attached:', !!pool); }
function requirePool() { if (!pool) throw new Error('pets store: pool not attached'); }

const cache = new Map();

function rowToPet(r) {
  if (!r) return null;
  return {
    id: r.id,
    userId: r.user_id,
    name: r.name,
    species: r.species,
    hunger: r.hunger,
    thirst: r.thirst,
    happiness: r.happiness,
    energy: r.energy,
    hygiene: r.hygiene,
    health: r.health,
    asleep: r.asleep,
    sick: r.sick,
    poops: r.poops,
    mealsSincePoop: r.meals_since_poop,
    criticalTicks: r.critical_ticks,
    alive: r.alive,
    lastTickAt: r.last_tick_at ? new Date(r.last_tick_at).getTime() : Date.now(),
    lastFedAt: r.last_fed_at ? new Date(r.last_fed_at).getTime() : 0,
    lastDrankAt: r.last_drank_at ? new Date(r.last_drank_at).getTime() : 0,
    lastPlayedAt: r.last_played_at ? new Date(r.last_played_at).getTime() : 0,
    lastWashedAt: r.last_washed_at ? new Date(r.last_washed_at).getTime() : 0,
    lastSleptAt: r.last_slept_at ? new Date(r.last_slept_at).getTime() : 0,
    lastMedicineAt: r.last_medicine_at ? new Date(r.last_medicine_at).getTime() : 0,
    adoptedAt: r.adopted_at ? new Date(r.adopted_at).getTime() : Date.now(),
    diedAt: r.died_at ? new Date(r.died_at).getTime() : null,
    causeOfDeath: r.cause_of_death || null,
  };
}

async function getPet(userId) {
  requirePool();
  if (cache.has(userId)) return cache.get(userId);
  const r = await pool.query(`SELECT * FROM pets WHERE user_id = $1`, [userId]);
  const pet = rowToPet(r.rows[0]);
  cache.set(userId, pet);
  return pet;
}

async function createPet(userId, name, species) {
  requirePool();
  const r = await pool.query(
    `INSERT INTO pets (user_id, name, species) VALUES ($1, $2, $3) RETURNING *`,
    [userId, name, species]
  );
  const pet = rowToPet(r.rows[0]);
  cache.set(userId, pet);
  return pet;
}

async function savePet(userId) {
  requirePool();
  const p = cache.get(userId);
  if (!p) return;
  await pool.query(
    `UPDATE pets SET hunger=$1, thirst=$2, happiness=$3, energy=$4, hygiene=$5, health=$6, asleep=$7, sick=$8, poops=$9, meals_since_poop=$10, critical_ticks=$11, alive=$12, last_tick_at=$13, last_fed_at=$14, last_drank_at=$15, last_played_at=$16, last_washed_at=$17, last_slept_at=$18, last_medicine_at=$19, died_at=$20, cause_of_death=$21 WHERE user_id=$22`,
    [
      p.hunger, p.thirst, p.happiness, p.energy, p.hygiene, p.health,
      p.asleep, p.sick, p.poops, p.mealsSincePoop, p.criticalTicks, p.alive,
      p.lastTickAt ? new Date(p.lastTickAt) : null,
      p.lastFedAt ? new Date(p.lastFedAt) : null,
      p.lastDrankAt ? new Date(p.lastDrankAt) : null,
      p.lastPlayedAt ? new Date(p.lastPlayedAt) : null,
      p.lastWashedAt ? new Date(p.lastWashedAt) : null,
      p.lastSleptAt ? new Date(p.lastSleptAt) : null,
      p.lastMedicineAt ? new Date(p.lastMedicineAt) : null,
      p.diedAt ? new Date(p.diedAt) : null,
      p.causeOfDeath,
      userId,
    ]
  );
}

async function deletePet(userId) {
  requirePool();
  await pool.query(`DELETE FROM pets WHERE user_id = $1`, [userId]);
  cache.delete(userId);
}

async function listAllAlive() {
  requirePool();
  const r = await pool.query(`SELECT * FROM pets WHERE alive = true`);
  return r.rows.map(rowToPet);
}

async function listAll() {
  requirePool();
  const r = await pool.query(`SELECT * FROM pets ORDER BY adopted_at ASC`);
  return r.rows.map(rowToPet);
}

/* ── cash helpers (uses gamble_wallet as universal wallet) ── */
async function getCash(userId) {
  requirePool();
  const r = await pool.query(`SELECT balance FROM gamble_wallet WHERE user_id = $1`, [userId]);
  if (!r.rows[0]) {
    await pool.query(`INSERT INTO gamble_wallet (user_id, balance) VALUES ($1, 1000) ON CONFLICT DO NOTHING`, [userId]);
    return 1000;
  }
  return Number(r.rows[0].balance);
}

async function spendCash(userId, amount) {
  requirePool();
  const bal = await getCash(userId);
  if (bal < amount) return { ok: false, balance: bal };
  await pool.query(`UPDATE gamble_wallet SET balance = balance - $1 WHERE user_id = $2`, [amount, userId]);
  return { ok: true, balance: bal - amount };
}

async function addCash(userId, amount) {
  requirePool();
  await pool.query(`INSERT INTO gamble_wallet (user_id, balance) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET balance = gamble_wallet.balance + $2`, [userId, amount]);
}

module.exports = {
  setPool, getPet, createPet, savePet, deletePet,
  listAllAlive, listAll,
  getCash, spendCash, addCash,
};
