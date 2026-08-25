module.exports = {
  name: "messageDelete",
  async execute(message) {
    if (!message.guild) return;
    if (message.author?.bot) return;

    const client = message.client;
    if (!client.snipes) client.snipes = new Map();

    const snipeData = {
      content: message.content || "*(empty or attachment only)*",
      author: message.author?.tag || "unknown",
      authorId: message.author?.id,
      channelId: message.channelId,
      channelName: message.channel.name,
      guildId: message.guildId,
      timestamp: Date.now(),
      attachments: message.attachments?.map(a => ({ name: a.name, url: a.url, contentType: a.contentType })) || [],
      embeds: message.embeds?.length || 0,
    };

    // store per channel, keep last 5 snipes per channel
    const channelSnipes = client.snipes.get(message.channelId) || [];
    channelSnipes.unshift(snipeData);
    if (channelSnipes.length > 5) channelSnipes.pop();
    client.snipes.set(message.channelId, channelSnipes);
  },
};
