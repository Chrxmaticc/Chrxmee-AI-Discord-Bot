// cogs/antinuke/raidmode.js
// raid detection + auto-lockdown.

const { ChannelType, PermissionFlagsBits } = require("discord.js");
const { E, COLORS } = require("./constants");
const store = require("./store");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// in-memory join/invite counters
const JOIN_BUCKETS = new Map();   // guildId → [timestamps]
const INVITE_BUCKETS = new Map(); // guildId → [timestamps]

const GC_MS = 5 * 60 * 1000;

/* ═══════════════════════════════════════════════════════════════
   RECORD
   ═══════════════════════════════════════════════════════════════ */
function recordJoin(guildId) {
  let arr = JOIN_BUCKETS.get(guildId);
  if (!arr) { arr = []; JOIN_BUCKETS.set(guildId, arr); }
  arr.push(Date.now());
  // trim
  const cutoff = Date.now() - GC_MS;
  while (arr.length && arr[0] < cutoff) arr.shift();
}

function recordInvite(guildId) {
  let arr = INVITE_BUCKETS.get(guildId);
  if (!arr) { arr = []; INVITE_BUCKETS.set(guildId, arr); }
  arr.push(Date.now());
  const cutoff = Date.now() - GC_MS;
  while (arr.length && arr[0] < cutoff) arr.shift();
}

function countJoins(guildId, windowMs = 60_000) {
  const arr = JOIN_BUCKETS.get(guildId);
  if (!arr?.length) return 0;
  const cutoff = Date.now() - windowMs;
  return arr.filter((t) => t >= cutoff).length;
}

function countInvites(guildId, windowMs = 60_000) {
  const arr = INVITE_BUCKETS.get(guildId);
  if (!arr?.length) return 0;
  const cutoff = Date.now() - windowMs;
  return arr.filter((t) => t >= cutoff).length;
}

/* ═══════════════════════════════════════════════════════════════
   CHECK — call this on guildMemberAdd / inviteCreate
   ═══════════════════════════════════════════════════════════════ */
async function checkRaid(client, guild, kind /* "join" | "invite" */) {
  const cfg = await store.getSettings(client.pool, guild.id);
  if (!cfg.enabled) return;
  if (!cfg.settings.raid?.enabled) return;
  if (cfg.mode === "dry-run") {
    // log only
    const joinCount = countJoins(guild.id);
    if (joinCount >= cfg.settings.raid.joinsPerMinute) {
      console.log(`[antinuke/raid] dry-run: ${joinCount} joins/min in ${guild.id}`);
    }
    return;
  }

  const raid = cfg.settings.raid;
  const joinCount = countJoins(guild.id, 60_000);
  const inviteCount = countInvites(guild.id, 60_000);

  const raidDetected =
    (kind === "join" && joinCount >= raid.joinsPerMinute) ||
    (kind === "invite" && inviteCount >= raid.invitesPerMinute);

  if (!raidDetected) return;

  // already locked down? skip
  const existing = await store.lockdownGet(client.pool, guild.id);
  if (existing?.active) return;

  console.log(`[antinuke/raid] raid detected in ${guild.id} — joins=${joinCount} invites=${inviteCount}`);

  if (raid.autoLockdown) {
    await lockdown(client, guild, `auto: ${kind} raid (${kind === "join" ? joinCount : inviteCount}/min)`, "antinuke");
  }
}

/* ═══════════════════════════════════════════════════════════════
   LOCKDOWN
   ═══════════════════════════════════════════════════════════════ */
