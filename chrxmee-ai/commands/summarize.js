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
      const starterData = interaction.client.memory.get(interaction.user.id) || { model: "smart" };
      const userModel = starterData.model || "smart";

      const models = {
        smart: "llama-3.3-70b-versatile",
        fast: "llama-3.1-8b-instant",
        thinker: "deepseek-r1-distill-llama-70b",
        creative: "mixtral-8x7b-32768",
        efficient: "gemma2-9b-it",
        visionary: "qwen-2.5-72b",
        analyst: "llama-3.2-11b-text-preview",
        classic: "llama-3.1-70b-versatile"
      };

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: models[userModel] || models.smart,
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