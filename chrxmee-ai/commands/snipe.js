const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('snipe')
    .setDescription('Snipes deleted/edited messages or goes insane mode')
    .addStringOption(option =>
      option.setName('mode')
        .setDescription('removed | edit | last50 | insane')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('count')
        .setDescription('How many messages back? (max 50 for last50)')
        .setRequired(false)),

  async execute(interaction, client) {
    await interaction.deferReply({ ephemeral: true });

    const mode = interaction.options.getString('mode').toLowerCase();
    const count = Math.min(interaction.options.getInteger('count') || 1, 50);

    // Use client.snipes Map (store in index.js globally)
    // Assume client.snipes = new Map(); // channelId → [{ author, content, timestamp, type: 'delete'|'edit', oldContent? }]

    if (!client.snipes) client.snipes = new Map();

    const channelSnipes = client.snipes.get(interaction.channelId) || [];

    if (mode === 'removed') {
      const deleted = channelSnipes.filter(s => s.type === 'delete').slice(-count);
      if (deleted.length === 0) return interaction.editReply('Nothing deleted recently... too slow ❄️');

      const embed = new EmbedBuilder()
        .setColor('#ff4444')
        .setTitle('Snipe: Deleted Messages')
        .setDescription(deleted.map(s => `**${s.author.tag}** (${s.timestamp.toLocaleTimeString()}): ${s.content || '[empty/attachment]'}`).join('\n\n'));

      return interaction.editReply({ embeds: [embed] });
    }

    if (mode === 'edit') {
      const edited = channelSnipes.filter(s => s.type === 'edit').slice(-count);
      if (edited.length === 0) return interaction.editReply('No edits sniped... everyone’s perfect today?');

      const embed = new EmbedBuilder()
        .setColor('#ffaa00')
        .setTitle('Snipe: Edited Messages')
        .setDescription(edited.map(s => `**${s.author.tag}** (${s.timestamp.toLocaleTimeString()}):\n**Before:** ${s.oldContent}\n**After:** ${s.content}`).join('\n\n'));

      return interaction.editReply({ embeds: [embed] });
    }

    if (mode === 'last50') {
      const recent = channelSnipes.slice(-count);
      if (recent.length === 0) return interaction.editReply('Channel’s too quiet for a snipe.');

      const embed = new EmbedBuilder()
        .setColor('#44ff44')
        .setTitle(`Last ${recent.length} Messages`)
        .setDescription(recent.map(s => `**${s.author.tag}** (${s.timestamp.toLocaleTimeString()}): ${s.content || '[attachment/media]'}`).join('\n\n'));

      return interaction.editReply({ embeds: [embed] });
    }

    if (mode === 'insane') {
      // This mode auto-triggers in messageDelete/messageUpdate events (add to events/messageDelete.js etc.)
      // For manual /snipe insane — just show recent heavy ones
      const heavy = channelSnipes.filter(s => {
        const text = (s.content || '').toLowerCase();
        return text.includes('fuck') || text.includes('bitch') || text.includes('kill') || text.includes('die') || text.includes('ugly');
      }).slice(-5);

      if (heavy.length === 0) return interaction.editReply('No one’s been unhinged enough lately...');

      const embed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('INSANE MODE ACTIVATED')
        .setDescription(heavy.map(s => `**${s.author.tag}** said: ${s.content}\nI’m watching you...`).join('\n\n'));

      return interaction.editReply({ embeds: [embed] });
    }

    return interaction.editReply('Invalid mode. Use: removed, edit, last50, insane');
  }
};
