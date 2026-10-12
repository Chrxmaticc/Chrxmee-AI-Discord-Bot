// cogs/backup/store.js
const { CONFIG } = require("./constants");
const { ensureTables } = require("./schema"); // ← re-export from schema.js

/* ═══════════════════════════════════════════════════════════════
   BACKUPS
   ═══════════════════════════════════════════════════════════════ */
async function insertBackup(pool, { guildId, name, createdBy, payload }) {
  const { rows } = await pool.query(
    `INSERT INTO guild_backups (guild_id, name, created_by, size_bytes, payload)
     VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at`,
    [guildId, name, createdBy, payload.length, payload]
  );
  return rows[0];
}

async function listBackups(pool, guildId, limit = CONFIG.maxListResults) {
  const { rows } = await pool.query(
    `SELECT id, name, created_by, created_at, size_bytes
     FROM guild_backups WHERE guild_id = $1
     ORDER BY created_at DESC LIMIT $2`,
    [guildId, limit]
  );
  return rows;
}

async function getBackup(pool, id, guildId) {
  const { rows } = await pool.query(
    `SELECT id, guild_id, name, created_by, created_at, size_bytes, payload
     FROM guild_backups WHERE id = $1 AND guild_id = $2`,
    [id, guildId]
  );
  return rows[0] || null;
}

async function deleteBackup(pool, id, guildId) {
  const { rowCount } = await pool.query(
    `DELETE FROM guild_backups WHERE id = $1 AND guild_id = $2`,
    [id, guildId]
  );
  return rowCount > 0;
}

async function latestBackupAgeMs(pool, guildId) {
  const { rows } = await pool.query(
    `SELECT EXTRACT(EPOCH FROM (NOW() - created_at)) * 1000 AS ms
     FROM guild_backups WHERE guild_id = $1
     ORDER BY created_at DESC LIMIT 1`,
    [guildId]
  );
  return rows[0] ? Number(rows[0].ms) : null;
}

async function findBackupByName(pool, guildId, name) {
  const { rows } = await pool.query(
    `SELECT id, name, created_at FROM guild_backups
     WHERE guild_id = $1 AND name = $2
     ORDER BY created_at DESC LIMIT 1`,
    [guildId, name]
  );
  return rows[0] || null;
}

/* ═══════════════════════════════════════════════════════════════
   QUOTA
   ═══════════════════════════════════════════════════════════════ */
async function getQuota(pool, guildId) {
  const { rows } = await pool.query(
    `SELECT quota_bytes FROM guild_backup_quota WHERE guild_id = $1`,
    [guildId]
  );
  return rows[0] ? Number(rows[0].quota_bytes) : CONFIG.defaultQuotaBytes;
}

async function setQuota(pool, guildId, quotaBytes, grantedBy, note = null) {
  await pool.query(
    `INSERT INTO guild_backup_quota (guild_id, quota_bytes, granted_by, granted_at, note)
     VALUES ($1, $2, $3, NOW(), $4)
     ON CONFLICT (guild_id) DO UPDATE SET
       quota_bytes = $2, granted_by = $3, granted_at = NOW(), note = $4`,
    [guildId, quotaBytes, grantedBy, note]
  );
}

async function getUsedBytes(pool, guildId) {
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(size_bytes), 0)::bigint AS used
     FROM guild_backups WHERE guild_id = $1`,
    [guildId]
  );
  return Number(rows[0].used);
}

async function countBackups(pool, guildId) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM guild_backups WHERE guild_id = $1`,
    [guildId]
  );
  return rows[0].n;
}

/* ═══════════════════════════════════════════════════════════════
   SCHEDULED BACKUPS
   ═══════════════════════════════════════════════════════════════ */
async function createScheduledBackup(pool, { guildId, name, freq, createdBy, firstRunAt }) {
  const { rows } = await pool.query(
    `INSERT INTO scheduled_backups (guild_id, name, freq, created_by, next_run_at)
     VALUES ($1, $2, $3, $4, to_timestamp($5 / 1000.0)) RETURNING id`,
    [guildId, name, freq, createdBy, firstRunAt]
  );
  return rows[0].id;
}

async function listScheduledBackups(pool, guildId) {
  const { rows } = await pool.query(
    `SELECT id, name, freq, next_run_at, enabled FROM scheduled_backups
     WHERE guild_id = $1 AND enabled = TRUE ORDER BY next_run_at ASC`,
    [guildId]
  );
  return rows;
}

async function disableScheduledBackup(pool, guildId) {
  const { rowCount } = await pool.query(
    `UPDATE scheduled_backups SET enabled = FALSE
     WHERE guild_id = $1 AND enabled = TRUE`,
    [guildId]
  );
  return rowCount;
}

