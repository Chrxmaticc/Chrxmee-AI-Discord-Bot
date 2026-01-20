const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roast')
    .setDescription('Chrxmee AI roasts someone (or you)')
    .addUserOption(option =>
      option.setName('target')
        .setDescription('Who to roast (or leave blank for self-roast)')
        .setRequired(false)
    ),
  async execute(interaction) {
    await interaction.deferReply();

    const target = interaction.options.getUser('target') || interaction.user;
    const name = target.username;

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama3-70b-8192',
          messages: [{ role: 'user', content: `Roast ${name} in a savage but funny way.` }],
          temperature: 0.9,
        }),
      });

      const data = await response.json();
      const roast = data.choices[0].message.content;

      await interaction.editReply(`**Chrxmee AI roasts ${name}:** ${roast} 💀`);
    } catch (err) {
      await interaction.editReply('Roast failed — too hot to handle.');
    }
  },
};