const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('image')
    .setDescription('Drop a random public image (Lorem Picsum)'),

  async execute(interaction) {
    await interaction.deferReply();

    // Random size + grayscale sometimes for chaos
    const width = Math.floor(Math.random() * 400) + 600; // 600-1000
    const height = Math.floor(Math.random() * 300) + 400; // 400-700
    const grayscale = Math.random() < 0.3 ? '?grayscale' : ''; // 30% chance

    const url = `https://picsum.photos/${width}/${height}${grayscale}`;

    const embed = new EmbedBuilder()
      .setColor('#7289da')
      .setTitle('Random Image')
      .setImage(url)
      .setDescription('Fresh from the public web — no API key needed')
      .setFooter({ text: 'Lorem Picsum — truly public images' });

    return interaction.editReply({ embeds: [embed] });
  }
};
