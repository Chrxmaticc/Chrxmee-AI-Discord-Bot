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
          model: "grok-2-1212", // Updated to a more standard model name if grok-beta fails
          messages: [{ role: "user", content: question }],
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `API error ${response.status}`;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error?.message || errorText;
        } catch (e) {
          errorMessage = errorText;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      if (!data.choices || data.choices.length === 0) {
        throw new Error("No response from AI.");
      }
      const answer = data.choices[0].message.content;

      if (answer.length > 2000) {
        const chunks = answer.match(/[\s\S]{1,1900}/g);
        await interaction.editReply(`**Chrxmee AI:** ${chunks[0]}...`);
        for (let i = 1; i < chunks.length; i++) {
          await interaction.followUp(chunks[i]);
        }
      } else {
        await interaction.editReply(`**Chrxmee AI:** ${answer}`);
      }
    } catch (err) {
      console.error(`Ask command error: ${err.message}`);
      await interaction.editReply(
        `Failed to reach Chrxmee AI: ${err.message.substring(0, 100)}`
      );
    }
  },
};
