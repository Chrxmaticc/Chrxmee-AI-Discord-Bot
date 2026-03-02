const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('snipe')
    .setDescription('Snipe deleted/edited messages or go insane mode')
    .addStringOption(option =>
      option.setName('mode')
        .setDescription('What to snipe')
        .setRequired(true)
        .addChoices(
          { name: 'removed (deleted)', value: 'removed' },
          { name: 'edit (edited)', value: 'edit' },
          { name: 'last50 (recent)', value: 'last50' },
          { name: 'insane (spicy keywords)', value: 'insane' }
        ))
    .addIntegerOption(option =>
      option.setName('count')
        .setDescription('How many messages? (max 50)')
        .setRequired(false)),

  async execute(interaction, client) {
    await interaction.deferReply({ ephemeral: true });

    const mode = interaction.options.getString('mode');
    const count = Math.min(interaction.options.getInteger('count') || 5, mode === 'last50' ? 50 : 10);

    const snipes = client.snipes.get(interaction.channelId) || [];

    if (mode === 'removed') {
      const deleted = snipes.filter(s => s.type === 'delete').slice(-count);
      if (deleted.length === 0) {
        return interaction.editReply('Snipe: Deleted. No insanity for me to deal with today.');
      }

      const embed = new EmbedBuilder()
        .setColor('#ff4444')
        .setTitle('Snipe: Deleted')
        .setDescription(deleted.map(s => `**${s.author.tag}** (${s.timestamp.toLocaleTimeString()}): ${s.content || '[empty/attachment]'}`).join('\n\n'))
        .setFooter({ text: 'Sniped by Chrxmee AI' });

      return interaction.editReply({ embeds: [embed] });
    }

    if (mode === 'edit') {
      const edited = snipes.filter(s => s.type === 'edit').slice(-count);
      if (edited.length === 0) {
        return interaction.editReply('Snipe: Edit. No one’s changing their mind today... boring.');
      }

      const embed = new EmbedBuilder()
        .setColor('#ffaa00')
        .setTitle('Snipe: Edited')
        .setDescription(edited.map(s => `**${s.author.tag}** (${s.timestamp.toLocaleTimeString()}):\n**Before:** ${s.oldContent || '[empty]'}\n**After:** ${s.content || '[empty]'}`).join('\n\n'))
        .setFooter({ text: 'Sniped by Chrxmee AI' });

      return interaction.editReply({ embeds: [embed] });
    }

    if (mode === 'last50') {
      const recent = snipes.slice(-count);
      if (recent.length === 0) {
        return interaction.editReply('Snipe: Last50. Channel’s so dead even ghosts left.');
      }

      const embed = new EmbedBuilder()
        .setColor('#44ff44')
        .setTitle(`Last ${recent.length} Messages`)
        .setDescription(recent.map(s => `**${s.author.tag}** (${s.timestamp.toLocaleTimeString()}): ${s.content || '[attachment/media]'}`).join('\n\n'))
        .setFooter({ text: 'Sniped by Chrxmee AI' });

      return interaction.editReply({ embeds: [embed] });
    }

    if (mode === 'insane') {
      const heavy = snipes.filter(s => {
        const t = (s.content || '').toLowerCase();
        return t.includes('fuck') || t.includes('bitch') || t.includes('kill') || t.includes('die') || t.includes('ugly') || t.includes('hate') || t.includes('loser');
      }).slice(-5);

      if (heavy.length === 0) {
        return interaction.editReply('Snipe: Insane. Everyone’s too chill today... disappointing.');
      }

      const embed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('INSANE SNIPE MODE')
        .setDescription(heavy.map(s => `**${s.author.tag}** said: ${s.content}`).join('\n\n'))
        .setFooter({ text: 'Chrxmee AI remembers everything' });

      return interaction.editReply({ embeds: [embed] });
    }
  }
};
