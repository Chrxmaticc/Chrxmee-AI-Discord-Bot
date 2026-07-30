const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require("discord.js");

const E = {
  success: "<:Verified_Icon:1527194184841167010>",
  error: "<:no:1530373946795364362>",
  ai: "<:Chrxmaticc_AI:1480094799292928132>",
  settings: "<:Settings:1525601248278216725>",
  link: "<:Link:1525603398341103806>",
  announce: "<:Discord_Announcements:1526028541270167593>",
  crown: "<:Holographic_owner_crown:1527401510487461969>",
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("vanity")
    .setDescription("Manage your server's invite rep system")
    // Admin
    .addSubcommand(sub => sub.setName("setup")
      .setDescription("Set the invite link and trigger type")
      .addStringOption(opt => opt.setName("invite").setDescription("The invite link (e.g., /chrxmaticc)").setRequired(true).setMaxLength(100))
      .addStringOption(opt => opt.setName("trigger").setDescription("Where to look for the invite").setRequired(true)
        .addChoices(
          { name: "Status only", value: "status" },
          { name: "Both", value: "both" }
        ))
      .addIntegerOption(opt => opt.setName("amount").setDescription("Merit reward (default 100)").setRequired(false).setMinValue(1).setMaxValue(10000))
      .addIntegerOption(opt => opt.setName("cooldown").setDescription("Cooldown in hours (default 24)").setRequired(false).setMinValue(1).setMaxValue(168)))
    .addSubcommand(sub => sub.setName("announce")
      .setDescription("Set a channel & custom message for rep announcements")
      .addChannelOption(opt => opt.setName("channel").setDescription("Announcement channel").setRequired(true))
      .addStringOption(opt => opt.setName("message").setDescription("Custom message. Use {user} and {amount}").setRequired(false).setMaxLength(500)))
    .addSubcommand(sub => sub.setName("status").setDescription("View current vanity rep config"))
    // Public
    .addSubcommand(sub => sub.setName("check").setDescription("Check if someone is repping the invite right now")
      .addUserOption(opt => opt.setName("user").setDescription("Who to check (leave empty for yourself)").setRequired(false)))
    .addSubcommand(sub => sub.setName("top").setDescription("Who's currently repping the invite?")),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const pool = client.pool;
    const guild = interaction.guild;
    const guildId = guild.id;

    // ─── SETUP ──────────────────────────────────
    if (sub === "setup") {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
        return interaction.reply({ content: `${E.error} you need admin permissions lil bro.`, ephemeral: true });

      const invite = interaction.options.getString("invite");
      const trigger = interaction.options.getString("trigger");
      const amount = interaction.options.getInteger("amount") || 100;
      const cooldown = interaction.options.getInteger("cooldown") || 24;

      await pool.query(
        `INSERT INTO vanity_config (guild_id, invite_url, trigger_type, reward_amount, cooldown_hours)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (guild_id) DO UPDATE SET invite_url = $2, trigger_type = $3, reward_amount = $4, cooldown_hours = $5`,
        [guildId, invite, trigger, amount, cooldown]
      );

      const embed = new EmbedBuilder()
        .setColor(0x7c7ce0)
        .setTitle(`${E.settings} vanity rep configured`)
        .setDescription(`the invite rep system is now live.`)
        .addFields(
          { name: "Invite", value: invite, inline: true },
          { name: "Trigger", value: trigger, inline: true },
          { name: "Reward", value: `${amount} merits`, inline: true },
          { name: "Cooldown", value: `${cooldown}h`, inline: true }
        )
        .setFooter({ text: "Chrxmaticc AI · 炫克人工智能" });

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ─── ANNOUNCE ──────────────────────────────
    if (sub === "announce") {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
        return interaction.reply({ content: `${E.error} Admin only.`, ephemeral: true });

      const channel = interaction.options.getChannel("channel");
      const message = interaction.options.getString("message") || "🎉 **+{amount} merits** for repping the invite! Share daily for more.";

      await pool.query(
        `INSERT INTO vanity_config (guild_id, announce_channel, announce_message)
         VALUES ($1, $2, $3)
         ON CONFLICT (guild_id) DO UPDATE SET announce_channel = $2, announce_message = $3`,
        [guildId, channel.id, message]
      );

      const embed = new EmbedBuilder()
        .setColor(0x7c7ce0)
        .setTitle(`${E.announce} Rep Announcement Set`)
        .setDescription(`announcements will be sent to ${channel}`)
        .addFields({ name: "Message", value: message })
        .setFooter({ text: "Chrxmaticc AI · 炫克人工智能" });

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ─── STATUS ────────────────────────────────
    if (sub === "status") {
      const res = await pool.query(`SELECT * FROM vanity_config WHERE guild_id = $1`, [guildId]);
      if (!res.rows[0])
        return interaction.reply({ content: "vanity rep not configured yet. Use `/vanity setup`.", ephemeral: true });

      const cfg = res.rows[0];
      const embed = new EmbedBuilder()
        .setColor(0x7c7ce0)
        .setTitle(`${E.link} vanity rep configuration`)
        .addFields(
          { name: "Invite", value: cfg.invite_url, inline: true },
          { name: "Trigger", value: cfg.trigger_type, inline: true },
          { name: "Reward", value: `${cfg.reward_amount} merits`, inline: true },
          { name: "Cooldown", value: `${cfg.cooldown_hours}h`, inline: true },
          { name: "Announce Channel", value: cfg.announce_channel ? `<#${cfg.announce_channel}>` : "None", inline: true }
        )
        .setFooter({ text: "Chrxmaticc AI · 炫克人工智能" });

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ─── CHECK ─────────────────────────────────
    if (sub === "check") {
      const res = await pool.query(`SELECT invite_url FROM vanity_config WHERE guild_id = $1`, [guildId]);
      if (!res.rows[0])
        return interaction.reply({ content: "vanity rep is **NOT** configured. An admin must run `/vanity setup` first.", ephemeral: true });

      const target = interaction.options.getUser("user") || interaction.user;
      const member = await guild.members.fetch(target.id).catch(() => null);
      if (!member)
        return interaction.reply({ content: `${E.error} Couldn't find that member.`, ephemeral: true });

      // Check presence
      const hasInvite = (member.presence?.activities || [])
        .some(a => a.state?.toLowerCase().includes(res.rows[0].invite_url.toLowerCase()));

      const embed = new EmbedBuilder()
        .setColor(hasInvite ? 0x00ff00 : 0xff0000)
        .setDescription(
          hasInvite
            ? `${E.success} **${target.username}** is currently repping **${res.rows[0].invite_url}** in their goated status`
            : `${E.error} **${target.username}** is **NOT** repping the invite right now.`
        )
        .setFooter({ text: "Chrxmaticc AI · 炫克人工智能" });

      return interaction.reply({ embeds: [embed] });
    }

    // ─── TOP ───────────────────────────────────
    if (sub === "top") {
      const res = await pool.query(`SELECT invite_url FROM vanity_config WHERE guild_id = $1`, [guildId]);
      if (!res.rows[0])
        return interaction.reply({ content: "vanity rep not configured yet lil bro.", ephemeral: true });

      const invite = res.rows[0].invite_url.toLowerCase();

      // Collect members who are online & have the invite in their status
      const reps = [];
      for (const [, member] of guild.members.cache) {
        if (!member.presence) continue;
        const hasInvite = member.presence.activities.some(a => a.state?.toLowerCase().includes(invite));
        if (hasInvite) reps.push(member.user.username);
      }

      const embed = new EmbedBuilder()
        .setColor(0x7c7ce0)
        .setTitle(`${E.crown} currently repping ${invite}`)
        .setDescription(
          reps.length > 0
            ? reps.slice(0, 10).map((name, i) => `**${i + 1}.** ${name}`).join("\n")
            : "nobody is repping the invite right now. Be the first!"
        )
        .setFooter({ text: "Chrxmaticc AI · 炫克人工智能" });

      return interaction.reply({ embeds: [embed] });
    }
  },
};
