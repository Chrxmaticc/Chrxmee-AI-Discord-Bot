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
    .setName("clear-brain")
    .setDescription("wipe the bot's memory of our conversation")
    .setContexts([0, 1, 2])
    .setIntegrationTypes([0, 1]),

  async execute(interaction) {
    const isButtonSim = interaction.isButton && interaction.isButton();
    if (!isButtonSim) {
      try { await interaction.deferReply(); } catch {}
    }

    const userId = interaction.user.id;
    const userData = interaction.client.memory?.get(userId) || { history: [], model: "genius" };

    userData.history = [];
    interaction.client.memory?.set(userId, userData);

    const embed = new EmbedBuilder()
      .setColor(0x7c7ce0)
      .setTitle(`${E.ai} memory wiped`)
      .setDescription(`${E.success} i've forgotten everything we talked about. fresh start.`)
      .setFooter({ text: "chromed won't remember a thing" })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
  },
};
