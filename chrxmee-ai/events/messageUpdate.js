module.exports = {
  name: "messageUpdate",
  async execute(oldMessage, newMessage) {
    if (!oldMessage.guild) return;
    if (oldMessage.author?.bot) return;

    const client = oldMessage.client;
    if (!client.editSnipes) client.editSnipes = new Map();

    const editData = {
      oldContent: oldMessage.content || "*(empty)*",
      newContent: newMessage.content || "*(empty)*",
      author: newMessage.author?.tag || "unknown",
      authorId: newMessage.author?.id,
      channelId: newMessage.channelId,
      channelName: newMessage.channel.name,
      guildId: newMessage.guildId,
      timestamp: Date.now(),
    };

    const channelEdits = client.editSnipes.get(newMessage.channelId) || [];
    channelEdits.unshift(editData);
    if (channelEdits.length > 5) channelEdits.pop();
    client.editSnipes.set(newMessage.channelId, channelEdits);
  },
};
