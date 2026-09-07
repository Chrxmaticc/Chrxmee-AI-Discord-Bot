const { EmbedBuilder } = require("discord.js");

const E = {
  giveaway: "<:Giveaway:1546601314870497524>",
  trophy: "<:GiveawayTrophy:1546601598405447749>",
  calendar: "<:Calendar:1546601902240702564>",
};

module.exports = {
  name: "ready",
  once: true,
  execute(client) {
    setInterval(async () => {
      try {
        const endedGiveaways = await client.pool.query(
          `SELECT * FROM giveaways WHERE ended=FALSE AND end_time <= $1`,
          [Date.now()]
        );
        for (const giveaway of endedGiveaways.rows) {
          const guild = client.guilds.cache.get(giveaway.guild_id);
          if (!guild) continue;

          const entriesRes = await client.pool.query(
            `SELECT user_id FROM giveaway_entries WHERE giveaway_id=$1`,
            [giveaway.id]
          );
          const entries = entriesRes.rows.map(r => r.user_id);

          if (entries.length > 0) {
            const winnersCount = Math.min(giveaway.winners, entries.length);
            const winners = [];
            for (let i = 0; i < winnersCount; i++) {
              const idx = Math.floor(Math.random() * entries.length);
              winners.push(entries.splice(idx, 1)[0]);
            }
            const channel = guild.channels.cache.get(giveaway.channel_id);
            if (channel) {
              const embed = new EmbedBuilder()
                .setColor(0xFFD700)
                .setTitle(`${E.trophy} giveaway ended`)
                .setDescription(`**${giveaway.prize}**\nWinners: ${winners.map(w => `<@${w}>`).join(", ")}`)
                .setFooter({ text: "chromed giveaway" });
              await channel.send({ embeds: [embed] }).catch(() => {});
            }
          }

          await client.pool.query(`UPDATE giveaways SET ended=TRUE WHERE id=$1`, [giveaway.id]);
          // Delete original message
          const msg = await client.channels.cache.get(giveaway.channel_id)?.messages.fetch(giveaway.message_id).catch(() => null);
          if (msg) await msg.delete().catch(() => {});
        }
      } catch (err) {
        console.error("giveaway timer error:", err.message);
      }
    }, 60000); // check every minute

    console.log("✅ giveaway timer started");
  },
};
