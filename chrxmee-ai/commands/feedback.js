const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

const E = {
  success: "<:Verified_Icon:1527194184841167010>",
  error: "<:no:1530373946795364362>",
  ai: "<:Chrxmaticc_AI:1480094799292928132>",
  agree: "<:agreed:1525639597135237131>",
  angry: "<:angry_cry:1526029511882440744>",
  sneaky: "<:sneaky:1527401423690792970>",
  money_cry: "<:Money_Cry_Son:1526538340264841257>",
  cringe_laugh: "<:Cringe_Laughing_Son:1526539082564374710>",
  point_laugh: "<:PointAndLaughingEmoji:1525657154567016469>",
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("feedback")
    .setDescription("send feedback directly to the creator")
    .addStringOption(option =>
      option.setName("message")
        .setDescription("what would you like to tell the creator?")
        .setRequired(true)
    )
    .setContexts([0, 1, 2])
    .setIntegrationTypes([0, 1]),

  async execute(interaction) {
    const isButtonSim = interaction.isButton && interaction.isButton();
    if (!isButtonSim) {
      try { await interaction.deferReply({ ephemeral: true }); } catch { try { await interaction.deferReply(); } catch {} }
    }

    const feedback = interaction.options.getString("message");
    const ownerId = process.env.OWNER_ID;

    if (!ownerId) {
      const errEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle(`${E.error} missing owner id`)
        .setDescription(`${E.angry} the owner hasn't set their ID yet. can't send feedback right now.`);
      return interaction.editReply({ embeds: [errEmbed] }).catch(() => interaction.followUp({ embeds: [errEmbed] }));
    }

    try {
      const owner = await interaction.client.users.fetch(ownerId);
      const dmEmbed = new EmbedBuilder()
        .setColor(0x7c7ce0)
        .setTitle(`${E.ai} new feedback received`)
        .addFields(
          { name: "from", value: `${interaction.user.tag} (${interaction.user.id})`, inline: false },
          { name: "message", value: feedback, inline: false }
        )
        .setFooter({ text: "direct from chromed" })
        .setTimestamp();

      await owner.send({ embeds: [dmEmbed] });

      const successEmbed = new EmbedBuilder()
        .setColor(0x7c7ce0)
        .setTitle(`${E.success} feedback sent`)
        .setDescription(`${E.agree} your feedback has been sent directly to my creator! thank you for helping me improve.`)
        .setFooter({ text: "private — only you and the creator see this" })
        .setTimestamp();

      return interaction.editReply({ embeds: [successEmbed] }).catch(() => interaction.followUp({ embeds: [successEmbed] }));
    } catch (err) {
      console.error("feedback DM error:", err);
      const errEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle(`${E.error} couldn't send`)
        .setDescription(`${E.angry} couldn't send feedback. creator might have DMs disabled or the ID is incorrect.`);
      return interaction.editReply({ embeds: [errEmbed] }).catch(() => interaction.followUp({ embeds: [errEmbed] }));
    }
  },
};
