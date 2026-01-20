const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("translate")
    .setDescription("Translate text to any language")
    .setContexts([0, 1, 2])
    .setIntegrationTypes([0, 1])
    .addStringOption((option) =>
      option.setName("text").setDescription("The text to translate").setRequired(true)
    )
    .addStringOption((option) =>
      option.setName("language").setDescription("The target language").setRequired(true)
    ),
  async execute(interaction) {
    await interaction.deferReply();
    const text = interaction.options.getString("text");
    const language = interaction.options.getString("language");

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
            { role: "system", content: `You are a translator. Translate the following text into ${language}. Only provide the translation.` },
            { role: "user", content: text }
          ],
          temperature: 0.3,
        }),
      });

      const data = await response.json();
      const translation = data.choices[0].message.content;
      await interaction.editReply(`**Original:** ${text}\n**Translation (${language}):** ${translation}`);
    } catch (err) {
      await interaction.editReply("Failed to translate.");
    }
  },
};