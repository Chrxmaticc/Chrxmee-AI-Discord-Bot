// commands/persona.js
// all-in-one persona command: panel, buttons, modals, slash subcommands.

const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle, ComponentType,
  PermissionFlagsBits,
} = require("discord.js");

const {
  E, COLORS, DEFAULTS, HARD_BLOCKED,
  confidenceFromSamples, formatMs,
  store, learner, speaker, blocked,
} = require("../cogs/persona");

const PANEL_TIMEOUT = 5 * 60 * 1000;

/* ═══════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════ */
function btn(id, label, style = ButtonStyle.Secondary, emoji = null, disabled = false) {
  const b = new ButtonBuilder()
    .setCustomId(id).setLabel(label).setStyle(style).setDisabled(disabled);
  if (emoji) { try { b.setEmoji(emoji); } catch {} }
  return b;
}

function toggleIcon(on) { return on ? E.on : E.off; }

async function replyEmbed(interaction, title, desc, color = COLORS.persona) {
  const embed = new EmbedBuilder().setColor(color).setTitle(title).setDescription(desc).setFooter({ text: "chromed · persona" });
  const payload = { embeds: [embed] };
  if (interaction.deferred || interaction.replied) return interaction.editReply(payload).catch(() => {});
  return interaction.reply(payload).catch(() => {});
}

