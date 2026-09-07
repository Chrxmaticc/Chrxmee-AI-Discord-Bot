const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require("discord.js");

const E = {
  success: "<:Verified_Icon:1527194184841167010>",
  error: "<:no:1530373946795364362>",
  ai: "<:Chrxmaticc_AI:1480094799292928132>",
  agree: "<:agreed:1525639597135237131>",
  angry: "<:angry_cry:1526029511882440744>",
  settings: "<:Settings:1525601248278216725>",
  link: "<:Link:1525603398341103806>",
  file: "<:File_Icon:1526542046213570681>",
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("welcomer")
    .setDescription("customizable welcome system")
    // Setup
    .addSubcommand(sub => sub.setName("setup").setDescription("(admin) enable/disable and set welcome channel")
      .addBooleanOption(opt => opt.setName("enabled").setDescription("enable or disable").setRequired(true))
      .addChannelOption(opt => opt.setName("channel").setDescription("welcome channel").setRequired(false))
    )
    // Message
    .addSubcommand(sub => sub.setName("message").setDescription("set the welcome message")
      .addStringOption(opt => opt.setName("text").setDescription("message template with {variables}").setRequired(true))
    )
    // Random messages
    .addSubcommandGroup(group => group.setName("random").setDescription("random welcome messages")
      .addSubcommand(sub => sub.setName("toggle").setDescription("enable/disable random messages")
        .addBooleanOption(opt => opt.setName("enabled").setDescription("on or off").setRequired(true))
      )
      .addSubcommand(sub => sub.setName("add").setDescription("add a random message")
        .addStringOption(opt => opt.setName("message").setDescription("message text").setRequired(true))
      )
      .addSubcommand(sub => sub.setName("remove").setDescription("remove a random message by id")
        .addIntegerOption(opt => opt.setName("id").setDescription("message id").setRequired(true))
      )
      .addSubcommand(sub => sub.setName("list").setDescription("list all random messages"))
    )
    // Image
    .addSubcommandGroup(group => group.setName("image").setDescription("image card settings")
      .addSubcommand(sub => sub.setName("toggle").setDescription("enable/disable image card")
        .addBooleanOption(opt => opt.setName("enabled").setDescription("on or off").setRequired(true))
      )
      .addSubcommand(sub => sub.setName("background").setDescription("set background image url or 'default'")
        .addStringOption(opt => opt.setName("url").setDescription("image url or 'default'").setRequired(true))
      )
    )
    // Embed
    .addSubcommandGroup(group => group.setName("embed").setDescription("embed settings")
      .addSubcommand(sub => sub.setName("toggle").setDescription("enable/disable embed")
        .addBooleanOption(opt => opt.setName("enabled").setDescription("on or off").setRequired(true))
      )
      .addSubcommand(sub => sub.setName("color").setDescription("set embed color hex")
        .addStringOption(opt => opt.setName("hex").setDescription("hex without #").setRequired(true))
      )
      .addSubcommand(sub => sub.setName("title").setDescription("set embed title")
        .addStringOption(opt => opt.setName("text").setDescription("title text").setRequired(true))
      )
      .addSubcommand(sub => sub.setName("footer").setDescription("set embed footer")
        .addStringOption(opt => opt.setName("text").setDescription("footer text").setRequired(true))
      )
    )
    // Button
    .addSubcommandGroup(group => group.setName("button").setDescription("button settings")
      .addSubcommand(sub => sub.setName("toggle").setDescription("enable/disable button")
        .addBooleanOption(opt => opt.setName("enabled").setDescription("on or off").setRequired(true))
      )
      .addSubcommand(sub => sub.setName("label").setDescription("set button label")
        .addStringOption(opt => opt.setName("text").setDescription("label text").setRequired(true))
      )
      .addSubcommand(sub => sub.setName("url").setDescription("set button url")
        .addStringOption(opt => opt.setName("link").setDescription("url").setRequired(true))
      )
    )
    // Attachments
    .addSubcommandGroup(group => group.setName("attachment").setDescription("extra files/images to send")
      .addSubcommand(sub => sub.setName("add").setDescription("add attachment by url")
        .addStringOption(opt => opt.setName("url").setDescription("file/image url").setRequired(true))
      )
      .addSubcommand(sub => sub.setName("remove").setDescription("remove attachment by id")
        .addIntegerOption(opt => opt.setName("id").setDescription("attachment id").setRequired(true))
      )
      .addSubcommand(sub => sub.setName("list").setDescription("list attachments"))
    )
    // Auto role
    .addSubcommand(sub => sub.setName("role").setDescription("set auto role on join")
      .addRoleOption(opt => opt.setName("role").setDescription("role to assign").setRequired(true))
    )
    // Test
    .addSubcommand(sub => sub.setName("test").setDescription("preview the welcome message")),

  async execute(interaction) {
    const isButtonSim = interaction.isButton && interaction.isButton();
    if (!isButtonSim) {
      try { await interaction.deferReply({ ephemeral: true }); } catch { try { await interaction.deferReply(); } catch {} }
    }

    const pool = interaction.client.pool;
    const sub = interaction.options.getSubcommand();
    const group = interaction.options.getSubcommandGroup(false);
    const guildId = interaction.guildId;

    const sendEmbed = async (title, description, color = 0x7c7ce0, ephemeral = true) => {
      const embed = new EmbedBuilder().setColor(color).setTitle(title).setDescription(description);
      return interaction.editReply({ embeds: [embed], ephemeral }).catch(() => interaction.followUp({ embeds: [embed], ephemeral }));
    };

    // permission check
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return sendEmbed(`${E.error} admin only`, `${E.angry} you need administrator permission.`, 0xff0000);
    }

    try {
      // SETUP
      if (sub === "setup") {
        const enabled = interaction.options.getBoolean("enabled");
        const channel = interaction.options.getChannel("channel") || null;
        await pool.query(
          `INSERT INTO welcome_settings (guild_id, enabled, channel_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (guild_id) DO UPDATE SET enabled = $2, channel_id = COALESCE($3, welcome_settings.channel_id)`,
          [guildId, enabled, channel ? channel.id : null]
        );
        return sendEmbed(`${E.settings} welcomer ${enabled ? "enabled" : "disabled"}`, `${E.success} ${channel ? `channel set to ${channel}` : "channel unchanged"}.`);
      }

      // MESSAGE
      if (sub === "message") {
        const text = interaction.options.getString("text");
        await pool.query(
          `INSERT INTO welcome_settings (guild_id, message_template) VALUES ($1, $2)
           ON CONFLICT (guild_id) DO UPDATE SET message_template = $2`,
          [guildId, text]
        );
        return sendEmbed(`${E.success} message set`, `${E.agree} welcome message updated.`);
      }

      // RANDOM GROUP
      if (group === "random") {
        if (sub === "toggle") {
          const enabled = interaction.options.getBoolean("enabled");
          await pool.query(
            `UPDATE welcome_settings SET random_messages_enabled = $1 WHERE guild_id = $2`,
            [enabled, guildId]
          );
          return sendEmbed(`${E.success} random messages ${enabled ? "enabled" : "disabled"}`, `${E.agree} done.`);
        }
        if (sub === "add") {
          const message = interaction.options.getString("message");
          await pool.query(
            `INSERT INTO welcome_random_messages (guild_id, message) VALUES ($1, $2)`,
            [guildId, message]
          );
          return sendEmbed(`${E.success} random message added`, `${E.agree} saved.`);
        }
        if (sub === "remove") {
          const id = interaction.options.getInteger("id");
          const result = await pool.query(
            `DELETE FROM welcome_random_messages WHERE guild_id = $1 AND id = $2 RETURNING *`,
            [guildId, id]
          );
          if (result.rows.length === 0) return sendEmbed(`${E.error} not found`, `${E.angry} id not found.`, 0xff0000);
          return sendEmbed(`${E.success} removed`, `${E.agree} deleted message id ${id}.`);
        }
        if (sub === "list") {
          const result = await pool.query(
            `SELECT id, message FROM welcome_random_messages WHERE guild_id = $1 ORDER BY id`,
            [guildId]
          );
          if (!result.rows.length) return sendEmbed(`${E.error} no messages`, `${E.angry} no random messages.`, 0xff0000);
          const list = result.rows.map(r => `\`${r.id}.\` ${r.message}`).join("\n");
          return sendEmbed(`${E.ai} random messages`, list);
        }
      }

      // IMAGE GROUP
      if (group === "image") {
        if (sub === "toggle") {
          const enabled = interaction.options.getBoolean("enabled");
          await pool.query(`UPDATE welcome_settings SET image_enabled = $1 WHERE guild_id = $2`, [enabled, guildId]);
          return sendEmbed(`${E.settings} image ${enabled ? "enabled" : "disabled"}`, `${E.success} image card ${enabled ? "on" : "off"}.`);
        }
        if (sub === "background") {
          const url = interaction.options.getString("url");
          const val = url.toLowerCase() === "default" ? null : url;
          await pool.query(`UPDATE welcome_settings SET background_url = $1 WHERE guild_id = $2`, [val, guildId]);
          return sendEmbed(`${E.success} background set`, `${E.agree} background updated.`);
        }
      }

      // EMBED GROUP
      if (group === "embed") {
        if (sub === "toggle") {
          const enabled = interaction.options.getBoolean("enabled");
          await pool.query(`UPDATE welcome_settings SET embed_enabled = $1 WHERE guild_id = $2`, [enabled, guildId]);
          return sendEmbed(`${E.success} embed ${enabled ? "enabled" : "disabled"}`, `${E.agree} done.`);
        }
        if (sub === "color") {
          const hex = interaction.options.getString("hex").replace("#", "");
          if (!/^[0-9a-fA-F]{6}$/.test(hex)) return sendEmbed(`${E.error} invalid hex`, `${E.angry} please provide a 6-digit hex.`, 0xff0000);
          await pool.query(`UPDATE welcome_settings SET embed_color = $1 WHERE guild_id = $2`, [hex, guildId]);
          return sendEmbed(`${E.settings} embed color set`, `${E.success} color #${hex}.`);
        }
        if (sub === "title") {
          const text = interaction.options.getString("text");
          await pool.query(`UPDATE welcome_settings SET embed_title = $1 WHERE guild_id = $2`, [text, guildId]);
          return sendEmbed(`${E.success} embed title set`, `${E.agree} done.`);
        }
        if (sub === "footer") {
          const text = interaction.options.getString("text");
          await pool.query(`UPDATE welcome_settings SET embed_footer = $1 WHERE guild_id = $2`, [text, guildId]);
          return sendEmbed(`${E.success} embed footer set`, `${E.agree} done.`);
        }
      }

      // BUTTON GROUP
      if (group === "button") {
        if (sub === "toggle") {
          const enabled = interaction.options.getBoolean("enabled");
          await pool.query(`UPDATE welcome_settings SET button_enabled = $1 WHERE guild_id = $2`, [enabled, guildId]);
          return sendEmbed(`${E.success} button ${enabled ? "enabled" : "disabled"}`, `${E.agree} done.`);
        }
        if (sub === "label") {
          const text = interaction.options.getString("text");
          await pool.query(`UPDATE welcome_settings SET button_label = $1 WHERE guild_id = $2`, [text, guildId]);
          return sendEmbed(`${E.link} button label set`, `${E.success} label: ${text}`);
        }
        if (sub === "url") {
          const url = interaction.options.getString("link");
          await pool.query(`UPDATE welcome_settings SET button_url = $1 WHERE guild_id = $2`, [url, guildId]);
          return sendEmbed(`${E.link} button url set`, `${E.success} url: ${url}`);
        }
      }

      // ATTACHMENT GROUP
      if (group === "attachment") {
        if (sub === "add") {
          const url = interaction.options.getString("url");
          await pool.query(`INSERT INTO welcome_attachments (guild_id, url) VALUES ($1, $2)`, [guildId, url]);
          return sendEmbed(`${E.file} attachment added`, `${E.agree} file added.`);
        }
        if (sub === "remove") {
          const id = interaction.options.getInteger("id");
          const result = await pool.query(`DELETE FROM welcome_attachments WHERE guild_id = $1 AND id = $2 RETURNING *`, [guildId, id]);
          if (result.rows.length === 0) return sendEmbed(`${E.error} not found`, `${E.angry} id not found.`, 0xff0000);
          return sendEmbed(`${E.success} attachment removed`, `${E.agree} removed id ${id}.`);
        }
        if (sub === "list") {
          const result = await pool.query(`SELECT id, url FROM welcome_attachments WHERE guild_id = $1 ORDER BY id`, [guildId]);
          if (!result.rows.length) return sendEmbed(`${E.error} no attachments`, `${E.angry} none.`, 0xff0000);
          const list = result.rows.map(r => `\`${r.id}.\` ${r.url}`).join("\n");
          return sendEmbed(`${E.file} attachments`, list);
        }
      }

      // ROLE
      if (sub === "role") {
        const role = interaction.options.getRole("role");
        await pool.query(`UPDATE welcome_settings SET auto_role_id = $1 WHERE guild_id = $2`, [role.id, guildId]);
        return sendEmbed(`${E.success} auto role set`, `${E.agree} new members will get ${role}.`);
      }

      // TEST
      if (sub === "test") {
        // Just reply with current settings preview
        const settings = await pool.query(`SELECT * FROM welcome_settings WHERE guild_id = $1`, [guildId]);
        if (!settings.rows[0]) return sendEmbed(`${E.error} not configured`, `${E.angry} use /welcomer setup first.`, 0xff0000);
        const s = settings.rows[0];
        const embed = new EmbedBuilder()
          .setColor(0x7c7ce0)
          .setTitle(`${E.settings} welcomer config`)
          .addFields(
            { name: "enabled", value: String(s.enabled), inline: true },
            { name: "channel", value: s.channel_id ? `<#${s.channel_id}>` : "not set", inline: true },
            { name: "message", value: s.message_template || "default", inline: false },
            { name: "random messages", value: s.random_messages_enabled ? "enabled" : "disabled", inline: true },
            { name: "image card", value: s.image_enabled ? "enabled" : "disabled", inline: true },
            { name: "embed", value: s.embed_enabled ? "enabled" : "disabled", inline: true },
            { name: "button", value: s.button_enabled ? "enabled" : "disabled", inline: true },
            { name: "auto role", value: s.auto_role_id ? `<@&${s.auto_role_id}>` : "none", inline: true }
          )
          .setTimestamp();
        return interaction.editReply({ embeds: [embed], ephemeral: true });
      }

      return sendEmbed(`${E.error} unknown`, "unknown subcommand.");
    } catch (err) {
      console.error("welcomer command error:", err);
      return sendEmbed(`${E.error} error`, `${E.angry} ${err.message}`, 0xff0000);
    }
  },
};
