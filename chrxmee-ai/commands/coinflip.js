const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("coinflip")
    .setDescription("Flip a coin! Heads or Tails?"),
  async execute(interaction) {
    const result = Math.random() < 0.5 ? "Heads" : "Tails";
    const emoji = result === "Heads" ? "🪙" : "🪙";
    await interaction.reply(`${emoji} It's **${result}**!`);
  },
};
