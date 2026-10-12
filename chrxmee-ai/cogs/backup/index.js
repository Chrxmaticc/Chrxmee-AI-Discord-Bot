// cogs/backup/index.js
const {
  SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType,
} = require("discord.js");
const zlib = require("node:zlib");
const { promisify } = require("node:util");
const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

const {
  E, COLORS, CONFIG, QUOTA_MESSAGE, OWNER_IDS,
  FREQ_LABELS, MB, formatBytes,
} = require("./constants");
const store = require("./store");
const { restoreGuild, diffSnapshots } = require("./engine");
const { makeBackup, startScheduler } = require("./scheduler");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isOwner = (id) => OWNER_IDS.includes(id);

async function reply(interaction, embed) {
  const payload = { embeds: [embed] };
  if (interaction.deferred || interaction.replied) return interaction.editReply(payload).catch(() => {});
  return interaction.reply(payload).catch(() => {});
}

function bEmbed(title, desc, color = COLORS.backup) {
  return new EmbedBuilder().setColor(color).setTitle(title).setDescription(desc).setFooter({ text: "chromed · backup" });
}

/* ── perm gates ── */
function gateAdmin(interaction) {
  if (interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  reply(interaction, bEmbed(`${E.error} nope`, "you need **administrator** for that.", COLORS.error));
  return false;
}

function gateManage(interaction) {
  if (interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
  reply(interaction, bEmbed(`${E.error} nope`, "you need **manage server** for that.", COLORS.error));
  return false;
}

module.exports = {
  startScheduler,

  data: new SlashCommandBuilder()
    .setName("backup")
    .setDescription("snapshot & restore your server")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)

    /* ── /backup create ── */
    .addSubcommand((s) => s
      .setName("create")
      .setDescription("snapshot this server")
      .addStringOption((o) => o.setName("name").setDescription("label").setRequired(false))
    )

    /* ── /backup panic ── */
    .addSubcommand((s) => s
      .setName("panic")
      .setDescription("⚡ fast snapshot — for raids/nukes")
    )

    /* ── /backup list ── */
    .addSubcommand((s) => s.setName("list").setDescription("list this server's backups"))

    /* ── /backup view ── */
    .addSubcommand((s) => s
      .setName("view")
      .setDescription("preview a backup")
      .addIntegerOption((o) => o.setName("id").setDescription("backup id").setRequired(true).setAutocomplete(true))
    )

    /* ── /backup load ── */
    .addSubcommand((s) => s
      .setName("load")
      .setDescription("⚠ restore a backup into this server")
      .addIntegerOption((o) => o.setName("id").setDescription("backup id").setRequired(true).setAutocomplete(true))
      .addStringOption((o) => o.setName("from").setDescription("source guild id (cross-guild)").setRequired(false))
      .addBooleanOption((o) => o.setName("dry_run").setDescription("preview only, change nothing").setRequired(false))
      .addStringOption((o) => o.setName("only").setDescription("sections: roles,channels,emojis,stickers,bans,meta,images").setRequired(false))
      .addStringOption((o) => o.setName("skip").setDescription("sections to skip").setRequired(false))
    )

    /* ── /backup undo ── */
    .addSubcommand((s) => s
      .setName("undo")
      .setDescription("⚠ roll back the last restore using the pre-restore snapshot")
    )

    /* ── /backup delete ── */
    .addSubcommand((s) => s
      .setName("delete")
      .setDescription("remove a backup")
      .addIntegerOption((o) => o.setName("id").setDescription("backup id").setRequired(true).setAutocomplete(true))
    )

    /* ── /backup diff ── */
    .addSubcommand((s) => s
      .setName("diff")
      .setDescription("compare two backups")
      .addIntegerOption((o) => o.setName("a").setDescription("first backup id").setRequired(true).setAutocomplete(true))
      .addIntegerOption((o) => o.setName("b").setDescription("second backup id").setRequired(true).setAutocomplete(true))
    )

    /* ── /backup export ── */
    .addSubcommand((s) => s
      .setName("export")
      .setDescription("DM yourself the raw backup file")
      .addIntegerOption((o) => o.setName("id").setDescription("backup id").setRequired(true).setAutocomplete(true))
    )

    /* ── /backup quota ── */
    .addSubcommand((s) => s.setName("quota").setDescription("show storage usage"))

    /* ── /backup notify ── */
    .addSubcommand((s) => s
      .setName("notify")
      .setDescription("set the channel for backup notifications")
      .addChannelOption((o) => o.setName("channel").setDescription("channel (omit to clear)").setRequired(false))
    )

    /* ── /backup audit ── */
    .addSubcommand((s) => s.setName("audit").setDescription("show recent backup/restore actions"))

    /* ── /backup schedule ── */
    .addSubcommandGroup((g) => g
      .setName("schedule")
      .setDescription("scheduled BACKUPS")
      .addSubcommand((s) => s
        .setName("set")
        .setDescription("start auto-backups")
        .addStringOption((o) => o.setName("freq").setDescription("how often").setRequired(true)
          .addChoices(
            { name: "every 6h", value: "every_6h" },
            { name: "every 12h", value: "every_12h" },
            { name: "daily", value: "daily" },
            { name: "weekly", value: "weekly" },
          ))
        .addStringOption((o) => o.setName("name").setDescription("label prefix").setRequired(true))
      )
      .addSubcommand((s) => s.setName("off").setDescription("stop auto-backups"))
      .addSubcommand((s) => s.setName("status").setDescription("show active schedule"))
    )

    /* ── /backup schedule-restore ── */
    .addSubcommandGroup((g) => g
      .setName("schedule-restore")
      .setDescription("schedule a RESTORE for later")
      .addSubcommand((s) => s
        .setName("set")
        .setDescription("schedule a restore")
        .addIntegerOption((o) => o.setName("id").setDescription("backup id").setRequired(true).setAutocomplete(true))
        .addStringOption((o) => o.setName("at").setDescription("when — 'in 2h', 'at 3am', 'tomorrow 9pm'").setRequired(true))
        .addChannelOption((o) => o.setName("channel").setDescription("where to post results").setRequired(true))
      )
      .addSubcommand((s) => s.setName("list").setDescription("show pending scheduled restores"))
      .addSubcommand((s) => s
        .setName("cancel")
        .setDescription("cancel a scheduled restore (only >5m out)")
        .addIntegerOption((o) => o.setName("id").setDescription("schedule id").setRequired(true))
      )
    )

    /* ── OWNER ONLY: storage quota management ── */
    .addSubcommand((s) => s
      .setName("increase-storage")
      .setDescription("(owner) grant more storage to a guild")
      .addIntegerOption((o) => o.setName("mb").setDescription("megabytes to add").setRequired(true).setMinValue(1))
      .addStringOption((o) => o.setName("guild_id").setDescription("guild id (default: current)").setRequired(false))
      .addStringOption((o) => o.setName("note").setDescription("reason").setRequired(false))
    )
    .addSubcommand((s) => s
      .setName("decrease-storage")
      .setDescription("(owner) reduce a guild's storage")
      .addIntegerOption((o) => o.setName("mb").setDescription("megabytes to remove").setRequired(true).setMinValue(1))
      .addStringOption((o) => o.setName("guild_id").setDescription("guild id (default: current)").setRequired(false))
    )
    .addSubcommand((s) => s
      .setName("set-storage")
      .setDescription("(owner) set exact quota in MB")
      .addIntegerOption((o) => o.setName("mb").setDescription("megabytes").setRequired(true).setMinValue(10))
      .addStringOption((o) => o.setName("guild_id").setDescription("guild id (default: current)").setRequired(false))
    ),

  /* ═══════════════════════════════════════════════════════════════
     AUTOCOMPLETE
     ═══════════════════════════════════════════════════════════════ */
  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    if (focused.name !== "id" && focused.name !== "a" && focused.name !== "b") {
      return interaction.respond([]);
    }
    try {
      const rows = await store.listBackups(interaction.client.pool, interaction.guildId, 25);
      const q = (focused.value || "").toString();
      const filtered = rows
        .filter((r) => !q || String(r.id).includes(q) || r.name.toLowerCase().includes(q.toLowerCase()))
        .slice(0, 25)
        .map((r) => ({
          name: `#${r.id} — ${r.name.slice(0, 60)}`,
          value: r.id,
        }));
      return interaction.respond(filtered);
    } catch {
      return interaction.respond([]).catch(() => {});
    }
  },

  /* ═══════════════════════════════════════════════════════════════
     EXECUTE
     ═══════════════════════════════════════════════════════════════ */
  async execute(interaction) {
    const pool = interaction.client;
    const p = interaction.client.pool;
    const guild = interaction.guild;
    const sub = interaction.options.getSubcommand(true);
    const group = interaction.options.getSubcommandGroup(false);

    if (!interaction.deferred) await interaction.deferReply().catch(() => {});
    await store.ensureTables(p).catch(() => {});

    const userId = interaction.user.id;

    /* ═══ CREATE ═══ */
    if (sub === "create") {
      if (!gateAdmin(interaction)) return;
      const name = (interaction.options.getString("name") || `auto-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}`).slice(0, 80);
      return handleCreate(interaction, p, guild, name, userId);
    }

    /* ═══ PANIC ═══ */
    if (sub === "panic") {
      if (!gateAdmin(interaction)) return;
      const name = `[panic] ${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}`;
      await reply(interaction, bEmbed(`${E.loading} panic snapshot`, "grabbing state as fast as possible…"));
      const result = await makeBackup(p, guild, { name, createdBy: userId, panic: true });
      if (!result.ok) return reply(interaction, bEmbed(`${E.warning} skipped`, QUOTA_MESSAGE, COLORS.error));
      return reply(interaction, bEmbed(
        `${E.success} panic snapshot saved`,
        `**id:** \`#${result.id}\`\n**size:** ${formatBytes(result.size)}\n**note:** bans skipped for speed`,
        COLORS.success,
      ));
    }

    /* ═══ LIST ═══ */
    if (sub === "list") {
      if (!gateAdmin(interaction)) return;
      const rows = await store.listBackups(p, guild.id, CONFIG.maxListResults);
      if (!rows.length) return reply(interaction, bEmbed(`${E.list} no backups`, "use `/backup create` to make one."));
      const used = await store.getUsedBytes(p, guild.id);
      const quota = await store.getQuota(p, guild.id);
      const lines = rows.map((r) => {
        const unix = Math.floor(new Date(r.created_at).getTime() / 1000);
        return `**#${r.id}** · \`${r.name}\`\n> <t:${unix}:R> · ${formatBytes(r.size_bytes)} · by <@${r.created_by}>`;
      });
      return reply(interaction, bEmbed(
        `${E.list} backups (${rows.length})`,
        lines.join("\n\n") + `\n\n**storage:** ${formatBytes(used)} / ${formatBytes(quota)}`,
      ));
    }

    /* ═══ VIEW ═══ */
    if (sub === "view") {
      if (!gateAdmin(interaction)) return;
      const id = interaction.options.getInteger("id");
      const row = await store.getBackup(p, id, guild.id);
      if (!row) return reply(interaction, bEmbed(`${E.error} not found`, `no backup with id **#${id}**.`, COLORS.error));
      let snap;
      try { snap = JSON.parse((await gunzip(row.payload)).toString("utf8")); }
      catch { return reply(interaction, bEmbed(`${E.error} corrupt`, "that backup payload is unreadable.", COLORS.error)); }
      const unix = Math.floor(new Date(row.created_at).getTime() / 1000);
      const embed = new EmbedBuilder()
        .setColor(COLORS.backup)
        .setTitle(`${E.list} backup #${row.id} — ${row.name}`)
        .setDescription(`saved <t:${unix}:R> by <@${row.created_by}>`)
        .addFields(
          { name: "roles",    value: `${snap.roles.length}`,    inline: true },
          { name: "channels", value: `${snap.channels.length}`, inline: true },
          { name: "emojis",   value: `${snap.emojis.length}`,   inline: true },
          { name: "stickers", value: `${snap.stickers.length}`, inline: true },
          { name: "bans",     value: `${snap.bans.length}`,     inline: true },
          { name: "size",     value: formatBytes(row.size_bytes), inline: true },
          { name: "version",  value: `v${snap.version}`,        inline: true },
          { name: "locale",   value: snap.meta.preferredLocale || "unknown", inline: true },
        )
        .setFooter({ text: "chromed · backup" });
      return interaction.editReply({ embeds: [embed] });
    }

    /* ═══ LOAD ═══ */
    if (sub === "load") {
      if (!gateAdmin(interaction)) return;
      return handleLoad(interaction, p, guild, userId);
    }

    /* ═══ UNDO ═══ */
    if (sub === "undo") {
      if (!gateAdmin(interaction)) return;
      const recent = await store.listAudit(p, guild.id, 50);
      const lastRestore = recent.find((a) => a.action === "restore" || a.action === "scheduled-restore");
      if (!lastRestore) return reply(interaction, bEmbed(`${E.error} nothing to undo`, "no restore recorded for this guild.", COLORS.error));
      const pre = await store.findBackupByName(p, guild.id, `[pre-restore]`);
      if (!pre) return reply(interaction, bEmbed(`${E.error} no snapshot`, "no pre-restore snapshot found.", COLORS.error));
      return handleLoad(interaction, p, guild, userId, pre.id, null, undefined, undefined, true);
    }

    /* ═══ DELETE ═══ */
    if (sub === "delete") {
      if (!gateAdmin(interaction)) return;
      const id = interaction.options.getInteger("id");
      const ok = await store.deleteBackup(p, id, guild.id);
      if (!ok) return reply(interaction, bEmbed(`${E.error} not found`, `no backup with id **#${id}**.`, COLORS.error));
      await store.logAudit(p, { guildId: guild.id, actorId: userId, action: "delete", backupId: id });
      return reply(interaction, bEmbed(`${E.trash} deleted`, `backup **#${id}** is gone.`, COLORS.muted));
    }

    /* ═══ DIFF ═══ */
    if (sub === "diff") {
      if (!gateAdmin(interaction)) return;
      const aId = interaction.options.getInteger("a");
      const bId = interaction.options.getInteger("b");
      const [a, b] = await Promise.all([store.getBackup(p, aId, guild.id), store.getBackup(p, bId, guild.id)]);
      if (!a || !b) return reply(interaction, bEmbed(`${E.error} not found`, "one or both ids missing.", COLORS.error));
      let sa, sb;
      try {
        sa = JSON.parse((await gunzip(a.payload)).toString("utf8"));
        sb = JSON.parse((await gunzip(b.payload)).toString("utf8"));
      } catch { return reply(interaction, bEmbed(`${E.error} corrupt`, "failed to parse one of the backups.", COLORS.error)); }
      const d = diffSnapshots(sa, sb);
      const fmt = (arr, cap = 8) => {
        if (!arr.length) return "—";
        const head = arr.slice(0, cap).map((x) => `\`${x}\``).join(", ");
        return arr.length > cap ? `${head}… +${arr.length - cap} more` : head;
      };
      const embed = new EmbedBuilder()
        .setColor(COLORS.backup)
        .setTitle(`${E.list} diff — #${aId} → #${bId}`)
        .addFields(
          { name: `roles +`, value: fmt(d.roles.added),   inline: false },
          { name: `roles -`, value: fmt(d.roles.removed), inline: false },
          { name: `channels +`, value: fmt(d.channels.added),   inline: false },
          { name: `channels -`, value: fmt(d.channels.removed), inline: false },
          { name: `emojis +`, value: fmt(d.emojis.added),   inline: false },
          { name: `emojis -`, value: fmt(d.emojis.removed), inline: false },
        )
        .setFooter({ text: "chromed · backup" });
      if (d.metaName) embed.addFields({ name: "name change", value: `${d.metaName.from} → ${d.metaName.to}` });
      return interaction.editReply({ embeds: [embed] });
    }

    /* ═══ EXPORT ═══ */
    if (sub === "export") {
      if (!gateAdmin(interaction)) return;
      const id = interaction.options.getInteger("id");
      const row = await store.getBackup(p, id, guild.id);
      if (!row) return reply(interaction, bEmbed(`${E.error} not found`, `no backup with id **#${id}**.`, COLORS.error));
      const file = { attachment: row.payload, name: `${guild.id}-${id}-${row.name.replace(/\W+/g, "_")}.json.gz` };
      try {
        await interaction.user.send({ content: `${E.download} your backup **#${id}** — ${formatBytes(row.size_bytes)}`, files: [file] });
        return reply(interaction, bEmbed(`${E.success} sent`, "check your DMs.", COLORS.success));
      } catch {
        // DM failed, fall back to channel
        await interaction.editReply({ content: `${E.warning} couldn't DM you — posting here instead.`, files: [file] }).catch(() => {});
        return;
      }
    }

    /* ═══ QUOTA ═══ */
    if (sub === "quota") {
      if (!gateAdmin(interaction)) return;
      const used = await store.getUsedBytes(p, guild.id);
      const quota = await store.getQuota(p, guild.id);
      const n = await store.countBackups(p, guild.id);
      const pct = quota > 0 ? Math.min(100, (used / quota) * 100) : 0;
      const bar = "█".repeat(Math.round(pct / 5)).padEnd(20, "░");
      return reply(interaction, bEmbed(
        `${E.cloud} storage`,
        `\`${bar}\` **${pct.toFixed(1)}%**\n\n` +
        `**used:** ${formatBytes(used)}\n` +
        `**quota:** ${formatBytes(quota)}\n` +
        `**backups:** ${n}\n` +
        `**remaining:** ${formatBytes(Math.max(0, quota - used))}`
      ));
    }

    /* ═══ NOTIFY ═══ */
    if (sub === "notify") {
      if (!gateAdmin(interaction)) return;
      const ch = interaction.options.getChannel("channel");
      await p.query(
        `INSERT INTO guild_backup_settings (guild_id, notify_channel_id)
         VALUES ($1, $2)
         ON CONFLICT (guild_id) DO UPDATE SET notify_channel_id = $2`,
        [guild.id, ch?.id || null]
      );
      return reply(interaction, bEmbed(
        `${E.success} notify channel`,
        ch ? `restore summaries + scheduled backup updates go to ${ch}` : "notify channel cleared.",
        COLORS.success,
      ));
    }

    /* ═══ AUDIT ═══ */
    if (sub === "audit") {
      if (!gateAdmin(interaction)) return;
      const rows = await store.listAudit(p, guild.id, 15);
      if (!rows.length) return reply(interaction, bEmbed(`${E.list} no history`, "nothing has happened yet."));
      const lines = rows.map((r) => {
        const unix = Math.floor(new Date(r.created_at).getTime() / 1000);
        const id = r.backup_id ? ` \`#${r.backup_id}\`` : "";
        const detail = r.detail ? ` — ${r.detail}` : "";
        return `<t:${unix}:R> · <@${r.actor_id}> **${r.action}**${id}${detail}`;
      });
      return reply(interaction, bEmbed(`${E.list} audit log`, lines.join("\n")));
    }

    /* ═══ SCHEDULE (backups) ═══ */
    if (group === "schedule") {
      if (!gateAdmin(interaction)) return;

      if (sub === "set") {
        const freq = interaction.options.getString("freq");
        const name = interaction.options.getString("name").slice(0, 60);

        // quota check: are we at/over quota already?
        const used = await store.getUsedBytes(p, guild.id);
        const quota = await store.getQuota(p, guild.id);
        if (used >= quota) return reply(interaction, bEmbed(`${E.warning} storage full`, QUOTA_MESSAGE, COLORS.error));

        const ms = CONFIG.FREQ[freq] || CONFIG.FREQ.daily;
        const firstRunAt = Date.now() + ms;
        await store.disableScheduledBackup(p, guild.id); // only one active at a time
        const id = await store.createScheduledBackup(p, {
          guildId: guild.id, name, freq, createdBy: userId, firstRunAt,
        });
        await store.logAudit(p, { guildId: guild.id, actorId: userId, action: "schedule-set", detail: `${name} · ${freq}` });
        return reply(interaction, bEmbed(
          `${E.success} scheduled`,
          `**#${id}** — \`${name}\`\n**freq:** ${FREQ_LABELS[freq]}\n**first run:** <t:${Math.floor(firstRunAt / 1000)}:R>`,
          COLORS.success,
        ));
      }

      if (sub === "off") {
        const n = await store.disableScheduledBackup(p, guild.id);
        return reply(interaction, bEmbed(
          n ? `${E.success} stopped` : `${E.warning} nothing to stop`,
          n ? `disabled **${n}** schedule(s).` : "no active schedule.",
          n ? COLORS.success : COLORS.muted,
        ));
      }

      if (sub === "status") {
        const rows = await store.listScheduledBackups(p, guild.id);
        if (!rows.length) return reply(interaction, bEmbed(`${E.list} no schedule`, "no active auto-backups."));
        const lines = rows.map((r) => {
          const unix = Math.floor(new Date(r.next_run_at).getTime() / 1000);
          return `**#${r.id}** — \`${r.name}\`\n> ${FREQ_LABELS[r.freq]} · next <t:${unix}:R>`;
        });
        return reply(interaction, bEmbed(`${E.list} active schedule(s)`, lines.join("\n\n")));
      }
    }

    /* ═══ SCHEDULE-RESTORE ═══ */
    if (group === "schedule-restore") {
      if (!gateAdmin(interaction)) return;

      if (sub === "set") {
        const id = interaction.options.getInteger("id");
        const atRaw = interaction.options.getString("at");
        const channel = interaction.options.getChannel("channel");

        const { parseWhen } = require("./parse-when");
        const ts = parseWhen(atRaw);
        if (!ts) return reply(interaction, bEmbed(`${E.error} bad time`, `couldn't parse \`${atRaw}\`.`, COLORS.error));
        if (ts - Date.now() < CONFIG.restoreLockWindowMs * 2) {
          return reply(interaction, bEmbed(`${E.error} too soon`, "pick a time at least 10 minutes out.", COLORS.error));
        }

        const backup = await store.getBackup(p, id, guild.id);
        if (!backup) return reply(interaction, bEmbed(`${E.error} not found`, `no backup **#${id}**.`, COLORS.error));

        const schedId = await store.createScheduledRestore(p, {
          guildId: guild.id, backupId: id, sourceGuild: guild.id,
          channelId: channel.id, scheduledBy: userId, fireAt: ts,
        });
        await store.logAudit(p, { guildId: guild.id, actorId: userId, action: "schedule-restore-set", backupId: id, detail: `at ${new Date(ts).toISOString()}` });

        const unix = Math.floor(ts / 1000);
        return reply(interaction, bEmbed(
          `${E.timer} scheduled restore`,
          `**#${schedId}** — will restore **#${id}** (\`${backup.name}\`)\n**when:** <t:${unix}:F> (<t:${unix}:R>)\n**channel:** ${channel}\n\n${E.warning} cancel any time until **5 min before**.`,
        ));
      }

      if (sub === "list") {
        const rows = await store.listScheduledRestores(p, guild.id);
        if (!rows.length) return reply(interaction, bEmbed(`${E.list} none pending`, "no scheduled restores."));
        const lines = rows.map((r) => {
          const unix = Math.floor(new Date(r.fire_at).getTime() / 1000);
          return `**#${r.id}** → backup \`#${r.backup_id}\`\n> fires <t:${unix}:R> in <#${r.channel_id}>`;
        });
        return reply(interaction, bEmbed(`${E.list} pending restores`, lines.join("\n\n")));
      }

      if (sub === "cancel") {
        const id = interaction.options.getInteger("id");
        const ok = await store.cancelScheduledRestore(p, id, guild.id);
        if (!ok) return reply(interaction, bEmbed(`${E.error} can't cancel`, "either it doesn't exist, or it's within the 5-min lock window.", COLORS.error));
        return reply(interaction, bEmbed(`${E.success} cancelled`, `scheduled restore **#${id}** removed.`, COLORS.success));
      }
    }

    /* ═══ OWNER STORAGE COMMANDS ═══ */
    if (["increase-storage", "decrease-storage", "set-storage"].includes(sub)) {
      if (!isOwner(userId)) return reply(interaction, bEmbed(`${E.error} nope`, "owner-only command.", COLORS.error));

      const mb = interaction.options.getInteger("mb");
      const targetId = interaction.options.getString("guild_id") || guild.id;
      const note = interaction.options.getString("note") || null;

      const targetGuild = interaction.client.guilds.cache.get(targetId);
      if (!targetGuild && targetId !== guild.id) {
        return reply(interaction, bEmbed(`${E.error} bot not in guild`, `chromed isn't in \`${targetId}\`.`, COLORS.error));
      }

      const current = await store.getQuota(p, targetId);
      let next;
      if (sub === "set-storage") next = mb * MB;
      else if (sub === "increase-storage") next = current + mb * MB;
      else next = Math.max(CONFIG.quotaFloorBytes, current - mb * MB);

      if (next > CONFIG.ownerMaxQuotaBytes) {
        return reply(interaction, bEmbed(`${E.error} too much`, `cap is ${formatBytes(CONFIG.ownerMaxQuotaBytes)}.`, COLORS.error));
      }

      await store.setQuota(p, targetId, next, userId, note);
      await store.logAudit(p, { guildId: targetId, actorId: userId, action: sub, detail: `${formatBytes(current)} → ${formatBytes(next)}` });

      return reply(interaction, bEmbed(
        `${E.success} storage updated`,
        `**guild:** \`${targetId}\`\n**before:** ${formatBytes(current)}\n**after:** ${formatBytes(next)}` +
        (note ? `\n**note:** ${note}` : ""),
        COLORS.success,
      ));
    }
  },
};

