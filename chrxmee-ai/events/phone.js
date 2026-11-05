// events/phone.js
const { WebhookClient } = require("discord.js");
const { Pool } = require("pg");

const PHONE_EMOJI = "<:Phone:1568008806124757094>";
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

module.exports = {
  name: "messageCreate",
  async execute(message) {
    if (!message.guild) return;
    if (message.author.bot) return;
    if (message.webhookId) return;

    try {
      const callCheck = await pool.query(
        `SELECT * FROM active_calls WHERE guild_id = $1 AND channel_id = $2`,
        [message.guildId, message.channelId]
      );

      if (!callCheck.rows[0]) return;
      
      const call = callCheck.rows[0];
      const targetHook = await pool.query(
        `SELECT webhook_url FROM phone_registry WHERE guild_id = $1`,
        [call.target_guild_id]
      );

      if (targetHook.rows[0]?.webhook_url) {
        const webhookClient = new WebhookClient({ url: targetHook.rows[0].webhook_url });

        await webhookClient.send({
          content: message.content || "*[attachment / embed]*",
          username: `${message.member.displayName} (${message.guild.name})`,
          avatarURL: message.author.displayAvatarURL(),
          allowedMentions: { parse: [] }
        }).catch((err) => console.error("[phone] webhook failed:", err.message));

        await message.react(PHONE_EMOJI).catch(() => {});
      }
    } catch (err) {
      console.error("[phone] interceptor error:", err.message);
    }
  },
};
