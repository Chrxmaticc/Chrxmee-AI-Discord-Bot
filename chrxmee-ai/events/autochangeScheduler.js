module.exports = {
  name: "ready",
  once: true,
  async execute(client) {
    console.log("Server autochange scheduler started.");
    setInterval(async () => {
      const pool = client.pool;
      const now = new Date();

      const { rows } = await pool.query(`SELECT * FROM server_autochange WHERE enabled = TRUE`);

      for (const config of rows) {
        const guild = client.guilds.cache.get(config.guild_id);
        if (!guild) continue;

        const lastChange = config.last_change ? new Date(config.last_change) : null;
        const nextDue = lastChange ? new Date(lastChange.getTime() + config.interval_hours * 3600 * 1000) : now;

        if (now >= nextDue) {
          const names = config.names || [];
          const icons = config.icons || [];
          const banners = config.banners || [];
          const descriptions = config.descriptions || [];
          const channelRenames = config.channel_renames || {};

          // 1. Rotate server name
          if (names.length) {
            const chosen = names[Math.floor(Math.random() * names.length)];
            try { await guild.setName(chosen); } catch (err) { console.error(`Autochange name failed for ${guild.id}:`, err.message); }
          }

          // 2. Rotate server icon
          if (icons.length) {
            const chosen = icons[Math.floor(Math.random() * icons.length)];
            try {
              const res = await fetch(chosen);
              const buffer = Buffer.from(await res.arrayBuffer());
              const base64 = `data:${res.headers.get('content-type')};base64,${buffer.toString('base64')}`;
              await guild.setIcon(buffer);
            } catch (err) { console.error(`Autochange icon failed for ${guild.id}:`, err.message); }
          }

          // 3. Rotate server banner
          if (banners.length) {
            const chosen = banners[Math.floor(Math.random() * banners.length)];
            try {
              const res = await fetch(chosen);
              const buffer = Buffer.from(await res.arrayBuffer());
              const base64 = `data:${res.headers.get('content-type')};base64,${buffer.toString('base64')}`;
              await guild.setBanner(buffer);
            } catch (err) { console.error(`Autochange banner failed for ${guild.id}:`, err.message); }
          }

          // 4. Rotate server description (community servers only)
          if (descriptions.length && guild.features.includes('COMMUNITY')) {
            const chosen = descriptions[Math.floor(Math.random() * descriptions.length)];
            try { await guild.setDescription(chosen); } catch (err) { console.error(`Autochange description failed for ${guild.id}:`, err.message); }
          }

          // 5. Rotate channel names
          for (const [channelId, nameList] of Object.entries(channelRenames)) {
            if (nameList.length === 0) continue;
            const channel = guild.channels.cache.get(channelId);
            if (!channel) continue;
            const chosen = nameList[Math.floor(Math.random() * nameList.length)];
            try { await channel.setName(chosen); } catch (err) { console.error(`Autochange channel rename failed for ${channelId}:`, err.message); }
          }

          // Update last_change
          await pool.query(`UPDATE server_autochange SET last_change = NOW() WHERE guild_id = $1`, [guild.id]);
          console.log(`Server autochange rotated for ${guild.name}`);
        }
      }
    }, 60_000); // check every minute
  },
};
