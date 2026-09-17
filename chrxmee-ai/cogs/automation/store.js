/* cogs/automation/store.js — postgres-backed */
let pool = null;
function setPool(p) { pool = p; }

function rowToFlow(r) {
  return {
    id: r.id,
    guildId: Number(r.guild_id),
    name: r.name,
    enabled: r.enabled,
    trigger: r.trigger,
    conditions: r.conditions || [],
    conditionMode: r.condition_mode,
    actions: r.actions || [],
    cooldownSeconds: r.cooldown_seconds,
    createdBy: r.created_by ? Number(r.created_by) : null,
    createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
    errorCount: r.error_count || 0,
    fireCount: r.fire_count || 0,
  };
}

module.exports = {
  setPool,
  async create(guildId, data) {
    const r = await pool.query(
      `INSERT INTO automation_flows (guild_id, name, enabled, trigger, conditions, condition_mode, actions, cooldown_seconds, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [guildId, data.name, data.enabled === true, JSON.stringify(data.trigger || null), JSON.stringify(data.conditions || []), data.conditionMode || 'all', JSON.stringify(data.actions || []), data.cooldownSeconds ?? 5, data.createdBy || null]
    );
    return rowToFlow(r.rows[0]);
  },
  async get(id) {
    const r = await pool.query(`SELECT * FROM automation_flows WHERE id = $1`, [id]);
    return r.rows[0] ? rowToFlow(r.rows[0]) : null;
  },
  async listForGuild(guildId) {
    const r = await pool.query(`SELECT * FROM automation_flows WHERE guild_id = $1 ORDER BY id ASC`, [guildId]);
    return r.rows.map(rowToFlow);
  },
  async listEnabledFor(guildId, triggerType) {
    const r = await pool.query(
      `SELECT * FROM automation_flows WHERE guild_id = $1 AND enabled = true AND trigger->>'type' = $2 ORDER BY id ASC`,
      [guildId, triggerType]
    );
    return r.rows.map(rowToFlow);
  },
  async allScheduled() {
    const r = await pool.query(`SELECT * FROM automation_flows WHERE enabled = true AND trigger->>'type' = 'scheduled' ORDER BY id ASC`);
    return r.rows.map(rowToFlow);
  },
  async update(id, patch) {
    const r = await pool.query(
      `UPDATE automation_flows SET
        name = COALESCE($1, name),
        enabled = COALESCE($2, enabled),
        trigger = COALESCE($3, trigger),
        conditions = COALESCE($4, conditions),
        condition_mode = COALESCE($5, condition_mode),
        actions = COALESCE($6, actions),
        cooldown_seconds = COALESCE($7, cooldown_seconds),
        updated_at = NOW()
       WHERE id = $8 RETURNING *`,
      [
        patch.name ?? null,
        typeof patch.enabled === 'boolean' ? patch.enabled : null,
        patch.trigger !== undefined ? JSON.stringify(patch.trigger) : null,
        patch.conditions !== undefined ? JSON.stringify(patch.conditions) : null,
        patch.conditionMode ?? null,
        patch.actions !== undefined ? JSON.stringify(patch.actions) : null,
        patch.cooldownSeconds ?? null,
        id,
      ]
    );
    return r.rows[0] ? rowToFlow(r.rows[0]) : null;
  },
  async remove(id) {
    const r = await pool.query(`DELETE FROM automation_flows WHERE id = $1`, [id]);
    return r.rowCount > 0;
  },
  async bumpError(id) {
    await pool.query(`UPDATE automation_flows SET error_count = error_count + 1 WHERE id = $1`, [id]);
  },
  async recordFire(id, entry) {
    await pool.query(
      `INSERT INTO automation_fires (flow_id, user_id, ok, error) VALUES ($1,$2,$3,$4)`,
      [id, entry.userId, entry.ok === true, entry.error || null]
    );
    await pool.query(`UPDATE automation_flows SET fire_count = fire_count + 1 WHERE id = $1`, [id]);
    if (!entry.ok) {
      const r = await pool.query(`SELECT error_count FROM automation_flows WHERE id = $1`, [id]);
      if (r.rows[0] && r.rows[0].error_count >= 5) {
        await pool.query(`UPDATE automation_flows SET enabled = false WHERE id = $1`, [id]);
      }
    }
  },
  async setEnabledAll(guildId, enabled) {
    const r = await pool.query(`UPDATE automation_flows SET enabled = $1 WHERE guild_id = $2`, [enabled, guildId]);
    return r.rowCount;
  },
  async getRecentFires(guildId, limit = 20) {
    const r = await pool.query(
      `SELECT f.*, a.name AS flow_name FROM automation_fires f
       JOIN automation_flows a ON a.id = f.flow_id
       WHERE a.guild_id = $1 ORDER BY f.fired_at DESC LIMIT $2`,
      [guildId, limit]
    );
    return r.rows.map(x => ({
      userId: x.user_id, ok: x.ok, error: x.error,
      at: new Date(x.fired_at).getTime(), name: x.flow_name,
    }));
  },
};
