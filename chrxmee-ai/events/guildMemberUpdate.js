module.exports = {
  name: "guildMemberUpdate",
  async execute(oldMember, newMember, client) {
    const pool = client.pool;
    const guildId = newMember.guild.id;

    const wasBoosting = oldMember.premiumSince;
    const isBoosting = newMember.premiumSince;

    if (!wasBoosting && isBoosting) {
      await pool.query(`INSERT INTO user_merits (user_id, guild_id, merits) VALUES ($1, $2, 50) ON CONFLICT (user_id, guild_id) DO UPDATE SET merits = merits + 50`, [newMember.id, guildId]);

      // Announce
      const channel = newMember.guild.systemChannel || newMember.guild.channels.cache.find(c => c.isTextBased());
      if (channel) channel.send(`🎉 **${newMember.user.username}** just boosted and earned **50 merits**!`).catch(() => {});

      // Log
      const config = await pool.query(`SELECT log_channel_id FROM merit_config WHERE guild_id = $1`, [guildId]);
      if (config.rows[0]?.log_channel_id) {
        const logChannel = newMember.guild.channels.cache.get(config.rows[0].log_channel_id);
        if (logChannel) {
          const { EmbedBuilder } = require("discord.js");
          await logChannel.send({
            embeds: [new EmbedBuilder()
              .setTitle("🎖️ Merits Earned")
              .setColor(0x00ff00)
              .addFields(
                { name: "User", value: `${newMember.user.username} (${newMember.id})`, inline: true },
                { name: "Amount", value: "+50 merits", inline: true },
                { name: "Source", value: "Server boost", inline: true }
              )
              .setTimestamp()
            ]
          }).catch(() => {});
        }
      }
    }
  },
};
