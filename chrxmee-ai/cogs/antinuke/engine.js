// cogs/antinuke/engine.js
// detection + punishment + notification pipeline.

const { AuditLogEvent, PermissionsBitField } = require("discord.js");
const {
  E, COLORS, PUNISHMENTS, DANGEROUS_PERMS, OWNER_IDS,
} = require("./constants");
const store = require("./store");
const tracker = require("./tracker");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// prevent concurrent processing of the same guild
const GUILD_LOCKS = new Set();
// prevent double-punishing the same executor+action within 30s
const PUNISH_COOLDOWN = new Map();
const PUNISH_COOLDOWN_MS = 30_000;

/* ═══════════════════════════════════════════════════════════════
   AUDIT LOG — with retry (handles Discord lag)
   ═══════════════════════════════════════════════════════════════ */
async function fetchAuditEntry(guild, type, { attempts = 3, delayMs = 500, targetId = null } = {}) {
  for (let i = 0; i < attempts; i++) {
    try {
      const logs = await guild.fetchAuditLogs({ type, limit: 5 });
      const now = Date.now();
      for (const entry of logs.entries.values()) {
        // fresh action check (within 15s)
        if (now - entry.createdTimestamp > 15_000) continue;
        // optional target match (for precision)
        if (targetId && entry.target?.id && entry.target.id !== targetId) continue;
        return entry;
      }
    } catch (err) {
      // swallow and retry
    }
    if (i < attempts - 1) await sleep(delayMs);
  }
  return null;
}

/* ═══════════════════════════════════════════════════════════════
   WHITELIST CHECK
   ═══════════════════════════════════════════════════════════════ */
async function isExecutorWhitelisted(client, guild, executorId, cfg) {
  // 1. server owner
  if (guild.ownerId === executorId) return true;

  // 2. chromed itself
  if (client.user.id === executorId) return true;

  // 3. bot owner IDs
  if (OWNER_IDS.includes(executorId)) return true;

  // 4. explicit whitelist
  const wl = await store.whitelistGetAll(client.pool, guild.id);
  if (wl.users.includes(executorId)) return true;
  if (wl.bots.includes(executorId)) return true;

  // 5. role whitelist — does the executor have any whitelisted role?
  if (wl.roles.length) {
    try {
      const member = await guild.members.fetch(executorId).catch(() => null);
      if (member) {
        for (const roleId of wl.roles) {
          if (member.roles.cache.has(roleId)) return true;
        }
      }
    } catch {}
  }

  return false;
}

/* ═══════════════════════════════════════════════════════════════
   THRESHOLD CHECK
   ═══════════════════════════════════════════════════════════════ */
function evaluateThreshold(cfg, guildId, executorId, action) {
  const thresholds = cfg.settings.thresholds;
  const windows    = cfg.settings.windows;
  const threshold  = thresholds[action] ?? 5;
  const windowMs   = windows[action] ?? 10_000;

  const primaryCount = tracker.countInWindow(guildId, executorId, action, windowMs);

  if (primaryCount >= threshold) {
    return { triggered: true, kind: "primary", count: primaryCount, threshold, windowMs };
  }

  // long window
  if (cfg.settings.longWindow?.enabled) {
    const lw = cfg.settings.longWindow;
    const longThreshold = threshold * (lw.multiplier || 4);
    const longCount = tracker.countInLongWindow(guildId, executorId, action, lw.windowMs || 300_000);
    if (longCount >= longThreshold) {
      return { triggered: true, kind: "long", count: longCount, threshold: longThreshold, windowMs: lw.windowMs };
    }
  }

  return { triggered: false, count: primaryCount, threshold, windowMs };
}

function evaluateSpike(cfg, guildId, action) {
  if (!cfg.settings.rateSpike?.enabled) return null;
  const rs = cfg.settings.rateSpike;
  const count = tracker.countSpike(guildId, action, rs.windowMs || 3000);
  if (count >= (rs.count || 20)) {
    return { triggered: true, count, threshold: rs.count, windowMs: rs.windowMs };
  }
  return null;
}

/* ═══════════════════════════════════════════════════════════════
   PUNISHMENT
   ═══════════════════════════════════════════════════════════════ */
function nextPunishment(current) {
  const order = Object.entries(PUNISHMENTS)
    .sort((a, b) => a[1].order - b[1].order)
    .map(([k]) => k);
  const idx = order.indexOf(current);
  if (idx === -1) return "strip_kick";
  return order[Math.min(order.length - 1, idx + 1)];
}

