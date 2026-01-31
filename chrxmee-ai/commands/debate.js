const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("debate")
    .setDescription("Simulate an AI debate between two opposing viewpoints")
    .addStringOption(option =>
      option.setName("topic")
        .setDescription("What should the AIs debate about?")
        .setRequired(true))
    .setContexts([0, 1, 2])
    .setIntegrationTypes([0, 1]),
  async execute(interaction) {
    await interaction.deferReply();
    const topic = interaction.options.getString("topic");

    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: "You are a moderator of a high-stakes debate. Provide a short, intense back-and-forth between two distinct AI personalities ('The Optimist' and 'The Cynic') on the given topic. End with a witty conclusion. Keep it under 1500 characters." },
            { role: "user", content: `Debate topic: ${topic}` }
          ],
        }),
      });

      const data = await response.json();
      const debateResult = data.choices[0].message.content;

      const embed = new EmbedBuilder()
        .setColor(0xE67E22)
        .setTitle(`⚖️ The Great AI Debate: ${topic}`)
        .setDescription(debateResult)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error("Debate Error:", err);
      await interaction.editReply("The debaters have entered an infinite loop. Debate cancelled.");
    }
  },
};
