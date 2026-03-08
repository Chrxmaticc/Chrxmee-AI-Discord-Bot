const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder } = require('discord.js');

const COLORS = {
  blue: 0x7289da,
  red: 0xff0000,
  green: 0x00ff00,
  purple: 0x9b59b6,
  gold: 0xf1c40f,
  default: 0x2f3136
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Create and manage embeds (mod only)')
    .addSubcommand(subcommand =>
      subcommand
        .setName('template')
        .setDescription('Use a simple pre-made template')
        .addStringOption(opt => opt.setName('type')
          .setDescription('Template type')
          .setRequired(true)
          .addChoices(
            { name: 'Welcome', value: 'welcome' },
            { name: 'Goodbye', value: 'goodbye' },
            { name: 'Announcement', value: 'announcement' }
          ))
        .addStringOption(opt => opt.setName('title').setDescription('Title').setRequired(true))
        .addStringOption(opt => opt.setName('description').setDescription('Description').setRequired(true))
        .addStringOption(opt => opt.setName('color')
          .setDescription('blue, red, green, purple, gold, default')
          .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('advanced')
        .setDescription('Send custom embed (fully forgiving parser)')
        .addStringOption(opt => opt.setName('code')
          .setDescription('Paste key:value lines or template')
          .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('advanced-paste')
        .setDescription('Get short copyable template'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('system')
        .setDescription('Use pre-made system embeds')
        .addStringOption(opt => opt.setName('type')
          .setDescription('Choose system embed')
          .setRequired(true)
          .addChoices(
            { name: 'Welcome Message', value: 'welcome' },
            { name: 'Goodbye Message', value: 'goodbye' },
            { name: 'Log Join', value: 'log-join' },
            { name: 'Log Leave', value: 'log-leave' },
            { name: 'Announcement', value: 'announcement' },
            { name: 'Rule Reminder', value: 'rule' },
            { name: 'Event Announcement', value: 'event' },
            { name: 'Mod Alert', value: 'mod-alert' },
            { name: 'Status Update', value: 'status' },
            { name: 'Fun Message', value: 'fun' }
          )))
    .addSubcommand(subcommand =>
      subcommand
        .setName('save')
        .setDescription('Save a custom embed')
        .addStringOption(opt => opt.setName('name')
          .setDescription('Name for this embed')
          .setRequired(true))
        .addStringOption(opt => opt.setName('code')
          .setDescription('Paste key:value lines')
          .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('view')
        .setDescription('View your saved embeds (ephemeral)'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('send')
        .setDescription('Send a saved embed (dropdown)')),

  async execute(interaction, client) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return interaction.reply({ content: 'Mods only.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });
    console.log(`[${new Date().toISOString()}] EMBED started for ${interaction.user.tag} | sub: ${interaction.options.getSubcommand()}`);

    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    let savedEmbeds = client.memory.get(`embeds_${userId}`) || {};

    if (sub === 'template') {
      const type = interaction.options.getString('type');
      const title = interaction.options.getString('title');
      const desc = interaction.options.getString('description');
      const colorName = interaction.options.getString('color') || 'default';
      const color = COLORS[colorName] || COLORS.default;

      const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setDescription(desc)
        .setFooter({ text: 'Chrxmee AI' })
        .setTimestamp();

      if (type === 'welcome') embed.setAuthor({ name: 'Welcome!', iconURL: interaction.guild?.iconURL() || interaction.client.user.displayAvatarURL() });
      if (type === 'goodbye') embed.setAuthor({ name: 'Goodbye :(', iconURL: interaction.guild?.iconURL() || interaction.client.user.displayAvatarURL() });
      if (type === 'announcement') embed.setAuthor({ name: 'Announcement!', iconURL: interaction.client.user.displayAvatarURL() });

      await interaction.channel.send({ embeds: [embed] });
      return interaction.editReply({ content: 'Template sent.', ephemeral: true });
    }

    if (sub === 'advanced') {
      let code = interaction.options.getString('code').trim();
      console.log(`Advanced attempt - length: ${code.length}`);

      const embed = new EmbedBuilder();

      // Fully forgiving line-by-line parser (no JSON.parse at all)
      const lines = code.split('\n').map(l => l.trim()).filter(line => line && !line.startsWith('//'));
      for (const line of lines) {
        if (!line.includes(':')) continue;
        const [keyRaw, ...valueParts] = line.split(':');
        const key = keyRaw.trim().toLowerCase();
        const value = valueParts.join(':').trim();

        if (key === 'title') embed.setTitle(value);
        if (key === 'desc' || key === 'description') embed.setDescription(value);
        if (key === 'color') {
          const c = value.toLowerCase();
          embed.setColor(COLORS[c] || parseInt(c.replace('#', '0x'), 16) || 0x2f3136);
        }
        if (key === 'footer') embed.setFooter({ text: value });
        if (key === 'image') embed.setImage(value);
        if (key === 'thumbnail') embed.setThumbnail(value);
      }

      await interaction.channel.send({ embeds: [embed] });
      return interaction.editReply({ content: 'Advanced embed sent (forgiving mode).', ephemeral: true });
    }

    if (sub === 'advanced-paste') {
      const template = `
title: Welcome!
desc: Hey {user.mention}! Glad you're here. Check [rules](https://discord.com/channels/SERVER_ID/CHANNEL_ID_RULES)
color: #7289da
footer: Chrxmee AI • {timestamp}
thumbnail: {user.avatar}
// Edit SERVER_ID/CHANNEL_ID (right-click > Copy ID)
// Paste edited version into /embed advanced code:...
      `.trim();

      return interaction.editReply({ content: template, ephemeral: true });
    }

    // ... rest of subcommands (system, save, view, send) unchanged ...
    // (paste them from your current file if needed, or let me know if you want the full pasted version again)
  }
};
