const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("error-toggle")
    .setDescription("Toggle error messages support link")
    .addStringOption(opt =>
      opt.setName("mode")
        .setDescription("on or off")
        .setRequired(true)
        .addChoices(
          { name: "On", value: "on" },
          { name: "Off", value: "off" }
        )
    ),
  async execute(interaction) {
    const mode = interaction.options.getString("mode");
    return interaction.reply(`✅ Command works! Mode: ${mode}`);
  },
};
