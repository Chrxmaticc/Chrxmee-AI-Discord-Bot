/* cogs/moderation/engine.js — the action executor */

const store = require('./store');
const modlog = require('./modlog');
const warns = require('./warns');

function replaceVars(str, vars) {
  return String(str || '').replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}

async function dmUser(user, template, vars) {
  if (!template) return;
  try { await user.send({ content: replaceVars(template, vars) }); } catch {}
}

/* ── warn ── */
async function warn(member, modId, reason) {
  const c = await warns.addWarn(member, modId, reason, member.client);
  const config = store.getConfig(member.guild.id);
  if (config.dmOnWarn) {
    await dmUser(member.user, config.dmWarn, {
      user: member.user.username,
      server: member.guild.name,
      reason: reason || 'no reason',
      case: c.id,
    });
  }
  await modlog.log(member.guild.id, {
    type: 'warn', caseId: c.id, targetId: member.id, modId, reason,
  }, member.client);
  return c;
}

/* ── timeout ── */
async function timeout(member, modId, duration, reason) {
  await member.timeout(duration, reason || 'no reason').catch(() => {});
  const c = store.createCase(member.guild.id, {
    type: 'timeout', targetId: member.id, modId, reason, duration,
  });
  const config = store.getConfig(member.guild.id);
  if (config.dmOnMute) {
    await dmUser(member.user, config.dmMute, {
      user: member.user.username,
      server: member.guild.name,
      reason: reason || 'no reason',
      duration: modlog.fmtDuration(duration),
      case: c.id,
    });
  }
  await modlog.log(member.guild.id, {
    type: 'timeout', caseId: c.id, targetId: member.id, modId, reason, duration,
  }, member.client);
  return c;
}

async function unmute(member, modId, reason) {
  await member.timeout(null, reason || 'no reason').catch(() => {});
  const c = store.createCase(member.guild.id, {
    type: 'unmute', targetId: member.id, modId, reason,
  });
  const config = store.getConfig(member.guild.id);
  if (config.dmOnUnmute) {
    await dmUser(member.user, config.dmUnmute, { server: member.guild.name });
  }
  await modlog.log(member.guild.id, {
    type: 'unmute', caseId: c.id, targetId: member.id, modId, reason,
  }, member.client);
  return c;
}

/* ── kick ── */
async function kick(member, modId, reason) {
  const c = store.createCase(member.guild.id, {
    type: 'kick', targetId: member.id, modId, reason,
  });
  const config = store.getConfig(member.guild.id);
  if (config.dmOnKick) {
    await dmUser(member.user, config.dmKick, {
      user: member.user.username,
      server: member.guild.name,
      reason: reason || 'no reason',
      case: c.id,
    });
  }
  await member.kick(reason || 'no reason').catch(() => {});
  await modlog.log(member.guild.id, {
    type: 'kick', caseId: c.id, targetId: member.id, modId, reason,
  }, member.client);
  return c;
}

/* ── ban (permanent or temp) ── */
async function ban(guild, userId, modId, reason, duration) {
  const type = duration ? 'tempban' : 'ban';
  const c = store.createCase(guild.id, {
    type, targetId: userId, modId, reason, duration,
  });
  const config = store.getConfig(guild.id);
  try {
    const user = await guild.client.users.fetch(userId).catch(() => null);
    if (user && config.dmOnBan) {
      await dmUser(user, config.dmBan, {
        user: user.username,
        server: guild.name,
        reason: reason || 'no reason',
        case: c.id,
      });
    }
    await guild.members.ban(userId, { reason: reason || 'no reason' });
  } catch {}
  await modlog.log(guild.id, {
    type, caseId: c.id, targetId: userId, modId, reason, duration,
  }, guild.client);
  return c;
}

async function unban(guild, userId, modId, reason) {
  const c = store.createCase(guild.id, {
    type: 'unban', targetId: userId, modId, reason,
  });
  const config = store.getConfig(guild.id);
  try {
    await guild.bans.remove(userId, reason || 'no reason');
    const user = await guild.client.users.fetch(userId).catch(() => null);
    if (user && config.dmOnUnban) await dmUser(user, config.dmUnban, { server: guild.name });
  } catch {}
  await modlog.log(guild.id, {
    type: 'unban', caseId: c.id, targetId: userId, modId, reason,
  }, guild.client);
  return c;
}

/* ── purge ── */
async function purge(channel, amount, modId, filter) {
  const fetched = await channel.messages.fetch({ limit: Math.min(100, amount) }).catch(() => null);
  if (!fetched) return { deleted: 0 };
  let toDelete = [...fetched.values()];
  if (filter?.user) toDelete = toDelete.filter(m => m.author.id === filter.user);
  if (filter?.contains) toDelete = toDelete.filter(m => m.content.toLowerCase().includes(filter.contains.toLowerCase()));
  const deleted = await channel.bulkDelete(toDelete, true).catch(() => null);
  const count = deleted?.size || 0;
  store.createCase(channel.guild.id, {
    type: 'purge', targetId: filter?.user || channel.id, modId,
    reason: `purged ${count} messages in #${channel.name}`,
  });
  return { deleted: count };
}

/* ── note ── */
function note(guild, userId, modId, note) {
  const entry = store.addNote(guild.id, userId, { modId, note });
  store.createCase(guild.id, {
    type: 'note', targetId: userId, modId, reason: note,
  });
  return entry;
}

module.exports = { warn, timeout, unmute, kick, ban, unban, purge, note };