async function applyPunishment(client, guild, executorId, mode, reason) {
  const member = await guild.members.fetch(executorId).catch(() => null);
  if (!member) return { ok: false, reason: "member not found (may have left)" };

  const result = { ok: true, actions: [] };

  try {
    switch (mode) {
      case "log_only":
        result.actions.push("logged only");
        break;

      case "strip":
        await member.roles.set([], reason);
        result.actions.push("stripped all roles");
        break;

      case "timeout":
        if (member.moderatable) {
          await member.timeout(28 * 24 * 60 * 60 * 1000, reason);
          result.actions.push("timeout 28d");
        } else {
          result.actions.push("timeout skipped (not moderatable)");
        }
        break;

      case "kick":
        if (member.kickable) {
          await member.kick(reason);
          result.actions.push("kicked");
        } else {
          result.actions.push("kick skipped (not kickable)");
        }
        break;

      case "ban":
        if (member.bannable) {
          await guild.bans.create(executorId, {
            reason,
            deleteMessageSeconds: 24 * 60 * 60,
          });
          result.actions.push("banned + 24h msgs deleted");
        } else {
          result.actions.push("ban skipped (not bannable)");
        }
        break;

      case "strip_kick":
      default:
        try { await member.roles.set([], reason); result.actions.push("stripped"); }
        catch { result.actions.push("strip failed"); }
        if (member.kickable) {
          await member.kick(reason);
          result.actions.push("kicked");
        } else {
          result.actions.push("kick skipped (not kickable)");
        }
        break;
    }
  } catch (err) {
    return { ok: false, reason: err.message, actions: result.actions };
  }

  return result;
}

/* ═══════════════════════════════════════════════════════════════
   NOTIFICATION
   ═══════════════════════════════════════════════════════════════ */
async function notifyGuild(client, guild, cfg, payload) {
  const notify = cfg.settings.notify || {};
  const lines = [];
  lines.push(`## ${E.shield} antinuke triggered`);
  lines.push(`**executor:** <@${payload.executorId}> (\`${payload.executorId}\`)`);
  lines.push(`**action:** \`${payload.action}\``);
  lines.push(`**count:** ${payload.count} / threshold ${payload.threshold} (${payload.windowMs / 1000}s)`);
  if (payload.escalated) lines.push(`${E.warning} **escalated** — repeat offense in 24h`);
  lines.push(`**punishment:** \`${payload.punishment}\``);
  if (payload.punishResult?.actions?.length) {
    lines.push(`**actions taken:** ${payload.punishResult.actions.join(", ")}`);
  }
  if (notify.includeSnapshotId && payload.snapshotId) {
    lines.push(`**snapshot:** \`#${payload.snapshotId}\` — use \`/backup undo\` to roll back`);
  }
  if (notify.includeAuditUrl) {
    lines.push(`**audit log:** https://discord.com/audit-logs/${guild.id}`);
  }

  // log channel
  if (notify.logChannel) {
    try {
      const ch = await client.channels.fetch(notify.logChannel).catch(() => null);
      if (ch?.isTextBased?.()) {
        await ch.send({
          content: notify.mentionRole ? `<@&${notify.mentionRole}>` : undefined,
          embeds: [{
            color: COLORS.antinuke,
            description: lines.join("\n"),
            timestamp: new Date().toISOString(),
          }],
        });
      }
    } catch (err) {
      console.error("[antinuke] log channel send failed:", err.message);
    }
  }

  // dm owner
  if (notify.dmOwner) {
    try {
      const owner = await guild.fetchOwner().catch(() => null);
      if (owner && owner.id !== payload.executorId) {
        await owner.send({
          embeds: [{
            color: COLORS.antinuke,
            title: `${E.shield} antinuke triggered in ${guild.name}`,
            description: lines.join("\n"),
          }],
        }).catch(() => {});
      }
    } catch {}
  }

  // dm executor
  if (notify.dmExecutor && payload.executorId) {
    try {
      const executor = await client.users.fetch(payload.executorId).catch(() => null);
      if (executor) {
        await executor.send({
          embeds: [{
            color: COLORS.antinuke,
            title: `${E.shield} antinuke action in ${guild.name}`,
            description: `you triggered antinuke on \`${guild.name}\`.\n**action:** \`${payload.action}\`\n**punishment:** \`${payload.punishment}\``,
          }],
        }).catch(() => {});
      }
    } catch {}
  }
}

