const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('forgetpersonal')
    .setDescription('Make Chrxmee AI forget your personal info (keeps history/model)'),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const userId = interaction.user.id;

    const userData = interaction.client.memory.get(userId);

    if (userData && userData.personal) {
      delete userData.personal;
      interaction.client.memory.set(userId, userData);
      await interaction.editReply('Poof — your personal info is gone (history and model still intact)!');
    } else {
      await interaction.editReply('No personal info to forget!');
    }
  },
};