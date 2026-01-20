const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('summarize')
    .setDescription('Summarize text with Chrxmee AI')
    .addStringOption(option =>
      option.setName('text')
        .setDescription('Text to summarize')
        .setRequired(true)
    ),
  async execute(interaction) {
    await interaction.deferReply();

    const text = interaction.options.getString('text');

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
            { role: 'system', content: 'Summarize the following text concisely:' },
            { role: 'user', content: text }
          ],
          temperature: 0.5,
        }),
      });

      const data = await response.json();
      const summary = data.choices[0].message.content;

      await interaction.editReply(`**Chrxmee AI Summary:**\n${summary}`);
    } catch (err) {
      console.error(err);
      await interaction.editReply('Summary failed — try again.');
    }
  },
};