async function lockdown(client, guild, reason, startedBy) {
  const cfg = await store.getSettings(client.pool, guild.id);
  const raid = cfg.settings.raid;
  const duration = raid.lockdownDuration || 10 * 60 * 1000;
  const expiresAt = Date.now() + duration;

  await store.lockdownSet(client.pool, guild.id, {
    active: true, reason, startedBy, expiresAt,
  });

  const everyone = guild.roles.everyone;
  let done = 0;

  const channels = await guild.channels.fetch();
  for (const ch of channels.values()) {
    if (!ch || ch.isThread?.()) continue;
    try {
      const overwrites = { SendMessages: false };
      if (raid.lockdownHide) overwrites.ViewChannel = false;
      if (raid.lockdownSlowmode && ch.type === ChannelType.GuildText) {
        await ch.setRateLimitPerUser(raid.lockdownSlowmode, "antinuke lockdown");
      }
      await ch.permissionOverwrites.edit(everyone, overwrites, { reason: "antinuke lockdown" });
      done++;
      await sleep(300);
    } catch (err) {
      // channel not editable
    }
  }

  // notify
  const notify = cfg.settings.notify || {};
  if (notify.logChannel) {
    try {
      const ch = await client.channels.fetch(notify.logChannel).catch(() => null);
      if (ch?.isTextBased?.()) {
        await ch.send({
          embeds: [{
            color: COLORS.antinuke,
            title: `${E.lock} RAID MODE — lockdown activated`,
            description:
              `**reason:** ${reason}\n` +
              `**channels locked:** ${done}\n` +
              `**expires:** <t:${Math.floor(expiresAt / 1000)}:R>`,
          }],
        }).catch(() => {});
      }
    } catch {}
  }

  return { done, expiresAt };
}

/* ═══════════════════════════════════════════════════════════════
   LIFT LOCKDOWN
   ═══════════════════════════════════════════════════════════════ */
async function liftLockdown(client, guild, reason = "manual") {
  const state = await store.lockdownGet(client.pool, guild.id);
  if (!state?.active) return { ok: false, reason: "not active" };

  const cfg = await store.getSettings(client.pool, guild.id);
  const everyone = guild.roles.everyone;
  let done = 0;

  const channels = await guild.channels.fetch();
  for (const ch of channels.values()) {
    if (!ch || ch.isThread?.()) continue;
    try {
      await ch.permissionOverwrites.edit(everyone, {
        SendMessages: null,
        ViewChannel: null,
      }, { reason: "antinuke lockdown lift" });
      done++;
      await sleep(250);
    } catch {}
  }

  await store.lockdownClear(client.pool, guild.id);

  const notify = cfg.settings.notify || {};
  if (notify.logChannel) {
    try {
      const ch = await client.channels.fetch(notify.logChannel).catch(() => null);
      if (ch?.isTextBased?.()) {
        await ch.send({
          embeds: [{
            color: COLORS.success,
            title: `${E.unlock} lockdown lifted`,
            description: `**reason:** ${reason}\n**channels unlocked:** ${done}`,
          }],
        }).catch(() => {});
      }
    } catch {}
  }

  return { ok: true, done };
}

/* ═══════════════════════════════════════════════════════════════
   AUTO-EXPIRY TICK
   ═══════════════════════════════════════════════════════════════ */
async function runExpiryTick(client) {
  try {
    const expired = await store.lockdownExpired(client.pool);
    for (const row of expired) {
      const guild = client.guilds.cache.get(row.guild_id);
      if (!guild) {
        await store.lockdownClear(client.pool, row.guild_id);
        continue;
      }
      await liftLockdown(client, guild, "expired").catch(() => {});
    }
  } catch (err) {
    console.error("[antinuke/raid] expiry tick failed:", err.message);
  }
}

/* ═══════════════════════════════════════════════════════════════
   BOOT
   ═══════════════════════════════════════════════════════════════ */
function startRaidLoop(client) {
  const loop = setInterval(() => runExpiryTick(client), 60_000);
  loop.unref?.();
  setTimeout(() => runExpiryTick(client), 10_000);
}

module.exports = {
  recordJoin, recordInvite,
  countJoins, countInvites,
  checkRaid,
  lockdown, liftLockdown,
  runExpiryTick, startRaidLoop,
};
