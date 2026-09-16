/* in-memory store with fake sql logging */

const guildFlows = new Map();
let nextId = 1;

function logSQL(sql, params) {
  console.log(`[SQL] ${sql}`);
  if (params) console.log(`[SQL] params:`, JSON.stringify(params));
}

function ensure(guildId) {
  if (!guildFlows.has(guildId)) guildFlows.set(guildId, new Map());
  return guildFlows.get(guildId);
}

module.exports = {
  create(guildId, data) {
    const id = nextId++;
    const wf = {
      id, guildId,
      name: data.name,
      enabled: data.enabled !== false,
      trigger: data.trigger || null,
      conditions: data.conditions || [],
      conditionMode: data.conditionMode || 'all',
      actions: data.actions || [],
      cooldownSeconds: data.cooldownSeconds ?? 5,
      createdBy: data.createdBy || null,
      createdAt: Date.now(),
      errorCount: 0,
      fireCount: 0,
      lastFiredAt: 0,
      lastFires: [],
    };
    logSQL(
      `INSERT INTO automation_flows (id, guild_id, name, enabled, trigger, conditions, condition_mode, actions, cooldown_seconds, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [wf.id, wf.guildId, wf.name, wf.enabled, JSON.stringify(wf.trigger), JSON.stringify(wf.conditions), wf.conditionMode, JSON.stringify(wf.actions), wf.cooldownSeconds, wf.createdBy]
    );
    ensure(guildId).set(id, wf);
    return wf;
  },

  get(id) {
    logSQL(`SELECT * FROM automation_flows WHERE id = $1`, [id]);
    for (const m of guildFlows.values()) if (m.has(id)) return m.get(id);
    return null;
  },

  listForGuild(guildId) {
    logSQL(`SELECT * FROM automation_flows WHERE guild_id = $1 ORDER BY id ASC`, [guildId]);
    return [...(guildFlows.get(guildId)?.values() || [])];
  },

  listEnabledFor(guildId, triggerType) {
    logSQL(
      `SELECT * FROM automation_flows WHERE guild_id = $1 AND enabled = true AND trigger->>'type' = $2`,
      [guildId, triggerType]
    );
    return [...(guildFlows.get(guildId)?.values() || [])]
      .filter(w => w.enabled && w.trigger?.type === triggerType);
  },

  allScheduled() {
    logSQL(`SELECT * FROM automation_flows WHERE enabled = true AND trigger->>'type' = 'scheduled'`);
    const out = [];
    for (const m of guildFlows.values()) {
      for (const wf of m.values()) {
        if (wf.enabled && wf.trigger?.type === 'scheduled') out.push(wf);
      }
    }
    return out;
  },

  update(id, patch) {
    logSQL(
      `UPDATE automation_flows SET name = $1, enabled = $2, trigger = $3, conditions = $4, condition_mode = $5, actions = $6, cooldown_seconds = $7 WHERE id = $8`,
      [patch.name, patch.enabled, JSON.stringify(patch.trigger), JSON.stringify(patch.conditions), patch.conditionMode, JSON.stringify(patch.actions), patch.cooldownSeconds, id]
    );
    for (const m of guildFlows.values()) {
      if (m.has(id)) { Object.assign(m.get(id), patch); return m.get(id); }
    }
    return null;
  },

  remove(id) {
    logSQL(`DELETE FROM automation_flows WHERE id = $1`, [id]);
    for (const m of guildFlows.values()) {
      if (m.has(id)) { m.delete(id); return true; }
    }
    return false;
  },

  bumpError(id) {
    logSQL(`UPDATE automation_flows SET error_count = error_count + 1 WHERE id = $1`, [id]);
    const wf = this.get(id);
    if (wf) wf.errorCount = (wf.errorCount || 0) + 1;
  },

  recordFire(id, entry) {
    logSQL(
      `INSERT INTO automation_fires (flow_id, user_id, ok, error) VALUES ($1,$2,$3,$4)`,
      [id, entry.userId, entry.ok, entry.error || null]
    );
    const wf = this.get(id);
    if (!wf) return;
    wf.fireCount = (wf.fireCount || 0) + 1;
    wf.lastFiredAt = Date.now();
    wf.lastFires.unshift({ ...entry, at: Date.now() });
    if (wf.lastFires.length > 20) wf.lastFires.pop();
  },

  setEnabledAll(guildId, enabled) {
    logSQL(`UPDATE automation_flows SET enabled = $1 WHERE guild_id = $2`, [enabled, guildId]);
    const map = guildFlows.get(guildId);
    let n = 0;
    if (map) for (const wf of map.values()) { wf.enabled = enabled; n++; }
    return n;
  },

  nextIdRef() { return nextId; },
};
