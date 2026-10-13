// cogs/antinuke/handlers.js
// per-event listeners. wires Discord events → engine.handleEvent.

const { AuditLogEvent } = require("discord.js");
const { E, COLORS } = require("./constants");
const store = require("./store");
const tracker = require("./tracker");
const engine = require("./engine");
const raidmode = require("./raidmode");
const trust = require("./trust");
const schema = require("./schema");

/* ═══════════════════════════════════════════════════════════════
   SHORTHAND — fetch fresh audit entry, get executor id
   ═══════════════════════════════════════════════════════════════ */
async function auditExec(guild, type, cfg, targetId = null) {
  const retry = cfg?.settings?.auditRetry || { attempts: 3, delayMs: 500 };
  const entry = await engine.fetchAuditEntry(guild, type, {
    attempts: retry.attempts,
    delayMs: retry.delayMs,
    targetId,
  });
  return entry?.executorId || null;
}

/* ═══════════════════════════════════════════════════════════════
   CHANNEL EVENTS
   ═══════════════════════════════════════════════════════════════ */
async function onChannelCreate(channel) {
  if (!channel.guild) return;
  const cfg = await store.getSettings(channel.client.pool, channel.guild.id);
  if (!cfg.enabled) return;
  const exec = await auditExec(channel.guild, AuditLogEvent.ChannelCreate, cfg, channel.id);
  if (!exec) return;
  await engine.handleEvent(channel.client, channel.guild, "channelCreate", exec, {
    channelId: channel.id, channelName: channel.name,
  });
}

async function onChannelDelete(channel) {
  if (!channel.guild) return;
  const cfg = await store.getSettings(channel.client.pool, channel.guild.id);
  if (!cfg.enabled) return;
  const exec = await auditExec(channel.guild, AuditLogEvent.ChannelDelete, cfg, channel.id);
  if (!exec) return;
  await engine.handleEvent(channel.client, channel.guild, "channelDelete", exec, {
    channelId: channel.id, channelName: channel.name,
  });
}

async function onChannelUpdate(oldCh, newCh) {
  if (!newCh.guild) return;
  const cfg = await store.getSettings(newCh.client.pool, newCh.guild.id);
  if (!cfg.enabled) return;

  // ignore non-destructive updates (position/name changes handled separately)
  const destructive =
    oldCh.name !== newCh.name ||
    oldCh.parentId !== newCh.parentId ||
    oldCh.topic !== newCh.topic ||
    oldCh.nsfw !== newCh.nsfw ||
    oldCh.rateLimitPerUser !== newCh.rateLimitPerUser;

  if (!destructive) return;

  const exec = await auditExec(newCh.guild, AuditLogEvent.ChannelUpdate, cfg, newCh.id);
  if (!exec) return;
  await engine.handleEvent(newCh.client, newCh.guild, "channelUpdate", exec, {
    channelId: newCh.id, channelName: newCh.name,
  });
}

/* ═══════════════════════════════════════════════════════════════
   ROLE EVENTS
   ═══════════════════════════════════════════════════════════════ */
async function onRoleCreate(role) {
  const cfg = await store.getSettings(role.client.pool, role.guild.id);
  if (!cfg.enabled) return;
  const exec = await auditExec(role.guild, AuditLogEvent.RoleCreate, cfg, role.id);
  if (!exec) return;
  await engine.handleEvent(role.client, role.guild, "roleCreate", exec, {
    roleId: role.id, roleName: role.name,
  });
}

async function onRoleDelete(role) {
  const cfg = await store.getSettings(role.client.pool, role.guild.id);
  if (!cfg.enabled) return;
  const exec = await auditExec(role.guild, AuditLogEvent.RoleDelete, cfg, role.id);
  if (!exec) return;
  await engine.handleEvent(role.client, role.guild, "roleDelete", exec, {
    roleId: role.id, roleName: role.name,
  });
}

async function onRoleUpdate(oldRole, newRole) {
  const cfg = await store.getSettings(newRole.client.pool, newRole.guild.id);
  if (!cfg.enabled) return;

  // permission escalation check
  const permChange = engine.checkPermissionEscalation(
    oldRole.permissions.bitfield,
    newRole.permissions.bitfield
  );

  if (permChange) {
    const exec = await auditExec(newRole.guild, AuditLogEvent.RoleUpdate, cfg, newRole.id);
    if (exec) {
      await engine.handleEvent(newRole.client, newRole.guild, "permEscalation", exec, {
        roleId: newRole.id, roleName: newRole.name, perm: permChange,
      });
    }
    return;
  }

  const exec = await auditExec(newRole.guild, AuditLogEvent.RoleUpdate, cfg, newRole.id);
  if (!exec) return;
  await engine.handleEvent(newRole.client, newRole.guild, "roleUpdate", exec, {
    roleId: newRole.id, roleName: newRole.name,
  });
}

/* ═══════════════════════════════════════════════════════════════
   MEMBER EVENTS
   ═══════════════════════════════════════════════════════════════ */
