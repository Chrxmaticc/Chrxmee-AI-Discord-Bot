const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

// ── ACTION TRACKING ────────────────────────────────────────────────────────
// Tracks recent actions per user per guild: { userId: { action: [timestamps] } }
const actionTracker = new Map();

function trackAction(guildId, userId, action) {
  const key = `${guildId}_${userId}`;
  if (!actionTracker.has(key)) actionTracker.set(key, {});
  const userActions = actionTracker.get(key);
  if (!userActions[action]) userActions[action] = [];
  userActions[action].push(Date.now());
  actionTracker.set(key, userActions);
}

function getRecentActions(guildId, userId, action, windowMs) {
  const key = `${guildId}_${userId}`;
  const userActions = actionTracker.get(key);
  if (!userActions || !userActions[action]) return 0;
  const now = Date.now();
  userActions[action] = userActions[action].filter(t => now - t < windowMs);
  return userActions[action].length;
}

function clearActions(guildId, userId) {
  actionTracker.delete(`${guildId}_${userId}`);
}

// ── DEFAULT CONFIG ─────────────────────────────────────────────────────────
function getDefaultConfig() {
  return {
    enabled: false,
    logChannelId: null,
    punishment: 'ban', // ban, kick, mute
    bypass: [954709865698312213],        // whitelisted user IDs
    thresholds: {
      channelDelete:  { limit: 3, seconds: 10 },
      channelCreate:  { limit: 5, seconds: 10 },
      roleDelete:     { limit: 3, seconds: 10 },
      roleCreate:     { limit: 5, seconds: 10 },
      ban:            { limit: 3, seconds: 10 },
      kick:           { limit: 3, seconds: 10 },
      webhookCreate:  { limit: 2, seconds: 10 },
      botAdd:         { limit: 1, seconds: 10 },
      serverUpdate:   { limit: 2, seconds: 10 },
    }
  };
}

function getConfig(client, guildId) {
  const config = client.memory.get(`antinuke_${guildId}`);
  if (!config) return getDefaultConfig();
  // Merge with defaults to handle missing keys
  const def = getDefaultConfig();
  return {
    ...def,
    ...config,
    thresholds: { ...def.thresholds, ...(config.thresholds || {}) }
  };
}

// ── PUNISHMENT ─────────────────────────────────────────────────────────────
async function punish(guild, userId, punishment, reason) {
  try {
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return;
    if (punishment === 'ban') {
      await guild.members.ban(userId, { reason }).catch(() => {});
    } else if (punishment === 'kick') {
      await member.kick(reason).catch(() => {});
    } else if (punishment === 'mute') {
      const tenMinutes = 10 * 60 * 1000;
      await member.disableCommunicationUntil(Date.now() + tenMinutes, reason).catch(() => {});
    }
  } catch (err) {
    console.error('antinuke punish failed:', err.message);
  }
}

// ── ALERT ──────────────────────────────────────────────────────────────────
async function sendAlert(guild, client, config, perpetrator, action, punishment) {
  const embed = new EmbedBuilder()
    .setColor('#ff0000')
    .setTitle('🚨 ANTINUKE TRIGGERED')
    .addFields(
      { name: '⚠️ Action',      value: action,                                         inline: true },
      { name: '👤 Perpetrator', value: `<@${perpetrator.id}> (${perpetrator.tag})`,    inline: true },
      { name: '🔨 Punishment',  value: punishment.toUpperCase(),                       inline: true },
      { name: '🕐 Time',        value: new Date().toUTCString(),                       inline: false }
    );

  // Send to log channel
  if (config.logChannelId) {
    const logChannel = await client.channels.fetch(config.logChannelId).catch(() => null);
    if (logChannel) await logChannel.send({ embeds: [embed] }).catch(() => {});
  }

  // DM server owner
  try {
    const owner = await guild.fetchOwner().catch(() => null);
    if (owner) await owner.send({ embeds: [embed] }).catch(() => {});
  } catch (err) { console.error('antinuke DM failed:', err.message); }
}

