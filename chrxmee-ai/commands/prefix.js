const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("prefix")
    .setDescription("Change the bot's prefix for this server")
    .addSubcommand(sub =>
      sub.setName("set")
        .setDescription("Set a new prefix")
        .addStringOption(opt =>
          opt.setName("prefix")
            .setDescription("New prefix (e.g., C!)")
            .setRequired(true)
            .setMaxLength(10)
        )
    )
    .addSubcommand(sub =>
      sub.setName("reset")
        .setDescription("Reset prefix to default !")
    )
    .addSubcommand(sub =>
      sub.setName("view")
        .setDescription("Show current prefix")
    ),

  async execute(interaction, client) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: "You need Administrator permissions.", ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();
    const pool = client.pool;

    if (sub === "set") {
      const newPrefix = interaction.options.getString("prefix");
      await pool.query(
        `INSERT INTO guild_settings (guild_id, prefix) VALUES ($1, $2)
         ON CONFLICT (guild_id) DO UPDATE SET prefix = $2`,
        [interaction.guildId, newPrefix]
      );
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x7c7ce0).setDescription(`✅ Prefix set to **${newPrefix}**`)] });
    }

    if (sub === "reset") {
      await pool.query(`UPDATE guild_settings SET prefix = '!' WHERE guild_id = $1`, [interaction.guildId]);
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x7c7ce0).setDescription("✅ Prefix reset to **!**")] });
    }

    if (sub === "view") {
      const res = await pool.query(`SELECT prefix FROM guild_settings WHERE guild_id = $1`, [interaction.guildId]);
      const prefix = res.rows[0]?.prefix || "!";
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x7c7ce0).setDescription(`Current prefix: **${prefix}**`)] });
    }
  },
};
