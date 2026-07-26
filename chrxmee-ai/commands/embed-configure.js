const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

const E = {
  success: "<:Verified_Icon:1527194184841167010>",
  error: "<:no:1530373946795364362>",
  crown: "<:Holographic_owner_crown:1527401510487461969>",
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("embed-configure")
    .setDescription("customize how the AI sends replies (Premium only)")
    .addSubcommand(sub =>
      sub.setName("toggle")
        .setDescription("turn rich embeds on or off")
        .addStringOption(opt =>
          opt.setName("mode")
            .setDescription("on or off")
            .setRequired(true)
            .addChoices(
              { name: "On", value: "on" },
              { name: "Off", value: "off" }
            )
        )
    )
    .addSubcommand(sub =>
      sub.setName("color")
        .setDescription("set your personal embed colour")
        .addStringOption(opt =>
          opt.setName("hex")
            .setDescription("hex code without # (e.g. ff0000)")
            .setRequired(true)
            .setMaxLength(6)
        )
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
        content: `${E.error} this is a **Premium** feature. Save up 1,000 merits for 1 month or 3,000 for forever!`,
        ephemeral: true,
      });
    }

    const { premium_type, expires_at } = premium.rows[0];
    const isForever = premium_type === "forever";
    const isExpired = !isForever && expires_at && new Date(expires_at) < new Date();
    if (isExpired) {
      await pool.query(`DELETE FROM user_premium WHERE user_id = $1`, [userId]);
      return interaction.reply({
        content: `${E.error} your premium has expired.`,
        ephemeral: true,
      });
    }

    const sub = interaction.options.getSubcommand();

    // ─── TOGGLE ──────────────────────────────
    if (sub === "toggle") {
      const mode = interaction.options.getString("mode") === "on";
      await pool.query(`UPDATE user_premium SET embed_mode = $1 WHERE user_id = $2`, [mode, userId]);

      const embed = new EmbedBuilder()
        .setColor(0x7c7ce0)
        .setTitle(`${E.crown} Embed Mode Updated`)
        .setDescription(`AI replies will now be sent as **${mode ? "rich embeds" : "plain text"}**.`)
        .setThumbnail(client.user.displayAvatarURL())
        .addFields({
          name: "What this means",
          value: mode 
            ? "every AI reply will appear in a beautifully styled embed with your chosen colour and profile picture." 
            : "AI replies will return to normal plain text messages.",
          inline: false
        })
        .setFooter({ text: "Chrxmaticc AI · 炫克人工智能" })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ─── COLOR ──────────────────────────────
    if (sub === "color") {
      const hex = interaction.options.getString("hex").replace("#", "").toLowerCase();
      if (!/^[0-9a-f]{6}$/.test(hex)) {
        return interaction.reply({
          content: `${E.error} invaild colour twin! please genuinely provide a 6‑digit hex code, no rgb, just hex. (e.g. \`ff0000\`).`,
          ephemeral: true,
        });
      }

      await pool.query(`UPDATE user_premium SET embed_color = $1 WHERE user_id = $2`, [hex, userId]);

      const embed = new EmbedBuilder()
        .setColor(parseInt(hex, 16))          // Use the new colour for the preview
        .setTitle(`${E.crown} Embed Colour Updated`)
        .setDescription(`your embed colour is now **#${hex}**.`)
        .setThumbnail(client.user.displayAvatarURL())
        .addFields({
          name: "Preview",
          value: "this is how your AI replies will look from now on. the colour you chose is applied to every embed sent by Chrxmaticc AI just for you twin :D",
          inline: false
        })
        .setFooter({ text: "Chrxmaticc AI · 炫克人工智能" })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};
