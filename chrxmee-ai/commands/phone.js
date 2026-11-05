// commands/phone.js
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const { Pool } = require("pg");

const PHONE_EMOJI = "<:Phone:1568008806124757094>";
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS phone_registry (
      guild_id TEXT PRIMARY KEY,
      channel_id TEXT NOT NULL,
      phone_number TEXT UNIQUE NOT NULL,
      webhook_url TEXT
    );
    CREATE TABLE IF NOT EXISTS active_calls (
      guild_id TEXT PRIMARY KEY,
      channel_id TEXT NOT NULL,
      target_guild_id TEXT NOT NULL,
      target_channel_id TEXT NOT NULL
    );
  `);
}
ensureTables().catch(console.error);

// Helper: 3-3-4 format, or fallback to regular
function formatPhone(input) {
  if (!input) return "";
  const clean = input.trim();
  const digits = clean.replace(/\D/g, "");
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return clean; // Regular fallback
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("phone")
    .setDescription("call people in other servers")
    .addSubcommand((s) =>
      s.setName("setup").setDescription("set up the phone in this channel")
    )
    .addSubcommand((s) =>
      s.setName("set-number")
        .setDescription("change your phone number")
        .addStringOption((o) => o.setName("number").setDescription("custom number (10 digits for 3-3-4 layout)").setRequired(true))
    )
    .addSubcommand((s) =>
      s.setName("dial")
        .setDescription("call a number, mention, or ID")
        .addStringOption((o) => o.setName("target").setDescription("Phone number, @user, user ID, or server ID").setRequired(true))
    )
    .addSubcommand((s) => s.setName("hangup").setDescription("end the current call"))
    .addSubcommand((s) => s.setName("number").setDescription("see your current phone number")),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const channel = interaction.channel;
    await interaction.deferReply();

    if (sub === "setup") {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return interaction.editReply("you need `manage channels` to set this up.");
      }

      let webhook;
      try {
        const webhooks = await channel.fetchWebhooks();
        webhook = webhooks.find((wh) => wh.owner.id === interaction.client.user.id);
        if (!webhook) {
          webhook = await channel.createWebhook({
            name: "Chromed Phone",
            avatar: interaction.client.user.displayAvatarURL(),
          });
        }
      } catch (err) {
        return interaction.editReply("i need the `manage webhooks` permission in this channel.");
      }

      const randomDigits = String(Math.floor(1000000000 + Math.random() * 9000000000));
      const defaultNumber = formatPhone(randomDigits);

      await pool.query(
        `INSERT INTO phone_registry (guild_id, channel_id, phone_number, webhook_url)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (guild_id) DO UPDATE SET 
         channel_id = $2, webhook_url = $4`,
        [guildId, channel.id, defaultNumber, webhook.url]
      );

      const res = await pool.query(`SELECT phone_number FROM phone_registry WHERE guild_id = $1`, [guildId]);

      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle(`${PHONE_EMOJI} phone ready`)
            .setDescription(`this channel is now the phone booth.\n\n**your number:** \`${res.rows[0].phone_number}\`\n\nchange it anytime with \`/phone set-number\`.`)
        ]
      });
    }

    if (sub === "set-number") {
      const rawInput = interaction.options.getString("number");
      const newNumber = formatPhone(rawInput);
      
      if (newNumber.length > 20) return interaction.editReply("number too long (max 20 chars).");

      // Check if the exact number exists, or if a stripped version exists (to prevent duplicates)
      const exists = await pool.query(`SELECT guild_id FROM phone_registry WHERE phone_number = $1`, [newNumber]);
      if (exists.rows[0]) return interaction.editReply("that number is already taken by another server.");

      await pool.query(`UPDATE phone_registry SET phone_number = $1 WHERE guild_id = $2`, [newNumber, guildId]);
      return interaction.editReply(`${PHONE_EMOJI} your new number is \`${newNumber}\`.`);
    }

    if (sub === "number") {
      const res = await pool.query(`SELECT phone_number FROM phone_registry WHERE guild_id = $1`, [guildId]);
      if (!res.rows[0]) return interaction.editReply("this server doesn't have a phone. use `/phone setup`.");
      return interaction.editReply(`${PHONE_EMOJI} your number is \`${res.rows[0].phone_number}\`.`);
    }

    if (sub === "dial") {
      const targetStr = interaction.options.getString("target").trim();
      
      const active = await pool.query(`SELECT * FROM active_calls WHERE guild_id = $1`, [guildId]);
      if (active.rows[0]) return interaction.editReply("you're already on a call. use `/phone hangup` first.");

      const myWebhook = await pool.query(`SELECT webhook_url FROM phone_registry WHERE guild_id = $1`, [guildId]);
      if (!myWebhook.rows[0]?.webhook_url) return interaction.editReply("setup your own phone first with `/phone setup`.");

      let targetServer = null;

      // 1. Is it a mention?
      const mentionMatch = targetStr.match(/^<@!?(\d+)>$/);
      if (mentionMatch) {
        const userId = mentionMatch[1];
        const allPhones = await pool.query(`SELECT * FROM phone_registry`);
        for (const row of allPhones.rows) {
          const g = interaction.client.guilds.cache.get(row.guild_id);
          if (g && g.members.cache.has(userId)) { targetServer = row; break; }
        }
      } 
      // 2. Is it a server ID or user ID? (17-20 digits)
      else if (/^\d{17,20}$/.test(targetStr)) {
        const res = await pool.query(`SELECT * FROM phone_registry WHERE guild_id = $1`, [targetStr]);
        if (res.rows[0]) targetServer = res.rows[0];
        
        if (!targetServer) {
          const allPhones = await pool.query(`SELECT * FROM phone_registry`);
          for (const row of allPhones.rows) {
            const g = interaction.client.guilds.cache.get(row.guild_id);
            if (g && g.members.cache.has(targetStr)) { targetServer = row; break; }
          }
        }
      } 
      // 3. Is it a phone number?
      else {
        // Format it in case they typed 10 digits without dashes
        const formattedTarget = formatPhone(targetStr);
        let res = await pool.query(`SELECT * FROM phone_registry WHERE phone_number = $1`, [formattedTarget]);
        
        // If not found, try raw string (for custom numbers)
        if (!res.rows[0]) {
          res = await pool.query(`SELECT * FROM phone_registry WHERE phone_number = $1`, [targetStr.toLowerCase()]);
        }
        if (res.rows[0]) targetServer = res.rows[0];
      }

      if (!targetServer) return interaction.editReply("couldn't find that number, user, or server.");
      if (targetServer.guild_id === guildId) return interaction.editReply("you can't call yourself twin.");

      const targetActive = await pool.query(`SELECT * FROM active_calls WHERE guild_id = $1`, [targetServer.guild_id]);
      if (targetActive.rows[0]) return interaction.editReply("that server is already on another call (busy signal).");

      await pool.query(
        `INSERT INTO active_calls (guild_id, channel_id, target_guild_id, target_channel_id) VALUES ($1, $2, $3, $4), ($3, $4, $1, $2)`,
        [guildId, channel.id, targetServer.guild_id, targetServer.channel_id]
      );

      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle(`${PHONE_EMOJI} call connected`)
            .setDescription(`connected to \`${targetServer.phone_number}\`.\n\nanything you type here will be sent to their server. use \`/phone hangup\` to end it.`)
        ]
      });
    }

    if (sub === "hangup") {
      const res = await pool.query(`SELECT * FROM active_calls WHERE guild_id = $1`, [guildId]);
      if (!res.rows[0]) return interaction.editReply("you're not on a call.");

      await pool.query(`DELETE FROM active_calls WHERE guild_id = $1 OR guild_id = $2`, [guildId, res.rows[0].target_guild_id]);
      return interaction.editReply(`${PHONE_EMOJI} call ended.`);
    }
  },
  _pool: pool,
};
