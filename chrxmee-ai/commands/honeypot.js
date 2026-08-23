const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} = require("discord.js");

const E = {
  success: "<:Verified_Icon:1527194184841167010>",
  error: "<:no:1530373946795364362>",
  settings: "<:Settings:1525601248278216725>",
  admin: "<:Admin_Badge:1527194281234665622>",
  hammer: "<:hammer:1530375976381448303>",
  lock: "<:lock:1530377198324945056>",
  unlock: "<:unlock:1530377714995826831>",
  angry: "<:angry_cry:1526029511882440744>",
  honey: "<:HoneyPot:1541219616188010586>",
  honey2: "<:Honey_Pot:1541220203994685460>",
};

async function ensureSchema(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS honeypot_config (
      guild_id TEXT PRIMARY KEY,
      enabled BOOLEAN DEFAULT FALSE,
      channel_id TEXT,
      punishment_type TEXT DEFAULT 'ban',
      threshold INTEGER DEFAULT 1,
      mute_minutes INTEGER DEFAULT 10,
      ban_duration_minutes INTEGER,
      warning_message TEXT DEFAULT 'warning: this channel is a honeypot. leave before you get caught.',
      activation_message TEXT DEFAULT 'honeypot triggered. you fell for it.',
      last_updated_by TEXT,
      last_updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS honeypot_strikes (
      guild_id TEXT,
      channel_id TEXT,
      user_id TEXT,
      strike_count INTEGER DEFAULT 0,
      last_strike_at TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (guild_id, channel_id, user_id)
    )
  `);
}

async function getConfig(pool, guildId) {
  const res = await pool.query(`SELECT * FROM honeypot_config WHERE guild_id = $1`, [guildId]);
  if (!res.rows[0]) {
    await pool.query(`INSERT INTO honeypot_config (guild_id) VALUES ($1) ON CONFLICT DO NOTHING`, [guildId]);
    const fresh = await pool.query(`SELECT * FROM honeypot_config WHERE guild_id = $1`, [guildId]);
    return fresh.rows[0];
  }
  return res.rows[0];
}

async function saveConfig(pool, guildId, updates) {
  const keys = Object.keys(updates);
  if (!keys.length) return;
  const set = keys.map((k, i) => `${k} = $${i + 2}`).join(", ");
  const values = [guildId, ...keys.map(k => updates[k])];
  await pool.query(`UPDATE honeypot_config SET ${set} WHERE guild_id = $1`, values);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("honeypot")
    .setDescription("set up a honeypot channel to catch rule breakers")
    .addSubcommand((sub) =>
      sub
        .setName("setup")
        .setDescription("create a honeypot in a channel")
        .addChannelOption(opt =>
          opt.setName("channel").setDescription("the honeypot channel").setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName("punishment").setDescription("punishment type").setRequired(true)
            .addChoices(
              { name: "ban", value: "ban" },
              { name: "kick", value: "kick" },
              { name: "mute", value: "mute" }
            )
        )
        .addIntegerOption(opt =>
          opt.setName("threshold").setDescription("messages before punishment (1 = instant)").setRequired(false)
        )
        .addIntegerOption(opt =>
          opt.setName("mute_minutes").setDescription("mute duration in minutes (for mute punishment)").setRequired(false)
        )
        .addIntegerOption(opt =>
          opt.setName("ban_duration_minutes").setDescription("temporary ban duration in minutes (omit for permanent)").setRequired(false)
        )
        .addStringOption(opt =>
          opt.setName("warning_message").setDescription("custom warning for first message when threshold > 1").setRequired(false)
        )
        .addStringOption(opt =>
          opt.setName("activation_message").setDescription("message sent when punishment triggers").setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("disable").setDescription("disable honeypot")
    )
    .addSubcommand((sub) =>
      sub.setName("status").setDescription("view honeypot config")
    ),

  async execute(interaction) {
    const client = interaction.client;
    const pool = client.pool;
    const guild = interaction.guild;
    if (!guild) return;

    const isButtonSim = interaction.isButton && interaction.isButton();
    if (!isButtonSim) {
      try { await interaction.deferReply(); } catch {}
    }

    const sub = interaction.options.getSubcommand();
    const guildId = guild.id;
    const userId = interaction.user.id;

    await ensureSchema(pool);
    const config = await getConfig(pool, guildId);

    if (sub === "setup") {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        return interaction.editReply(`${E.error} you need manage messages to set up a honeypot.`);
      }

      const channel = interaction.options.getChannel("channel");
      const punishment = interaction.options.getString("punishment");
      const threshold = interaction.options.getInteger("threshold") || 1;
      const muteMinutes = interaction.options.getInteger("mute_minutes") || 10;
      const banDuration = interaction.options.getInteger("ban_duration_minutes") || null;
      const warningMsg = interaction.options.getString("warning_message") || config.warning_message;
      const activationMsg = interaction.options.getString("activation_message") || config.activation_message;

      await saveConfig(pool, guildId, {
        enabled: true,
        channel_id: channel.id,
        punishment_type: punishment,
        threshold,
        mute_minutes: muteMinutes,
        ban_duration_minutes: banDuration,
        warning_message: warningMsg,
        activation_message: activationMsg,
        last_updated_by: userId,
        last_updated_at: new Date(),
      });

      const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle(`${E.honey} honeypot activated ${E.honey2}`)
        .setDescription(`channel: <#${channel.id}>\npunishment: **${punishment}**\nthreshold: **${threshold}**\nmute duration: **${muteMinutes} min**\nban duration: **${banDuration ? banDuration + " min" : "permanent"}**`)
        .addFields(
          { name: "warning message", value: warningMsg },
          { name: "activation message", value: activationMsg }
        )
        .setFooter({ text: "honeypot is live — stay sharp" });

      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === "disable") {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        return interaction.editReply(`${E.error} you need manage messages to disable honeypot.`);
      }
      await saveConfig(pool, guildId, { enabled: false });
      return interaction.editReply(`${E.success} honeypot disabled.`);
    }

    if (sub === "status") {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        return interaction.editReply(`${E.error} you need manage messages to view honeypot status.`);
      }
      const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle(`${E.honey} honeypot status ${E.honey2}`)
        .addFields(
          { name: "enabled", value: config.enabled ? " yes" : " no", inline: true },
          { name: "channel", value: config.channel_id ? `<#${config.channel_id}>` : "not set", inline: true },
          { name: "punishment", value: config.punishment_type, inline: true },
          { name: "threshold", value: config.threshold.toString(), inline: true },
          { name: "mute minutes", value: config.mute_minutes.toString(), inline: true },
          { name: "ban duration", value: config.ban_duration_minutes ? `${config.ban_duration_minutes} min` : "permanent", inline: true }
        );
      return interaction.editReply({ embeds: [embed] });
    }

    return interaction.editReply(`${E.error} unknown subcommand.`);
  },
};
