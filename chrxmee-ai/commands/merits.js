const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require("discord.js");

const E = {
  success: "<:Verified_Icon:1527194184841167010>",
  error: "<:no:1530373946795364362>",
  ai: "<:Chrxmaticc_AI:1480094799292928132>",
  agree: "<:agreed:1525639597135237131>",
  angry: "<:angry_cry:1526029511882440744>",
  sneaky: "<:sneaky:1527401423690792970>",
  money_cry: "<:Money_Cry_Son:1526538340264841257>",
  crown: "<:Holographic_owner_crown:1527401510487461969>",
  hammer: "<:hammer:1530375976381448303>",
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("merits")
    .setDescription("the official chromed merit system")
    .addSubcommand(sub => sub.setName("check").setDescription("check your merit balance")
      .addUserOption(opt => opt.setName("user").setDescription("check someone else").setRequired(false)))
    .addSubcommand(sub => sub.setName("leaderboard").setDescription("top merit holders"))
    .addSubcommand(sub => sub.setName("rich").setDescription("top 3 richest users"))
    .addSubcommand(sub => sub.setName("daily").setDescription("claim your daily 50 merits"))
    .addSubcommand(sub => sub.setName("give").setDescription("give merits to someone (from your balance)")
      .addUserOption(opt => opt.setName("user").setDescription("who to give to").setRequired(true))
      .addIntegerOption(opt => opt.setName("amount").setDescription("how many merits").setRequired(true).setMinValue(1))
      .addStringOption(opt => opt.setName("reason").setDescription("reason").setRequired(false)))
    .addSubcommand(sub => sub.setName("pay").setDescription("pay merits to someone (same as give)")
      .addUserOption(opt => opt.setName("user").setDescription("who to pay").setRequired(true))
      .addIntegerOption(opt => opt.setName("amount").setDescription("how many merits").setRequired(true).setMinValue(1))
      .addStringOption(opt => opt.setName("reason").setDescription("what for?").setRequired(false)))
    .addSubcommand(sub => sub.setName("steal").setDescription("50% chance to steal merits from someone")
      .addUserOption(opt => opt.setName("user").setDescription("who to steal from").setRequired(true))
      .addIntegerOption(opt => opt.setName("amount").setDescription("how many to attempt").setRequired(true).setMinValue(1)))
    .addSubcommand(sub => sub.setName("add").setDescription("(admin) add merits — unlimited, no deduction")
      .addUserOption(opt => opt.setName("user").setDescription("who to add to").setRequired(true))
      .addIntegerOption(opt => opt.setName("amount").setDescription("how many merits").setRequired(true).setMinValue(1))
      .addStringOption(opt => opt.setName("reason").setDescription("reason").setRequired(false)))
    .addSubcommand(sub => sub.setName("remove").setDescription("(admin) remove merits")
      .addUserOption(opt => opt.setName("user").setDescription("who to remove from").setRequired(true))
      .addIntegerOption(opt => opt.setName("amount").setDescription("how many merits").setRequired(true).setMinValue(1))
      .addStringOption(opt => opt.setName("reason").setDescription("reason").setRequired(false)))
    .addSubcommand(sub => sub.setName("reset").setDescription("(admin) reset someone's merits to 0")
      .addUserOption(opt => opt.setName("user").setDescription("who to reset").setRequired(true)))
    .addSubcommand(sub => sub.setName("set").setDescription("(admin) set exact merit amount")
      .addUserOption(opt => opt.setName("user").setDescription("who to set").setRequired(true))
      .addIntegerOption(opt => opt.setName("amount").setDescription("exact amount").setRequired(true).setMinValue(0)))
    .addSubcommand(sub => sub.setName("config").setDescription("(admin) configure merit logging")
      .addStringOption(opt => opt.setName("action").setDescription("what to do").setRequired(true)
        .addChoices(
          { name: "set log channel", value: "set" },
          { name: "disable logging", value: "disable" },
          { name: "view config", value: "view" },
          { name: "toggle xp link", value: "xp" }
        ))
      .addChannelOption(opt => opt.setName("channel").setDescription("log channel (required for set)").setRequired(false))
      .addBooleanOption(opt => opt.setName("enabled").setDescription("enable/disable xp link").setRequired(false))
    ),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const pool = client.pool;
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);

    // helper: log transaction
    async function logMerit(fromId, toId, amount, reason, type) {
      const config = await pool.query(`SELECT log_channel_id FROM merit_config WHERE guild_id = $1`, [guildId]);
      if (!config.rows[0]?.log_channel_id) return;
      const logChannel = interaction.guild.channels.cache.get(config.rows[0].log_channel_id);
      if (!logChannel) return;

      const fromUser = await client.users.fetch(fromId).catch(() => null);
      const toUser = await client.users.fetch(toId).catch(() => null);

      const embed = new EmbedBuilder()
        .setTitle(`${E.hammer} merit log — ${type}`)
        .setColor(type === "add" ? 0x57f287 : type === "remove" ? 0xff0000 : type === "steal" ? 0xffaa00 : 0x7c7ce0)
        .addFields(
          { name: "from", value: fromUser ? fromUser.username : fromId, inline: true },
          { name: "to", value: toUser ? toUser.username : toId, inline: true },
          { name: "amount", value: `${amount} merits`, inline: true },
          { name: "reason", value: reason || "no reason" }
        )
        .setFooter({ text: `server: ${interaction.guild.name}` })
        .setTimestamp();

      await logChannel.send({ embeds: [embed] }).catch(() => {});
    }

    // ==================== INFO ====================

    if (sub === "check") {
      const user = interaction.options.getUser("user") || interaction.user;
      const data = await pool.query(
        `SELECT merits FROM user_merits WHERE user_id = $1 AND guild_id = $2`,
        [user.id, guildId]
      );
      const merits = data.rows[0]?.merits || 0;
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0x7c7ce0)
          .setAuthor({ name: user.username, iconURL: user.displayAvatarURL() })
          .setDescription(`${E.success} **${merits}** merits`)]
      });
    }

    if (sub === "leaderboard") {
      const data = await pool.query(
        `SELECT user_id, merits FROM user_merits WHERE guild_id = $1 ORDER BY merits DESC LIMIT 10`,
        [guildId]
      );
      if (!data.rows.length) return interaction.reply(`${E.error} no one has merits yet.`);
      const embed = new EmbedBuilder()
        .setTitle(`${E.crown} merit leaderboard`)
        .setColor(0x7c7ce0);
      let desc = "";
      for (let i = 0; i < data.rows.length; i++) {
        const u = await client.users.fetch(data.rows[i].user_id).catch(() => null);
        desc += `**${i + 1}.** ${u ? u.username : "unknown"} — ${data.rows[i].merits} merits\n`;
      }
      embed.setDescription(desc);
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === "rich") {
      const data = await pool.query(
        `SELECT user_id, merits FROM user_merits WHERE guild_id = $1 ORDER BY merits DESC LIMIT 3`,
        [guildId]
      );
      if (!data.rows.length) return interaction.reply(`${E.error} no one has merits yet.`);
      const medals = ["🥇", "🥈", "🥉"];
      const embed = new EmbedBuilder()
        .setTitle(`${E.crown} richest users`)
        .setColor(0x7c7ce0);
      let desc = "";
      for (let i = 0; i < data.rows.length; i++) {
        const u = await client.users.fetch(data.rows[i].user_id).catch(() => null);
        desc += `${medals[i]} **${u ? u.username : "unknown"}** — ${data.rows[i].merits} merits\n`;
      }
      embed.setDescription(desc);
      return interaction.reply({ embeds: [embed] });
    }

    // ==================== EARN ====================

    if (sub === "daily") {
      const data = await pool.query(
        `SELECT merits, last_daily FROM user_merits WHERE user_id = $1 AND guild_id = $2`,
        [userId, guildId]
      );
      const now = new Date();
      const lastDaily = data.rows[0]?.last_daily;
      const cooldown = 24 * 60 * 60 * 1000;

      if (lastDaily && (now - new Date(lastDaily)) < cooldown) {
        const remaining = new Date(new Date(lastDaily).getTime() + cooldown);
        return interaction.reply({ content: `${E.error} already claimed! come back <t:${Math.floor(remaining.getTime() / 1000)}:R>.`, ephemeral: true });
      }

      await pool.query(
        `INSERT INTO user_merits (user_id, guild_id, merits, last_daily) VALUES ($1, $2, 50, NOW())
         ON CONFLICT (user_id, guild_id) DO UPDATE SET merits = user_merits.merits + 50, last_daily = NOW()`,
        [userId, guildId]
      );
      await logMerit(client.user.id, userId, 50, "daily claim", "add");
      return interaction.reply(`${E.success} **+50 daily merits** claimed! come back in 24 hours.`);
    }

    // ==================== TRANSFER ====================

    if (sub === "give" || sub === "pay") {
      const user = interaction.options.getUser("user");
      const amount = interaction.options.getInteger("amount");
      const reason = interaction.options.getString("reason") || (sub === "pay" ? "payment" : "no reason");

      if (user.id === userId) return interaction.reply({ content: `${E.error} you can't give merits to yourself.`, ephemeral: true });
      if (user.bot) return interaction.reply({ content: `${E.error} you can't give merits to bots.`, ephemeral: true });

      if (!isAdmin) {
        const giverData = await pool.query(
          `SELECT merits FROM user_merits WHERE user_id = $1 AND guild_id = $2`,
          [userId, guildId]
        );
        const giverMerits = giverData.rows[0]?.merits || 0;
        if (giverMerits < amount) return interaction.reply({ content: `${E.error} you only have **${giverMerits}** merits.`, ephemeral: true });
        await pool.query(
          `UPDATE user_merits SET merits = user_merits.merits - $1 WHERE user_id = $2 AND guild_id = $3`,
          [amount, userId, guildId]
        );
      }

      await pool.query(
        `INSERT INTO user_merits (user_id, guild_id, merits) VALUES ($1, $2, $3)
         ON CONFLICT (user_id, guild_id) DO UPDATE SET merits = user_merits.merits + $3`,
        [user.id, guildId, amount]
      );

      await logMerit(userId, user.id, amount, reason, isAdmin ? "add" : "give");
      const prefix = isAdmin ? `${E.hammer} (admin)` : "";
      return interaction.reply(`${prefix} **${interaction.user.username}** gave **${amount} merits** to **${user.username}** — ${reason}`);
    }

    // ==================== GAMBLE ====================

    if (sub === "steal") {
      const target = interaction.options.getUser("user");
      const amount = interaction.options.getInteger("amount");

      if (target.id === userId) return interaction.reply({ content: `${E.error} you can't steal from yourself.`, ephemeral: true });
      if (target.bot) return interaction.reply({ content: `${E.error} you can't steal from bots.`, ephemeral: true });

      const targetData = await pool.query(
        `SELECT merits FROM user_merits WHERE user_id = $1 AND guild_id = $2`,
        [target.id, guildId]
      );
      const targetMerits = targetData.rows[0]?.merits || 0;
      if (targetMerits < amount) return interaction.reply({ content: `${E.error} **${target.username}** only has **${targetMerits}** merits.`, ephemeral: true });

      const thiefData = await pool.query(
        `SELECT merits FROM user_merits WHERE user_id = $1 AND guild_id = $2`,
        [userId, guildId]
      );
      const thiefMerits = thiefData.rows[0]?.merits || 0;
      if (thiefMerits < amount) return interaction.reply({ content: `${E.error} you need **${amount}** merits to attempt a steal. you have **${thiefMerits}**.`, ephemeral: true });

      const success = Math.random() < 0.5;

      if (success) {
        await pool.query(`UPDATE user_merits SET merits = user_merits.merits - $1 WHERE user_id = $2 AND guild_id = $3`, [amount, target.id, guildId]);
        await pool.query(`INSERT INTO user_merits (user_id, guild_id, merits) VALUES ($1, $2, $3) ON CONFLICT (user_id, guild_id) DO UPDATE SET merits = user_merits.merits + $3`, [userId, guildId, amount]);
        await logMerit(target.id, userId, amount, "steal successful", "steal");
        return interaction.reply(`${E.sneaky} you stole **${amount} merits** from **${target.username}**!`);
      } else {
        await pool.query(`UPDATE user_merits SET merits = user_merits.merits - $1 WHERE user_id = $2 AND guild_id = $3`, [amount, userId, guildId]);
        await pool.query(`INSERT INTO user_merits (user_id, guild_id, merits) VALUES ($1, $2, $3) ON CONFLICT (user_id, guild_id) DO UPDATE SET merits = user_merits.merits + $3`, [target.id, guildId, amount]);
        await logMerit(userId, target.id, amount, "steal failed — target got the merits", "steal");
        return interaction.reply(`${E.angry} you got caught! **${target.username}** took your **${amount} merits**!`);
      }
    }

    // ==================== ADMIN ====================

    if (sub === "add") {
      if (!isAdmin) return interaction.reply({ content: `${E.error} admin only.`, ephemeral: true });
      const user = interaction.options.getUser("user");
      const amount = interaction.options.getInteger("amount");
      const reason = interaction.options.getString("reason") || "admin add";
      await pool.query(`INSERT INTO user_merits (user_id, guild_id, merits) VALUES ($1, $2, $3) ON CONFLICT (user_id, guild_id) DO UPDATE SET merits = user_merits.merits + $3`, [user.id, guildId, amount]);
      await logMerit(interaction.user.id, user.id, amount, reason, "add");
      return interaction.reply(`${E.hammer} added **${amount} merits** to **${user.username}** — ${reason}`);
    }

    if (sub === "remove") {
      if (!isAdmin) return interaction.reply({ content: `${E.error} admin only.`, ephemeral: true });
      const user = interaction.options.getUser("user");
      const amount = interaction.options.getInteger("amount");
      const reason = interaction.options.getString("reason") || "admin remove";
      const data = await pool.query(`SELECT merits FROM user_merits WHERE user_id = $1 AND guild_id = $2`, [user.id, guildId]);
      const current = data.rows[0]?.merits || 0;
      const newAmount = Math.max(0, current - amount);
      await pool.query(`INSERT INTO user_merits (user_id, guild_id, merits) VALUES ($1, $2, $3) ON CONFLICT (user_id, guild_id) DO UPDATE SET merits = $3`, [user.id, guildId, newAmount]);
      await logMerit(user.id, interaction.user.id, amount, reason, "remove");
      return interaction.reply(`${E.hammer} removed **${amount} merits** from **${user.username}** (now ${newAmount}) — ${reason}`);
    }

    if (sub === "reset") {
      if (!isAdmin) return interaction.reply({ content: `${E.error} admin only.`, ephemeral: true });
      const user = interaction.options.getUser("user");
      await pool.query(`DELETE FROM user_merits WHERE user_id = $1 AND guild_id = $2`, [user.id, guildId]);
      await logMerit(user.id, interaction.user.id, 0, "reset to 0", "remove");
      return interaction.reply(`${E.hammer} reset **${user.username}**'s merits to 0.`);
    }

    if (sub === "set") {
      if (!isAdmin) return interaction.reply({ content: `${E.error} admin only.`, ephemeral: true });
      const user = interaction.options.getUser("user");
      const amount = interaction.options.getInteger("amount");
      await pool.query(`INSERT INTO user_merits (user_id, guild_id, merits) VALUES ($1, $2, $3) ON CONFLICT (user_id, guild_id) DO UPDATE SET merits = $3`, [user.id, guildId, amount]);
      await logMerit(interaction.user.id, user.id, amount, `set to ${amount}`, "add");
      return interaction.reply(`${E.hammer} set **${user.username}**'s merits to **${amount}**.`);
    }

    // ==================== CONFIG ====================

    if (sub === "config") {
      if (!isAdmin) return interaction.reply({ content: `${E.error} admin only.`, ephemeral: true });
      const action = interaction.options.getString("action");

      if (action === "set") {
        const channel = interaction.options.getChannel("channel");
        if (!channel) return interaction.reply({ content: `${E.error} specify a channel.`, ephemeral: true });
        await pool.query(`INSERT INTO merit_config (guild_id, log_channel_id) VALUES ($1, $2) ON CONFLICT (guild_id) DO UPDATE SET log_channel_id = $2`, [guildId, channel.id]);
        return interaction.reply(`${E.success} merit logs will go to ${channel}.`);
      }

      if (action === "disable") {
        await pool.query(`UPDATE merit_config SET log_channel_id = NULL WHERE guild_id = $1`, [guildId]);
        return interaction.reply(`${E.success} merit logging disabled.`);
      }

      if (action === "view") {
        const config = await pool.query(`SELECT log_channel_id, xp_merit_enabled FROM merit_config WHERE guild_id = $1`, [guildId]);
        if (!config.rows.length) return interaction.reply("merit config not set.");
        const logChannel = interaction.guild.channels.cache.get(config.rows[0].log_channel_id);
        const xpLink = config.rows[0].xp_merit_enabled ?? false;
        return interaction.reply(`${E.ai} merit logs: ${logChannel || "not set"}\nxp link: ${xpLink ? "enabled" : "disabled"}`);
      }

      if (action === "xp") {
        const enabled = interaction.options.getBoolean("enabled");
        if (enabled === null) return interaction.reply({ content: `${E.error} provide a boolean.`, ephemeral: true });
        await pool.query(`INSERT INTO merit_config (guild_id, xp_merit_enabled) VALUES ($1, $2) ON CONFLICT (guild_id) DO UPDATE SET xp_merit_enabled = $2`, [guildId, enabled]);
        return interaction.reply(`${E.success} xp-linked merits ${enabled ? "enabled" : "disabled"}.`);
      }
    }
  },
};
