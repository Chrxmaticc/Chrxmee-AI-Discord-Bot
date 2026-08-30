const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require("discord.js");

const E = {
  success: "<:Verified_Icon:1527194184841167010>",
  error: "<:no:1530373946795364362>",
  angry: "<:angry_cry:1526029511882440744>",
  agree: "<:agreed:1525639597135237131>",
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("slowmode")
    .setDescription("set channel slowmode")
    .addIntegerOption(opt => opt.setName("seconds").setDescription("seconds (0 to disable)").setRequired(true).setMinValue(0).setMaxValue(21600)),

  async execute(interaction) {
    const isButtonSim = interaction.isButton && interaction.isButton();
    if (!isButtonSim) { try { await interaction.deferReply(); } catch {} }

    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
      const embed = new EmbedBuilder().setColor(0xff0000).setTitle(`${E.error} permission denied`).setDescription(`${E.angry} you need **manage channels** permission.`);
      return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
    }

    const seconds = interaction.options.getInteger("seconds");
    try {
      await interaction.channel.setRateLimitPerUser(seconds);
      const embed = new EmbedBuilder().setColor(0x7c7ce0).setTitle(`${E.success} slowmode set`).setDescription(`${E.agree} slowmode is now **${seconds} seconds**.`);
      return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
    } catch (err) {
      const embed = new EmbedBuilder().setColor(0xff0000).setTitle(`${E.error} error`).setDescription(`${E.angry} ${err.message}`);
      return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
    }
  },
};
