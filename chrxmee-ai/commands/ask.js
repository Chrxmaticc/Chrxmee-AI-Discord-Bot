const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ask")
    .setDescription("Ask Chrxmee AI anything!")
    .addStringOption((option) =>
      option
        .setName("question")
        .setDescription("Your question")
        .setRequired(true)
    ),
  async execute(interaction) {
    await interaction.deferReply();

    const question = interaction.options.getString("question");

    try {
      const response = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.XAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "grok-beta", // or latest model from docs
          messages: [{ role: "user", content: question }],
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      const answer = data.choices[0].message.content;

      await interaction.editReply(`**Chrxmee AI:** ${answer}`);
    } catch (err) {
      console.error(err);
      await interaction.editReply(
        "Failed to reach Chrxmee AI — try again later."
      );
    }
  },
};