/* ═══════════════════════════════════════════════════════════════
   PANIC SNAPSHOT
   ═══════════════════════════════════════════════════════════════ */
async function panicSnapshot(client, guild, label) {
  try {
    const backup = require("../backup");
    const result = await backup.scheduler.makeBackup(client.pool, guild, {
      name: `[antinuke] ${label}`.slice(0, 80),
      createdBy: client.user.id,
      panic: true,
    });
    if (result.ok) return result.id;
    console.warn("[antinuke] panic snapshot skipped: quota");
  } catch (err) {
    console.warn("[antinuke] panic snapshot failed:", err.message);
  }
  return null;
}

/* ═══════════════════════════════════════════════════════════════
   MAIN ENTRY — handlers call this on every relevant event
   ═══════════════════════════════════════════════════════════════ */
async function handleEvent(client, guild, action, executorId, detail = {}) {
  if (!guild || !executorId) return;

  // per-guild lock — serialize to prevent concurrent punishment
  if (GUILD_LOCKS.has(guild.id)) {
    await store.pendingEnqueue(client.pool, {
      guildId: guild.id, executorId, action,
      payload: detail, reason: "guild locked",
    }).catch(() => {});
    return;
  }
  GUILD_LOCKS.add(guild.id);

  try {
    const cfg = await store.getSettings(client.pool, guild.id);

    // basic gates
    if (!cfg.enabled) return;
    if (cfg.settings.ignoreActions?.includes(action)) return;
    if (detail.channelId && cfg.settings.ignoreChannels?.includes(detail.channelId)) return;

    // safe mode — first 24h on new guild
    if (cfg.settings.safeMode?.enabled && cfg.settings.safeMode.until > Date.now()) {
      // record but don't punish
      tracker.record(guild.id, executorId, action);
      return;
    }

    // whitelist
    if (await isExecutorWhitelisted(client, guild, executorId, cfg)) return;

    // record
    tracker.record(guild.id, executorId, action);

    // baseline learning
    store.baselineBump(client.pool, guild.id, action).catch(() => {});

    // evaluate
    const evalResult = evaluateThreshold(cfg, guild.id, executorId, action);
    const spike = evalResult.triggered ? null : evaluateSpike(cfg, guild.id, action);

    if (!evalResult.triggered && !spike) return;

    // cooldown check — don't punish same executor+action twice within 30s
    const cdKey = `${guild.id}:${executorId}:${action}`;
    const lastPunish = PUNISH_COOLDOWN.get(cdKey);
    if (lastPunish && Date.now() - lastPunish < PUNISH_COOLDOWN_MS) return;
    PUNISH_COOLDOWN.set(cdKey, Date.now());

    const trigger = evalResult.triggered ? evalResult : spike;

    // ── dry-run mode: log & notify, but DON'T punish ──
    if (cfg.mode === "dry-run") {
      await store.logEvent(client.pool, {
        guildId: guild.id, executorId, action,
        count: trigger.count, threshold: trigger.threshold,
        windowMs: trigger.windowMs, punished: false,
        punishment: "dry-run", detail: JSON.stringify(detail).slice(0, 500),
      });
      await notifyGuild(client, guild, cfg, {
        executorId, action,
        count: trigger.count, threshold: trigger.threshold, windowMs: trigger.windowMs,
        punishment: "dry-run (no action taken)",
        escalated: false, punishResult: { actions: [] }, snapshotId: null,
      });
      return;
    }

    // ── escalation check ──
    let punishment = cfg.punishment;
    let escalated = false;
    if (cfg.settings.escalation?.enabled) {
      const prior = await store.countRecentOffenses(
        client.pool, guild.id, executorId,
        cfg.settings.escalation.windowMs || 24 * 60 * 60 * 1000
      );
      if (prior > 0) {
        punishment = nextPunishment(punishment);
        escalated = true;
      }
    }

    // ── panic snapshot (before punishment, in case nuke already wiped stuff) ──
    let snapshotId = null;
    if (cfg.settings.panicOnTrigger) {
      snapshotId = await panicSnapshot(client, guild, `${action} by ${executorId}`);
    }

    // ── punish ──
    const reason = `antinuke: ${action} ×${trigger.count} in ${trigger.windowMs / 1000}s`;
    const punishResult = await applyPunishment(client, guild, executorId, punishment, reason);

    // ── log ──
    await store.logEvent(client.pool, {
      guildId: guild.id, executorId, action,
      count: trigger.count, threshold: trigger.threshold,
      windowMs: trigger.windowMs,
      punished: true, punishment, escalated,
      snapshotId,
      detail: JSON.stringify(detail).slice(0, 500),
    });

    // reset tracker for this user+action
    tracker.reset(guild.id, executorId, action);

    // recent-whitelist grace flag
    const recentWl = tracker.isRecentWhitelist(executorId);
    if (recentWl) {
      // add warning flag to detail
      console.warn(`[antinuke] recent whitelist trigger: ${executorId}`);
    }

    // ── notify ──
    await notifyGuild(client, guild, cfg, {
      executorId, action,
      count: trigger.count, threshold: trigger.threshold, windowMs: trigger.windowMs,
      punishment, escalated, punishResult, snapshotId,
    });

    // ── network ban share ──
    try {
      const trust = require("./trust");
      await trust.shareBanToTrusted(client, guild.id, executorId, reason);
    } catch {}

    // ── auto-restore (default OFF) ──
    if (cfg.settings.autoRestore && snapshotId) {
      setTimeout(() => {
        autoRestore(client, guild, snapshotId).catch((err) =>
          console.error("[antinuke] auto-restore failed:", err.message)
        );
      }, 5000);
    }

    // ── drain pending queue ──
    await drainPending(client, guild);
  } catch (err) {
    console.error("[antinuke] handleEvent error:", err);
  } finally {
    GUILD_LOCKS.delete(guild.id);
  }
}

