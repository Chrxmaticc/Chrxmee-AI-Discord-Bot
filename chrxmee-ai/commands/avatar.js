const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("avatar")
    .setDescription("Get the avatar of a user")
    .addUserOption(option => option.setName("target").setDescription("The user's avatar to show")),
  async execute(interaction) {
    const user = interaction.options.getUser("target") || interaction.user;
    const embed = new EmbedBuilder()
      .setColor(0x00AE86)
      .setTitle(`${user.username}'s Avatar`)
      .setImage(user.displayAvatarURL({ dynamic: true, size: 1024 }))
      .setFooter({ text: "Chrxmee AI ❄️" });
    await interaction.reply({ embeds: [embed] });
  },
};
