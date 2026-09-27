/* cogs/verification/store.js — postgres-backed */

let pool = null;
function setPool(p) { pool = p; console.log('[verify] pool attached:', !!p); }
function requirePool() { if (!pool) throw new Error('verification store: pool not attached'); }

/* ── default config (used when no row exists yet) ── */
function defaultConfig(guildId) {
  return {
    guildId,
    enabled: false,
    preset: null,
    methods: ['button'],
    methodPrimary: 'button',
    panelChannel: null,
    panelMessage: null,
    panelTitle: 'verify to enter',
    panelDescription: 'click the button below to verify and unlock the server.',
    panelImage: null,
    panelButtonLabel: 'verify',
    panelButtonColor: 0x5b7fd4,
    roleUnverified: null,
    rolePending: null,
    roleVerified: null,
    roleQuarantine: null,
    roleBloxlink: null,
    roleModOverride: null,
    captchaStyle: 'text',
    captchaLength: 5,
    captchaCaseSensitive: false,
    captchaExpirySeconds: 300,
    captchaMaxAttempts: 3,
    captchaBrandColor: '#5b7fd4',
    dmCodeLength: 6,
    dmCodeExpiryMinutes: 10,
    quizQuestions: [],
    bloxlinkTrap: false,
    bloxlinkAutoDm: true,
    bloxlinkStripOnDetect: false,
    bloxlinkStripOnVerify: true,
    antiraidEnabled: true,
    antiraidThreshold: 15,
    antiraidWindowSeconds: 60,
    antiraidForceCaptcha: true,
    antiraidDurationMinutes: 10,
    ageGateEnabled: false,
    ageGateDays: 7,
    ageGateAction: 'captcha',
    altSignals: ['new_account', 'no_mutual', 'default_avatar'],
    altThreshold: 4,
    altSignalAction: 'captcha',
    failAction: 'quarantine',
    failQuarantineHours: 0,
    rememberDays: 7,
    dmOnJoin: 'welcome to **{server}**! verify here → {channel}',
    dmBloxlinkDetected: 'we detected you linked roblox via bloxlink. finish verification with chromed to unlock the server.',
    dmVerifySuccess: "you're verified in **{server}**. welcome!",
    dmVerifyFail: 'verification failed: {reason}. try again → {channel}',
    dmQuarantine: "you've been quarantined in **{server}**. staff will review.",
    dmAppeal: 'file an appeal here → {channel}',
    logChannel: null,
    logAttempts: true,
    verifyInDm: false,
    verifiedWelcomeChannel: null,
    verifiedWelcomeMessage: 'welcome {user} to {server}!',
  };
}

/* ── row → config object (db columns are snake_case, js uses camelCase) ── */
function rowToConfig(r) {
  if (!r) return null;
  return {
    guildId: r.guild_id,
    enabled: r.enabled,
    preset: r.preset,
    methods: r.methods || ['button'],
    methodPrimary: r.method_primary,
    panelChannel: r.panel_channel,
    panelMessage: r.panel_message,
    panelTitle: r.panel_title,
    panelDescription: r.panel_description,
    panelImage: r.panel_image,
    panelButtonLabel: r.panel_button_label,
    panelButtonColor: r.panel_button_color,
    roleUnverified: r.role_unverified,
    rolePending: r.role_pending,
    roleVerified: r.role_verified,
    roleQuarantine: r.role_quarantine,
    roleBloxlink: r.role_bloxlink,
    roleModOverride: r.role_mod_override,
    captchaStyle: r.captcha_style,
    captchaLength: r.captcha_length,
    captchaCaseSensitive: r.captcha_case_sensitive,
    captchaExpirySeconds: r.captcha_expiry_seconds,
    captchaMaxAttempts: r.captcha_max_attempts,
    captchaBrandColor: r.captcha_brand_color,
    dmCodeLength: r.dm_code_length,
    dmCodeExpiryMinutes: r.dm_code_expiry_minutes,
    quizQuestions: r.quiz_questions || [],
    bloxlinkTrap: r.bloxlink_trap,
    bloxlinkAutoDm: r.bloxlink_auto_dm,
    bloxlinkStripOnDetect: r.bloxlink_strip_on_detect,
    bloxlinkStripOnVerify: r.bloxlink_strip_on_verify,
    antiraidEnabled: r.antiraid_enabled,
    antiraidThreshold: r.antiraid_threshold,
    antiraidWindowSeconds: r.antiraid_window_seconds,
    antiraidForceCaptcha: r.antiraid_force_captcha,
    antiraidDurationMinutes: r.antiraid_duration_minutes,
    ageGateEnabled: r.age_gate_enabled,
    ageGateDays: r.age_gate_days,
    ageGateAction: r.age_gate_action,
    altSignals: r.alt_signals || [],
    altThreshold: r.alt_threshold,
    altSignalAction: r.alt_signal_action,
    failAction: r.fail_action,
    failQuarantineHours: r.fail_quarantine_hours,
    rememberDays: r.remember_days,
    dmOnJoin: r.dm_on_join,
    dmBloxlinkDetected: r.dm_bloxlink_detected,
    dmVerifySuccess: r.dm_verify_success,
    dmVerifyFail: r.dm_verify_fail,
    dmQuarantine: r.dm_quarantine,
    dmAppeal: r.dm_appeal,
    logChannel: r.log_channel,
    logAttempts: r.log_attempts,
    verifyInDm: r.verify_in_dm,
    verifiedWelcomeChannel: r.verified_welcome_channel,
    verifiedWelcomeMessage: r.verified_welcome_message,
    updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : Date.now(),
  };
}

