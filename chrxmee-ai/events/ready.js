module.exports = {
  name: "ready",
  once: true,
  async execute(client) {
    try {
      console.log(`Chrxmee AI ready as ${client.user.tag}`);
      
      client.user.setPresence({
        activities: [{ name: "Helping users everywhere!", type: 0 }],
        status: "online",
      });

      process.on("unhandledRejection", (error) => {
        console.error("Unhandled promise rejection:", error);
      });
      process.on("uncaughtException", (error) => {
        console.error("Uncaught exception:", error);
      });

    } catch (err) {
      console.error("READY EVENT CRASHED:", err);
    }
  },
};
