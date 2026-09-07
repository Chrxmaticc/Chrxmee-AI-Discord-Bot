const { EmbedBuilder } = require("discord.js");

const E = {
  success: "<:Verified_Icon:1527194184841167010>",
  ai: "<:Chrxmaticc_AI:1480094799292928132>",
  sleep: "<:hello_kitty_hide:1530376139854577735>",
};

module.exports = {
  name: "messageCreate",
  async execute(message) {
    if (message.author.bot || !message.guild) return;

    const client = message.client;
    const pool = client.pool;
    if (!pool) return;

    const userId = message.author.id;
    const guildId = message.guildId;

    // 1. Auto-remove AFK if the author is AFK
    const userAfk = await pool.query(
      `SELECT reason FROM afk_users WHERE user_id = $1 AND guild_id = $2`,
      [userId, guildId]
    );
    if (userAfk.rows.length > 0) {
      await pool.query(`DELETE FROM afk_users WHERE user_id = $1 AND guild_id = $2`, [userId, guildId]);
      const prefs = await pool.query(`SELECT return_message, return_type FROM afk_prefs WHERE user_id=$1 AND guild_id=$2`, [userId, guildId]);
      const retMsg = prefs.rows[0]?.return_message || "welcome back!";
      const retType = prefs.rows[0]?.return_type || "embed";

      if (retType === "text") {
        await message.channel.send({ content: `${message.author}, ${retMsg}` }).catch(() => {});
      } else {
        const embed = new EmbedBuilder()
          .setColor(0x7c7ce0)
          .setTitle(`${E.success} afk removed`)
          .setDescription(`${message.author}, ${retMsg}`)
          .setTimestamp();
        await message.channel.send({ embeds: [embed] }).catch(() => {});
      }
    }

    // 2. Reply if an AFK user is mentioned
    const mentionedUsers = message.mentions.users.filter(u => !u.bot);
    for (const user of mentionedUsers.values()) {
      const res = await pool.query(
        `SELECT reason FROM afk_users WHERE user_id = $1 AND guild_id = $2`,
        [user.id, guildId]
      );
      if (res.rows.length > 0) {
        const prefs = await pool.query(`SELECT away_message, away_type FROM afk_prefs WHERE user_id=$1 AND guild_id=$2`, [user.id, guildId]);
        const awayMsg = prefs.rows[0]?.away_message || res.rows[0].reason;
        const awayType = prefs.rows[0]?.away_type || "embed";

        if (awayType === "text") {
          await message.channel.send({ content: `${user.username} is afk: ${awayMsg}` }).catch(() => {});
        } else {
          const embed = new EmbedBuilder()
            .setColor(0x7c7ce0)
            .setTitle(`${E.sleep} ${user.username} is afk`)
            .setDescription(awayMsg)
            .setTimestamp();
          await message.channel.send({ embeds: [embed] }).catch(() => {});
        }
      }
    }
  },
};