// ── ANTINUKE CHECK ─────────────────────────────────────────────────────────
async function antinukeCheck(guild, client, userId, action) {
  const config = getConfig(client, guild.id);
  if (!config.enabled) return;

  // Exempt: owner, admins, bypass list
  if (userId === guild.ownerId) return;
  if (config.bypass.includes(userId)) return;

  const member = await guild.members.fetch(userId).catch(() => null);
  if (member && member.permissions.has(PermissionFlagsBits.Administrator)) return;

  const threshold = config.thresholds[action];
  if (!threshold) return;

  trackAction(guild.id, userId, action);
  const count = getRecentActions(guild.id, userId, action, threshold.seconds * 1000);

  if (count >= threshold.limit) {
    clearActions(guild.id, userId);
    const perpetrator = await client.users.fetch(userId).catch(() => ({ id: userId, tag: 'Unknown' }));
    const actionLabel = `${action} (${count}x in ${threshold.seconds}s)`;
    await punish(guild, userId, config.punishment, `Antinuke: ${actionLabel}`);
    await sendAlert(guild, client, config, perpetrator, actionLabel, config.punishment);
  }
}

// ── EXPORT ANTINUKE CHECK FOR EVENTS ──────────────────────────────────────
module.exports.antinukeCheck = antinukeCheck;

