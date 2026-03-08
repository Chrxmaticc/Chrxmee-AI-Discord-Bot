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

  async execute(interaction, client) {  // <-- FIXED HERE: added client param
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return interaction.reply({ content: 'Mods only.', ephemeral: true });
    }

    // DEBUG LOG — confirms if code starts executing
    await interaction.deferReply({ ephemeral: true });
    console.log(`[${new Date().toISOString()}] EMBED COMMAND started for ${interaction.user.tag} in ${interaction.channelId || 'DM'} | sub: ${interaction.options.getSubcommand()}`);

    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    let savedEmbeds = client.memory.get(`embeds_${userId}`) || {};

    // ... rest of your code (template, advanced, system, save, view, send) stays exactly the same ...
    // (paste the rest from your current file here, or let me know if you want the full pasted version again)

    // Example for 'view' subcommand (to confirm memory works)
    if (sub === 'view') {
      if (Object.keys(savedEmbeds).length === 0) {
        return interaction.editReply('You have no saved embeds yet. Use /embed save first.');
      }

      let list = Object.keys(savedEmbeds).map(name => `**${name}**`).join('\n');
      return interaction.editReply(`Your saved embeds:\n${list}\n\nUse /embed send name:NAME to send one.`);
    }

    // ... other subcommands ...
  }
};
