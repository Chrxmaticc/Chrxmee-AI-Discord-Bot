const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("imagine")
    .setDescription("Generate a visual description for an AI image generator")
    .addStringOption(option =>
      option.setName("prompt")
        .setDescription("What do you want to imagine?")
        .setRequired(true))
    .setContexts([0, 1, 2])
    .setIntegrationTypes([0, 1]),
  async execute(interaction) {
    await interaction.deferReply();
    const prompt = interaction.options.getString("prompt");
    
    try {
      // Using Pollinations AI - a free, high-quality image generation API
      const encodedPrompt = encodeURIComponent(prompt);
      const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true&enhance=true&seed=${Math.floor(Math.random() * 1000000)}`;

      const embed = new EmbedBuilder()
        .setColor(0x00FFFF)
        .setTitle("🎨 Chrxmee AI - Ultra Image Gen")
        .setDescription(`**Prompt:** ${prompt}\n\n*Generating high-definition visual...*`)
        .setImage(imageUrl)
        .setFooter({ text: "Powered by Pollinations AI & Flux Architecture ❄️" })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error("Image generation error:", err);
      await interaction.editReply("The canvas is frozen! I couldn't generate your image right now.");
    }
  },
};
