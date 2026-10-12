// cogs/backup/schema.js
// all DDL for the backup cog. runs once at boot via scheduler.startScheduler().

async function ensureTables(pgClient) {
  await pgClient.query(`
    CREATE TABLE IF NOT EXISTS guild_backups (
      id          SERIAL PRIMARY KEY,
      guild_id    TEXT NOT NULL,
      name        TEXT NOT NULL,
      created_by  TEXT NOT NULL,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      size_bytes  INTEGER,
      payload     BYTEA NOT NULL
    )
  `);
  console.log("guild_backups table ready");

  await pgClient.query(`
    CREATE INDEX IF NOT EXISTS guild_backups_guild_idx
      ON guild_backups (guild_id, created_at DESC)
  `);
  console.log("guild_backups_guild_idx index ready");

  await pgClient.query(`
    CREATE TABLE IF NOT EXISTS guild_backup_quota (
      guild_id     TEXT PRIMARY KEY,
      quota_bytes  BIGINT NOT NULL,
      granted_by   TEXT,
      granted_at   TIMESTAMPTZ DEFAULT NOW(),
      note         TEXT
    )
  `);
  console.log("guild_backup_quota table ready");

  await pgClient.query(`
    CREATE TABLE IF NOT EXISTS guild_backup_settings (
      guild_id          TEXT PRIMARY KEY,
      notify_channel_id TEXT
    )
  `);
  console.log("guild_backup_settings table ready");

  await pgClient.query(`
    CREATE TABLE IF NOT EXISTS scheduled_backups (
      id            SERIAL PRIMARY KEY,
      guild_id      TEXT NOT NULL,
      name          TEXT NOT NULL,
      freq          TEXT NOT NULL,
      created_by    TEXT NOT NULL,
      next_run_at   TIMESTAMPTZ NOT NULL,
      enabled       BOOLEAN DEFAULT TRUE,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log("scheduled_backups table ready");

  await pgClient.query(`
    CREATE INDEX IF NOT EXISTS scheduled_backups_due_idx
      ON scheduled_backups (next_run_at) WHERE enabled = TRUE
  `);
  console.log("scheduled_backups_due_idx index ready");

  await pgClient.query(`
    CREATE TABLE IF NOT EXISTS scheduled_restores (
      id           SERIAL PRIMARY KEY,
      guild_id     TEXT NOT NULL,
      backup_id    INTEGER NOT NULL,
      source_guild TEXT,
      channel_id   TEXT NOT NULL,
      scheduled_by TEXT NOT NULL,
      fire_at      TIMESTAMPTZ NOT NULL,
      executed     BOOLEAN DEFAULT FALSE,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log("scheduled_restores table ready");

  await pgClient.query(`
    CREATE INDEX IF NOT EXISTS scheduled_restores_due_idx
      ON scheduled_restores (fire_at) WHERE executed = FALSE
  `);
  console.log("scheduled_restores_due_idx index ready");

  await pgClient.query(`
    CREATE TABLE IF NOT EXISTS backup_audit (
      id          SERIAL PRIMARY KEY,
      guild_id    TEXT NOT NULL,
      actor_id    TEXT NOT NULL,
      action      TEXT NOT NULL,
      backup_id   INTEGER,
      detail      TEXT,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log("backup_audit table ready");

  await pgClient.query(`
    CREATE INDEX IF NOT EXISTS backup_audit_guild_idx
      ON backup_audit (guild_id, created_at DESC)
  `);
  console.log("backup_audit_guild_idx index ready");
}

module.exports = { ensureTables };
