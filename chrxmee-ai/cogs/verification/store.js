/* cogs/verification/store.js — in-memory config + user state + attempts */

const configs = new Map();       // guildId -> config object
const userState = new Map();     // `${guildId}:${userId}` -> user state
const attempts = [];             // flat attempt log
let attemptId = 1;

function logSQL(sql, params) {
  console.log(`[SQL:verify] ${sql}`);
  if (params) console.log(`[SQL:verify] params:`, JSON.stringify(params));
}

/* ───── default config ───── */
function defaultConfig(guildId) {
  return {
    guildId,
    enabled: false,
    preset: null,

    /* panel */
    panelChannel: null,
    panelMessage: null,
    panelTitle: 'verify to enter',
    panelDescription: 'click the button below to verify and unlock the server.',
    panelImage: null,
    panelButtonLabel: 'verify',
    panelButtonColor: 0x5b7fd4,

    /* roles */
    roleUnverified: null,
    rolePending: null,
    roleVerified: null,
    roleQuarantine: null,
    roleBloxlink: null,
    roleModOverride: null,

    /* methods */
    methods: ['button'],
    methodPrimary: 'button',

    /* captcha */
    captchaStyle: 'text',
    captchaLength: 5,
    captchaCaseSensitive: false,
    captchaExpirySeconds: 300,
    captchaMaxAttempts: 3,
    captchaBrandColor: '#5b7fd4',

    /* dmcode */
    dmCodeLength: 6,
    dmCodeExpiryMinutes: 10,

    /* quiz */
    quizQuestions: [],          // [{q, choices, answer}]

    /* bloxlink */
    bloxlinkTrap: false,
    bloxlinkAutoDm: true,
    bloxlinkStripOnDetect: false,
    bloxlinkStripOnVerify: true,

    /* antiraid */
    antiraidEnabled: true,
    antiraidThreshold: 15,
    antiraidWindowSeconds: 60,
    antiraidForceCaptcha: true,
    antiraidDurationMinutes: 10,

    /* age gate */
    ageGateEnabled: false,
    ageGateDays: 7,
    ageGateAction: 'captcha',

    /* alt signals */
    altSignals: ['new_account', 'no_mutual', 'default_avatar'],
    altThreshold: 4,
    altSignalAction: 'captcha',

    /* punishment */
    failAction: 'quarantine',
    failQuarantineHours: 0,     // 0 = permanent

    /* rejoin */
    rememberDays: 7,            // 0 = never remember

    /* dm messages */
    dmOnJoin: 'welcome to **{server}**! verify here → {channel}',
    dmBloxlinkDetected: 'we detected you linked roblox via bloxlink. finish verification with chromed to unlock the server.',
    dmVerifySuccess: "you're verified in **{server}**. welcome!",
    dmVerifyFail: 'verification failed: {reason}. try again → {channel}',
    dmQuarantine: "you've been quarantined in **{server}**. staff will review.",
    dmAppeal: 'file an appeal here → {channel}',

    /* logging */
    logChannel: null,
    logAttempts: true,

    /* verify in dm */
    verifyInDm: false,

    /* post-verify welcome */
    verifiedWelcomeChannel: null,
    verifiedWelcomeMessage: 'welcome {user} to {server}!',

    updatedAt: Date.now(),
  };
}

module.exports = {
  /* ───── config ───── */
  getConfig(guildId) {
    if (!configs.has(guildId)) {
      logSQL(`SELECT * FROM verification_config WHERE guild_id = $1`, [guildId]);
      configs.set(guildId, defaultConfig(guildId));
    }
    return configs.get(guildId);
  },

  updateConfig(guildId, patch) {
    const cfg = this.getConfig(guildId);
    Object.assign(cfg, patch, { updatedAt: Date.now() });
    logSQL(
      `UPDATE verification_config SET enabled=$1, methods=$2, method_primary=$3, role_verified=$4, role_unverified=$5, role_quarantine=$6, remember_days=$7, fail_action=$8 WHERE guild_id=$9`,
      [cfg.enabled, JSON.stringify(cfg.methods), cfg.methodPrimary, cfg.roleVerified, cfg.roleUnverified, cfg.roleQuarantine, cfg.rememberDays, cfg.failAction, guildId]
    );
    return cfg;
  },

  resetConfig(guildId) {
    logSQL(`DELETE FROM verification_config WHERE guild_id = $1`, [guildId]);
    configs.set(guildId, defaultConfig(guildId));
    return configs.get(guildId);
  },

  /* ───── user state ───── */
  getUser(guildId, userId) {
    const key = `${guildId}:${userId}`;
    if (!userState.has(key)) {
      logSQL(`SELECT * FROM verification_users WHERE guild_id=$1 AND user_id=$2`, [guildId, userId]);
      userState.set(key, {
        guildId, userId,
        status: 'unverified',      // unverified | pending | verified | quarantined | failed
        method: null,
        attempts: 0,
        bloxlinkDetected: false,
        verifiedAt: null,
        quarantinedAt: null,
        expiresAt: null,
        suspiciousScore: 0,
        lastAttemptAt: 0,
      });
    }
    return userState.get(key);
  },

  setUser(guildId, userId, patch) {
    const user = this.getUser(guildId, userId);
    Object.assign(user, patch);
    logSQL(
      `UPDATE verification_users SET status=$1, method=$2, attempts=$3, verified_at=$4, expires_at=$5 WHERE guild_id=$6 AND user_id=$7`,
      [user.status, user.method, user.attempts, user.verifiedAt, user.expiresAt, guildId, userId]
    );
    return user;
  },

  /* ───── attempts ───── */
  recordAttempt(guildId, userId, method, result, reason) {
    const entry = { id: attemptId++, guildId, userId, method, result, reason, at: Date.now() };
    attempts.push(entry);
    if (attempts.length > 10000) attempts.shift();
    logSQL(
      `INSERT INTO verification_attempts (guild_id, user_id, method, result, reason) VALUES ($1,$2,$3,$4,$5)`,
      [guildId, userId, method, result, reason || null]
    );
    return entry;
  },

  getAttempts(guildId, limit = 20) {
    logSQL(`SELECT * FROM verification_attempts WHERE guild_id=$1 ORDER BY attempted_at DESC LIMIT $2`, [guildId, limit]);
    return attempts.filter(a => a.guildId === guildId).slice(-limit).reverse();
  },

  getStats(guildId) {
    logSQL(`SELECT result, count(*) FROM verification_attempts WHERE guild_id=$1 GROUP BY result`, [guildId]);
    const rows = attempts.filter(a => a.guildId === guildId);
    const stats = { verified: 0, failed: 0, expired: 0, bloxlink: 0, quarantined: 0 };
    for (const r of rows) {
      if (r.result === 'success') stats.verified++;
      else if (r.result === 'wrong') stats.failed++;
      else if (r.result === 'expired') stats.expired++;
      else if (r.reason === 'bloxlink_trap') stats.bloxlink++;
      else if (r.result === 'quarantine') stats.quarantined++;
    }
    return stats;
  },

  /* ───── helpers ───── */
  isVerifiedRemembered(guildId, userId) {
    const u = this.getUser(guildId, userId);
    if (u.status !== 'verified') return false;
    if (!u.expiresAt) return true;
    return Date.now() < u.expiresAt;
  },
};
