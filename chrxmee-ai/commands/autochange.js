const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require("discord.js");

const E = {
  success: "<:Verified_Icon:1527194184841167010>",
  error: "<:no:1530373946795364362>",
  ai: "<:Chrxmaticc_AI:1480094799292928132>",
  settings: "<:Settings:1525601248278216725>",
  link: "<:Link:1525603398341103806>",
  crown: "<:Holographic_owner_crown:1527401510487461969>",
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("autochange")
    .setDescription("Automatically rotate this server's identity (icon, name, banner, etc.)")
    .addSubcommand(sub => sub.setName("setup")
      .setDescription("Set the rotation interval and mode")
      .addIntegerOption(opt => opt.setName("amount").setDescription("Interval amount (e.g. 15)").setRequired(true).setMinValue(1).setMaxValue(8760))
      .addStringOption(opt => opt.setName("unit").setDescription("Minutes or hours").setRequired(true)
        .addChoices(
          { name: "minutes", value: "minutes" },
          { name: "hours", value: "hours" }
        ))
      .addStringOption(opt => opt.setName("mode").setDescription("Rotation mode").setRequired(false)
        .addChoices(
          { name: "Random", value: "random" },
          { name: "Sequential", value: "sequential" }
        )))
    .addSubcommand(sub => sub.setName("toggle")
      .setDescription("Enable or disable auto rotation")
      .addStringOption(opt => opt.setName("state").setDescription("On or Off").setRequired(true)
        .addChoices({ name: "On", value: "on" }, { name: "Off", value: "off" })))
    // Asset subcommands
    .addSubcommand(sub => sub.setName("name")
      .setDescription("Manage rotating server names")
      .addStringOption(opt => opt.setName("action").setDescription("Add, list, or remove").setRequired(true)
        .addChoices({ name: "Add", value: "add" }, { name: "List", value: "list" }, { name: "Remove", value: "remove" }))
      .addStringOption(opt => opt.setName("text").setDescription("Server name (only for add/remove)").setRequired(false)))
    .addSubcommand(sub => sub.setName("icon")
      .setDescription("Manage rotating server icons")
      .addStringOption(opt => opt.setName("action").setDescription("Add, list, or remove").setRequired(true)
        .addChoices({ name: "Add", value: "add" }, { name: "List", value: "list" }, { name: "Remove", value: "remove" }))
      .addStringOption(opt => opt.setName("url").setDescription("Image URL (only for add/remove)").setRequired(false))
      .addAttachmentOption(opt => opt.setName("image").setDescription("Or upload an image directly").setRequired(false)))
    .addSubcommand(sub => sub.setName("banner")
      .setDescription("Manage rotating server banners")
      .addStringOption(opt => opt.setName("action").setDescription("Add, list, or remove").setRequired(true)
        .addChoices({ name: "Add", value: "add" }, { name: "List", value: "list" }, { name: "Remove", value: "remove" }))
      .addStringOption(opt => opt.setName("url").setDescription("Image URL (only for add/remove)").setRequired(false))
      .addAttachmentOption(opt => opt.setName("image").setDescription("Or upload an image directly").setRequired(false)))
    .addSubcommand(sub => sub.setName("description")
      .setDescription("Manage rotating server descriptions")
      .addStringOption(opt => opt.setName("action").setDescription("Add, list, or remove").setRequired(true)
        .addChoices({ name: "Add", value: "add" }, { name: "List", value: "list" }, { name: "Remove", value: "remove" }))
      .addStringOption(opt => opt.setName("text").setDescription("Description text (only for add/remove)").setRequired(false)))
    .addSubcommand(sub => sub.setName("channel-rename")
      .setDescription("Manage rotating names for a specific channel")
      .addChannelOption(opt => opt.setName("channel").setDescription("Channel to rename").setRequired(true).addChannelTypes(ChannelType.GuildText))
      .addStringOption(opt => opt.setName("action").setDescription("Add, list, or remove").setRequired(true)
        .addChoices({ name: "Add", value: "add" }, { name: "List", value: "list" }, { name: "Remove", value: "remove" }))
      .addStringOption(opt => opt.setName("text").setDescription("Channel name (only for add/remove)").setRequired(false)))
    .addSubcommand(sub => sub.setName("force")
      .setDescription("Force an immediate rotation right now"))
    .addSubcommand(sub => sub.setName("status")
      .setDescription("View current autochange configuration")),

  async execute(interaction, client) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: `${E.error} You need Administrator permissions.`, ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();
    const pool = client.pool;
    const guild = interaction.guild;
    const guildId = guild.id;

    async function getConfig() {
      const res = await pool.query(`SELECT * FROM server_autochange WHERE guild_id = $1`, [guildId]);
      if (!res.rows[0]) {
        await pool.query(`INSERT INTO server_autochange (guild_id) VALUES ($1)`, [guildId]);
        return (await pool.query(`SELECT * FROM server_autochange WHERE guild_id = $1`, [guildId])).rows[0];
      }
      return res.rows[0];
    }

    // ─── SETUP ──────────────────────────────────
    if (sub === "setup") {
      const amount = interaction.options.getInteger("amount");
      const unit = interaction.options.getString("unit");
      const mode = interaction.options.getString("mode") || "random";

      const intervalMinutes = unit === "minutes" ? amount : amount * 60;

      await pool.query(
        `INSERT INTO server_autochange (guild_id, interval_minutes, rotation_mode) VALUES ($1, $2, $3)
         ON CONFLICT (guild_id) DO UPDATE SET interval_minutes = $2, rotation_mode = $3`,
        [guildId, intervalMinutes, mode]
      );

      const embed = new EmbedBuilder()
        .setColor(0x7c7ce0)
        .setTitle(`${E.settings} Server Autochange Configured`)
        .setDescription(`Rotations will occur every **${intervalMinutes} minute${intervalMinutes !== 1 ? "s" : ""}** in **${mode}** mode.`)
        .setFooter({ text: "Chrxmaticc AI · 炫克人工智能" });

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ─── TOGGLE ────────────────────────────────
    if (sub === "toggle") {
      const state = interaction.options.getString("state") === "on";
      await pool.query(
        `INSERT INTO server_autochange (guild_id, enabled) VALUES ($1, $2)
         ON CONFLICT (guild_id) DO UPDATE SET enabled = $2`,
        [guildId, state]
      );
      return interaction.reply({ content: `${E.success} Server autochange is now **${state ? "enabled" : "disabled"}**.`, ephemeral: true });
    }

    // ─── ASSET MANAGEMENT (same as before) ────
    async function manageAsset(type, valueGetter) {
      const action = interaction.options.getString("action");
      const config = await getConfig();
      let assets = config[type] || [];
      const value = valueGetter();

      if (action === "add") {
        if (!value) return interaction.reply({ content: `${E.error} You must provide a value.`, ephemeral: true });
        if (assets.length >= 24) return interaction.reply({ content: `${E.error} Maximum 24 entries per category reached.`, ephemeral: true });
        assets.push(value);
        await pool.query(`UPDATE server_autochange SET ${type} = $1 WHERE guild_id = $2`, [JSON.stringify(assets), guildId]);
        return interaction.reply({ content: `${E.success} Added to **${type}** list (total: ${assets.length}).`, ephemeral: true });
      }

      if (action === "list") {
        if (!assets.length) return interaction.reply({ content: `No ${type} items configured.`, ephemeral: true });
        const embed = new EmbedBuilder()
          .setColor(0x7c7ce0)
          .setTitle(`${E.ai} Server ${type} List`)
          .setDescription(assets.map((a, i) => `**${i + 1}.** ${a}`).join("\n"))
          .setFooter({ text: "Chrxmaticc AI · 炫克人工智能" });
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      if (action === "remove") {
        if (!value) return interaction.reply({ content: `${E.error} You must provide the exact value to remove.`, ephemeral: true });
        const index = assets.indexOf(value);
        if (index === -1) return interaction.reply({ content: `${E.error} That value was not found.`, ephemeral: true });
        assets.splice(index, 1);
        await pool.query(`UPDATE server_autochange SET ${type} = $1 WHERE guild_id = $2`, [JSON.stringify(assets), guildId]);
        return interaction.reply({ content: `${E.success} Removed from **${type}** list.`, ephemeral: true });
      }
    }

    if (sub === "icon" || sub === "banner") {
      const action = interaction.options.getString("action");
      const config = await getConfig();
      const type = sub === "icon" ? "icons" : "banners";
      let assets = config[type] || [];

      if (action === "add") {
        const url = interaction.options.getString("url");
        const attachment = interaction.options.getAttachment("image");
        const value = attachment ? attachment.url : url;
        if (!value) return interaction.reply({ content: `${E.error} You must provide either a URL or upload an image.`, ephemeral: true });
        if (assets.length >= 24) return interaction.reply({ content: `${E.error} Maximum 24 entries per category reached.`, ephemeral: true });
        assets.push(value);
        await pool.query(`UPDATE server_autochange SET ${type} = $1 WHERE guild_id = $2`, [JSON.stringify(assets), guildId]);
        return interaction.reply({ content: `${E.success} Added to **${type}** list (total: ${assets.length}).`, ephemeral: true });
      }

      return manageAsset(type, () => interaction.options.getString("url") || "");
    }

    if (sub === "name" || sub === "description") {
      const type = sub === "name" ? "names" : "descriptions";
      return manageAsset(type, () => interaction.options.getString("text"));
    }

    // ─── CHANNEL RENAME (same as before) ────
    if (sub === "channel-rename") {
      const channel = interaction.options.getChannel("channel");
      const action = interaction.options.getString("action");
      const config = await getConfig();
      let channelRenames = config.channel_renames || {};
      const channelId = channel.id;

      if (action === "add") {
        const text = interaction.options.getString("text");
        if (!text) return interaction.reply({ content: `${E.error} You must provide a name.`, ephemeral: true });
        if (!channelRenames[channelId]) channelRenames[channelId] = [];
        if (channelRenames[channelId].length >= 24) return interaction.reply({ content: `${E.error} Max 24 names per channel.`, ephemeral: true });
        channelRenames[channelId].push(text);
        await pool.query(`UPDATE server_autochange SET channel_renames = $1 WHERE guild_id = $2`, [JSON.stringify(channelRenames), guildId]);
        return interaction.reply({ content: `${E.success} Added to ${channel} rename list.`, ephemeral: true });
      }

      if (action === "list") {
        const names = channelRenames[channelId] || [];
        if (!names.length) return interaction.reply({ content: `No rename entries for ${channel}.`, ephemeral: true });
        const embed = new EmbedBuilder()
          .setColor(0x7c7ce0)
          .setTitle(`Renames for ${channel.name}`)
          .setDescription(names.map((n, i) => `**${i+1}.** ${n}`).join("\n"))
          .setFooter({ text: "Chrxmaticc AI · 炫克人工智能" });
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      if (action === "remove") {
        const text = interaction.options.getString("text");
        if (!text) return interaction.reply({ content: `${E.error} You must provide the exact name to remove.`, ephemeral: true });
        const arr = channelRenames[channelId] || [];
        const index = arr.indexOf(text);
        if (index === -1) return interaction.reply({ content: `${E.error} Name not found.`, ephemeral: true });
        arr.splice(index, 1);
        channelRenames[channelId] = arr;
        await pool.query(`UPDATE server_autochange SET channel_renames = $1 WHERE guild_id = $2`, [JSON.stringify(channelRenames), guildId]);
        return interaction.reply({ content: `${E.success} Removed from ${channel} rename list.`, ephemeral: true });
      }
    }

    // ─── FORCE ROTATION ──────────────────────
    if (sub === "force") {
      await interaction.deferReply({ ephemeral: true });

      const config = await getConfig();
      const rotationMode = config.rotation_mode || "random";
      const sequenceState = config.sequence_state || {};

      function pickNext(items, category) {
        if (!items.length) return null;
        if (rotationMode === "sequential") {
          const lastIndex = sequenceState[category] ?? -1;
          const nextIndex = (lastIndex + 1) % items.length;
          sequenceState[category] = nextIndex;
          return items[nextIndex];
        } else {
          return items[Math.floor(Math.random() * items.length)];
        }
      }

      const names = config.names || [];
      const icons = config.icons || [];
      const banners = config.banners || [];
      const descriptions = config.descriptions || [];
      const channelRenames = config.channel_renames || {};

      const applied = [];

      if (names.length) {
        const chosen = pickNext(names, "names");
        if (chosen) {
          try { await guild.setName(chosen); applied.push(`Name → ${chosen}`); } catch {}
        }
      }

      if (icons.length) {
        const chosen = pickNext(icons, "icons");
        if (chosen) {
          try {
            const res = await fetch(chosen);
            const buffer = Buffer.from(await res.arrayBuffer());
            const base64 = `data:${res.headers.get('content-type')};base64,${buffer.toString('base64')}`;
            await guild.setIcon(buffer);
            applied.push("Icon rotated");
          } catch {}
        }
      }

      if (banners.length) {
        const chosen = pickNext(banners, "banners");
        if (chosen) {
          try {
            const res = await fetch(chosen);
            const buffer = Buffer.from(await res.arrayBuffer());
            const base64 = `data:${res.headers.get('content-type')};base64,${buffer.toString('base64')}`;
            await guild.setBanner(buffer);
            applied.push("Banner rotated");
          } catch {}
        }
      }

      if (descriptions.length && guild.features.includes('COMMUNITY')) {
        const chosen = pickNext(descriptions, "descriptions");
        if (chosen) {
          try { await guild.setDescription(chosen); applied.push(`Description → ${chosen}`); } catch {}
        }
      }

      for (const [channelId, nameList] of Object.entries(channelRenames)) {
        if (nameList.length === 0) continue;
        const channel = guild.channels.cache.get(channelId);
        if (!channel) continue;
        const chosen = pickNext(nameList, `channel_${channelId}`);
        if (chosen) {
          try { await channel.setName(chosen); applied.push(`Channel ${channel.name} → ${chosen}`); } catch {}
        }
      }

      // Update state & last_change so scheduler doesn't immediately rotate again
      await pool.query(
        `UPDATE server_autochange SET sequence_state = $1, last_change = NOW() WHERE guild_id = $2`,
        [JSON.stringify(sequenceState), guild.id]
      );

      const embed = new EmbedBuilder()
        .setColor(0x7c7ce0)
        .setTitle(`${E.crown} Forced Rotation Complete`)
        .setDescription(applied.length ? applied.map(x => `• ${x}`).join("\n") : "No assets configured to rotate.")
        .setFooter({ text: "Chrxmaticc AI · 炫克人工智能" });

      return interaction.editReply({ embeds: [embed] });
    }

    // ─── STATUS ────────────────────────────────
    if (sub === "status") {
      const config = await getConfig();
      const intervalMinutes = config.interval_minutes || 1440;
      const intervalDisplay = intervalMinutes < 60 ? `${intervalMinutes} min` : `${intervalMinutes / 60} hr`;

      const embed = new EmbedBuilder()
        .setColor(0x7c7ce0)
        .setTitle(`${E.link} Server Autochange Status`)
        .addFields(
          { name: "Enabled", value: config.enabled ? "Yes" : "No", inline: true },
          { name: "Interval", value: intervalDisplay, inline: true },
          { name: "Mode", value: config.rotation_mode || "random", inline: true },
          { name: "Names", value: `${(config.names || []).length}`, inline: true },
          { name: "Icons", value: `${(config.icons || []).length}`, inline: true },
          { name: "Banners", value: `${(config.banners || []).length}`, inline: true },
          { name: "Descriptions", value: `${(config.descriptions || []).length}`, inline: true },
          { name: "Channel Renames", value: `${Object.keys(config.channel_renames || {}).length}`, inline: true },
          { name: "Last Change", value: config.last_change ? `<t:${Math.floor(new Date(config.last_change).getTime()/1000)}:R>` : "Never", inline: true }
        )
        .setFooter({ text: "Chrxmaticc AI · 炫克人工智能" });
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};
