// cogs/persona/menu.js
// panel builders + button routing + modal handlers for /persona.

const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle, ComponentType,
} = require("discord.js");

const {
  E, COLORS, DEFAULTS, confidenceFromSamples, formatMs,
} = require("./constants");
const store   = require("./store");
const blocked = require("./blocked");

const PANEL_TIMEOUT = 5 * 60 * 1000;

/* ═══════════════════════════════════════════════════════════════
   BUTTON IDS
   ═══════════════════════════════════════════════════════════════ */
const IDS = {
  tabMain:       "persona_tab_main",
  tabServer:     "persona_tab_server",
  tabUser:       "persona_tab_user",
  toggleServer:  "persona_toggle_server",
  channels:      "persona_channels",
  chance:        "persona_chance",
  cooldown:      "persona_cooldown",
  minServer:     "persona_min_server",
  minUser:       "persona_min_user",
  gifs:          "persona_gifs",
  mentions:      "persona_mentions",
  blocked:       "persona_blocked",
  blockedAdd:    "persona_blocked_add",
  blockedRemove: "persona_blocked_remove",
  editServer:    "persona_edit_server",
  editUser:      "persona_edit_user",
  backfill:      "persona_backfill",
  advanced:      "persona_advanced",
  reset:         "persona_reset",
  close:         "persona_close",
  back:          "persona_back_main",
  userOptIn:     "persona_user_optin_self",
  userOptOut:    "persona_user_optout_self",
  userRefresh:   "persona_user_refresh",
};

/* ═══════════════════════════════════════════════════════════════
   SAFE BUTTON BUILDER
   ═══════════════════════════════════════════════════════════════ */
function btn(id, label, style = ButtonStyle.Secondary, emoji = null, disabled = false) {
  const b = new ButtonBuilder()
    .setCustomId(id)
    .setLabel(label)
    .setStyle(style)
    .setDisabled(disabled);
  if (emoji && typeof emoji === "string") {
    try { b.setEmoji(emoji); } catch { /* ignore invalid */ }
  }
  return b;
}

function toggleIcon(on) { return on ? E.on : E.off; }

/* ═══════════════════════════════════════════════════════════════
   MAIN PANEL
   ═══════════════════════════════════════════════════════════════ */
