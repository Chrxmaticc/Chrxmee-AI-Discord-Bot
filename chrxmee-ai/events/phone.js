// events/phone.js
const { WebhookClient, EmbedBuilder } = require("discord.js");
const { Pool } = require("pg");

const PHONE_EMOJI = "<:Phone:1568008806124757094>";
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

module.exports = {
  name: "messageCreate",
  async execute(message) {
    if (message.author.bot) return;
    if (message.webhookId) return;

    try {
      const callCheck = await pool.query(
        `SELECT * FROM active_calls WHERE 
         caller_channel = $1 OR target_channel = $1`,
        [message.channelId]
      );

      if (!callCheck.rows[0]) return;
      
      const call = callCheck.rows[0];
      
      const isCaller = message.channelId === call.caller_channel;

      let content = message.content || "";
      if (message.attachments.size > 0) {
        const links = message.attachments.map(a => `[${a.contentType?.startsWith('image') ? 'Image' : 'File'}](${a.url})`).join(" ");
        content += (content ? "\n" : "") + links;
      }
      if (!content) return;

      // ── ROUTING LOGIC BASED ON CALL TYPE ──
      if (call.type === "user") {
        // DM Mode: No webhooks. Just send an embed to the other person's DM.
        const targetChannelId = isCaller ? call.target_channel : call.caller_channel;
        const targetChannel = await message.client.channels.fetch(targetChannelId).catch(()=>null);
        if (!targetChannel) return;

        const embed = new EmbedBuilder()
          .setColor(0x7c7ce0)
          .setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL() })
          .setDescription(content)
          .setFooter({ text: `via DM` });

        await targetChannel.send({ embeds: [embed] }).catch(() => {});
        await message.react(PHONE_EMOJI).catch(() => {});
      } else {
        // Server Mode: Use webhooks to bridge channels
        const targetWebhook = isCaller ? call.target_webhook : call.caller_webhook;
        if (!targetWebhook) return;

        const webhookClient = new WebhookClient({ url: targetWebhook });
        await webhookClient.send({
          content: content,
          username: `${message.member?.displayName || message.author.username} (${message.guild?.name || "Unknown"})`,
          avatarURL: message.author.displayAvatarURL(),
          allowedMentions: { parse: [] }
        }).catch((err) => console.error("[phone] webhook failed:", err.message));

        await message.react(PHONE_EMOJI).catch(() => {});
      }
      
    } catch (err) {
      if (!err.message.includes("does not exist")) {
        console.error("[phone] interceptor error:", err.message);
      }
    }
  },
};
