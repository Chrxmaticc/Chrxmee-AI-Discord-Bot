/* cogs/moderation/store.js — in-memory, fake sql */

const configs = new Map();
const cases = new Map();          // guildId -> Map<caseId, case>
const userCases = new Map();      // `${guildId}:${userId}` -> [caseId, ...]
const warns = new Map();          // `${guildId}:${userId}` -> [{ id, caseId, at, expiresAt }]
const notes = new Map();          // `${guildId}:${userId}` -> [{ id, modId, note, at }]
const watchlist = new Map();      // `${guildId}:${userId}` -> { addedBy, reason, at }
let caseCounter = new Map();      // guildId -> next number

function logSQL(sql, params) {
  console.log(`[SQL:mod] ${sql}`);
  if (params) console.log(`[SQL:mod] params:`, JSON.stringify(params));
}

function defaultConfig(guildId) {
  return {
    guildId,
    enabled: false,

    /* modlog */
    logChannel: null,
    logBans: null,
    logKicks: null,
    logMutes: null,
    logWarns: null,
    logNotes: null,
    logDeletes: null,
    logEdits: null,
    logJoins: null,
    logLeaves: null,
    logVoice: null,

    /* immune roles */
    immuneRoles: [],       // roles that can't be moderated
    immuneUsers: [],       // users that can't be moderated

    /* mod role (permission to use /mod) */
    modRole: null,
    adminRole: null,

    /* escalation */
    escalation: [],        // [{ warns, action, duration }]

    /* warn expiry */
    warnExpiryDays: 30,    // 0 = never expire

    /* DMs */
    dmOnWarn: true,
    dmOnMute: true,
    dmOnKick: true,
    dmOnBan: true,
    dmOnUnmute: false,
    dmOnUnban: false,

    /* dm templates */
    dmWarn: 'you were warned in **{server}**.\nreason: {reason}\ncase: `{case}`',
    dmMute: 'you were muted in **{server}** for **{duration}**.\nreason: {reason}\ncase: `{case}`',
    dmKick: 'you were kicked from **{server}**.\nreason: {reason}\ncase: `{case}`',
    dmBan: 'you were banned from **{server}**.\nreason: {reason}\ncase: `{case}`',
    dmUnmute: 'your mute in **{server}** was lifted.',
    dmUnban: 'your ban in **{server}** was lifted.',

    /* raid mode */
    raidEnabled: true,
    raidThreshold: 15,
    raidWindowSeconds: 60,
    raidDurationMinutes: 10,
    raidForceCaptcha: true,   // hooks into verification cog if present
    raidLockChannels: true,

    /* automod */
    automodEnabled: true,
    automodRules: ['mention_cap', 'invite'],
    automodMentionCap: 5,
    automodCapsPercent: 70,
    automodCapsMinLength: 12,
    automodSpamCount: 4,
    automodSpamWindow: 6,
    automodWhitelistDomains: ['discord.com', 'discord.gg', 'youtube.com', 'youtu.be', 'tenor.com', 'giphy.com'],
    automodAction: 'warn',   // warn | timeout | none
    automodIgnoreRoles: [],
    automodIgnoreChannels: [],

    updatedAt: Date.now(),
  };
}

