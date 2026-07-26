const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

const E = {
  success: "<:Verified_Icon:1527194184841167010>",
  error: "<:no:1530373946795364362>",
  crown: "<:Holographic_owner_crown:1527401510487461969>",
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("temperature")
    .setDescription("set your AI creativity level (Premium only)")
    .addNumberOption(opt =>
      opt.setName("value")
        .setDescription("0.1 = safe, 2.0 = wild")
        .setRequired(true)
        .setMinValue(0.1)
        .setMaxValue(2.0)
    ),

  async execute(interaction, client) {
    const pool = client.pool;
    const userId = interaction.user.id;

    // Check premium status
    const premium = await pool.query(
      `SELECT premium_type, expires_at FROM user_premium WHERE user_id = $1`,
      [userId]
    );
    if (!premium.rows[0]) {
      return interaction.reply({
        content: `${E.error} this is a **Premium** feature. save up 1,000 merits for 1 month or 3,000 for forever, to buy premium, join the offical support server /chrxmaticc to buy premium`,
        ephemeral: true,
      });
    }

    const { premium_type, expires_at } = premium.rows[0];
    const isForever = premium_type === "forever";
    const isExpired = !isForever && expires_at && new Date(expires_at) < new Date();
    if (isExpired) {
      await pool.query(`DELETE FROM user_premium WHERE user_id = $1`, [userId]);
      return interaction.reply({
        content: `${E.error} your premium has expired lil bro.`,
        ephemeral: true,
      });
    }

    // Update temperature
    const value = interaction.options.getNumber("value");
    await pool.query(`UPDATE user_premium SET temperature = $1 WHERE user_id = $2`, [value, userId]);

    // Detailed embed (like help)
    const embed = new EmbedBuilder()
      .setColor(0x7c7ce0)                // Periwinkle
      .setTitle(`${E.crown} temperature updated lil bro.`)
      .setDescription(`your AI temperature is now **${value}**.`)
      .setThumbnail(client.user.displayAvatarURL())   // Bot's avatar
      .addFields({
        name: "what does this do exactly?",
        value: "a higher temperature makes the AI more creative and unpredictable, a lower temperature makes it more focused and consistent.",
        inline: false
      })
      .setFooter({ text: "Chrxmaticc AI · 炫克人工智能" })
      .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
