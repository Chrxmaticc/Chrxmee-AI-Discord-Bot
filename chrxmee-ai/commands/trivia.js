const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("trivia")
    .setDescription("Get a random trivia question!"),
  async execute(interaction) {
    await interaction.deferReply();
    try {
      const response = await fetch("https://opentdb.com/api.php?amount=1&type=multiple");
      const data = await response.json();
      const question = data.results[0];
      
      const embed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle("🧠 Trivia Time!")
        .setDescription(`**Category:** ${question.category}\n**Difficulty:** ${question.difficulty}\n\n**Question:** ${question.question.replace(/&quot;/g, '"').replace(/&#039;/g, "'")}`)
        .setFooter({ text: "Answer in your head, then check! ❄️" });
        
      await interaction.editReply({ embeds: [embed] });
      // We could add buttons for answers, but keeping it simple for now as requested for "fast" edits.
      await interaction.followUp({ content: `||The correct answer is: **${question.correct_answer}**||`, ephemeral: true });
    } catch (err) {
      await interaction.editReply("I forgot all my trivia facts! 🧠❌");
    }
  },
};
