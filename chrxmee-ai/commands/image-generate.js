const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("image-generate")
    .setDescription("Generate an image with Flux (Chrxmee AI vision)")
    .addStringOption((option) =>
      option
        .setName("prompt")
        .setDescription("Describe the image")
        .setRequired(true)
    ),
  async execute(interaction) {
    await interaction.deferReply();

    const prompt = interaction.options.getString("prompt");

    try {
      const response = await fetch("https://api.x.ai/v1/images/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.XAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "flux", // or current image model
          prompt: prompt,
          n: 1,
          size: "1024x1024",
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      const imageUrl = data.data[0].url;

      await interaction.editReply({
        content: `**Chrxmee AI generated:** ${prompt}`,
        files: [imageUrl],
      });
    } catch (err) {
      console.error(err);
      await interaction.editReply("Failed to generate image — try again.");
    }
  },
};
