const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const dataFile = path.join(__dirname, '..', 'userData.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('myinfo')
    .setDescription('View what Chrxmee AI knows about you'),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const userId = interaction.user.id;

    let userData = {};
    if (fs.existsSync(dataFile)) {
      userData = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    }

    const info = userData[userId] || {};

    if (Object.keys(info).length === 0) {
      return interaction.editReply('I don\'t know anything about you yet! Use /set to tell me stuff.');
    }

    const embed = new EmbedBuilder()
      .setTitle('Chrxmee AI Knows About You')
      .setColor('#00FF00')
      .addFields(Object.entries(info).map(([k, v]) => ({ name: k.replace('_', ' '), value: v, inline: true })));

    await interaction.editReply({ embeds: [embed] });
  },
};