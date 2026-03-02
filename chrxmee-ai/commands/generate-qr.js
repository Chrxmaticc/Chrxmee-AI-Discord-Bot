const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("qr")
    .setDescription("Generate a QR code for a link or text")
    .addStringOption(option => option.setName("content").setDescription("The link or text to convert").setRequired(true))
    .setContexts([0, 1, 2])
    .setIntegrationTypes([0, 1]),
  async execute(interaction) {
    const content = interaction.options.getString("content");
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(content)}`;

    const embed = new EmbedBuilder()
      .setColor(0x000000)
      .setTitle("🏁 QR Code Generated")
      .setDescription(`**Content:** ${content}`)
      .setImage(url)
      .setFooter({ text: "Generated via Chrxmee AI" });

    await interaction.reply({ embeds: [embed] });
  },
};
