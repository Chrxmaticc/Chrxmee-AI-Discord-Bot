module.exports = {
  name: "voiceStateUpdate",
  async execute(oldState, newState, client) {
    const guild = newState.guild || oldState.guild;
    const pool = client.pool;

    // Fetch J2C config
    const config = await pool.query(`SELECT * FROM j2c_config WHERE guild_id = $1 AND enabled = TRUE`, [guild.id]);
    if (!config.rows[0]) return;
    const cfg = config.rows[0];

    // ============ JOIN TRIGGER ============
    if (newState.channelId === cfg.trigger_channel_id && oldState.channelId !== cfg.trigger_channel_id) {
      const member = newState.member;
      const nameFormat = cfg.default_name || "{user}'s VC";
      const channelName = nameFormat.replace("{user}", member.displayName).slice(0, 100);

      try {
        const newVC = await guild.channels.create({
          name: channelName,
          type: 2, // GuildVoice
          parent: cfg.category_id || newState.channel.parentId,
          userLimit: cfg.default_limit || 0,
          permissionOverwrites: [
            { id: guild.roles.everyone, allow: ["Connect", "ViewChannel"] },
            { id: member.id, allow: ["Connect", "ViewChannel", "ManageChannels", "MoveMembers", "MuteMembers", "DeafenMembers"] },
            { id: client.user.id, allow: ["Connect", "ViewChannel", "ManageChannels", "MoveMembers"] },
          ],
        });

        await pool.query(`INSERT INTO j2c_channels (channel_id, guild_id, owner_id) VALUES ($1, $2, $3)`, [newVC.id, guild.id, member.id]);
        await member.voice.setChannel(newVC).catch(() => {});

        // Log
        if (cfg.log_channel_id) {
          const logChannel = guild.channels.cache.get(cfg.log_channel_id);
          if (logChannel) logChannel.send({ embeds: [{ color: 0x00ff00, description: `🆕 **${member.user.tag}** created ${newVC}` }] }).catch(() => {});
        }
      } catch (err) {
        console.error("J2C Create Error:", err);
      }
    }

    // ============ LEAVE CLEANUP ============
    if (oldState.channelId && oldState.channelId !== newState.channelId) {
      const data = await pool.query(`SELECT * FROM j2c_channels WHERE channel_id = $1`, [oldState.channelId]);
      if (!data.rows[0]) return;
      const vc = guild.channels.cache.get(oldState.channelId);
      if (!vc) return;

      // If empty, delete after 3 seconds
      if (vc.members.size === 0) {
        setTimeout(async () => {
          const checkVC = guild.channels.cache.get(oldState.channelId);
          if (checkVC && checkVC.members.size === 0) {
            await pool.query(`DELETE FROM j2c_channels WHERE channel_id = $1`, [oldState.channelId]);
            await pool.query(`DELETE FROM j2c_bans WHERE channel_id = $1`, [oldState.channelId]);
            await checkVC.delete().catch(() => {});

            if (cfg.log_channel_id) {
              const logChannel = guild.channels.cache.get(cfg.log_channel_id);
              if (logChannel) logChannel.send({ embeds: [{ color: 0xff0000, description: `🗑️ Temp VC **${vc.name}** deleted (empty)` }] }).catch(() => {});
            }
          }
        }, 3000);
      }
    }
  },
};
