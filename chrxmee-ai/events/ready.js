module.exports = {
  name: "clientReady",
  once: true,
  execute(client) {
    console.log(`Chrxmee AI ready as ${client.user.tag}`);
    
    // Set presence
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
  },
};