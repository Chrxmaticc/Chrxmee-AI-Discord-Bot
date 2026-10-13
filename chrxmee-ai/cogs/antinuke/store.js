// cogs/antinuke/store.js
// all queries for the antinuke cog. no DDL here.

const {
  DEFAULT_THRESHOLDS, DEFAULT_WINDOWS,
  DEFAULT_LONG_WINDOW, DEFAULT_RATE_SPIKE, DEFAULT_AUDIT_RETRY,
  DEFAULT_ESCALATION, DEFAULT_RAID, DEFAULT_SAFE_MODE,
  DEFAULT_NOTIFY, DEFAULT_TRUST,
  defaultSettings,
} = require("./constants");

/* ═══════════════════════════════════════════════════════════════
   SETTINGS — READ
   ═══════════════════════════════════════════════════════════════ */
async function getSettings(pool, guildId) {
  const { rows } = await pool.query(
    `SELECT enabled, mode, punishment, settings FROM antinuke_settings WHERE guild_id = $1`,
    [guildId]
  );

  if (!rows[0]) {
    return {
      guildId,
      enabled: false,
      mode: "normal",
      punishment: "strip_kick",
      settings: defaultSettings(),
      exists: false,
    };
  }

  const r = rows[0];
  const merged = { ...defaultSettings(), ...(r.settings || {}) };

  // deep-merge nested objects with defaults
  merged.thresholds = { ...DEFAULT_THRESHOLDS, ...(merged.thresholds || {}) };
  merged.windows    = { ...DEFAULT_WINDOWS,    ...(merged.windows    || {}) };
  merged.longWindow = { ...DEFAULT_LONG_WINDOW, ...(merged.longWindow || {}) };
  merged.rateSpike  = { ...DEFAULT_RATE_SPIKE,  ...(merged.rateSpike  || {}) };
  merged.auditRetry = { ...DEFAULT_AUDIT_RETRY, ...(merged.auditRetry || {}) };
  merged.escalation = { ...DEFAULT_ESCALATION,  ...(merged.escalation || {}) };
  merged.raid       = { ...DEFAULT_RAID,        ...(merged.raid       || {}) };
  merged.safeMode   = { ...DEFAULT_SAFE_MODE,   ...(merged.safeMode   || {}) };
  merged.notify     = { ...DEFAULT_NOTIFY,      ...(merged.notify     || {}) };
  merged.trust      = { ...DEFAULT_TRUST,       ...(merged.trust      || {}) };

  return {
    guildId,
    enabled: !!r.enabled,
    mode: r.mode || "normal",
    punishment: r.punishment || "strip_kick",
    settings: merged,
    exists: true,
  };
}

/* ═══════════════════════════════════════════════════════════════
   SETTINGS — WRITE (bulletproof, never inserts null)
   ═══════════════════════════════════════════════════════════════ */
async function saveSettings(pool, guildId, partial = {}) {
  // 1. read current
  const current = await getSettings(pool, guildId);

  // 2. merge — new wins, otherwise current
  const merged = {
    enabled:    partial.enabled    ?? current.enabled,
    mode:       partial.mode       ?? current.mode,
    punishment: partial.punishment ?? current.punishment,
    settings:   partial.settings   ?? current.settings,
  };

  // 3. defensive: settings must be a plain object
  if (!merged.settings || typeof merged.settings !== "object" || Array.isArray(merged.settings)) {
    merged.settings = defaultSettings();
  }

  // 4. serialize safely
  let settingsJson;
  try {
    settingsJson = JSON.stringify(merged.settings);
  } catch {
    settingsJson = JSON.stringify(defaultSettings());
  }
  if (!settingsJson || settingsJson === "null" || settingsJson === "undefined") {
    settingsJson = JSON.stringify(defaultSettings());
  }

  // 5. full row write
  await pool.query(
    `INSERT INTO antinuke_settings (guild_id, enabled, mode, punishment, settings, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (guild_id) DO UPDATE SET
       enabled    = $2,
       mode       = $3,
       punishment = $4,
       settings   = $5,
       updated_at = NOW()`,
    [
      guildId,
      merged.enabled ? true : false,
      String(merged.mode || "normal"),
      String(merged.punishment || "strip_kick"),
      settingsJson,
    ]
  );
}

async function ensureSettingsRow(pool, guildId) {
  const cfg = await getSettings(pool, guildId);
  if (cfg.exists) return cfg;

  const fresh = {
    enabled: false,
    mode: "normal",
    punishment: "strip_kick",
    settings: defaultSettings(),
  };

  await pool.query(
    `INSERT INTO antinuke_settings (guild_id, enabled, mode, punishment, settings, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (guild_id) DO NOTHING`,
    [
      guildId,
      fresh.enabled,
      fresh.mode,
      fresh.punishment,
      JSON.stringify(fresh.settings),
    ]
  );

  return { guildId, ...fresh, exists: true };
}

