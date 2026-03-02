const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('image')
    .setDescription('Search for an image on Unsplash')
    .addStringOption(option =>
      option.setName('query')
        .setDescription('What to search for')
        .setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply();

    const query = interaction.options.getString('query');

    try {
      const res = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape&client_id=YOUR_UNSPLASH_ACCESS_KEY`);
      const data = await res.json();

      if (!data.results || data.results.length === 0) {
        return interaction.editReply('No images found for that... try something else ❄️');
      }

      const img = data.results[0];
      const embed = new EmbedBuilder()
        .setColor('#00c4ff')
        .setTitle(`Image: ${query}`)
        .setImage(img.urls.regular)
        .setFooter({ text: ` ${img.user.name} on Unsplash` });

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('Image fetch error:', err);
      return interaction.editReply('Image search broke... blame the WiFi. Try again?');
    }
  }
};
