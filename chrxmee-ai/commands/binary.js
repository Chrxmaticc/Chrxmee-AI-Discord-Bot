const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("binary")
    .setDescription("Encode or decode text to/from binary")
    .addStringOption(option => option.setName("mode").setDescription("Encode or Decode").setRequired(true).addChoices({ name: "Encode", value: "encode" }, { name: "Decode", value: "decode" }))
    .addStringOption(option => option.setName("text").setDescription("The text to process").setRequired(true)),
  async execute(interaction) {
    const mode = interaction.options.getString("mode");
    const text = interaction.options.getString("text");
    
    if (mode === "encode") {
      const binary = text.split('').map(char => char.charCodeAt(0).toString(2).padStart(8, '0')).join(' ');
      return interaction.reply(`💻 **Encoded:** \`${binary}\``);
    } else {
      const decoded = text.split(' ').map(bin => String.fromCharCode(parseInt(bin, 2))).join('');
      return interaction.reply(`💻 **Decoded:** \`${decoded}\``);
    }
  },
};
