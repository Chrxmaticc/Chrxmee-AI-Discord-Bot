const { store, engine, constants } = require('../cogs/pets');
const { TICK_MS, EMOJI, PET_EMOJI } = constants;

let started = false;

async function tick(client) {
  const pets = await store.listAllAlive().catch(() => []);
  for (const pet of pets) {
    const before = { alive: pet.alive, sick: pet.sick, asleep: pet.asleep };
    engine.applyTick(pet);
    await store.savePet(pet.userId).catch(() => {});

    /* notify owner about state changes */
    try {
      const user = await client.users.fetch(pet.userId).catch(() => null);
      if (!user) continue;
      if (before.alive && !pet.alive) {
        await user.send({
          content: `${EMOJI.error} your pet **${pet.name}** has died. cause: **${pet.causeOfDeath || 'unknown'}**.\n-# use \`/pets adopt\` to start over.`,
        }).catch(() => {});
      } else if (before.alive && !before.sick && pet.sick) {
        await user.send({
          content: `${PET_EMOJI.sick} your pet **${pet.name}** is sick! use \`/pets medicine\` to heal them.`,
        }).catch(() => {});
      }
    } catch {}
  }
}

module.exports = {
  name: 'clientReady',
  once: true,
  async execute(client) {
    if (started) return;
    started = true;
    if (client.pool) store.setPool(client.pool);
    console.log('[pets] tick started every', TICK_MS / 60000, 'min');
    const iv = setInterval(() => tick(client).catch(e => console.error('[pets] tick err:', e.message)), TICK_MS);
    if (iv.unref) iv.unref();
  },
  _tick: tick,
};
