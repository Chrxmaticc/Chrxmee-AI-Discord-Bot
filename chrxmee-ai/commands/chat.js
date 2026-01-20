const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("chat")
    .setDescription("Start or continue a continuous conversation session")
    .setContexts([0, 1, 2])
    .setIntegrationTypes([0, 1]),
  async execute(interaction) {
    const userId = interaction.user.id;
    const client = interaction.client;
    
    let userData = client.memory.get(userId) || { history: [], model: "smart", inChat: false };
    userData.inChat = true;
    userData.lastActivity = Date.now();
    client.memory.set(userId, userData);
    
    await interaction.reply("💬 **Continuous Conversation Mode Active!**\nJust type messages normally. Say 'bye chrxmee ai.' or 'stop' to end.\nSession will timeout after 3 minutes of inactivity.");
  },
};