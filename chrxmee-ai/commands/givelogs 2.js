const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

const OWNER_ID = '902685494247325776';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('givelogs')
    .setDescription('Configure the give command log system')
    .addSubcommand(sub =>
      sub.setName('setchannel')
        .setDescription('Set the channel where give logs are sent')
        .addChannelOption(opt => opt.setName('channel').setDescription('Log channel').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('toggle')
        .setDescription('Turn give logging on or off')
        .addStringOption(opt =>
          opt.setName('state').setDescription('On or off').setRequired(true)
            .addChoices({ name: '✅ On', value: 'on' }, { name: '❌ Off', value: 'off' })
        )
    )
    .addSubcommand(sub => sub.setName('status').setDescription('View current log settings')),

  async execute(interaction, client) {
    try { await interaction.deferReply({ ephemeral: true }); }
    catch (err) { return interaction.reply({ content: 'Failed.', ephemeral: true }).catch(() => {}); }

    const userId = interaction.user.id;
    const guildId = interaction.guild.id;
    const key = `givelogs_${guildId}`;

    // Only owner or admins can configure logs
    const isOwner = userId === OWNER_ID;
    const isAdmin = interaction.member?.permissions.has('Administrator');
    if (!isOwner && !isAdmin) {
      return interaction.editReply('❌ Only the bot owner or server admins can configure give logs.');
    }

    let config = client.memory.get(key) || { channelId: null, enabled: false };
    const sub = interaction.options.getSubcommand();

    // ── SET CHANNEL ────────────────────────────────────────
    if (sub === 'setchannel') {
      const channel = interaction.options.getChannel('channel');
      config.channelId = channel.id;
      config.enabled = true; // auto-enable when channel is set
      client.memory.set(key, config);
      return interaction.editReply(`✅ Give logs will now be sent to <#${channel.id}>!\nLogging is **enabled**.`);
    }

    // ── TOGGLE ─────────────────────────────────────────────
    if (sub === 'toggle') {
      if (!config.channelId) return interaction.editReply('❌ Set a log channel first with `/givelogs setchannel`.');
      const state = interaction.options.getString('state');
      config.enabled = state === 'on';
      client.memory.set(key, config);
      return interaction.editReply(`${config.enabled ? '✅ Give logging **enabled**.' : '❌ Give logging **disabled**.'}`);
    }

    // ── STATUS ─────────────────────────────────────────────
    if (sub === 'status') {
      const embed = new EmbedBuilder()
        .setColor('#2f3136')
        .setTitle('📋 Give Log Settings')
        .addFields(
          { name: '📡 Log Channel', value: config.channelId ? `<#${config.channelId}>` : 'Not set', inline: true },
          { name: '🔔 Logging',     value: config.enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
        )
        .setFooter({ text: 'Use /givelogs setchannel and /givelogs toggle to configure.' });
      return interaction.editReply({ embeds: [embed] });
    }
  }
};
