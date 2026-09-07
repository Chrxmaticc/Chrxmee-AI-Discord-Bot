const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const E = {
  success: "<:Verified_Icon:1527194184841167010>",
  error: "<:no:1530373946795364362>",
  ai: "<:Chrxmaticc_AI:1480094799292928132>",
  agree: "<:agreed:1525639597135237131>",
  angry: "<:angry_cry:1526029511882440744>",
  settings: "<:Settings:1525601248278216725>",
  ticket: "<:Channel:1531901854361849929>",
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("manage support tickets")
    .addSubcommand(sub => sub.setName("setup").setDescription("(admin) configure ticket system")
      .addChannelOption(opt => opt.setName("category").setDescription("category for tickets").setRequired(true))
      .addRoleOption(opt => opt.setName("support_role").setDescription("support role that sees tickets").setRequired(true))
      .addChannelOption(opt => opt.setName("log_channel").setDescription("channel for ticket logs").setRequired(true))
      .addStringOption(opt => opt.setName("welcome_message").setDescription("welcome message with {mention}").setRequired(false))
      .addBooleanOption(opt => opt.setName("enabled").setDescription("enable or disable").setRequired(false))
    )
    .addSubcommand(sub => sub.setName("open").setDescription("open a ticket"))
    .addSubcommand(sub => sub.setName("close").setDescription("close a ticket (in ticket channel)"))
    .addSubcommand(sub => sub.setName("add").setDescription("add a user to your ticket")
      .addUserOption(opt => opt.setName("user").setDescription("user to add").setRequired(true))
    )
    .addSubcommand(sub => sub.setName("remove").setDescription("remove a user from your ticket")
      .addUserOption(opt => opt.setName("user").setDescription("user to remove").setRequired(true))
    )
    .addSubcommand(sub => sub.setName("delete").setDescription("(admin) force delete a ticket")
      .addChannelOption(opt => opt.setName("channel").setDescription("ticket channel").setRequired(true))
    ),

  async execute(interaction) {
    const isButtonSim = interaction.isButton && interaction.isButton();
    if (!isButtonSim) {
      try { await interaction.deferReply({ ephemeral: true }); } catch { try { await interaction.deferReply(); } catch {} }
    }

    const pool = interaction.client.pool;
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;
    const member = interaction.member;

    const sendEmbed = async (title, description, color = 0x7c7ce0, ephemeral = true) => {
      const embed = new EmbedBuilder().setColor(color).setTitle(title).setDescription(description);
      return interaction.editReply({ embeds: [embed], ephemeral }).catch(() => interaction.followUp({ embeds: [embed], ephemeral }));
    };

    // ── SETUP (admin only) ─────────────────────────────
    if (sub === "setup") {
      if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
        return sendEmbed(`${E.error} admin only`, `${E.angry} you need administrator permission.`, 0xff0000);
      }
      const category = interaction.options.getChannel("category");
      const supportRole = interaction.options.getRole("support_role");
      const logChannel = interaction.options.getChannel("log_channel");
      const welcome = interaction.options.getString("welcome_message") || "welcome to your ticket, {mention}. support will be with you shortly.";
      const enabled = interaction.options.getBoolean("enabled") ?? true;

      if (category.type !== ChannelType.GuildCategory) {
        return sendEmbed(`${E.error} invalid category`, `${E.angry} category must be a category channel.`, 0xff0000);
      }
      if (logChannel.type !== ChannelType.GuildText) {
        return sendEmbed(`${E.error} invalid log`, `${E.angry} log channel must be text.`, 0xff0000);
      }

      await pool.query(
        `INSERT INTO ticket_settings (guild_id, category_id, support_role_id, log_channel_id, welcome_message, enabled)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (guild_id) DO UPDATE SET
           category_id = $2,
           support_role_id = $3,
           log_channel_id = $4,
           welcome_message = $5,
           enabled = $6`,
        [guild.id, category.id, supportRole.id, logChannel.id, welcome, enabled]
      );

      return sendEmbed(`${E.settings} ticket system configured`, `${E.success} tickets ${enabled ? "enabled" : "disabled"}.\ncategory: ${category}\nsupport role: ${supportRole}\nlog channel: ${logChannel}`);
    }

    // Get settings
    const settingsRes = await pool.query(`SELECT * FROM ticket_settings WHERE guild_id = $1`, [guild.id]);
    if (!settingsRes.rows[0]) {
      return sendEmbed(`${E.error} not configured`, `${E.angry} run /ticket setup first.`, 0xff0000);
    }
    const settings = settingsRes.rows[0];

    // ── OPEN ────────────────────────────────────────────
    if (sub === "open") {
      if (!settings.enabled) return sendEmbed(`${E.error} tickets disabled`, `${E.angry} tickets are currently disabled.`, 0xff0000);

      // Check if user already has open ticket
      const existing = await pool.query(
        `SELECT channel_id FROM ticket_channels WHERE guild_id = $1 AND user_id = $2 AND status = 'open'`,
        [guild.id, member.id]
      );
      if (existing.rows.length > 0) {
        return sendEmbed(`${E.error} already open`, `${E.angry} you already have an open ticket: <#${existing.rows[0].channel_id}>`, 0xff0000);
      }

      // Create private ticket channel
      const ticketChannel = await guild.channels.create({
        name: `ticket-${member.user.username.toLowerCase().replace(/[^a-z0-9]/g, "")}`,
        type: ChannelType.GuildText,
        parent: settings.category_id,
        permissionOverwrites: [
          { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
          { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
          { id: settings.support_role_id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
        ],
        reason: "chromed ticket",
      });

      // Save to DB
      await pool.query(
        `INSERT INTO ticket_channels (guild_id, channel_id, user_id) VALUES ($1, $2, $3)`,
        [guild.id, ticketChannel.id, member.id]
      );

      // Welcome message
      const finalMsg = settings.welcome_message.replace("{mention}", `<@${member.id}>`);
      const embed = new EmbedBuilder()
        .setColor(0x7c7ce0)
        .setTitle(`${E.ticket} ticket opened`)
        .setDescription(finalMsg)
        .setFooter({ text: "use /ticket close when done" });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("ticket_close").setLabel("close ticket").setStyle(ButtonStyle.Danger)
      );

      const welcomeMsg = await ticketChannel.send({ content: `${E.success} ${member}`, embeds: [embed], components: [row] });

      // Button collector for close (temporary, 1 hour)
      const collector = welcomeMsg.createMessageComponentCollector({ time: 3600000 });
      collector.on("collect", async (btn) => {
        if (btn.customId === "ticket_close") {
          await btn.deferUpdate();
          const ticketRes = await pool.query(
            `SELECT * FROM ticket_channels WHERE channel_id = $1`,
            [btn.channelId]
          );
          if (ticketRes.rows.length > 0) {
            // log to log channel
            const logChannel = guild.channels.cache.get(settings.log_channel_id);
            if (logChannel) {
              const logEmbed = new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle("ticket closed")
                .addFields(
                  { name: "ticket", value: `<#${btn.channelId}>`, inline: true },
                  { name: "opened by", value: `<@${ticketRes.rows[0].user_id}>`, inline: true },
                  { name: "closed by", value: `<@${btn.user.id}>`, inline: true }
                )
                .setTimestamp();
              await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
            }
            await pool.query(`UPDATE ticket_channels SET status = 'closed' WHERE channel_id = $1`, [btn.channelId]);
            await btn.channel.delete("ticket closed").catch(() => {});
          }
        }
      });
      collector.on("end", () => {
        welcomeMsg.edit({ components: [] }).catch(() => {});
      });

      return sendEmbed(`${E.success} ticket opened`, `${E.agree} your ticket has been created: ${ticketChannel}`, 0x7c7ce0);
    }

    // ── CLOSE (slash) ───────────────────────────────────
    if (sub === "close") {
      const channelId = interaction.channelId;
      const ticketRes = await pool.query(
        `SELECT * FROM ticket_channels WHERE channel_id = $1 AND guild_id = $2 AND status = 'open'`,
        [channelId, guild.id]
      );
      if (ticketRes.rows.length === 0) {
        return sendEmbed(`${E.error} not a ticket`, `${E.angry} this isn't an open ticket.`, 0xff0000);
      }
      // Log
      const logChannel = guild.channels.cache.get(settings.log_channel_id);
      if (logChannel) {
        const logEmbed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle("ticket closed")
          .addFields(
            { name: "ticket", value: `<#${channelId}>`, inline: true },
            { name: "opened by", value: `<@${ticketRes.rows[0].user_id}>`, inline: true },
            { name: "closed by", value: `<@${member.id}>`, inline: true }
          )
          .setTimestamp();
        await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
      }
      await pool.query(`UPDATE ticket_channels SET status = 'closed' WHERE channel_id = $1`, [channelId]);
      await interaction.channel.delete("ticket closed").catch(() => {});
      return; // channel deleted
    }

    // ── ADD ─────────────────────────────────────────────
    if (sub === "add") {
      const target = interaction.options.getUser("user");
      const channelId = interaction.channelId;
      const ticketRes = await pool.query(
        `SELECT * FROM ticket_channels WHERE channel_id = $1 AND guild_id = $2 AND status = 'open'`,
        [channelId, guild.id]
      );
      if (ticketRes.rows.length === 0) return sendEmbed(`${E.error} not a ticket`, `${E.angry} this isn't an open ticket.`, 0xff0000);

      await interaction.channel.permissionOverwrites.edit(target.id, {
        ViewChannel: true,
        SendMessages: true,
      }).catch(() => {});
      return sendEmbed(`${E.success} user added`, `${E.agree} added ${target} to the ticket.`);
    }

    // ── REMOVE ──────────────────────────────────────────
    if (sub === "remove") {
      const target = interaction.options.getUser("user");
      const channelId = interaction.channelId;
      const ticketRes = await pool.query(
        `SELECT * FROM ticket_channels WHERE channel_id = $1 AND guild_id = $2 AND status = 'open'`,
        [channelId, guild.id]
      );
      if (ticketRes.rows.length === 0) return sendEmbed(`${E.error} not a ticket`, `${E.angry} this isn't an open ticket.`, 0xff0000);

      await interaction.channel.permissionOverwrites.edit(target.id, {
        ViewChannel: false,
        SendMessages: false,
      }).catch(() => {});
      return sendEmbed(`${E.success} user removed`, `${E.agree} removed ${target} from the ticket.`);
    }

    // ── DELETE (admin) ──────────────────────────────────
    if (sub === "delete") {
      if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
        return sendEmbed(`${E.error} admin only`, `${E.angry} you need administrator permission.`, 0xff0000);
      }
      const channel = interaction.options.getChannel("channel");
      const ticketRes = await pool.query(
        `SELECT * FROM ticket_channels WHERE channel_id = $1 AND guild_id = $2`,
        [channel.id, guild.id]
      );
      if (ticketRes.rows.length === 0) return sendEmbed(`${E.error} not a ticket`, `${E.angry} that channel isn't a ticket.`, 0xff0000);
      await pool.query(`DELETE FROM ticket_channels WHERE channel_id = $1`, [channel.id]);
      await channel.delete("admin ticket delete").catch(() => {});
      return sendEmbed(`${E.success} ticket deleted`, `${E.agree} deleted ${channel}.`);
    }

    return sendEmbed(`${E.error} unknown`, "unknown subcommand.");
  },
};
