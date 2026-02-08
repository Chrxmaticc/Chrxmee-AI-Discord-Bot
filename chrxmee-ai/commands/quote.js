const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("quote")
    .setDescription("Get a deep, AI-generated quote tailored to your personality"),
  async execute(interaction) {
    await interaction.deferReply();
    const userId = interaction.user.id;
    const userData = interaction.client.memory.get(userId) || { model: "smart" };

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
            { role: "system", content: `You are a wise and poetic philosopher. Generate a deep, meaningful, and slightly mysterious quote. If the user has a custom personality (${userData.customPrompt || "Standard"}), make the quote match that vibe.` },
            { role: "user", content: "Generate a unique quote for me." }
          ],
          temperature: 0.9,
        }),
      });

      const data = await response.json();
      const quote = data.choices[0].message.content;

      await interaction.editReply(`✨ **The Void Whispers:**\n\n> *${quote}*`);
    } catch (err) {
      console.error(err);
      await interaction.editReply("The mists of wisdom are too thick right now...");
    }
  },
};
