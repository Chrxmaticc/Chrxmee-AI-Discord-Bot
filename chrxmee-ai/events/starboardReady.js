module.exports = {
  name: "ready",
  once: true,
  execute(client) {
    client.starboardCooldowns = new Map();
    console.log(" starboard handler ready");
  },
};