async function buildMainPanel(pool, guild) {
  const cfg     = await store.getServerSettings(pool, guild.id);
  const prof    = await store.getServerProfile(pool, guild.id);
  const total   = await store.serverCorpusCount(pool, guild.id);
  const optins  = await store.userListOptIns(pool, guild.id);
  const manual  = await store.blockedList(pool, guild.id);
  const swear   = await blocked.getGuildSwearBlock(pool, guild.id);

  const ready       = total >= cfg.minMessages;
  const confidence  = confidenceFromSamples(total);
  const channels    = cfg.channels.length
    ? cfg.channels.slice(0, 8).map((id) => `<#${id}>`).join(", ")
    : "*none*";
  const lastBackfill = cfg.lastBackfillAt
    ? `<t:${Math.floor(new Date(cfg.lastBackfillAt).getTime() / 1000)}:R>`
    : "*never*";

  const desc = [
    `**${E.server} server persona**`,
    `${toggleIcon(cfg.enabled)} enabled · ${E.brain} \`${total.toLocaleString()}\` msgs learned`,
    `${E.speak} ready: ${ready ? "yes" : `no (${total}/${cfg.minMessages})`}`,
    `# channels: ${channels}`,
    `${E.chance} chance: \`${cfg.replyChance}%\` · ${E.timer} cooldown: \`${formatMs(cfg.cooldownMs)}\``,
    `${E.gif} gifs: ${toggleIcon(cfg.gifs)} · ${E.mention} mentions: ${toggleIcon(cfg.mentions)}`,
    ``,
    `**${E.user} user personas**`,
    `opted-in: \`${optins.length}\``,
    ``,
    `**${E.brain} learning**`,
    `${E.backfill} last backfill: ${lastBackfill}`,
    `confidence: \`${confidence}%\``,
    `${E.filter} blocked: \`${manual.length}\` manual · \`${swear.length}\` guild swear`,
  ].join("\n");

  const embed = new EmbedBuilder()
    .setColor(COLORS.persona)
    .setTitle(`${E.brain} persona config`)
    .setDescription(desc)
    .setFooter({ text: "chromed · persona" });

  const row1 = new ActionRowBuilder().addComponents(
    btn(IDS.tabServer, "Server",   ButtonStyle.Primary, E.server),
    btn(IDS.tabUser,   "User",     ButtonStyle.Secondary, E.user),
    btn(IDS.channels,  "Channels", ButtonStyle.Secondary, null),
    btn(IDS.chance,    "Chance",   ButtonStyle.Secondary, E.chance),
  );

  const row2 = new ActionRowBuilder().addComponents(
    btn(IDS.minServer, "Min msgs", ButtonStyle.Secondary, E.brain),
    btn(IDS.cooldown,  "Cooldown", ButtonStyle.Secondary, E.timer),
    btn(IDS.gifs,      "GIFs",     cfg.gifs ? ButtonStyle.Success : ButtonStyle.Secondary, E.gif),
    btn(IDS.mentions,  "Mentions", cfg.mentions ? ButtonStyle.Success : ButtonStyle.Secondary, E.mention),
  );

  const row3 = new ActionRowBuilder().addComponents(
    btn(IDS.editServer, "Edit Persona", ButtonStyle.Primary, E.edit),
    btn(IDS.blocked,    "Blocked",      ButtonStyle.Secondary, E.filter),
    btn(IDS.backfill,   "Backfill",     ButtonStyle.Secondary, E.backfill),
    btn(IDS.advanced,   "Advanced",     ButtonStyle.Secondary, E.settings),
  );

  const row4 = new ActionRowBuilder().addComponents(
    btn(IDS.toggleServer, cfg.enabled ? "Disable" : "Enable",
        cfg.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
    btn(IDS.reset, "Reset", ButtonStyle.Danger, E.reset),
    btn(IDS.close, "Close", ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [row1, row2, row3, row4] };
}

/* ═══════════════════════════════════════════════════════════════
   SERVER SUB-PANEL
   ═══════════════════════════════════════════════════════════════ */
async function buildServerPanel(pool, guild) {
  const cfg   = await store.getServerSettings(pool, guild.id);
  const total = await store.serverCorpusCount(pool, guild.id);
  const prof  = await store.getServerProfile(pool, guild.id);
  const p     = prof.profile || {};

  const desc = [
    `${toggleIcon(cfg.enabled)} **enabled**`,
    `${E.brain} messages: \`${total.toLocaleString()}\` / min \`${cfg.minMessages}\``,
    `${E.chance} chance: \`${cfg.replyChance}%\``,
    `${E.timer} cooldown: \`${formatMs(cfg.cooldownMs)}\``,
    `${E.gif} gifs: ${toggleIcon(cfg.gifs)} · ${E.mention} mentions: ${toggleIcon(cfg.mentions)}`,
    ``,
    `**${E.brain} learned style**`,
    p.tone         ? `tone · \`${String(p.tone).slice(0, 140)}\`` : "*no profile yet*",
    p.avg_length   ? `avg length · \`~${p.avg_length}\` words` : null,
    p.emoji_style  ? `emoji style · \`${String(p.emoji_style).slice(0, 100)}\`` : null,
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
    btn(IDS.chance,    "Chance",   ButtonStyle.Secondary, E.chance),
    btn(IDS.cooldown,  "Cooldown", ButtonStyle.Secondary, E.timer),
    btn(IDS.minServer, "Min msgs", ButtonStyle.Secondary, E.brain),
    btn(IDS.channels,  "Channels", ButtonStyle.Secondary, null),
  );

  const row2 = new ActionRowBuilder().addComponents(
    btn(IDS.gifs,       "GIFs",     cfg.gifs ? ButtonStyle.Success : ButtonStyle.Secondary, E.gif),
    btn(IDS.mentions,   "Mentions", cfg.mentions ? ButtonStyle.Success : ButtonStyle.Secondary, E.mention),
    btn(IDS.editServer, "Edit",     ButtonStyle.Primary, E.edit),
    btn(IDS.blocked,    "Blocked",  ButtonStyle.Secondary, E.filter),
  );

  const row3 = new ActionRowBuilder().addComponents(
    btn(IDS.back,     "← Back",   ButtonStyle.Secondary),
    btn(IDS.backfill, "Backfill", ButtonStyle.Secondary, E.backfill),
    btn(IDS.close,    "Close",    ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [row1, row2, row3] };
}

/* ═══════════════════════════════════════════════════════════════
   USER SUB-PANEL
   ═══════════════════════════════════════════════════════════════ */
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
      `${toggleIcon(true)} **enabled** — users opt in themselves`,
      ``,
      `**opted-in users (${optins.length})**`,
      list,
      ``,
      `*users run \`/persona user opt-in\` to teach chromed their voice*`,
    ].join("\n"))
    .setFooter({ text: "chromed · persona" });

  const row1 = new ActionRowBuilder().addComponents(
    btn(IDS.userOptIn,   "Opt me in",   ButtonStyle.Success),
    btn(IDS.userOptOut,  "Opt me out",  ButtonStyle.Danger),
    btn(IDS.minUser,     "My min msgs", ButtonStyle.Secondary, E.brain),
    btn(IDS.userRefresh, "Refresh",     ButtonStyle.Secondary),
  );

  const row2 = new ActionRowBuilder().addComponents(
    btn(IDS.back,  "← Back", ButtonStyle.Secondary),
    btn(IDS.close, "Close",  ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [row1, row2] };
}

/* ═══════════════════════════════════════════════════════════════
   BLOCKED WORDS SUB-PANEL
   ═══════════════════════════════════════════════════════════════ */
async function buildBlockedPanel(pool, guild) {
  const manual = await store.blockedList(pool, guild.id);
  const swear  = await blocked.getGuildSwearBlock(pool, guild.id);
  const hardCount = (require("./constants").HARD_BLOCKED || []).length;

  const desc = [
    `**hardcoded blocks:** \`${hardCount}\` words — always active`,
    `**guild swear block:** \`${swear.length}\` words`,
    `**manual blocks:** \`${manual.length}\` words`,
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
    btn(IDS.blockedAdd,    "Add word",    ButtonStyle.Success),
    btn(IDS.blockedRemove, "Remove word", ButtonStyle.Danger),
  );

  const row2 = new ActionRowBuilder().addComponents(
    btn(IDS.back,  "← Back", ButtonStyle.Secondary),
    btn(IDS.close, "Close",  ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [row1, row2] };
}

/* ═══════════════════════════════════════════════════════════════
   VIEW DISPATCHER
   ═══════════════════════════════════════════════════════════════ */
async function buildView(pool, guild, view) {
  switch (view) {
    case "server":  return buildServerPanel(pool, guild);
    case "user":    return buildUserPanel(pool, guild);
    case "blocked": return buildBlockedPanel(pool, guild);
    default:        return buildMainPanel(pool, guild);
  }
}

/* ═══════════════════════════════════════════════════════════════
   MODAL BUILDERS
   ═══════════════════════════════════════════════════════════════ */
function numberModal(id, title, label, placeholder, current) {
  const modal = new ModalBuilder().setCustomId(id).setTitle(title);
  const input = new TextInputBuilder()
    .setCustomId("value")
    .setLabel(label)
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder(placeholder);
  if (current !== undefined && current !== null) input.setValue(String(current));
  modal.addComponents(new ActionRowBuilder().addComponents(input));
  return modal;
}

function textModal(id, title, label, placeholder, current) {
  const modal = new ModalBuilder().setCustomId(id).setTitle(title);
  const input = new TextInputBuilder()
    .setCustomId("value")
    .setLabel(label)
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setPlaceholder(placeholder);
  if (current) input.setValue(String(current).slice(0, 3800));
  modal.addComponents(new ActionRowBuilder().addComponents(input));
  return modal;
}

/* ═══════════════════════════════════════════════════════════════
   SESSION — collector stays alive 5 min, tracks current view
   ═══════════════════════════════════════════════════════════════ */
function attachSession(interaction, guild, userId) {
  const state = { view: "main" };

  const collector = interaction.channel.createMessageComponentCollector({
    time: PANEL_TIMEOUT,
    filter: (i) => i.user.id === userId,
  });

  collector.on("collect", async (i) => {
    try {
      await handleButton(i, guild, state);
    } catch (err) {
      console.error("[persona/menu] button:", err.message);
      if (!i.replied && !i.deferred) {
        await i.reply({ content: "something broke. try again.", ephemeral: true }).catch(() => {});
      }
    }
  });

  collector.on("end", async () => {
    try {
      const msg = await interaction.fetchReply().catch(() => null);
      if (!msg?.components?.length) return;
      const rows = msg.components.map((row) => {
        const r = new ActionRowBuilder();
        for (const c of row.components) {
          r.addComponents(ButtonBuilder.from(c).setDisabled(true));
        }
        return r;
      });
      await interaction.editReply({ components: rows }).catch(() => {});
    } catch {}
  });
}

/* ═══════════════════════════════════════════════════════════════
   BUTTON ROUTER
   ═══════════════════════════════════════════════════════════════ */
async function handleButton(i, guild, state) {
  const pool = i.client.pool;
  const id = i.customId;

  const refresh = async (overrideView) => {
    const v = overrideView || state.view;
    const payload = await buildView(pool, guild, v);
    await i.update(payload).catch(() => {});
  };

  /* ── tabs ── */
  if (id === IDS.tabServer) { state.view = "server";  return refresh(); }
  if (id === IDS.tabUser)   { state.view = "user";    return refresh(); }
  if (id === IDS.tabMain)   { state.view = "main";    return refresh(); }
  if (id === IDS.back)      { state.view = "main";    return refresh(); }

  /* ── toggle server ── */
  if (id === IDS.toggleServer) {
    const cfg = await store.getServerSettings(pool, guild.id);
    await store.saveServerSettings(pool, guild.id, { enabled: !cfg.enabled });
    await store.logAudit(pool, {
      guildId: guild.id, actorId: i.user.id,
      action: cfg.enabled ? "server-disable" : "server-enable",
    });
    return refresh();
  }

  /* ── gifs toggle ── */
  if (id === IDS.gifs) {
    const cfg = await store.getServerSettings(pool, guild.id);
    await store.saveServerSettings(pool, guild.id, { gifs: !cfg.gifs });
    return refresh();
  }

  /* ── mentions toggle ── */
  if (id === IDS.mentions) {
    const cfg = await store.getServerSettings(pool, guild.id);
    await store.saveServerSettings(pool, guild.id, { mentions: !cfg.mentions });
    return refresh();
  }

  /* ── chance modal ── */
  if (id === IDS.chance) {
    const cfg = await store.getServerSettings(pool, guild.id);
    const modal = numberModal("persona_modal_chance", "Reply Chance", "percent (0-100)", "5", cfg.replyChance);
    return i.showModal(modal).catch(() => {});
  }

  /* ── cooldown modal ── */
  if (id === IDS.cooldown) {
    const cfg = await store.getServerSettings(pool, guild.id);
    const sec = Math.round(cfg.cooldownMs / 1000);
    const modal = numberModal("persona_modal_cooldown", "Cooldown", "seconds (0-3600)", "30", sec);
    return i.showModal(modal).catch(() => {});
  }

  /* ── min server msgs ── */
  if (id === IDS.minServer) {
    const cfg = await store.getServerSettings(pool, guild.id);
    const modal = numberModal("persona_modal_min_server", "Server Min Messages", "messages before speaking", "40", cfg.minMessages);
    return i.showModal(modal).catch(() => {});
  }

  /* ── min user msgs ── */
  if (id === IDS.minUser) {
    const opt = await store.userIsOptedIn(pool, i.user.id, guild.id);
    const current = opt.optedIn ? opt.minMessages : DEFAULTS.userMinMessages;
    const modal = numberModal("persona_modal_min_user", "Your Min Messages", "before chromed speaks as you", "40", current);
    return i.showModal(modal).catch(() => {});
  }

  /* ── channels hint ── */
  if (id === IDS.channels) {
    return i.reply({
      content:
        "**learning channels**\n\n" +
        "`/persona server channel add #x` — start learning\n" +
        "`/persona server channel remove #x` — stop\n" +
        "`/persona server channel list` — see current",
      ephemeral: true,
    }).catch(() => {});
  }

  /* ── edit server persona ── */
  if (id === IDS.editServer) {
    const prof = await store.getServerProfile(pool, guild.id);
    const current = prof.manualEdit ? JSON.stringify(prof.manualEdit, null, 2) : "";
    const modal = textModal(
      "persona_modal_edit_server",
      "Edit Persona",
      "manual override (JSON or plain text)",
      `{"tone": "chill but hype", "phrases": ["lock in"], "extra": "keep it short"}`,
      current
    );
    return i.showModal(modal).catch(() => {});
  }

  /* ── blocked words ── */
  if (id === IDS.blocked) { state.view = "blocked"; return refresh(); }

  if (id === IDS.blockedAdd) {
    const modal = new ModalBuilder().setCustomId("persona_modal_blocked_add").setTitle("Block Word");
    const t = new TextInputBuilder()
      .setCustomId("value").setLabel("word").setStyle(TextInputStyle.Short)
      .setRequired(true).setPlaceholder("example");
    modal.addComponents(new ActionRowBuilder().addComponents(t));
    return i.showModal(modal).catch(() => {});
  }

  if (id === IDS.blockedRemove) {
    const modal = new ModalBuilder().setCustomId("persona_modal_blocked_remove").setTitle("Unblock Word");
    const t = new TextInputBuilder()
      .setCustomId("value").setLabel("word").setStyle(TextInputStyle.Short)
      .setRequired(true).setPlaceholder("example");
    modal.addComponents(new ActionRowBuilder().addComponents(t));
    return i.showModal(modal).catch(() => {});
  }

  /* ── backfill ── */
  if (id === IDS.backfill) {
    const cfg = await store.getServerSettings(pool, guild.id);
    if (!cfg.channels.length) {
      return i.reply({ content: "no learning channels yet — add one first.", ephemeral: true }).catch(() => {});
    }
    await i.reply({ content: `backfilling **${cfg.channels.length}** channel(s)…`, ephemeral: true }).catch(() => {});

    const learner = require("./learner");
    let total = 0;
    for (const chId of cfg.channels.slice(0, 5)) {
      try {
        const res = await learner.backfillChannel(i.client, guild.id, chId, 500);
        total += res.added || 0;
      } catch (err) {
        console.warn("[persona/backfill]", err.message);
      }
    }
    return i.followUp({
      content: `${E.success} backfill done — **+${total}** messages learned.`,
      ephemeral: true,
    }).catch(() => {});
  }

  /* ── advanced hint ── */
  if (id === IDS.advanced) {
    return i.reply({
      content:
        "**advanced**\n\n" +
        "`/persona server min-messages <n>`\n" +
        "`/persona server ignore-bots <on|off>`\n" +
        "`/persona server reset`\n" +
        "`/persona user purge @user`\n" +
        "`/persona audit`",
      ephemeral: true,
    }).catch(() => {});
  }

  /* ── user self actions ── */
  if (id === IDS.userOptIn) {
    await store.userOptIn(pool, i.user.id, guild.id);
    await store.logAudit(pool, { guildId: guild.id, actorId: i.user.id, action: "user-optin" });
    return i.reply({ content: `${E.success} opted in — start chatting, chromed is listening.`, ephemeral: true }).catch(() => {});
  }

  if (id === IDS.userOptOut) {
    const removed = await store.userOptOut(pool, i.user.id, guild.id);
    await store.logAudit(pool, { guildId: guild.id, actorId: i.user.id, action: "user-optout", detail: `${removed} msgs` });
    return i.reply({ content: `${E.success} opted out — all your persona data is gone.`, ephemeral: true }).catch(() => {});
  }

  if (id === IDS.userRefresh) { return refresh(); }

  /* ── reset hint ── */
  if (id === IDS.reset) {
    return i.reply({
      content: `${E.warning} run \`/persona server reset\` to confirm. button is not enough.`,
      ephemeral: true,
    }).catch(() => {});
  }

  /* ── close ── */
  if (id === IDS.close) {
    return i.update({ components: [] }).catch(() => {});
  }

  return i.reply({ content: "unhandled button.", ephemeral: true }).catch(() => {});
}

/* ═══════════════════════════════════════════════════════════════
   MODAL HANDLER
   ═══════════════════════════════════════════════════════════════ */
async function handleModal(interaction) {
  const pool  = interaction.client.pool;
  const guild = interaction.guild;
  const id    = interaction.customId;
  const value = interaction.fields.getTextInputValue("value") || "";
  const trimmed = value.trim();

  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ ephemeral: true }).catch(() => {});
  }

  if (id === "persona_modal_chance") {
    const n = parseInt(trimmed, 10);
    if (isNaN(n) || n < 0 || n > 100) return interaction.editReply({ content: `${E.error} pick 0-100.` });
    await store.saveServerSettings(pool, guild.id, { replyChance: n });
    return interaction.editReply({ content: `${E.success} chance set to **${n}%**.` });
  }

  if (id === "persona_modal_cooldown") {
    const n = parseInt(trimmed, 10);
    if (isNaN(n) || n < 0 || n > 3600) return interaction.editReply({ content: `${E.error} pick 0-3600 seconds.` });
    await store.saveServerSettings(pool, guild.id, { cooldownMs: n * 1000 });
    return interaction.editReply({ content: `${E.success} cooldown set to **${n}s**.` });
  }

  if (id === "persona_modal_min_server") {
    const n = parseInt(trimmed, 10);
    if (isNaN(n) || n < 1 || n > 100000) return interaction.editReply({ content: `${E.error} pick 1-100000.` });
    await store.saveServerSettings(pool, guild.id, { minMessages: n });
    return interaction.editReply({ content: `${E.success} server threshold set to **${n}**.` });
  }

  if (id === "persona_modal_min_user") {
    const n = parseInt(trimmed, 10);
    if (isNaN(n) || n < 1 || n > 100000) return interaction.editReply({ content: `${E.error} pick 1-100000.` });
    const opt = await store.userIsOptedIn(pool, interaction.user.id, guild.id);
    if (!opt.optedIn) return interaction.editReply({ content: `${E.error} opt in first with \`/persona user opt-in\`.` });
    await store.userSetMinMessages(pool, interaction.user.id, guild.id, n);
    return interaction.editReply({ content: `${E.success} your threshold set to **${n}**.` });
  }

  if (id === "persona_modal_edit_server") {
    let parsed = null;
    if (trimmed) {
      try { parsed = JSON.parse(trimmed); }
      catch { parsed = { extra: trimmed }; }
    }
    await store.saveServerManualEdit(pool, guild.id, parsed);
    return interaction.editReply({
      content: parsed ? `${E.success} persona override saved.` : `${E.success} override cleared.`,
    });
  }

  if (id === "persona_modal_blocked_add") {
    if (!trimmed) return interaction.editReply({ content: `${E.error} enter a word.` });
    await store.blockedAdd(pool, guild.id, trimmed, interaction.user.id);
    return interaction.editReply({ content: `${E.success} \`${trimmed}\` is now blocked.` });
  }

  if (id === "persona_modal_blocked_remove") {
    if (!trimmed) return interaction.editReply({ content: `${E.error} enter a word.` });
    const ok = await store.blockedRemove(pool, guild.id, trimmed);
    return interaction.editReply({
      content: ok ? `${E.success} \`${trimmed}\` removed.` : `${E.warning} \`${trimmed}\` wasn't blocked.`,
    });
  }

  return interaction.editReply({ content: "unhandled modal." }).catch(() => {});
}

module.exports = {
  IDS,
  buildMainPanel,
  buildServerPanel,
  buildUserPanel,
  buildBlockedPanel,
  buildView,
  attachSession,
  handleButton,
  handleModal,
};
