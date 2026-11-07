// commands/phone.js
const { 
  SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, 
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, ChannelType 
} = require("discord.js");
const { Pool } = require("pg");

const PHONE_EMOJI = "<:Phone:1568008806124757094>";
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const userDialCooldown = new Map();   

async function ensureTables() {
  try {
    const oldCheck = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'phone_registry' AND column_name = 'channel_locked'
    `);
    if (oldCheck.rows.length === 0) {
      await pool.query(`DROP TABLE IF EXISTS phone_registry;`);
    }
  } catch (err) {}

  await pool.query(`
    CREATE TABLE IF NOT EXISTS phone_registry (
      owner_id TEXT PRIMARY KEY,
      type TEXT NOT NULL, -- 'global', 'server', or 'user'
      phone_number TEXT UNIQUE NOT NULL,
      channel_id TEXT,
      webhook_url TEXT,
      ping_role TEXT,
      use_threads BOOLEAN DEFAULT FALSE
    );
    CREATE TABLE IF NOT EXISTS active_calls (
      caller_id TEXT PRIMARY KEY,
      target_id TEXT NOT NULL,
      caller_webhook TEXT,
      target_webhook TEXT,
      caller_webhook_id TEXT,
      target_webhook_id TEXT,
      caller_channel TEXT,
      target_channel TEXT,
      caller_thread TEXT,
      target_thread TEXT,
      type TEXT NOT NULL, -- 'global', 'server', or 'user'
      started_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS blocked_numbers (
      owner_id TEXT,
      blocked_number TEXT,
      PRIMARY KEY(owner_id, blocked_number)
    );
    CREATE TABLE IF NOT EXISTS phone_history (
      id SERIAL PRIMARY KEY,
      caller_id TEXT,
      target_id TEXT,
      type TEXT,
      duration_seconds INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Force-add missing columns
  const fixQueries = [
    `ALTER TABLE active_calls ADD COLUMN IF NOT EXISTS caller_webhook_id TEXT;`,
    `ALTER TABLE active_calls ADD COLUMN IF NOT EXISTS target_webhook_id TEXT;`,
    `ALTER TABLE active_calls ADD COLUMN IF NOT EXISTS caller_thread TEXT;`,
    `ALTER TABLE active_calls ADD COLUMN IF NOT EXISTS target_thread TEXT;`,
    `ALTER TABLE active_calls ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ DEFAULT NOW();`
  ];
  for (const q of fixQueries) await pool.query(q).catch(() => {});
}
ensureTables().catch(console.error);

function formatPhone(input) {
  if (!input) return "";
  const clean = input.trim();
  const digits = clean.replace(/\D/g, "");
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return clean;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("phone")
    .setDescription("call people or servers")
    .addSubcommand((s) => s.setName("setup").setDescription("set up your phone (once)")
      .addStringOption((o) => o.setName("type").setDescription("global (server), server (user in channel), or user (DM)").setRequired(true)
        .addChoices(
          { name: "global", value: "global" },
          { name: "server", value: "server" },
          { name: "user (DMs)", value: "user" }
        ))
      .addChannelOption((o) => o.setName("channel").setDescription("channel for calls (required for global/server)").setRequired(false))
      .addRoleOption((o) => o.setName("ping").setDescription("role to ping for global calls").setRequired(false)))
    .addSubcommand((s) => s.setName("set-channel").setDescription("change your home channel (global/server only)")
      .addChannelOption((o) => o.setName("channel").setDescription("new home channel").setRequired(true)))
    .addSubcommand((s) => s.setName("set-number").setDescription("change your number")
      .addStringOption((o) => o.setName("number").setDescription("custom number").setRequired(true)))
    .addSubcommand((s) => s.setName("dial").setDescription("call a number, user, or server")
      .addStringOption((o) => o.setName("target").setDescription("Number, @user, user ID, or server ID").setRequired(true)))
    .addSubcommand((s) => s.setName("hangup").setDescription("end current call"))
    .addSubcommand((s) => s.setName("history").setDescription("view your recent call history"))
    .addSubcommand((s) => s.setName("block").setDescription("block a number")
      .addStringOption((o) => o.setName("number").setDescription("number to block").setRequired(true)))
    .addSubcommand((s) => s.setName("unblock").setDescription("unblock a number")
      .addStringOption((o) => o.setName("number").setDescription("number to unblock").setRequired(true))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    await interaction.deferReply({ ephemeral: false });

    async function resolveCaller() {
      const userPhone = await pool.query(`SELECT * FROM phone_registry WHERE owner_id = $1`, [`user:${interaction.user.id}`]);
      if (userPhone.rows[0]) return userPhone.rows[0];
      
      if (interaction.guildId) {
        const guildPhone = await pool.query(`SELECT * FROM phone_registry WHERE owner_id = $1`, [`guild:${interaction.guildId}`]);
        if (guildPhone.rows[0]) return guildPhone.rows[0];
      }
      return null;
    }

    if (sub === "setup") {
      const type = interaction.options.getString("type");
      const channel = interaction.options.getChannel("channel");
      const pingRole = interaction.options.getRole("ping");
      
      const owner = (type === "global") ? `guild:${interaction.guildId}` : `user:${interaction.user.id}`;
      
      const existing = await pool.query(`SELECT * FROM phone_registry WHERE owner_id = $1`, [owner]);
      if (existing.rows[0]) return interaction.editReply(`${PHONE_EMOJI} you already have a phone: \`${existing.rows[0].phone_number}\``);

      if (type === "global" && !interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return interaction.editReply("only admins can set up a global server phone.");
      }

      if ((type === "global" || type === "server") && !channel) {
        return interaction.editReply("you must provide a channel for global/server phones.");
      }

      let webhookUrl = null;
      if (type !== "user") {
        try {
          const webhooks = await channel.fetchWebhooks();
          const webhook = webhooks.find((wh) => wh.name === "Chromed Phone") || await channel.createWebhook({ name: "Chromed Phone" });
          webhookUrl = webhook.url;
        } catch {
          return interaction.editReply("i need `manage webhooks` in that channel.");
        }
      }

      const defaultNumber = type === "global" ? interaction.guildId : formatPhone(String(Math.floor(1000000000 + Math.random() * 9000000000)));

      await pool.query(
        `INSERT INTO phone_registry (owner_id, type, phone_number, channel_id, webhook_url, ping_role) VALUES ($1, $2, $3, $4, $5, $6)`,
        [owner, type, defaultNumber, channel?.id || null, webhookUrl, pingRole?.id || null]
      );

      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x57F287).setTitle(`${PHONE_EMOJI} ${type} phone ready`).setDescription(`**number:** \`${defaultNumber}\`\n${channel ? `**home channel:** <#${channel.id}>` : "*DMs enabled*"}`)] });
    }

    const caller = await resolveCaller();
    if (!caller) return interaction.editReply("you don't have a phone set up. run `/phone setup`.");
    
    const ownerId = caller.owner_id;

    if (sub === "set-channel") {
      if (caller.type === "user") return interaction.editReply("user phones do not use channels.");
      if (caller.type === "global" && !interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return interaction.editReply("only admins can change the global phone channel.");
      }

      const active = await pool.query(`SELECT 1 FROM active_calls WHERE caller_id = $1 OR target_id = $1`, [ownerId]);
      if (active.rows[0]) return interaction.editReply("you can't change channels while on an active call. hangup first.");

      const newChannel = interaction.options.getChannel("channel");
      let webhookUrl;
      try {
        const webhooks = await newChannel.fetchWebhooks();
        const webhook = webhooks.find((wh) => wh.name === "Chromed Phone") || await newChannel.createWebhook({ name: "Chromed Phone" });
        webhookUrl = webhook.url;
      } catch {
        return interaction.editReply("i need `manage webhooks` in that channel.");
      }

      await pool.query(`UPDATE phone_registry SET channel_id = $1, webhook_url = $2 WHERE owner_id = $3`, [newChannel.id, webhookUrl, ownerId]);
      return interaction.editReply(`${PHONE_EMOJI} home channel successfully moved to <#${newChannel.id}>.`);
    }

    if (sub === "set-number") {
      if (caller.type === "global") return interaction.editReply("global servers are locked to their guild ID.");
      const newNumber = formatPhone(interaction.options.getString("number"));
      const exists = await pool.query(`SELECT owner_id FROM phone_registry WHERE phone_number = $1`, [newNumber]);
      if (exists.rows[0]) return interaction.editReply("that number is taken.");
      await pool.query(`UPDATE phone_registry SET phone_number = $1 WHERE owner_id = $2`, [newNumber, ownerId]);
      return interaction.editReply(`${PHONE_EMOJI} number changed to \`${newNumber}\`.`);
    }

    if (sub === "block") {
      const num = formatPhone(interaction.options.getString("number"));
      await pool.query(`INSERT INTO blocked_numbers (owner_id, blocked_number) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [ownerId, num]);
      return interaction.editReply(`🚫 blocked \`${num}\`.`);
    }

    if (sub === "unblock") {
      const num = formatPhone(interaction.options.getString("number"));
      await pool.query(`DELETE FROM blocked_numbers WHERE owner_id = $1 AND blocked_number = $2`, [ownerId, num]);
      return interaction.editReply(`✅ unblocked \`${num}\`.`);
    }

    if (sub === "history") {
      const res = await pool.query(`SELECT * FROM phone_history WHERE caller_id = $1 OR target_id = $1 ORDER BY created_at DESC LIMIT 10`, [ownerId]);
      if (!res.rows.length) return interaction.editReply("no call history.");
      const lines = res.rows.map(r => {
        const isCaller = r.caller_id === ownerId;
        const dir = isCaller ? "Outgoing" : "Incoming";
        const time = Math.floor(new Date(r.created_at).getTime() / 1000);
        const mins = Math.floor(r.duration_seconds / 60);
        const secs = r.duration_seconds % 60;
        const other = isCaller ? r.target_id : r.caller_id;
        return `**${dir}** | <t:${time}:R> | \`${other}\` | ${mins}m ${secs}s`;
      });
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x7c7ce0).setTitle(`${PHONE_EMOJI} call history`).setDescription(lines.join("\n"))] });
    }

    if (sub === "hangup") {
      const res = await pool.query(`SELECT * FROM active_calls WHERE caller_id = $1 OR target_id = $1`, [ownerId]);
      if (!res.rows[0]) return interaction.editReply("you're not on a call.");
      const call = res.rows[0];
      
      const duration = Math.floor((Date.now() - new Date(call.started_at).getTime()) / 1000);
      await pool.query(`INSERT INTO phone_history (caller_id, target_id, type, duration_seconds) VALUES ($1, $2, $3, $4)`, [call.caller_id, call.target_id, call.type, duration]);
      
      // Fix: use client.fetchWebhook instead of ch.fetchWebhook
      if (call.caller_webhook_id) {
        const wh = await interaction.client.fetchWebhook(call.caller_webhook_id).catch(()=>null);
        if (wh) await wh.delete().catch(()=>{});
      }
      if (call.target_webhook_id) {
        const wh = await interaction.client.fetchWebhook(call.target_webhook_id).catch(()=>null);
        if (wh) await wh.delete().catch(()=>{});
      }

      await pool.query(`DELETE FROM active_calls WHERE caller_id = $1 OR target_id = $1`, [ownerId]);
      
      const thread = call.caller_id === ownerId ? call.caller_thread : call.target_thread;
      if (thread) {
        const th = await interaction.client.channels.fetch(thread).catch(() => null);
        if (th) await th.setArchived(true).catch(()=>{});
      }
      
      return interaction.editReply(`${PHONE_EMOJI} call ended. (${Math.floor(duration/60)}m ${duration%60}s)`);
    }

    if (sub === "dial") {
      const targetStr = interaction.options.getString("target").trim();
      
      const active = await pool.query(`SELECT * FROM active_calls WHERE caller_id = $1 OR target_id = $1`, [ownerId]);
      if (active.rows[0]) return interaction.editReply("you're already on a call.");

      const now = Date.now();
      if (userDialCooldown.has(targetStr) && now - userDialCooldown.get(targetStr) < 6000) {
        return interaction.editReply("wait a few seconds before calling them again.");
      }
      userDialCooldown.set(targetStr, now);

      let target = null;
      const mentionMatch = targetStr.match(/^<@!?(\d+)>$/);
      
      if (mentionMatch) {
        const tUserId = mentionMatch[1];
        const res = await pool.query(`SELECT * FROM phone_registry WHERE owner_id = $1`, [`user:${tUserId}`]);
        target = res.rows[0];
      } else if (/^\d{17,20}$/.test(targetStr)) {
        let res = await pool.query(`SELECT * FROM phone_registry WHERE phone_number = $1`, [targetStr]);
        if (!res.rows[0]) res = await pool.query(`SELECT * FROM phone_registry WHERE owner_id = $1`, [`user:${targetStr}`]);
        target = res.rows[0];
      } else {
        const num = formatPhone(targetStr);
        const res = await pool.query(`SELECT * FROM phone_registry WHERE phone_number = $1`, [num]);
        target = res.rows[0];
      }

      if (!target) return interaction.editReply("couldn't find that number or user.");
      if (target.owner_id === ownerId) return interaction.editReply("you can't call yourself.");

      const blocked = await pool.query(`SELECT 1 FROM blocked_numbers WHERE owner_id = $1 AND blocked_number = $2`, [target.owner_id, formatPhone(targetStr)]);
      if (blocked.rows[0]) return interaction.editReply("call blocked.");

      const busy = await pool.query(`SELECT 1 FROM active_calls WHERE caller_id = $1 OR target_id = $1`, [target.owner_id]);
      if (busy.rows[0]) return interaction.editReply("they are on another call (busy).");

      let targetChannel;
      if (target.type === "user") {
        const tUser = await interaction.client.users.fetch(target.owner_id.replace("user:", "")).catch(()=>null);
        if (!tUser) return interaction.editReply("target user not found.");
        targetChannel = await tUser.createDM();
      } else {
        targetChannel = await interaction.client.channels.fetch(target.channel_id).catch(()=>null);
      }
      if (!targetChannel) return interaction.editReply("target channel/DM is missing.");

      let callerWebhookUrl = caller.webhook_url;
      let callerWebhookId = null;
      let callerChannelId = caller.channel_id;

      if (caller.type === "user") {
        const cUser = await interaction.client.users.fetch(interaction.user.id);
        const dm = await cUser.createDM();
        callerChannelId = dm.id;
      } else {
        try {
          const webhooks = await interaction.channel.fetchWebhooks();
          const w = webhooks.find((wh) => wh.name === "Chromed Phone") || await interaction.channel.createWebhook({ name: "Chromed Phone" });
          callerWebhookUrl = w.url;
          callerWebhookId = w.id;
          callerChannelId = interaction.channelId;
        } catch {
          return interaction.editReply("i need `manage webhooks` in this channel to connect the call.");
        }
      }

      const ringId = `ring_${Date.now()}`;
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`accept_${ringId}`).setLabel("Accept").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`decline_${ringId}`).setLabel("Decline").setStyle(ButtonStyle.Danger)
      );

      const pingStr = target.type === "global" && target.ping_role ? `<@&${target.ping_role}>` : `<@${target.owner_id.replace("user:","")}>`;
      
      let ringMsg;
      try {
        ringMsg = await targetChannel.send({
          content: `${PHONE_EMOJI} **ayo ${pingStr}, ${interaction.user.username} is calling you!**`,
          components: [row]
        });
      } catch (err) {
        return interaction.editReply(`couldn't ring them. missing permissions in their channel/DM.`);
      }

      let btn;
      try {
        btn = await ringMsg.awaitMessageComponent({
          componentType: ComponentType.Button,
          time: 30_000,
          filter: (i) => {
            if (target.type === "global") return i.member.permissions.has(PermissionFlagsBits.ManageChannels);
            return i.user.id === target.owner_id.replace("user:", "");
          }
        });
      } catch (err) {
        await ringMsg.edit({ content: "📞 missed call.", components: [] }).catch(()=>{});
        return interaction.editReply("they didn't answer.");
      }

      if (btn.customId === `decline_${ringId}`) {
        await btn.update({ content: "📞 call declined.", components: [] });
        return interaction.editReply("call declined.");
      }

      try {
        await btn.deferUpdate();

        let callerThread = null;
        let targetThread = null;
        
        if (target.type !== "user") {
          const th = await targetChannel.threads.create({ name: `call-${interaction.user.username}`, autoArchiveDuration: 60, type: ChannelType.PrivateThread }).catch(async () => {
            return await targetChannel.threads.create({ name: `call-${interaction.user.username}`, autoArchiveDuration: 60, type: ChannelType.PublicThread });
          });
          targetThread = th.id;
          await th.members.add(target.owner_id.replace("user:","")).catch(()=>{});
        }

        const match = target.webhook_url?.match(/webhooks\/(\d+)\//);
        const targetWhId = match ? match[1] : null;

        await pool.query(
          `INSERT INTO active_calls (caller_id, target_id, caller_webhook, target_webhook, caller_webhook_id, target_webhook_id, caller_channel, target_channel, caller_thread, target_thread, type) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [ownerId, target.owner_id, callerWebhookUrl, target.webhook_url, callerWebhookId, targetWhId, callerChannelId, targetChannel.id, callerThread, targetThread, target.type]
        );

        await btn.editReply({ content: `${PHONE_EMOJI} call connected.`, components: [] });
        
        if (caller.type === "user") {
          return interaction.editReply(`${PHONE_EMOJI} **call connected with ${target.owner_id.replace("user:","")}**.\n\n👉 check your DMs to talk.`);
        } else {
          return interaction.editReply(`${PHONE_EMOJI} **call connected with ${target.owner_id.replace("user:","")}**.\n\n👉 you can talk right here in <#${interaction.channelId}>.`);
        }

      } catch (err) {
        console.error("[phone] accept error:", err);
        await btn.editReply({ content: "📞 call failed to connect.", components: [] }).catch(()=>{});
        return interaction.editReply(`call failed to connect: ${err.message}`);
      }
    }
  },
  _pool: pool,
};