module.exports = {
  /* ── config ── */
  getConfig(guildId) {
    if (!configs.has(guildId)) {
      logSQL(`SELECT * FROM moderation_config WHERE guild_id=$1`, [guildId]);
      configs.set(guildId, defaultConfig(guildId));
    }
    return configs.get(guildId);
  },
  updateConfig(guildId, patch) {
    const c = this.getConfig(guildId);
    Object.assign(c, patch, { updatedAt: Date.now() });
    logSQL(`UPDATE moderation_config SET enabled=$1, log_channel=$2, escalation=$3, warn_expiry_days=$4 WHERE guild_id=$5`,
      [c.enabled, c.logChannel, JSON.stringify(c.escalation), c.warnExpiryDays, guildId]);
    return c;
  },
  resetConfig(guildId) {
    logSQL(`DELETE FROM moderation_config WHERE guild_id=$1`, [guildId]);
    configs.set(guildId, defaultConfig(guildId));
    return configs.get(guildId);
  },

  /* ── cases ── */
  nextCaseId(guildId) {
    const n = (caseCounter.get(guildId) || 0) + 1;
    caseCounter.set(guildId, n);
    return `MC-${String(n).padStart(4, '0')}`;
  },
  createCase(guildId, data) {
    if (!cases.has(guildId)) cases.set(guildId, new Map());
    const id = this.nextCaseId(guildId);
    const c = {
      id, guildId,
      type: data.type,
      targetId: data.targetId,
      modId: data.modId,
      reason: data.reason || 'no reason provided',
      duration: data.duration || null,
      createdAt: Date.now(),
      expiresAt: data.duration ? Date.now() + data.duration : null,
      status: 'active',
      notes: [],
      refCase: data.refCase || null,
    };
    cases.get(guildId).set(id, c);
    const key = `${guildId}:${data.targetId}`;
    if (!userCases.has(key)) userCases.set(key, []);
    userCases.get(key).unshift(id);
    logSQL(
      `INSERT INTO mod_cases (guild_id, case_id, type, target_id, mod_id, reason, duration) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [guildId, id, c.type, c.targetId, c.modId, c.reason, c.duration]
    );
    return c;
  },
  getCase(guildId, caseId) {
    logSQL(`SELECT * FROM mod_cases WHERE guild_id=$1 AND case_id=$2`, [guildId, caseId]);
    return cases.get(guildId)?.get(caseId) || null;
  },
  updateCase(guildId, caseId, patch) {
    const c = this.getCase(guildId, caseId);
    if (!c) return null;
    Object.assign(c, patch);
    logSQL(`UPDATE mod_cases SET status=$1, notes=$2 WHERE case_id=$3`, [c.status, JSON.stringify(c.notes), caseId]);
    return c;
  },
  listCases(guildId, filter = {}) {
    const all = [...(cases.get(guildId)?.values() || [])];
    let out = all;
    if (filter.targetId) out = out.filter(c => c.targetId === filter.targetId);
    if (filter.modId)    out = out.filter(c => c.modId === filter.modId);
    if (filter.type)     out = out.filter(c => c.type === filter.type);
    if (filter.status)   out = out.filter(c => c.status === filter.status);
    return out.slice(0, filter.limit || 25);
  },
  recentCases(guildId, limit = 25) {
    logSQL(`SELECT * FROM mod_cases WHERE guild_id=$1 ORDER BY created_at DESC LIMIT $2`, [guildId, limit]);
    return [...(cases.get(guildId)?.values() || [])].sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
  },
  caseCount(guildId) {
    return cases.get(guildId)?.size || 0;
  },

  /* ── warns ── */
  addWarn(guildId, userId, warn) {
    const key = `${guildId}:${userId}`;
    if (!warns.has(key)) warns.set(key, []);
    const list = warns.get(key);
    const config = this.getConfig(guildId);
    const expiresAt = config.warnExpiryDays > 0 ? Date.now() + config.warnExpiryDays * 86400000 : null;
    const entry = { id: warn.caseId, caseId: warn.caseId, modId: warn.modId, reason: warn.reason, at: Date.now(), expiresAt };
    list.push(entry);
    logSQL(`INSERT INTO mod_warns (guild_id, user_id, case_id, expires_at) VALUES ($1,$2,$3,$4)`, [guildId, userId, warn.caseId, expiresAt]);
    return entry;
  },
  removeWarn(guildId, userId, caseId) {
    const key = `${guildId}:${userId}`;
    const list = warns.get(key) || [];
    const idx = list.findIndex(w => w.caseId === caseId);
    if (idx === -1) return false;
    list.splice(idx, 1);
    logSQL(`DELETE FROM mod_warns WHERE guild_id=$1 AND user_id=$2 AND case_id=$3`, [guildId, userId, caseId]);
    return true;
  },
  listWarns(guildId, userId) {
    const key = `${guildId}:${userId}`;
    const list = warns.get(key) || [];
    const now = Date.now();
    const active = list.filter(w => !w.expiresAt || w.expiresAt > now);
    const expired = list.filter(w => w.expiresAt && w.expiresAt <= now);
    return { active, expired, all: list };
  },
  countActiveWarns(guildId, userId) {
    return this.listWarns(guildId, userId).active.length;
  },

  /* ── notes ── */
  addNote(guildId, userId, note) {
    const key = `${guildId}:${userId}`;
    if (!notes.has(key)) notes.set(key, []);
    const entry = { id: `NOTE-${Date.now().toString(36)}`, ...note, at: Date.now() };
    notes.get(key).unshift(entry);
    logSQL(`INSERT INTO mod_notes (guild_id, user_id, mod_id, note) VALUES ($1,$2,$3,$4)`, [guildId, userId, note.modId, note.note]);
    return entry;
  },
  listNotes(guildId, userId) {
    return notes.get(`${guildId}:${userId}`) || [];
  },

  /* ── watchlist ── */
  watch(guildId, userId, data) {
    const key = `${guildId}:${userId}`;
    watchlist.set(key, { addedBy: data.modId, reason: data.reason, at: Date.now() });
    logSQL(`INSERT INTO mod_watchlist (guild_id, user_id, mod_id, reason) VALUES ($1,$2,$3,$4)`, [guildId, userId, data.modId, data.reason]);
  },
  unwatch(guildId, userId) {
    const key = `${guildId}:${userId}`;
    const had = watchlist.delete(key);
    if (had) logSQL(`DELETE FROM mod_watchlist WHERE guild_id=$1 AND user_id=$2`, [guildId, userId]);
    return had;
  },
  isWatched(guildId, userId) {
    return watchlist.has(`${guildId}:${userId}`);
  },
  listWatchlist(guildId) {
    const out = [];
    for (const [k, v] of watchlist) {
      const [gid, uid] = k.split(':');
      if (gid === guildId) out.push({ userId: uid, ...v });
    }
    return out;
  },

  /* ── stats ── */
  stats(guildId) {
    const all = [...(cases.get(guildId)?.values() || [])];
    const byType = {};
    for (const c of all) byType[c.type] = (byType[c.type] || 0) + 1;
    const activeWarns = [...warns.entries()]
      .filter(([k]) => k.startsWith(`${guildId}:`))
      .reduce((n, [, list]) => n + list.filter(w => !w.expiresAt || w.expiresAt > Date.now()).length, 0);
    const topMods = {};
    for (const c of all) if (c.modId) topMods[c.modId] = (topMods[c.modId] || 0) + 1;
    return {
      total: all.length,
      byType,
      activeWarns,
      topMods: Object.entries(topMods).sort((a, b) => b[1] - a[1]).slice(0, 5),
    };
  },
};
