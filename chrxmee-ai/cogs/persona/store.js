// cogs/persona/store.js
// all queries for the persona cog. no DDL here.

const { DEFAULTS, emptyProfile } = require("./constants");

/* ═══════════════════════════════════════════════════════════════
   SERVER SETTINGS
   ═══════════════════════════════════════════════════════════════ */
async function getServerSettings(pool, guildId) {
  const { rows } = await pool.query(
    `SELECT * FROM persona_server_settings WHERE guild_id = $1`,
    [guildId]
  );
  if (!rows[0]) {
    return {
      guildId,
      enabled: DEFAULTS.serverEnabled,
      channels: [...DEFAULTS.serverChannels],
      minMessages: DEFAULTS.serverMinMessages,
      replyChance: DEFAULTS.serverChance,
      cooldownMs: DEFAULTS.serverCooldownMs,
      gifs: DEFAULTS.serverGifs,
      mentions: DEFAULTS.serverMentions,
      ignoreBots: DEFAULTS.serverIgnoreBots,
      learnedCount: 0,
      lastBackfillAt: null,
      exists: false,
    };
  }
  const r = rows[0];
  return {
    guildId,
    enabled: !!r.enabled,
    channels: Array.isArray(r.channels) ? r.channels : [],
    minMessages: r.min_messages ?? DEFAULTS.serverMinMessages,
    replyChance: r.reply_chance ?? DEFAULTS.serverChance,
    cooldownMs: r.cooldown_ms ?? DEFAULTS.serverCooldownMs,
    gifs: !!r.gifs,
    mentions: !!r.mentions,
    ignoreBots: !!r.ignore_bots,
    learnedCount: r.learned_count ?? 0,
    lastBackfillAt: r.last_backfill_at,
    exists: true,
  };
}

async function saveServerSettings(pool, guildId, partial = {}) {
  const current = await getServerSettings(pool, guildId);
  const next = {
    enabled:      partial.enabled      ?? current.enabled,
    channels:     partial.channels     ?? current.channels,
    minMessages:  partial.minMessages  ?? current.minMessages,
    replyChance:  partial.replyChance  ?? current.replyChance,
    cooldownMs:   partial.cooldownMs   ?? current.cooldownMs,
    gifs:         partial.gifs         ?? current.gifs,
    mentions:     partial.mentions     ?? current.mentions,
    ignoreBots:   partial.ignoreBots   ?? current.ignoreBots,
    learnedCount: partial.learnedCount ?? current.learnedCount,
    lastBackfill: partial.lastBackfill ?? current.lastBackfillAt,
  };

  await pool.query(
    `INSERT INTO persona_server_settings
      (guild_id, enabled, channels, min_messages, reply_chance, cooldown_ms,
       gifs, mentions, ignore_bots, learned_count, last_backfill_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
     ON CONFLICT (guild_id) DO UPDATE SET
       enabled          = $2,
       channels         = $3,
       min_messages     = $4,
       reply_chance     = $5,
       cooldown_ms      = $6,
       gifs             = $7,
       mentions         = $8,
       ignore_bots      = $9,
       learned_count    = $10,
       last_backfill_at = $11,
       updated_at       = NOW()`,
    [
      guildId,
      next.enabled ? true : false,
      JSON.stringify(next.channels || []),
      next.minMessages,
      next.replyChance,
      next.cooldownMs,
      next.gifs ? true : false,
      next.mentions ? true : false,
      next.ignoreBots ? true : false,
      next.learnedCount,
      next.lastBackfill || null,
    ]
  );
}

/* ═══════════════════════════════════════════════════════════════
   SERVER PROFILE
   ═══════════════════════════════════════════════════════════════ */
async function getServerProfile(pool, guildId) {
  const { rows } = await pool.query(
    `SELECT profile, manual_edit FROM persona_server_profile WHERE guild_id = $1`,
    [guildId]
  );
  if (!rows[0]) return { profile: emptyProfile(), manualEdit: null, exists: false };
  return {
    profile: { ...emptyProfile(), ...(rows[0].profile || {}) },
    manualEdit: rows[0].manual_edit || null,
    exists: true,
  };
}

