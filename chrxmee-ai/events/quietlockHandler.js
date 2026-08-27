module.exports = {
  name: "messageCreate",
  async execute(message) {
    if (message.author.bot) return;
    if (!message.guild) return;

    const client = message.client;
    if (!client.quietLocks?.size) return;

    const key = `${message.guildId}-${message.author.id}`;
    const lock = client.quietLocks.get(key);
    if (!lock) return;

    // expired? remove and ignore
    if (Date.now() > lock.until) {
      client.quietLocks.delete(key);
      return;
    }

    try {
      // delete the user's message
      await message.delete().catch(() => {});

      // find or create webhook
      let webhook = client.quietWebhooks?.get(message.channelId);
      if (!webhook) {
        const hooks = await message.channel.fetchWebhooks().catch(() => null);
        webhook = hooks?.find(h => h.name === "chromed quietlock") || null;

        if (!webhook) {
          webhook = await message.channel.createWebhook({
            name: "chromed quietlock",
            avatar: "https://cdn.discordapp.com/attachments/1540827931574800394/1540827931574800394/chromed.png",
          }).catch(() => null);
        }

        if (webhook) {
          if (!client.quietWebhooks) client.quietWebhooks = new Map();
          client.quietWebhooks.set(message.channelId, webhook);
        }
      }

      if (!webhook) return;

      // send "..." with user's name/avatar
      const dots = Math.random() > 0.5 ? "..." : "…";
      await webhook.send({
        content: dots,
        username: lock.username,
        avatarURL: lock.avatar,
      }).catch(() => {});
    } catch (err) {
      console.error("quietlock handler error:", err.message);
    }
  },
};
