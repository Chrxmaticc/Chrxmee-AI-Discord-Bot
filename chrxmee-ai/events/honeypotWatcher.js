module.exports = {
  name: "messageCreate",
  async execute(message) {
    if (message.author.bot) return;
    if (!message.guild) return;

    const client = message.client;
    const pool = client.pool;
    const guild = message.guild;
    const channelId = message.channelId;

    try {
      const res = await pool.query(
        `SELECT * FROM honeypot_config WHERE guild_id = $1 AND enabled = TRUE`,
        [guild.id]
      );
      const config = res.rows[0];
      if (!config || channelId !== config.channel_id) return;

      const member = message.member;
      if (!member) return;
      if (member.permissions.has("ManageMessages") || member.permissions.has("Administrator")) return;

      // get or create strike record
      const strikeRes = await pool.query(
        `SELECT strike_count FROM honeypot_strikes WHERE guild_id = $1 AND channel_id = $2 AND user_id = $3`,
        [guild.id, channelId, message.author.id]
      );

      let strikeCount = strikeRes.rows[0]?.strike_count || 0;
      strikeCount += 1;

      await pool.query(
        `INSERT INTO honeypot_strikes (guild_id, channel_id, user_id, strike_count, last_strike_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (guild_id, channel_id, user_id)
         DO UPDATE SET strike_count = $4, last_strike_at = NOW()`,
        [guild.id, channelId, message.author.id, strikeCount]
      );

      const threshold = config.threshold || 1;

      if (threshold > 1 && strikeCount === 1) {
        // first strike warning
        await message.reply({ content: config.warning_message }).catch(() => {});
        return;
      }

      if (strikeCount >= threshold) {
        // trigger punishment
        const punishment = config.punishment_type;

        if (punishment === "ban") {
          const duration = config.ban_duration_minutes;
          if (duration) {
            await member.ban({ reason: `honeypot triggered` }).catch(() => {});
            setTimeout(async () => {
              await guild.members.unban(message.author.id).catch(() => {});
            }, duration * 60000);
          } else {
            await member.ban({ reason: `honeypot triggered` }).catch(() => {});
          }
          await message.channel.send(config.activation_message).catch(() => {});
        } else if (punishment === "kick") {
          await member.kick(`honeypot triggered`).catch(() => {});
          await message.channel.send(config.activation_message).catch(() => {});
        } else if (punishment === "mute") {
          const minutes = config.mute_minutes || 10;
          await member.timeout(minutes * 60000, `honeypot triggered`).catch(() => {});
          await message.channel.send(config.activation_message).catch(() => {});
        }

        // reset strikes after punishment
        await pool.query(
          `DELETE FROM honeypot_strikes WHERE guild_id = $1 AND channel_id = $2 AND user_id = $3`,
          [guild.id, channelId, message.author.id]
        );
      }
    } catch (err) {
      console.error("honeypot watcher error:", err.message);
    }
  },
};
