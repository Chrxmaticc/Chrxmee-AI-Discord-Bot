const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("clear-brain")
    .setDescription("Wipe the bot's memory of our conversation")
    .setContexts([0, 1, 2])
    .setIntegrationTypes([0, 1]),
  async execute(interaction) {
    const userId = interaction.user.id;
    const userData = interaction.client.memory.get(userId) || { history: [], model: "smart" };
    
    userData.history = [];
    interaction.client.memory.set(userId, userData);
    
    await interaction.reply({ content: "🧠 Memory wiped! I've forgotten everything we've talked about.", ephemeral: true });
  },
};