// ── SLASH COMMAND ──────────────────────────────────────────────────────────
module.exports.data = new SlashCommandBuilder()
  .setName('antinuke')
  .setDescription('Configure antinuke protection for your server')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(sub =>
    sub.setName('enable').setDescription('Enable antinuke protection')
  )
  .addSubcommand(sub =>
    sub.setName('disable').setDescription('Disable antinuke protection')
  )
  .addSubcommand(sub =>
    sub.setName('status').setDescription('View current antinuke settings')
  )
  .addSubcommand(sub =>
    sub.setName('logs')
      .setDescription('Set the antinuke alert log channel')
      .addChannelOption(opt => opt.setName('channel').setDescription('Log channel').setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName('action')
      .setDescription('Set punishment for nuke attempts')
      .addStringOption(opt =>
        opt.setName('punishment').setDescription('What to do to the perpetrator').setRequired(true)
          .addChoices(
            { name: '🔨 Ban', value: 'ban' },
            { name: '👢 Kick', value: 'kick' },
            { name: '🔇 Mute (10 minutes)', value: 'mute' }
          )
      )
  )
  .addSubcommand(sub =>
    sub.setName('bypass')
      .setDescription('Add or remove a user from the antinuke whitelist')
      .addStringOption(opt =>
        opt.setName('action').setDescription('Add or remove').setRequired(true)
          .addChoices({ name: 'Add', value: 'add' }, { name: 'Remove', value: 'remove' })
      )
      .addUserOption(opt => opt.setName('user').setDescription('User to whitelist').setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName('threshold')
      .setDescription('Set custom action limits before antinuke fires')
      .addStringOption(opt =>
        opt.setName('action').setDescription('Which action to configure').setRequired(true)
          .addChoices(
            { name: 'Channel Delete', value: 'channelDelete' },
            { name: 'Channel Create', value: 'channelCreate' },
            { name: 'Role Delete',    value: 'roleDelete'    },
            { name: 'Role Create',    value: 'roleCreate'    },
            { name: 'Ban',            value: 'ban'           },
            { name: 'Kick',           value: 'kick'          },
            { name: 'Webhook Create', value: 'webhookCreate' },
            { name: 'Bot Added',      value: 'botAdd'        },
            { name: 'Server Update',  value: 'serverUpdate'  }
          )
      )
      .addIntegerOption(opt => opt.setName('limit').setDescription('How many actions before triggering').setRequired(true).setMinValue(1).setMaxValue(20))
      .addIntegerOption(opt => opt.setName('seconds').setDescription('Within how many seconds').setRequired(true).setMinValue(5).setMaxValue(60))
  );

module.exports.execute = async function(interaction, client) {
  try { await interaction.deferReply({ ephemeral: true }); }
  catch (err) { return interaction.reply({ content: 'Failed.', ephemeral: true }).catch(() => {}); }

  const guildId = interaction.guild.id;
  const userId = interaction.user.id;

  // Only owner can configure antinuke
  if (userId !== interaction.guild.ownerId) {
    return interaction.editReply('❌ Only the server owner can configure antinuke!');
  }

  const config = getConfig(client, guildId);
  const sub = interaction.options.getSubcommand();

  // ── ENABLE ─────────────────────────────────────────────
  if (sub === 'enable') {
    config.enabled = true;
    client.memory.set(`antinuke_${guildId}`, config);
    return interaction.editReply('✅ Antinuke **enabled**! Your server is now protected.');
  }

  // ── DISABLE ────────────────────────────────────────────
  if (sub === 'disable') {
    config.enabled = false;
    client.memory.set(`antinuke_${guildId}`, config);
    return interaction.editReply('❌ Antinuke **disabled**.');
  }

  // ── LOGS ───────────────────────────────────────────────
  if (sub === 'logs') {
    const channel = interaction.options.getChannel('channel');
    config.logChannelId = channel.id;
    client.memory.set(`antinuke_${guildId}`, config);
    return interaction.editReply(`✅ Antinuke alerts will be sent to <#${channel.id}>!`);
  }

  // ── ACTION ─────────────────────────────────────────────
  if (sub === 'action') {
    const punishment = interaction.options.getString('punishment');
    config.punishment = punishment;
    client.memory.set(`antinuke_${guildId}`, config);
    return interaction.editReply(`✅ Punishment set to **${punishment.toUpperCase()}**!`);
  }

  // ── BYPASS ─────────────────────────────────────────────
  if (sub === 'bypass') {
    const action = interaction.options.getString('action');
    const target = interaction.options.getUser('user');
    if (action === 'add') {
      if (config.bypass.includes(target.id)) return interaction.editReply(`❌ **${target.username}** is already whitelisted!`);
      config.bypass.push(target.id);
      client.memory.set(`antinuke_${guildId}`, config);
      return interaction.editReply(`✅ **${target.username}** added to antinuke whitelist! They are now immune.`);
    } else {
      if (!config.bypass.includes(target.id)) return interaction.editReply(`❌ **${target.username}** is not on the whitelist!`);
      config.bypass = config.bypass.filter(id => id !== target.id);
      client.memory.set(`antinuke_${guildId}`, config);
      return interaction.editReply(`✅ **${target.username}** removed from antinuke whitelist.`);
    }
  }

  // ── THRESHOLD ──────────────────────────────────────────
  if (sub === 'threshold') {
    const action = interaction.options.getString('action');
    const limit = interaction.options.getInteger('limit');
    const seconds = interaction.options.getInteger('seconds');
    config.thresholds[action] = { limit, seconds };
    client.memory.set(`antinuke_${guildId}`, config);
    const actionNames = {
      channelDelete: 'Channel Delete', channelCreate: 'Channel Create',
      roleDelete: 'Role Delete', roleCreate: 'Role Create',
      ban: 'Ban', kick: 'Kick', webhookCreate: 'Webhook Create',
      botAdd: 'Bot Added', serverUpdate: 'Server Update'
    };
    return interaction.editReply(`✅ **${actionNames[action]}** threshold set to **${limit} actions in ${seconds} seconds**.`);
  }

  // ── STATUS ─────────────────────────────────────────────
  if (sub === 'status') {
    const thresholdLines = Object.entries(config.thresholds).map(([action, t]) => {
      const names = {
        channelDelete: 'Channel Delete', channelCreate: 'Channel Create',
        roleDelete: 'Role Delete', roleCreate: 'Role Create',
        ban: 'Ban', kick: 'Kick', webhookCreate: 'Webhook Create',
        botAdd: 'Bot Added', serverUpdate: 'Server Update'
      };
      return `${names[action] || action}: **${t.limit}x** in **${t.seconds}s**`;
    }).join('\n');

    const bypassLines = config.bypass.length > 0
      ? config.bypass.map(id => `<@${id}>`).join(', ')
      : 'None';

    const embed = new EmbedBuilder()
      .setColor(config.enabled ? '#00ff00' : '#ff0000')
      .setTitle('🛡️ Antinuke Status')
      .addFields(
        { name: '🔒 Status',      value: config.enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
        { name: '🔨 Punishment',  value: config.punishment.toUpperCase(),               inline: true },
        { name: '📋 Log Channel', value: config.logChannelId ? `<#${config.logChannelId}>` : 'Not set', inline: true },
        { name: '🛡️ Whitelist',   value: bypassLines,                                  inline: false },
        { name: '⚙️ Thresholds',  value: thresholdLines,                               inline: false }
      );

    return interaction.editReply({ embeds: [embed] });
  }
};