async function dueScheduledBackups(pool) {
  const { rows } = await pool.query(
    `SELECT id, guild_id, name, freq, created_by, next_run_at
     FROM scheduled_backups
     WHERE enabled = TRUE AND next_run_at <= NOW()
     ORDER BY next_run_at ASC LIMIT 25`
  );
  return rows;
}

async function advanceScheduledBackup(pool, id, freq) {
  const ms = CONFIG.FREQ[freq] || CONFIG.FREQ.daily;
  await pool.query(
    `UPDATE scheduled_backups
     SET next_run_at = next_run_at + ($1 || ' milliseconds')::interval
     WHERE id = $2`,
    [ms, id]
  );
}

/* ═══════════════════════════════════════════════════════════════
   SCHEDULED RESTORES
   ═══════════════════════════════════════════════════════════════ */
async function createScheduledRestore(pool, {
  guildId, backupId, sourceGuild, channelId, scheduledBy, fireAt,
}) {
  const { rows } = await pool.query(
    `INSERT INTO scheduled_restores
       (guild_id, backup_id, source_guild, channel_id, scheduled_by, fire_at)
     VALUES ($1, $2, $3, $4, $5, to_timestamp($6 / 1000.0)) RETURNING id`,
    [guildId, backupId, sourceGuild, channelId, scheduledBy, fireAt]
  );
  return rows[0].id;
}

async function listScheduledRestores(pool, guildId) {
  const { rows } = await pool.query(
    `SELECT id, backup_id, source_guild, channel_id, scheduled_by, fire_at
     FROM scheduled_restores
     WHERE guild_id = $1 AND executed = FALSE ORDER BY fire_at ASC`,
    [guildId]
  );
  return rows;
}

async function cancelScheduledRestore(pool, id, guildId) {
  const { rowCount } = await pool.query(
    `DELETE FROM scheduled_restores
     WHERE id = $1 AND guild_id = $2 AND executed = FALSE
       AND fire_at > NOW() + ($3 || ' milliseconds')::interval`,
    [id, guildId, CONFIG.restoreLockWindowMs]
  );
  return rowCount > 0;
}

async function dueScheduledRestores(pool) {
  const { rows } = await pool.query(
    `SELECT id, guild_id, backup_id, source_guild, channel_id, scheduled_by, fire_at
     FROM scheduled_restores
     WHERE executed = FALSE AND fire_at <= NOW()
     ORDER BY fire_at ASC LIMIT 10`
  );
  return rows;
}

async function markRestoreExecuted(pool, id) {
  await pool.query(`UPDATE scheduled_restores SET executed = TRUE WHERE id = $1`, [id]);
}

/* ═══════════════════════════════════════════════════════════════
   SETTINGS (notify channel)
   ═══════════════════════════════════════════════════════════════ */
async function setNotifyChannel(pool, guildId, channelId) {
  await pool.query(
    `INSERT INTO guild_backup_settings (guild_id, notify_channel_id)
     VALUES ($1, $2)
     ON CONFLICT (guild_id) DO UPDATE SET notify_channel_id = $2`,
    [guildId, channelId]
  );
}

async function getNotifyChannel(pool, guildId) {
  const { rows } = await pool.query(
    `SELECT notify_channel_id FROM guild_backup_settings WHERE guild_id = $1`,
    [guildId]
  );
  return rows[0]?.notify_channel_id || null;
}

/* ═══════════════════════════════════════════════════════════════
   AUDIT
   ═══════════════════════════════════════════════════════════════ */
async function logAudit(pool, { guildId, actorId, action, backupId = null, detail = null }) {
  try {
    await pool.query(
      `INSERT INTO backup_audit (guild_id, actor_id, action, backup_id, detail)
       VALUES ($1, $2, $3, $4, $5)`,
      [guildId, actorId, action, backupId, detail]
    );
  } catch {}
}

async function listAudit(pool, guildId, limit = 15) {
  const { rows } = await pool.query(
    `SELECT actor_id, action, backup_id, detail, created_at
     FROM backup_audit WHERE guild_id = $1
     ORDER BY created_at DESC LIMIT $2`,
    [guildId, limit]
  );
  return rows;
}

module.exports = {
  ensureTables, // re-exported from schema.js

  insertBackup, listBackups, getBackup, deleteBackup,
  latestBackupAgeMs, findBackupByName,

  getQuota, setQuota, getUsedBytes, countBackups,

  createScheduledBackup, listScheduledBackups, disableScheduledBackup,
  dueScheduledBackups, advanceScheduledBackup,

  createScheduledRestore, listScheduledRestores, cancelScheduledRestore,
  dueScheduledRestores, markRestoreExecuted,

  setNotifyChannel, getNotifyChannel,

  logAudit, listAudit,
};
