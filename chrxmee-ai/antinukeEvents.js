// antinukeEvents.js
// thin wrapper — actual logic lives in cogs/antinuke/.
// kept at root so existing index.js requires don't break.

const { handlers } = require("./cogs/antinuke");

function setupAntinukeEvents(client) {
  handlers.install(client);
}

module.exports = { setupAntinukeEvents };
