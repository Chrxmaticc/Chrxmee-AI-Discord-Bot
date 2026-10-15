// cogs/persona/index.js
// barrel — everything re-exported. handlers.install() runs schema + wires events.

const schema   = require("./schema");
const store    = require("./store");
const blocked  = require("./blocked");
const learner  = require("./learner");
const speaker  = require("./speaker");
const handlers = require("./handlers");
const constants = require("./constants");

module.exports = {
  ...constants,
  schema,
  store,
  blocked,
  learner,
  speaker,
  handlers,
};
