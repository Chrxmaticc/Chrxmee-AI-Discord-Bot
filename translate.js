const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('translate')
    .setDescription('Translate text to any language with Chrxmee AI')
    .addStringOption(option =>
      option.setName('text')
        .setDescription('Text to translate')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('target')
        .setDescription('Target language.')
        .setRequired(true)
    ),
  async execute(interaction) {
    await interaction.deferReply();

    const text = interaction.options.getString('text');
    const target = interaction.options.getString('target');

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama3-70b-8192',
          messages: [
            { role: 'system', content: `Translate the following text to ${target}. Keep it natural and accurate.` },
            { role: 'user', content: text }
          ],
          temperature: 0.5,
        }),
      });

      const data = await response.json();
      const translation = data.choices[0].message.content;

      await interaction.editReply(`**Original:** ${text}\n**Translated to ${target}:** ${translation}`);
    } catch (err) {
      console.error(err);
      await interaction.editReply('Translation failed — try again.');
    }
  },
};