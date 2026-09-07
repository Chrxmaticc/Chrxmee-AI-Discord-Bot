const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require("discord.js");

const E = {
  success: "<:Verified_Icon:1527194184841167010>",
  error: "<:no:1530373946795364362>",
  ai: "<:Chrxmaticc_AI:1480094799292928132>",
  agree: "<:agreed:1525639597135237131>",
  angry: "<:angry_cry:1526029511882440744>",
  sneaky: "<:sneaky:1527401423690792970>",
  settings: "<:Settings:1525601248278216725>",
  lock: "<:lock:1530377198324945056>",
  unlock: "<:unlock:1530377714995826831>",
  crown: "<:Holographic_owner_crown:1527401510487461969>",
  file: "<:File_Icon:1526542046213570681>",
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("confess")
    .setDescription("anonymous or public confession system")
    .addSubcommand(sub => sub.setName("setup").setDescription("(admin) configure confession system")
      .addChannelOption(opt => opt.setName("channel").setDescription("channel for confessions").setRequired(true))
      .addStringOption(opt => opt.setName("title").setDescription("embed title").setRequired(false))
      .addStringOption(opt => opt.setName("footer").setDescription("embed footer").setRequired(false))
      .addStringOption(opt => opt.setName("color").setDescription("embed hex color (default 7c7ce0)").setRequired(false))
      .addBooleanOption(opt => opt.setName("show_timestamp").setDescription("show timestamp").setRequired(false))
      .addBooleanOption(opt => opt.setName("show_number").setDescription("show confession number").setRequired(false))
    )
    .addSubcommand(sub => sub.setName("enable").setDescription("(admin) enable confessions"))
    .addSubcommand(sub => sub.setName("disable").setDescription("(admin) disable confessions"))
    .addSubcommand(sub => sub.setName("public").setDescription("submit a public confession"))
    .addSubcommand(sub => sub.setName("anonymous").setDescription("submit an anonymous confession"))
    .addSubcommand(sub => sub.setName("reveal").setDescription("(admin) reveal confessor by confession number")
      .addIntegerOption(opt => opt.setName("number").setDescription("confession number (e.g., 1, 2, 3)").setRequired(true))
    )
    .addSubcommand(sub => sub.setName("list").setDescription("(admin) list recent confessions")),

  async execute(interaction) {
    const isButtonSim = interaction.isButton && interaction.isButton();
    if (!isButtonSim) {
      try { await interaction.deferReply({ ephemeral: true }); } catch { try { await interaction.deferReply(); } catch {} }
    }

    const pool = interaction.client.pool;
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;

    const sendEmbed = async (title, description, color = 0x7c7ce0, ephemeral = true) => {
      const embed = new EmbedBuilder().setColor(color).setTitle(title).setDescription(description);
      return interaction.editReply({ embeds: [embed], ephemeral }).catch(() => interaction.followUp({ embeds: [embed], ephemeral }));
    };

    // ── SETUP (admin) ─────────────────────────────────────
    if (sub === "setup") {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return sendEmbed(`${E.error} admin only`, `${E.angry} you need administrator permission.`, 0xff0000);
      }
      const channel = interaction.options.getChannel("channel");
      const title = interaction.options.getString("title") || "confession";
      const footer = interaction.options.getString("footer") || "chromed confessions";
      const color = interaction.options.getString("color") || "7c7ce0";
      const showTimestamp = interaction.options.getBoolean("show_timestamp") ?? true;
      const showNumber = interaction.options.getBoolean("show_number") ?? true;

      await pool.query(
        `INSERT INTO confession_settings (guild_id, channel_id, embed_title, embed_footer, embed_color, show_timestamp, show_number)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (guild_id) DO UPDATE SET
           channel_id = $2,
           embed_title = $3,
           embed_footer = $4,
           embed_color = $5,
           show_timestamp = $6,
           show_number = $7`,
        [guild.id, channel.id, title, footer, color, showTimestamp, showNumber]
      );
      return sendEmbed(`${E.settings} confession setup`, `${E.success} confessions will be posted in ${channel}.`);
    }

    // ── ENABLE / DISABLE ──────────────────────────────────
    if (sub === "enable" || sub === "disable") {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return sendEmbed(`${E.error} admin only`, `${E.angry} you need administrator permission.`, 0xff0000);
      }
      const enabled = sub === "enable";
      await pool.query(`UPDATE confession_settings SET enabled = $1 WHERE guild_id = $2`, [enabled, guild.id]);
      return sendEmbed(`${enabled ? E.unlock : E.lock} confessions ${enabled ? "enabled" : "disabled"}`, `${enabled ? E.success : E.error} confessions are now ${enabled ? "open" : "closed"}.`);
    }

    // ── PUBLIC / ANONYMOUS SUBMISSION ─────────────────────
    if (sub === "public" || sub === "anonymous") {
      const settings = await pool.query(`SELECT * FROM confession_settings WHERE guild_id = $1`, [guild.id]);
      if (!settings.rows[0] || !settings.rows[0].enabled) {
        return sendEmbed(`${E.error} closed`, `${E.angry} confessions are currently closed.`, 0xff0000);
      }

      const mode = sub; // "public" or "anonymous"
      const modal = new ModalBuilder()
        .setCustomId(`confess_modal_${mode}`)
        .setTitle(`${mode} confession`);

      const textInput = new TextInputBuilder()
        .setCustomId("confession_text")
        .setLabel("your confession")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(1000)
        .setPlaceholder("type your confession here...");

      const row = new ActionRowBuilder().addComponents(textInput);
      modal.addComponents(row);

      await interaction.showModal(modal);
      return;
    }

    // ── REVEAL (admin) ────────────────────────────────────
    if (sub === "reveal") {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return sendEmbed(`${E.error} admin only`, `${E.angry} you need administrator permission.`, 0xff0000);
      }
      const number = interaction.options.getInteger("number");
      const res = await pool.query(`SELECT * FROM confessions WHERE guild_id = $1 AND confession_number = $2`, [guild.id, number]);
      if (!res.rows[0]) {
        return sendEmbed(`${E.error} not found`, `${E.angry} confession #${number} not found.`, 0xff0000);
      }
      const confession = res.rows[0];
      const embed = new EmbedBuilder()
        .setColor(0x7c7ce0)
        .setTitle(`${E.crown} confession #${number} reveal`)
        .addFields(
          { name: "user", value: `<@${confession.user_id}> (${confession.user_id})`, inline: true },
          { name: "mode", value: confession.is_anonymous ? "anonymous" : "public", inline: true },
          { name: "content", value: confession.content, inline: false },
          { name: "submitted", value: `<t:${Math.floor(new Date(confession.created_at).getTime() / 1000)}:R>`, inline: true }
        )
        .setTimestamp();

      return interaction.editReply({ embeds: [embed], ephemeral: true }).catch(() => interaction.followUp({ embeds: [embed], ephemeral: true }));
    }

    // ── LIST (admin) ──────────────────────────────────────
    if (sub === "list") {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return sendEmbed(`${E.error} admin only`, `${E.angry} you need administrator permission.`, 0xff0000);
      }
      const res = await pool.query(`SELECT confession_number, content, is_anonymous, created_at FROM confessions WHERE guild_id = $1 ORDER BY confession_number DESC LIMIT 10`, [guild.id]);
      if (!res.rows.length) return sendEmbed(`${E.error} none`, `${E.angry} no confessions yet.`, 0xff0000);
      const lines = res.rows.map(r => `#${r.confession_number} (${r.is_anonymous ? "anon" : "public"}) — ${r.content.slice(0, 50)}${r.content.length > 50 ? "..." : ""}`);
      return sendEmbed(`${E.file} recent confessions`, lines.join("\n"), 0x7c7ce0, false);
    }

    return sendEmbed(`${E.error} unknown`, "unknown subcommand.");
  },
};
