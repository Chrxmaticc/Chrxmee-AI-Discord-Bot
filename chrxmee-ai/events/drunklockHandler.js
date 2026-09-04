const { WebhookClient } = require("discord.js");
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const webhookCache = new Map();

function drunkify(text) {
  const words = text.split(/\s+/);
  return words.map((word) => {
    // 30% chance to slur
    if (Math.random() < 0.3) {
      const chars = word.split('');
      const idx = Math.floor(Math.random() * chars.length);
      const repeatCount = Math.floor(Math.random() * 3) + 2;
      chars.splice(idx, 0, chars[idx].repeat(repeatCount - 1));
      word = chars.join('');
    }
    const hiccup = Math.random() < 0.1 ? '*hic* ' : '';
    const bullshit = Math.random() < 0.05 ? 'bllrrghh ' : '';
    return hiccup + bullshit + word;
  }).join(' ').trim();
}

async function getWebhook(channel, client) {
  if (webhookCache.has(channel.id)) return webhookCache.get(channel.id);

  const webhooks = await channel.fetchWebhooks().catch(() => null);
  let webhook = webhooks?.find(wh => wh.owner?.id === client.user.id) || null;
  if (!webhook) {
    webhook = await channel.createWebhook({
      name: "drunklock",
      avatar: client.user.displayAvatarURL(),
    }).catch(() => null);
  }

  if (webhook) {
    const webhookClient = new WebhookClient({ id: webhook.id, token: webhook.token });
    webhookCache.set(channel.id, webhookClient);
    return webhookClient;
  }
  return null;
}

module.exports = {
  name: "messageCreate",
  async execute(message) {
    if (message.author.bot || !message.guild) return;
    if (!message.content || message.content.length === 0) return;

    const client = message.client;
    const channel = message.channel;
    const guildId = message.guild.id;

    try {
      const res = await pool.query(
        "SELECT * FROM drunklock_active WHERE guild_id = $1 AND user_id = $2 AND channel_id = $3",
        [guildId, message.author.id, channel.id]
      );
      if (res.rows.length === 0) return;

      await message.delete().catch(() => {});

      const webhook = await getWebhook(channel, client);
      if (!webhook) return;

      const drunkText = drunkify(message.content);
      const member = message.member;
      const displayName = member?.nickname || message.author.displayName;
      const avatar = message.author.displayAvatarURL({ dynamic: true, size: 1024 });

      await webhook.send({
        content: drunkText,
        username: displayName,
        avatarURL: avatar,
        allowedMentions: { parse: [] },
      }).catch(() => {});
    } catch (err) {
      console.error("drunklock handler error:", err.message);
    }
  },
};
