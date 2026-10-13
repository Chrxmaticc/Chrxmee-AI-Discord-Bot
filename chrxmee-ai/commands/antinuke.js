// commands/antinuke.js
const {
  SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType,
} = require("discord.js");

const {
  E, COLORS, PUNISHMENTS, DANGEROUS_PERMS,
  DEFAULT_THRESHOLDS, defaultSettings,
  store, raidmode,
} = require("../cogs/antinuke");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function reply(interaction, embed) {
  const payload = { embeds: [embed] };
  if (interaction.deferred || interaction.replied) return interaction.editReply(payload).catch(() => {});
  return interaction.reply(payload).catch(() => {});
}

function aEmbed(title, desc, color = COLORS.antinuke) {
  return new EmbedBuilder().setColor(color).setTitle(title).setDescription(desc).setFooter({ text: "chromed · antinuke" });
}

function gateOwner(interaction) {
  if (interaction.guild.ownerId === interaction.user.id) return true;
  if (interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  reply(interaction, aEmbed(`${E.error} nope`, "only the **server owner** or an **administrator** can run this.", COLORS.error));
  return false;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("antinuke")
    .setDescription("protect your server from mass destruction")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)

    .addSubcommand((s) => s.setName("enable").setDescription("turn antinuke on"))
    .addSubcommand((s) => s.setName("disable").setDescription("turn antinuke off"))
    .addSubcommand((s) => s.setName("status").setDescription("show current config + recent detections"))

    .addSubcommand((s) => s
      .setName("punishment")
      .setDescription("set the punishment mode")
      .addStringOption((o) => o.setName("mode").setDescription("what to do on trigger").setRequired(true)
        .addChoices(
          { name: "log only (no action)", value: "log_only" },
          { name: "strip roles", value: "strip" },
          { name: "timeout 28d", value: "timeout" },
          { name: "kick", value: "kick" },
          { name: "ban + delete msgs", value: "ban" },
          { name: "strip + kick (default)", value: "strip_kick" },
        ))
    )

    .addSubcommand((s) => s
      .setName("mode")
      .setDescription("set normal or dry-run mode")
      .addStringOption((o) => o.setName("mode").setDescription("dry-run = detect but never punish").setRequired(true)
        .addChoices(
          { name: "normal (enforce)", value: "normal" },
          { name: "dry-run (observe only)", value: "dry-run" },
        ))
    )

    .addSubcommand((s) => s
      .setName("log-channel")
      .setDescription("where antinuke alerts go")
      .addChannelOption((o) => o.setName("channel").setDescription("channel (omit to clear)").setRequired(false))
    )

    .addSubcommand((s) => s
      .setName("notify")
      .setDescription("toggle DM notifications")
      .addStringOption((o) => o.setName("who").setDescription("who to DM").setRequired(true)
        .addChoices(
          { name: "server owner", value: "owner" },
          { name: "executor (the punished user)", value: "executor" },
        ))
      .addBooleanOption((o) => o.setName("enabled").setDescription("on/off").setRequired(true))
    )

    .addSubcommand((s) => s
      .setName("auto-panic")
      .setDescription("auto-snapshot before punishing")
      .addBooleanOption((o) => o.setName("enabled").setDescription("on/off").setRequired(true))
    )
    .addSubcommand((s) => s
      .setName("auto-restore")
      .setDescription("auto-restore after punishing (dangerous)")
      .addBooleanOption((o) => o.setName("enabled").setDescription("on/off").setRequired(true))
    )

    .addSubcommand((s) => s
      .setName("threshold")
      .setDescription("tune a detection threshold")
      .addStringOption((o) => o.setName("action").setDescription("which action").setRequired(true).setAutocomplete(true))
      .addIntegerOption((o) => o.setName("count").setDescription("trigger at N in window").setRequired(true).setMinValue(1).setMaxValue(100))
      .addIntegerOption((o) => o.setName("window_seconds").setDescription("window size in seconds (default 10)").setRequired(false).setMinValue(1).setMaxValue(600))
    )
    .addSubcommand((s) => s.setName("reset-thresholds").setDescription("restore all thresholds to defaults"))

    .addSubcommand((s) => s
      .setName("ignore-channel")
      .setDescription("skip antinuke in a channel (add or remove)")
      .addChannelOption((o) => o.setName("channel").setDescription("channel").setRequired(true))
      .addBooleanOption((o) => o.setName("remove").setDescription("remove instead of add").setRequired(false))
    )

    .addSubcommand((s) => s
      .setName("raid-mode")
      .setDescription("toggle raid detection + auto-lockdown")
      .addBooleanOption((o) => o.setName("enabled").setDescription("on/off").setRequired(true))
    )
    .addSubcommand((s) => s
      .setName("raid-threshold")
      .setDescription("joins per minute to trigger lockdown")
      .addIntegerOption((o) => o.setName("count").setDescription("joins/min").setRequired(true).setMinValue(2).setMaxValue(200))
    )
    .addSubcommand((s) => s
      .setName("lockdown")
      .setDescription("manually lock down the server")
      .addStringOption((o) => o.setName("reason").setDescription("reason").setRequired(false))
    )
    .addSubcommand((s) => s.setName("unlock").setDescription("lift lockdown"))

    .addSubcommandGroup((g) => g
      .setName("whitelist")
      .setDescription("manage who bypasses antinuke")
      .addSubcommand((s) => s
        .setName("add")
        .setDescription("add a user/role/bot to the whitelist")
        .addMentionableOption((o) => o.setName("target").setDescription("user, role, or bot").setRequired(true))
      )
      .addSubcommand((s) => s
        .setName("remove")
        .setDescription("remove from whitelist")
        .addMentionableOption((o) => o.setName("target").setDescription("user, role, or bot").setRequired(true))
      )
      .addSubcommand((s) => s.setName("list").setDescription("show the whitelist"))
      .addSubcommand((s) => s.setName("clear").setDescription("wipe the whitelist"))
    )

    .addSubcommandGroup((g) => g
      .setName("trust")
      .setDescription("cross-guild ban sharing")
      .addSubcommand((s) => s
        .setName("add")
        .setDescription("trust another guild")
        .addStringOption((o) => o.setName("guild_id").setDescription("guild id").setRequired(true))
        .addBooleanOption((o) => o.setName("share_bans").setDescription("share OUR bans with them").setRequired(false))
        .addBooleanOption((o) => o.setName("accept_bans").setDescription("accept THEIR bans here").setRequired(false))
      )
      .addSubcommand((s) => s
        .setName("remove")
        .setDescription("stop trusting a guild")
        .addStringOption((o) => o.setName("guild_id").setDescription("guild id").setRequired(true))
      )
      .addSubcommand((s) => s.setName("list").setDescription("list trusted guilds"))
    )

    .addSubcommand((s) => s.setName("logs").setDescription("recent detections")
      .addIntegerOption((o) => o.setName("limit").setDescription("how many (default 10)").setRequired(false).setMinValue(1).setMaxValue(50))
    )
    .addSubcommand((s) => s.setName("baseline").setDescription("show learned baseline activity"))
    .addSubcommand((s) => s.setName("test").setDescription("dry-run a simulated trigger to preview alerts")),

  /* ═══════════════════════════════════════════════════════════════
     AUTOCOMPLETE
     ═══════════════════════════════════════════════════════════════ */
  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    if (focused.name === "action") {
      const keys = Object.keys(DEFAULT_THRESHOLDS);
      const q = (focused.value || "").toLowerCase();
      const filtered = keys.filter((k) => k.toLowerCase().includes(q)).slice(0, 25)
        .map((k) => ({ name: k, value: k }));
      return interaction.respond(filtered).catch(() => {});
    }
    return interaction.respond([]).catch(() => {});
  },

  /* ═══════════════════════════════════════════════════════════════
     EXECUTE
     ═══════════════════════════════════════════════════════════════ */
  async execute(interaction) {
    const p = interaction.client.pool;
    const guild = interaction.guild;
    const sub = interaction.options.getSubcommand(true);
    const group = interaction.options.getSubcommandGroup(false);

    if (!interaction.deferred) await interaction.deferReply().catch(() => {});
    if (!gateOwner(interaction)) return;

    const cfg = await store.ensureSettingsRow(p, guild.id);

    /* ═══ ENABLE ═══ */
    if (sub === "enable" && !group) {
      if (cfg.enabled) return reply(interaction, aEmbed(`${E.warning} already on`, "antinuke is already enabled.", COLORS.warn));
      const settings = cfg.settings;
      settings.safeMode = { ...settings.safeMode, enabled: true, until: Date.now() + 24 * 60 * 60 * 1000 };
      await store.saveSettings(p, guild.id, { enabled: true, settings });
      return reply(interaction, aEmbed(
        `${E.success} antinuke enabled`,
        `**safe mode** active for the next 24h — detections will be logged but not punished.\n\n` +
        `run \`/antinuke status\` to review defaults, or \`/antinuke mode dry-run\` for indefinite observation.`,
        COLORS.success,
      ));
    }

    /* ═══ DISABLE ═══ */
    if (sub === "disable" && !group) {
      await store.saveSettings(p, guild.id, { enabled: false });
      return reply(interaction, aEmbed(`${E.trash} disabled`, "antinuke is off.", COLORS.muted));
    }

    /* ═══ STATUS ═══ */
    if (sub === "status" && !group) {
      const s = cfg.settings;
      const logs = await store.listLogs(p, guild.id, 5);
      const wl = await store.whitelistList(p, guild.id);
      const lockdown = await store.lockdownGet(p, guild.id);

      const lines = [
        `**state:** ${cfg.enabled ? `${E.success} enabled` : `${E.trash} disabled`}`,
        `**mode:** \`${cfg.mode}\``,
        `**punishment:** \`${cfg.punishment}\``,
        `**safe mode:** ${s.safeMode.enabled && s.safeMode.until > Date.now() ? `until <t:${Math.floor(s.safeMode.until / 1000)}:R>` : "off"}`,
        `**auto-panic:** ${s.panicOnTrigger ? "on" : "off"}`,
        `**auto-restore:** ${s.autoRestore ? "on" : "off"}`,
        `**raid mode:** ${s.raid.enabled ? `on (${s.raid.joinsPerMinute}/min)` : "off"}`,
        `**log channel:** ${s.notify.logChannel ? `<#${s.notify.logChannel}>` : "not set"}`,
        `**whitelist:** ${wl.length} entr${wl.length === 1 ? "y" : "ies"}`,
        `**lockdown:** ${lockdown?.active ? `${E.lock} ACTIVE until <t:${Math.floor(new Date(lockdown.expires_at).getTime() / 1000)}:R>` : "not active"}`,
      ];

      const embed = new EmbedBuilder()
        .setColor(COLORS.antinuke)
        .setTitle(`${E.shield} antinuke status`)
        .setDescription(lines.join("\n"))
        .setFooter({ text: "chromed · antinuke" });

      if (logs.length) {
        const recent = logs.slice(0, 3).map((l) => {
          const unix = Math.floor(new Date(l.created_at).getTime() / 1000);
          return `<t:${unix}:R> · <@${l.executor_id}> **${l.action}** ×${l.count} → \`${l.punishment}\``;
        }).join("\n");
        embed.addFields({ name: "recent detections", value: recent, inline: false });
      }
      return interaction.editReply({ embeds: [embed] });
    }

    /* ═══ PUNISHMENT ═══ */
    if (sub === "punishment" && !group) {
      const mode = interaction.options.getString("mode");
      if (!PUNISHMENTS[mode]) return reply(interaction, aEmbed(`${E.error} bad mode`, "unknown punishment.", COLORS.error));
      await store.saveSettings(p, guild.id, { punishment: mode });
      return reply(interaction, aEmbed(`${E.success} punishment set`, `now: **${PUNISHMENTS[mode].label}**`, COLORS.success));
    }

    /* ═══ MODE ═══ */
    if (sub === "mode" && !group) {
      const mode = interaction.options.getString("mode");
      await store.saveSettings(p, guild.id, { mode });
      return reply(interaction, aEmbed(
        `${E.success} mode set`,
        mode === "dry-run"
          ? "dry-run: antinuke will **detect and log** but won't punish."
          : "normal: antinuke will **punish** on trigger.",
        COLORS.success,
      ));
    }

    /* ═══ LOG CHANNEL ═══ */
    if (sub === "log-channel" && !group) {
      const ch = interaction.options.getChannel("channel");
      cfg.settings.notify.logChannel = ch?.id || null;
      await store.saveSettings(p, guild.id, { settings: cfg.settings });
      return reply(interaction, aEmbed(
        `${E.success} log channel`,
        ch ? `alerts go to ${ch}` : "cleared.",
        COLORS.success,
      ));
    }

    /* ═══ NOTIFY ═══ */
    if (sub === "notify" && !group) {
      const who = interaction.options.getString("who");
      const on = interaction.options.getBoolean("enabled");
      if (who === "owner") cfg.settings.notify.dmOwner = on;
      else cfg.settings.notify.dmExecutor = on;
      await store.saveSettings(p, guild.id, { settings: cfg.settings });
      return reply(interaction, aEmbed(`${E.success} notify updated`, `${who} DMs: **${on ? "on" : "off"}**`, COLORS.success));
    }

    /* ═══ AUTO-PANIC ═══ */
    if (sub === "auto-panic" && !group) {
      const on = interaction.options.getBoolean("enabled");
      cfg.settings.panicOnTrigger = on;
      await store.saveSettings(p, guild.id, { settings: cfg.settings });
      return reply(interaction, aEmbed(`${E.success} auto-panic`, `**${on ? "on" : "off"}**`, COLORS.success));
    }

    /* ═══ AUTO-RESTORE ═══ */
    if (sub === "auto-restore" && !group) {
      const on = interaction.options.getBoolean("enabled");
      if (on) {
        // confirm — dangerous
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("ar-yes").setLabel("yes, enable").setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId("ar-no").setLabel("cancel").setStyle(ButtonStyle.Secondary),
        );
        await interaction.editReply({
          embeds: [aEmbed(`${E.warning} enable auto-restore?`,
            "auto-restore will **wipe and rebuild your server** after every antinuke trigger using the panic snapshot.\n\n" +
            "if the trigger was a **false positive**, this makes things worse. strongly recommended to keep OFF and use `/backup undo` manually.\n\n" +
            "confirm in 30s.", COLORS.warn)],
          components: [row],
        });
        try {
          const btn = await interaction.channel.awaitMessageComponent({
            componentType: ComponentType.Button,
            time: 30_000,
            filter: (i) => i.user.id === interaction.user.id && ["ar-yes", "ar-no"].includes(i.customId),
          });
          if (btn.customId === "ar-no") {
            return btn.update({ embeds: [aEmbed(`${E.trash} cancelled`, "nothing changed.", COLORS.muted)], components: [] });
          }
          cfg.settings.autoRestore = true;
          await store.saveSettings(p, guild.id, { settings: cfg.settings });
          return btn.update({ embeds: [aEmbed(`${E.success} auto-restore ON`, "good luck.", COLORS.warn)], components: [] });
        } catch {
          return interaction.editReply({ embeds: [aEmbed("timed out", "nothing changed.", COLORS.muted)], components: [] }).catch(() => {});
        }
      } else {
        cfg.settings.autoRestore = false;
        await store.saveSettings(p, guild.id, { settings: cfg.settings });
        return reply(interaction, aEmbed(`${E.success} auto-restore`, "**off**", COLORS.success));
      }
    }

    /* ═══ THRESHOLD ═══ */
    if (sub === "threshold" && !group) {
      const action = interaction.options.getString("action");
      const count = interaction.options.getInteger("count");
      const windowSec = interaction.options.getInteger("window_seconds");
      if (!DEFAULT_THRESHOLDS[action]) return reply(interaction, aEmbed(`${E.error} unknown action`, `\`${action}\` isn't a valid action key.`, COLORS.error));

      cfg.settings.thresholds[action] = count;
      if (windowSec) cfg.settings.windows[action] = windowSec * 1000;
      await store.saveSettings(p, guild.id, { settings: cfg.settings });
      return reply(interaction, aEmbed(
        `${E.success} threshold updated`,
        `**${action}** triggers at **${count}** in **${windowSec || cfg.settings.windows[action] / 1000}s**.`,
        COLORS.success,
      ));
    }

    /* ═══ RESET THRESHOLDS ═══ */
    if (sub === "reset-thresholds" && !group) {
      const s = defaultSettings();
      cfg.settings.thresholds = s.thresholds;
      cfg.settings.windows = s.windows;
      cfg.settings.longWindow = s.longWindow;
      cfg.settings.rateSpike = s.rateSpike;
      await store.saveSettings(p, guild.id, { settings: cfg.settings });
      return reply(interaction, aEmbed(`${E.success} reset`, "thresholds restored to defaults.", COLORS.success));
    }

    /* ═══ IGNORE CHANNEL ═══ */
    if (sub === "ignore-channel" && !group) {
      const ch = interaction.options.getChannel("channel");
      const remove = interaction.options.getBoolean("remove") || false;
      const list = new Set(cfg.settings.ignoreChannels || []);
      if (remove) list.delete(ch.id);
      else list.add(ch.id);
      cfg.settings.ignoreChannels = [...list];
      await store.saveSettings(p, guild.id, { settings: cfg.settings });
      return reply(interaction, aEmbed(
        `${E.success} ignore list updated`,
        remove ? `${ch} is now monitored.` : `${ch} is now ignored.`,
        COLORS.success,
      ));
    }

    /* ═══ RAID MODE ═══ */
    if (sub === "raid-mode" && !group) {
      const on = interaction.options.getBoolean("enabled");
      cfg.settings.raid.enabled = on;
      await store.saveSettings(p, guild.id, { settings: cfg.settings });
      return reply(interaction, aEmbed(`${E.success} raid mode`, `**${on ? "on" : "off"}**`, COLORS.success));
    }

    /* ═══ RAID THRESHOLD ═══ */
    if (sub === "raid-threshold" && !group) {
      const count = interaction.options.getInteger("count");
      cfg.settings.raid.joinsPerMinute = count;
      await store.saveSettings(p, guild.id, { settings: cfg.settings });
      return reply(interaction, aEmbed(`${E.success} raid threshold`, `trigger at **${count} joins/min**.`, COLORS.success));
    }

    /* ═══ MANUAL LOCKDOWN ═══ */
    if (sub === "lockdown" && !group) {
      const reason = interaction.options.getString("reason") || "manual lockdown";
      await reply(interaction, aEmbed(`${E.loading} locking down…`, "locking every channel, hold on."));
      const res = await raidmode.lockdown(interaction.client, guild, reason, interaction.user.id);
      return reply(interaction, aEmbed(
        `${E.lock} lockdown active`,
        `**channels locked:** ${res.done}\n**expires:** <t:${Math.floor(res.expiresAt / 1000)}:R>`,
        COLORS.warn,
      ));
    }

    /* ═══ UNLOCK ═══ */
    if (sub === "unlock" && !group) {
      const res = await raidmode.liftLockdown(interaction.client, guild, `manual by ${interaction.user.id}`);
      if (!res.ok) return reply(interaction, aEmbed(`${E.warning} not locked`, "no active lockdown.", COLORS.warn));
      return reply(interaction, aEmbed(`${E.unlock} unlocked`, `**channels restored:** ${res.done}`, COLORS.success));
    }

    /* ═══ WHITELIST GROUP ═══ */
    if (group === "whitelist") {
      if (sub === "add") {
        const target = interaction.options.getMentionable("target");
        let type = "user";
        if (target?.members) type = "role";
        else if (target?.user?.bot) type = "bot";
        else if (target?.bot) type = "bot";
        const targetId = target.id;
        await store.whitelistAdd(p, guild.id, targetId, type, interaction.user.id);
        try { require("../cogs/antinuke").tracker.markWhitelistGrace(targetId); } catch {}
        return reply(interaction, aEmbed(`${E.success} whitelisted`, `<@${targetId}> added as **${type}**.`, COLORS.success));
      }

      if (sub === "remove") {
        const target = interaction.options.getMentionable("target");
        let type = "user";
        if (target?.members) type = "role";
        else if (target?.user?.bot || target?.bot) type = "bot";
        const ok = await store.whitelistRemove(p, guild.id, target.id, type);
        if (!ok) return reply(interaction, aEmbed(`${E.warning} not on list`, "that target isn't whitelisted.", COLORS.warn));
        return reply(interaction, aEmbed(`${E.success} removed`, `<@${target.id}> no longer bypasses antinuke.`, COLORS.success));
      }

      if (sub === "list") {
        const rows = await store.whitelistList(p, guild.id);
        if (!rows.length) return reply(interaction, aEmbed(`${E.list} empty whitelist`, "only the server owner and chromed bypass antinuke."));
        const grouped = { user: [], role: [], bot: [] };
        for (const r of rows) grouped[r.target_type]?.push(r.target_id);
        const lines = [];
        if (grouped.user.length) lines.push(`**users**\n${grouped.user.map((id) => `<@${id}>`).join(", ")}`);
        if (grouped.role.length) lines.push(`**roles**\n${grouped.role.map((id) => `<@&${id}>`).join(", ")}`);
        if (grouped.bot.length)  lines.push(`**bots**\n${grouped.bot.map((id) => `<@${id}>`).join(", ")}`);
        return reply(interaction, aEmbed(`${E.list} whitelist (${rows.length})`, lines.join("\n\n")));
      }

      if (sub === "clear") {
        const n = await store.whitelistClear(p, guild.id);
        return reply(interaction, aEmbed(`${E.trash} cleared`, `removed **${n}** entries.`, COLORS.muted));
      }
    }

    /* ═══ TRUST GROUP ═══ */
    if (group === "trust") {
      if (sub === "add") {
        const targetGuild = interaction.options.getString("guild_id").trim();
        const share = interaction.options.getBoolean("share_bans") ?? false;
        const accept = interaction.options.getBoolean("accept_bans") ?? false;
        if (!/^\d{15,25}$/.test(targetGuild)) return reply(interaction, aEmbed(`${E.error} bad id`, "that doesn't look like a guild id.", COLORS.error));
        if (targetGuild === guild.id) return reply(interaction, aEmbed(`${E.error} that's you`, "can't trust yourself.", COLORS.error));
        await store.trustAdd(p, guild.id, targetGuild, share, accept, interaction.user.id);
        return reply(interaction, aEmbed(
          `${E.success} trust added`,
          `**guild:** \`${targetGuild}\`\n**share our bans:** ${share}\n**accept their bans:** ${accept}`,
          COLORS.success,
        ));
      }
      if (sub === "remove") {
        const targetGuild = interaction.options.getString("guild_id").trim();
        const ok = await store.trustRemove(p, guild.id, targetGuild);
        if (!ok) return reply(interaction, aEmbed(`${E.warning} not trusted`, "that guild isn't on your trust list.", COLORS.warn));
        return reply(interaction, aEmbed(`${E.success} removed`, `\`${targetGuild}\` is no longer trusted.`, COLORS.success));
      }
      if (sub === "list") {
        const rows = await store.trustList(p, guild.id);
        if (!rows.length) return reply(interaction, aEmbed(`${E.list} no trusted guilds`, "add one with `/antinuke trust add`."));
        const lines = rows.map((r) => {
          const tags = [];
          if (r.share_bans) tags.push("share→");
          if (r.accept_bans) tags.push("←accept");
          return `\`${r.trusted_guild}\` ${tags.join(" ")}`;
        });
        return reply(interaction, aEmbed(`${E.list} trusted guilds (${rows.length})`, lines.join("\n")));
      }
    }

    /* ═══ LOGS ═══ */
    if (sub === "logs" && !group) {
      const limit = interaction.options.getInteger("limit") || 10;
      const rows = await store.listLogs(p, guild.id, limit);
      if (!rows.length) return reply(interaction, aEmbed(`${E.list} no detections`, "nothing has triggered antinuke."));
      const lines = rows.map((r) => {
        const unix = Math.floor(new Date(r.created_at).getTime() / 1000);
        const esc = r.escalated ? " ⚡" : "";
        return `<t:${unix}:R> · <@${r.executor_id}> **${r.action}** ×${r.count}${esc} → \`${r.punishment}\``;
      });
      return reply(interaction, aEmbed(`${E.list} recent detections (${rows.length})`, lines.join("\n")));
    }

    /* ═══ BASELINE ═══ */
    if (sub === "baseline" && !group) {
      const rows = await store.baselineAll(p, guild.id);
      if (!rows.length) return reply(interaction, aEmbed(`${E.list} no baseline yet`, "chromed needs a few days of activity to learn your server."));
      const lines = rows.slice(0, 15).map((r) =>
        `**${r.action}** — ${r.sample_count} samples, avg ${Number(r.avg_per_min).toFixed(2)}/min`
      );
      return reply(interaction, aEmbed(`${E.list} baseline activity`, lines.join("\n")));
    }

    /* ═══ TEST ═══ */
    if (sub === "test" && !group) {
      const fake = {
        executorId: interaction.user.id,
        action: "channelDelete",
        count: cfg.settings.thresholds.channelDelete || 3,
        threshold: cfg.settings.thresholds.channelDelete || 3,
        windowMs: (cfg.settings.windows.channelDelete || 10000),
        punishment: cfg.punishment + " (SIMULATION)",
        escalated: false,
        punishResult: { actions: ["simulation only — no action taken"] },
        snapshotId: null,
      };
      const { engine } = require("../cogs/antinuke");
      await engine.notifyGuild(interaction.client, guild, cfg, fake);
      return reply(interaction, aEmbed(
        `${E.success} test fired`,
        "check your log channel (and owner DM if enabled). nothing was punished.",
        COLORS.success,
      ));
    }
  },
};
