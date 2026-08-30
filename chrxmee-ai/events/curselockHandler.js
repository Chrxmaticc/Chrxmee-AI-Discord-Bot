module.exports = {
  name: "messageCreate",
  async execute(message) {
    if (message.author.bot || !message.guild) return;
    if (!message.content || message.content.length === 0) return;

    const client = message.client;
    if (!client.curselockWebhooks) client.curselockWebhooks = new Map();

    const { Pool } = require("pg");
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });

    try {
      const res = await pool.query(
        "SELECT * FROM curselock_active WHERE guild_id = $1 AND user_id = $2 AND channel_id = $3",
        [message.guild.id, message.author.id, message.channel.id]
      );
      if (res.rows.length === 0) return;

      await message.delete().catch(() => {});

      const cursed = toZalgo(message.content);

      let webhook = client.curselockWebhooks.get(message.channel.id);
      if (!webhook) {
        const hooks = await message.channel.fetchWebhooks().catch(() => null);
        webhook = hooks?.find(h => h.owner?.id === client.user.id) || null;
        if (!webhook) {
          webhook = await message.channel.createWebhook({
            name: "curselock",
            avatar: client.user.displayAvatarURL(),
          }).catch(() => null);
        }
        if (webhook) {
          const { WebhookClient } = require("discord.js");
          const webhookClient = new WebhookClient({ id: webhook.id, token: webhook.token });
          client.curselockWebhooks.set(message.channel.id, webhookClient);
          webhook = webhookClient;
        }
      }

      if (!webhook) return;

      const member = message.member;
      const displayName = member?.nickname || message.author.displayName;
      const avatar = message.author.displayAvatarURL({ dynamic: true, size: 1024 });

      await webhook.send({
        content: cursed,
        username: displayName,
        avatarURL: avatar,
        allowedMentions: { parse: [] },
      }).catch(() => {});
    } catch (err) {
      console.error("curselock handler error:", err.message);
    } finally {
      pool.end();
    }
  },
};

// Zalgo text generator
function toZalgo(text) {
  const zalgoUp = [
    '\u030d', '\u030e', '\u0304', '\u0305', '\u033f', '\u0311', '\u0306', '\u0310',
    '\u0352', '\u0357', '\u0351', '\u0307', '\u0308', '\u030a', '\u0342', '\u0313',
    '\u0314', '\u031a', '\u032e', '\u032b', '\u032c', '\u032d'
  ];
  const zalgoDown = [
    '\u0316', '\u0317', '\u0318', '\u0319', '\u031c', '\u031d', '\u031e', '\u031f',
    '\u0320', '\u0324', '\u0325', '\u0326', '\u0329', '\u032a', '\u032f', '\u0330',
    '\u0331', '\u0332', '\u0333', '\u0339', '\u033a', '\u033b', '\u033c', '\u0345',
    '\u0347', '\u0348', '\u0349', '\u034a', '\u034b', '\u034c', '\u034d', '\u034e'
  ];
  const zalgoMid = ['\u0315', '\u031b', '\u0340', '\u0341', '\u0358', '\u0321', '\u0322', '\u0327', '\u0328', '\u0334', '\u0335', '\u0336', '\u0346', '\u034f'];

  let result = '';
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    result += char;
    if (char === ' ') continue;

    const upCount = Math.floor(Math.random() * 4) + 1;
    const midCount = Math.floor(Math.random() * 2);
    const downCount = Math.floor(Math.random() * 4) + 1;

    for (let j = 0; j < upCount; j++) {
      result += zalgoUp[Math.floor(Math.random() * zalgoUp.length)];
    }
    for (let j = 0; j < midCount; j++) {
      result += zalgoMid[Math.floor(Math.random() * zalgoMid.length)];
    }
    for (let j = 0; j < downCount; j++) {
      result += zalgoDown[Math.floor(Math.random() * zalgoDown.length)];
    }
  }
  return result;
}
