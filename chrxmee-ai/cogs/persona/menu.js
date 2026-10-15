// cogs/persona/menu.js
// panel builders + button routing for /persona.

const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle, ComponentType,
} = require("discord.js");

const {
  E, COLORS, DEFAULTS, confidenceFromSamples, formatMs,
} = require("./constants");
const store = require("./store");

const PANEL_TIMEOUT = 5 * 60 * 1000;

/* ═══════════════════════════════════════════════════════════════
   BUTTON IDS
   ═══════════════════════════════════════════════════════════════ */
const IDS = {
  tabServer:    "persona_tab_server",
  tabUser:      "persona_tab_user",
  toggleServer: "persona_toggle_server",
  toggleUser:   "persona_toggle_user",
  channels:     "persona_channels",
  chance:       "persona_chance",
  cooldown:     "persona_cooldown",
  minServer:    "persona_min_server",
  minUser:      "persona_min_user",
  gifs:         "persona_gifs",
  mentions:     "persona_mentions",
  blocked:      "persona_blocked",
  editServer:   "persona_edit_server",
  backfill:     "persona_backfill",
  advanced:     "persona_advanced",
  reset:        "persona_reset",
  close:        "persona_close",
};

/* ═══════════════════════════════════════════════════════════════
   MAIN PANEL
   ═══════════════════════════════════════════════════════════════ */
