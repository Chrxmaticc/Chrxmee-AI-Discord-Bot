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
    .setName("trivia")
    .setDescription("get a random trivia question"),

  async execute(interaction) {
    const isButtonSim = interaction.isButton && interaction.isButton();
    if (!isButtonSim) {
      try { await interaction.deferReply(); } catch {}
    }

    try {
      const response = await fetch("https://opentdb.com/api.php?amount=1&type=multiple");
      const data = await response.json();
      const question = data.results[0];

      const cleanQuestion = question.question
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&amp;/g, "&");

      const embed = new EmbedBuilder()
        .setColor(0x7c7ce0) // periwinkle
        .setTitle(`${E.ai} trivia time`)
        .setDescription(
          `**category:** ${question.category}\n` +
          `**difficulty:** ${question.difficulty}\n\n` +
          `**question:** ${cleanQuestion}`
        )
        .setFooter({ text: "think fast, answer in your head" })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));

      // send answer as spoiler (non-ephemeral for prefix fallback)
      const answerText = `||the correct answer is: **${question.correct_answer}**||`;
      await interaction.followUp({ content: answerText }).catch(() => {});
    } catch (err) {
      console.error("trivia error:", err);
      const errorEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle(`${E.error} trivia failed`)
        .setDescription(`${E.angry} i forgot all my trivia facts!`);
      return interaction.editReply({ embeds: [errorEmbed] }).catch(() => interaction.followUp({ embeds: [errorEmbed] }));
    }
  },
};