/* ── partial config patch → sql column map ── */
const COL_MAP = {
  enabled: 'enabled',
  preset: 'preset',
  methods: 'methods',
  methodPrimary: 'method_primary',
  panelChannel: 'panel_channel',
  panelMessage: 'panel_message',
  panelTitle: 'panel_title',
  panelDescription: 'panel_description',
  panelImage: 'panel_image',
  panelButtonLabel: 'panel_button_label',
  panelButtonColor: 'panel_button_color',
  roleUnverified: 'role_unverified',
  rolePending: 'role_pending',
  roleVerified: 'role_verified',
  roleQuarantine: 'role_quarantine',
  roleBloxlink: 'role_bloxlink',
  roleModOverride: 'role_mod_override',
  captchaStyle: 'captcha_style',
  captchaLength: 'captcha_length',
  captchaCaseSensitive: 'captcha_case_sensitive',
  captchaExpirySeconds: 'captcha_expiry_seconds',
  captchaMaxAttempts: 'captcha_max_attempts',
  captchaBrandColor: 'captcha_brand_color',
  dmCodeLength: 'dm_code_length',
  dmCodeExpiryMinutes: 'dm_code_expiry_minutes',
  quizQuestions: 'quiz_questions',
  bloxlinkTrap: 'bloxlink_trap',
  bloxlinkAutoDm: 'bloxlink_auto_dm',
  bloxlinkStripOnDetect: 'bloxlink_strip_on_detect',
  bloxlinkStripOnVerify: 'bloxlink_strip_on_verify',
  antiraidEnabled: 'antiraid_enabled',
  antiraidThreshold: 'antiraid_threshold',
  antiraidWindowSeconds: 'antiraid_window_seconds',
  antiraidForceCaptcha: 'antiraid_force_captcha',
  antiraidDurationMinutes: 'antiraid_duration_minutes',
  ageGateEnabled: 'age_gate_enabled',
  ageGateDays: 'age_gate_days',
  ageGateAction: 'age_gate_action',
  altSignals: 'alt_signals',
  altThreshold: 'alt_threshold',
  altSignalAction: 'alt_signal_action',
  failAction: 'fail_action',
  failQuarantineHours: 'fail_quarantine_hours',
  rememberDays: 'remember_days',
  dmOnJoin: 'dm_on_join',
  dmBloxlinkDetected: 'dm_bloxlink_detected',
  dmVerifySuccess: 'dm_verify_success',
  dmVerifyFail: 'dm_verify_fail',
  dmQuarantine: 'dm_quarantine',
  dmAppeal: 'dm_appeal',
  logChannel: 'log_channel',
  logAttempts: 'log_attempts',
  verifyInDm: 'verify_in_dm',
  verifiedWelcomeChannel: 'verified_welcome_channel',
  verifiedWelcomeMessage: 'verified_welcome_message',
};

const JSON_COLS = new Set(['methods', 'quizQuestions', 'altSignals']);

