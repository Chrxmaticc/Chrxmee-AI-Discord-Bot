// cogs/antinuke/index.js
// barrel — everything re-exported. handlers.install() runs schema + wires events.

const schema    = require("./schema");
const store     = require("./store");
const tracker   = require("./tracker");
const engine    = require("./engine");
const raidmode  = require("./raidmode");
const trust     = require("./trust");
const handlers  = require("./handlers");
const constants = require("./constants");

module.exports = {
  ...constants,
  schema,
  store,
  tracker,
  engine,
  raidmode,
  trust,
  handlers,
};
