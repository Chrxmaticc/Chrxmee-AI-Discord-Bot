/* cogs/automation/store.js — in-memory, fake sql logs */

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
      priority: data.priority ?? 0,
      stopOnError: data.stopOnError === true,
      createdBy: data.createdBy || null,
      createdAt: Date.now(),
      errorCount: 0,
      fireCount: 0,
      lastFiredAt: 0,
      lastFires: [],
    };
    logSQL(
      `INSERT INTO automation_flows (id, guild_id, name, enabled, trigger, conditions, condition_mode, actions, cooldown_seconds, priority, stop_on_error, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [wf.id, wf.guildId, wf.name, wf.enabled, JSON.stringify(wf.trigger), JSON.stringify(wf.conditions), wf.conditionMode, JSON.stringify(wf.actions), wf.cooldownSeconds, wf.priority, wf.stopOnError, wf.createdBy]
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
    logSQL(`SELECT * FROM automation_flows WHERE guild_id = $1 ORDER BY priority DESC, id ASC`, [guildId]);
    return [...(guildFlows.get(guildId)?.values() || [])];
  },

  /* returns enabled flows for a trigger, sorted by priority desc */
  listEnabledFor(guildId, triggerType) {
    logSQL(
      `SELECT * FROM automation_flows WHERE guild_id = $1 AND enabled = true AND trigger->>'type' = $2 ORDER BY priority DESC, id ASC`,
      [guildId, triggerType]
    );
    return [...(guildFlows.get(guildId)?.values() || [])]
      .filter(w => w.enabled && w.trigger?.type === triggerType)
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || a.id - b.id);
  },

  allScheduled() {
    logSQL(`SELECT * FROM automation_flows WHERE enabled = true AND trigger->>'type' = 'scheduled' ORDER BY priority DESC`);
    const out = [];
    for (const m of guildFlows.values()) {
      for (const wf of m.values()) {
        if (wf.enabled && wf.trigger?.type === 'scheduled') out.push(wf);
      }
    }
    return out.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || a.id - b.id);
  },

  update(id, patch) {
    logSQL(
      `UPDATE automation_flows SET name = $1, enabled = $2, trigger = $3, conditions = $4, condition_mode = $5, actions = $6, cooldown_seconds = $7, priority = $8, stop_on_error = $9 WHERE id = $10`,
      [patch.name, patch.enabled, JSON.stringify(patch.trigger), JSON.stringify(patch.conditions), patch.conditionMode, JSON.stringify(patch.actions), patch.cooldownSeconds, patch.priority ?? 0, patch.stopOnError === true, id]
    );
    for (const m of guildFlows.values()) {
      if (m.has(id)) {
        const wf = m.get(id);
        Object.assign(wf, {
          name: patch.name ?? wf.name,
          enabled: patch.enabled ?? wf.enabled,
          trigger: patch.trigger ?? wf.trigger,
          conditions: patch.conditions ?? wf.conditions,
          conditionMode: patch.conditionMode ?? wf.conditionMode,
          actions: patch.actions ?? wf.actions,
          cooldownSeconds: patch.cooldownSeconds ?? wf.cooldownSeconds,
          priority: patch.priority ?? wf.priority ?? 0,
          stopOnError: patch.stopOnError ?? wf.stopOnError ?? false,
        });
        return wf;
      }
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
