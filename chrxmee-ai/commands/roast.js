const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("roast")
    .setDescription("Get a personalized AI roast!")
    .addUserOption(option =>
      option.setName("target")
        .setDescription("Who should I roast? (Leave blank to roast yourself)")
        .setRequired(false))
    .setContexts([0, 1, 2])
    .setIntegrationTypes([0, 1]),
  async execute(interaction) {
    await interaction.deferReply();
    const target = interaction.options.getUser("target") || interaction.user;
    
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
            { role: "system", content: "You are a master of roasts and witty insults. Be funny, creative, and savage but stay within Discord's safety guidelines. Keep it under 500 characters." },
            { role: "user", content: `Give a funny and savage roast to ${target.username}.` }
          ],
        }),
      });

      const data = await response.json();
      const roast = data.choices[0].message.content;

      await interaction.editReply(`🔥 **Roast for ${target}:**\n\n${roast}`);
    } catch (err) {
      console.error("Roast Error:", err);
      await interaction.editReply("My roasting engine overheated. You got lucky today.");
    }
  },
};
