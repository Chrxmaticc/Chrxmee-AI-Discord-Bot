const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');

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
        .setDescription('Send raw embed code')
        .addStringOption(opt => opt.setName('json')
          .setDescription('Paste your embed JSON or simple code')
          .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('advanced-paste')
        .setDescription('Get a template to paste advanced code'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('system')
        .setDescription('Use pre-made system embeds (logs, welcome, etc.)')
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
        .setDescription('Save a custom embed for later')
        .addStringOption(opt => opt.setName('name')
          .setDescription('Name for this embed')
          .setRequired(true))
        .addStringOption(opt => opt.setName('json')
          .setDescription('Paste embed JSON or code')
          .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('view')
        .setDescription('View your saved embeds (ephemeral)'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('send')
        .setDescription('Send one of your saved embeds')
        .addStringOption(opt => opt.setName('name')
          .setDescription('Name of the saved embed')
          .setRequired(true))),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return interaction.reply({ content: 'Mods only.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    // Load user's saved embeds
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

      await interaction.channel.send({ embeds: [embed] });
      return interaction.editReply('Template sent.');
    }

    if (sub === 'advanced') {
      let code = interaction.options.getString('json').trim();
      try {
        const embedData = JSON.parse(code);
        const embed = new EmbedBuilder(embedData);
        await interaction.channel.send({ embeds: [embed] });
        return interaction.editReply('Advanced embed sent.');
      } catch (e) {
        return interaction.editReply('Invalid JSON. Use /embed advanced-paste for help.');
      }
    }

    if (sub === 'advanced-paste') {
      const template = `
title: Your Title
desc: Your description here
color: #7289da
footer: Chrxmee AI
image: https://i.imgur.com/yourimage.png   // optional
      `.trim();

      return interaction.editReply({
        content: 'Copy this, edit it, then paste into /embed advanced',
        embeds: [new EmbedBuilder().setDescription(`\`\`\`\n${template}\n\`\`\``)]
      });
    }

    if (sub === 'system') {
      const type = interaction.options.getString('type');
      let embed = new EmbedBuilder().setFooter({ text: 'Chrxmee AI' }).setTimestamp();

      if (type === 'welcome') {
        embed.setColor('#00ff88').setTitle('Welcome!').setDescription('Welcome to the server! Enjoy your stay.');
      } else if (type === 'goodbye') {
        embed.setColor('#ff4444').setTitle('Goodbye').setDescription('Sad to see you go...');
      } else if (type === 'log-join') {
        embed.setColor('#7289da').setTitle('Member Joined').setDescription('A new member joined the server.');
      } else if (type === 'log-leave') {
        embed.setColor('#ff8800').setTitle('Member Left').setDescription('A member left the server.');
      } else if (type === 'announcement') {
        embed.setColor('#f1c40f').setTitle('Announcement').setDescription('Important announcement.');
      } else if (type === 'rule') {
        embed.setColor('#9b59b6').setTitle('Rules Reminder').setDescription('Please follow the rules.');
      } else if (type === 'event') {
        embed.setColor('#00ffff').setTitle('Event Announcement').setDescription('New event happening!');
      } else if (type === 'mod-alert') {
        embed.setColor('#ff0000').setTitle('Mod Alert').setDescription('Staff attention needed.');
      } else if (type === 'status') {
        embed.setColor('#7289da').setTitle('Status Update').setDescription('Bot or server status.');
      } else if (type === 'fun') {
        embed.setColor('#ff00ff').setTitle('Fun Message').setDescription('Just a fun message!');
      }

      await interaction.channel.send({ embeds: [embed] });
      return interaction.editReply('System embed sent.');
    }

    if (sub === 'save') {
      const name = interaction.options.getString('name');
      const json = interaction.options.getString('json');

      try {
        const embedData = JSON.parse(json);
        savedEmbeds[name] = embedData;
        client.memory.set(`embeds_${userId}`, savedEmbeds);
        return interaction.editReply(`Saved embed as **${name}**. Use /embed send name:${name} to use it.`);
      } catch (e) {
        return interaction.editReply('Invalid JSON. Use /embed advanced-paste for help.');
      }
    }

    if (sub === 'view') {
      if (Object.keys(savedEmbeds).length === 0) {
        return interaction.editReply('You have no saved embeds yet. Use /embed save first.');
      }

      let list = Object.keys(savedEmbeds).map(name => `**${name}**`).join('\n');
      return interaction.editReply(`Your saved embeds:\n${list}\n\nUse /embed send name:NAME to send one.`);
    }

    if (sub === 'send') {
      const name = interaction.options.getString('name');
      const saved = savedEmbeds[name];

      if (!saved) return interaction.editReply(`No saved embed called **${name}**. Check /embed view`);

      const embed = new EmbedBuilder(saved);
      await interaction.channel.send({ embeds: [embed] });
      return interaction.editReply(`Sent saved embed **${name}**.`);
    }
  }
};
