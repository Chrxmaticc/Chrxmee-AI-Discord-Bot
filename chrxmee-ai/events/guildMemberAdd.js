module.exports = {
  name: "guildMemberAdd",
  async execute(member, client) {
    const pool = client.pool;
    const guildId = member.guild.id;

    // Give new member 5 merits for joining
    await pool.query(`INSERT INTO user_merits (user_id, guild_id, merits) VALUES ($1, $2, 5) ON CONFLICT (user_id, guild_id) DO UPDATE SET merits = merits + 5`, [member.id, guildId]);

    // Log it
    const config = await pool.query(`SELECT log_channel_id FROM merit_config WHERE guild_id = $1`, [guildId]);
    if (config.rows[0]?.log_channel_id) {
      const logChannel = member.guild.channels.cache.get(config.rows[0].log_channel_id);
      if (logChannel) {
        const { EmbedBuilder } = require("discord.js");
        await logChannel.send({
          embeds: [new EmbedBuilder()
            .setTitle("🎖️ Merits Earned")
            .setColor(0x00ff00)
            .addFields(
              { name: "User", value: `${member.user.username} (${member.id})`, inline: true },
              { name: "Amount", value: "+5 merits", inline: true },
              { name: "Source", value: "Joined server", inline: true }
            )
            .setTimestamp()
          ]
        }).catch(() => {});
      }
    }
  },
};
