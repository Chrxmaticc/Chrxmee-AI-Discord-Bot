const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mypersonal')
    .setDescription('View what personal info Chrxmee AI remembers about you'),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const userId = interaction.user.id;

    const userData = interaction.client.memory.get(userId) || { personal: {} };

    const info = userData.personal || {};

    if (Object.keys(info).length === 0) {
      return interaction.editReply('I don\'t remember any personal info yet — use /setpersonal!');
    }

    const embed = new EmbedBuilder()
      .setTitle('Chrxmee AI Personal Memory')
      .setColor('#00FF00')
      .addFields(Object.entries(info).map(([k, v]) => ({ name: k.replace('_', ' ').toUpperCase(), value: v, inline: true })));

    await interaction.editReply({ embeds: [embed] });
  },
};