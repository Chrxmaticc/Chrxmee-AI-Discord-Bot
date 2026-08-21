const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require("discord.js");

const E = {
  success: "<:Verified_Icon:1527194184841167010>",
  error: "<:no:1530373946795364362>",
  ai: "<:Chrxmaticc_AI:1480094799292928132>",
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("cmdaccess")
    .setDescription("Manage command permissions for roles or users")
    .addSubcommand(sub =>
      sub.setName("allow")
        .setDescription("Allow a command for a role or user")
        .addStringOption(opt => opt.setName("target_type").setDescription("Role or User").setRequired(true)
          .addChoices({ name: "Role", value: "role" }, { name: "User", value: "user" }))
        .addRoleOption(opt => opt.setName("role").setDescription("Role to allow").setRequired(false))
        .addUserOption(opt => opt.setName("user").setDescription("User to allow").setRequired(false))
        .addStringOption(opt => opt.setName("command").setDescription("Command name (or 'all')").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("deny")
        .setDescription("Deny a command for a role or user")
        .addStringOption(opt => opt.setName("target_type").setDescription("Role or User").setRequired(true)
          .addChoices({ name: "Role", value: "role" }, { name: "User", value: "user" }))
        .addRoleOption(opt => opt.setName("role").setDescription("Role to deny").setRequired(false))
        .addUserOption(opt => opt.setName("user").setDescription("User to deny").setRequired(false))
        .addStringOption(opt => opt.setName("command").setDescription("Command name (or 'all')").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("list")
        .setDescription("List all custom command access rules")
        .addStringOption(opt => opt.setName("command").setDescription("Filter by command").setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName("reset")
        .setDescription("Reset access rules for a command or all")
        .addStringOption(opt => opt.setName("command").setDescription("Command name (or 'all')").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("mode")
        .setDescription("Set default behavior for commands without explicit rules")
        .addStringOption(opt => opt.setName("mode").setDescription("Default mode").setRequired(true)
          .addChoices({ name: "Allow All (default)", value: "allow_all" }, { name: "Deny All (except allowed)", value: "deny_all" }))
    ),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: `${E.error} you need administrator permissions.`, ephemeral: true });
    }

    const pool = interaction.client.pool;
    const guildId = interaction.guildId;
    const sub = interaction.options.getSubcommand();

    if (sub === "allow" || sub === "deny") {
      const targetType = interaction.options.getString("target_type");
      const role = interaction.options.getRole("role");
      const user = interaction.options.getUser("user");
      const command = interaction.options.getString("command").toLowerCase();
      const access = sub; // allow or deny

      const targetId = targetType === "role" ? role?.id : user?.id;
      if (!targetId) return interaction.reply({ content: `${E.error} you must specify the ${targetType}.`, ephemeral: true });

      await pool.query(
        `INSERT INTO cmd_access (guild_id, command_name, target_type, target_id, access)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (guild_id, command_name, target_type, target_id)
         DO UPDATE SET access = $5`,
        [guildId, command, targetType, targetId, access]
      );

      const targetName = targetType === "role" ? role.name : user.username;
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x7c7ce0).setDescription(`${E.success} ${access}ed **${targetName}** for command **${command}**.`)] });
    }

    if (sub === "list") {
      const commandFilter = interaction.options.getString("command")?.toLowerCase();
      let query = `SELECT command_name, target_type, target_id, access FROM cmd_access WHERE guild_id = $1`;
      const params = [guildId];
      if (commandFilter) {
        query += ` AND command_name = $2`;
        params.push(commandFilter);
      }
      const res = await pool.query(query, params);
      if (!res.rows.length) return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x7c7ce0).setDescription("No custom command access rules set.")] });

      const lines = res.rows.map(r => {
        const targetStr = r.target_type === "role" ? `<@&${r.target_id}>` : `<@${r.target_id}>`;
        return `\`${r.command_name}\` - ${targetStr} - ${r.access}`;
      }).join("\n");
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x7c7ce0).setTitle("Command Access Rules").setDescription(lines)] });
    }

    if (sub === "reset") {
      const command = interaction.options.getString("command").toLowerCase();
      if (command === "all") {
        await pool.query(`DELETE FROM cmd_access WHERE guild_id = $1`, [guildId]);
        return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x7c7ce0).setDescription(`${E.success} cleared all command access rules.`)] });
      } else {
        await pool.query(`DELETE FROM cmd_access WHERE guild_id = $1 AND command_name = $2`, [guildId, command]);
        return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x7c7ce0).setDescription(`${E.success} cleared access rules for **${command}**.`)] });
      }
    }

    if (sub === "mode") {
      const mode = interaction.options.getString("mode");
      await pool.query(`UPDATE guild_settings SET cmd_default_mode = $1 WHERE guild_id = $2`, [mode, guildId]);
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x7c7ce0).setDescription(`${E.success} default command mode set to **${mode}**.`)] });
    }
  },
};
