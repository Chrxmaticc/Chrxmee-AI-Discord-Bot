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
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
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
