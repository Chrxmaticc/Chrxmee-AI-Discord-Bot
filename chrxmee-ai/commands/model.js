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
          { name: "Genius (Llama 3.3 70B)", value: "smart" },
          { name: "Speedster (Llama 3.1 8B)", value: "fast" },
          { name: "Philosopher (DeepSeek R1)", value: "thinker" },
          { name: "Artist (Mixtral 8x7B)", value: "creative" },
          { name: "Specialist (Gemma 2 9B)", value: "efficient" },
          { name: "Visionary (Qwen 2.5 72B)", value: "visionary" },
          { name: "Analyst (Llama 3.2 11B)", value: "analyst" },
          { name: "Classic (Llama 3.1 70B)", value: "classic" }
        )
    ),
  async execute(interaction) {
    const type = interaction.options.getString("type");
    const userId = interaction.user.id;
    
    let userData = interaction.client.memory.get(userId) || { history: [], model: "smart" };
    userData.model = type;
    interaction.client.memory.set(userId, userData);

    const modelNames = {
      smart: "Llama 3.3 70B (The Genius)",
      fast: "Llama 3.1 8B (The Speedster)",
      thinker: "DeepSeek R1 (The Philosopher)",
      creative: "Mixtral 8x7B (The Artist)",
      efficient: "Gemma 2 9B (The Specialist)",
      visionary: "Qwen 2.5 72B (The Visionary)",
      analyst: "Llama 3.2 11B (The Analyst)",
      classic: "Llama 3.1 70B (The Classic)"
    };

    await interaction.reply(`Personality switched to: **${modelNames[type]}**! I'll use this for our future chats.`);
  },
};
