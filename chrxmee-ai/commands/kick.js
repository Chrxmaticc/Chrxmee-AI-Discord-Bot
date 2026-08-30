const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require("discord.js");

const E = {
  success: "<:Verified_Icon:1527194184841167010>",
  error: "<:no:1530373946795364362>",
  angry: "<:angry_cry:1526029511882440744>",
  kick: "<:Personkick:1530376715698704574>",
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("kick")
    .setDescription("kick a user")
    .addUserOption(opt => opt.setName("user").setDescription("who to kick").setRequired(true))
    .addStringOption(opt => opt.setName("reason").setDescription("reason").setRequired(false)),

  async execute(interaction) {
    const isButtonSim = interaction.isButton && interaction.isButton();
    if (!isButtonSim) { try { await interaction.deferReply(); } catch {} }

    if (!interaction.member.permissions.has(PermissionFlagsBits.KickMembers)) {
      const embed = new EmbedBuilder().setColor(0xff0000).setTitle(`${E.error} permission denied`).setDescription(`${E.angry} you need **kick members** permission.`);
      return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
    }

    const target = interaction.options.getUser("user");
    const reason = interaction.options.getString("reason") || "no reason";
    try {
      await interaction.guild.members.kick(target.id, reason);
      const embed = new EmbedBuilder().setColor(0x7c7ce0).setTitle(`${E.kick} user kicked`).setDescription(`${E.success} **${target.username}** has been kicked.\nreason: ${reason}`);
      return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
    } catch (err) {
      const embed = new EmbedBuilder().setColor(0xff0000).setTitle(`${E.error} error`).setDescription(`${E.angry} ${err.message}`);
      return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
    }
  },
};
