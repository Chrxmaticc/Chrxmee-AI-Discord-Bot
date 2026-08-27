module.exports = {
  name: "messageCreate",
  async execute(message) {
    if (message.author.bot || !message.guild) return;
    if (!message.content || message.content.length === 0) return;

    const client = message.client;
    if (!client.quietWebhooks) client.quietWebhooks = new Map();

    // check if user is quietlocked in this channel
    const { Pool } = require("pg");
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });

    try {
      const res = await pool.query(
        "SELECT * FROM quietlock_active WHERE guild_id = $1 AND user_id = $2 AND channel_id = $3",
        [message.guild.id, message.author.id, message.channel.id]
      );
      if (res.rows.length === 0) return;

      // delete original message
      await message.delete().catch(() => {});

      // get or create webhook
      let webhook = client.quietWebhooks.get(message.channel.id);
      if (!webhook) {
        const hooks = await message.channel.fetchWebhooks().catch(() => null);
        webhook = hooks?.find(h => h.owner?.id === client.user.id) || null;
        if (!webhook) {
          webhook = await message.channel.createWebhook({
            name: "quietlock",
            avatar: client.user.displayAvatarURL(),
          }).catch(() => null);
        }
        if (webhook) {
          const { WebhookClient } = require("discord.js");
          const webhookClient = new WebhookClient({ id: webhook.id, token: webhook.token });
          client.quietWebhooks.set(message.channel.id, webhookClient);
          webhook = webhookClient;
        }
      }

      if (!webhook) return;

      // send "..." with user's name and avatar
      const member = message.member;
      const displayName = member?.nickname || message.author.displayName;
      const avatar = message.author.displayAvatarURL({ dynamic: true, size: 1024 });

      await webhook.send({
        content: "...",
        username: displayName,
        avatarURL: avatar,
        allowedMentions: { parse: [] },
      }).catch(() => {});
    } catch (err) {
      console.error("quietlock handler error:", err.message);
    } finally {
      pool.end();
    }
  },
};
