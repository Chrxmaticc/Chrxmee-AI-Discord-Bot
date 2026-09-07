const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  AttachmentBuilder,
} = require("discord.js");

const E = {
  success: "<:Verified_Icon:1527194184841167010>",
  error: "<:no:1530373946795364362>",
  ai: "<:Chrxmaticc_AI:1480094799292928132>",
  agree: "<:agreed:1525639597135237131>",
  angry: "<:angry_cry:1526029511882440744>",
  settings: "<:Settings:1525601248278216725>",
  ticket: "<:Channel:1531901854361849929>",
  crown: "<:Holographic_owner_crown:1527401510487461969>",
  lock: "<:lock:1530377198324945056>",
  unlock: "<:unlock:1530377714995826831>",
};

const PRIORITIES = {
  low: "🟢 low",
  medium: "🟡 medium",
  high: "🟠 high",
  urgent: "🔴 urgent",
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("manage support tickets")
    // Admin setup
    .addSubcommand(sub => sub.setName("setup").setDescription("(admin) initial ticket system setup")
      .addChannelOption(opt => opt.setName("log_channel").setDescription("channel for ticket logs").setRequired(true))
      .addBooleanOption(opt => opt.setName("enabled").setDescription("enable tickets").setRequired(false))
      .addIntegerOption(opt => opt.setName("auto_close_hours").setDescription("hours before auto-close (default 24)").setRequired(false).setMinValue(1).setMaxValue(168))
      .addBooleanOption(opt => opt.setName("rating_enabled").setDescription("enable rating after close").setRequired(false))
      .addBooleanOption(opt => opt.setName("transcript_enabled").setDescription("save transcripts").setRequired(false))
    )
    // Category management
    .addSubcommandGroup(group => group.setName("category").setDescription("manage ticket categories")
      .addSubcommand(sub => sub.setName("add").setDescription("add a category")
        .addStringOption(opt => opt.setName("name").setDescription("category name").setRequired(true))
        .addChannelOption(opt => opt.setName("parent").setDescription("parent category").setRequired(true))
        .addRoleOption(opt => opt.setName("support_role").setDescription("support role for this category").setRequired(true))
        .addStringOption(opt => opt.setName("welcome_message").setDescription("welcome message with {mention}, {user}, {server}").setRequired(false))
        .addBooleanOption(opt => opt.setName("welcome_type").setDescription("true for embed, false for text").setRequired(false))
        .addStringOption(opt => opt.setName("ping_message").setDescription("ping message with {role}, {mention}").setRequired(false))
        .addBooleanOption(opt => opt.setName("ping_type").setDescription("true for embed, false for text").setRequired(false))
        .addStringOption(opt => opt.setName("questions").setDescription("comma-separated list of pre-open questions").setRequired(false))
      )
      .addSubcommand(sub => sub.setName("remove").setDescription("remove a category")
        .addStringOption(opt => opt.setName("category_id").setDescription("category id (run /ticket categories)").setRequired(true))
      )
      .addSubcommand(sub => sub.setName("list").setDescription("list all categories"))
    )
    // User commands
    .addSubcommand(sub => sub.setName("open").setDescription("open a ticket"))
    .addSubcommand(sub => sub.setName("close").setDescription("close a ticket (in ticket channel)"))
    .addSubcommand(sub => sub.setName("claim").setDescription("(support) claim this ticket"))
    .addSubcommand(sub => sub.setName("unclaim").setDescription("(support) unclaim this ticket"))
    .addSubcommand(sub => sub.setName("add").setDescription("add a user to this ticket")
      .addUserOption(opt => opt.setName("user").setDescription("user to add").setRequired(true))
    )
    .addSubcommand(sub => sub.setName("remove").setDescription("remove a user from this ticket")
      .addUserOption(opt => opt.setName("user").setDescription("user to remove").setRequired(true))
    )
    .addSubcommand(sub => sub.setName("tag").setDescription("add a tag to this ticket")
      .addStringOption(opt => opt.setName("tag").setDescription("tag name").setRequired(true))
    )
    .addSubcommand(sub => sub.setName("stats").setDescription("(admin) view ticket statistics"))
    .addSubcommand(sub => sub.setName("delete").setDescription("(admin) force delete a ticket")
      .addChannelOption(opt => opt.setName("channel").setDescription("ticket channel").setRequired(true))
    ),
  async execute(interaction, client) {
    const isButtonSim = interaction.isButton && interaction.isButton();
    if (!isButtonSim) {
      try { await interaction.deferReply({ ephemeral: true }); } catch { try { await interaction.deferReply(); } catch {} }
    }

    const pool = client.pool;
    const sub = interaction.options.getSubcommand();
    const group = interaction.options.getSubcommandGroup(false);
    const guild = interaction.guild;
    const member = interaction.member;

    const sendEmbed = async (title, description, color = 0x7c7ce0, ephemeral = true) => {
      const embed = new EmbedBuilder().setColor(color).setTitle(title).setDescription(description);
      return interaction.editReply({ embeds: [embed], ephemeral }).catch(() => interaction.followUp({ embeds: [embed], ephemeral }));
    };

    // Helper: get settings
    const getSettings = async () => {
      const res = await pool.query(`SELECT * FROM ticket_settings WHERE guild_id = $1`, [guild.id]);
      return res.rows[0] || null;
    };

    // Helper: get category
    const getCategory = async (categoryId) => {
      const res = await pool.query(`SELECT * FROM ticket_categories WHERE guild_id = $1 AND category_id = $2`, [guild.id, categoryId]);
      return res.rows[0] || null;
    };

    // ── SETUP ─────────────────────────────────────────────
    if (sub === "setup") {
      if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
        return sendEmbed(`${E.error} admin only`, `${E.angry} you need administrator permission.`, 0xff0000);
      }
      const logChannel = interaction.options.getChannel("log_channel");
      const enabled = interaction.options.getBoolean("enabled") ?? true;
      const autoCloseHours = interaction.options.getInteger("auto_close_hours") ?? 24;
      const ratingEnabled = interaction.options.getBoolean("rating_enabled") ?? true;
      const transcriptEnabled = interaction.options.getBoolean("transcript_enabled") ?? true;

      await pool.query(
        `INSERT INTO ticket_settings (guild_id, log_channel_id, enabled, auto_close_hours, rating_enabled, transcript_enabled)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (guild_id) DO UPDATE SET log_channel_id=$2, enabled=$3, auto_close_hours=$4, rating_enabled=$5, transcript_enabled=$6`,
        [guild.id, logChannel.id, enabled, autoCloseHours, ratingEnabled, transcriptEnabled]
      );
      return sendEmbed(`${E.settings} ticket system configured`, `${E.success} settings saved.\nlog: ${logChannel}\nauto-close: ${autoCloseHours}h\nrating: ${ratingEnabled}\ntranscripts: ${transcriptEnabled}`);
    }

    // ── CATEGORY MANAGEMENT ──────────────────────────────
    if (group === "category") {
      if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
        return sendEmbed(`${E.error} admin only`, `${E.angry} you need administrator permission.`, 0xff0000);
      }

      if (sub === "add") {
        const name = interaction.options.getString("name").toLowerCase();
        const parent = interaction.options.getChannel("parent");
        const supportRole = interaction.options.getRole("support_role");
        const welcomeMessage = interaction.options.getString("welcome_message") || "welcome to your ticket, {mention}. support will be with you shortly.";
        const welcomeType = interaction.options.getBoolean("welcome_type") ?? true;
        const pingMessage = interaction.options.getString("ping_message") || "ayo the staff is needed wake tf up {role}";
        const pingType = interaction.options.getBoolean("ping_type") ?? false;
        const questions = interaction.options.getString("questions") || "";

        const questionsArray = questions.split(",").map(q => q.trim()).filter(q => q.length > 0);

        const categoryId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

        await pool.query(
          `INSERT INTO ticket_categories (guild_id, category_id, name, support_role_id, parent_id, welcome_message, welcome_type, ping_message, ping_type, questions)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [guild.id, categoryId, name, supportRole.id, parent.id, welcomeMessage, welcomeType, pingMessage, pingType, JSON.stringify(questionsArray)]
        );

        return sendEmbed(`${E.success} category added`, `${E.agree} created category **${name}**.`);
      }

      if (sub === "remove") {
        const categoryId = interaction.options.getString("category_id");
        const result = await pool.query(`DELETE FROM ticket_categories WHERE guild_id = $1 AND category_id = $2 RETURNING *`, [guild.id, categoryId]);
        if (result.rows.length === 0) return sendEmbed(`${E.error} not found`, `${E.angry} category not found.`, 0xff0000);
        return sendEmbed(`${E.success} category removed`, `${E.agree} deleted.`);
      }

      if (sub === "list") {
        const res = await pool.query(`SELECT * FROM ticket_categories WHERE guild_id = $1 ORDER BY name`, [guild.id]);
        if (!res.rows.length) return sendEmbed(`${E.error} no categories`, `${E.angry} none configured.`, 0xff0000);
        const lines = res.rows.map(r => `**${r.name}** (id: ${r.category_id})\nparent: <#${r.parent_id}>\nsupport: <@&${r.support_role_id}>\nquestions: ${r.questions.length ? r.questions.map((q,i)=>`${i+1}. ${q}`).join(' | ') : 'none'}`);
        return sendEmbed(`${E.ticket} ticket categories`, lines.join('\n\n'), 0x7c7ce0, false);
      }
    }

    // ── OPEN ─────────────────────────────────────────────
    if (sub === "open") {
      const settings = await getSettings();
      if (!settings || !settings.enabled) return sendEmbed(`${E.error} disabled`, `${E.angry} tickets disabled.`, 0xff0000);

      // Get categories
      const categoriesRes = await pool.query(`SELECT * FROM ticket_categories WHERE guild_id = $1`, [guild.id]);
      if (!categoriesRes.rows.length) return sendEmbed(`${E.error} no categories`, `${E.angry} ask admin to add categories.`, 0xff0000);

      // Build select menu for category
      const select = new StringSelectMenuBuilder()
        .setCustomId("ticket_open_cat")
        .setPlaceholder("select a category")
        .addOptions(categoriesRes.rows.map(c => ({ label: c.name, value: c.category_id })));

      const row = new ActionRowBuilder().addComponents(select);

      const catMsg = await interaction.editReply({ content: `${E.ticket} select a category to open a ticket:`, components: [row] }).catch(() => null);
      if (!catMsg) return;

      const collector = catMsg.createMessageComponentCollector({ time: 60000, max: 1 });
      collector.on("collect", async (selectInteraction) => {
        if (selectInteraction.user.id !== interaction.user.id) {
          return selectInteraction.reply({ content: `${E.error} not yours!`, ephemeral: true });
        }
        const categoryId = selectInteraction.values[0];
        const category = await getCategory(categoryId);
        if (!category) return selectInteraction.reply({ content: `${E.error} category invalid`, ephemeral: true });

        // Check if user has open ticket in this category
        const existing = await pool.query(
          `SELECT channel_id FROM ticket_channels WHERE guild_id=$1 AND user_id=$2 AND category_id=$3 AND status='open'`,
          [guild.id, member.id, categoryId]
        );
        if (existing.rows.length > 0) {
          return selectInteraction.reply({ content: `${E.error} already open`, ephemeral: true });
        }

        // If category has questions, show modal
        const questions = Array.isArray(category.questions) ? category.questions : (JSON.parse(category.questions || '[]'));
        if (questions.length > 0) {
          const modal = new ModalBuilder()
            .setCustomId(`ticket_modal_${categoryId}`)
            .setTitle("ticket questions");

          const textInputs = questions.map((q, i) =>
            new TextInputBuilder()
              .setCustomId(`q_${i}`)
              .setLabel(q.slice(0, 45))
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(true)
              .setMaxLength(500)
          );

          // Add max 5 inputs per modal
          const rows = textInputs.slice(0, 5).map(input => new ActionRowBuilder().addComponents(input));
          modal.addComponents(...rows);
          await selectInteraction.showModal(modal);
          return;
        }

        // No questions, create immediately
        await createTicket(selectInteraction, category, settings, client);
      });

      collector.on("end", () => { catMsg.edit({ components: [] }).catch(() => {}); });
      return;
    }

    // Function to create ticket after modal/select
    async function createTicket(interaction, category, settings, client) {
      const pool = client.pool;
      const guild = interaction.guild;
      const member = interaction.member || interaction.user;

      // Priority selection
      const prioritySelect = new StringSelectMenuBuilder()
        .setCustomId("ticket_priority")
        .setPlaceholder("select priority")
        .addOptions(Object.entries(PRIORITIES).map(([value, label]) => ({ label, value })));

      const priorityRow = new ActionRowBuilder().addComponents(prioritySelect);
      const priorityMsg = await interaction.reply({ content: `${E.ticket} select priority:`, components: [priorityRow], ephemeral: true }).catch(() => null);
      if (!priorityMsg) return;

      const priorityCollector = priorityMsg.createMessageComponentCollector({ time: 60000, max: 1 });
      priorityCollector.on("collect", async (pInteraction) => {
        const priority = pInteraction.values[0];

        // Create channel
        const channelName = `${priority}-${member.user.username.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20)}`;
        const ticketChannel = await guild.channels.create({
          name: channelName,
          type: ChannelType.GuildText,
          parent: category.parent_id,
          permissionOverwrites: [
            { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
            { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
            { id: category.support_role_id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
          ],
          reason: "chromed ticket",
        });

        // Save ticket
        await pool.query(
          `INSERT INTO ticket_channels (guild_id, channel_id, user_id, category_id, priority) VALUES ($1,$2,$3,$4,$5)`,
          [guild.id, ticketChannel.id, member.id, category.category_id, priority]
        );

        // Welcome message
        let welcomeContent;
        if (category.welcome_type) {
          const embed = new EmbedBuilder()
            .setColor(0x7c7ce0)
            .setTitle(`ticket opened`)
            .setDescription(category.welcome_message.replace("{mention}", `<@${member.id}>`).replace("{user}", member.user.username).replace("{server}", guild.name))
            .addFields({ name: "priority", value: PRIORITIES[priority], inline: true })
            .setFooter({ text: "use /ticket close when done" });
          welcomeContent = { embeds: [embed] };
        } else {
          welcomeContent = { content: category.welcome_message.replace("{mention}", `<@${member.id}>`).replace("{user}", member.user.username).replace("{server}", guild.name) };
        }

        const closeButtonRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("ticket_close").setLabel("close").setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId("ticket_claim").setLabel("claim").setStyle(ButtonStyle.Primary)
        );

        const welcomeMsg = await ticketChannel.send({ ...welcomeContent, components: [closeButtonRow] });

        // Ping message
        let pingContent;
        if (category.ping_type) {
          const pingEmbed = new EmbedBuilder()
            .setColor(0xFFA500)
            .setDescription(category.ping_message.replace("{role}", `<@&${category.support_role_id}>`).replace("{mention}", `<@${member.id}>`));
          pingContent = { embeds: [pingEmbed] };
        } else {
          pingContent = { content: category.ping_message.replace("{role}", `<@&${category.support_role_id}>`).replace("{mention}", `<@${member.id}>`) };
        }
        await ticketChannel.send(pingContent).catch(() => {});

        // Log to channel
        const logChannel = guild.channels.cache.get(settings.log_channel_id);
        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setColor(0x7c7ce0)
            .setTitle("ticket opened")
            .addFields(
              { name: "ticket", value: `<#${ticketChannel.id}>`, inline: true },
              { name: "category", value: category.name, inline: true },
              { name: "priority", value: PRIORITIES[priority], inline: true },
              { name: "opened by", value: `<@${member.id}>`, inline: true }
            )
            .setTimestamp();
          await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
        }

        // Set up auto-close timer in memory (or later via event)
        // We'll store in client.ticketTimers if needed; for now manual close.
      });

      priorityCollector.on("end", () => { priorityMsg.edit({ components: [] }).catch(() => {}); });
    }

    // ── CLOSE ────────────────────────────────────────────
    if (sub === "close") {
      const channelId = interaction.channelId;
      const ticket = await pool.query(`SELECT * FROM ticket_channels WHERE channel_id=$1 AND guild_id=$2 AND status='open'`, [channelId, guild.id]);
      if (!ticket.rows[0]) return sendEmbed(`${E.error} not a ticket`, `${E.angry} this isn't an open ticket.`, 0xff0000);

      const settings = await getSettings();
      // Log
      const logChannel = guild.channels.cache.get(settings?.log_channel_id);
      if (logChannel) {
        const logEmbed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle("ticket closed")
          .addFields(
            { name: "ticket", value: `<#${channelId}>`, inline: true },
            { name: "opened by", value: `<@${ticket.rows[0].user_id}>`, inline: true },
            { name: "closed by", value: `<@${member.id}>`, inline: true }
          )
          .setTimestamp();
        await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
      }

      // Rating if enabled
      if (settings?.rating_enabled) {
        const ratingMsg = await interaction.channel.send({
          content: `${E.ai} please rate your experience:`,
          components: [
            new ActionRowBuilder().addComponents(
              [1,2,3,4,5].map(n =>
                new ButtonBuilder()
                  .setCustomId(`ticket_rate_${n}`)
                  .setLabel(`${n}⭐`)
                  .setStyle(ButtonStyle.Secondary)
              )
            )
          ]
        });
        const ratingCollector = ratingMsg.createMessageComponentCollector({ time: 60000, max: 1 });
        ratingCollector.on("collect", async (btn) => {
          const rating = parseInt(btn.customId.split("_").pop());
          await pool.query(`UPDATE ticket_channels SET rating=$1 WHERE channel_id=$2`, [rating, channelId]);
          await btn.reply({ content: `${E.success} thanks for rating!`, ephemeral: true });
        });
      }

      await pool.query(`UPDATE ticket_channels SET status='closed' WHERE channel_id=$1`, [channelId]);
      await interaction.channel.delete("ticket closed").catch(() => {});
    }

    // ── CLAIM ────────────────────────────────────────────
    if (sub === "claim") {
      const ticket = await pool.query(`SELECT * FROM ticket_channels WHERE channel_id=$1 AND guild_id=$2 AND status='open'`, [interaction.channelId, guild.id]);
      if (!ticket.rows[0]) return sendEmbed(`${E.error} not a ticket`, `${E.angry} no open ticket.`, 0xff0000);
      await pool.query(`UPDATE ticket_channels SET claimed_by=$1 WHERE channel_id=$2`, [member.id, interaction.channelId]);
      return sendEmbed(`${E.success} claimed`, `${E.agree} ticket claimed by ${member}.`);
    }

    // ── UNCLAIM ──────────────────────────────────────────
    if (sub === "unclaim") {
      const ticket = await pool.query(`SELECT * FROM ticket_channels WHERE channel_id=$1 AND guild_id=$2 AND status='open'`, [interaction.channelId, guild.id]);
      if (!ticket.rows[0]) return sendEmbed(`${E.error} not a ticket`, `${E.angry} no open ticket.`, 0xff0000);
      await pool.query(`UPDATE ticket_channels SET claimed_by=NULL WHERE channel_id=$1`, [interaction.channelId]);
      return sendEmbed(`${E.success} unclaimed`, `${E.agree} ticket is unclaimed.`);
    }

    // ── ADD/REMOVE ───────────────────────────────────────
    if (sub === "add" || sub === "remove") {
      const target = interaction.options.getUser("user");
      const allow = sub === "add";
      await interaction.channel.permissionOverwrites.edit(target.id, {
        ViewChannel: allow,
        SendMessages: allow,
      }).catch(() => {});
      return sendEmbed(`${allow ? E.success : E.error} user ${allow ? "added" : "removed"}`, `${allow ? E.agree : E.angry} ${target} has been ${allow ? "added to" : "removed from"} the ticket.`);
    }

    // ── TAG ──────────────────────────────────────────────
    if (sub === "tag") {
      const tag = interaction.options.getString("tag").toLowerCase();
      const ticket = await pool.query(`SELECT tags FROM ticket_channels WHERE channel_id=$1 AND guild_id=$2 AND status='open'`, [interaction.channelId, guild.id]);
      if (!ticket.rows[0]) return sendEmbed(`${E.error} not a ticket`, `${E.angry} no open ticket.`, 0xff0000);
      let tags = ticket.rows[0].tags || [];
      if (!tags.includes(tag)) {
        tags.push(tag);
        await pool.query(`UPDATE ticket_channels SET tags=$1 WHERE channel_id=$2`, [tags, interaction.channelId]);
      }
      return sendEmbed(`${E.success} tag added`, `${E.agree} tag **${tag}** added.`);
    }

    // ── STATS ────────────────────────────────────────────
    if (sub === "stats") {
      if (!member.permissions.has(PermissionFlagsBits.Administrator)) return sendEmbed(`${E.error} admin only`, `${E.angry} you need administrator.`, 0xff0000);
      const res = await pool.query(`
        SELECT category_id, COUNT(*) as total,
        SUM(CASE WHEN status='open' THEN 1 ELSE 0 END) as open,
        SUM(CASE WHEN status='closed' THEN 1 ELSE 0 END) as closed,
        AVG(rating) as avg_rating
        FROM ticket_channels WHERE guild_id=$1 GROUP BY category_id`, [guild.id]);
      if (!res.rows.length) return sendEmbed(`${E.error} no data`, `${E.angry} no tickets yet.`, 0xff0000);
      const lines = res.rows.map(r => {
        const cat = r.category_id;
        return `**${cat}**: total ${r.total}, open ${r.open}, closed ${r.closed}, avg rating ${r.avg_rating ? r.avg_rating.toFixed(1) : 'n/a'}`;
      }).join('\n');
      return sendEmbed(`${E.ticket} ticket stats`, lines, 0x7c7ce0, false);
    }

    // ── DELETE (admin) ───────────────────────────────────
    if (sub === "delete") {
      if (!member.permissions.has(PermissionFlagsBits.Administrator)) return sendEmbed(`${E.error} admin only`, `${E.angry} you need administrator.`, 0xff0000);
      const channel = interaction.options.getChannel("channel");
      await pool.query(`DELETE FROM ticket_channels WHERE channel_id=$1 AND guild_id=$2`, [channel.id, guild.id]);
      await channel.delete("admin delete").catch(() => {});
      return sendEmbed(`${E.success} ticket deleted`, `${E.agree} deleted ${channel}.`);
    }

    return sendEmbed(`${E.error} unknown`, "unknown subcommand.");
  },
};
