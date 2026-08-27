const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require("discord.js");

const E = {
  success: "<:Verified_Icon:1527194184841167010>",
  error: "<:no:1530373946795364362>",
  ai: "<:Chrxmaticc_AI:1480094799292928132>",
  angry: "<:angry_cry:1526029511882440744>",
  sneaky: "<:sneaky:1527401423690792970>",
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("unquietlock")
    .setDescription("remove quietlock from a user")
    .addUserOption(opt =>
      opt.setName("user")
        .setDescription("who to unlock")
        .setRequired(true)
    ),

  async execute(interaction) {
    const isButtonSim = interaction.isButton && interaction.isButton();
    if (!isButtonSim) {
      try { await interaction.deferReply(); } catch {}
    }

    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return interaction.editReply(`${E.error} you need manage messages to unquietlock someone.`);
    }

    const target = interaction.options.getUser("user");
    const key = `${interaction.guildId}-${target.id}`;

    if (interaction.client.quietLocks?.has(key)) {
      interaction.client.quietLocks.delete(key);
    }

    const embed = new EmbedBuilder()
      .setColor(0x7c7ce0)
      .setTitle(`${E.success} quietlock removed`)
      .setDescription(`${E.agree} **${target.username}** can talk again.`)
      .setFooter({ text: "freedom restored" })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
  },
};