/* ═══════════════════════════════════════════════════════════════
   WHITELIST
   ═══════════════════════════════════════════════════════════════ */
async function whitelistAdd(pool, guildId, targetId, targetType, addedBy) {
  await pool.query(
    `INSERT INTO antinuke_whitelist (guild_id, target_id, target_type, added_by)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (guild_id, target_id, target_type) DO NOTHING`,
    [guildId, targetId, targetType, addedBy]
  );
}

async function whitelistRemove(pool, guildId, targetId, targetType) {
  const { rowCount } = await pool.query(
    `DELETE FROM antinuke_whitelist
     WHERE guild_id = $1 AND target_id = $2 AND target_type = $3`,
    [guildId, targetId, targetType]
  );
  return rowCount > 0;
}

async function whitelistList(pool, guildId) {
  const { rows } = await pool.query(
    `SELECT target_id, target_type, added_by, added_at
     FROM antinuke_whitelist WHERE guild_id = $1
     ORDER BY target_type, added_at ASC`,
    [guildId]
  );
  return rows;
}

async function whitelistGetAll(pool, guildId) {
  const rows = await whitelistList(pool, guildId);
  return {
    users: rows.filter((r) => r.target_type === "user").map((r) => r.target_id),
    roles: rows.filter((r) => r.target_type === "role").map((r) => r.target_id),
    bots:  rows.filter((r) => r.target_type === "bot").map((r) => r.target_id),
  };
}

async function whitelistClear(pool, guildId) {
  const { rowCount } = await pool.query(
    `DELETE FROM antinuke_whitelist WHERE guild_id = $1`,
    [guildId]
  );
  return rowCount;
}

/* ═══════════════════════════════════════════════════════════════
   LOGS
   ═══════════════════════════════════════════════════════════════ */
async function logEvent(pool, entry) {
  const { rows } = await pool.query(
    `INSERT INTO antinuke_logs
      (guild_id, executor_id, action, count, threshold, window_ms,
       punished, punishment, escalated, snapshot_id, detail)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING id`,
    [
      entry.guildId,
      entry.executorId || null,
      entry.action,
      entry.count ?? 0,
      entry.threshold ?? 0,
      entry.windowMs ?? 0,
      entry.punished || false,
      entry.punishment || null,
      entry.escalated || false,
      entry.snapshotId || null,
      entry.detail || null,
    ]
  );
  return rows[0].id;
}

async function listLogs(pool, guildId, limit = 20) {
  const { rows } = await pool.query(
    `SELECT id, executor_id, action, count, threshold, window_ms,
            punished, punishment, escalated, snapshot_id, detail, created_at
     FROM antinuke_logs WHERE guild_id = $1
     ORDER BY created_at DESC LIMIT $2`,
    [guildId, limit]
  );
  return rows;
}