async function saveServerProfile(pool, guildId, profile, manualEdit = null) {
  await pool.query(
    `INSERT INTO persona_server_profile (guild_id, profile, manual_edit, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (guild_id) DO UPDATE SET
       profile     = $2,
       manual_edit = COALESCE($3, persona_server_profile.manual_edit),
       updated_at  = NOW()`,
    [guildId, JSON.stringify(profile || {}), manualEdit ? JSON.stringify(manualEdit) : null]
  );
}

async function saveServerManualEdit(pool, guildId, manualEdit) {
  await pool.query(
    `INSERT INTO persona_server_profile (guild_id, manual_edit, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (guild_id) DO UPDATE SET
       manual_edit = $2,
       updated_at  = NOW()`,
    [guildId, manualEdit ? JSON.stringify(manualEdit) : null]
  );
}

/* ═══════════════════════════════════════════════════════════════
   SERVER CORPUS
   ═══════════════════════════════════════════════════════════════ */
async function addServerMessage(pool, { guildId, channelId, authorId, content }) {
  await pool.query(
    `INSERT INTO persona_server_corpus (guild_id, channel_id, author_id, content)
     VALUES ($1, $2, $3, $4)`,
    [guildId, channelId, authorId || null, content]
  );
  await pool.query(
    `UPDATE persona_server_settings
     SET learned_count = learned_count + 1
     WHERE guild_id = $1`,
    [guildId]
  );
}

