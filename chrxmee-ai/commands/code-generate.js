const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("code-generate")
    .setDescription("Generate high-quality code snippets")
    .setContexts([0, 1, 2])
    .setIntegrationTypes([0, 1])
    .addStringOption((option) =>
      option.setName("prompt").setDescription("What code do you need?").setRequired(true)
    ),
  async execute(interaction) {
    await interaction.deferReply();
    const prompt = interaction.options.getString("prompt");

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
            { role: "system", content: "You are an expert software engineer. Provide clean, well-commented code." },
            { role: "user", content: prompt }
          ],
          temperature: 0.2,
        }),
      });

      const data = await response.json();
      const code = data.choices[0].message.content;
      
      if (code.length > 2000) {
        const chunks = code.match(/[\s\S]{1,1900}/g);
        await interaction.editReply(chunks[0]);
        for (let i = 1; i < chunks.length; i++) {
          await interaction.followUp(chunks[i]);
        }
      } else {
        await interaction.editReply(code);
      }
    } catch (err) {
      await interaction.editReply("Failed to generate code.");
    }
  },
};