async function buildMainPanel(pool, guild) {
  const cfg = await store.getServerSettings(pool, guild.id);
  const prof = await store.getServerProfile(pool, guild.id);
  const total = await store.serverCorpusCount(pool, guild.id);
  const optins = await store.userListOptIns(pool, guild.id);
  const blockedWords = await store.blockedList(pool, guild.id);

  const ready = total >= cfg.minMessages;
  const confidence = confidenceFromSamples(total);
  const channels = cfg.channels.length
    ? cfg.channels.map((id) => `<#${id}>`).join(", ").slice(0, 200)
    : "*none*";

  const lastBackfill = cfg.lastBackfillAt
    ? `<t:${Math.floor(new Date(cfg.lastBackfillAt).getTime() / 1000)}:R>`
    : "*never*";

  const desc = [
    `**${E.server} Server persona**`,
    `${toggleIcon(cfg.enabled)} enabled`,
    `# channels: ${channels}`,
    `${E.brain} learned: \`${total.toLocaleString()}\` messages`,
    `${E.speak} ready to speak: ${ready ? `${E.on} yes` : `${E.off} no (${total}/${cfg.minMessages})`}`,
    `${E.chance} reply chance: \`${cfg.replyChance}%\``,
    `${E.timer} cooldown: \`${formatMs(cfg.cooldownMs)}\``,
    `${E.gif} gifs: ${toggleIcon(cfg.gifs)}   ${E.mention} mentions: ${toggleIcon(cfg.mentions)}`,
    "",
    `**${E.user} User personas**`,
    `${toggleIcon(true)} enabled`,
    `opted-in users: \`${optins.length}\``,
    "",
    `**${E.brain} Learning**`,
    `${E.backfill} last backfill: ${lastBackfill}`,
    `📊 profile confidence: \`${confidence}%\``,
    `${E.filter} blocked words: \`${blockedWords.length + 0}\` manual`,
  ].join("\n");

  const embed = new EmbedBuilder()
    .setColor(COLORS.persona)
    .setTitle(`${E.brain} persona config`)
    .setDescription(desc)
    .setFooter({ text: "chromed · persona" });

  const row1 = new ActionRowBuilder().addComponents(
    btn(IDS.tabServer, "Server", ButtonStyle.Primary, false, E.server),
    btn(IDS.tabUser, "User", ButtonStyle.Secondary, false, E.user),
    btn(IDS.channels, "Channels", ButtonStyle.Secondary, false, "#"),
    btn(IDS.chance, "Chance", ButtonStyle.Secondary, false, "%"),
  );

  const row2 = new ActionRowBuilder().addComponents(
    btn(IDS.minServer, "Min msgs", ButtonStyle.Secondary, false, "🧠"),
    btn(IDS.cooldown, "Cooldown", ButtonStyle.Secondary, false, "⏳"),
    btn(IDS.gifs, "GIFs", cfg.gifs ? ButtonStyle.Success : ButtonStyle.Secondary),
    btn(IDS.mentions, "Mentions", cfg.mentions ? ButtonStyle.Success : ButtonStyle.Secondary),
  );

  const row3 = new ActionRowBuilder().addComponents(
    btn(IDS.editServer, "Edit Persona", ButtonStyle.Primary, false, "✏️"),
    btn(IDS.blocked, "Blocked", ButtonStyle.Secondary, false, "🚫"),
    btn(IDS.backfill, "Backfill", ButtonStyle.Secondary, false, "⏬"),
    btn(IDS.advanced, "Advanced", ButtonStyle.Secondary, false, "⚙️"),
  );

  const row4 = new ActionRowBuilder().addComponents(
    btn(IDS.toggleServer, cfg.enabled ? "Disable" : "Enable", cfg.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
    btn(IDS.reset, "Reset", ButtonStyle.Danger),
    btn(IDS.close, "Close", ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [row1, row2, row3, row4] };
}

function toggleIcon(on) {
  return on ? E.on : E.off;
}

function btn(id, label, style = ButtonStyle.Secondary, disabled = false, emoji = null) {
  const b = new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style).setDisabled(disabled);
  if (emoji) b.setEmoji(emoji);
  return b;
}

/* ═══════════════════════════════════════════════════════════════
   SERVER SUB-PANEL
   ═══════════════════════════════════════════════════════════════ */
async function buildServerPanel(pool, guild) {
  const cfg = await store.getServerSettings(pool, guild.id);
  const total = await store.serverCorpusCount(pool, guild.id);
  const prof = await store.getServerProfile(pool, guild.id);

  const p = prof.profile || {};
  const desc = [
    `${toggleIcon(cfg.enabled)} **enabled**`,
    `${E.brain} messages: \`${total.toLocaleString()}\` / min \`${cfg.minMessages}\``,
    `${E.chance} chance: \`${cfg.replyChance}%\``,
    `${E.timer} cooldown: \`${formatMs(cfg.cooldownMs)}\``,
    `${E.gif} gifs: ${toggleIcon(cfg.gifs)}`,
    `${E.mention} mentions: ${toggleIcon(cfg.mentions)}`,
    "",
    `**${E.brain} learned style:**`,
    p.tone ? `tone: \`${String(p.tone).slice(0, 120)}\`` : "*no profile yet*",
    p.avg_length ? `avg length: \`~${p.avg_length}\` words` : "",
    p.phrases?.length ? `phrases: ${p.phrases.slice(0, 8).map((x) => `\`${x}\``).join(" ")}` : "",
    p.emoji_style ? `emoji style: \`${String(p.emoji_style).slice(0, 100)}\`` : "",
  ].filter(Boolean).join("\n");

  const embed = new EmbedBuilder()
    .setColor(COLORS.persona)
    .setTitle(`${E.server} server persona`)
    .setDescription(desc)
    .setFooter({ text: "chromed · persona" });

  const row1 = new ActionRowBuilder().addComponents(
    btn(IDS.chance, "Chance", ButtonStyle.Secondary, false, "%"),
    btn(IDS.cooldown, "Cooldown", ButtonStyle.Secondary, false, "⏳"),
    btn(IDS.minServer, "Min msgs", ButtonStyle.Secondary, false, "🧠"),
    btn(IDS.channels, "Channels", ButtonStyle.Secondary, false, "#"),
  );

  const row2 = new ActionRowBuilder().addComponents(
    btn(IDS.gifs, "GIFs", cfg.gifs ? ButtonStyle.Success : ButtonStyle.Secondary),
    btn(IDS.mentions, "Mentions", cfg.mentions ? ButtonStyle.Success : ButtonStyle.Secondary),
    btn(IDS.editServer, "Edit", ButtonStyle.Primary, false, "✏️"),
    btn(IDS.blocked, "Blocked", ButtonStyle.Secondary, false, "🚫"),
  );

  const row3 = new ActionRowBuilder().addComponents(
    btn("persona_back_main", "← Back", ButtonStyle.Secondary),
    btn(IDS.backfill, "Backfill", ButtonStyle.Secondary, false, "⏬"),
    btn(IDS.close, "Close", ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [row1, row2, row3] };
}

