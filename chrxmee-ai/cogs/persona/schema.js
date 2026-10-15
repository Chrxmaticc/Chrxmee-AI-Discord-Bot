// cogs/persona/schema.js
// all DDL for the persona cog. runs once at boot via handlers.install().

async function ensureTables(pgClient) {
  // ── SERVER PERSONA SETTINGS ──
  await pgClient.query(`
    CREATE TABLE IF NOT EXISTS persona_server_settings (
      guild_id          TEXT PRIMARY KEY,
      enabled           BOOLEAN DEFAULT FALSE,
      channels          JSONB NOT NULL DEFAULT '[]'::jsonb,
      min_messages      INTEGER DEFAULT 40,
      reply_chance      INTEGER DEFAULT 5,
      cooldown_ms       INTEGER DEFAULT 30000,
      gifs              BOOLEAN DEFAULT TRUE,
      mentions          BOOLEAN DEFAULT TRUE,
      ignore_bots       BOOLEAN DEFAULT TRUE,
      learned_count     INTEGER DEFAULT 0,
      last_backfill_at  TIMESTAMPTZ,
      updated_at        TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log("persona_server_settings table ready");

  // ── SERVER PERSONA PROFILE (single row per guild) ──
  await pgClient.query(`
    CREATE TABLE IF NOT EXISTS persona_server_profile (
      guild_id     TEXT PRIMARY KEY,
      profile      JSONB NOT NULL DEFAULT '{}'::jsonb,
      manual_edit  JSONB,
      updated_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log("persona_server_profile table ready");

  // ── SERVER CORPUS (learned messages) ──
  await pgClient.query(`
    CREATE TABLE IF NOT EXISTS persona_server_corpus (
      id           BIGSERIAL PRIMARY KEY,
      guild_id     TEXT NOT NULL,
      channel_id   TEXT NOT NULL,
      author_id    TEXT,
      content      TEXT NOT NULL,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log("persona_server_corpus table ready");

  await pgClient.query(`
    CREATE INDEX IF NOT EXISTS persona_server_corpus_guild_idx
      ON persona_server_corpus (guild_id, channel_id, created_at DESC)
  `);
  console.log("persona_server_corpus_guild_idx index ready");

  // ── USER PERSONA OPT-IN ──
  await pgClient.query(`
    CREATE TABLE IF NOT EXISTS persona_user_optin (
      user_id       TEXT NOT NULL,
      guild_id      TEXT NOT NULL,
      min_messages  INTEGER DEFAULT 40,
      learned_count INTEGER DEFAULT 0,
      opted_in_at   TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (user_id, guild_id)
    )
  `);
  console.log("persona_user_optin table ready");

  // ── USER PERSONA PROFILE ──
  await pgClient.query(`
    CREATE TABLE IF NOT EXISTS persona_user_profile (
      user_id      TEXT NOT NULL,
      guild_id     TEXT NOT NULL,
      profile      JSONB NOT NULL DEFAULT '{}'::jsonb,
      manual_edit  JSONB,
      updated_at   TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (user_id, guild_id)
    )
  `);
  console.log("persona_user_profile table ready");

  // ── USER CORPUS ──
  await pgClient.query(`
    CREATE TABLE IF NOT EXISTS persona_user_corpus (
      id         BIGSERIAL PRIMARY KEY,
      user_id    TEXT NOT NULL,
      guild_id   TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      content    TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log("persona_user_corpus table ready");

  await pgClient.query(`
    CREATE INDEX IF NOT EXISTS persona_user_corpus_user_idx
      ON persona_user_corpus (user_id, guild_id, created_at DESC)
  `);
  console.log("persona_user_corpus_user_idx index ready");

  // ── MANUAL BLOCKED WORDS (per guild) ──
  await pgClient.query(`
    CREATE TABLE IF NOT EXISTS persona_blocked_words (
      guild_id    TEXT NOT NULL,
      word        TEXT NOT NULL,
      added_by    TEXT,
      added_at    TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (guild_id, word)
    )
  `);
  console.log("persona_blocked_words table ready");

  // ── COOLDOWN TRACKING (per channel, server persona) ──
  await pgClient.query(`
    CREATE TABLE IF NOT EXISTS persona_cooldowns (
      channel_id   TEXT PRIMARY KEY,
      last_spoke_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log("persona_cooldowns table ready");

  // ── AUDIT LOG ──
  await pgClient.query(`
    CREATE TABLE IF NOT EXISTS persona_audit (
      id          SERIAL PRIMARY KEY,
      guild_id    TEXT NOT NULL,
      actor_id    TEXT,
      action      TEXT NOT NULL,
      detail      TEXT,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log("persona_audit table ready");

  await pgClient.query(`
    CREATE INDEX IF NOT EXISTS persona_audit_guild_idx
      ON persona_audit (guild_id, created_at DESC)
  `);
  console.log("persona_audit_guild_idx index ready");
}

module.exports = { ensureTables };
