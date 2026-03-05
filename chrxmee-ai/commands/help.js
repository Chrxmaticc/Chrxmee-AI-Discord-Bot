const { SlashCommandBuilder, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show all commands with sections'),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const mainEmbed = new EmbedBuilder()
      .setColor('#2f3136')
      .setTitle('Chrxmee AI • Commands')
      .setDescription('Underground bot energy. Select a category below to see commands in that section.')
      .addFields(
        {
          name: 'AI-Powered Commands',
          value: 'Chat, ask, summarize, translate, debate, code, dream, model, news, oracle, etc.',
          inline: true
        },
        {
          name: 'Visual Imagination',
          value: 'Image search, QR codes, avatars, etc.',
          inline: true
        },
        {
          name: 'Fun & Games',
          value: 'Roasts, coinflip, dice, poll, trivia, ship, 8ball, etc.',
          inline: true
        },
        {
          name: 'Utility',
          value: 'Snipe, ping, server/user info, settings, history, reminders, etc.',
          inline: true
        },
        {
          name: 'Moderation & Advanced',
          value: 'Auto-respond, guild settings, brain dump/clear, etc.',
          inline: true
        }
      )
      .setFooter({ text: 'Chrxmee AI — underground just like breed, but with more soul' });

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('help_select')
      .setPlaceholder('Select a category...')
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel('AI-Powered Commands')
          .setDescription('Chat, ask, summarize, translate, debate, etc.')
          .setValue('help_ai'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Visual Imagination')
          .setDescription('Image search, QR, avatars, etc.')
          .setValue('help_visual'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Fun & Games')
          .setDescription('Roasts, coinflip, dice, poll, trivia, ship, 8ball')
          .setValue('help_fun'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Utility')
          .setDescription('Snipe, ping, server info, settings, reminders, etc.')
          .setValue('help_utility'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Moderation & Advanced')
          .setDescription('Auto-respond, guild settings, dashboard, brain tools, etc.')
          .setValue('help_mod')
      );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.editReply({
      embeds: [mainEmbed],
      components: [row]
    });
  }
};
