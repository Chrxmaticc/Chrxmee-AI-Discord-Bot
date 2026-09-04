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
  boostHand: "<:Boost_Hand:1545565123949760676>",
  serverBooster: "<:ServerBooster:1545566211704885320>",
  settings: "<:Settings:1525601248278216725>",
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("boost")
    .setDescription("boost rewards system")
    .addSubcommand(sub => sub.setName("setup").setDescription("(admin) enable/disable boost system")
      .addBooleanOption(opt => opt.setName("enabled").setDescription("enable or disable").setRequired(true))
    )
    .addSubcommand(sub => sub.setName("toggle-rewards").setDescription("(admin) toggle additional rewards")
      .addBooleanOption(opt => opt.setName("enabled").setDescription("enable or disable rewards").setRequired(true))
    )
    .addSubcommand(sub => sub.setName("add-reward").setDescription("(admin) add a reward")
      .addStringOption(opt => opt.setName("type").setDescription("reward type").setRequired(true)
        .addChoices(
          { name: "message", value: "message" },
          { name: "role", value: "role" }
        ))
      .addStringOption(opt => opt.setName("value").setDescription("channel id (for message) or role id (for role)").setRequired(true))
    )
    .addSubcommand(sub => sub.setName("remove-reward").setDescription("(admin) remove a reward")
      .addStringOption(opt => opt.setName("type").setDescription("reward type").setRequired(true)
        .addChoices(
          { name: "message", value: "message" },
          { name: "role", value: "role" }
        ))
    )
    .addSubcommand(sub => sub.setName("list").setDescription("view boost settings and rewards")
    )
    .addSubcommand(sub => sub.setName("customize").setDescription("customize your personal boost role")
      .addStringOption(opt => opt.setName("name").setDescription("new role name").setRequired(false))
      .addStringOption(opt => opt.setName("color").setDescription("hex color (e.g. #ff0000)").setRequired(false))
    ),

  async execute(interaction) {
    const isButtonSim = interaction.isButton && interaction.isButton();
    if (!isButtonSim) {
      try { await interaction.deferReply(); } catch {}
    }

    const pool = interaction.client.pool;
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const guild = interaction.guild;

    const sendEmbed = async (title, description, color = 0x7c7ce0) => {
      const embed = new EmbedBuilder().setColor(color).setTitle(title).setDescription(description);
      return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
    };

    const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);

    try {
      // ADMIN SETUP
      if (sub === "setup") {
        if (!isAdmin) return sendEmbed(`${E.error} admin only`, `${E.angry} you need administrator permission.`, 0xff0000);
        const enabled = interaction.options.getBoolean("enabled");
        await pool.query(
          `INSERT INTO boost_settings (guild_id, enabled) VALUES ($1, $2)
           ON CONFLICT (guild_id) DO UPDATE SET enabled = $2`,
          [guildId, enabled]
        );
        return sendEmbed(`${E.settings} boost system ${enabled ? "enabled" : "disabled"}`, `${E.success} boost rewards system is now ${enabled ? "on" : "off"}.`);
      }

      // ADMIN TOGGLE REWARDS
      if (sub === "toggle-rewards") {
        if (!isAdmin) return sendEmbed(`${E.error} admin only`, `${E.angry} you need administrator permission.`, 0xff0000);
        const enabled = interaction.options.getBoolean("enabled");
        await pool.query(
          `UPDATE boost_settings SET rewards_enabled = $1 WHERE guild_id = $2`,
          [enabled, guildId]
        );
        return sendEmbed(`${E.settings} rewards ${enabled ? "enabled" : "disabled"}`, `${E.success} additional boost rewards are now ${enabled ? "on" : "off"}.`);
      }

      // ADMIN ADD REWARD
      if (sub === "add-reward") {
        if (!isAdmin) return sendEmbed(`${E.error} admin only`, `${E.angry} you need administrator permission.`, 0xff0000);
        const type = interaction.options.getString("type");
        const value = interaction.options.getString("value");
        await pool.query(
          `INSERT INTO boost_rewards (guild_id, reward_type, reward_value) VALUES ($1, $2, $3)
           ON CONFLICT (guild_id, reward_type) DO UPDATE SET reward_value = $3`,
          [guildId, type, value]
        );
        return sendEmbed(`${E.success} reward added`, `${E.agree} ${type} reward set to ${value}.`);
      }

      // ADMIN REMOVE REWARD
      if (sub === "remove-reward") {
        if (!isAdmin) return sendEmbed(`${E.error} admin only`, `${E.angry} you need administrator permission.`, 0xff0000);
        const type = interaction.options.getString("type");
        await pool.query(
          `DELETE FROM boost_rewards WHERE guild_id = $1 AND reward_type = $2`,
          [guildId, type]
        );
        return sendEmbed(`${E.success} reward removed`, `${E.agree} ${type} reward removed.`);
      }

      // LIST SETTINGS
      if (sub === "list") {
        const settingsRes = await pool.query(`SELECT * FROM boost_settings WHERE guild_id = $1`, [guildId]);
        const rewardsRes = await pool.query(`SELECT * FROM boost_rewards WHERE guild_id = $1`, [guildId]);
        const settings = settingsRes.rows[0] || { enabled: false, rewards_enabled: true };

        const embed = new EmbedBuilder()
          .setColor(0x7c7ce0)
          .setTitle(`${E.serverBooster} boost system config`)
          .addFields(
            { name: "enabled", value: settings.enabled ? "✅ yes" : "❌ no", inline: true },
            { name: "rewards enabled", value: settings.rewards_enabled ? "✅ yes" : "❌ no", inline: true },
            { name: "rewards", value: rewardsRes.rows.length ? rewardsRes.rows.map(r => `${r.reward_type}: ${r.reward_value}`).join("\n") : "none", inline: false }
          )
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }

      // USER CUSTOMIZE
      if (sub === "customize") {
        const boostRoleRes = await pool.query(
          `SELECT role_id FROM boost_roles WHERE guild_id = $1 AND user_id = $2`,
          [guildId, userId]
        );
        if (!boostRoleRes.rows[0]) {
          return sendEmbed(`${E.error} no boost role`, `${E.angry} you don't have a boost role. boost the server first!`, 0xff0000);
        }

        const roleId = boostRoleRes.rows[0].role_id;
        const role = guild.roles.cache.get(roleId);
        if (!role) {
          return sendEmbed(`${E.error} role missing`, `${E.angry} your boost role was deleted. contact an admin.`, 0xff0000);
        }

        const newName = interaction.options.getString("name");
        const newColor = interaction.options.getString("color");

        const updateData = {};
        if (newName) updateData.name = newName.slice(0, 100);
        if (newColor) {
          const hex = newColor.startsWith('#') ? newColor : `#${newColor}`;
          if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
            return sendEmbed(`${E.error} invalid color`, `${E.angry} color must be a valid hex like #ff0000.`, 0xff0000);
          }
          updateData.color = hex;
        }

        if (Object.keys(updateData).length === 0) {
          return sendEmbed(`${E.error} nothing to change`, `${E.angry} provide a name or color to change.`, 0xff0000);
        }

        await role.edit(updateData);

        return sendEmbed(`${E.boostHand} role updated`, `${E.success} your boost role has been updated!`);
      }

      return sendEmbed(`${E.error} unknown`, "unknown subcommand.");
    } catch (err) {
      console.error("[BOOST CMD] Error:", err);
      return sendEmbed(`${E.error} error`, `${E.angry} ${err.message}`, 0xff0000);
    }
  },
};
