const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const dataFile = path.join(__dirname, '..', 'userData.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set')
    .setDescription('Set personal info for Chrxmee AI to remember')
    .addStringOption(option =>
      option.setName('key')
        .setDescription('What to set, ages, names, more.')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('value')
        .setDescription('The value')
        .setRequired(true)
    ),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const key = interaction.options.getString('key').toLowerCase();
    const value = interaction.options.getString('value');
    const userId = interaction.user.id;

    let userData = {};
    if (fs.existsSync(dataFile)) {
      userData = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    }

    if (!userData[userId]) userData[userId] = {};

    userData[userId][key] = value;

    fs.writeFileSync(dataFile, JSON.stringify(userData, null, 2));

    await interaction.editReply(`Saved: ${key} = ${value} (I'll remember this!)`);
  },
};