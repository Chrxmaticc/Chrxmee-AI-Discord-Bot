const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require("discord.js");

const E = {
  success: "<:Verified_Icon:1527194184841167010>",
  error: "<:no:1530373946795364362>",
  angry: "<:angry_cry:1526029511882440744>",
  agree: "<:agreed:1525639597135237131>",
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("mute")
    .setDescription("timeout a user")
    .addUserOption(opt => opt.setName("user").setDescription("who to mute").setRequired(true))
    .addIntegerOption(opt => opt.setName("minutes").setDescription("minutes (default 10)").setRequired(false).setMinValue(1).setMaxValue(40320))
    .addStringOption(opt => opt.setName("reason").setDescription("reason").setRequired(false)),

  async execute(interaction) {
    const isButtonSim = interaction.isButton && interaction.isButton();
    if (!isButtonSim) { try { await interaction.deferReply(); } catch {} }

    if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      const embed = new EmbedBuilder().setColor(0xff0000).setTitle(`${E.error} permission denied`).setDescription(`${E.angry} you need **moderate members** permission.`);
      return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
    }

    const target = interaction.options.getUser("user");
    const minutes = interaction.options.getInteger("minutes") || 10;
    const reason = interaction.options.getString("reason") || "no reason";
    const targetMember = interaction.guild.members.cache.get(target.id);
    try {
      await targetMember.timeout(minutes * 60000, reason);
      const embed = new EmbedBuilder().setColor(0x7c7ce0).setTitle(`${E.success} user muted`).setDescription(`${E.agree} **${target.username}** has been muted for **${minutes} minutes**.\nreason: ${reason}`);
      return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
    } catch (err) {
      const embed = new EmbedBuilder().setColor(0xff0000).setTitle(`${E.error} error`).setDescription(`${E.angry} ${err.message}`);
      return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
    }
  },
};
