const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('say')
    .setDescription('Make the bot say something anonymously, if you wish.')
    .addStringOption(option =>
      option.setName('message')
        .setDescription('The message to send.')
        .setRequired(true))
    .addBooleanOption(option =>
      option.setName('anonymous')
        .setDescription('Make it anonymous (ephemeral explanation)')
        .setRequired(false))
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Target channel (optional)')
        .setRequired(false)),

  async execute(interaction) {
    // Defer immediately
    await interaction.deferReply({ ephemeral: true });

    const messageText = interaction.options.getString('message');
    const anonymous = interaction.options.getBoolean('anonymous') || false;
    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

    try {
      await targetChannel.send(messageText);

      if (anonymous) {
        return interaction.editReply('Sending ephemeral message so it’s really anonymous. Ephemeral messages before the commands really voids the interaction info.');
      } else {
        return interaction.editReply('Message sent.');
      }
    } catch (err) {
      console.error('Say error:', err);
      return interaction.editReply('Couldn’t send the message... check permissions or channel access.');
    }
  }
};