async function onMemberAdd(member) {
  raidmode.recordJoin(member.guild.id);
  await raidmode.checkRaid(member.client, member.guild, "join").catch(() => {});
  await trust.checkIncomingAgainstNetwork(member.client, member).catch(() => {});
}

async function onMemberRemove(member) {
  const cfg = await store.getSettings(member.client.pool, member.guild.id);
  if (!cfg.enabled) return;
  const exec = await auditExec(member.guild, AuditLogEvent.MemberKick, cfg, member.id);
  if (!exec) return;
  await engine.handleEvent(member.client, member.guild, "kick", exec, {
    memberId: member.id, memberName: member.user?.username,
  });
}

async function onMemberUpdate(oldMember, newMember) {
  const cfg = await store.getSettings(newMember.client.pool, newMember.guild.id);
  if (!cfg.enabled) return;

  // role diff
  const addedRoles = newMember.roles.cache.filter((r) => !oldMember.roles.cache.has(r.id));
  const removedRoles = oldMember.roles.cache.filter((r) => !newMember.roles.cache.has(r.id));

  if (addedRoles.size === 0 && removedRoles.size === 0) return;

  const exec = await auditExec(newMember.guild, AuditLogEvent.MemberRoleUpdate, cfg, newMember.id);
  if (!exec) return;
  await engine.handleEvent(newMember.client, newMember.guild, "memberRoleUpdate", exec, {
    memberId: newMember.id,
    added: addedRoles.map((r) => r.name),
    removed: removedRoles.map((r) => r.name),
  });
}

async function onBanAdd(ban) {
  const cfg = await store.getSettings(ban.client.pool, ban.guild.id);
  if (!cfg.enabled) return;
  const exec = await auditExec(ban.guild, AuditLogEvent.MemberBanAdd, cfg, ban.user.id);
  if (!exec) return;
  await engine.handleEvent(ban.client, ban.guild, "banAdd", exec, {
    userId: ban.user.id, username: ban.user.username,
  });
}

/* ═══════════════════════════════════════════════════════════════
   EMOJI / STICKER
   ═══════════════════════════════════════════════════════════════ */
async function onEmojiCreate(emoji) {
  const cfg = await store.getSettings(emoji.client.pool, emoji.guild.id);
  if (!cfg.enabled) return;
  const exec = await auditExec(emoji.guild, AuditLogEvent.EmojiCreate, cfg, emoji.id);
  if (!exec) return;
  await engine.handleEvent(emoji.client, emoji.guild, "emojiCreate", exec, {
    emojiId: emoji.id, emojiName: emoji.name,
  });
}

async function onEmojiDelete(emoji) {
  const cfg = await store.getSettings(emoji.client.pool, emoji.guild.id);
  if (!cfg.enabled) return;
  const exec = await auditExec(emoji.guild, AuditLogEvent.EmojiDelete, cfg, emoji.id);
  if (!exec) return;
  await engine.handleEvent(emoji.client, emoji.guild, "emojiDelete", exec, {
    emojiId: emoji.id, emojiName: emoji.name,
  });
}

async function onStickerCreate(sticker) {
  if (!sticker.guild) return;
  const cfg = await store.getSettings(sticker.client.pool, sticker.guild.id);
  if (!cfg.enabled) return;
  const exec = await auditExec(sticker.guild, AuditLogEvent.StickerCreate, cfg, sticker.id);
  if (!exec) return;
  await engine.handleEvent(sticker.client, sticker.guild, "stickerCreate", exec, {
    stickerId: sticker.id, stickerName: sticker.name,
  });
}

async function onStickerDelete(sticker) {
  if (!sticker.guild) return;
  const cfg = await store.getSettings(sticker.client.pool, sticker.guild.id);
  if (!cfg.enabled) return;
  const exec = await auditExec(sticker.guild, AuditLogEvent.StickerDelete, cfg, sticker.id);
  if (!exec) return;
  await engine.handleEvent(sticker.client, sticker.guild, "stickerDelete", exec, {
    stickerId: sticker.id, stickerName: sticker.name,
  });
}

/* ═══════════════════════════════════════════════════════════════
   WEBHOOK
   ═══════════════════════════════════════════════════════════════ */
async function onWebhookUpdate(channel) {
  if (!channel.guild) return;
  const cfg = await store.getSettings(channel.client.pool, channel.guild.id);
  if (!cfg.enabled) return;
  const exec = await auditExec(channel.guild, AuditLogEvent.WebhookCreate, cfg);
  if (!exec) return;
  await engine.handleEvent(channel.client, channel.guild, "webhookCreate", exec, {
    channelId: channel.id,
  });
}

/* ═══════════════════════════════════════════════════════════════
   GUILD EVENTS
   ═══════════════════════════════════════════════════════════════ */
