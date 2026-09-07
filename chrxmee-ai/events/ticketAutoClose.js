module.exports = {
  name: "ready",
  once: true,
  async execute(client) {
    setInterval(async () => {
      try {
        const openTickets = await client.pool.query(`SELECT * FROM ticket_channels WHERE status='open' AND last_activity < NOW() - (SELECT auto_close_hours || ' hours' FROM ticket_settings WHERE guild_id=ticket_channels.guild_id)::interval`);
        for (const ticket of openTickets.rows) {
          const guild = client.guilds.cache.get(ticket.guild_id);
          if (!guild) continue;
          const channel = guild.channels.cache.get(ticket.channel_id);
          if (!channel) continue;
          // send warning then delete
          await channel.send("this ticket has been inactive and will close soon.").catch(()=>{});
          // Actually close after 1 hour warning? For simplicity, close now.
          const settings = await client.pool.query(`SELECT log_channel_id FROM ticket_settings WHERE guild_id=$1`, [ticket.guild_id]);
          if (settings.rows[0]) {
            const logChannel = guild.channels.cache.get(settings.rows[0].log_channel_id);
            if (logChannel) await logChannel.send({ embeds: [new EmbedBuilder().setColor(0xff0000).setTitle("ticket auto-closed").setDescription(`ticket <#${channel.id}> closed due to inactivity.`)] }).catch(()=>{});
          }
          await client.pool.query(`UPDATE ticket_channels SET status='closed' WHERE channel_id=$1`, [ticket.channel_id]);
          await channel.delete("auto-close").catch(()=>{});
        }
      } catch (err) {
        console.error("auto-close error:", err.message);
      }
    }, 60000); // check every minute
  },
};
