module.exports = {
  name: "messageCreate",
  async execute(message, client) {
    if (message.author.bot || !message.guild) return;

    const pool = client.pool;
    const guildId = message.guildId;
    const userId = message.author.id;
    const content = message.content.toLowerCase();

    // Helper: log any merit gain
    async function logMeritGain(userId, amount, source) {
      const config = await pool.query(`SELECT log_channel_id FROM merit_config WHERE guild_id = $1`, [guildId]);
      if (!config.rows[0]?.log_channel_id) return;
      const logChannel = message.guild.channels.cache.get(config.rows[0].log_channel_id);
      if (!logChannel) return;

      const user = await client.users.fetch(userId).catch(() => null);
      const { EmbedBuilder } = require("discord.js");
      const embed = new EmbedBuilder()
        .setTitle("🎖️ Merits Earned")
        .setColor(0x00ff00)
        .addFields(
          { name: "User", value: user ? `${user.username} (${user.id})` : userId, inline: true },
          { name: "Amount", value: `+${amount} merits`, inline: true },
          { name: "Source", value: source, inline: true }
        )
        .setTimestamp();

      await logChannel.send({ embeds: [embed] }).catch(() => {});
    }

    // ============ INVITE IN CHAT ============
    const inviteTriggers = ["discord.gg/chrxmaticc", "discord.gg/Chrxmaticc", "/chrxmaticc", "chrxmaticc invite"];
    if (inviteTriggers.some(t => content.includes(t.toLowerCase()))) {
      const data = await pool.query(`SELECT merits, last_daily FROM user_merits WHERE user_id = $1 AND guild_id = $2`, [userId, guildId]);
      const now = new Date();
      const lastDaily = data.rows[0]?.last_daily;
      const cooldown = 24 * 60 * 60 * 1000;

      if (!lastDaily || (now - new Date(lastDaily)) >= cooldown) {
        await pool.query(`INSERT INTO user_merits (user_id, guild_id, merits, last_daily) VALUES ($1, $2, 100, NOW()) ON CONFLICT (user_id, guild_id) DO UPDATE SET merits = merits + 100, last_daily = NOW()`, [userId, guildId]);
        await logMeritGain(userId, 100, "Shared invite in chat");
        message.reply("🎉 **+100 merits** for repping the invite! Share daily for more.").catch(() => {});
      }
    }

    // ============ INVITE IN STATUS ============
    const member = message.member;
    if (!member) return;

    const activities = member.presence?.activities || [];
    const statusText = activities.map(a => a.state || "").join(" ").toLowerCase();
    const hasInviteInStatus = ["discord.gg/chrxmaticc", "/chrxmaticc"].some(t => statusText.includes(t));

    if (hasInviteInStatus) {
      const data = await pool.query(`SELECT merits, last_status_rep FROM user_merits WHERE user_id = $1 AND guild_id = $2`, [userId, guildId]);
      const now = new Date();
      const lastRep = data.rows[0]?.last_status_rep;
      const cooldown = 24 * 60 * 60 * 1000;

      if (!lastRep || (now - new Date(lastRep)) >= cooldown) {
        await pool.query(`INSERT INTO user_merits (user_id, guild_id, merits, last_status_rep) VALUES ($1, $2, 100, NOW()) ON CONFLICT (user_id, guild_id) DO UPDATE SET merits = merits + 100, last_status_rep = NOW()`, [userId, guildId]);
        await logMeritGain(userId, 100, "Invite in status/bio");
        message.reply("🎉 **+100 merits** for repping Chrxmaticc in your status! Keep it there.").catch(() => {});
      }
    }
  },
};
