module.exports = {
  name: "messageReactionRemove",
  async execute(reaction, user) {
    if (!reaction.message.guild) return;
    if (user.bot) return;

    const client = reaction.message.client;
    if (!client.reactionSnipes) client.reactionSnipes = new Map();

    const reactionData = {
      emoji: reaction.emoji.toString(),
      userTag: user.tag,
      userId: user.id,
      messageContent: reaction.message.content ? reaction.message.content.slice(0, 200) : "*(attachment or embed)*",
      messageId: reaction.message.id,
      channelId: reaction.message.channelId,
      channelName: reaction.message.channel.name,
      guildId: reaction.message.guildId,
      timestamp: Date.now(),
    };

    const channelReactions = client.reactionSnipes.get(reaction.message.channelId) || [];
    channelReactions.unshift(reactionData);
    if (channelReactions.length > 5) channelReactions.pop();
    client.reactionSnipes.set(reaction.message.channelId, channelReactions);
  },
};
