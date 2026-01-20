const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('code')
    .setDescription('Generate or fix code with Chrxmee AI')
    .addStringOption(option =>
      option.setName('request')
        .setDescription('What code do you want fixed or generated?')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('language')
        .setDescription('Programming language (optional, guessed if blank)')
        .setRequired(false)
    ),
  async execute(interaction) {
    await interaction.deferReply();

    const request = interaction.options.getString('request');
    const language = interaction.options.getString('language') || 'detect';

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
            { role: 'system', content: `You are a coding expert. Generate or fix code for: ${request}. Use ${language} if specified.` },
            { role: 'user', content: request }
          ],
          temperature: 0.3,
        }),
      });

      const data = await response.json();
      const code = data.choices[0].message.content;

      await interaction.editReply(`**Chrxmee AI Code:**\n\`\`\`${language}\n${code}\n\`\`\``);
    } catch (err) {
      console.error(err);
      await interaction.editReply('Code gen failed, too complicated. Try again');
    }
  },
};