async function autoRestore(client, guild, snapshotId) {
  const backup = require("../backup");
  const row = await backup.store.getBackup(client.pool, snapshotId, guild.id);
  if (!row) return;
  const zlib = require("node:zlib");
  const { promisify } = require("node:util");
  const gunzip = promisify(zlib.gunzip);
  const snapshot = JSON.parse((await gunzip(row.payload)).toString("utf8"));
  await backup.engine.restoreGuild(guild, snapshot, {});
  console.log(`[antinuke] auto-restored snapshot #${snapshotId} to ${guild.name}`);
}

/* ═══════════════════════════════════════════════════════════════
   PENDING QUEUE DRAIN
   ═══════════════════════════════════════════════════════════════ */
async function drainPending(client, guild) {
  try {
    let n = await store.pendingCount(client.pool, guild.id);
    let guard = 0;
    while (n > 0 && guard++ < 50) {
      const { rows } = await client.pool.query(
        `SELECT id FROM antinuke_pending WHERE guild_id = $1 ORDER BY created_at ASC LIMIT 1`,
        [guild.id]
      );
      if (!rows[0]) break;
      const item = await store.pendingDequeue(client.pool, rows[0].id);
      if (!item) break;
      // re-run the underlying event handler — but without recursion into queue
      if (item.executor_id) {
        // we re-check without the guild lock (it's now released)
        await handleEvent(client, guild, item.action, item.executor_id, item.payload || {})
          .catch(() => {});
      }
      n = await store.pendingCount(client.pool, guild.id);
    }
  } catch (err) {
    console.error("[antinuke] drainPending failed:", err.message);
  }
}

/* ═══════════════════════════════════════════════════════════════
   PERM ESCALATION DETECTION
   ═══════════════════════════════════════════════════════════════ */
function checkPermissionEscalation(before, after) {
  if (!before || !after) return false;
  const beforeBits = new PermissionsBitField(before);
  const afterBits  = new PermissionsBitField(after);
  for (const perm of DANGEROUS_PERMS) {
    const bit = PermissionsBitField.Flags[perm];
    if (!bit) continue;
    const hadBefore = beforeBits.has(bit);
    const hasAfter  = afterBits.has(bit);
    if (!hadBefore && hasAfter) return perm;
  }
  return false;
}

module.exports = {
  handleEvent,
  fetchAuditEntry,
  isExecutorWhitelisted,
  evaluateThreshold,
  evaluateSpike,
  applyPunishment,
  nextPunishment,
  notifyGuild,
  panicSnapshot,
  checkPermissionEscalation,
  drainPending,
};
