module.exports = {
  name: "ready",
  once: true,
  async execute(client) {
    // initialize snipe maps
    client.snipes = new Map();          // deleted messages
    client.editSnipes = new Map();      // edited messages
    client.reactionSnipes = new Map();  // reaction removals

    console.log(" snipe tracker initialized");
  },
};