module.exports = {
  setPool,

  /* ═══════════ CONFIG ═══════════ */
  async getConfig(guildId) {
    requirePool();
    const r = await pool.query(`SELECT * FROM verification_config WHERE guild_id = $1`, [guildId]);
    if (!r.rows[0]) {
      // create default row lazily
      const def = defaultConfig(guildId);
      await pool.query(
        `INSERT INTO verification_config (guild_id, methods, method_primary, dm_on_join, dm_bloxlink_detected, dm_verify_success, dm_verify_fail, dm_quarantine, dm_appeal, quiz_questions, alt_signals, verified_welcome_message)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (guild_id) DO NOTHING`,
        [guildId, JSON.stringify(def.methods), def.methodPrimary, def.dmOnJoin, def.dmBloxlinkDetected, def.dmVerifySuccess, def.dmVerifyFail, def.dmQuarantine, def.dmAppeal, JSON.stringify(def.quizQuestions), JSON.stringify(def.altSignals), def.verifiedWelcomeMessage]
      );
      return def;
    }
    return rowToConfig(r.rows[0]);
  },

  async updateConfig(guildId, patch) {
    requirePool();
    const sets = [];
    const values = [];
    let i = 1;

    for (const [key, val] of Object.entries(patch)) {
      const col = COL_MAP[key];
      if (!col) continue;
      sets.push(`${col} = $${i}`);
      values.push(JSON_COLS.has(key) ? JSON.stringify(val) : val);
      i++;
    }

    if (!sets.length) return this.getConfig(guildId);

    sets.push(`updated_at = NOW()`);
    values.push(guildId);

    await pool.query(
      `UPDATE verification_config SET ${sets.join(', ')} WHERE guild_id = $${i}`,
      values
    );
    return this.getConfig(guildId);
  },

  async resetConfig(guildId) {
    requirePool();
    await pool.query(`DELETE FROM verification_config WHERE guild_id = $1`, [guildId]);
    await pool.query(`DELETE FROM verification_users WHERE guild_id = $1`, [guildId]);
    await pool.query(`DELETE FROM verification_attempts WHERE guild_id = $1`, [guildId]);
    return this.getConfig(guildId);
  },

  /* ═══════════ USER STATE ═══════════ */
  async getUser(guildId, userId) {
    requirePool();
    const r = await pool.query(`SELECT * FROM verification_users WHERE guild_id = $1 AND user_id = $2`, [guildId, userId]);
    if (!r.rows[0]) {
      return {
        guildId, userId,
        status: 'unverified', method: null, attempts: 0,
        bloxlinkDetected: false, verifiedAt: null, expiresAt: null,
        quarantinedAt: null, suspiciousScore: 0, lastAttemptAt: 0,
      };
    }
    const row = r.rows[0];
    return {
      guildId: row.guild_id,
      userId: row.user_id,
      status: row.status,
      method: row.method,
      attempts: row.attempts || 0,
      bloxlinkDetected: row.bloxlink_detected,
      verifiedAt: row.verified_at ? new Date(row.verified_at).getTime() : null,
      expiresAt: row.expires_at ? new Date(row.expires_at).getTime() : null,
      quarantinedAt: row.quarantined_at ? new Date(row.quarantined_at).getTime() : null,
      suspiciousScore: row.suspicious_score || 0,
      lastAttemptAt: row.last_attempt_at ? new Date(row.last_attempt_at).getTime() : 0,
    };
  },

  async setUser(guildId, userId, patch) {
    requirePool();
    // ensure row exists
    await pool.query(
      `INSERT INTO verification_users (guild_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [guildId, userId]
    );

    const current = await this.getUser(guildId, userId);
    const merged = { ...current, ...patch };

    await pool.query(
      `UPDATE verification_users SET
        status = $1,
        method = $2,
        attempts = $3,
        bloxlink_detected = $4,
        verified_at = $5,
        expires_at = $6,
        quarantined_at = $7,
        suspicious_score = $8,
        last_attempt_at = $9
       WHERE guild_id = $10 AND user_id = $11`,
      [
        merged.status,
        merged.method,
        merged.attempts,
        merged.bloxlinkDetected,
        merged.verifiedAt ? new Date(merged.verifiedAt) : null,
        merged.expiresAt ? new Date(merged.expiresAt) : null,
        merged.quarantinedAt ? new Date(merged.quarantinedAt) : null,
        merged.suspiciousScore || 0,
        merged.lastAttemptAt ? new Date(merged.lastAttemptAt) : null,
        guildId, userId,
      ]
    );
    return merged;
  },

  /* ═══════════ ATTEMPTS ═══════════ */
  async recordAttempt(guildId, userId, method, result, reason) {
    requirePool();
    await pool.query(
      `INSERT INTO verification_attempts (guild_id, user_id, method, result, reason) VALUES ($1,$2,$3,$4,$5)`,
      [guildId, userId, method, result, reason || null]
    );
  },

  async getAttempts(guildId, limit = 20) {
    requirePool();
    const r = await pool.query(
      `SELECT * FROM verification_attempts WHERE guild_id = $1 ORDER BY attempted_at DESC LIMIT $2`,
      [guildId, limit]
    );
    return r.rows.map(row => ({
      id: row.id,
      guildId: row.guild_id,
      userId: row.user_id,
      method: row.method,
      result: row.result,
      reason: row.reason,
      at: new Date(row.attempted_at).getTime(),
    }));
  },

  async getStats(guildId) {
    requirePool();
    const r = await pool.query(
      `SELECT result, reason, COUNT(*)::int AS count FROM verification_attempts WHERE guild_id = $1 GROUP BY result, reason`,
      [guildId]
    );
    const stats = { verified: 0, failed: 0, expired: 0, bloxlink: 0, quarantined: 0 };
    for (const row of r.rows) {
      if (row.result === 'success') stats.verified += row.count;
      else if (row.result === 'wrong') stats.failed += row.count;
      else if (row.result === 'expired') stats.expired += row.count;
      else if (row.reason === 'bloxlink_trap') stats.bloxlink += row.count;
      else if (row.result === 'quarantine') stats.quarantined += row.count;
    }
    return stats;
  },

  /* ═══════════ HELPERS ═══════════ */
  async isVerifiedRemembered(guildId, userId) {
    const u = await this.getUser(guildId, userId);
    if (u.status !== 'verified') return false;
    if (!u.expiresAt) return true;
    return Date.now() < u.expiresAt;
  },
};
