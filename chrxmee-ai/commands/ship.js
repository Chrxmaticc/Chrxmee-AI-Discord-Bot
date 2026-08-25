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
  pinkheart: "<:Pinkrubycrownheart:1541910685070393464>",
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ship")
    .setDescription("ai calculates the love compatibility between two users")
    .addUserOption(option => option.setName("user1").setDescription("first user").setRequired(true))
    .addUserOption(option => option.setName("user2").setDescription("second user").setRequired(false)),

  async execute(interaction) {
    const isButtonSim = interaction.isButton && interaction.isButton();
    if (!isButtonSim) {
      try { await interaction.deferReply(); } catch {}
    }

    const user1 = interaction.options.getUser("user1");
    const user2 = interaction.options.getUser("user2") || interaction.user;

    const percent = Math.floor(Math.random() * 101);
    let comment = "";
    if (percent > 90) comment = `${E.pinkheart} a match made in the digital heavens!`;
    else if (percent > 75) comment = `${E.pinkheart} the spark is definitely there!`;
    else if (percent > 50) comment = `${E.agree} there's some potential here.`;
    else if (percent > 25) comment = `${E.sneaky} maybe just friends for now?`;
    else comment = `${E.angry} total system error. no compatibility found.`;

    const embed = new EmbedBuilder()
      .setColor(0x7c7ce0) // periwinkle
      .setTitle(`${E.pinkheart} matchmaking intelligence`)
      .setDescription(`**${user1.username}** + **${user2.username}**\n\n**compatibility:** ${percent}%\n\n*${comment}*`)
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
  },
};