async function countRecentOffenses(pool, guildId, executorId, windowMs) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM antinuke_logs
     WHERE guild_id = $1 AND executor_id = $2 AND punished = TRUE
       AND created_at > NOW() - ($3 || ' milliseconds')::interval`,
    [guildId, executorId, windowMs]
  );
  return rows[0].n;
}

/* ═══════════════════════════════════════════════════════════════
   TRUST NETWORK
   ═══════════════════════════════════════════════════════════════ */
async function trustAdd(pool, guildId, trustedGuild, shareBans, acceptBans, addedBy) {
  await pool.query(
    `INSERT INTO antinuke_trust (guild_id, trusted_guild, share_bans, accept_bans, added_by)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (guild_id, trusted_guild) DO UPDATE SET
       share_bans = $3, accept_bans = $4`,
    [guildId, trustedGuild, !!shareBans, !!acceptBans, addedBy]
  );
}

async function trustRemove(pool, guildId, trustedGuild) {
  const { rowCount } = await pool.query(
    `DELETE FROM antinuke_trust WHERE guild_id = $1 AND trusted_guild = $2`,
    [guildId, trustedGuild]
  );
  return rowCount > 0;
}

async function trustList(pool, guildId) {
  const { rows } = await pool.query(
    `SELECT trusted_guild, share_bans, accept_bans, added_by, added_at
     FROM antinuke_trust WHERE guild_id = $1 ORDER BY added_at DESC`,
    [guildId]
  );
  return rows;
}

async function getTrustedReceivers(pool, guildId) {
  const { rows } = await pool.query(
    `SELECT trusted_guild FROM antinuke_trust
     WHERE guild_id = $1 AND share_bans = TRUE`,
    [guildId]
  );
  return rows.map((r) => r.trusted_guild);
}

async function getTrustedSources(pool, guildId) {
  const { rows } = await pool.query(
    `SELECT trusted_guild FROM antinuke_trust
     WHERE guild_id = $1 AND accept_bans = TRUE`,
    [guildId]
  );
  return rows.map((r) => r.trusted_guild);
}

async function recordNetworkBan(pool, { originGuild, userId, reason }) {
  await pool.query(
    `INSERT INTO antinuke_network_bans (origin_guild, user_id, reason)
     VALUES ($1, $2, $3)`,
    [originGuild, userId, reason || null]
  );
}

async function isNetworkBanned(pool, userId, fromGuilds) {
  if (!fromGuilds?.length) return null;
  const { rows } = await pool.query(
    `SELECT origin_guild, reason, created_at FROM antinuke_network_bans
     WHERE user_id = $1 AND origin_guild = ANY($2::text[])
     ORDER BY created_at DESC LIMIT 1`,
    [userId, fromGuilds]
  );
  return rows[0] || null;
}

/* ═══════════════════════════════════════════════════════════════
   BASELINE
   ═══════════════════════════════════════════════════════════════ */
async function baselineBump(pool, guildId, action) {
  await pool.query(
    `INSERT INTO antinuke_baseline (guild_id, action, sample_count, total_actions, peak_per_min)
     VALUES ($1, $2, 1, 1, 1)
     ON CONFLICT (guild_id, action) DO UPDATE SET
       sample_count   = antinuke_baseline.sample_count + 1,
       total_actions  = antinuke_baseline.total_actions + 1,
       avg_per_min    = (antinuke_baseline.total_actions + 1)::numeric / (antinuke_baseline.sample_count + 1),
       last_sample_at = NOW()`,
    [guildId, action]
  );
}

async function baselineGet(pool, guildId, action) {
  const { rows } = await pool.query(
    `SELECT sample_count, total_actions, peak_per_min, avg_per_min
     FROM antinuke_baseline WHERE guild_id = $1 AND action = $2`,
    [guildId, action]
  );
  return rows[0] || null;
}

async function baselineAll(pool, guildId) {
  const { rows } = await pool.query(
    `SELECT action, sample_count, total_actions, peak_per_min, avg_per_min, last_sample_at
     FROM antinuke_baseline WHERE guild_id = $1 ORDER BY action ASC`,
    [guildId]
  );
  return rows;
}

/* ═══════════════════════════════════════════════════════════════
   PENDING QUEUE
   ═══════════════════════════════════════════════════════════════ */
async function pendingEnqueue(pool, entry) {
  const { rows } = await pool.query(
    `INSERT INTO antinuke_pending (guild_id, channel_id, executor_id, action, payload, reason)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [
      entry.guildId,
      entry.channelId || null,
      entry.executorId || null,
      entry.action,
      entry.payload ? JSON.stringify(entry.payload) : null,
      entry.reason || null,
    ]
  );
  return rows[0].id;
}

async function pendingCount(pool, guildId) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM antinuke_pending WHERE guild_id = $1`,
    [guildId]
  );
  return rows[0].n;
}

async function pendingDequeue(pool, id) {
  const { rows } = await pool.query(
    `DELETE FROM antinuke_pending WHERE id = $1 RETURNING *`,
    [id]
  );
  return rows[0] || null;
}

/* ═══════════════════════════════════════════════════════════════
   LOCKDOWN
   ═══════════════════════════════════════════════════════════════ */
async function lockdownSet(pool, guildId, { active, reason, startedBy, expiresAt }) {
  await pool.query(
    `INSERT INTO antinuke_lockdown (guild_id, active, reason, started_by, started_at, expires_at)
     VALUES ($1, $2, $3, $4, NOW(), to_timestamp($5 / 1000.0))
     ON CONFLICT (guild_id) DO UPDATE SET
       active = $2, reason = $3, started_by = $4,
       started_at = NOW(), expires_at = to_timestamp($5 / 1000.0)`,
    [guildId, !!active, reason || null, startedBy || null, expiresAt]
  );
}

async function lockdownGet(pool, guildId) {
  const { rows } = await pool.query(
    `SELECT active, reason, started_by, started_at, expires_at
     FROM antinuke_lockdown WHERE guild_id = $1`,
    [guildId]
  );
  return rows[0] || null;
}

async function lockdownClear(pool, guildId) {
  await pool.query(
    `UPDATE antinuke_lockdown SET active = FALSE WHERE guild_id = $1`,
    [guildId]
  );
}

async function lockdownExpired(pool) {
  const { rows } = await pool.query(
    `SELECT guild_id, reason, started_by FROM antinuke_lockdown
     WHERE active = TRUE AND expires_at <= NOW()`
  );
  return rows;
}

module.exports = {
  // settings
  getSettings, saveSettings, ensureSettingsRow,
  // whitelist
  whitelistAdd, whitelistRemove, whitelistList, whitelistGetAll, whitelistClear,
  // logs
  logEvent, listLogs, countRecentOffenses,
  // trust
  trustAdd, trustRemove, trustList,
  getTrustedReceivers, getTrustedSources,
  recordNetworkBan, isNetworkBanned,
  // baseline
  baselineBump, baselineGet, baselineAll,
  // pending
  pendingEnqueue, pendingCount, pendingDequeue,
  // lockdown
  lockdownSet, lockdownGet, lockdownClear, lockdownExpired,
};
