const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("model")
    .setDescription("Change the AI's personality!")
    .setContexts([0, 1, 2])
    .setIntegrationTypes([0, 1])
    .addStringOption((option) =>
      option
        .setName("type")
        .setDescription("Choose a personality")
        .setRequired(true)
        .addChoices(
          { name: "Smart (Llama 3.3 70B)", value: "smart" },
          { name: "Fast (Llama 3.1 8B)", value: "fast" },
          { name: "Thinker (DeepSeek R1 Distill)", value: "thinker" }
        )
    ),
  async execute(interaction) {
    const type = interaction.options.getString("type");
    const userId = interaction.user.id;
    
    // Store model preference in user memory
    let userData = interaction.client.memory.get(userId) || { history: [], model: "smart" };
    userData.model = type;
    interaction.client.memory.set(userId, userData);

    const modelNames = {
      smart: "Llama 3.3 70B (The Genius)",
      fast: "Llama 3.1 8B (The Speedster)",
      thinker: "DeepSeek R1 Distill (The Philosopher)"
    };

    await interaction.reply(`Personality switched to: **${modelNames[type]}**! I'll use this for our future chats.`);
  },
};