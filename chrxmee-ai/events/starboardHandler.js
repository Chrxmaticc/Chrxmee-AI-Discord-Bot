module.exports = {
  name: "ready",
  once: true,
  async execute(client) {
    client.starboardCooldowns = new Map();
    console.log("✅ starboard handler ready");
  },
};

// Reaction handler
module.exports = {
  name: "messageReactionAdd",
  async execute(reaction, user) {
    if (user.bot) return;
    if (!reaction.message.guild) return;

    const client = reaction.message.client;
    const pool = client.pool;
    const guildId = reaction.message.guildId;

    try {
      // Get settings
      const settings = await pool.query(
        `SELECT starboard_channel_id, emoji, threshold FROM starboard_settings WHERE guild_id = $1`,
        [guildId]
      );
      if (!settings.rows[0]) return;

      const { starboard_channel_id, emoji, threshold } = settings.rows[0];
      if (!starboard_channel_id || !emoji || !threshold) return;

      // Check if reaction emoji matches
      const reactedEmoji = reaction.emoji.toString();
      if (reactedEmoji !== emoji) return;

      // Count reactions of this emoji (excluding bots)
      const count = reaction.count || 1;
      if (count < threshold) return;

      // Check if message already starboarded (prevent duplicates)
      const existing = await pool.query(
        `SELECT 1 FROM starboard_messages WHERE guild_id = $1 AND message_id = $2`,
        [guildId, reaction.message.id]
      );
      if (existing.rows.length > 0) return;

      // Determine source channel
      const sourceChannel = reaction.message.channel;
      if (!sourceChannel) return;

      // Check if this source is linked, or use default? Here we use default starboard for any reaction.
      // If you want to restrict to linked sources, add check for starboard_links.
      const starboardChannel = client.channels.cache.get(starboard_channel_id);
      if (!starboardChannel) return;

      // Build embed
      const embed = new EmbedBuilder()
        .setColor(0x7c7ce0)
        .setAuthor({ name: reaction.message.author?.tag || "Unknown", iconURL: reaction.message.author?.displayAvatarURL() })
        .setDescription(reaction.message.content || "*empty message*")
        .addFields(
          { name: "source", value: `[jump to message](${reaction.message.url})`, inline: true },
          { name: "stars", value: `${count} ${emoji}`, inline: true }
        )
        .setTimestamp();

      // If message has attachments, include first image
      const attachment = reaction.message.attachments.first();
      if (attachment && attachment.contentType?.startsWith("image/")) {
        embed.setImage(attachment.url);
      }

      const sent = await starboardChannel.send({ embeds: [embed] }).catch(() => null);
      if (sent) {
        await pool.query(
          `INSERT INTO starboard_messages (guild_id, message_id, starboard_message_id)
           VALUES ($1, $2, $3)`,
          [guildId, reaction.message.id, sent.id]
        );
      }
    } catch (err) {
      console.error("starboard reaction handler error:", err.message);
    }
  },
};

// Auto-starboard for new threads/forums
module.exports = {
  name: "threadCreate",
  async execute(thread, newlyCreated) {
    if (!newlyCreated) return;
    const client = thread.client;
    const pool = client.pool;
    const guildId = thread.guildId;

    try {
      const settings = await pool.query(
        `SELECT starboard_channel_id FROM starboard_settings WHERE guild_id = $1`,
        [guildId]
      );
      if (!settings.rows[0]?.starboard_channel_id) return;

      const starboardChannel = client.channels.cache.get(settings.rows[0].starboard_channel_id);
      if (!starboardChannel) return;

      const embed = new EmbedBuilder()
        .setColor(0x7c7ce0)
        .setTitle(`${E.star} new ${thread.type === "GUILD_PRIVATE_THREAD" ? "private thread" : "thread"} created`)
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
