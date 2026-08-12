const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require("discord.js");

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
    .setDescription("Automatically rotate this server's bot customization")
    .addSubcommand(sub => sub.setName("setup")
      .setDescription("Set the rotation interval")
      .addStringOption(opt => opt.setName("interval").setDescription("How often to rotate").setRequired(true)
        .addChoices(
          { name: "1 hour", value: "1" },
          { name: "3 hours", value: "3" },
          { name: "6 hours", value: "6" },
          { name: "12 hours", value: "12" },
          { name: "24 hours", value: "24" },
          { name: "Custom", value: "custom" }
        ))
      .addIntegerOption(opt => opt.setName("custom_hours").setDescription("Custom hours (if interval = custom)").setRequired(false).setMinValue(1).setMaxValue(8760)))
    .addSubcommand(sub => sub.setName("toggle")
      .setDescription("Enable or disable auto rotation")
      .addStringOption(opt => opt.setName("state").setDescription("On or Off").setRequired(true)
        .addChoices({ name: "On", value: "on" }, { name: "Off", value: "off" })))
    // Asset subcommands
    .addSubcommand(sub => sub.setName("avatar")
      .setDescription("Manage autochange avatars")
      .addStringOption(opt => opt.setName("action").setDescription("Add, list, or remove").setRequired(true)
        .addChoices({ name: "Add", value: "add" }, { name: "List", value: "list" }, { name: "Remove", value: "remove" }))
      .addStringOption(opt => opt.setName("url").setDescription("Image URL (only for add)").setRequired(false)))
    .addSubcommand(sub => sub.setName("banner")
      .setDescription("Manage autochange banners")
      .addStringOption(opt => opt.setName("action").setDescription("Add, list, or remove").setRequired(true)
        .addChoices({ name: "Add", value: "add" }, { name: "List", value: "list" }, { name: "Remove", value: "remove" }))
      .addStringOption(opt => opt.setName("url").setDescription("Image URL (only for add)").setRequired(false)))
    .addSubcommand(sub => sub.setName("nickname")
      .setDescription("Manage autochange nicknames")
      .addStringOption(opt => opt.setName("action").setDescription("Add, list, or remove").setRequired(true)
        .addChoices({ name: "Add", value: "add" }, { name: "List", value: "list" }, { name: "Remove", value: "remove" }))
      .addStringOption(opt => opt.setName("text").setDescription("Nickname text (only for add)").setRequired(false)))
    .addSubcommand(sub => sub.setName("bio")
      .setDescription("Manage autochange bios")
      .addStringOption(opt => opt.setName("action").setDescription("Add, list, or remove").setRequired(true)
        .addChoices({ name: "Add", value: "add" }, { name: "List", value: "list" }, { name: "Remove", value: "remove" }))
      .addStringOption(opt => opt.setName("text").setDescription("Bio text (only for add)").setRequired(false)))
    .addSubcommand(sub => sub.setName("status")
      .setDescription("View current autochange configuration")),

  async execute(interaction, client) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: `${E.error} You need Administrator permissions.`, ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();
    const pool = client.pool;
    const guildId = interaction.guildId;

    // Helper to get config or create
    async function getConfig() {
      const res = await pool.query(`SELECT * FROM autochange_config WHERE guild_id = $1`, [guildId]);
      if (!res.rows[0]) {
        await pool.query(`INSERT INTO autochange_config (guild_id) VALUES ($1)`, [guildId]);
        return (await pool.query(`SELECT * FROM autochange_config WHERE guild_id = $1`, [guildId])).rows[0];
      }
      return res.rows[0];
    }

    // ─── SETUP ──────────────────────────────────
    if (sub === "setup") {
      const interval = interaction.options.getString("interval");
      const customHours = interaction.options.getInteger("custom_hours");
      const hours = interval === "custom" ? (customHours || 24) : parseInt(interval);

      await pool.query(
        `INSERT INTO autochange_config (guild_id, interval_hours) VALUES ($1, $2)
         ON CONFLICT (guild_id) DO UPDATE SET interval_hours = $2`,
        [guildId, hours]
      );

      const embed = new EmbedBuilder()
        .setColor(0x7c7ce0)
        .setTitle(`${E.settings} Autochange Interval Set`)
        .setDescription(`Rotations will occur every **${hours} hour${hours > 1 ? "s" : ""}**.`)
        .setFooter({ text: "Chrxmaticc AI · 炫克人工智能" });

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ─── TOGGLE ────────────────────────────────
    if (sub === "toggle") {
      const state = interaction.options.getString("state") === "on";
      await pool.query(
        `INSERT INTO autochange_config (guild_id, enabled) VALUES ($1, $2)
         ON CONFLICT (guild_id) DO UPDATE SET enabled = $2`,
        [guildId, state]
      );
      return interaction.reply({ content: `${E.success} Autochange is now **${state ? "enabled" : "disabled"}**.`, ephemeral: true });
    }

    // ─── ASSET MANAGEMENT (avatar/banner/nickname/bio) ──
    async function manageAsset(type) {
      const action = interaction.options.getString("action");
      const config = await getConfig();
      let assets = config[type] || [];
      const value = type === "avatar" || type === "banner" ? interaction.options.getString("url") : interaction.options.getString("text");

      if (action === "add") {
        if (!value) return interaction.reply({ content: `${E.error} You must provide a value to add.`, ephemeral: true });
        assets.push(value);
        await pool.query(`UPDATE autochange_config SET ${type} = $1 WHERE guild_id = $2`, [JSON.stringify(assets), guildId]);
        return interaction.reply({ content: `${E.success} Added to **${type}** list (total: ${assets.length}).`, ephemeral: true });
      }

      if (action === "list") {
        if (!assets.length) return interaction.reply({ content: `No ${type} items configured.`, ephemeral: true });
        const embed = new EmbedBuilder()
          .setColor(0x7c7ce0)
          .setTitle(`${E.ai} Autochange ${type} List`)
          .setDescription(assets.map((a, i) => `**${i + 1}.** ${a}`).join("\n"))
          .setFooter({ text: "Chrxmaticc AI · 炫克人工智能" });
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      if (action === "remove") {
        if (!value) return interaction.reply({ content: `${E.error} You must provide the exact value to remove.`, ephemeral: true });
        const index = assets.indexOf(value);
        if (index === -1) return interaction.reply({ content: `${E.error} That value was not found.`, ephemeral: true });
        assets.splice(index, 1);
        await pool.query(`UPDATE autochange_config SET ${type} = $1 WHERE guild_id = $2`, [JSON.stringify(assets), guildId]);
        return interaction.reply({ content: `${E.success} Removed from **${type}** list.`, ephemeral: true });
      }
    }

    if (sub === "avatar" || sub === "banner" || sub === "nickname" || sub === "bio") {
      return manageAsset(sub);
    }

    // ─── STATUS ────────────────────────────────
    if (sub === "status") {
      const config = await getConfig();
      const embed = new EmbedBuilder()
        .setColor(0x7c7ce0)
        .setTitle(`${E.link} Autochange Status`)
        .addFields(
          { name: "Enabled", value: config.enabled ? "Yes" : "No", inline: true },
          { name: "Interval", value: `${config.interval_hours}h`, inline: true },
          { name: "Avatars", value: `${(config.avatars || []).length}`, inline: true },
          { name: "Banners", value: `${(config.banners || []).length}`, inline: true },
          { name: "Nicknames", value: `${(config.nicknames || []).length}`, inline: true },
          { name: "Bios", value: `${(config.bios || []).length}`, inline: true },
          { name: "Last Change", value: config.last_change ? `<t:${Math.floor(new Date(config.last_change).getTime()/1000)}:R>` : "Never", inline: true }
        )
        .setFooter({ text: "Chrxmaticc AI · 炫克人工智能" });
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};
