const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('snipe')
    .setDescription('Snipes deleted/edited messages or goes insane mode')
    .addSubcommand(subcommand =>
      subcommand
        .setName('removed')
        .setDescription('Shows recently deleted messages')
        .addIntegerOption(option =>
          option.setName('count')
            .setDescription('How many to show? (max 10)')
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('edit')
        .setDescription('Shows recently edited messages')
        .addIntegerOption(option =>
          option.setName('count')
            .setDescription('How many to show? (max 10)')
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('last50')
        .setDescription('Shows the last 50 messages (limited use)')
        .addIntegerOption(option =>
          option.setName('count')
            .setDescription('How many to show? (max 50)')
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('insane')
        .setDescription('Shows recent messages with heavy keywords')),

  async execute(interaction, client) {
    await interaction.deferReply({ ephemeral: true });

    const subcommand = interaction.options.getSubcommand();
    const count = Math.min(interaction.options.getInteger('count') || 5, subcommand === 'last50' ? 50 : 10);

    const channelSnipes = client.snipes.get(interaction.channelId) || [];

    if (subcommand === 'removed') {
      const deleted = channelSnipes.filter(s => s.type === 'delete').slice(-count);
      if (deleted.length === 0) return interaction.editReply('Nothing deleted recently... too slow ❄️');

      const embed = new EmbedBuilder()
        .setColor('#ff4444')
        .setTitle('Snipe: Deleted Messages')
        .setDescription(deleted.map(s => `**${s.author.tag}** (${s.timestamp.toLocaleTimeString()}): ${s.content || '[empty/attachment]'}`).join('\n\n'))
        .setFooter({ text: 'Sniped by Chrxmee AI ❄️' });

      return interaction.editReply({ embeds: [embed] });
    }

    if (subcommand === 'edit') {
      const edited = channelSnipes.filter(s => s.type === 'edit').slice(-count);
      if (edited.length === 0) return interaction.editReply('No edits sniped... everyone’s perfect today?');

      const embed = new EmbedBuilder()
        .setColor('#ffaa00')
        .setTitle('Snipe: Edited Messages')
        .setDescription(edited.map(s => `**${s.author.tag}** (${s.timestamp.toLocaleTimeString()}):\n**Before:** ${s.oldContent || '[empty]'}\n**After:** ${s.content || '[empty]'}`).join('\n\n'))
        .setFooter({ text: 'Sniped by Chrxmee AI ❄️' });

      return interaction.editReply({ embeds: [embed] });
    }

    if (subcommand === 'last50') {
      const recent = channelSnipes.slice(-count);
      if (recent.length === 0) return interaction.editReply('Channel’s too quiet for a snipe.');

      const embed = new EmbedBuilder()
        .setColor('#44ff44')
        .setTitle(`Last ${recent.length} Messages`)
        .setDescription(recent.map(s => `**${s.author.tag}** (${s.timestamp.toLocaleTimeString()}): ${s.content || '[attachment/media]'}`).join('\n\n'))
        .setFooter({ text: 'Sniped by Chrxmee AI ❄️' });

      return interaction.editReply({ embeds: [embed] });
    }

    if (subcommand === 'insane') {
      const heavy = channelSnipes.filter(s => {
        const text = (s.content || '').toLowerCase();
        return text.includes('fuck') || text.includes('bitch') || text.includes('kill') || text.includes('die') || text.includes('ugly') || text.includes('hate') || text.includes('loser');
      }).slice(-5);

      if (heavy.length === 0) return interaction.editReply('No one’s been unhinged enough lately...');

      const embed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('INSANE MODE ACTIVATED')
        .setDescription(heavy.map(s => `**${s.author.tag}** said: ${s.content}\nI’m watching you... ❄️`).join('\n\n'))
        .setFooter({ text: 'Chrxmee AI remembers everything' });

      return interaction.editReply({ embeds: [embed] });
    }
  }
};