async function serverCorpusCount(pool, guildId) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM persona_server_corpus WHERE guild_id = $1`,
    [guildId]
  );
  return rows[0].n;
}

async function serverCorpusSince(pool, guildId, sinceId) {
  const { rows } = await pool.query(
    `SELECT id, channel_id, author_id, content, created_at
     FROM persona_server_corpus
     WHERE guild_id = $1 AND id > $2
     ORDER BY id ASC LIMIT 500`,
    [guildId, sinceId]
  );
  return rows;
}

async function serverCorpusLatestId(pool, guildId) {
  const { rows } = await pool.query(
    `SELECT COALESCE(MAX(id), 0)::bigint AS m FROM persona_server_corpus WHERE guild_id = $1`,
    [guildId]
  );
  return Number(rows[0].m);
}

async function serverCorpusSample(pool, guildId, limit = 100) {
  const { rows } = await pool.query(
    `SELECT content FROM persona_server_corpus
     WHERE guild_id = $1
     ORDER BY created_at DESC LIMIT $2`,
    [guildId, limit]
  );
  return rows.map((r) => r.content);
}

async function serverCorpusPrune(pool, guildId, keep = 2000) {
  await pool.query(
    `DELETE FROM persona_server_corpus
     WHERE guild_id = $1
       AND id NOT IN (
         SELECT id FROM persona_server_corpus
         WHERE guild_id = $1
         ORDER BY id DESC LIMIT $2
       )`,
    [guildId, keep]
  );
}

async function serverCorpusPurgeChannel(pool, guildId, channelId) {
  const { rowCount } = await pool.query(
    `DELETE FROM persona_server_corpus WHERE guild_id = $1 AND channel_id = $2`,
    [guildId, channelId]
  );
  return rowCount;
}

async function serverCorpusReset(pool, guildId) {
  const { rowCount } = await pool.query(
    `DELETE FROM persona_server_corpus WHERE guild_id = $1`,
    [guildId]
  );
  await pool.query(
    `UPDATE persona_server_settings SET learned_count = 0 WHERE guild_id = $1`,
    [guildId]
  );
  await pool.query(
    `DELETE FROM persona_server_profile WHERE guild_id = $1`,
    [guildId]
  );
  return rowCount;
}

/* ═══════════════════════════════════════════════════════════════
   USER OPT-IN
   ═══════════════════════════════════════════════════════════════ */
async function userOptIn(pool, userId, guildId, minMessages = DEFAULTS.userMinMessages) {
  await pool.query(
    `INSERT INTO persona_user_optin (user_id, guild_id, min_messages)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, guild_id) DO NOTHING`,
    [userId, guildId, minMessages]
  );
}

async function userOptOut(pool, userId, guildId) {
  await pool.query(
    `DELETE FROM persona_user_optin WHERE user_id = $1 AND guild_id = $2`,
    [userId, guildId]
  );
  await pool.query(
    `DELETE FROM persona_user_profile WHERE user_id = $1 AND guild_id = $2`,
    [userId, guildId]
  );
  const { rowCount } = await pool.query(
    `DELETE FROM persona_user_corpus WHERE user_id = $1 AND guild_id = $2`,
    [userId, guildId]
  );
  return rowCount;
}

async function userIsOptedIn(pool, userId, guildId) {
  const { rows } = await pool.query(
    `SELECT min_messages, learned_count, opted_in_at
     FROM persona_user_optin
     WHERE user_id = $1 AND guild_id = $2`,
    [userId, guildId]
  );
  return rows[0]
    ? {
        optedIn: true,
        minMessages: rows[0].min_messages,
        learnedCount: rows[0].learned_count,
        optedInAt: rows[0].opted_in_at,
      }
    : { optedIn: false };
}

async function userListOptIns(pool, guildId) {
  const { rows } = await pool.query(
    `SELECT user_id, min_messages, learned_count, opted_in_at
     FROM persona_user_optin WHERE guild_id = $1
     ORDER BY opted_in_at DESC`,
    [guildId]
  );
  return rows;
}

async function userSetMinMessages(pool, userId, guildId, minMessages) {
  await pool.query(
    `UPDATE persona_user_optin SET min_messages = $3
     WHERE user_id = $1 AND guild_id = $2`,
    [userId, guildId, minMessages]
  );
}

/* ═══════════════════════════════════════════════════════════════
   USER PROFILE
   ═══════════════════════════════════════════════════════════════ */
async function getUserProfile(pool, userId, guildId) {
  const { rows } = await pool.query(
    `SELECT profile, manual_edit FROM persona_user_profile WHERE user_id = $1 AND guild_id = $2`,
    [userId, guildId]
  );
  if (!rows[0]) return { profile: emptyProfile(), manualEdit: null, exists: false };
  return {
    profile: { ...emptyProfile(), ...(rows[0].profile || {}) },
    manualEdit: rows[0].manual_edit || null,
    exists: true,
  };
}

async function saveUserProfile(pool, userId, guildId, profile, manualEdit = null) {
  await pool.query(
    `INSERT INTO persona_user_profile (user_id, guild_id, profile, manual_edit, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (user_id, guild_id) DO UPDATE SET
       profile     = $3,
       manual_edit = COALESCE($4, persona_user_profile.manual_edit),
       updated_at  = NOW()`,
    [userId, guildId, JSON.stringify(profile || {}), manualEdit ? JSON.stringify(manualEdit) : null]
  );
}

async function saveUserManualEdit(pool, userId, guildId, manualEdit) {
  await pool.query(
    `INSERT INTO persona_user_profile (user_id, guild_id, manual_edit, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (user_id, guild_id) DO UPDATE SET
       manual_edit = $3,
       updated_at  = NOW()`,
    [userId, guildId, manualEdit ? JSON.stringify(manualEdit) : null]
  );
}

/* ═══════════════════════════════════════════════════════════════
   USER CORPUS
   ═══════════════════════════════════════════════════════════════ */
async function addUserMessage(pool, { userId, guildId, channelId, content }) {
  await pool.query(
    `INSERT INTO persona_user_corpus (user_id, guild_id, channel_id, content)
     VALUES ($1, $2, $3, $4)`,
    [userId, guildId, channelId, content]
  );
  await pool.query(
    `UPDATE persona_user_optin
     SET learned_count = learned_count + 1
     WHERE user_id = $1 AND guild_id = $2`,
    [userId, guildId]
  );
}

async function userCorpusCount(pool, userId, guildId) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM persona_user_corpus
     WHERE user_id = $1 AND guild_id = $2`,
    [userId, guildId]
  );
  return rows[0].n;
}

async function userCorpusLatestId(pool, userId, guildId) {
  const { rows } = await pool.query(
    `SELECT COALESCE(MAX(id), 0)::bigint AS m FROM persona_user_corpus
     WHERE user_id = $1 AND guild_id = $2`,
    [userId, guildId]
  );
  return Number(rows[0].m);
}

async function userCorpusSince(pool, userId, guildId, sinceId) {
  const { rows } = await pool.query(
    `SELECT id, content FROM persona_user_corpus
     WHERE user_id = $1 AND guild_id = $2 AND id > $3
     ORDER BY id ASC LIMIT 500`,
    [userId, guildId, sinceId]
  );
  return rows;
}