function gateAdmin(interaction) {
  if (interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
  replyEmbed(interaction, `${E.error} nope`, "you need **manage server**.", COLORS.error);
  return false;
}

/* ═══════════════════════════════════════════════════════════════
   PANEL BUILDERS
   ═══════════════════════════════════════════════════════════════ */
async function buildMainPanel(pool, guild) {
  const cfg     = await store.getServerSettings(pool, guild.id);
  const total   = await store.serverCorpusCount(pool, guild.id);
  const optins  = await store.userListOptIns(pool, guild.id);
  const manual  = await store.blockedList(pool, guild.id);
  const swear   = await blocked.getGuildSwearBlock(pool, guild.id);

  const ready      = total >= cfg.minMessages;
  const confidence = confidenceFromSamples(total);
  const channels   = cfg.channels.length
    ? cfg.channels.slice(0, 8).map((id) => `<#${id}>`).join(", ")
    : "*none*";
  const lastBackfill = cfg.lastBackfillAt
    ? `<t:${Math.floor(new Date(cfg.lastBackfillAt).getTime() / 1000)}:R>`
    : "*never*";

  const desc = [
    `**${E.server} server persona**`,
    `${toggleIcon(cfg.enabled)} enabled · ${E.brain} \`${total.toLocaleString()}\` msgs`,
    `${E.speak} ready: ${ready ? "yes" : `no (${total}/${cfg.minMessages})`}`,
    `channels: ${channels}`,
    `${E.chance} chance: \`${cfg.replyChance}%\` · ${E.timer} \`${formatMs(cfg.cooldownMs)}\``,
    `${E.gif} gifs: ${toggleIcon(cfg.gifs)} · ${E.mention} mentions: ${toggleIcon(cfg.mentions)}`,
    ``,
    `**${E.user} user personas**`,
    `opted-in: \`${optins.length}\``,
    ``,
    `**${E.brain} learning**`,
    `${E.backfill} last backfill: ${lastBackfill}`,
    `confidence: \`${confidence}%\``,
    `${E.filter} blocked: \`${manual.length}\` manual · \`${swear.length}\` guild`,
  ].join("\n");

  const embed = new EmbedBuilder()
    .setColor(COLORS.persona)
    .setTitle(`${E.brain} persona config`)
    .setDescription(desc)
    .setFooter({ text: "chromed · persona" });

  const row1 = new ActionRowBuilder().addComponents(
    btn("p_tab_server", "Server",   ButtonStyle.Primary, E.server),
    btn("p_tab_user",   "User",     ButtonStyle.Secondary, E.user),
    btn("p_channels",   "Channels", ButtonStyle.Secondary),
    btn("p_chance",     "Chance",   ButtonStyle.Secondary, E.chance),
  );
  const row2 = new ActionRowBuilder().addComponents(
    btn("p_min_server", "Min msgs", ButtonStyle.Secondary, E.brain),
    btn("p_cooldown",   "Cooldown", ButtonStyle.Secondary, E.timer),
    btn("p_gifs",       "GIFs",     cfg.gifs ? ButtonStyle.Success : ButtonStyle.Secondary, E.gif),
    btn("p_mentions",   "Mentions", cfg.mentions ? ButtonStyle.Success : ButtonStyle.Secondary, E.mention),
  );
  const row3 = new ActionRowBuilder().addComponents(
    btn("p_edit_server", "Edit",     ButtonStyle.Primary, E.edit),
    btn("p_blocked",     "Blocked",  ButtonStyle.Secondary, E.filter),
    btn("p_backfill",    "Backfill", ButtonStyle.Secondary, E.backfill),
    btn("p_advanced",    "Advanced", ButtonStyle.Secondary, E.settings),
  );
  const row4 = new ActionRowBuilder().addComponents(
    btn("p_toggle_server", cfg.enabled ? "Disable" : "Enable",
        cfg.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
    btn("p_reset", "Reset", ButtonStyle.Danger, E.reset),
    btn("p_close", "Close", ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [row1, row2, row3, row4] };
}

async function buildServerPanel(pool, guild) {
  const cfg   = await store.getServerSettings(pool, guild.id);
  const total = await store.serverCorpusCount(pool, guild.id);
  const prof  = await store.getServerProfile(pool, guild.id);
  const p     = prof.profile || {};

  const desc = [
    `${toggleIcon(cfg.enabled)} **enabled**`,
    `${E.brain} \`${total.toLocaleString()}\` / min \`${cfg.minMessages}\``,
    `${E.chance} \`${cfg.replyChance}%\` · ${E.timer} \`${formatMs(cfg.cooldownMs)}\``,
    `${E.gif} ${toggleIcon(cfg.gifs)} · ${E.mention} ${toggleIcon(cfg.mentions)}`,
    ``,
    `**${E.brain} learned style**`,
    p.tone        ? `tone · \`${String(p.tone).slice(0, 140)}\`` : "*no profile yet*",
    p.avg_length  ? `avg length · \`~${p.avg_length}\` words` : null,
    p.emoji_style ? `emoji style · \`${String(p.emoji_style).slice(0, 100)}\`` : null,
    p.phrases?.length
      ? `phrases · ${p.phrases.slice(0, 8).map((x) => `\`${x}\``).join(" ")}`
      : null,
  ].filter(Boolean).join("\n");

  const embed = new EmbedBuilder()
    .setColor(COLORS.persona)
    .setTitle(`${E.server} server persona`)
    .setDescription(desc)
    .setFooter({ text: "chromed · persona" });

  const row1 = new ActionRowBuilder().addComponents(
    btn("p_chance",     "Chance",   ButtonStyle.Secondary, E.chance),
    btn("p_cooldown",   "Cooldown", ButtonStyle.Secondary, E.timer),
    btn("p_min_server", "Min msgs", ButtonStyle.Secondary, E.brain),
    btn("p_channels",   "Channels", ButtonStyle.Secondary),
  );
  const row2 = new ActionRowBuilder().addComponents(
    btn("p_gifs",       "GIFs",     cfg.gifs ? ButtonStyle.Success : ButtonStyle.Secondary, E.gif),
    btn("p_mentions",   "Mentions", cfg.mentions ? ButtonStyle.Success : ButtonStyle.Secondary, E.mention),
    btn("p_edit_server", "Edit",    ButtonStyle.Primary, E.edit),
    btn("p_blocked",    "Blocked",  ButtonStyle.Secondary, E.filter),
  );
  const row3 = new ActionRowBuilder().addComponents(
    btn("p_back",     "← Back",   ButtonStyle.Secondary),
    btn("p_backfill", "Backfill", ButtonStyle.Secondary, E.backfill),
    btn("p_close",    "Close",    ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [row1, row2, row3] };
}

async function buildUserPanel(pool, guild) {
  const optins = await store.userListOptIns(pool, guild.id);

  const list = optins.length
    ? optins.slice(0, 12).map((o) => {
        const ready = o.learned_count >= o.min_messages;
        return `<@${o.user_id}> — \`${o.learned_count}\` msgs · ${ready ? `${E.on} ready` : `${E.off} ${o.learned_count}/${o.min_messages}`}`;
      }).join("\n")
    : "*no one has opted in yet*";

  const embed = new EmbedBuilder()
    .setColor(COLORS.persona)
    .setTitle(`${E.user} user personas`)
    .setDescription([
      `users opt in themselves to teach chromed their voice`,
      ``,
      `**opted-in (${optins.length})**`,
      list,
    ].join("\n"))
    .setFooter({ text: "chromed · persona" });

  const row1 = new ActionRowBuilder().addComponents(
    btn("p_user_in",  "Opt me in",   ButtonStyle.Success),
    btn("p_user_out", "Opt me out",  ButtonStyle.Danger),
    btn("p_min_user", "My min msgs", ButtonStyle.Secondary, E.brain),
    btn("p_back",     "← Back",      ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [row1] };
}

async function buildBlockedPanel(pool, guild) {
  const manual = await store.blockedList(pool, guild.id);
  const swear  = await blocked.getGuildSwearBlock(pool, guild.id);

  const desc = [
    `**hardcoded:** \`${HARD_BLOCKED.length}\` words — always active`,
    `**guild swear:** \`${swear.length}\` words`,
    `**manual:** \`${manual.length}\` words`,
    ``,
    manual.length
      ? manual.slice(0, 30).map((m) => `\`${m.word}\``).join(" ")
      : "*no manual blocks*",
  ].join("\n");

  const embed = new EmbedBuilder()
    .setColor(COLORS.persona)
    .setTitle(`${E.filter} blocked words`)
    .setDescription(desc)
    .setFooter({ text: "chromed · persona" });

  const row1 = new ActionRowBuilder().addComponents(
    btn("p_blocked_add",    "Add",    ButtonStyle.Success),
    btn("p_blocked_remove", "Remove", ButtonStyle.Danger),
    btn("p_back",           "← Back", ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [row1] };
}

/* ═══════════════════════════════════════════════════════════════
   MODAL FACTORY
   ═══════════════════════════════════════════════════════════════ */
function makeModal(id, title, label, placeholder, current, { paragraph = false } = {}) {
  const modal = new ModalBuilder().setCustomId(id).setTitle(title);
  const input = new TextInputBuilder()
    .setCustomId("value")
    .setLabel(label)
    .setStyle(paragraph ? TextInputStyle.Paragraph : TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder(placeholder);
  if (current !== undefined && current !== null) input.setValue(String(current).slice(0, paragraph ? 3800 : 200));
  modal.addComponents(new ActionRowBuilder().addComponents(input));
  return modal;
}

/* ═══════════════════════════════════════════════════════════════
   MODAL SUBMIT HANDLER — called inline from button handler
   ═══════════════════════════════════════════════════════════════ */
async function processModal(modal, pool, guild, userId) {
  const id = modal.customId;
  const raw = modal.fields.getTextInputValue("value") || "";
  const value = raw.trim();

  if (id === "p_modal_chance") {
    const n = parseInt(value, 10);
    if (isNaN(n) || n < 0 || n > 100) return { ok: false, msg: `${E.error} pick 0-100.` };
    await store.saveServerSettings(pool, guild.id, { replyChance: n });
    return { ok: true, msg: `${E.success} chance set to **${n}%**.` };
  }

  if (id === "p_modal_cooldown") {
    const n = parseInt(value, 10);
    if (isNaN(n) || n < 0 || n > 3600) return { ok: false, msg: `${E.error} pick 0-3600 seconds.` };
    await store.saveServerSettings(pool, guild.id, { cooldownMs: n * 1000 });
    return { ok: true, msg: `${E.success} cooldown set to **${n}s**.` };
  }

  if (id === "p_modal_min_server") {
    const n = parseInt(value, 10);
    if (isNaN(n) || n < 1 || n > 100000) return { ok: false, msg: `${E.error} pick 1-100000.` };
    await store.saveServerSettings(pool, guild.id, { minMessages: n });
    return { ok: true, msg: `${E.success} server threshold set to **${n}**.` };
  }

  if (id === "p_modal_min_user") {
    const n = parseInt(value, 10);
    if (isNaN(n) || n < 1 || n > 100000) return { ok: false, msg: `${E.error} pick 1-100000.` };
    const opt = await store.userIsOptedIn(pool, userId, guild.id);
    if (!opt.optedIn) return { ok: false, msg: `${E.error} opt in first.` };
    await store.userSetMinMessages(pool, userId, guild.id, n);
    return { ok: true, msg: `${E.success} your threshold set to **${n}**.` };
  }

  if (id === "p_modal_edit_server") {
    let parsed = null;
    if (value) {
      try { parsed = JSON.parse(value); }
      catch { parsed = { extra: value }; }
    }
    await store.saveServerManualEdit(pool, guild.id, parsed);
    return { ok: true, msg: parsed ? `${E.success} override saved.` : `${E.success} override cleared.` };
  }

  if (id === "p_modal_blocked_add") {
    if (!value) return { ok: false, msg: `${E.error} enter a word.` };
    await store.blockedAdd(pool, guild.id, value, userId);
    return { ok: true, msg: `${E.success} \`${value}\` blocked.` };
  }

  if (id === "p_modal_blocked_remove") {
    if (!value) return { ok: false, msg: `${E.error} enter a word.` };
    const ok = await store.blockedRemove(pool, guild.id, value);
    return { ok: true, msg: ok ? `${E.success} \`${value}\` removed.` : `${E.warning} \`${value}\` wasn't blocked.` };
  }

  return { ok: false, msg: "unhandled modal." };
}

/* ═══════════════════════════════════════════════════════════════
   PANEL SESSION — button collector + inline modal handling
   ═══════════════════════════════════════════════════════════════ */
async function openPanel(interaction, pool, guild) {
  const payload = await buildMainPanel(pool, guild);
  await interaction.reply(payload).catch(() => {});
  const msg = await interaction.fetchReply().catch(() => null);
  if (!msg) return;

  const state = { view: "main" };

  const collector = msg.createMessageComponentCollector({
    time: PANEL_TIMEOUT,
    componentType: ComponentType.Button,
  });

  collector.on("collect", async (i) => {
    if (i.user.id !== interaction.user.id) {
      return i.reply({ content: "not your panel — run `/persona menu` yourself.", ephemeral: true }).catch(() => {});
    }

    const id = i.customId;

    try {
      // ── tab switches ──
      if (id === "p_tab_server") { state.view = "server";  return await i.update(await buildServerPanel(pool, guild)); }
      if (id === "p_tab_user")   { state.view = "user";    return await i.update(await buildUserPanel(pool, guild)); }
      if (id === "p_back")       { state.view = "main";    return await i.update(await buildMainPanel(pool, guild)); }

      // ── toggles ──
      if (id === "p_toggle_server") {
        const cfg = await store.getServerSettings(pool, guild.id);
        await store.saveServerSettings(pool, guild.id, { enabled: !cfg.enabled });
        await store.logAudit(pool, { guildId: guild.id, actorId: i.user.id, action: cfg.enabled ? "server-disable" : "server-enable" });
        return await i.update(await buildMainPanel(pool, guild));
      }
      if (id === "p_gifs") {
        const cfg = await store.getServerSettings(pool, guild.id);
        await store.saveServerSettings(pool, guild.id, { gifs: !cfg.gifs });
        const next = state.view === "server" ? await buildServerPanel(pool, guild) : await buildMainPanel(pool, guild);
        return await i.update(next);
      }
      if (id === "p_mentions") {
        const cfg = await store.getServerSettings(pool, guild.id);
        await store.saveServerSettings(pool, guild.id, { mentions: !cfg.mentions });
        const next = state.view === "server" ? await buildServerPanel(pool, guild) : await buildMainPanel(pool, guild);
        return await i.update(next);
      }

      // ── modals ──
      const modalDefs = {
        p_chance:      ["p_modal_chance",      "Reply Chance",        "percent (0-100)",    "5"],
        p_cooldown:    ["p_modal_cooldown",    "Cooldown",            "seconds (0-3600)",   "30"],
        p_min_server:  ["p_modal_min_server",  "Server Min Messages", "messages before speaking", "40"],
        p_min_user:    ["p_modal_min_user",    "Your Min Messages",   "before chromed speaks as you", "40"],
        p_edit_server: ["p_modal_edit_server", "Edit Persona",        "JSON or plain text", `{"tone": "chill but hype", "phrases": ["lock in"]}`],
        p_blocked_add:    ["p_modal_blocked_add",    "Block Word",   "word",   "example"],
        p_blocked_remove: ["p_modal_blocked_remove", "Unblock Word", "word",   "example"],
      };

      if (modalDefs[id]) {
        const [modalId, title, label, placeholder] = modalDefs[id];
        let current;
        if (id === "p_chance")      current = (await store.getServerSettings(pool, guild.id)).replyChance;
        if (id === "p_cooldown")    current = Math.round((await store.getServerSettings(pool, guild.id)).cooldownMs / 1000);
        if (id === "p_min_server")  current = (await store.getServerSettings(pool, guild.id)).minMessages;
        if (id === "p_min_user")    { const o = await store.userIsOptedIn(pool, i.user.id, guild.id); current = o.optedIn ? o.minMessages : DEFAULTS.userMinMessages; }
        if (id === "p_edit_server") { const pr = await store.getServerProfile(pool, guild.id); current = pr.manualEdit ? JSON.stringify(pr.manualEdit, null, 2) : ""; }

        const paragraph = id === "p_edit_server";
        await i.showModal(makeModal(modalId, title, label, placeholder, current, { paragraph }));

        // wait for THIS user's modal submit
        let submission;
        try {
          submission = await i.awaitModalSubmit({
            time: 5 * 60 * 1000,
            filter: (m) => m.user.id === i.user.id && m.customId === modalId,
          });
        } catch {
          return; // timed out silently
        }

        const result = await processModal(submission, pool, guild, i.user.id);
        await submission.reply({ content: result.msg, ephemeral: true }).catch(() => {});

        // refresh panel view under the user
        const refreshed = state.view === "server" ? await buildServerPanel(pool, guild)
                        : state.view === "user"   ? await buildUserPanel(pool, guild)
                        : state.view === "blocked" ? await buildBlockedPanel(pool, guild)
                        : await buildMainPanel(pool, guild);
        await msg.edit(refreshed).catch(() => {});
        return;
      }

      // ── blocked panel ──
      if (id === "p_blocked") { state.view = "blocked"; return await i.update(await buildBlockedPanel(pool, guild)); }

      // ── channels hint ──
      if (id === "p_channels") {
        return i.reply({
          content: "use `/persona server channel add|remove|list`",
          ephemeral: true,
        }).catch(() => {});
      }

      // ── advanced hint ──
      if (id === "p_advanced") {
        return i.reply({
          content: "`/persona server min-messages`, `/persona server ignore-bots`, `/persona server reset`, `/persona audit`",
          ephemeral: true,
        }).catch(() => {});
      }

      // ── backfill ──
      if (id === "p_backfill") {
        const cfg = await store.getServerSettings(pool, guild.id);
        if (!cfg.channels.length) {
          return i.reply({ content: "add a learning channel first.", ephemeral: true }).catch(() => {});
        }
        await i.reply({ content: `backfilling ${cfg.channels.length} channel(s)…`, ephemeral: true }).catch(() => {});
        let total = 0;
        for (const chId of cfg.channels.slice(0, 5)) {
          try {
            const res = await learner.backfillChannel(i.client, guild.id, chId, 500);
            total += res.added || 0;
          } catch {}
        }
        return i.followUp({ content: `${E.success} backfill done — **+${total}** learned.`, ephemeral: true }).catch(() => {});
      }

      // ── reset hint ──
      if (id === "p_reset") {
        return i.reply({ content: "run `/persona server reset` to confirm.", ephemeral: true }).catch(() => {});
      }

      // ── user actions ──
      if (id === "p_user_in") {
        await store.userOptIn(pool, i.user.id, guild.id);
        await store.logAudit(pool, { guildId: guild.id, actorId: i.user.id, action: "user-optin" });
        return i.reply({ content: `${E.success} opted in.`, ephemeral: true }).catch(() => {});
      }
      if (id === "p_user_out") {
        const removed = await store.userOptOut(pool, i.user.id, guild.id);
        await store.logAudit(pool, { guildId: guild.id, actorId: i.user.id, action: "user-optout", detail: `${removed} msgs` });
        return i.reply({ content: `${E.success} opted out — data purged.`, ephemeral: true }).catch(() => {});
      }

      // ── close ──
      if (id === "p_close") {
        await i.update({ components: [] }).catch(() => {});
        return collector.stop();
      }

      return i.reply({ content: "unhandled.", ephemeral: true }).catch(() => {});
    } catch (err) {
      console.error("[persona panel]", err);
      if (!i.replied && !i.deferred) {
        await i.reply({ content: "something broke.", ephemeral: true }).catch(() => {});
      }
    }
  });

  collector.on("end", async () => {
    try {
      const m = await interaction.fetchReply().catch(() => null);
      if (!m?.components?.length) return;
      const rows = m.components.map((row) => {
        const r = new ActionRowBuilder();
        for (const c of row.components) r.addComponents(ButtonBuilder.from(c).setDisabled(true));
        return r;
      });
      await interaction.editReply({ components: rows }).catch(() => {});
    } catch {}
  });
}

/* ═══════════════════════════════════════════════════════════════
   SLASH COMMAND
   ═══════════════════════════════════════════════════════════════ */
module.exports = {
  data: new SlashCommandBuilder()
    .setName("persona")
    .setDescription("teach chromed how to talk like you (or your server)")
    .setDMPermission(false)
    .addSubcommand((s) => s.setName("menu").setDescription("open the persona config panel"))

    .addSubcommandGroup((g) => g
      .setName("server")
      .setDescription("server-wide persona")
      .addSubcommand((s) => s.setName("enable").setDescription("turn on"))
      .addSubcommand((s) => s.setName("disable").setDescription("turn off"))
      .addSubcommand((s) => s
        .setName("channel")
        .setDescription("manage learning channels")
        .addStringOption((o) => o.setName("action").setDescription("what").setRequired(true)
          .addChoices(
            { name: "add", value: "add" },
            { name: "remove", value: "remove" },
            { name: "list", value: "list" },
          ))
        .addChannelOption((o) => o.setName("channel").setDescription("channel").setRequired(false))
      )
      .addSubcommand((s) => s
        .setName("min-messages")
        .setDescription("threshold before chromed speaks")
        .addIntegerOption((o) => o.setName("count").setDescription("messages").setRequired(true).setMinValue(1).setMaxValue(100000))
      )
      .addSubcommand((s) => s
        .setName("chance")
        .setDescription("reply chance %")
        .addIntegerOption((o) => o.setName("percent").setDescription("0-100").setRequired(true).setMinValue(0).setMaxValue(100))
      )
      .addSubcommand((s) => s
        .setName("cooldown")
        .setDescription("cooldown between replies (seconds)")
        .addIntegerOption((o) => o.setName("seconds").setDescription("0-3600").setRequired(true).setMinValue(0).setMaxValue(3600))
      )
      .addSubcommand((s) => s
        .setName("ignore-bots")
        .setDescription("skip bot messages")
        .addBooleanOption((o) => o.setName("enabled").setDescription("on/off").setRequired(true))
      )
      .addSubcommand((s) => s
        .setName("backfill")
        .setDescription("learn from channel history")
        .addIntegerOption((o) => o.setName("count").setDescription("per channel (default 500)").setRequired(false).setMinValue(50).setMaxValue(1000))
      )
      .addSubcommand((s) => s.setName("reset").setDescription("⚠ wipe ALL server persona data"))
      .addSubcommand((s) => s.setName("profile").setDescription("view what chromed learned"))
    )

    .addSubcommandGroup((g) => g
      .setName("user")
      .setDescription("your personal persona")
      .addSubcommand((s) => s.setName("opt-in").setDescription("teach chromed your voice"))
      .addSubcommand((s) => s.setName("opt-out").setDescription("stop + purge your data"))
      .addSubcommand((s) => s.setName("status").setDescription("see your status"))
      .addSubcommand((s) => s.setName("list").setDescription("list opted-in users (admin)"))
      .addSubcommand((s) => s
        .setName("speak")
        .setDescription("generate a message as a user (draft)")
        .addUserOption((o) => o.setName("user").setDescription("who").setRequired(true))
        .addStringOption((o) => o.setName("topic").setDescription("what").setRequired(true))
      )
      .addSubcommand((s) => s
        .setName("purge")
        .setDescription("(admin) wipe a user's persona")
        .addUserOption((o) => o.setName("user").setDescription("user").setRequired(true))
      )
    )

    .addSubcommand((s) => s
      .setName("blocked")
      .setDescription("manage blocked words")
      .addStringOption((o) => o.setName("action").setDescription("add/remove/list").setRequired(true)
        .addChoices(
          { name: "add", value: "add" },
          { name: "remove", value: "remove" },
          { name: "list", value: "list" },
        ))
      .addStringOption((o) => o.setName("word").setDescription("word").setRequired(false))
    )
    .addSubcommand((s) => s.setName("status").setDescription("quick status"))
    .addSubcommand((s) => s.setName("audit").setDescription("recent persona actions"))
    .addSubcommand((s) => s.setName("help").setDescription("how persona works")),

  async execute(interaction) {
    const pool = interaction.client.pool;
    const guild = interaction.guild;
    const sub = interaction.options.getSubcommand(true);
    const group = interaction.options.getSubcommandGroup(false);

    if (sub === "menu" && !group) {
      return openPanel(interaction, pool, guild);
    }

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply().catch(() => {});
    }

    /* ═══ SERVER ═══ */
    if (group === "server") {
      if (!gateAdmin(interaction)) return;

      if (sub === "enable") {
        await store.saveServerSettings(pool, guild.id, { enabled: true });
        await store.logAudit(pool, { guildId: guild.id, actorId: interaction.user.id, action: "server-enable" });
        return replyEmbed(interaction, `${E.success} server persona on`, "chromed will learn from your channels.", COLORS.success);
      }

      if (sub === "disable") {
        await store.saveServerSettings(pool, guild.id, { enabled: false });
        await store.logAudit(pool, { guildId: guild.id, actorId: interaction.user.id, action: "server-disable" });
        return replyEmbed(interaction, `${E.success} off`, "stopped.", COLORS.success);
      }

      if (sub === "channel") {
        const action = interaction.options.getString("action");
        const ch = interaction.options.getChannel("channel");
        const cfg = await store.getServerSettings(pool, guild.id);

        if (action === "list") {
          return replyEmbed(interaction, `${E.list} learning channels`,
            cfg.channels.length ? cfg.channels.map((id) => `<#${id}>`).join("\n") : "*none*");
        }
        if (!ch) return replyEmbed(interaction, `${E.error} no channel`, "pick one.", COLORS.error);

        const set = new Set(cfg.channels);
        if (action === "add") set.add(ch.id);
        else set.delete(ch.id);
        await store.saveServerSettings(pool, guild.id, { channels: [...set] });
        return replyEmbed(interaction, `${E.success} updated`,
          action === "add" ? `${ch} added.` : `${ch} removed.`, COLORS.success);
      }

      if (sub === "min-messages") {
        const n = interaction.options.getInteger("count");
        await store.saveServerSettings(pool, guild.id, { minMessages: n });
        return replyEmbed(interaction, `${E.success} set`, `threshold: **${n}**`, COLORS.success);
      }

      if (sub === "chance") {
        const n = interaction.options.getInteger("percent");
        await store.saveServerSettings(pool, guild.id, { replyChance: n });
        return replyEmbed(interaction, `${E.success} set`, `chance: **${n}%**`, COLORS.success);
      }

      if (sub === "cooldown") {
        const n = interaction.options.getInteger("seconds");
        await store.saveServerSettings(pool, guild.id, { cooldownMs: n * 1000 });
        return replyEmbed(interaction, `${E.success} set`, `cooldown: **${formatMs(n * 1000)}**`, COLORS.success);
      }

      if (sub === "ignore-bots") {
        const on = interaction.options.getBoolean("enabled");
        await store.saveServerSettings(pool, guild.id, { ignoreBots: on });
        return replyEmbed(interaction, `${E.success} set`, `ignore bots: **${on ? "on" : "off"}**`, COLORS.success);
      }

      if (sub === "backfill") {
        const cfg = await store.getServerSettings(pool, guild.id);
        if (!cfg.channels.length) return replyEmbed(interaction, `${E.error} no channels`, "add one first.", COLORS.error);
        const count = interaction.options.getInteger("count") || 500;
        await replyEmbed(interaction, `${E.loading} backfilling…`, `up to **${count}** per channel`);
        let total = 0;
        for (const chId of cfg.channels.slice(0, 10)) {
          try {
            const res = await learner.backfillChannel(interaction.client, guild.id, chId, count);
            total += res.added || 0;
          } catch {}
        }
        return replyEmbed(interaction, `${E.success} done`, `**+${total}** learned.`, COLORS.success);
      }

      if (sub === "reset") {
        const row = new ActionRowBuilder().addComponents(
          btn("p_reset_yes", "yes, wipe", ButtonStyle.Danger),
          btn("p_reset_no", "cancel", ButtonStyle.Secondary),
        );
        await interaction.editReply({
          embeds: [new EmbedBuilder().setColor(COLORS.warn).setTitle(`${E.warning} wipe server persona?`)
            .setDescription("deletes all learned messages + profile. cannot undo.").setFooter({ text: "chromed · persona" })],
          components: [row],
        });
        try {
          const click = await interaction.channel.awaitMessageComponent({
            componentType: ComponentType.Button,
            time: 30_000,
            filter: (i) => i.user.id === interaction.user.id && ["p_reset_yes", "p_reset_no"].includes(i.customId),
          });
          if (click.customId === "p_reset_no") {
            return click.update({ embeds: [new EmbedBuilder().setColor(COLORS.muted).setTitle("cancelled")], components: [] });
          }
          const removed = await store.serverCorpusReset(pool, guild.id);
          return click.update({ embeds: [new EmbedBuilder().setColor(COLORS.success).setTitle(`${E.success} wiped`).setDescription(`deleted **${removed}** messages + profile.`)], components: [] });
        } catch {
          return interaction.editReply({ embeds: [new EmbedBuilder().setColor(COLORS.muted).setTitle("timed out")], components: [] }).catch(() => {});
        }
      }

      if (sub === "profile") {
        const prof = await store.getServerProfile(pool, guild.id);
        const total = await store.serverCorpusCount(pool, guild.id);
        const p = prof.profile || {};
        const lines = [
          `**samples:** ${total}`,
          `**confidence:** ${confidenceFromSamples(total)}%`,
          `**tone:** ${p.tone || "—"}`,
          `**avg length:** ${p.avg_length || "—"}`,
          `**punctuation:** ${p.punctuation || "—"}`,
          `**emoji style:** ${p.emoji_style || "—"}`,
          `**phrases:** ${(p.phrases || []).join(", ") || "—"}`,
          `**topics:** ${(p.topics || []).join(", ") || "—"}`,
          ``,
          `**examples:**`,
          ...(p.sample_messages || []).slice(0, 5).map((s) => `> ${s}`),
        ];
        return replyEmbed(interaction, `${E.brain} server profile`, lines.join("\n"));
      }
    }

    /* ═══ USER ═══ */
    if (group === "user") {
      if (sub === "opt-in") {
        await store.userOptIn(pool, interaction.user.id, guild.id);
        await store.logAudit(pool, { guildId: guild.id, actorId: interaction.user.id, action: "user-optin" });
        return replyEmbed(interaction, `${E.success} opted in`, "start chatting.", COLORS.success);
      }
      if (sub === "opt-out") {
        const removed = await store.userOptOut(pool, interaction.user.id, guild.id);
        await store.logAudit(pool, { guildId: guild.id, actorId: interaction.user.id, action: "user-optout", detail: `${removed}` });
        return replyEmbed(interaction, `${E.success} opted out`, `deleted **${removed}** messages.`, COLORS.success);
      }
      if (sub === "status") {
        const opt = await store.userIsOptedIn(pool, interaction.user.id, guild.id);
        if (!opt.optedIn) return replyEmbed(interaction, `${E.list} not opted in`, "run `/persona user opt-in`.");
        const total = await store.userCorpusCount(pool, interaction.user.id, guild.id);
        const prof = await store.getUserProfile(pool, interaction.user.id, guild.id);
        const ready = total >= opt.minMessages;
        return replyEmbed(interaction, `${E.user} your persona`, [
          `**messages:** ${total} / min ${opt.minMessages}`,
          `**ready:** ${ready ? "yes" : "no"}`,
          `**confidence:** ${confidenceFromSamples(total)}%`,
          `**tone:** ${prof.profile?.tone || "—"}`,
        ].join("\n"));
      }
      if (sub === "list") {
        if (!gateAdmin(interaction)) return;
        const rows = await store.userListOptIns(pool, guild.id);
        if (!rows.length) return replyEmbed(interaction, `${E.list} no opt-ins`, "nobody yet.");
        const lines = rows.map((r) => {
          const ready = r.learned_count >= r.min_messages;
          return `<@${r.user_id}> — \`${r.learned_count}\` · ${ready ? "ready" : `${r.learned_count}/${r.min_messages}`}`;
        });
        return replyEmbed(interaction, `${E.list} opted-in (${rows.length})`, lines.join("\n"));
      }
      if (sub === "speak") {
        const target = interaction.options.getUser("user");
        const topic = interaction.options.getString("topic");
        await replyEmbed(interaction, `${E.loading} drafting…`, `mimicking <@${target.id}> about *${topic}*`);
        const res = await speaker.generateUserSpeak(interaction.client, target.id, guild.id, topic);
        if (!res.ok) return replyEmbed(interaction, `${E.error} can't`, res.reason, COLORS.error);

        const row = new ActionRowBuilder().addComponents(
          btn("p_speak_send", "send it", ButtonStyle.Success),
          btn("p_speak_cancel", "cancel", ButtonStyle.Secondary),
        );
        await interaction.editReply({
          embeds: [new EmbedBuilder().setColor(COLORS.persona).setTitle(`${E.speak} draft as ${target.username}`)
            .setDescription(`${res.text}\n\n-# chromed, mimicking <@${target.id}>`).setFooter({ text: "chromed · persona" })],
          components: [row],
        });
        try {
          const click = await interaction.channel.awaitMessageComponent({
            componentType: ComponentType.Button,
            time: 60_000,
            filter: (i) => i.user.id === interaction.user.id && ["p_speak_send", "p_speak_cancel"].includes(i.customId),
          });
          if (click.customId === "p_speak_cancel") {
            return click.update({ embeds: [new EmbedBuilder().setColor(COLORS.muted).setTitle("cancelled")], components: [] });
          }
          await click.channel.send({ content: `${res.text}\n-# chromed, mimicking <@${target.id}>` });
          return click.update({ embeds: [new EmbedBuilder().setColor(COLORS.success).setTitle(`${E.success} sent`)], components: [] });
        } catch {
          return interaction.editReply({ embeds: [new EmbedBuilder().setColor(COLORS.muted).setTitle("timed out")], components: [] }).catch(() => {});
        }
      }
      if (sub === "purge") {
        if (!gateAdmin(interaction)) return;
        const target = interaction.options.getUser("user");
        const removed = await store.userOptOut(pool, target.id, guild.id);
        await store.logAudit(pool, { guildId: guild.id, actorId: interaction.user.id, action: "admin-purge-user", detail: `${target.id}` });
        return replyEmbed(interaction, `${E.success} purged`, `deleted **${removed}** messages from <@${target.id}>.`, COLORS.success);
      }
    }

    /* ═══ BLOCKED ═══ */
    if (sub === "blocked" && !group) {
      if (!gateAdmin(interaction)) return;
      const action = interaction.options.getString("action");
      const word = (interaction.options.getString("word") || "").trim().toLowerCase();

      if (action === "list") {
        const manual = await store.blockedList(pool, guild.id);
        const swear = await blocked.getGuildSwearBlock(pool, guild.id);
        return replyEmbed(interaction, `${E.filter} blocked`, [
          `**hardcoded:** ${HARD_BLOCKED.length}`,
          `**guild swear:** ${swear.length}`,
          `**manual (${manual.length}):** ${manual.map((m) => `\`${m.word}\``).join(" ") || "*none*"}`,
        ].join("\n"));
      }
      if (!word) return replyEmbed(interaction, `${E.error} no word`, "provide one.", COLORS.error);
      if (action === "add") {
        await store.blockedAdd(pool, guild.id, word, interaction.user.id);
        return replyEmbed(interaction, `${E.success} blocked`, `\`${word}\``, COLORS.success);
      }
      const ok = await store.blockedRemove(pool, guild.id, word);
      return replyEmbed(interaction, ok ? `${E.success} removed` : `${E.warning} not found`,
        ok ? `\`${word}\` removed.` : `\`${word}\` wasn't blocked.`, ok ? COLORS.success : COLORS.warn);
    }

    /* ═══ STATUS ═══ */
    if (sub === "status" && !group) {
      const cfg = await store.getServerSettings(pool, guild.id);
      const total = await store.serverCorpusCount(pool, guild.id);
      const optins = await store.userListOptIns(pool, guild.id);
      return replyEmbed(interaction, `${E.brain} persona status`, [
        `**server:** ${cfg.enabled ? "on" : "off"}`,
        `**channels:** ${cfg.channels.length}`,
        `**learned:** ${total} / min ${cfg.minMessages}`,
        `**chance:** ${cfg.replyChance}%`,
        `**cooldown:** ${formatMs(cfg.cooldownMs)}`,
        `**user personas:** ${optins.length}`,
      ].join("\n"));
    }

    /* ═══ AUDIT ═══ */
    if (sub === "audit" && !group) {
      if (!gateAdmin(interaction)) return;
      const rows = await store.listAudit(pool, guild.id, 15);
      if (!rows.length) return replyEmbed(interaction, `${E.list} no history`, "nothing yet.");
      const lines = rows.map((r) => {
        const unix = Math.floor(new Date(r.created_at).getTime() / 1000);
        return `<t:${unix}:R> · <@${r.actor_id}> **${r.action}**${r.detail ? ` — ${r.detail}` : ""}`;
      });
      return replyEmbed(interaction, `${E.list} persona audit`, lines.join("\n"));
    }

    /* ═══ HELP ═══ */
    if (sub === "help" && !group) {
      return replyEmbed(interaction, `${E.brain} persona help`, [
        `**server persona**`,
        "chromed learns the vibe of channels you enable and replies occasionally.",
        "`/persona menu` to configure.",
        ``,
        `**user persona**`,
        "`/persona user opt-in` — teach chromed YOUR voice",
        "`/persona user speak @user topic` — generate a draft in someone's voice",
        ``,
        `**safety**`,
        "• hardcoded blocks for slurs + harmful content",
        "• obeys server swear filter",
        "• `/persona user opt-out` purges instantly",
      ].join("\n"));
    }
  },
};
