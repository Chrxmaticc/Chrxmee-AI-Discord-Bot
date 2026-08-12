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
          const rotationMode = config.rotation_mode || "random";
          const sequenceState = config.sequence_state || {};

          // Helper to pick next item
          function pickNext(items, category) {
            if (!items.length) return null;
            if (rotationMode === "sequential") {
              const lastIndex = sequenceState[category] ?? -1;
              const nextIndex = (lastIndex + 1) % items.length;
              sequenceState[category] = nextIndex;
              return items[nextIndex];
            } else {
              // random
              return items[Math.floor(Math.random() * items.length)];
            }
          }

          const names = config.names || [];
          const icons = config.icons || [];
          const banners = config.banners || [];
          const descriptions = config.descriptions || [];
          const channelRenames = config.channel_renames || {};

          // Apply changes
          if (names.length) {
            const chosen = pickNext(names, "names");
            if (chosen) try { await guild.setName(chosen); } catch (err) { console.error(`Autochange name failed for ${guild.id}:`, err.message); }
          }

          if (icons.length) {
            const chosen = pickNext(icons, "icons");
            if (chosen) {
              try {
                const res = await fetch(chosen);
                const buffer = Buffer.from(await res.arrayBuffer());
                const base64 = `data:${res.headers.get('content-type')};base64,${buffer.toString('base64')}`;
                await guild.setIcon(buffer);
              } catch (err) { console.error(`Autochange icon failed for ${guild.id}:`, err.message); }
            }
          }

          if (banners.length) {
            const chosen = pickNext(banners, "banners");
            if (chosen) {
              try {
                const res = await fetch(chosen);
                const buffer = Buffer.from(await res.arrayBuffer());
                const base64 = `data:${res.headers.get('content-type')};base64,${buffer.toString('base64')}`;
                await guild.setBanner(buffer);
              } catch (err) { console.error(`Autochange banner failed for ${guild.id}:`, err.message); }
            }
          }

          if (descriptions.length && guild.features.includes('COMMUNITY')) {
            const chosen = pickNext(descriptions, "descriptions");
            if (chosen) try { await guild.setDescription(chosen); } catch (err) { console.error(`Autochange description failed for ${guild.id}:`, err.message); }
          }

          for (const [channelId, nameList] of Object.entries(channelRenames)) {
            if (nameList.length === 0) continue;
            const channel = guild.channels.cache.get(channelId);
            if (!channel) continue;
            const chosen = pickNext(nameList, `channel_${channelId}`);
            if (chosen) try { await channel.setName(chosen); } catch (err) { console.error(`Autochange channel rename failed for ${channelId}:`, err.message); }
          }

          // Save sequence state and last change
          await pool.query(`UPDATE server_autochange SET sequence_state = $1, last_change = NOW() WHERE guild_id = $2`, [JSON.stringify(sequenceState), guild.id]);
          console.log(`Server autochange rotated for ${guild.name} (${rotationMode})`);
        }
      }
    }, 60_000);
  },
};
