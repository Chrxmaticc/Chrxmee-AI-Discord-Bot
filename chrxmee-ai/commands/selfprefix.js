const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

const E = {
  success: "<:Verified_Icon:1527194184841167010>",
  error: "<:no:1530373946795364362>",
  ai: "<:Chrxmaticc_AI:1480094799292928132>",
  crown: "<:Holographic_owner_crown:1527401510487461969>",
  agree: "<:agreed:1525639597135237131>",
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("selfprefix")
    .setDescription("set your personal prefix (premium only)")
    .addSubcommand(sub =>
      sub.setName("set")
        .setDescription("set your personal prefix")
        .addStringOption(opt => opt.setName("prefix").setDescription("new prefix (max 5 chars)").setRequired(true).setMaxLength(5))
    )
    .addSubcommand(sub =>
      sub.setName("remove")
        .setDescription("remove your personal prefix")
    )
    .addSubcommand(sub =>
      sub.setName("info")
        .setDescription("show your current personal prefix")
    ),

  async execute(interaction) {
    const isButtonSim = interaction.isButton && interaction.isButton();
    if (!isButtonSim) { try { await interaction.deferReply(); } catch {} }

    const pool = interaction.client.pool;
    const userId = interaction.user.id;

    // check personal premium
    const premiumRes = await pool.query(
      `SELECT 1 FROM user_premium WHERE user_id = $1 AND server_id IS NULL
       AND (premium_type = 'forever' OR expires_at > NOW())`,
      [userId]
    );
    if (premiumRes.rows.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle(`${E.error} premium required`)
        .setDescription(`${E.angry} you need active personal premium to use self prefix.`);
      return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
    }

    const sub = interaction.options.getSubcommand();

    if (sub === "set") {
      const prefix = interaction.options.getString("prefix");
      await pool.query(
        `INSERT INTO self_prefixes (user_id, prefix) VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET prefix = $2`,
        [userId, prefix]
      );
      const embed = new EmbedBuilder()
        .setColor(0x7c7ce0)
        .setTitle(`${E.success} self prefix set`)
        .setDescription(`${E.agree} your personal prefix is now **${prefix}**`)
        .setFooter({ text: "works in every server chromed is in" });
      return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
    }

    if (sub === "remove") {
      await pool.query(`DELETE FROM self_prefixes WHERE user_id = $1`, [userId]);
      const embed = new EmbedBuilder()
        .setColor(0x7c7ce0)
        .setTitle(`${E.success} self prefix removed`)
        .setDescription(`${E.agree} you're back to server prefixes.`);
      return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
    }

    if (sub === "info") {
      const res = await pool.query(`SELECT prefix FROM self_prefixes WHERE user_id = $1`, [userId]);
      const current = res.rows[0]?.prefix || "not set";
      const embed = new EmbedBuilder()
        .setColor(0x7c7ce0)
        .setTitle(`${E.ai} your self prefix`)
        .setDescription(`current: **${current}**`)
        .setFooter({ text: "premium perk" });
      return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
    }
  },
};
