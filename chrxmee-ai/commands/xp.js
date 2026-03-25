const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const { getLevel, xpForLevel, buildProgressBar, getPrestigeInfo, PRESTIGE_XP_REQUIREMENT } = require("../utils/xpHelper");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("xp")
    .setDescription("XP system hub — rank, leaderboard, prestige, and admin controls.")

    // /xp rank [user]
    .addSubcommand(sub =>
      sub.setName("rank")
        .setDescription("View your XP rank or another user's.")
        .addUserOption(o => o.setName("user").setDescription("User to check").setRequired(false))
    )

    // /xp leaderboard
    .addSubcommand(sub =>
      sub.setName("leaderboard")
        .setDescription("View the top XP earners in this server.")
    )

    // /xp prestige
    .addSubcommand(sub =>
      sub.setName("prestige")
        .setDescription(`Reset your XP for a prestige rank. Requires ${PRESTIGE_XP_REQUIREMENT.toLocaleString()} XP.`)
    )

    // /xp admin set
    .addSubcommandGroup(group =>
      group.setName("admin")
        .setDescription("Admin controls for the XP system.")
        .addSubcommand(sub =>
          sub.setName("set")
            .setDescription("Set a user's XP to a specific amount.")
            .addUserOption(o => o.setName("user").setDescription("Target user").setRequired(true))
            .addIntegerOption(o => o.setName("amount").setDescription("XP amount").setMinValue(0).setRequired(true))
        )
        .addSubcommand(sub =>
          sub.setName("reset")
            .setDescription("Reset a user's XP and level to 0.")
            .addUserOption(o => o.setName("user").setDescription("Target user").setRequired(true))
        )
        .addSubcommand(sub =>
          sub.setName("blacklist")
            .setDescription("Toggle XP blacklist for a channel.")
            .addChannelOption(o => o.setName("channel").setDescription("Channel to toggle").setRequired(true))
        )
        .addSubcommand(sub =>
          sub.setName("multiplier")
            .setDescription("Set an XP multiplier for a role (e.g. 2 = double XP).")
            .addRoleOption(o => o.setName("role").setDescription("Target role").setRequired(true))
            .addNumberOption(o => o.setName("multiplier").setDescription("Multiplier value (1 = normal, 2 = double)").setMinValue(1).setMaxValue(10).setRequired(true))
        )
        .addSubcommand(sub =>
          sub.setName("levelrole")
            .setDescription("Assign a role to be given at a specific level.")
            .addIntegerOption(o => o.setName("level").setDescription("Level to reward at").setMinValue(1).setRequired(true))
            .addRoleOption(o => o.setName("role").setDescription("Role to assign").setRequired(true))
        )
        .addSubcommand(sub =>
          sub.setName("view")
            .setDescription("View current XP settings for this server (multipliers, level roles, blacklisted channels).")
        )
    ),

  async execute(interaction) {
    const pool = interaction.client.pool;
    const sub = interaction.options.getSubcommand();
    const group = interaction.options.getSubcommandGroup(false);

    await interaction.deferReply();

    // ── /xp rank ──────────────────────────────────────────────────
    if (!group && sub === "rank") {
      const target = interaction.options.getUser("user") || interaction.user;

      const result = await pool.query(
        `SELECT xp, level, prestige FROM user_xp WHERE user_id = $1 AND guild_id = $2`,
        [target.id, interaction.guild.id]
      ).catch(() => null);

      if (!result?.rows.length) {
        return interaction.editReply({ content: `${target.username} hasn't earned any XP yet!` });
      }

      const { xp, prestige } = result.rows[0];
      const { level, progress, needed, percent, bar } = buildProgressBar(xp);

      const rankResult = await pool.query(
        `SELECT COUNT(*) FROM user_xp WHERE guild_id = $1 AND xp > $2`,
        [interaction.guild.id, xp]
      );
      const rank = parseInt(rankResult.rows[0].count) + 1;

      const prestigeInfo = prestige > 0 ? getPrestigeInfo(prestige) : null;
      const embedColor = prestigeInfo ? prestigeInfo.color : "#5865F2";

      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`${target.username}'s Rank`)
        .setThumbnail(target.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: "🏅 Server Rank", value: `#${rank}`, inline: true },
          { name: "⭐ Level", value: `${level}`, inline: true },
          { name: "✦ Prestige", value: prestigeInfo ? prestigeInfo.label : "None", inline: true },
          { name: "✨ Total XP", value: `${xp.toLocaleString()}`, inline: true },
          { name: `Progress to Level ${level + 1}`, value: `\`${bar}\` ${percent}%\n${progress.toLocaleString()} / ${needed.toLocaleString()} XP` }
        )
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    // ── /xp leaderboard ───────────────────────────────────────────
    if (!group && sub === "leaderboard") {
      const result = await pool.query(
        `SELECT user_id, xp, prestige FROM user_xp WHERE guild_id = $1 ORDER BY xp DESC LIMIT 10`,
        [interaction.guild.id]
      );

      if (!result.rows.length) {
        return interaction.editReply({ content: "No XP data yet! Start chatting to earn XP." });
      }

      const medals = ["🥇", "🥈", "🥉"];
      const lines = await Promise.all(
        result.rows.map(async (row, i) => {
          const user = await interaction.client.users.fetch(row.user_id).catch(() => null);
          const name = user ? user.username : `Unknown`;
          const level = getLevel(row.xp);
          const prestigeInfo = row.prestige > 0 ? getPrestigeInfo(row.prestige) : null;
          const prestigeTag = prestigeInfo ? ` ${prestigeInfo.label}` : "";
          const medal = medals[i] || `**${i + 1}.**`;
          return `${medal} **${name}**${prestigeTag} — Lvl ${level} | ${row.xp.toLocaleString()} XP`;
        })
      );

      const embed = new EmbedBuilder()
        .setColor("#5865F2")
        .setTitle(`🏆 ${interaction.guild.name} XP Leaderboard`)
        .setDescription(lines.join("\n"))
        .setFooter({ text: "Top 10 XP earners" })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    // ── /xp prestige ──────────────────────────────────────────────
    if (!group && sub === "prestige") {
      const result = await pool.query(
        `SELECT xp, prestige FROM user_xp WHERE user_id = $1 AND guild_id = $2`,
        [interaction.user.id, interaction.guild.id]
      ).catch(() => null);

      if (!result?.rows.length || result.rows[0].xp < PRESTIGE_XP_REQUIREMENT) {
        return interaction.editReply({
          content: `❌ You need at least **${PRESTIGE_XP_REQUIREMENT.toLocaleString()} XP** to prestige. Keep chatting!`,
        });
      }

      const { prestige } = result.rows[0];
      const newPrestige = prestige + 1;
      const prestigeInfo = getPrestigeInfo(newPrestige);

      await pool.query(
        `UPDATE user_xp SET xp = 0, level = 0, prestige = $1 WHERE user_id = $2 AND guild_id = $3`,
        [newPrestige, interaction.user.id, interaction.guild.id]
      );

      const embed = new EmbedBuilder()
        .setColor(prestigeInfo?.color || "#ffd700")
        .setTitle("✦ Prestige Unlocked!")
        .setDescription(`${interaction.user} has prestiged and reached **${prestigeInfo?.label || `Prestige ${newPrestige}`}**!\nYour XP has been reset — time to grind again!`)
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    // ── Admin subcommands ─────────────────────────────────────────
    if (group === "admin") {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.editReply({ content: "❌ You need the **Manage Server** permission to use admin controls." });
      }

      // /xp admin set
      if (sub === "set") {
        const target = interaction.options.getUser("user");
        const amount = interaction.options.getInteger("amount");
        const newLevel = getLevel(amount);

        await pool.query(
          `INSERT INTO user_xp (user_id, guild_id, xp, level, prestige)
           VALUES ($1, $2, $3, $4, 0)
           ON CONFLICT (user_id, guild_id) DO UPDATE SET xp = $3, level = $4`,
          [target.id, interaction.guild.id, amount, newLevel]
        );

        return interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor("#57f287")
            .setDescription(`✅ Set **${target.username}**'s XP to **${amount.toLocaleString()}** (Level ${newLevel}).`)]
        });
      }

      // /xp admin reset
      if (sub === "reset") {
        const target = interaction.options.getUser("user");

        await pool.query(
          `UPDATE user_xp SET xp = 0, level = 0, prestige = 0 WHERE user_id = $1 AND guild_id = $2`,
          [target.id, interaction.guild.id]
        );

        return interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor("#ed4245")
            .setDescription(`✅ Reset **${target.username}**'s XP, level, and prestige to 0.`)]
        });
      }

      // /xp admin blacklist
      if (sub === "blacklist") {
        const channel = interaction.options.getChannel("channel");

        const exists = await pool.query(
          `SELECT 1 FROM xp_blacklisted_channels WHERE guild_id = $1 AND channel_id = $2`,
          [interaction.guild.id, channel.id]
        );

        if (exists.rows.length > 0) {
          await pool.query(
            `DELETE FROM xp_blacklisted_channels WHERE guild_id = $1 AND channel_id = $2`,
            [interaction.guild.id, channel.id]
          );
          return interaction.editReply({
            embeds: [new EmbedBuilder().setColor("#57f287").setDescription(`✅ ${channel} is **no longer blacklisted** — XP will be earned there again.`)]
          });
        } else {
          await pool.query(
            `INSERT INTO xp_blacklisted_channels (guild_id, channel_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [interaction.guild.id, channel.id]
          );
          return interaction.editReply({
            embeds: [new EmbedBuilder().setColor("#ed4245").setDescription(`✅ ${channel} has been **blacklisted** — no XP will be earned there.`)]
          });
        }
      }

      // /xp admin multiplier
      if (sub === "multiplier") {
        const role = interaction.options.getRole("role");
        const multiplier = interaction.options.getNumber("multiplier");

        await pool.query(
          `INSERT INTO xp_multipliers (guild_id, role_id, multiplier)
           VALUES ($1, $2, $3)
           ON CONFLICT (guild_id, role_id) DO UPDATE SET multiplier = $3`,
          [interaction.guild.id, role.id, multiplier]
        );

        return interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor("#57f287")
            .setDescription(`✅ Set XP multiplier for ${role} to **${multiplier}x**.`)]
        });
      }

      // /xp admin levelrole
      if (sub === "levelrole") {
        const level = interaction.options.getInteger("level");
        const role = interaction.options.getRole("role");

        await pool.query(
          `INSERT INTO xp_level_roles (guild_id, level, role_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (guild_id, level) DO UPDATE SET role_id = $3`,
          [interaction.guild.id, level, role.id]
        );

        return interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor("#57f287")
            .setDescription(`✅ ${role} will now be assigned when a user reaches **Level ${level}**.`)]
        });
      }

      // /xp admin view
      if (sub === "view") {
        const [multipliers, levelRoles, blacklist] = await Promise.all([
          pool.query(`SELECT role_id, multiplier FROM xp_multipliers WHERE guild_id = $1`, [interaction.guild.id]),
          pool.query(`SELECT level, role_id FROM xp_level_roles WHERE guild_id = $1 ORDER BY level`, [interaction.guild.id]),
          pool.query(`SELECT channel_id FROM xp_blacklisted_channels WHERE guild_id = $1`, [interaction.guild.id]),
        ]);

        const multText = multipliers.rows.length
          ? multipliers.rows.map(r => `<@&${r.role_id}> → **${r.multiplier}x**`).join("\n")
          : "None set";

        const rolesText = levelRoles.rows.length
          ? levelRoles.rows.map(r => `Level **${r.level}** → <@&${r.role_id}>`).join("\n")
          : "None set";

        const blText = blacklist.rows.length
          ? blacklist.rows.map(r => `<#${r.channel_id}>`).join(", ")
          : "None";

        const embed = new EmbedBuilder()
          .setColor("#5865F2")
          .setTitle("⚙️ XP System Settings")
          .addFields(
            { name: "✨ XP Multipliers", value: multText },
            { name: "🎖️ Level Roles", value: rolesText },
            { name: "🚫 Blacklisted Channels", value: blText }
          )
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }
    }
  },
};
