const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show all commands with sections'),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const mainEmbed = new EmbedBuilder()
      .setColor('#2f3136')
      .setTitle('Chrxmee AI • Commands')
      .setDescription('Underground bot energy. Click a category below to see what’s inside.')
      .addFields(
        {
          name: 'AI-Powered Commands',
          value: 'Chat, ask, summarize, translate, debate, code, dream, model, news, oracle, etc.',
          inline: true
        },
        {
          name: 'Birthday',
          value: 'Set/view/remove your birthday + mod config',
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
          value: 'Auto-respond, guild settings, dashboard, brain dump/clear, etc.',
          inline: true
        }
      )
      .setFooter({ text: 'Chrxmee AI — underground just like breed, but with more soul' });

    const row1 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('help_ai')
          .setLabel('AI-Powered')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('help_birthday')
          .setLabel('Birthday')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('help_visual')
          .setLabel('Visual Imagination')
          .setStyle(ButtonStyle.Primary)
      );

    const row2 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('help_fun')
          .setLabel('Fun & Games')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('help_utility')
          .setLabel('Utility')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('help_mod')
          .setLabel('Moderation & Advanced')
          .setStyle(ButtonStyle.Primary)
      );

    await interaction.editReply({
      embeds: [mainEmbed],
      components: [row1, row2]
    });
  }
};
