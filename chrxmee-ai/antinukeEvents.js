// antinukeEvents.js
// Add this to your index.js or as a separate setup function called in clientReady
// Call: setupAntinukeEvents(client);

const { antinukeCheck } = require('./commands/antinuke');

// Users exempt from all antinuke checks
const WHITELISTED_USERS = ['1368363914856890409', '902685494247325776','954709865698312213'];

function setupAntinukeEvents(client) {

  // ── CHANNEL DELETE ──────────────────────────────────────
  client.on('channelDelete', async channel => {
    if (!channel.guild) return;
    const logs = await channel.guild.fetchAuditLogs({ type: 12, limit: 1 }).catch(() => null);
    const entry = logs?.entries?.first();
    if (!entry || Date.now() - entry.createdTimestamp > 5000) return;
    if (WHITELISTED_USERS.includes(entry.executor.id)) return;
    await antinukeCheck(channel.guild, client, entry.executor.id, 'channelDelete');
  });

  // ── CHANNEL CREATE ──────────────────────────────────────
  client.on('channelCreate', async channel => {
    if (!channel.guild) return;
    const logs = await channel.guild.fetchAuditLogs({ type: 10, limit: 1 }).catch(() => null);
    const entry = logs?.entries?.first();
    if (!entry || Date.now() - entry.createdTimestamp > 5000) return;
    if (WHITELISTED_USERS.includes(entry.executor.id)) return;
    await antinukeCheck(channel.guild, client, entry.executor.id, 'channelCreate');
  });

  // ── ROLE DELETE ─────────────────────────────────────────
  client.on('roleDelete', async role => {
    const logs = await role.guild.fetchAuditLogs({ type: 32, limit: 1 }).catch(() => null);
    const entry = logs?.entries?.first();
    if (!entry || Date.now() - entry.createdTimestamp > 5000) return;
    if (WHITELISTED_USERS.includes(entry.executor.id)) return;
    await antinukeCheck(role.guild, client, entry.executor.id, 'roleDelete');
  });

  // ── ROLE CREATE ─────────────────────────────────────────
  client.on('roleCreate', async role => {
    const logs = await role.guild.fetchAuditLogs({ type: 30, limit: 1 }).catch(() => null);
    const entry = logs?.entries?.first();
    if (!entry || Date.now() - entry.createdTimestamp > 5000) return;
    if (WHITELISTED_USERS.includes(entry.executor.id)) return;
    await antinukeCheck(role.guild, client, entry.executor.id, 'roleCreate');
  });

  // ── BAN ─────────────────────────────────────────────────
  client.on('guildBanAdd', async ban => {
    const logs = await ban.guild.fetchAuditLogs({ type: 22, limit: 1 }).catch(() => null);
    const entry = logs?.entries?.first();
    if (!entry || Date.now() - entry.createdTimestamp > 5000) return;
    if (WHITELISTED_USERS.includes(entry.executor.id)) return;
    await antinukeCheck(ban.guild, client, entry.executor.id, 'ban');
  });

  // ── KICK ────────────────────────────────────────────────
  client.on('guildMemberRemove', async member => {
    const logs = await member.guild.fetchAuditLogs({ type: 20, limit: 1 }).catch(() => null);
    const entry = logs?.entries?.first();
    if (!entry || Date.now() - entry.createdTimestamp > 5000) return;
    if (entry.target.id !== member.id) return;
    if (WHITELISTED_USERS.includes(entry.executor.id)) return;
    await antinukeCheck(member.guild, client, entry.executor.id, 'kick');
  });

  // ── WEBHOOK CREATE ──────────────────────────────────────
  client.on('webhookUpdate', async channel => {
    if (!channel.guild) return;
    const logs = await channel.guild.fetchAuditLogs({ type: 50, limit: 1 }).catch(() => null);
    const entry = logs?.entries?.first();
    if (!entry || Date.now() - entry.createdTimestamp > 5000) return;
    if (WHITELISTED_USERS.includes(entry.executor.id)) return;
    await antinukeCheck(channel.guild, client, entry.executor.id, 'webhookCreate');
  });

  // ── BOT ADDED ───────────────────────────────────────────
  client.on('guildMemberAdd', async member => {
    if (!member.user.bot) return;
    const logs = await member.guild.fetchAuditLogs({ type: 28, limit: 1 }).catch(() => null);
    const entry = logs?.entries?.first();
    if (!entry || Date.now() - entry.createdTimestamp > 5000) return;
    if (WHITELISTED_USERS.includes(entry.executor.id)) return;
    await antinukeCheck(member.guild, client, entry.executor.id, 'botAdd');
  });

  // ── SERVER UPDATE (name/icon) ───────────────────────────
  client.on('guildUpdate', async (oldGuild, newGuild) => {
    if (oldGuild.name === newGuild.name && oldGuild.icon === newGuild.icon) return;
    const logs = await newGuild.fetchAuditLogs({ type: 1, limit: 1 }).catch(() => null);
    const entry = logs?.entries?.first();
    if (!entry || Date.now() - entry.createdTimestamp > 5000) return;
    if (WHITELISTED_USERS.includes(entry.executor.id)) return;
    await antinukeCheck(newGuild, client, entry.executor.id, 'serverUpdate');
  });

  console.log('Antinuke events registered!');
}

module.exports = { setupAntinukeEvents };
