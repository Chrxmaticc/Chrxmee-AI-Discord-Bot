const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require("discord.js");

const E = {
  success: "<:Verified_Icon:1527194184841167010>",
  error: "<:no:1530373946795364362>",
  angry: "<:angry_cry:1526029511882440744>",
  lock: "<:lock:1530377198324945056>",
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("lock")
    .setDescription("lock the channel"),

  async execute(interaction) {
    const isButtonSim = interaction.isButton && interaction.isButton();
    if (!isButtonSim) { try { await interaction.deferReply(); } catch {} }

    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
      const embed = new EmbedBuilder().setColor(0xff0000).setTitle(`${E.error} permission denied`).setDescription(`${E.angry} you need **manage channels** permission.`);
      return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
    }

    try {
      await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false });
      const embed = new EmbedBuilder().setColor(0x7c7ce0).setTitle(`${E.lock} channel locked`).setDescription(`${E.success} this channel is now locked.`);
      return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
    } catch (err) {
      const embed = new EmbedBuilder().setColor(0xff0000).setTitle(`${E.error} error`).setDescription(`${E.angry} ${err.message}`);
      return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
    }
  },
};
