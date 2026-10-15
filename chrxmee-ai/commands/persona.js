// commands/persona.js
const {
  SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType,
} = require("discord.js");

const {
  E, COLORS, DEFAULTS, formatMs, confidenceFromSamples,
  store, learner, speaker, menu, blocked,
} = require("../cogs/persona");

async function reply(interaction, embed) {
  const payload = { embeds: [embed] };
  if (interaction.deferred || interaction.replied) return interaction.editReply(payload).catch(() => {});
  return interaction.reply(payload).catch(() => {});
}

function pEmbed(title, desc, color = COLORS.persona) {
  return new EmbedBuilder().setColor(color).setTitle(title).setDescription(desc).setFooter({ text: "chromed · persona" });
}

function gateAdmin(interaction) {
  if (interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
  reply(interaction, pEmbed(`${E.error} nope`, "you need **manage server** for that.", COLORS.error));
  return false;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("persona")
    .setDescription("teach chromed how to talk like you (or your server)")
    .setDMPermission(false)

    // default — opens menu panel
    .addSubcommand((s) => s.setName("menu").setDescription("open the persona config panel"))

    .addSubcommandGroup((g) => g
      .setName("server")
      .setDescription("server-wide persona (learns from channels you pick)")
      .addSubcommand((s) => s.setName("enable").setDescription("turn on server persona"))
      .addSubcommand((s) => s.setName("disable").setDescription("turn off server persona"))
      .addSubcommand((s) => s
        .setName("channel")
        .setDescription("add, remove, or list learning channels")
        .addStringOption((o) => o.setName("action").setDescription("what to do").setRequired(true)
          .addChoices(
            { name: "add", value: "add" },
            { name: "remove", value: "remove" },
            { name: "list", value: "list" },
          ))
        .addChannelOption((o) => o.setName("channel").setDescription("channel").setRequired(false))
      )
      .addSubcommand((s) => s
        .setName("min-messages")
        .setDescription("how many messages before chromed speaks")
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
        .setDescription("ignore bot messages when learning")
        .addBooleanOption((o) => o.setName("enabled").setDescription("on/off").setRequired(true))
      )
      .addSubcommand((s) => s
        .setName("backfill")
        .setDescription("learn from channel history")
        .addIntegerOption((o) => o.setName("count").setDescription("how many per channel (default 500)").setRequired(false).setMinValue(50).setMaxValue(1000))
      )
      .addSubcommand((s) => s
        .setName("reset")
        .setDescription("⚠ wipe ALL server persona data")
      )
      .addSubcommand((s) => s.setName("profile").setDescription("view what chromed learned"))
    )

    .addSubcommandGroup((g) => g
      .setName("user")
      .setDescription("your personal persona (chromed speaks as you)")
      .addSubcommand((s) => s.setName("opt-in").setDescription("teach chromed your voice"))
      .addSubcommand((s) => s.setName("opt-out").setDescription("stop + purge your data"))
      .addSubcommand((s) => s.setName("status").setDescription("see your persona status"))
      .addSubcommand((s) => s.setName("list").setDescription("list opted-in users (admin)"))
      .addSubcommand((s) => s
        .setName("speak")
        .setDescription("generate a message as a user (draft — needs approval)")
        .addUserOption((o) => o.setName("user").setDescription("who to mimic").setRequired(true))
        .addStringOption((o) => o.setName("topic").setDescription("what to say").setRequired(true))
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

    .addSubcommand((s) => s.setName("status").setDescription("quick persona status"))
    .addSubcommand((s) => s.setName("audit").setDescription("recent persona actions"))

    .addSubcommand((s) => s
      .setName("help")
      .setDescription("how persona works")
    ),

  async execute(interaction) {
    const pool = interaction.client.pool;
    const guild = interaction.guild;
    const sub = interaction.options.getSubcommand(true);
    const group = interaction.options.getSubcommandGroup(false);

    // no default defer — menu opens without it, everything else defers
    const needsDefer = !(sub === "menu") || group;
    if (needsDefer && !interaction.deferred && !interaction.replied) {
      await interaction.deferReply().catch(() => {});
    }
    await store.getServerSettings(pool, guild.id);

    /* ═══ MENU ═══ */
    if (sub === "menu" && !group) {
      const payload = await menu.buildMainPanel(pool, guild);
      const msg = await interaction.reply({ ...payload, fetchReply: true }).catch(() => null);
      if (msg) menu.attachSession(interaction, guild, interaction.user.id, "main");
      return;
    }

    /* ═══ SERVER ═══ */
    if (group === "server") {
      if (!gateAdmin(interaction)) return;

      if (sub === "enable") {
        await store.saveServerSettings(pool, guild.id, { enabled: true });
        await store.logAudit(pool, { guildId: guild.id, actorId: interaction.user.id, action: "server-enable" });
        return reply(interaction, pEmbed(`${E.success} server persona on`, "chromed will learn from whitelisted channels.", COLORS.success));
      }

      if (sub === "disable") {
        await store.saveServerSettings(pool, guild.id, { enabled: false });
        await store.logAudit(pool, { guildId: guild.id, actorId: interaction.user.id, action: "server-disable" });
        return reply(interaction, pEmbed(`${E.success} server persona off`, "chromed stopped learning.", COLORS.success));
      }

      if (sub === "channel") {
        const action = interaction.options.getString("action");
        const ch = interaction.options.getChannel("channel");
        const cfg = await store.getServerSettings(pool, guild.id);

        if (action === "list") {
          return reply(interaction, pEmbed(
            `${E.list} learning channels`,
            cfg.channels.length ? cfg.channels.map((id) => `<#${id}>`).join("\n") : "*none*"
          ));
        }
        if (!ch) return reply(interaction, pEmbed(`${E.error} no channel`, "pick a channel.", COLORS.error));

        const set = new Set(cfg.channels);
        if (action === "add") set.add(ch.id);
        else set.delete(ch.id);

        await store.saveServerSettings(pool, guild.id, { channels: [...set] });
        return reply(interaction, pEmbed(
          `${E.success} channels updated`,
          action === "add" ? `${ch} added.` : `${ch} removed.`,
          COLORS.success,
        ));
      }

      if (sub === "min-messages") {
        const n = interaction.options.getInteger("count");
        await store.saveServerSettings(pool, guild.id, { minMessages: n });
        return reply(interaction, pEmbed(`${E.success} threshold set`, `chromed will speak after **${n}** messages.`, COLORS.success));
      }

      if (sub === "chance") {
        const n = interaction.options.getInteger("percent");
        await store.saveServerSettings(pool, guild.id, { replyChance: n });
        return reply(interaction, pEmbed(`${E.success} chance set`, `**${n}%**`, COLORS.success));
      }

      if (sub === "cooldown") {
        const n = interaction.options.getInteger("seconds");
        await store.saveServerSettings(pool, guild.id, { cooldownMs: n * 1000 });
        return reply(interaction, pEmbed(`${E.success} cooldown set`, `**${formatMs(n * 1000)}**`, COLORS.success));
      }

      if (sub === "ignore-bots") {
        const on = interaction.options.getBoolean("enabled");
        await store.saveServerSettings(pool, guild.id, { ignoreBots: on });
        return reply(interaction, pEmbed(`${E.success} ignore bots`, `**${on ? "on" : "off"}**`, COLORS.success));
      }

      if (sub === "backfill") {
        const cfg = await store.getServerSettings(pool, guild.id);
        if (!cfg.channels.length) return reply(interaction, pEmbed(`${E.error} no channels`, "add a learning channel first.", COLORS.error));
        const count = interaction.options.getInteger("count") || 500;
        await reply(interaction, pEmbed(`${E.loading} backfilling…`, `reading up to **${count}** messages per channel. this may take a minute.`));
        let total = 0;
        for (const chId of cfg.channels.slice(0, 10)) {
          try {
            const res = await learner.backfillChannel(interaction.client, guild.id, chId, count);
            total += res.added || 0;
          } catch (err) {
            console.warn("[persona/backfill]", err.message);
          }
        }
        return reply(interaction, pEmbed(`${E.success} backfill done`, `**+${total}** messages learned.`, COLORS.success));
      }

      if (sub === "reset") {
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("ps-yes").setLabel("yes, wipe").setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId("ps-no").setLabel("cancel").setStyle(ButtonStyle.Secondary),
        );
        await interaction.editReply({
          embeds: [pEmbed(`${E.warning} wipe server persona?`, "this deletes **ALL** learned messages and the style profile. cannot be undone.", COLORS.warn)],
          components: [row],
        });
        try {
          const btn = await interaction.channel.awaitMessageComponent({
            componentType: ComponentType.Button,
            time: 30_000,
            filter: (i) => i.user.id === interaction.user.id && ["ps-yes", "ps-no"].includes(i.customId),
          });
          if (btn.customId === "ps-no") return btn.update({ embeds: [pEmbed("cancelled", "no change.", COLORS.muted)], components: [] });
          const removed = await store.serverCorpusReset(pool, guild.id);
          return btn.update({ embeds: [pEmbed(`${E.success} reset`, `deleted **${removed}** messages + profile.`, COLORS.success)], components: [] });
        } catch {
          return interaction.editReply({ embeds: [pEmbed("timed out", "no change.", COLORS.muted)], components: [] }).catch(() => {});
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
          `**avg length:** ${p.avg_length || "—"} words`,
          `**punctuation:** ${p.punctuation || "—"}`,
          `**emoji style:** ${p.emoji_style || "—"}`,
          `**phrases:** ${(p.phrases || []).slice(0, 12).join(", ") || "—"}`,
          `**topics:** ${(p.topics || []).join(", ") || "—"}`,
          `**avoid:** ${(p.avoid || []).join(", ") || "—"}`,
          "",
          `**examples:**`,
          ...(p.sample_messages || []).slice(0, 5).map((s) => `> ${s}`),
        ];
        return reply(interaction, pEmbed(`${E.brain} server profile`, lines.join("\n")));
      }
    }

    /* ═══ USER ═══ */
    if (group === "user") {
      if (sub === "opt-in") {
        await store.userOptIn(pool, interaction.user.id, guild.id);
        await store.logAudit(pool, { guildId: guild.id, actorId: interaction.user.id, action: "user-optin" });
        return reply(interaction, pEmbed(`${E.success} opted in`, "start chatting — chromed is learning your voice. use `/persona user status` to check progress.", COLORS.success));
      }

      if (sub === "opt-out") {
        const removed = await store.userOptOut(pool, interaction.user.id, guild.id);
        await store.logAudit(pool, { guildId: guild.id, actorId: interaction.user.id, action: "user-optout", detail: `${removed} msgs deleted` });
        return reply(interaction, pEmbed(`${E.success} opted out`, `deleted **${removed}** messages + your profile. gone for good.`, COLORS.success));
      }

      if (sub === "status") {
        const opt = await store.userIsOptedIn(pool, interaction.user.id, guild.id);
        if (!opt.optedIn) {
          return reply(interaction, pEmbed(`${E.list} not opted in`, "run `/persona user opt-in` to start."));
        }
        const total = await store.userCorpusCount(pool, interaction.user.id, guild.id);
        const prof = await store.getUserProfile(pool, interaction.user.id, guild.id);
        const ready = total >= opt.minMessages;
        const lines = [
          `**opted in:** <t:${Math.floor(new Date(opt.optedInAt).getTime() / 1000)}:R>`,
          `**messages:** ${total} / min ${opt.minMessages}`,
          `**ready to speak:** ${ready ? "yes" : "no"}`,
          `**confidence:** ${confidenceFromSamples(total)}%`,
          `**tone:** ${prof.profile?.tone || "—"}`,
        ];
        return reply(interaction, pEmbed(`${E.user} your persona`, lines.join("\n")));
      }

      if (sub === "list") {
        if (!gateAdmin(interaction)) return;
        const rows = await store.userListOptIns(pool, guild.id);
        if (!rows.length) return reply(interaction, pEmbed(`${E.list} no opt-ins`, "no one has opted in yet."));
        const lines = rows.map((r) => {
          const ready = r.learned_count >= r.min_messages;
          return `<@${r.user_id}> — \`${r.learned_count}\` msgs · ${ready ? "ready" : `${r.learned_count}/${r.min_messages}`}`;
        });
        return reply(interaction, pEmbed(`${E.list} opted-in users (${rows.length})`, lines.join("\n")));
      }

      if (sub === "speak") {
        const target = interaction.options.getUser("user");
        const topic = interaction.options.getString("topic");
        await reply(interaction, pEmbed(`${E.loading} drafting…`, `mimicking <@${target.id}> about *${topic}*`));
        const res = await speaker.generateUserSpeak(interaction.client, target.id, guild.id, topic);
        if (!res.ok) return reply(interaction, pEmbed(`${E.error} can't speak`, res.reason, COLORS.error));

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("pus-send").setLabel("send it").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId("pus-edit").setLabel("cancel").setStyle(ButtonStyle.Secondary),
        );
        await interaction.editReply({
          embeds: [pEmbed(
            `${E.speak} draft as ${target.username}`,
            `${res.text}\n\n-# chromed, mimicking <@${target.id}>`,
            COLORS.persona,
          )],
          components: [row],
        });
        try {
          const btn = await interaction.channel.awaitMessageComponent({
            componentType: ComponentType.Button,
            time: 60_000,
            filter: (i) => i.user.id === interaction.user.id && ["pus-send", "pus-edit"].includes(i.customId),
          });
          if (btn.customId === "pus-edit") return btn.update({ embeds: [pEmbed("cancelled", "not sent.", COLORS.muted)], components: [] });
          await btn.channel.send({ content: `${res.text}\n-# chromed, mimicking <@${target.id}>` });
          return btn.update({ embeds: [pEmbed(`${E.success} sent`, "posted.", COLORS.success)], components: [] });
        } catch {
          return interaction.editReply({ embeds: [pEmbed("timed out", "not sent.", COLORS.muted)], components: [] }).catch(() => {});
        }
      }

      if (sub === "purge") {
        if (!gateAdmin(interaction)) return;
        const target = interaction.options.getUser("user");
        const removed = await store.userOptOut(pool, target.id, guild.id);
        await store.logAudit(pool, { guildId: guild.id, actorId: interaction.user.id, action: "admin-purge-user", detail: `${target.id} ${removed} msgs` });
        return reply(interaction, pEmbed(`${E.success} purged`, `deleted **${removed}** messages from <@${target.id}>.`, COLORS.success));
      }
    }

    /* ═══ BLOCKED ═══ */
    if (sub === "blocked" && !group) {
      if (!gateAdmin(interaction)) return;
      const action = interaction.options.getString("action");
      const word = (interaction.options.getString("word") || "").trim().toLowerCase();

      if (action === "list") {
        const rows = await store.blockedList(pool, guild.id);
        const swear = await blocked.getGuildSwearBlock(pool, guild.id);
        const lines = [
          `**hard blocks (built-in):** ${(require("../cogs/persona").HARD_BLOCKED || []).length} words — always active`,
          `**guild swear block:** ${swear.length} words`,
          `**manual blocks (${rows.length}):**`,
          rows.length ? rows.map((r) => `\`${r.word}\``).join(" ") : "*none*",
        ];
        return reply(interaction, pEmbed(`${E.filter} blocked words`, lines.join("\n")));
      }

      if (!word) return reply(interaction, pEmbed(`${E.error} no word`, "provide a word.", COLORS.error));

      if (action === "add") {
        await store.blockedAdd(pool, guild.id, word, interaction.user.id);
        return reply(interaction, pEmbed(`${E.success} blocked`, `\`${word}\` blocked.`, COLORS.success));
      }
      const ok = await store.blockedRemove(pool, guild.id, word);
      return reply(interaction, pEmbed(ok ? `${E.success} removed` : `${E.warning} not found`, ok ? `\`${word}\` removed.` : `\`${word}\` wasn't blocked.`, ok ? COLORS.success : COLORS.warn));
    }

    /* ═══ STATUS ═══ */
    if (sub === "status" && !group) {
      const cfg = await store.getServerSettings(pool, guild.id);
      const total = await store.serverCorpusCount(pool, guild.id);
      const optins = await store.userListOptIns(pool, guild.id);
      const lines = [
        `**server persona:** ${cfg.enabled ? "on" : "off"}`,
        `**channels:** ${cfg.channels.length}`,
        `**learned:** ${total} / min ${cfg.minMessages}`,
        `**chance:** ${cfg.replyChance}%`,
        `**cooldown:** ${formatMs(cfg.cooldownMs)}`,
        `**user personas:** ${optins.length} opted in`,
      ];
      return reply(interaction, pEmbed(`${E.brain} persona status`, lines.join("\n")));
    }

    /* ═══ AUDIT ═══ */
    if (sub === "audit" && !group) {
      if (!gateAdmin(interaction)) return;
      const rows = await store.listAudit(pool, guild.id, 15);
      if (!rows.length) return reply(interaction, pEmbed(`${E.list} no history`, "nothing yet."));
      const lines = rows.map((r) => {
        const unix = Math.floor(new Date(r.created_at).getTime() / 1000);
        return `<t:${unix}:R> · <@${r.actor_id}> **${r.action}**${r.detail ? ` — ${r.detail}` : ""}`;
      });
      return reply(interaction, pEmbed(`${E.list} persona audit`, lines.join("\n")));
    }

    /* ═══ HELP ═══ */
    if (sub === "help" && !group) {
      const lines = [
        `**how persona works**`,
        ``,
        `**server persona** — chromed learns the collective voice of channels you enable, then replies occasionally in that style.`,
        `\`/persona menu\` — open the config panel`,
        `\`/persona server enable\` then \`/persona server channel add #general\``,
        ``,
        `**user persona** — chromed learns ONE user's voice and can mimic it on request.`,
        `\`/persona user opt-in\` — start (only YOU can do this)`,
        `\`/persona user speak @user topic\` — generate a draft in their voice`,
        ``,
        `**safety**`,
        `• hardcoded blocks for slurs + harmful content`,
        `• obeys your server swear filter`,
        `• \`/persona blocked\` for manual words`,
        `• \`/persona user opt-out\` instantly purges your data`,
      ];
      return reply(interaction, pEmbed(`${E.brain} persona help`, lines.join("\n")));
    }
  },

  /* ═══ MODAL HANDLER ═══ */
  async modalSubmit(interaction) {
    return menu.handleModal(interaction);
  },

  /* ═══ BUTTON HANDLER (for panel interactions outside collector) ═══ */
  async button(interaction) {
    const pool = interaction.client.pool;
    await menu.handleButton(interaction, interaction.guild, {
      getView: () => "main",
      setView: () => {},
    });
  },
};
