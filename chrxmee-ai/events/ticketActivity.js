module.exports = {
  name: "messageCreate",
  async execute(message) {
    if (message.author.bot || !message.guild) return;
    try {
      await message.client.pool.query(
        `UPDATE ticket_channels SET last_activity = NOW() WHERE channel_id = $1 AND status = 'open'`,
        [message.channelId]
      );
    } catch (err) {
      // ignore, channel may not be ticket
    }
  },
};
