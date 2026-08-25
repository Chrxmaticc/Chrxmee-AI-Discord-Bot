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
    .setName("brain-dump")
    .setDescription("get a summary of everything i know about you"),

  async execute(interaction) {
    const isButtonSim = interaction.isButton && interaction.isButton();
    if (!isButtonSim) {
      try { await interaction.deferReply({ ephemeral: true }); } catch { try { await interaction.deferReply(); } catch {} }
    }

    const userId = interaction.user.id;
    const userData = interaction.client.memory?.get(userId) || { history: [], personal: {} };

    let knownFacts = "";
    if (userData.personal && Object.keys(userData.personal).length > 0) {
      knownFacts = Object.entries(userData.personal)
        .map(([k, v]) => `• ${k.replace(/_/g, " ")}: ${v}`)
        .join("\n");
    } else {
      knownFacts = `${E.error} i don't have any specific personal info saved yet. use /setpersonal to teach me.`;
    }

    const interactionCount = userData.history ? userData.history.filter(m => m.role === 'user').length : 0;

    const embed = new EmbedBuilder()
      .setColor(0x7c7ce0)
      .setTitle(`${E.ai} brain dump`)
      .addFields(
        { name: "known facts", value: knownFacts, inline: false },
        { name: "recent context", value: `holding onto **${interactionCount}** recent exchanges in active memory.`, inline: false }
      )
      .setFooter({ text: "this is private, only you can see it" })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
  },
};
