const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("List all of Chrxmee AI's features and commands")
    .setContexts([0, 1, 2])
    .setIntegrationTypes([0, 1]),
  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle("Chrxmee AI - Help Menu")
      .setDescription("I am your smart AI friend, available everywhere! Update 1.60: The Model Refresh & Identity Update!")
      .addFields(
        { name: "🔍 /whois", value: "Generate a cool AI intelligence profile for anyone!" },
        { name: "🧠 /brain-dump", value: "Summary of everything I've learned about you." },
        { name: "✨ /vibe-check", value: "AI analyzes the channel's current mood." },
        { name: "🤖 /model", value: "Switch between 8 freshly updated AI personalities!" },
        { name: "💬 /chat", value: "Continuous conversation with deep recall." }
      ) 
      .setFooter({ text: "Chrxmee AI v1.60 - New Models, New Identity. ❄️" })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};