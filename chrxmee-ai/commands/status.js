const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("status")
    .setDescription("Check the bot's current state and your settings"),
  async execute(interaction) {
    const userId = interaction.user.id;
    const userData = interaction.client.memory.get(userId) || { history: [], model: "smart" };
    
    const modelNames = {
      smart: "Llama 3.3 70B (Smart)",
      fast: "Llama 3.1 8B (Fast)",
      thinker: "DeepSeek R1 (Thinker)"
    };

    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle("Chrxmee AI Status")
      .addFields(
        { name: "Your Active Model", value: modelNames[userData.model] || "Smart", inline: true },
        { name: "Brain Size", value: `${userData.history.length}/10 messages`, inline: true },
        { name: "Bot Version", value: "1.2.0", inline: true },
        { name: "Provider", value: "Groq Cloud", inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};