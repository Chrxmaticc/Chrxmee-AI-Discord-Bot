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
      type TEXT NOT NULL,
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
      type TEXT NOT NULL,
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
      .addStringOption((o) => o.setName("type").setDescription("setup a user phone or a server phone").setRequired(true)
        .addChoices(
          { name: "user", value: "user" },
          { name: "server", value: "server" }
        ))
      .addChannelOption((o) => o.setName("channel").setDescription("home channel (where calls ring)").setRequired(true))
      .addRoleOption((o) => o.setName("ping").setDescription("role to ping for server calls").setRequired(false)))
    .addSubcommand((s) => s.setName("set-channel").setDescription("change your home channel (where calls ring)")
      .addChannelOption((o) => o.setName("channel").setDescription("new home channel").setRequired(true)))
    .addSubcommand((s) => s.setName("settings").setDescription("toggle hidden threads for 1-on-1 calls"))
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
      
      const owner = type === "server" ? `guild:${interaction.guildId}` : `user:${interaction.user.id}`;
      
      const existing = await pool.query(`SELECT * FROM phone_registry WHERE owner_id = $1`, [owner]);
      if (existing.rows[0]) return interaction.editReply(`${PHONE_EMOJI} you already have a phone: \`${existing.rows[0].phone_number}\``);

      if (type === "server" && !interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return interaction.editReply("only admins can set up a server phone.");
      }

      let webhook;
      try {
        const webhooks = await channel.fetchWebhooks();
        // Find existing or create new
        webhook = webhooks.find((wh) => wh.name === "Chromed Phone") || await channel.createWebhook({ name: "Chromed Phone" });
      } catch (err) {
        return interaction.editReply(`i need \`manage webhooks\` in <#${channel.id}>.`);
      }

      const defaultNumber = type === "server" ? interaction.guildId : formatPhone(String(Math.floor(1000000000 + Math.random() * 9000000000)));

      await pool.query(
        `INSERT INTO phone_registry (owner_id, type, phone_number, channel_id, webhook_url, ping_role) VALUES ($1, $2, $3, $4, $5, $6)`,
        [owner, type, defaultNumber, channel.id, webhook.url, pingRole?.id || null]
      );

      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x57F287).setTitle(`${PHONE_EMOJI} ${type} phone ready`).setDescription(`**number:** \`${defaultNumber}\`\n**home channel:** <#${channel.id}>`)] });
    }

    const caller = await resolveCaller();
    if (!caller) return interaction.editReply("you don't have a phone set up. run `/phone setup`.");
    
    const ownerId = caller.owner_id;

    if (sub === "set-channel") {
      if (caller.type === "guild" && !interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return interaction.editReply("only admins can change the server phone channel.");
      }

      const active = await pool.query(`SELECT 1 FROM active_calls WHERE caller_id = $1 OR target_id = $1`, [ownerId]);
      if (active.rows[0]) return interaction.editReply("you can't change channels while on an active call. hangup first.");

      const newChannel = interaction.options.getChannel("channel");
      
      let webhook;
      try {
        const webhooks = await newChannel.fetchWebhooks();
        webhook = webhooks.find((wh) => wh.name === "Chromed Phone") || await newChannel.createWebhook({ name: "Chromed Phone" });
      } catch {
        return interaction.editReply("i need `manage webhooks` in that channel.");
      }

      await pool.query(`UPDATE phone_registry SET channel_id = $1, webhook_url = $2 WHERE owner_id = $3`, [newChannel.id, webhook.url, ownerId]);
      return interaction.editReply(`${PHONE_EMOJI} home channel successfully moved to <#${newChannel.id}>.`);
    }

    if (sub === "settings") {
      if (caller.type === "guild") return interaction.editReply("this setting is only for user phones.");
      const newVal = !caller.use_threads;
      await pool.query(`UPDATE phone_registry SET use_threads = $1 WHERE owner_id = $2`, [newVal, ownerId]);
      return interaction.editReply(`${PHONE_EMOJI} hidden threads for calls are now **${newVal ? "ON" : "OFF"}**.`);
    }

    if (sub === "set-number") {
      if (caller.type === "guild") return interaction.editReply("servers are locked to their guild ID.");
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
      
      if (call.caller_webhook_id) {
        const ch = await interaction.client.channels.fetch(call.caller_channel).catch(()=>null);
        const wh = await ch?.fetchWebhook(call.caller_webhook_id).catch(()=>null);
        if (wh) await wh.delete().catch(()=>{});
      }
      if (call.target_webhook_id) {
        const ch = await interaction.client.channels.fetch(call.target_channel).catch(()=>null);
        const wh = await ch?.fetchWebhook(call.target_webhook_id).catch(()=>null);
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
      if (!interaction.guild) return interaction.editReply("you must run dial in a server channel so i can bridge the call.");
      
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
        const res = await pool.query(`SELECT * FROM phone_registry WHERE owner_id = $1 AND type = 'user'`, [`user:${tUserId}`]);
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

      // Fetch target channel to send the ring
      const targetChannel = await interaction.client.channels.fetch(target.channel_id).catch(()=>null);
      if (!targetChannel) return interaction.editReply("target's home channel is missing or i don't have access to it.");

      // Make sure the bot has a webhook in the channel it's calling FROM
      let callerWebhook;
      try {
        const webhooks = await interaction.channel.fetchWebhooks();
        callerWebhook = webhooks.find((wh) => wh.name === "Chromed Phone") || await interaction.channel.createWebhook({ name: "Chromed Phone" });
      } catch {
        return interaction.editReply("i need `manage webhooks` in this channel to connect the call.");
      }

      const callType = target.type === "guild" ? "guild" : "user";
      const ringId = `ring_${Date.now()}`;
      
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`accept_${ringId}`).setLabel("Accept").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`decline_${ringId}`).setLabel("Decline").setStyle(ButtonStyle.Danger)
      );

      const pingStr = target.type === "guild" && target.ping_role ? `<@&${target.ping_role}>` : `<@${target.owner_id.replace("user:","")}>`;
      
      // Send ring message
      let ringMsg;
      try {
        ringMsg = await targetChannel.send({
          content: `${PHONE_EMOJI} **ayo ${pingStr}, ${interaction.user.username} is calling you!**`,
          components: [row]
        });
      } catch (err) {
        return interaction.editReply(`couldn't ring them. missing send message permissions in <#${target.channel_id}>.`);
      }

      // ── AWAIT ACCEPT ──
      let btn;
      try {
        btn = await ringMsg.awaitMessageComponent({
          componentType: ComponentType.Button,
          time: 30_000, // 30 seconds to answer
          filter: (i) => {
            if (target.type === "guild") return i.member.permissions.has(PermissionFlagsBits.ManageChannels);
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

      // ── ACCEPT LOGIC ──
      try {
        // Acknowledge immediately to stop the 3-second timeout!
        await btn.deferUpdate();

        let callerThread = null;
        let targetThread = null;
        
        const useThreads = callType === "user" && (caller.use_threads || target.use_threads);

        if (useThreads) {
          const th = await targetChannel.threads.create({ name: `call-${interaction.user.username}`, autoArchiveDuration: 60, type: ChannelType.PrivateThread }).catch(async () => {
            return await targetChannel.threads.create({ name: `call-${interaction.user.username}`, autoArchiveDuration: 60, type: ChannelType.PublicThread });
          });
          targetThread = th.id;
          await th.members.add(target.owner_id.replace("user:","")).catch(()=>{});
        }

        const match = target.webhook_url.match(/webhooks\/(\d+)\//);
        const targetWhId = match ? match[1] : null;

        await pool.query(
          `INSERT INTO active_calls (caller_id, target_id, caller_webhook, target_webhook, caller_webhook_id, target_webhook_id, caller_channel, target_channel, caller_thread, target_thread, type) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [ownerId, target.owner_id, callerWebhook.url, target.webhook_url, callerWebhook.id, targetWhId, interaction.channelId, target.channel_id, callerThread, targetThread, callType]
        );

        // Update the ring message
        await btn.editReply({ content: `${PHONE_EMOJI} call connected.`, components: [] });
        
        // Tell the caller it connected
        return interaction.editReply(`${PHONE_EMOJI} **call connected with ${target.owner_id.replace("user:","")}**.\n\n👉 you can talk right here in <#${interaction.channelId}>.`);

      } catch (err) {
        console.error("[phone] accept error:", err);
        await btn.editReply({ content: "📞 call failed to connect.", components: [] }).catch(()=>{});
        return interaction.editReply(`call failed to connect: ${err.message}`);
      }
    }
  },
  _pool: pool,
};
