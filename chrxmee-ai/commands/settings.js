const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("settings")
    .setDescription("Customize your AI experience")
    .addStringOption(option =>
      option.setName("personality")
        .setDescription("Set a default personality for yourself")
        .addChoices(
          { name: "Genius (Llama 3.3 70B)", value: "smart" },
          { name: "Speedster (Llama 3.1 8B)", value: "fast" },
          { name: "Philosopher (DeepSeek R1)", value: "thinker" },
          { name: "Creative (Llama 3.3 70B)", value: "creative" },
          { name: "Efficient (Llama 3.1 8B)", value: "efficient" },
          { name: "Visionary (Llama 3.3 70B)", value: "visionary" },
          { name: "Analyst (Llama 3.1 8B)", value: "analyst" },
          { name: "Classic (Llama 3.3 70B)", value: "classic" }
        ))
    .setContexts([0, 1, 2])
    .setIntegrationTypes([0, 1]),
  async execute(interaction) {
    const personality = interaction.options.getString("personality");
    const userId = interaction.user.id;
    
    let userData = interaction.client.memory.get(userId) || { history: [], model: "smart" };
    
    if (personality) {
      userData.model = personality;
      interaction.client.memory.set(userId, userData);
      return interaction.reply({ content: `✅ Your default personality is now set to **${personality}**!`, flags: [64] });
    }

    const currentModel = userData.model || "smart";
    await interaction.reply({ content: `⚙️ **Your Current Settings:**\n- Default Model: \`${currentModel}\`\n- Memory: \`${userData.history.length}/15\` messages`, flags: [64] });
  },
};
