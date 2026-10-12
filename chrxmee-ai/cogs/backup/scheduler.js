// cogs/backup/scheduler.js
const zlib = require("node:zlib");
const { promisify } = require("node:util");
const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

const { CONFIG, E, FREQ_LABELS, formatBytes } = require("./constants");
const store = require("./store");
const { captureGuild, restoreGuild } = require("./engine");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ═══════════════════════════════════════════════════════════════
   CORE — create a backup (used by both manual + scheduled)
   Returns { ok, id, size, snapshot } or { ok: false, reason, message }
   ═══════════════════════════════════════════════════════════════ */
async function makeBackup(pool, guild, { name, createdBy, panic = false, progress = () => {} }) {
  const snapshot = await captureGuild(guild, progress, { panic });

  progress("compressing");
  const json = JSON.stringify(snapshot);
  const gz = await gzip(json);

  const used = await store.getUsedBytes(pool, guild.id);
  const quota = await store.getQuota(pool, guild.id);
  if (used + gz.length > quota) {
    return {
      ok: false,
      reason: "quota",
      used, quota, need: gz.length,
    };
  }

  progress("saving");
  const row = await store.insertBackup(pool, {
    guildId: guild.id, name, createdBy, payload: gz,
  });

  await store.logAudit(pool, {
    guildId: guild.id, actorId: createdBy,
    action: panic ? "panic" : "create",
    backupId: row.id, detail: name,
  });

  return { ok: true, id: row.id, size: gz.length, snapshot, createdAt: row.created_at };
}

/* ═══════════════════════════════════════════════════════════════
   SCHEDULED BACKUPS TICK
   ═══════════════════════════════════════════════════════════════ */
async function runDueBackups(client) {
  const pool = client.pool;
  const due = await store.dueScheduledBackups(pool);

  for (const row of due) {
    const guild = client.guilds.cache.get(row.guild_id);
    if (!guild) {
      await store.advanceScheduledBackup(pool, row.id, row.freq);
      continue;
    }

    try {
      const result = await makeBackup(pool, guild, {
        name: `${row.name} (auto)`,
        createdBy: row.created_by,
        panic: false,
      });

      const notify = await findNotifyChannel(client, pool, guild.id);
      if (notify) {
        const msg = result.ok
          ? `${E.success} scheduled backup \`${row.name}\` saved — **${formatBytes(result.size)}** · id \`#${result.id}\``
          : `${E.warning} scheduled backup skipped — quota full (${formatBytes(result.used)}/${formatBytes(result.quota)})`;
        notify.send(msg).catch(() => {});
      }
    } catch (err) {
      console.error(`[backup-sched] ${guild.id} failed:`, err.message);
    }

    await store.advanceScheduledBackup(pool, row.id, row.freq);
    await sleep(500);
  }
}

/* ═══════════════════════════════════════════════════════════════
   SCHEDULED RESTORES TICK
   ═══════════════════════════════════════════════════════════════ */
async function runDueRestores(client) {
  const pool = client.pool;
  const due = await store.dueScheduledRestores(pool);

  for (const row of due) {
    await store.markRestoreExecuted(pool, row.id);

    const guild = client.guilds.cache.get(row.guild_id);
    if (!guild) continue;

    const srcGuild = row.source_guild || row.guild_id;
    const backup = await store.getBackup(pool, row.backup_id, srcGuild);
    if (!backup) {
      await notifyScheduledFailure(client, row, "backup no longer exists");
      continue;
    }

    let snapshot;
    try {
      snapshot = JSON.parse((await gunzip(backup.payload)).toString("utf8"));
    } catch {
      await notifyScheduledFailure(client, row, "backup payload corrupted");
      continue;
    }

    // pre-restore safety net
    try {
      const pre = await makeBackup(pool, guild, {
        name: `[pre-restore] ${backup.name}`,
        createdBy: client.user.id,
        panic: true,
      });
      if (!pre.ok) console.warn(`[backup-sched] pre-restore snapshot skipped: quota`);
    } catch (err) {
      console.warn(`[backup-sched] pre-restore snapshot failed: ${err.message}`);
    }

    try {
      const { summary, errors } = await restoreGuild(guild, snapshot, {});
      await notifyScheduledSuccess(client, row, backup, summary, errors);
      await store.logAudit(pool, {
        guildId: guild.id, actorId: row.scheduled_by,
        action: "scheduled-restore", backupId: row.backup_id,
        detail: `${summary.channels} ch, ${summary.roles} roles`,
      });
    } catch (err) {
      await notifyScheduledFailure(client, row, err.message);
    }
  }
}

async function findNotifyChannel(client, pool, guildId) {
  try {
    const { rows } = await pool.query(
      `SELECT notify_channel_id FROM guild_backup_settings WHERE guild_id = $1`,
      [guildId]
    );
    const id = rows[0]?.notify_channel_id;
    if (!id) return null;
    return await client.channels.fetch(id).catch(() => null);
  } catch { return null; }
}

async function notifyScheduledSuccess(client, row, backup, summary, errors) {
  const ch = await client.channels.fetch(row.channel_id).catch(() => null);
  if (!ch) return;
  const lines = [
    `${E.download} **scheduled restore executed**`,
    `**backup:** \`#${backup.id}\` — ${backup.name}`,
    `**roles:** ${summary.roles} · **channels:** ${summary.channels} · **emojis:** ${summary.emojis}`,
  ];
  if (errors.length) lines.push(`\n${E.warning} **${errors.length} errors** — DMing owners`);
  ch.send(lines.join("\n")).catch(() => {});
}

async function notifyScheduledFailure(client, row, reason) {
  const ch = await client.channels.fetch(row.channel_id).catch(() => null);
  if (!ch) return;
  ch.send(`${E.error} scheduled restore failed — \`${reason}\``).catch(() => {});
}

/* ═══════════════════════════════════════════════════════════════
   BOOT
   ═══════════════════════════════════════════════════════════════ */
function startScheduler(client) {
  store.ensureTables(client.pool).catch((err) =>
    console.error("[backup] ensureTables:", err.message)
  );

  const tick = async () => {
    try { await runDueBackups(client); } catch (err) { console.error("[backup-sched] backups:", err.message); }
    try { await runDueRestores(client); } catch (err) { console.error("[backup-sched] restores:", err.message); }
  };

  const loop = setInterval(tick, CONFIG.schedulerTickMs);
  loop.unref?.();
  setTimeout(tick, 5_000);
}

module.exports = { startScheduler, makeBackup };
