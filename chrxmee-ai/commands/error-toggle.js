const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require("discord.js");

const E = {
  success: "<:Verified_Icon:1527194184841167010>",
  error: "<:no:1530373946795364362>",
  settings: "<:Settings:1525601248278216725>",
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("error-toggle")
    .setDescription("Choose whether error messages show the support server link")
    .addStringOption(opt =>
      opt.setName("mode")
        .setDescription("on = show link, off = hide it")
        .setRequired(true)
        .addChoices(
          { name: "On (show link)", value: "on" },
          { name: "Off (hide link)", value: "off" }
        )),

  async execute(interaction, client) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: `${E.error} you need admin permissions.`, ephemeral: true });
    }

    const mode = interaction.options.getString("mode") === "on";
    const pool = client.pool;
    const guildId = interaction.guildId;

    await pool.query(
      `INSERT INTO guild_settings (guild_id, show_support_link) VALUES ($1, $2)
       ON CONFLICT (guild_id) DO UPDATE SET show_support_link = $2`,
      [guildId, mode]
    );

    const embed = new EmbedBuilder()
      .setColor(0x7c7ce0)
      .setTitle(`${E.settings} Error Messages`)
      .setDescription(`Support link will **${mode ? "be shown" : "not be shown"}** in error messages.`)
      .setFooter({ text: "Chrxmaticc AI · 炫克人工智能" });

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