/* ═══════════════════════════════════════════════════════════════
   HANDLERS
   ═══════════════════════════════════════════════════════════════ */
async function handleCreate(interaction, p, guild, name, userId) {
  // rate limit
  const age = await store.latestBackupAgeMs(p, guild.id);
  if (age !== null && age < CONFIG.rateLimitMs) {
    const wait = Math.ceil((CONFIG.rateLimitMs - age) / 1000);
    return reply(interaction, bEmbed(`${E.warning} slow down`, `wait **${wait}s** before the next backup.`, COLORS.error));
  }

  // quota
  const used = await store.getUsedBytes(p, guild.id);
  const quota = await store.getQuota(p, guild.id);
  if (used >= quota) return reply(interaction, bEmbed(`${E.warning} storage full`, QUOTA_MESSAGE, COLORS.error));

  const progress = (step) => {
    interaction.editReply({
      embeds: [bEmbed(`${E.loading} capturing…`, `\`${step}\``)],
    }).catch(() => {});
  };

  try {
    progress("starting");
    const result = await makeBackup(p, guild, { name, createdBy: userId, progress });
    if (!result.ok) return reply(interaction, bEmbed(`${E.warning} storage full`, QUOTA_MESSAGE, COLORS.error));

    const s = result.snapshot;
    return reply(interaction, bEmbed(
      `${E.success} backup saved`,
      `**id:** \`#${result.id}\` · **name:** \`${name}\`\n` +
      `**size:** ${formatBytes(result.size)}\n` +
      `**roles:** ${s.roles.length} · **channels:** ${s.channels.length} · **emojis:** ${s.emojis.length} · **bans:** ${s.bans.length}`,
      COLORS.success,
    ));
  } catch (err) {
    console.error("[backup create]", err);
    return reply(interaction, bEmbed(`${E.error} failed`, `\`${err.message}\``, COLORS.error));
  }
}

