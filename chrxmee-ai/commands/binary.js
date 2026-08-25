const { SlashCommandBuilder } = require("discord.js");

const E: {
ai: "<:Chrxmaticc_AI:1480094799292928132>",
success: "<:Verified_Icon:1527194184841167010>",
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("binary")
    .setDescription("encode or decode text to/from binary")
    .addStringOption(option => option.setName("mode").setDescription("encode or decode").setRequired(true).addChoices({ name: "encode", value: "encode" }, { name: "decode", value: "decode" }))
    .addStringOption(option => option.setName("text").setDescription("the text to process").setRequired(true)),
  async execute(interaction) {
    const mode = interaction.options.getString("mode");
    const text = interaction.options.getString("text");
    
    if (mode === "encode") {
      const binary = text.split('').map(char => char.charCodeAt(0).toString(2).padStart(8, '0')).join(' ');
      return interaction.reply(`${E.success} **encoded:** \`${binary}\``);
    } else {
      const decoded = text.split(' ').map(bin => String.fromCharCode(parseInt(bin, 2))).join('');
      return interaction.reply(`${E.success} **decoded:** \`${decoded}\``);
    }
  },
};
