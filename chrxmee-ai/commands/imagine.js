const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const https = require('https');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('image')
    .setDescription('Search for a free image (Pixabay)')
    .addStringOption(option =>
      option.setName('query')
        .setDescription('What to search for (e.g. snowy mountain)')
        .setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply();

    const query = interaction.options.getString('query');

    const url = `https://pixabay.com/api/?q=${encodeURIComponent(query)}&key=your_pixabay_key_if_you_want&per_page=3&image_type=photo&orientation=horizontal`;

    // Note: Pixabay allows keyless for very low use, but to avoid blocks, get a free key in 30 sec:
    // https://pixabay.com/api/docs/ → sign up → copy key → paste below
    // Or test without key first (may work temporarily)

    https.get(url.replace('your_pixabay_key_if_you_want', ''), (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (!json.hits || json.hits.length === 0) {
            return interaction.editReply('No good images found... try a different search ❄️');
          }

          const img = json.hits[Math.floor(Math.random() * json.hits.length)]; // random from top 3
          const embed = new EmbedBuilder()
            .setColor('#00ff88')
            .setTitle(`Image: ${query}`)
            .setImage(img.largeImageURL)
            .setFooter({ text: `📸 Pixabay - ${img.user}` });

          interaction.editReply({ embeds: [embed] });
        } catch (err) {
          interaction.editReply('Image search glitched... WiFi? ❄️ Try again?');
        }
      });
    }).on('error', err => {
      console.error('Image fetch error:', err);
      interaction.editReply('Couldn’t reach the image gods. Try again? ❄️');
    });
  }
};
