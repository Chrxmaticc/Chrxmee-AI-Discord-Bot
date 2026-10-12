// cogs/backup/engine.js
const { ChannelType } = require("discord.js");
const { CONFIG } = require("./constants");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchBuffer(url) {
  const res = await fetch(url, { headers: { "User-Agent": "chromed-backup" } });
  if (!res.ok) throw new Error(`fetch ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/* ═══════════════════════════════════════════════════════════════
   CAPTURE (same as before)
   ═══════════════════════════════════════════════════════════════ */
async function captureGuild(guild, progress = () => {}, { panic = false } = {}) {
  progress("fetching roles");
  const roles = await guild.roles.fetch();
  const roleData = [...roles.values()]
    .filter((r) => !r.managed)
    .sort((a, b) => b.position - a.position)
    .map((r) => ({
      name: r.name, color: r.color, hoist: r.hoist, mentionable: r.mentionable,
      permissions: r.permissions.bitfield.toString(), position: r.position,
      icon: r.iconURL({ size: 256 }) || null,
      unicodeEmoji: r.unicodeEmoji || null,
      isEveryone: r.id === guild.id,
    }));

  progress("fetching channels");
  const channels = await guild.channels.fetch();
  const channelData = [...channels.values()]
    .filter(Boolean)
    .sort((a, b) => a.rawPosition - b.rawPosition)
    .map((c) => ({
      name: c.name, type: c.type, position: c.rawPosition,
      parentName: c.parent?.name || null,
      topic: c.topic || null, nsfw: c.nsfw || false,
      rateLimitPerUser: c.rateLimitPerUser || 0,
      bitrate: c.bitrate || null, userLimit: c.userLimit || null,
      availableTags: c.availableTags?.map((t) => ({ name: t.name, emoji: t.emoji })) || null,
      defaultReactionEmoji: c.defaultReactionEmoji || null,
      defaultSortOrder: c.defaultSortOrder || null,
      defaultForumLayout: c.defaultForumLayout || null,
      overwrites: [...c.permissionOverwrites.cache.values()].map((o) => ({
        targetType: o.type,
        targetName: o.type === 0 ? (guild.roles.cache.get(o.id)?.name || null) : null,
        isEveryone: o.type === 0 && o.id === guild.id,
        allow: o.allow.bitfield.toString(),
        deny: o.deny.bitfield.toString(),
      })),
      isThread: [ChannelType.PublicThread, ChannelType.PrivateThread, ChannelType.AnnouncementThread].includes(c.type),
    }));

  progress("fetching emojis");
  const emojis = await guild.emojis.fetch();
  const emojiData = [...emojis.values()].map((e) => ({
    name: e.name, url: e.imageURL({ size: 128, extension: "png" }), animated: e.animated,
  }));

  progress("fetching stickers");
  let stickerData = [];
  try {
    const stickers = await guild.stickers.fetch();
    stickerData = [...stickers.values()].map((s) => ({
      name: s.name, description: s.description, tags: s.tags, url: s.url,
    }));
  } catch {}

  progress("fetching bans");
  let banData = [];
  if (!panic) {
    try {
      const bans = await guild.bans.fetch({ limit: 1000 });
      banData = [...bans.values()].map((b) => ({ userId: b.user.id, reason: b.reason || null }));
    } catch {}
  }

  progress("fetching server meta");
  const meta = {
    name: guild.name,
    iconURL: guild.iconURL({ size: 1024 }) || null,
    bannerURL: guild.bannerURL({ size: 1024 }) || null,
    splashURL: guild.splashURL({ size: 1024 }) || null,
    description: guild.description || null,
    verificationLevel: guild.verificationLevel,
    defaultMessageNotifications: guild.defaultMessageNotifications,
    explicitContentFilter: guild.explicitContentFilter,
    preferredLocale: guild.preferredLocale,
    afkTimeout: guild.afkTimeout,
    afkChannelName: guild.afkChannel?.name || null,
    systemChannelName: guild.systemChannel?.name || null,
    rulesChannelName: guild.rulesChannel?.name || null,
    publicUpdatesChannelName: guild.publicUpdatesChannel?.name || null,
  };

  return {
    version: CONFIG.payloadVersion,
    capturedAt: Date.now(),
    guildId: guild.id, guildName: guild.name,
    meta, roles: roleData, channels: channelData,
    emojis: emojiData, stickers: stickerData, bans: banData,
  };
}

/* ═══════════════════════════════════════════════════════════════
   DIFF
   ═══════════════════════════════════════════════════════════════ */
function diffSnapshots(a, b) {
  const byName = (arr, fn) => new Map(arr.map((x) => [fn(x), x]));
  const rolesA = byName(a.roles, (r) => r.name);
  const rolesB = byName(b.roles, (r) => r.name);
  const channelsA = byName(a.channels, (c) => `${c.type}:${c.name}`);
  const channelsB = byName(b.channels, (c) => `${c.type}:${c.name}`);
  const emojisA = byName(a.emojis, (e) => e.name);
  const emojisB = byName(b.emojis, (e) => e.name);

  const diffSet = (A, B) => ({
    added:   [...B.keys()].filter((k) => !A.has(k)),
    removed: [...A.keys()].filter((k) => !B.has(k)),
  });

  return {
    roles:    diffSet(rolesA, rolesB),
    channels: diffSet(channelsA, channelsB),
    emojis:   diffSet(emojisA, emojisB),
    metaName: a.meta.name !== b.meta.name ? { from: a.meta.name, to: b.meta.name } : null,
  };
}

/* ═══════════════════════════════════════════════════════════════
   RESTORE — with partial, dry-run, error collection
   ═══════════════════════════════════════════════════════════════ */
async function restoreGuild(guild, backup, opts = {}) {
  const { progress = () => {}, dryRun = false, only = null, skip = null } = opts;
  const errors = [];
  const summary = {
    roles: 0, channels: 0, emojis: 0, stickers: 0, bans: 0,
    meta: 0, icon: 0, banner: 0, splash: 0, skipped: 0,
    wouldDelete: { channels: 0, roles: 0, emojis: 0, stickers: 0 },
  };

  const included = (section) => {
    if (only && !only.has(section)) return false;
    if (skip && skip.has(section)) return false;
    return true;
  };

  if (dryRun) {
    const chs = await guild.channels.fetch();
    const rs = await guild.roles.fetch();
    const es = await guild.emojis.fetch();
    summary.wouldDelete.channels = [...chs.values()].filter(Boolean).length;
    summary.wouldDelete.roles = [...rs.values()].filter((r) => !r.managed && r.id !== guild.id).length;
    summary.wouldDelete.emojis = [...es.values()].length;
    try {
      const ss = await guild.stickers.fetch();
      summary.wouldDelete.stickers = [...ss.values()].length;
    } catch {}
    return { summary, errors };
  }

  /* ── WIPE ── */
  if (included("channels")) {
    progress("wiping channels");
    const existing = await guild.channels.fetch();
    const sorted = [...existing.values()].filter(Boolean).sort((a, b) => b.rawPosition - a.rawPosition);
    for (const c of sorted) {
      try { await c.delete("chromed restore"); await sleep(CONFIG.restoreOpDelayMs); }
      catch (err) { errors.push({ step: `delete channel ${c.name}`, error: err.message }); summary.skipped++; }
    }
  }

  if (included("roles")) {
    progress("wiping roles");
    const roles = await guild.roles.fetch();
    const deletable = [...roles.values()]
      .filter((r) => !r.managed && r.id !== guild.id)
      .sort((a, b) => b.position - a.position);
    for (const r of deletable) {
      try { await r.delete("chromed restore"); await sleep(250); }
      catch (err) { errors.push({ step: `delete role ${r.name}`, error: err.message }); summary.skipped++; }
    }
  }

  if (included("emojis")) {
    progress("wiping emojis");
    const emojis = await guild.emojis.fetch();
    for (const e of emojis.values()) {
      try { await e.delete("chromed restore"); await sleep(200); }
      catch (err) { errors.push({ step: `delete emoji ${e.name}`, error: err.message }); summary.skipped++; }
    }
  }

  if (included("stickers")) {
    progress("wiping stickers");
    try {
      const stickers = await guild.stickers.fetch();
      for (const s of stickers.values()) {
        try { await s.delete("chromed restore"); await sleep(200); }
        catch (err) { errors.push({ step: `delete sticker ${s.name}`, error: err.message }); summary.skipped++; }
      }
    } catch {}
  }

  /* ── @everyone ── */
  if (included("roles")) {
    progress("restoring @everyone");
    const everyoneSnap = backup.roles.find((r) => r.isEveryone);
    if (everyoneSnap) {
      try {
        await guild.roles.everyone.setPermissions(BigInt(everyoneSnap.permissions), "chromed restore");
      } catch (err) { errors.push({ step: "@everyone perms", error: err.message }); summary.skipped++; }
    }

    progress(`restoring ${backup.roles.length} roles`);
    const roleIdMap = new Map();
    const roleOrder = [...backup.roles].filter((r) => !r.isEveryone).sort((a, b) => a.position - b.position);
    for (const r of roleOrder) {
      try {
        const created = await guild.roles.create({
          name: r.name, color: r.color, hoist: r.hoist, mentionable: r.mentionable,
          permissions: BigInt(r.permissions), reason: "chromed restore",
        });
        roleIdMap.set(r.name, created);
        summary.roles++;
        await sleep(250);
      } catch (err) {
        errors.push({ step: `create role ${r.name}`, error: err.message });
        summary.skipped++;
      }
    }

    progress("positioning roles");
    const rolePositionPayload = [];
    for (const r of backup.roles) {
      if (r.isEveryone) continue;
      const role = roleIdMap.get(r.name);
      if (role) rolePositionPayload.push({ role: role.id, position: r.position });
    }
    if (rolePositionPayload.length) {
      try { await guild.roles.setPositions(rolePositionPayload); }
      catch (err) { errors.push({ step: "position roles", error: err.message }); summary.skipped++; }
    }

    /* ── CATEGORIES ── */
    progress("restoring categories");
    const channelIdMap = new Map();
    const cats = backup.channels.filter((c) => c.type === ChannelType.GuildCategory);
    for (const c of cats) {
      try {
        const created = await guild.channels.create({
          name: c.name, type: ChannelType.GuildCategory,
          position: c.position,
          permissionOverwrites: buildOverwrites(c.overwrites, roleIdMap, guild.id),
          reason: "chromed restore",
        });
        channelIdMap.set(c.name, created);
        summary.channels++;
        await sleep(CONFIG.restoreOpDelayMs);
      } catch (err) { errors.push({ step: `create category ${c.name}`, error: err.message }); summary.skipped++; }
    }

    progress("restoring channels");
    const nonCats = backup.channels
      .filter((c) => c.type !== ChannelType.GuildCategory && !c.isThread)
      .sort((a, b) => a.position - b.position);

    for (const c of nonCats) {
      try {
        const parent = c.parentName ? channelIdMap.get(c.parentName) : null;
        const opts = {
          name: c.name, type: c.type, parent: parent?.id || null,
          permissionOverwrites: buildOverwrites(c.overwrites, roleIdMap, guild.id),
          reason: "chromed restore",
        };
        if (c.topic) opts.topic = c.topic.slice(0, 1024);
        if (c.nsfw) opts.nsfw = c.nsfw;
        if (typeof c.rateLimitPerUser === "number") opts.rateLimitPerUser = c.rateLimitPerUser;
        if (c.type === ChannelType.GuildVoice || c.type === ChannelType.GuildStageVoice) {
          if (c.bitrate) opts.bitrate = c.bitrate;
          if (c.userLimit) opts.userLimit = c.userLimit;
        }
        if (c.type === ChannelType.GuildForum) {
          if (c.availableTags) opts.availableTags = c.availableTags.map((t) => ({ name: t.name.slice(0, 20), emoji: t.emoji }));
          if (c.defaultReactionEmoji) opts.defaultReactionEmoji = c.defaultReactionEmoji;
          if (c.defaultSortOrder) opts.defaultSortOrder = c.defaultSortOrder;
          if (c.defaultForumLayout) opts.defaultForumLayout = c.defaultForumLayout;
        }
        const created = await guild.channels.create(opts);
        channelIdMap.set(c.name, created);
        summary.channels++;
        await sleep(CONFIG.restoreOpDelayMs);
      } catch (err) { errors.push({ step: `create channel ${c.name}`, error: err.message }); summary.skipped++; }
    }

    /* ── meta channels ── */
    if (included("meta")) {
      progress("restoring server settings");
      const m = backup.meta;
      const metaUpdate = {};
      if (m.name) metaUpdate.name = m.name;
      if (m.verificationLevel !== undefined) metaUpdate.verificationLevel = m.verificationLevel;
      if (m.defaultMessageNotifications !== undefined) metaUpdate.defaultMessageNotifications = m.defaultMessageNotifications;
      if (m.explicitContentFilter !== undefined) metaUpdate.explicitContentFilter = m.explicitContentFilter;
      if (m.preferredLocale) metaUpdate.preferredLocale = m.preferredLocale;
      if (m.afkTimeout) metaUpdate.afkTimeout = m.afkTimeout;
      if (m.afkChannelName && channelIdMap.has(m.afkChannelName)) metaUpdate.afkChannel = channelIdMap.get(m.afkChannelName).id;
      if (m.systemChannelName && channelIdMap.has(m.systemChannelName)) metaUpdate.systemChannel = channelIdMap.get(m.systemChannelName).id;
      if (m.rulesChannelName && channelIdMap.has(m.rulesChannelName)) metaUpdate.rulesChannel = channelIdMap.get(m.rulesChannelName).id;
      if (m.publicUpdatesChannelName && channelIdMap.has(m.publicUpdatesChannelName)) metaUpdate.publicUpdatesChannel = channelIdMap.get(m.publicUpdatesChannelName).id;
      if (Object.keys(metaUpdate).length) {
        try { await guild.edit(metaUpdate); summary.meta++; }
        catch (err) { errors.push({ step: "edit guild meta", error: err.message }); summary.skipped++; }
      }
    }
  }

  /* ── EMOJIS ── */
  if (included("emojis")) {
    progress(`restoring ${backup.emojis.length} emojis`);
    for (const e of backup.emojis) {
      try {
        await guild.emojis.create({ attachment: e.url, name: e.name, reason: "chromed restore" });
        summary.emojis++;
        await sleep(CONFIG.emojiOpDelayMs);
      } catch (err) { errors.push({ step: `create emoji ${e.name}`, error: err.message }); summary.skipped++; }
    }
  }

  /* ── STICKERS ── */
  if (included("stickers")) {
    progress("restoring stickers");
    for (const s of backup.stickers) {
      try {
        await guild.stickers.create({
          file: s.url, name: s.name, description: s.description || "",
          tags: s.tags || "", reason: "chromed restore",
        });
        summary.stickers++;
        await sleep(CONFIG.emojiOpDelayMs);
      } catch (err) { errors.push({ step: `create sticker ${s.name}`, error: err.message }); summary.skipped++; }
    }
  }

  /* ── BANS ── */
  if (included("bans")) {
    progress("restoring bans");
    for (const b of backup.bans) {
      try {
        await guild.bans.create(b.userId, { reason: b.reason || "chromed restore" });
        summary.bans++;
        await sleep(200);
      } catch (err) { errors.push({ step: `ban ${b.userId}`, error: err.message }); summary.skipped++; }
    }
  }

  /* ── IMAGES (icon/banner/splash) — always if included ── */
  if (included("images")) {
    progress("restoring icon");
    if (backup.meta.iconURL) {
      try { await guild.setIcon(await fetchBuffer(backup.meta.iconURL), "chromed restore"); summary.icon++; }
      catch (err) { errors.push({ step: "icon", error: err.message }); summary.skipped++; }
    }
    progress("restoring banner");
    if (backup.meta.bannerURL) {
      try { await guild.setBanner(await fetchBuffer(backup.meta.bannerURL), "chromed restore"); summary.banner++; }
      catch (err) { errors.push({ step: "banner", error: err.message }); summary.skipped++; }
    }
    progress("restoring splash");
    if (backup.meta.splashURL) {
      try { await guild.setSplash(await fetchBuffer(backup.meta.splashURL), "chromed restore"); summary.splash++; }
      catch (err) { errors.push({ step: "splash", error: err.message }); summary.skipped++; }
    }
  }

  return { summary, errors };
}

function buildOverwrites(overwrites, roleIdMap, everyoneId) {
  if (!overwrites?.length) return [];
  const out = [];
  for (const o of overwrites) {
    if (o.targetType !== 0) continue;
    let targetId = null;
    if (o.isEveryone) targetId = everyoneId;
    else if (o.targetName && roleIdMap.has(o.targetName)) targetId = roleIdMap.get(o.targetName).id;
    if (!targetId) continue;
    out.push({ id: targetId, allow: BigInt(o.allow), deny: BigInt(o.deny) });
  }
  return out;
}

module.exports = { captureGuild, restoreGuild, diffSnapshots };
