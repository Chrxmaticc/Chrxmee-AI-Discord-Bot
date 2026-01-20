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
          model: "grok-2-vision-1212", // Updated model name for vision/image related tasks if flux fails
          prompt: prompt,
          n: 1,
          size: "1024x1024",
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
      if (!data.data || data.data.length === 0) {
        throw new Error("No image data returned from AI.");
      }
      const imageUrl = data.data[0].url;

      await interaction.editReply({
        content: `**Chrxmee AI generated:** ${prompt}`,
        files: [imageUrl],
      });
    } catch (err) {
      console.error(`Image command error: ${err.message}`);
      await interaction.editReply(`Failed to generate image: ${err.message.substring(0, 100)}`);
    }
  },
};
