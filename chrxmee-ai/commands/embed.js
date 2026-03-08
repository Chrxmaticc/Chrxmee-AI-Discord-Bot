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
        .setDescription('Send custom embed (forgiving parser)')
        .addStringOption(opt => opt.setName('code')
          .setDescription('Paste JSON or key:value lines')
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
          .setDescription('Paste JSON or key:value')
          .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('view')
        .setDescription('View your saved embeds'))
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

      try {
        let embed = new EmbedBuilder();

        // Forgiving fallback parser (line-by-line)
        const lines = code.split('\n').map(l => l.trim()).filter(Boolean);
        for (const line of lines) {
          if (!line.includes(':')) continue;
          const [key, ...valueParts] = line.split(':');
          const value = valueParts.join(':').trim();
          if (key === 'title') embed.setTitle(value);
          if (key === 'desc') embed.setDescription(value);
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
      } catch (e) {
        return interaction.editReply({ content: `Parse failed: ${e.message.slice(0, 100)}... Use /embed advanced-paste for template.`, ephemeral: true });
      }
    }

    if (sub === 'advanced-paste') {
      const template = `
title: Welcome!
desc: Hey {user.mention}! Glad you're here.
Check [rules](https://discord.com/channels/SERVER_ID/CHANNEL_ID_RULES)
color: #7289da
footer: Chrxmee AI • {timestamp}
thumbnail: {user.avatar}
// Edit SERVER_ID/CHANNEL_ID (right-click > Copy ID)
// Paste into /embed advanced code:...
      `.trim();

      return interaction.editReply({ content: template, ephemeral: true });
    }

    if (sub === 'system') {
      const type = interaction.options.getString('type');
      let embed = new EmbedBuilder().setFooter({ text: 'Chrxmee AI' }).setTimestamp();

      if (type === 'welcome') embed.setColor('#00ff88').setTitle('Welcome!').setDescription('Welcome to the server!');
      if (type === 'goodbye') embed.setColor('#ff4444').setTitle('Goodbye').setDescription('Sad to see you go...');
      if (type === 'log-join') embed.setColor('#7289da').setTitle('Member Joined').setDescription('New member joined.');
      if (type === 'log-leave') embed.setColor('#ff8800').setTitle('Member Left').setDescription('Member left.');
      if (type === 'announcement') embed.setColor('#f1c40f').setTitle('Announcement').setDescription('Important message.');
      if (type === 'rule') embed.setColor('#9b59b6').setTitle('Rules Reminder').setDescription('Please follow the rules.');
      if (type === 'event') embed.setColor('#00ffff').setTitle('Event').setDescription('New event!');
      if (type === 'mod-alert') embed.setColor('#ff0000').setTitle('Mod Alert').setDescription('Staff attention needed.');
      if (type === 'status') embed.setColor('#7289da').setTitle('Status Update').setDescription('Bot status.');
      if (type === 'fun') embed.setColor('#ff00ff').setTitle('Fun Message').setDescription('Just for fun!');

      await interaction.channel.send({ embeds: [embed] });
      return interaction.editReply({ content: 'System embed sent.', ephemeral: true });
    }

    if (sub === 'save') {
      const name = interaction.options.getString('name');
      const json = interaction.options.getString('json');

      try {
        const embedData = JSON.parse(json);
        savedEmbeds[name] = embedData;
        client.memory.set(`embeds_${userId}`, savedEmbeds);
        return interaction.editReply({ content: `Saved as **${name}**.`, ephemeral: true });
      } catch (e) {
        return interaction.editReply({ content: `Invalid: ${e.message.slice(0, 100)}... Use /embed advanced-paste.`, ephemeral: true });
      }
    }

    if (sub === 'view') {
      if (Object.keys(savedEmbeds).length === 0) {
        return interaction.editReply({ content: 'No saved embeds. Use /embed save.', ephemeral: true });
      }

      let list = Object.keys(savedEmbeds).map(name => `**${name}**`).join('\n');
      return interaction.editReply({ content: `Saved embeds:\n${list}\n\nUse /embed send.`, ephemeral: true });
    }

    if (sub === 'send') {
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('embed_send_select')
        .setPlaceholder('Choose embed...')
        .addOptions(
          Object.keys(savedEmbeds).map(name => 
            new StringSelectMenuOptionBuilder()
              .setLabel(name)
              .setValue(name)
          )
        );

      const row = new ActionRowBuilder().addComponents(selectMenu);

      return interaction.editReply({
        content: 'Select embed to send:',
        components: [row],
        ephemeral: true
      });
    }
  }
};
