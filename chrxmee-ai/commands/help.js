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
      .setDescription("I am your smart AI friend, available everywhere! Update 1.70: The 'Transparency & Utility' Update!")
      .addFields(
        { name: "🤖 /ask [question]", value: "Now shows your question in the response!" },
        { name: "⏰ /remind-me", value: "Set a quick timer/reminder for yourself." },
        { name: "🪙 /coinflip", value: "Flip a coin! Heads or Tails?" },
        { name: "🎲 /dice", value: "Roll a standard 6-sided die." },
        { name: "🔍 /whois", value: "AI intelligence profile for anyone." },
        { name: "🧠 /brain-dump", value: "Summary of everything I've learned about you." }
      ) 
      .setFooter({ text: "Chrxmee AI v1.70 - Smarter, Faster, Stronger. ❄️" })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};