async function handleLoad(interaction, p, guild, userId, forcedId = null, forcedFrom = null, forcedOnly = null, forcedSkip = null, isUndo = false) {
  const id = forcedId ?? interaction.options.getInteger("id");
  const fromRaw = forcedFrom ?? interaction.options.getString("from");
  const fromGuildId = fromRaw ? String(fromRaw).replace(/\D/g, "") : guild.id;
  const dryRun = interaction.options.getBoolean?.("dry_run") || false;
  const onlyRaw = forcedOnly ?? interaction.options.getString?.("only");
  const skipRaw = forcedSkip ?? interaction.options.getString?.("skip");

  const parseSections = (raw) => {
    if (!raw) return null;
    const valid = ["roles", "channels", "emojis", "stickers", "bans", "meta", "images"];
    const set = new Set(raw.split(",").map((s) => s.trim().toLowerCase()).filter((s) => valid.includes(s)));
    return set.size ? set : null;
  };
  const only = parseSections(onlyRaw);
  const skip = parseSections(skipRaw);

  // cross-guild gate
  if (fromGuildId !== guild.id) {
    const srcGuild = interaction.client.guilds.cache.get(fromGuildId);
    if (!srcGuild) return reply(interaction, bEmbed(`${E.error} source missing`, `chromed isn't in \`${fromGuildId}\`.`, COLORS.error));
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return reply(interaction, bEmbed(`${E.error} nope`, "cross-guild restore needs **administrator**.", COLORS.error));
    }
  }

  const backup = await store.getBackup(p, id, fromGuildId);
  if (!backup) return reply(interaction, bEmbed(`${E.error} not found`, `no backup **#${id}** in \`${fromGuildId}\`.`, COLORS.error));

  let snapshot;
  try { snapshot = JSON.parse((await gunzip(backup.payload)).toString("utf8")); }
  catch { return reply(interaction, bEmbed(`${E.error} corrupt`, "failed to decompress that backup.", COLORS.error)); }

  // dry-run — preview only
  if (dryRun) {
    const { summary } = await restoreGuild(guild, snapshot, { dryRun: true });
    return reply(interaction, bEmbed(
      `${E.list} dry run`,
      `**would delete:** ${summary.wouldDelete.channels} ch · ${summary.wouldDelete.roles} roles · ${summary.wouldDelete.emojis} emojis · ${summary.wouldDelete.stickers} stickers\n` +
      `**would create:** ${snapshot.channels.length} ch · ${snapshot.roles.length} roles · ${snapshot.emojis.length} emojis`,
    ));
  }

  /* ── confirmation ── */
  const confirmId = `bkp-yes-${interaction.id}`;
  const cancelId  = `bkp-no-${interaction.id}`;
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(confirmId).setLabel("yes, restore").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(cancelId).setLabel("cancel").setStyle(ButtonStyle.Secondary),
  );

  const unix = Math.floor(new Date(backup.created_at).getTime() / 1000);
  await interaction.editReply({
    embeds: [bEmbed(
      `${E.warning} confirm restore`,
      `restoring **#${id}** — \`${backup.name}\` (from \`${fromGuildId}\`, saved <t:${unix}:R>) will:\n\n` +
      `• **delete** every channel, non-managed role, emoji, and sticker\n` +
      `• **overwrite** server name + settings\n` +
      (only ? `• **only** restoring: ${[...only].join(", ")}\n` : "") +
      (skip ? `• **skipping:** ${[...skip].join(", ")}\n` : "") +
      `\nconfirm in 60s.`,
      COLORS.error,
    )],
    components: [row],
  });

  let btn;
  try {
    btn = await interaction.channel.awaitMessageComponent({
      componentType: ComponentType.Button,
      time: CONFIG.confirmTimeoutMs,
      filter: (i) => i.user.id === interaction.user.id && [confirmId, cancelId].includes(i.customId),
    });
  } catch {
    return interaction.editReply({ embeds: [bEmbed("timed out", "nothing changed.", COLORS.muted)], components: [] });
  }

  if (btn.customId === cancelId) {
    return btn.update({ embeds: [bEmbed(`${E.trash} cancelled`, "no changes made.", COLORS.muted)], components: [] });
  }

  await btn.update({ embeds: [bEmbed(`${E.loading} restoring…`, "`snapshotting current state`")], components: [] });

  // ── pre-restore safety net ──
  let preId = null;
  try {
    const pre = await makeBackup(p, guild, {
      name: `[pre-restore] ${backup.name}`.slice(0, 80),
      createdBy: interaction.client.user.id,
      panic: true,
    });
    if (pre.ok) preId = pre.id;
    else console.warn("[backup] pre-restore skipped: quota");
  } catch (err) {
    console.warn("[backup] pre-restore failed:", err.message);
  }

  const progress = (step) => {
    interaction.editReply({ embeds: [bEmbed(`${E.loading} restoring…`, `\`${step}\``)] }).catch(() => {});
  };

  try {
    const { summary, errors } = await restoreGuild(guild, snapshot, { progress, only, skip });

    await store.logAudit(p, {
      guildId: guild.id, actorId: userId, action: "restore",
      backupId: id, detail: `${summary.channels} ch, ${summary.roles} roles, ${errors.length} errors`,
    });

    const lines = [
      `**roles:** ${summary.roles}`,
      `**channels:** ${summary.channels}`,
      `**emojis:** ${summary.emojis}`,
      `**stickers:** ${summary.stickers}`,
      `**bans:** ${summary.bans}`,
      `**icon/banner/splash:** ${summary.icon}/${summary.banner}/${summary.splash}`,
      summary.skipped ? `${E.warning} **skipped:** ${summary.skipped}` : null,
      preId ? `\n-# pre-restore snapshot saved as \`#${preId}\` — run \`/backup undo\` to roll back` : null,
    ].filter(Boolean);

    await interaction.editReply({ embeds: [bEmbed(`${E.success} restore complete`, lines.join("\n"), errors.length ? COLORS.error : COLORS.success)] });

    // DM failures report to owners + actor
    if (errors.length) {
      const reportLines = errors.slice(0, 15).map((e) => `• ${e.step} — ${e.error}`).join("\n");
      const report = `<:lowwarning:1559014951975395351> **backup restore had issues**\n\n**guild:** ${guild.name} (\`${guild.id}\`)\n**backup:** \`#${id}\` — ${backup.name}\n**failures:** ${errors.length}\n\n${reportLines}`;
      try { await interaction.user.send(report).catch(() => {}); } catch {}
      try {
        const owner = await guild.fetchOwner();
        if (owner.id !== interaction.user.id) await owner.send(report).catch(() => {});
      } catch {}
    }
  } catch (err) {
    console.error("[backup load]", err);
    await interaction.editReply({ embeds: [bEmbed(`${E.error} restore crashed`, `\`${err.message}\``, COLORS.error)] }).catch(() => {});
  }
}
