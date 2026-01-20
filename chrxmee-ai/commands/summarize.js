const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("summarize")
    .setDescription("Summarize a long piece of text")
    .setContexts([0, 1, 2])
    .setIntegrationTypes([0, 1])
    .addStringOption((option) =>
      option.setName("text").setDescription("The text to summarize").setRequired(true)
    ),
  async execute(interaction) {
    await interaction.deferReply();
    const text = interaction.options.getString("text");

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
            { role: "system", content: "Summarize the following text concisely." },
            { role: "user", content: text }
          ],
          temperature: 0.5,
        }),
      });

      const data = await response.json();
      const summary = data.choices[0].message.content;
      await interaction.editReply(`**Summary:**\n${summary}`);
    } catch (err) {
      await interaction.editReply("Failed to summarize.");
    }
  },
};