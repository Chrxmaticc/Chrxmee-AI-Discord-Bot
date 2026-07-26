const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

const E = {
  success: "<:Verified_Icon:1527194184841167010>",
  error: "<:no:1530373946795364362>",
  ai: "<:Chrxmaticc_AI:1480094799292928132>",
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("customcmd")
    .setDescription("Manage custom server commands")
    .addSubcommand(sub =>
      sub.setName("create")
        .setDescription("Create a simple text trigger")
        .addStringOption(opt =>
          opt.setName("name").setDescription("Trigger word (no spaces)").setRequired(true).setMaxLength(32))
        .addStringOption(opt =>
          opt.setName("response").setDescription("What the bot replies").setRequired(true).setMaxLength(2000))
    )
    .addSubcommand(sub =>
      sub.setName("create-rich")
        .setDescription("Create a rich command with embed & buttons")
        .addStringOption(opt =>
          opt.setName("name").setDescription("Trigger word (no spaces)").setRequired(true).setMaxLength(32))
        .addStringOption(opt =>
          opt.setName("code").setDescription("Use {user}, {server}, {button}[Label](URL), {newline}, {random:...}, {color=#hex}").setRequired(true).setMaxLength(2000))
    )
    .addSubcommand(sub =>
      sub.setName("delete")
        .setDescription("Delete a custom command")
        .addStringOption(opt =>
          opt.setName("name").setDescription("Command name to delete").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("list")
        .setDescription("List all custom commands in this server")
    ),

  async execute(interaction, client) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: `${E.error} You need Administrator permissions.`, ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const pool = client.pool;

    // ─── CREATE SIMPLE ────────────────────────
    if (sub === "create") {
      const name = interaction.options.getString("name").toLowerCase().replace(/\s+/g, "_");
      const response = interaction.options.getString("response");

      try {
        await pool.query(
          `INSERT INTO custom_commands (guild_id, name, response, type, created_by) VALUES ($1, $2, $3, 'text', $4)`,
          [guildId, name, response, interaction.user.id]
        );
        const embed = new EmbedBuilder()
          .setColor(0x7c7ce0)
          .setTitle(`${E.success} Text command created`)
          .setDescription(`Trigger: **${name}**`)
          .addFields({ name: "Response", value: response.slice(0, 1024) });
        await interaction.reply({ embeds: [embed], ephemeral: true });
      } catch (err) {
        if (err.code === "23505") {
          return interaction.reply({ content: `${E.error} A command with the name \`${name}\` already exists.`, ephemeral: true });
        }
        console.error(err);
        return interaction.reply({ content: `${E.error} Failed to create.`, ephemeral: true });
      }
    }

    // ─── CREATE RICH ──────────────────────────
    if (sub === "create-rich") {
      const name = interaction.options.getString("name").toLowerCase().replace(/\s+/g, "_");
      const code = interaction.options.getString("code");

      try {
        await pool.query(
          `INSERT INTO custom_commands (guild_id, name, response, type, created_by) VALUES ($1, $2, $3, 'rich', $4)`,
          [guildId, name, code, interaction.user.id]
        );
        const embed = new EmbedBuilder()
          .setColor(0x7c7ce0)
          .setTitle(`${E.success} Rich command created`)
          .setDescription(`Trigger: **${name}**`)
          .addFields({ name: "Code", value: code.slice(0, 1024) });
        await interaction.reply({ embeds: [embed], ephemeral: true });
      } catch (err) {
        if (err.code === "23505") {
          return interaction.reply({ content: `${E.error} A command with the name \`${name}\` already exists.`, ephemeral: true });
        }
        console.error(err);
        return interaction.reply({ content: `${E.error} Failed to create.`, ephemeral: true });
      }
    }

    // ─── DELETE ──────────────────────────────
    if (sub === "delete") {
      const name = interaction.options.getString("name").toLowerCase();
      const result = await pool.query(
        `DELETE FROM custom_commands WHERE guild_id = $1 AND name = $2`,
        [guildId, name]
      );
      if (result.rowCount > 0) {
        return interaction.reply({ content: `${E.success} Deleted \`${name}\`.`, ephemeral: true });
      } else {
        return interaction.reply({ content: `${E.error} Command \`${name}\` not found.`, ephemeral: true });
      }
    }

    // ─── LIST ────────────────────────────────
    if (sub === "list") {
      const result = await pool.query(
        `SELECT name, response, type FROM custom_commands WHERE guild_id = $1 ORDER BY name`,
        [guildId]
      );
      if (!result.rows.length) {
        return interaction.reply({ content: "No custom commands in this server yet.", ephemeral: true });
      }
      const embed = new EmbedBuilder()
        .setColor(0x7c7ce0)
        .setTitle(`${E.ai} Custom Commands`)
        .setDescription(
          result.rows.map(r => `**${r.name}** [${r.type}] — ${r.response.slice(0, 50)}${r.response.length > 50 ? "..." : ""}`).join("\n")
        );
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};
