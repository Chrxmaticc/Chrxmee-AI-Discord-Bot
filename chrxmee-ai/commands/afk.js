const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

const E = {
  success: "<:Verified_Icon:1527194184841167010>",
  error: "<:no:1530373946795364362>",
  ai: "<:Chrxmaticc_AI:1480094799292928132>",
  agree: "<:agreed:1525639597135237131>",
  angry: "<:angry_cry:1526029511882440744>",
  sleep: "<:hello_kitty_hide:1530376139854577735>",
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("afk")
    .setDescription("set, remove, or customize your afk status")
    .addSubcommand(sub => sub.setName("set").setDescription("set afk with reason")
      .addStringOption(opt => opt.setName("reason").setDescription("why you're afk (uses default if empty)").setRequired(false))
    )
    .addSubcommand(sub => sub.setName("remove").setDescription("remove your afk status"))
    .addSubcommand(sub => sub.setName("check").setDescription("check someone's afk status")
      .addUserOption(opt => opt.setName("user").setDescription("user to check").setRequired(true))
    )
    .addSubcommand(sub => sub.setName("customize").setDescription("set your default afk messages and styles")
      .addStringOption(opt => opt.setName("away").setDescription("default away message when someone mentions you").setRequired(false))
      .addStringOption(opt => opt.setName("return").setDescription("default return message when you come back").setRequired(false))
      .addStringOption(opt => opt.setName("away_style").setDescription("embed or text for away message").setRequired(false)
        .addChoices({ name: "embed", value: "embed" }, { name: "text", value: "text" }))
      .addStringOption(opt => opt.setName("return_style").setDescription("embed or text for return message").setRequired(false)
        .addChoices({ name: "embed", value: "embed" }, { name: "text", value: "text" }))
    ),

  async execute(interaction) {
    const isButtonSim = interaction.isButton && interaction.isButton();
    if (!isButtonSim) {
      try { await interaction.deferReply({ ephemeral: true }); } catch { try { await interaction.deferReply(); } catch {} }
    }

    const pool = interaction.client.pool;
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    const sendEmbed = async (title, description, color = 0x7c7ce0, ephemeral = true) => {
      const embed = new EmbedBuilder().setColor(color).setTitle(title).setDescription(description);
      return interaction.editReply({ embeds: [embed], ephemeral }).catch(() => interaction.followUp({ embeds: [embed], ephemeral }));
    };

    try {
      if (sub === "customize") {
        const away = interaction.options.getString("away");
        const ret = interaction.options.getString("return");
        const awayStyle = interaction.options.getString("away_style");
        const returnStyle = interaction.options.getString("return_style");

        if (!away && !ret && !awayStyle && !returnStyle) {
          return sendEmbed(`${E.error} nothing to set`, `${E.angry} provide at least one setting.`, 0xff0000);
        }

        const existing = await pool.query(`SELECT * FROM afk_prefs WHERE user_id=$1 AND guild_id=$2`, [userId, guildId]);
        if (existing.rows.length === 0) {
          await pool.query(
            `INSERT INTO afk_prefs (user_id, guild_id, away_message, return_message, away_type, return_type)
             VALUES ($1,$2,$3,$4,$5,$6)`,
            [userId, guildId, away || null, ret || null, awayStyle || 'embed', returnStyle || 'embed']
          );
        } else {
          await pool.query(
            `UPDATE afk_prefs
             SET away_message = COALESCE($1, away_message),
                 return_message = COALESCE($2, return_message),
                 away_type = COALESCE($3, away_type),
                 return_type = COALESCE($4, return_type)
             WHERE user_id=$5 AND guild_id=$6`,
            [away, ret, awayStyle, returnStyle, userId, guildId]
          );
        }
        return sendEmbed(`${E.success} afk settings saved`, `${E.agree} your custom afk messages/styles are set.`);
      }

      if (sub === "set") {
        const reason = interaction.options.getString("reason");
        const prefs = await pool.query(`SELECT away_message FROM afk_prefs WHERE user_id=$1 AND guild_id=$2`, [userId, guildId]);
        const awayMsg = reason || prefs.rows[0]?.away_message || "afk";
        await pool.query(
          `INSERT INTO afk_users (user_id, guild_id, reason, since)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (user_id, guild_id)
           DO UPDATE SET reason = $3, since = NOW()`,
          [userId, guildId, awayMsg]
        );
        return sendEmbed(`${E.sleep} afk set`, `${E.success} you're now afk: **${awayMsg}**`);
      }

      if (sub === "remove") {
        const result = await pool.query(
          `DELETE FROM afk_users WHERE user_id = $1 AND guild_id = $2 RETURNING *`,
          [userId, guildId]
        );
        if (result.rows.length === 0) {
          return sendEmbed(`${E.error} not afk`, `${E.angry} you aren't afk.`, 0xff0000);
        }
        const prefs = await pool.query(`SELECT return_message, return_type FROM afk_prefs WHERE user_id=$1 AND guild_id=$2`, [userId, guildId]);
        const retMsg = prefs.rows[0]?.return_message || "welcome back!";
        const retType = prefs.rows[0]?.return_type || "embed";

        if (retType === "text") {
          return interaction.editReply({ content: `${E.success} ${retMsg}`, ephemeral: false });
        } else {
          return interaction.editReply({
            embeds: [new EmbedBuilder().setColor(0x7c7ce0).setTitle(`${E.agree} afk removed`).setDescription(`${E.success} ${retMsg}`)],
            ephemeral: false,
          });
        }
      }

      if (sub === "check") {
        const target = interaction.options.getUser("user");
        const res = await pool.query(
          `SELECT reason, since FROM afk_users WHERE user_id = $1 AND guild_id = $2`,
          [target.id, guildId]
        );
        if (!res.rows[0]) {
          return sendEmbed(`${E.ai} not afk`, `${E.agree} ${target.username} is not afk.`, 0x7c7ce0, false);
        }
        const { reason, since } = res.rows[0];
        const embed = new EmbedBuilder()
          .setColor(0x7c7ce0)
          .setTitle(`${E.sleep} afk status`)
          .setDescription(`${target} is afk: **${reason}**`)
          .addFields({ name: "since", value: `<t:${Math.floor(new Date(since).getTime() / 1000)}:R>`, inline: true })
          .setTimestamp();
        return interaction.editReply({ embeds: [embed], ephemeral: false }).catch(() => interaction.followUp({ embeds: [embed] }));
      }
    } catch (err) {
      console.error("afk command error:", err);
      return sendEmbed(`${E.error} error`, `${E.angry} ${err.message}`, 0xff0000);
    }
  },
};
