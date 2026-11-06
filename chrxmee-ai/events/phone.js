// events/phone.js
const { WebhookClient } = require("discord.js");
const { Pool } = require("pg");

const PHONE_EMOJI = "<:Phone:1568008806124757094>";
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

module.exports = {
  name: "messageCreate",
  async execute(message) {
    if (!message.guild) return;
    if (message.author.bot) return;
    if (message.webhookId) return;

    try {
      const callCheck = await pool.query(
        `SELECT * FROM active_calls WHERE 
         caller_channel = $1 OR target_channel = $1 OR 
         caller_thread = $1 OR target_thread = $1`,
        [message.channelId]
      );

      if (!callCheck.rows[0]) return;
      
      const call = callCheck.rows[0];
      
      const isCaller = 
        message.channelId === call.caller_channel || 
        message.channelId === call.caller_thread;
        
      const targetWebhook = isCaller ? call.target_webhook : call.caller_webhook;

      if (!targetWebhook) return;

      const webhookClient = new WebhookClient({ url: targetWebhook });

      let content = message.content || "";
      if (message.attachments.size > 0) {
        const links = message.attachments.map(a => `[${a.contentType?.startsWith('image') ? 'Image' : 'File'}](${a.url})`).join(" ");
        content += (content ? "\n" : "") + links;
      }

      if (!content) return;

      await webhookClient.send({
        content: content,
        username: `${message.member.displayName} (${message.guild.name})`,
        avatarURL: message.author.displayAvatarURL(),
        allowedMentions: { parse: [] }
      }).catch((err) => console.error("[phone] webhook failed:", err.message));

      await message.react(PHONE_EMOJI).catch(() => {});
      
    } catch (err) {
      console.error("[phone] interceptor error:", err.message);
    }
  },
};
