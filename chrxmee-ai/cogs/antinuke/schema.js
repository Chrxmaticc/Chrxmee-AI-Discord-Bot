// cogs/antinuke/schema.js
// all DDL for the antinuke cog. runs once at boot via handlers.install().

async function ensureTables(pgClient) {
  await pgClient.query(`
    CREATE TABLE IF NOT EXISTS antinuke_settings (
      guild_id       TEXT PRIMARY KEY,
      enabled        BOOLEAN DEFAULT FALSE,
      mode           TEXT DEFAULT 'normal',
      punishment     TEXT DEFAULT 'strip_kick',
      settings       JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at     TIMESTAMPTZ DEFAULT NOW(),
      updated_at     TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log("antinuke_settings table ready");

  await pgClient.query(`
    CREATE TABLE IF NOT EXISTS antinuke_whitelist (
      guild_id    TEXT NOT NULL,
      target_id   TEXT NOT NULL,
      target_type TEXT NOT NULL,
      added_by    TEXT,
      added_at    TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (guild_id, target_id, target_type)
    )
  `);
  console.log("antinuke_whitelist table ready");

  await pgClient.query(`
    CREATE INDEX IF NOT EXISTS antinuke_whitelist_guild_idx
      ON antinuke_whitelist (guild_id)
  `);
  console.log("antinuke_whitelist_guild_idx index ready");

  await pgClient.query(`
    CREATE TABLE IF NOT EXISTS antinuke_logs (
      id           SERIAL PRIMARY KEY,
      guild_id     TEXT NOT NULL,
      executor_id  TEXT,
      action       TEXT NOT NULL,
      count        INTEGER,
      threshold    INTEGER,
      window_ms    INTEGER,
      punished     BOOLEAN DEFAULT FALSE,
      punishment   TEXT,
      escalated    BOOLEAN DEFAULT FALSE,
      snapshot_id  INTEGER,
      detail       TEXT,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log("antinuke_logs table ready");

  await pgClient.query(`
    CREATE INDEX IF NOT EXISTS antinuke_logs_guild_idx
      ON antinuke_logs (guild_id, created_at DESC)
  `);
  console.log("antinuke_logs_guild_idx index ready");

  await pgClient.query(`
    CREATE INDEX IF NOT EXISTS antinuke_logs_executor_idx
      ON antinuke_logs (guild_id, executor_id, created_at DESC)
  `);
  console.log("antinuke_logs_executor_idx index ready");

  await pgClient.query(`
    CREATE TABLE IF NOT EXISTS antinuke_trust (
      guild_id        TEXT NOT NULL,
      trusted_guild   TEXT NOT NULL,
      share_bans      BOOLEAN DEFAULT FALSE,
      accept_bans     BOOLEAN DEFAULT FALSE,
      added_by        TEXT,
      added_at        TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (guild_id, trusted_guild)
    )
  `);
  console.log("antinuke_trust table ready");

  await pgClient.query(`
    CREATE TABLE IF NOT EXISTS antinuke_network_bans (
      id            SERIAL PRIMARY KEY,
      origin_guild  TEXT NOT NULL,
      user_id       TEXT NOT NULL,
      reason        TEXT,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log("antinuke_network_bans table ready");

  await pgClient.query(`
    CREATE INDEX IF NOT EXISTS antinuke_network_bans_user_idx
      ON antinuke_network_bans (user_id, created_at DESC)
  `);
  console.log("antinuke_network_bans_user_idx index ready");

  await pgClient.query(`
    CREATE TABLE IF NOT EXISTS antinuke_baseline (
      guild_id       TEXT NOT NULL,
      action         TEXT NOT NULL,
      sample_count   INTEGER DEFAULT 0,
      total_actions  INTEGER DEFAULT 0,
      peak_per_min   INTEGER DEFAULT 0,
      avg_per_min    NUMERIC DEFAULT 0,
      last_sample_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (guild_id, action)
    )
  `);
  console.log("antinuke_baseline table ready");

  await pgClient.query(`
    CREATE TABLE IF NOT EXISTS antinuke_pending (
      id           SERIAL PRIMARY KEY,
      guild_id     TEXT NOT NULL,
      channel_id   TEXT,
      executor_id  TEXT,
      action       TEXT NOT NULL,
      payload      JSONB,
      reason       TEXT,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log("antinuke_pending table ready");

  await pgClient.query(`
    CREATE TABLE IF NOT EXISTS antinuke_lockdown (
      guild_id      TEXT PRIMARY KEY,
      active        BOOLEAN DEFAULT FALSE,
      reason        TEXT,
      started_by    TEXT,
      started_at    TIMESTAMPTZ,
      expires_at    TIMESTAMPTZ
    )
  `);
  console.log("antinuke_lockdown table ready");
}

module.exports = { ensureTables }; 
