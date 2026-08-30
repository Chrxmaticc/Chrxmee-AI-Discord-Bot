const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require("discord.js");

const E = {
  success: "<:Verified_Icon:1527194184841167010>",
  error: "<:no:1530373946795364362>",
  angry: "<:angry_cry:1526029511882440744>",
  ban: "<:hammer:1530375976381448303>",
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("softban")
    .setDescription("ban then unban to clear messages")
    .addUserOption(opt => opt.setName("user").setDescription("who to softban").setRequired(true))
    .addStringOption(opt => opt.setName("reason").setDescription("reason").setRequired(false)),

  async execute(interaction) {
    const isButtonSim = interaction.isButton && interaction.isButton();
    if (!isButtonSim) { try { await interaction.deferReply(); } catch {} }

    if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
      const embed = new EmbedBuilder().setColor(0xff0000).setTitle(`${E.error} permission denied`).setDescription(`${E.angry} you need **ban members** permission.`);
      return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
    }

    const target = interaction.options.getUser("user");
    const reason = interaction.options.getString("reason") || "no reason";
    try {
      await interaction.guild.members.ban(target.id, { reason, deleteMessageSeconds: 7 * 24 * 3600 });
      await interaction.guild.members.unban(target.id, "softban completed");
      const embed = new EmbedBuilder().setColor(0x7c7ce0).setTitle(`${E.ban} user softbanned`).setDescription(`${E.success} **${target.username}** has been softbanned (messages cleared).\nreason: ${reason}`);
      return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
    } catch (err) {
      const embed = new EmbedBuilder().setColor(0xff0000).setTitle(`${E.error} error`).setDescription(`${E.angry} ${err.message}`);
      return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
    }
  },
};
