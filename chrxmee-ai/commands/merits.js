const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("merits")
    .setDescription("The official Chrxmaticc merit system")
    // Info
    .addSubcommand(sub => sub.setName("check").setDescription("Check your merit balance")
      .addUserOption(opt => opt.setName("user").setDescription("Check someone else").setRequired(false)))
    .addSubcommand(sub => sub.setName("leaderboard").setDescription("Top merit holders"))
    .addSubcommand(sub => sub.setName("rich").setDescription("Top 3 richest users"))
    // Earn
    .addSubcommand(sub => sub.setName("daily").setDescription("Claim your daily 50 merits"))
    // Transfer
    .addSubcommand(sub => sub.setName("give").setDescription("Give merits to someone (from your balance)")
      .addUserOption(opt => opt.setName("user").setDescription("Who to give to").setRequired(true))
      .addIntegerOption(opt => opt.setName("amount").setDescription("How many merits").setRequired(true).setMinValue(1))
      .addStringOption(opt => opt.setName("reason").setDescription("Reason").setRequired(false)))
    .addSubcommand(sub => sub.setName("pay").setDescription("Pay merits to someone (same as give)")
      .addUserOption(opt => opt.setName("user").setDescription("Who to pay").setRequired(true))
      .addIntegerOption(opt => opt.setName("amount").setDescription("How many merits").setRequired(true).setMinValue(1))
      .addStringOption(opt => opt.setName("reason").setDescription("What for?").setRequired(false)))
    // Gamble
    .addSubcommand(sub => sub.setName("steal").setDescription("50% chance to steal merits from someone")
      .addUserOption(opt => opt.setName("user").setDescription("Who to steal from").setRequired(true))
      .addIntegerOption(opt => opt.setName("amount").setDescription("How many to attempt").setRequired(true).setMinValue(1)))
    // Admin
    .addSubcommand(sub => sub.setName("add").setDescription("(Admin) Add merits — unlimited, no deduction")
      .addUserOption(opt => opt.setName("user").setDescription("Who to add to").setRequired(true))
      .addIntegerOption(opt => opt.setName("amount").setDescription("How many merits").setRequired(true).setMinValue(1))
      .addStringOption(opt => opt.setName("reason").setDescription("Reason").setRequired(false)))
    .addSubcommand(sub => sub.setName("remove").setDescription("(Admin) Remove merits")
      .addUserOption(opt => opt.setName("user").setDescription("Who to remove from").setRequired(true))
      .addIntegerOption(opt => opt.setName("amount").setDescription("How many merits").setRequired(true).setMinValue(1))
      .addStringOption(opt => opt.setName("reason").setDescription("Reason").setRequired(false)))
    .addSubcommand(sub => sub.setName("reset").setDescription("(Admin) Reset someone's merits to 0")
      .addUserOption(opt => opt.setName("user").setDescription("Who to reset").setRequired(true)))
    .addSubcommand(sub => sub.setName("set").setDescription("(Admin) Set exact merit amount")
      .addUserOption(opt => opt.setName("user").setDescription("Who to set").setRequired(true))
      .addIntegerOption(opt => opt.setName("amount").setDescription("Exact amount").setRequired(true).setMinValue(0)))
    // Config
    .addSubcommand(sub => sub.setName("config").setDescription("(Admin) Configure merit logging")
      .addStringOption(opt => opt.setName("action").setDescription("What to do").setRequired(true)
        .addChoices({ name: "Set Log Channel", value: "set" }, { name: "Disable Logging", value: "disable" }, { name: "View Config", value: "view" }))
      .addChannelOption(opt => opt.setName("channel").setDescription("Log channel (required for set)").setRequired(false))),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const pool = client.pool;
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);

    // Helper: log transaction
    async function logMerit(fromId, toId, amount, reason, type) {
      const config = await pool.query(`SELECT log_channel_id FROM merit_config WHERE guild_id = $1`, [guildId]);
      if (!config.rows[0]?.log_channel_id) return;
      const logChannel = interaction.guild.channels.cache.get(config.rows[0].log_channel_id);
      if (!logChannel) return;

      const fromUser = await client.users.fetch(fromId).catch(() => null);
      const toUser = await client.users.fetch(toId).catch(() => null);

      const embed = new EmbedBuilder()
        .setTitle(`📋 Merit Log — ${type}`)
        .setColor(type === "add" ? 0x00ff00 : type === "remove" ? 0xff0000 : type === "steal" ? 0xffaa00 : 0x9146ff)
        .addFields(
          { name: "From", value: fromUser ? `${fromUser.username}` : fromId, inline: true },
          { name: "To", value: toUser ? `${toUser.username}` : toId, inline: true },
          { name: "Amount", value: `${amount} merits`, inline: true },
          { name: "Reason", value: reason || "No reason" }
        )
        .setFooter({ text: `Server: ${interaction.guild.name}` })
        .setTimestamp();

      await logChannel.send({ embeds: [embed] }).catch(() => {});
    }

    // ==================== INFO ====================

    if (sub === "check") {
      const user = interaction.options.getUser("user") || interaction.user;
      const data = await pool.query(`SELECT user_merits.merits FROM user_merits WHERE user_id = $1 AND guild_id = $2`, [user.id, guildId]);
      const merits = data.rows[0]?.merits || 0;
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x9146ff).setAuthor({ name: user.username, iconURL: user.displayAvatarURL() }).setDescription(`**${merits}** merits`)] });
    }

    if (sub === "leaderboard") {
      const data = await pool.query(`SELECT user_id, merits FROM user_merits WHERE guild_id = $1 ORDER BY merits DESC LIMIT 10`, [guildId]);
      if (!data.rows.length) return interaction.reply("No one has merits yet.");
      const embed = new EmbedBuilder().setTitle("🏆 Merit Leaderboard").setColor(0x9146ff);
      let desc = "";
      for (let i = 0; i < data.rows.length; i++) {
        const u = await client.users.fetch(data.rows[i].user_id).catch(() => null);
        desc += `**${i + 1}.** ${u ? u.username : "Unknown"} — ${data.rows[i].merits} merits\n`;
      }
      embed.setDescription(desc);
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === "rich") {
      const data = await pool.query(`SELECT user_id, merits FROM user_merits WHERE guild_id = $1 ORDER BY merits DESC LIMIT 3`, [guildId]);
      if (!data.rows.length) return interaction.reply("No one has merits yet.");
      const medals = ["🥇", "🥈", "🥉"];
      const embed = new EmbedBuilder().setTitle("💎 Richest Users").setColor(0xf1c40f);
      let desc = "";
      for (let i = 0; i < data.rows.length; i++) {
        const u = await client.users.fetch(data.rows[i].user_id).catch(() => null);
        desc += `${medals[i]} **${u ? u.username : "Unknown"}** — ${data.rows[i].merits} merits\n`;
      }
      embed.setDescription(desc);
      return interaction.reply({ embeds: [embed] });
    }

    // ==================== EARN ====================

    if (sub === "daily") {
      const data = await pool.query(`SELECT merits, last_daily FROM user_merits WHERE user_id = $1 AND guild_id = $2`, [userId, guildId]);
      const now = new Date();
      const lastDaily = data.rows[0]?.last_daily;
      const cooldown = 24 * 60 * 60 * 1000;

      if (lastDaily && (now - new Date(lastDaily)) < cooldown) {
        const remaining = new Date(new Date(lastDaily).getTime() + cooldown);
        return interaction.reply({ content: `⏰ Already claimed! Come back <t:${Math.floor(remaining.getTime() / 1000)}:R>.`, ephemeral: true });
      }

      await pool.query(`INSERT INTO user_merits (user_id, guild_id, merits, last_daily) VALUES ($1, $2, 50, NOW()) ON CONFLICT (user_id, guild_id) DO UPDATE SET merits = user_merits.merits + 50, last_daily = NOW()`, [userId, guildId]);
      await logMerit(client.user.id, userId, 50, "Daily claim", "add");
      return interaction.reply("📅 **+50 daily merits** claimed! Come back in 24 hours.");
    }

    // ==================== TRANSFER ====================

    if (sub === "give" || sub === "pay") {
      const user = interaction.options.getUser("user");
      const amount = interaction.options.getInteger("amount");
      const reason = interaction.options.getString("reason") || (sub === "pay" ? "Payment" : "No reason");

      if (user.id === userId) return interaction.reply({ content: "❌ You can't give merits to yourself.", ephemeral: true });
      if (user.bot) return interaction.reply({ content: "❌ You can't give merits to bots.", ephemeral: true });

      if (!isAdmin) {
        const giverData = await pool.query(`SELECT merits FROM user_merits WHERE user_id = $1 AND guild_id = $2`, [userId, guildId]);
        const giverMerits = giverData.rows[0]?.merits || 0;
        if (giverMerits < amount) return interaction.reply({ content: `❌ You only have **${giverMerits}** merits.`, ephemeral: true });
        await pool.query(`UPDATE user_merits SET merits = user_merits.merits - $1 WHERE user_id = $2 AND guild_id = $3`, [amount, userId, guildId]);
      }

      await pool.query(`INSERT INTO user_merits (user_id, guild_id, merits) VALUES ($1, $2, $3) ON CONFLICT (user_id, guild_id) DO UPDATE SET merits = user_merits.merits + $3`, [user.id, guildId, amount]);

      await logMerit(userId, user.id, amount, reason, isAdmin ? "add" : "give");
      const prefix = isAdmin ? "🔓 (Admin)" : "";
      return interaction.reply(`${prefix} **${interaction.user.username}** gave **${amount} merits** to **${user.username}** — ${reason}`);
    }

    // ==================== GAMBLE ====================

    if (sub === "steal") {
      const target = interaction.options.getUser("user");
      const amount = interaction.options.getInteger("amount");

      if (target.id === userId) return interaction.reply({ content: "❌ You can't steal from yourself.", ephemeral: true });
      if (target.bot) return interaction.reply({ content: "❌ You can't steal from bots.", ephemeral: true });

      const targetData = await pool.query(`SELECT merits FROM user_merits WHERE user_id = $1 AND guild_id = $2`, [target.id, guildId]);
      const targetMerits = targetData.rows[0]?.merits || 0;
      if (targetMerits < amount) return interaction.reply({ content: `❌ **${target.username}** only has **${targetMerits}** merits.`, ephemeral: true });

      const thiefData = await pool.query(`SELECT merits FROM user_merits WHERE user_id = $1 AND guild_id = $2`, [userId, guildId]);
      const thiefMerits = thiefData.rows[0]?.merits || 0;
      if (thiefMerits < amount) return interaction.reply({ content: `❌ You need **${amount}** merits to attempt a steal. You have **${thiefMerits}**.`, ephemeral: true });

      const success = Math.random() < 0.5;

      if (success) {
        await pool.query(`UPDATE user_merits SET merits = user_merits.merits - $1 WHERE user_id = $2 AND guild_id = $3`, [amount, target.id, guildId]);
        await pool.query(`INSERT INTO user_merits (user_id, guild_id, merits) VALUES ($1, $2, $3) ON CONFLICT (user_id, guild_id) DO UPDATE SET merits = user_merits.merits + $3`, [userId, guildId, amount]);
        await logMerit(target.id, userId, amount, "Steal successful", "steal");
        return interaction.reply(`🦝 You stole **${amount} merits** from **${target.username}**!`);
      } else {
        await pool.query(`UPDATE user_merits SET merits = user_merits.merits - $1 WHERE user_id = $2 AND guild_id = $3`, [amount, userId, guildId]);
        await pool.query(`INSERT INTO user_merits (user_id, guild_id, merits) VALUES ($1, $2, $3) ON CONFLICT (user_id, guild_id) DO UPDATE SET merits = user_merits.merits + $3`, [target.id, guildId, amount]);
        await logMerit(userId, target.id, amount, "Steal failed — target got the merits", "steal");
        return interaction.reply(`🚨 You got caught! **${target.username}** took your **${amount} merits**!`);
      }
    }

    // ==================== ADMIN ====================

    if (sub === "add") {
      if (!isAdmin) return interaction.reply({ content: "❌ Admin only.", ephemeral: true });
      const user = interaction.options.getUser("user");
      const amount = interaction.options.getInteger("amount");
      const reason = interaction.options.getString("reason") || "Admin add";
      await pool.query(`INSERT INTO user_merits (user_id, guild_id, merits) VALUES ($1, $2, $3) ON CONFLICT (user_id, guild_id) DO UPDATE SET merits = user_merits.merits + $3`, [user.id, guildId, amount]);
      await logMerit(interaction.user.id, user.id, amount, reason, "add");
      return interaction.reply(`🔓 Added **${amount} merits** to **${user.username}** — ${reason}`);
    }

    if (sub === "remove") {
      if (!isAdmin) return interaction.reply({ content: "❌ Admin only.", ephemeral: true });
      const user = interaction.options.getUser("user");
      const amount = interaction.options.getInteger("amount");
      const reason = interaction.options.getString("reason") || "Admin remove";
      const data = await pool.query(`SELECT merits FROM user_merits WHERE user_id = $1 AND guild_id = $2`, [user.id, guildId]);
      const current = data.rows[0]?.merits || 0;
      const newAmount = Math.max(0, current - amount);
      await pool.query(`INSERT INTO user_merits (user_id, guild_id, merits) VALUES ($1, $2, $3) ON CONFLICT (user_id, guild_id) DO UPDATE SET merits = $3`, [user.id, guildId, newAmount]);
      await logMerit(user.id, interaction.user.id, amount, reason, "remove");
      return interaction.reply(`🔓 Removed **${amount} merits** from **${user.username}** (now ${newAmount}) — ${reason}`);
    }

    if (sub === "reset") {
      if (!isAdmin) return interaction.reply({ content: "❌ Admin only.", ephemeral: true });
      const user = interaction.options.getUser("user");
      await pool.query(`DELETE FROM user_merits WHERE user_id = $1 AND guild_id = $2`, [user.id, guildId]);
      await logMerit(user.id, interaction.user.id, 0, "Reset to 0", "remove");
      return interaction.reply(`🔓 Reset **${user.username}**'s merits to 0.`);
    }

    if (sub === "set") {
      if (!isAdmin) return interaction.reply({ content: "❌ Admin only.", ephemeral: true });
      const user = interaction.options.getUser("user");
      const amount = interaction.options.getInteger("amount");
      await pool.query(`INSERT INTO user_merits (user_id, guild_id, merits) VALUES ($1, $2, $3) ON CONFLICT (user_id, guild_id) DO UPDATE SET merits = $3`, [user.id, guildId, amount]);
      await logMerit(interaction.user.id, user.id, amount, `Set to ${amount}`, "add");
      return interaction.reply(`🔓 Set **${user.username}**'s merits to **${amount}**.`);
    }

    // ==================== CONFIG ====================

    if (sub === "config") {
      if (!isAdmin) return interaction.reply({ content: "❌ Admin only.", ephemeral: true });
      const action = interaction.options.getString("action");

      if (action === "set") {
        const channel = interaction.options.getChannel("channel");
        if (!channel) return interaction.reply({ content: "❌ Specify a channel.", ephemeral: true });
        await pool.query(`INSERT INTO merit_config (guild_id, log_channel_id) VALUES ($1, $2) ON CONFLICT (guild_id) DO UPDATE SET log_channel_id = $2`, [guildId, channel.id]);
        return interaction.reply(`✅ Merit logs will go to ${channel}.`);
      }

      if (action === "disable") {
        await pool.query(`UPDATE merit_config SET log_channel_id = NULL WHERE guild_id = $1`, [guildId]);
        return interaction.reply("✅ Merit logging disabled.");
      }

      if (action === "view") {
        const config = await pool.query(`SELECT log_channel_id FROM merit_config WHERE guild_id = $1`, [guildId]);
        if (!config.rows[0]?.log_channel_id) return interaction.reply("Merit logging not configured. Use `/merits config set`.");
        const channel = interaction.guild.channels.cache.get(config.rows[0].log_channel_id);
        return interaction.reply(`📋 Merit logs go to ${channel || "unknown channel"}.`);
      }
    }
  },
};
