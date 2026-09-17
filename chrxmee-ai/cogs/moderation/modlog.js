/* cogs/moderation/modlog.js — modlog dispatch */

const { ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const store = require('./store');
const { CASE_BY_ID } = require('./constants');

const E = {
  success:  "<:Verified_Icon:1527194184841167010>",
  error:    "<:no:1530373946795364362>",
  lock:     "<:lock:1530377198324945056>",
  unlock:   "<:unlock:1530377714995826831>",
  kick:     "<:Personkick:1530376715698704574>",
  ban:      "<:hammer:1530375976381448303>",
  file:     "<:File_Icon:1526542046213570681>",
  folder:   "<:Folder_Icon:1526542112806539274>",
  warn:     "<:angry_cry:1526029511882440744>",
  on:       "<:on:1545571641684135946>",
  off:      "<:off:1545571608897265726>",
};

function fmtDuration(ms) {
  if (!ms) return 'permanent';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  return parts.join(' ') || `${s}s`;
}

function pickChannel(config, type) {
  switch (type) {
    case 'ban': case 'tempban': case 'softban': case 'unban': return config.logBans || config.logChannel;
    case 'kick':                                                return config.logKicks || config.logChannel;
    case 'timeout': case 'mute': case 'unmute':                 return config.logMutes || config.logChannel;
    case 'warn': case 'unwarn':                                 return config.logWarns || config.logChannel;
    case 'note':                                                return config.logNotes || config.logChannel;
    case 'purge':                                               return config.logDeletes || config.logChannel;
    default:                                                    return config.logChannel;
  }
}

async function log(guildId, payload, client) {
  const config = store.getConfig(guildId);
  const chId = pickChannel(config, payload.type);
  if (!chId) return;
  const ch = client.channels.cache.get(chId);
  if (!ch) return;

  const info = CASE_BY_ID[payload.type] || {};
  const icon = E[info.emoji] || E.file;

  const c = new ContainerBuilder().setAccentColor(info.color || 0x5b7fd4);
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`${icon} **${info.label || payload.type}** · \`${payload.caseId || 'n/a'}\``));
  const lines = [];
  if (payload.targetId) lines.push(`**target:** <@${payload.targetId}> · \`${payload.targetId}\``);
  if (payload.modId)    lines.push(`**mod:** ${payload.modId === 'auto-escalation' ? '🤖 auto-escalation' : `<@${payload.modId}>`}`);
  if (payload.duration) lines.push(`**duration:** \`${fmtDuration(payload.duration)}\``);
  if (payload.reason)   lines.push(`**reason:** ${payload.reason}`);
  if (payload.extra)    lines.push(payload.extra);
  if (lines.length) c.addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')));
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# <t:${Math.floor(Date.now() / 1000)}:F>`));

  await ch.send({ components: [c], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
}

async function logRaw(guildId, channelKey, payload, client) {
  const config = store.getConfig(guildId);
  const chId = config[channelKey] || config.logChannel;
  if (!chId) return;
  const ch = client.channels.cache.get(chId);
  if (!ch) return;
  const c = new ContainerBuilder().setAccentColor(payload.color || 0x5b7fd4);
  if (payload.title) c.addTextDisplayComponents(new TextDisplayBuilder().setContent(payload.title));
  if (payload.body) c.addTextDisplayComponents(new TextDisplayBuilder().setContent(payload.body));
  await ch.send({ components: [c], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
}

module.exports = { log, logRaw, fmtDuration };
