const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require("discord.js");

const E = {
  success: "<:Verified_Icon:1527194184841167010>",
  error: "<:no:1530373946795364362>",
  angry: "<:angry_cry:1526029511882440744>",
  unlock: "<:unlock:1530377714995826831>",
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("unlock")
    .setDescription("unlock the channel"),

  async execute(interaction) {
    const isButtonSim = interaction.isButton && interaction.isButton();
    if (!isButtonSim) { try { await interaction.deferReply(); } catch {} }

    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
      const embed = new EmbedBuilder().setColor(0xff0000).setTitle(`${E.error} permission denied`).setDescription(`${E.angry} you need **manage channels** permission.`);
      return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
    }

    try {
      await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: null });
      const embed = new EmbedBuilder().setColor(0x7c7ce0).setTitle(`${E.unlock} channel unlocked`).setDescription(`${E.success} this channel is now unlocked.`);
      return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
    } catch (err) {
      const embed = new EmbedBuilder().setColor(0xff0000).setTitle(`${E.error} error`).setDescription(`${E.angry} ${err.message}`);
      return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
    }
  },
};
