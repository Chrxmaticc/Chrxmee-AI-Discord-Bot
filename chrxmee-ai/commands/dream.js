const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("dream")
    .setDescription("Get a creative and surreal interpretation of a dream or idea")
    .addStringOption(option =>
      option.setName("idea")
        .setDescription("What's the seed of your dream?")
        .setRequired(true))
    .setContexts([0, 1, 2])
    .setIntegrationTypes([0, 1]),
  async execute(interaction) {
    await interaction.deferReply();
    const idea = interaction.options.getString("idea");

    try {
      const starterData = interaction.client.memory.get(interaction.user.id) || { model: "smart" };
      const userModel = starterData.model || "smart";

      const models = {
        smart: "llama-3.3-70b-versatile",
        fast: "llama-3.1-8b-instant",
        thinker: "deepseek-r1-distill-llama-70b",
        creative: "llama-3.3-70b-versatile",
        efficient: "llama-3.1-8b-instant",
        visionary: "llama-3.3-70b-versatile",
        analyst: "llama-3.1-8b-instant",
        classic: "llama-3.3-70b-versatile"
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
            { role: "system", content: "You are a dream weaver. Create a surreal, poetic, and vivid description of a dream sequence based on the user's input." },
            { role: "user", content: `Dream about: ${idea}` }
          ],
        }),
      });

      const data = await response.json();
      const result = data.choices[0].message.content;

      await interaction.editReply(`🌙 **Dream Sequence:**\n\n${result}`);
    } catch (err) {
      console.error("Dream Error:", err);
      await interaction.editReply("The dream faded away before I could capture it...");
    }
  },
};
