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

    try {
      const settingsRes = await pool.query(
        `SELECT starboard_channel_id FROM starboard_settings WHERE guild_id = $1`,
        [thread.guildId]
      );
      if (!settingsRes.rows[0]?.starboard_channel_id) return;

      const starboardChannel = thread.client.channels.cache.get(settingsRes.rows[0].starboard_channel_id);
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
    } catch (err) {
      console.error("starboard threadCreate error:", err.message);
    }
  },
};
