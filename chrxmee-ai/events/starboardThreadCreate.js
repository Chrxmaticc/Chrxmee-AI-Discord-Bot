const { EmbedBuilder } = require("discord.js");
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const E = {
  star: "<:Star:1545563186017607732>",
};

module.exports = {
  name: "threadCreate",
  async execute(thread, newlyCreated) {
    if (!newlyCreated) return;
    if (thread.type !== "GUILD_PUBLIC_THREAD" && thread.type !== "GUILD_PRIVATE_THREAD") return;

    try {
      // Check if parent forum is linked
      const linkRes = await pool.query(
        `SELECT starboard_channel_id FROM starboard_links WHERE guild_id = $1 AND source_id = $2`,
        [thread.guildId, thread.parentId]
      );
      if (linkRes.rows.length === 0) return; // no forum link

      const starboardChannel = thread.client.channels.cache.get(linkRes.rows[0].starboard_channel_id);
      if (!starboardChannel) return;

      const embed = new EmbedBuilder()
        .setColor(0x7c7ce0)
        .setTitle(`${E.star} new thread created`)
        .setDescription(`**${thread.name}**`)
        .addFields(
          { name: "thread", value: `<#${thread.id}>`, inline: true },
          { name: "parent", value: thread.parent ? `<#${thread.parentId}>` : "none", inline: true }
        )
        .setTimestamp();

      await starboardChannel.send({ embeds: [embed] }).catch(() => {});
      console.log(`[STARBOARD] Auto-posted thread ${thread.name} to ${starboardChannel.name}`);
    } catch (err) {
      console.error("starboard threadCreate error:", err.message);
    }
  },
};
