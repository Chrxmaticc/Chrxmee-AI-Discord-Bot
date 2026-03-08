const { SlashCommandBuilder, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show all commands with sections'),

  async execute(interaction) {
    // Defer immediately — prevents "interaction failed" timeout
    await interaction.deferReply({ ephemeral: true });

    console.log(`Help command executed by ${interaction.user.tag}`);

    const mainEmbed = new EmbedBuilder()
      .setColor('#2f3136')
      .setTitle('Chrxmee AI • Commands')
      .setDescription('Underground bot energy. Select a category to see the full list.')
      .addFields(
        {
          name: 'AI-Powered',
          value: 'Chat, ask, summarize, translate, debate, dream, model, news, oracle, code-gen',
          inline: true
        },
        {
          name: 'Visual',
          value: 'Image search, imagine, QR, avatar',
          inline: true
        },
        {
          name: 'Fun & Games',
          value: 'Roast, roastme, burn, coinflip, dice, poll, trivia, ship, 8ball',
          inline: true
        },
        {
          name: 'Utility',
          value: 'Snipe, ping, server/user info, remind, quote, status, history',
          inline: true
        },
        {
          name: 'Moderation & Advanced',
          value: 'Auto-respond, guild settings, dashboard, brain-dump/clear',
          inline: true
        }
      )
      .setFooter({ text: 'Chrxmee AI • Built with chaos & focus' });

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('help_select')
      .setPlaceholder('Select a category...')
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel('AI-Powered').setValue('help_ai'),
        new StringSelectMenuOptionBuilder().setLabel('Visual').setValue('help_visual'),
        new StringSelectMenuOptionBuilder().setLabel('Fun & Games').setValue('help_fun'),
        new StringSelectMenuOptionBuilder().setLabel('Utility').setValue('help_utility'),
        new StringSelectMenuOptionBuilder().setLabel('Moderation & Advanced').setValue('help_mod')
      );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.editReply({
      embeds: [mainEmbed],
      components: [row]
    });
  }
};