/* ═══════════════════════════════════════════════════════════════
   USER SUB-PANEL
   ═══════════════════════════════════════════════════════════════ */
async function buildUserPanel(pool, guild) {
  const optins = await store.userListOptIns(pool, guild.id);

  const desc = optins.length
    ? optins.slice(0, 12).map((o) => {
        const ready = o.learned_count >= o.min_messages;
        return `<@${o.user_id}> — \`${o.learned_count}\` msgs · ${ready ? `${E.on} ready` : `${E.off} ${o.learned_count}/${o.min_messages}`}`;
      }).join("\n")
    : "*no one has opted in yet*";

  const embed = new EmbedBuilder()
    .setColor(COLORS.persona)
    .setTitle(`${E.user} user personas`)
    .setDescription([
      `${toggleIcon(true)} **enabled** (users opt in themselves)`,
      "",
      "**opted-in users:**",
      desc,
      "",
      "*users run `/persona user opt-in` to teach chromed their voice*",
    ].join("\n"))
    .setFooter({ text: "chromed · persona" });

  const row1 = new ActionRowBuilder().addComponents(
    btn("persona_user_optin_self", "Opt me in", ButtonStyle.Success),
    btn("persona_user_optout_self", "Opt me out", ButtonStyle.Danger),
    btn(IDS.minUser, "My min msgs", ButtonStyle.Secondary, false, "🧠"),
    btn("persona_user_refresh", "Refresh", ButtonStyle.Secondary),
  );

  const row2 = new ActionRowBuilder().addComponents(
    btn("persona_back_main", "← Back", ButtonStyle.Secondary),
    btn(IDS.close, "Close", ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [row1, row2] };
}

/* ═══════════════════════════════════════════════════════════════
   BLOCKED WORDS SUB-PANEL
   ═══════════════════════════════════════════════════════════════ */
async function buildBlockedPanel(pool, guild) {
  const manual = await store.blockedList(pool, guild.id);
  const swearCount = (await require("./blocked").getGuildSwearBlock(pool, guild.id)).length;

  const desc = [
    `**built-in hard blocks:** always active (slurs, CSAM, hard drugs)`,
    `**guild swear block:** \`${swearCount}\` word(s) from your \`swear_block\` table`,
    `**manual blocks:** \`${manual.length}\` word(s)`,
    "",
    manual.length
      ? manual.slice(0, 25).map((m) => `\`${m.word}\``).join(" ")
      : "*no manual blocks*",
  ].join("\n");

  const embed = new EmbedBuilder()
    .setColor(COLORS.persona)
    .setTitle(`${E.filter} blocked words`)
    .setDescription(desc)
    .setFooter({ text: "chromed · persona" });

  const row1 = new ActionRowBuilder().addComponents(
    btn("persona_blocked_add", "Add word", ButtonStyle.Success),
    btn("persona_blocked_remove", "Remove word", ButtonStyle.Danger),
  );

  const row2 = new ActionRowBuilder().addComponents(
    btn("persona_back_main", "← Back", ButtonStyle.Secondary),
    btn(IDS.close, "Close", ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [row1, row2] };
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
   PANEL SESSION — attach a collector for 5 minutes
   ═══════════════════════════════════════════════════════════════ */
function attachSession(interaction, guild, userId, initialView = "main") {
  let view = initialView;
  const filter = (i) => i.user.id === userId;

  const collector = interaction.channel.createMessageComponentCollector({
    filter,
    time: PANEL_TIMEOUT,
  });

  collector.on("collect", async (i) => {
    try {
      await handleButton(i, guild, {
        getView: () => view,
        setView: (v) => { view = v; },
      });
    } catch (err) {
      console.error("[persona/menu] button handler:", err.message);
      if (!i.replied && !i.deferred) {
        await i.reply({ content: "something broke, try again.", ephemeral: true }).catch(() => {});
      }
    }
  });

  collector.on("end", async () => {
    // disable all buttons
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

  // refresh helper
  const refresh = async (viewOverride) => {
    const v = viewOverride || state.getView();
    const payload = await buildView(pool, guild, v, i.user.id);
    await i.update(payload).catch(() => {});
  };

  /* ── tabs ── */
  if (id === IDS.tabServer) { state.setView("server"); return refresh(); }
  if (id === IDS.tabUser)   { state.setView("user");   return refresh(); }
  if (id === "persona_back_main") { state.setView("main"); return refresh(); }

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

  /* ── toggle user ── */
  if (id === IDS.toggleUser) {
    // no-op for now — user personas always enabled globally
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
    await i.showModal(modal).catch(() => {});
    return;
  }

  /* ── cooldown modal ── */
  if (id === IDS.cooldown) {
    const cfg = await store.getServerSettings(pool, guild.id);
    const sec = Math.round(cfg.cooldownMs / 1000);
    const modal = numberModal("persona_modal_cooldown", "Cooldown", "seconds (0-3600)", "30", sec);
    await i.showModal(modal).catch(() => {});
    return;
  }

  /* ── min server msgs modal ── */
  if (id === IDS.minServer) {
    const cfg = await store.getServerSettings(pool, guild.id);
    const modal = numberModal("persona_modal_min_server", "Server Min Messages", "messages before speaking", "40", cfg.minMessages);
    await i.showModal(modal).catch(() => {});
    return;
  }

  /* ── min user msgs modal ── */
  if (id === IDS.minUser) {
    const opt = await store.userIsOptedIn(pool, i.user.id, guild.id);
    const current = opt.optedIn ? opt.minMessages : DEFAULTS.userMinMessages;
    const modal = numberModal("persona_modal_min_user", "Your Min Messages", "messages before chromed speaks as you", "40", current);
    await i.showModal(modal).catch(() => {});
    return;
  }

  /* ── channels ── */
  if (id === IDS.channels) {
    await i.reply({
      content:
        "**manage learning channels**\n\n" +
        "`/persona server channel add #x` — start learning from a channel\n" +
        "`/persona server channel remove #x` — stop\n" +
        "`/persona server channel list` — see current",
      ephemeral: true,
    }).catch(() => {});
    return;
  }

  /* ── edit server persona ── */
  if (id === IDS.editServer) {
    const prof = await store.getServerProfile(pool, guild.id);
    const current = prof.manualEdit
      ? JSON.stringify(prof.manualEdit, null, 2)
      : "";
    const modal = textModal(
      "persona_modal_edit_server",
      "Edit Persona",
      "manual override (JSON or plain text)",
      `{"tone": "chill but hype", "phrases": ["lock in"], "extra": "keep it short"}`,
      current
    );
    await i.showModal(modal).catch(() => {});
    return;
  }

  /* ── blocked words ── */
  if (id === IDS.blocked) { state.setView("blocked"); return refresh(); }

  if (id === "persona_blocked_add") {
    const modal = numberModal("persona_modal_blocked_add", "Block Word", "word to block", "example");
    // use text input style short
    const m = new ModalBuilder().setCustomId("persona_modal_blocked_add").setTitle("Block Word");
    const t = new TextInputBuilder()
      .setCustomId("value").setLabel("word").setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder("example");
    m.addComponents(new ActionRowBuilder().addComponents(t));
    await i.showModal(m).catch(() => {});
    return;
  }

  if (id === "persona_blocked_remove") {
    const modal = new ModalBuilder().setCustomId("persona_modal_blocked_remove").setTitle("Unblock Word");
    const t = new TextInputBuilder()
      .setCustomId("value").setLabel("word").setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder("example");
    modal.addComponents(new ActionRowBuilder().addComponents(t));
    await i.showModal(modal).catch(() => {});
    return;
  }

  /* ── backfill ── */
  if (id === IDS.backfill) {
    const cfg = await store.getServerSettings(pool, guild.id);
    if (!cfg.channels.length) {
      await i.reply({ content: "no learning channels yet — add one first.", ephemeral: true }).catch(() => {});
      return;
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
    await i.followUp({ content: `${E.success} backfill done — **+${total}** messages learned.`, ephemeral: true }).catch(() => {});
    return;
  }

  /* ── advanced ── */
  if (id === IDS.advanced) {
    await i.reply({
      content:
        "**advanced**\n\n" +
        "`/persona server min-messages <n>` — threshold before speaking\n" +
        "`/persona server ignore-bots <on|off>` — skip bot messages\n" +
        "`/persona server reset` — wipe server corpus + profile\n" +
        "`/persona user purge @user` — wipe a user's persona\n" +
        "`/persona audit` — recent actions",
      ephemeral: true,
    }).catch(() => {});
    return;
  }

  /* ── user self actions ── */
  if (id === "persona_user_optin_self") {
    await store.userOptIn(pool, i.user.id, guild.id);
    await store.logAudit(pool, { guildId: guild.id, actorId: i.user.id, action: "user-optin" });
    await i.reply({ content: `${E.success} opted in — start chatting, chromed is listening.`, ephemeral: true }).catch(() => {});
    return;
  }

  if (id === "persona_user_optout_self") {
    const removed = await store.userOptOut(pool, i.user.id, guild.id);
    await store.logAudit(pool, { guildId: guild.id, actorId: i.user.id, action: "user-optout", detail: `${removed} msgs deleted` });
    await i.reply({ content: `${E.success} opted out — all your persona data is gone.`, ephemeral: true }).catch(() => {});
    return;
  }

  if (id === "persona_user_refresh") { return refresh(); }

  /* ── reset ── */
  if (id === IDS.reset) {
    await i.reply({
      content: `${E.warning} type \`/persona server reset\` to wipe. button is not enough.`,
      ephemeral: true,
    }).catch(() => {});
    return;
  }

  /* ── close ── */
  if (id === IDS.close) {
    await i.update({ components: [] }).catch(() => {});
    return;
  }

  await i.reply({ content: "unhandled button.", ephemeral: true }).catch(() => {});
}

/* ═══════════════════════════════════════════════════════════════
   VIEW DISPATCHER
   ═══════════════════════════════════════════════════════════════ */
async function buildView(pool, guild, view, userId) {
  switch (view) {
    case "server":  return buildServerPanel(pool, guild);
    case "user":    return buildUserPanel(pool, guild);
    case "blocked": return buildBlockedPanel(pool, guild);
    default:        return buildMainPanel(pool, guild);
  }
}

/* ═══════════════════════════════════════════════════════════════
   MODAL HANDLER — called from commands/persona.js
   ═══════════════════════════════════════════════════════════════ */
async function handleModal(interaction) {
  const pool = interaction.client.pool;
  const guild = interaction.guild;
  const id = interaction.customId;
  const value = interaction.fields.getTextInputValue("value") || "";
  const trimmed = value.trim();

  if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: true }).catch(() => {});

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
    return interaction.editReply({ content: `${E.success} server threshold set to **${n}** messages.` });
  }

  if (id === "persona_modal_min_user") {
    const n = parseInt(trimmed, 10);
    if (isNaN(n) || n < 1 || n > 100000) return interaction.editReply({ content: `${E.error} pick 1-100000.` });
    const opt = await store.userIsOptedIn(pool, interaction.user.id, guild.id);
    if (!opt.optedIn) return interaction.editReply({ content: `${E.error} opt in first with \`/persona user opt-in\`.` });
    await store.userSetMinMessages(pool, interaction.user.id, guild.id, n);
    return interaction.editReply({ content: `${E.success} your threshold set to **${n}** messages.` });
  }

  if (id === "persona_modal_edit_server") {
    let parsed = null;
    if (trimmed) {
      try { parsed = JSON.parse(trimmed); }
      catch {
        // treat as plain text → extra instruction
        parsed = { extra: trimmed };
      }
    }
    await store.saveServerManualEdit(pool, guild.id, parsed);
    return interaction.editReply({ content: parsed ? `${E.success} persona override saved.` : `${E.success} override cleared.` });
  }

  if (id === "persona_modal_blocked_add") {
    if (!trimmed) return interaction.editReply({ content: `${E.error} enter a word.` });
    await store.blockedAdd(pool, guild.id, trimmed, interaction.user.id);
    return interaction.editReply({ content: `${E.success} \`${trimmed}\` is now blocked.` });
  }

  if (id === "persona_modal_blocked_remove") {
    if (!trimmed) return interaction.editReply({ content: `${E.error} enter a word.` });
    const ok = await store.blockedRemove(pool, guild.id, trimmed);
    return interaction.editReply({ content: ok ? `${E.success} \`${trimmed}\` removed.` : `${E.warning} \`${trimmed}\` wasn't blocked.` });
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
