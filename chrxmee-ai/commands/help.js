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
      .setDescription("I am your smart AI friend, available everywhere! Update 1.50: The 'Cool & Smart' Overhaul!")
      .addFields(
        { name: "🧠 /brain-dump", value: "See a summary of everything I've learned about you!" },
        { name: "✨ /vibe-check", value: "AI analyzes the current mood of the channel!" },
        { name: "🤖 /ask [question]", value: "Chat with me! Now with even faster response times." },
        { name: "💬 /chat", value: "Continuous conversation with deep context recall." },
        { name: "📜 /quote", value: "Personalized AI philosophy." },
        { name: "🌐 /news", value: "AI-generated breaking tech news." },
        { name: "📊 /poll", value: "Instant reaction-based voting." },
        { name: "⚙️ /custom-interactions", value: "Deep personality customization." }
      ) 
      .setFooter({ text: "Chrxmee AI v1.50 - Smarter, Cooler, Better. ❄️" })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};