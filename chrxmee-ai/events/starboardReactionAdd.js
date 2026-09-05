const { EmbedBuilder } = require("discord.js");
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

module.exports = {
  name: "messageReactionAdd",
  async execute(reaction, user) {
    if (user.bot) return;
    if (!reaction.message.guild) return;

    try {
      const settingsRes = await pool.query(
        `SELECT starboard_channel_id, emoji, threshold FROM starboard_settings WHERE guild_id = $1`,
        [reaction.message.guildId]
      );
      if (!settingsRes.rows[0]) return;

      const { starboard_channel_id, emoji, threshold } = settingsRes.rows[0];
      if (!starboard_channel_id || !emoji || !threshold) return;

      const reactedEmoji = reaction.emoji.toString();
      if (reactedEmoji !== emoji) return;

      const count = reaction.count || 1;
      if (count < threshold) return;

      const existing = await pool.query(
        `SELECT 1 FROM starboard_messages WHERE guild_id = $1 AND message_id = $2`,
        [reaction.message.guildId, reaction.message.id]
      );
      if (existing.rows.length > 0) return;

      const starboardChannel = reaction.message.client.channels.cache.get(starboard_channel_id);
      if (!starboardChannel) return;

      const embed = new EmbedBuilder()
        .setColor(0x7c7ce0)
        .setAuthor({
          name: reaction.message.author?.tag || "Unknown",
          iconURL: reaction.message.author?.displayAvatarURL(),
        })
        .setDescription(reaction.message.content || "*empty message*")
        .addFields(
          { name: "source", value: `[jump to message](${reaction.message.url})`, inline: true },
          { name: "stars", value: `${count} ${emoji}`, inline: true }
        )
        .setTimestamp();

      const attachment = reaction.message.attachments.first();
      if (attachment && attachment.contentType?.startsWith("image/")) {
        embed.setImage(attachment.url);
      }

      const sent = await starboardChannel.send({ embeds: [embed] }).catch(() => null);
      if (sent) {
        await pool.query(
          `INSERT INTO starboard_messages (guild_id, message_id, starboard_message_id)
           VALUES ($1, $2, $3)`,
          [reaction.message.guildId, reaction.message.id, sent.id]
        );
      }
    } catch (err) {
      console.error("starboard reaction error:", err.message);
    }
  },
};
