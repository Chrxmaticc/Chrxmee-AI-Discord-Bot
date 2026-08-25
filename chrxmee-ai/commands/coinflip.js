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
    .setName("coinflip")
    .setDescription("flip the chromed coin"),

  async execute(interaction) {
    const isButtonSim = interaction.isButton && interaction.isButton();
    if (!isButtonSim) {
      try { await interaction.deferReply(); } catch {}
    }

    const result = Math.random() < 0.5 
      ? { name: "wumpus", emoji: "<:wumpus_coin:1541899215893041243>" }
      : { name: "gold", emoji: "<:Gold_Coin_Fortnite:1541899090496069734>" };

    const embed = new EmbedBuilder()
      .setColor(0x7c7ce0)
      .setTitle(`${E.ai} coinflip`)
      .setDescription(`${result.emoji} it landed on **${result.name}**!`)
      .setFooter({ text: "the coin doesnt lie" })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
  },
};