async function onGuildUpdate(oldGuild, newGuild) {
  const cfg = await store.getSettings(newGuild.client.pool, newGuild.id);
  if (!cfg.enabled) return;

  const destructive =
    oldGuild.name !== newGuild.name ||
    oldGuild.icon !== newGuild.icon ||
    oldGuild.banner !== newGuild.banner;

  if (!destructive) return;

  const exec = await auditExec(newGuild, AuditLogEvent.GuildUpdate, cfg);
  if (!exec) return;
  await engine.handleEvent(newGuild.client, newGuild, "guildUpdate", exec, {
    changes: {
      name: oldGuild.name !== newGuild.name,
      icon: oldGuild.icon !== newGuild.icon,
      banner: oldGuild.banner !== newGuild.banner,
    },
  });
}

/* ═══════════════════════════════════════════════════════════════
   INVITE
   ═══════════════════════════════════════════════════════════════ */
async function onInviteCreate(invite) {
  if (!invite.guild) return;
  raidmode.recordInvite(invite.guild.id);
  await raidmode.checkRaid(invite.client, invite.guild, "invite").catch(() => {});

  const cfg = await store.getSettings(invite.client.pool, invite.guild.id);
  if (!cfg.enabled) return;
  const exec = await auditExec(invite.guild, AuditLogEvent.InviteCreate, cfg, invite.code);
  if (!exec) return;
  await engine.handleEvent(invite.client, invite.guild, "inviteCreate", exec, {
    code: invite.code,
  });
}

async function onInviteDelete(invite) {
  if (!invite.guild) return;
  const cfg = await store.getSettings(invite.client.pool, invite.guild.id);
  if (!cfg.enabled) return;
  const exec = await auditExec(invite.guild, AuditLogEvent.InviteDelete, cfg, invite.code);
  if (!exec) return;
  await engine.handleEvent(invite.client, invite.guild, "inviteDelete", exec, {
    code: invite.code,
  });
}

/* ═══════════════════════════════════════════════════════════════
   THREAD
   ═══════════════════════════════════════════════════════════════ */
async function onThreadCreate(thread) {
  if (!thread.guild) return;
  const cfg = await store.getSettings(thread.client.pool, thread.guild.id);
  if (!cfg.enabled) return;
  const exec = await auditExec(thread.guild, AuditLogEvent.ThreadCreate, cfg, thread.id);
  if (!exec) return;
  await engine.handleEvent(thread.client, thread.guild, "threadCreate", exec, {
    threadId: thread.id, threadName: thread.name,
  });
}

async function onThreadDelete(thread) {
  if (!thread.guild) return;
  const cfg = await store.getSettings(thread.client.pool, thread.guild.id);
  if (!cfg.enabled) return;
  const exec = await auditExec(thread.guild, AuditLogEvent.ThreadDelete, cfg, thread.id);
  if (!exec) return;
  await engine.handleEvent(thread.client, thread.guild, "threadDelete", exec, {
    threadId: thread.id, threadName: thread.name,
  });
}

/* ═══════════════════════════════════════════════════════════════
   INSTALL — wire every listener onto client
   ═══════════════════════════════════════════════════════════════ */
function install(client) {
  // schema first
  schema.ensureTables(client.pool).catch((err) =>
    console.error("[antinuke] schema init failed:", err.message)
  );

  // tracker GC
  tracker.startGC();

  // raid mode expiry loop
  raidmode.startRaidLoop(client);

  // safe wrapper so one bad handler doesn't crash the process
  const wrap = (fn) => (...args) => fn(...args).catch((err) =>
    console.error(`[antinuke] ${fn.name} failed:`, err.message)
  );

  client.on("channelCreate",  wrap(onChannelCreate));
  client.on("channelDelete",  wrap(onChannelDelete));
  client.on("channelUpdate",  wrap(onChannelUpdate));
  client.on("roleCreate",     wrap(onRoleCreate));
  client.on("roleDelete",     wrap(onRoleDelete));
  client.on("roleUpdate",     wrap(onRoleUpdate));
  client.on("guildMemberAdd", wrap(onMemberAdd));
  client.on("guildMemberRemove", wrap(onMemberRemove));
  client.on("guildMemberUpdate", wrap(onMemberUpdate));
  client.on("guildBanAdd",    wrap(onBanAdd));
  client.on("emojiCreate",    wrap(onEmojiCreate));
  client.on("emojiDelete",    wrap(onEmojiDelete));
  client.on("stickerCreate",  wrap(onStickerCreate));
  client.on("stickerDelete",  wrap(onStickerDelete));
  client.on("webhooksUpdate", wrap(onWebhookUpdate));
  client.on("guildUpdate",    wrap(onGuildUpdate));
  client.on("inviteCreate",   wrap(onInviteCreate));
  client.on("inviteDelete",   wrap(onInviteDelete));
  client.on("threadCreate",   wrap(onThreadCreate));
  client.on("threadDelete",   wrap(onThreadDelete));

  console.log("[antinuke] handlers installed");
}

module.exports = { install };
