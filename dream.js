const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dream')
    .setDescription('Chrxmee AI describes a wild dream')
    .addStringOption(option =>
      option.setName('theme')
        .setDescription('make a dream or leave blank for random)')
        .setRequired(false)
    ),
  async execute(interaction) {
    await interaction.deferReply();

    const theme = interaction.options.getString('theme') || 'completely random';

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama3-70b-8192',
          messages: [{ role: 'user', content: `Describe a bizarre, vivid dream about ${theme}. Make it weird and fun.` }],
          temperature: 1.2,
        }),
      });

      const data = await response.json();
      const dream = data.choices[0].message.content;

      await interaction.editReply(`**Chrxmee AI Dream:**\n${dream} 🌙`);
    } catch (err) {
      await interaction.editReply('Dream failed — too weird even for AI.');
    }
  },
};