async function userCorpusSample(pool, userId, guildId, limit = 100) {
  const { rows } = await pool.query(
    `SELECT content FROM persona_user_corpus
     WHERE user_id = $1 AND guild_id = $2
     ORDER BY created_at DESC LIMIT $3`,
    [userId, guildId, limit]
  );
  return rows.map((r) => r.content);
}

async function userCorpusPrune(pool, userId, guildId, keep = 2000) {
  await pool.query(
    `DELETE FROM persona_user_corpus
     WHERE user_id = $1 AND guild_id = $2
       AND id NOT IN (
         SELECT id FROM persona_user_corpus
         WHERE user_id = $1 AND guild_id = $2
         ORDER BY id DESC LIMIT $3
       )`,
    [userId, guildId, keep]
  );
}

/* ═══════════════════════════════════════════════════════════════
   BLOCKED WORDS (manual, per-guild)
   ═══════════════════════════════════════════════════════════════ */
async function blockedAdd(pool, guildId, word, addedBy) {
  await pool.query(
    `INSERT INTO persona_blocked_words (guild_id, word, added_by)
     VALUES ($1, $2, $3)
     ON CONFLICT (guild_id, word) DO NOTHING`,
    [guildId, word.toLowerCase().trim(), addedBy]
  );
}

async function blockedRemove(pool, guildId, word) {
  const { rowCount } = await pool.query(
    `DELETE FROM persona_blocked_words WHERE guild_id = $1 AND word = $2`,
    [guildId, word.toLowerCase().trim()]
  );
  return rowCount > 0;
}

async function blockedList(pool, guildId) {
  const { rows } = await pool.query(
    `SELECT word, added_by, added_at FROM persona_blocked_words
     WHERE guild_id = $1 ORDER BY word ASC`,
    [guildId]
  );
  return rows;
}

/* ═══════════════════════════════════════════════════════════════
   COOLDOWNS (server persona, per channel)
   ═══════════════════════════════════════════════════════════════ */
async function cooldownGet(pool, channelId) {
  const { rows } = await pool.query(
    `SELECT last_spoke_at FROM persona_cooldowns WHERE channel_id = $1`,
    [channelId]
  );
  return rows[0]?.last_spoke_at ? new Date(rows[0].last_spoke_at).getTime() : 0;
}

async function cooldownBump(pool, channelId) {
  await pool.query(
    `INSERT INTO persona_cooldowns (channel_id, last_spoke_at)
     VALUES ($1, NOW())
     ON CONFLICT (channel_id) DO UPDATE SET last_spoke_at = NOW()`,
    [channelId]
  );
}

/* ═══════════════════════════════════════════════════════════════
   AUDIT
   ═══════════════════════════════════════════════════════════════ */
async function logAudit(pool, { guildId, actorId, action, detail }) {
  try {
    await pool.query(
      `INSERT INTO persona_audit (guild_id, actor_id, action, detail)
       VALUES ($1, $2, $3, $4)`,
      [guildId, actorId || null, action, detail || null]
    );
  } catch {}
}

async function listAudit(pool, guildId, limit = 15) {
  const { rows } = await pool.query(
    `SELECT actor_id, action, detail, created_at
     FROM persona_audit WHERE guild_id = $1
     ORDER BY created_at DESC LIMIT $2`,
    [guildId, limit]
  );
  return rows;
}

module.exports = {
  // server settings
  getServerSettings, saveServerSettings,
  // server profile
  getServerProfile, saveServerProfile, saveServerManualEdit,
  // server corpus
  addServerMessage, serverCorpusCount, serverCorpusLatestId,
  serverCorpusSince, serverCorpusSample, serverCorpusPrune,
  serverCorpusPurgeChannel, serverCorpusReset,
  // user opt-in
  userOptIn, userOptOut, userIsOptedIn, userListOptIns, userSetMinMessages,
  // user profile
  getUserProfile, saveUserProfile, saveUserManualEdit,
  // user corpus
  addUserMessage, userCorpusCount, userCorpusLatestId,
  userCorpusSince, userCorpusSample, userCorpusPrune,
  // blocked words
  blockedAdd, blockedRemove, blockedList,
  // cooldowns
  cooldownGet, cooldownBump,
  // audit
  logAudit, listAudit,
};
