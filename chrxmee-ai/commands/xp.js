const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, AttachmentBuilder } = require("discord.js");
const { getLevel, buildProgressBar, getPrestigeInfo, PRESTIGE_XP_REQUIREMENT } = require("../events/xpHelper");
const { createCanvas, loadImage } = require("@napi-rs/canvas");

const E = {
  success: "<:Verified_Icon:1527194184841167010>",
  error: "<:no:1530373946795364362>",
  ai: "<:Chrxmaticc_AI:1480094799292928132>",
  crown: "<:Holographic_owner_crown:1527401510487461969>",
};

async function generateLevelCard(member, xp, level, prestige) {
  const canvas = createCanvas(800, 250);
  const ctx = canvas.getContext("2d");

  const bg = ctx.createLinearGradient(0, 0, 800, 250);
  bg.addColorStop(0, "#111111");
  bg.addColorStop(1, "#7c7ce0");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 800, 250);

  const avatarUrl = member.user.displayAvatarURL({ extension: "png", size: 128 });
  const avatar = await loadImage(avatarUrl);
  ctx.save();
  ctx.beginPath();
  ctx.arc(100, 125, 60, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(avatar, 40, 65, 120, 120);
  ctx.restore();

  ctx.beginPath();
  ctx.arc(100, 125, 62, 0, Math.PI * 2);
  ctx.strokeStyle = "#d2b48c";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = "#e8e8e8";
  ctx.font = "bold 32px sans-serif";
  ctx.fillText(member.user.username, 180, 90);

  ctx.fillStyle = "#d2b48c";
  ctx.font = "bold 50px sans-serif";
  ctx.fillText(`lvl ${level}`, 180, 150);

  if (prestige > 0) {
    const info = getPrestigeInfo(prestige);
    ctx.fillStyle = info.color;
    ctx.font = "20px sans-serif";
    ctx.fillText(info.label, 180, 190);
  }

  const { progress, needed, percent } = buildProgressBar(xp);
  ctx.fillStyle = "#ffffff";
  ctx.font = "18px sans-serif";
  ctx.fillText(`xp: ${progress.toLocaleString()} / ${needed.toLocaleString()} (${percent}%)`, 180, 220);

  ctx.fillStyle = "#333333";
  ctx.fillRect(180, 225, 400, 15);
  ctx.fillStyle = "#d2b48c";
  ctx.fillRect(180, 225, 400 * (percent / 100), 15);

  ctx.fillStyle = "rgba(232,232,232,0.4)";
  ctx.font = "12px sans-serif";
  ctx.fillText("chromed xp", 720, 240);

  return canvas.toBuffer("image/png");
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("xp")
    .setDescription("xp system hub — rank, leaderboard, prestige, and admin controls.")
    .addSubcommand(sub => sub.setName("rank").setDescription("view your xp rank or another user's.").addUserOption(o => o.setName("user").setDescription("user to check").setRequired(false)))
    .addSubcommand(sub => sub.setName("leaderboard").setDescription("view the top xp earners in this server."))
    .addSubcommand(sub => sub.setName("prestige").setDescription(`reset your xp for a prestige rank. requires ${PRESTIGE_XP_REQUIREMENT.toLocaleString()} xp.`))
    .addSubcommandGroup(group => group.setName("admin").setDescription("admin controls for the xp system.")
      .addSubcommand(sub => sub.setName("set").setDescription("set a user's xp to a specific amount.").addUserOption(o => o.setName("user").setDescription("target user").setRequired(true)).addIntegerOption(o => o.setName("amount").setDescription("xp amount").setMinValue(0).setRequired(true)))
      .addSubcommand(sub => sub.setName("reset").setDescription("reset a user's xp and level to 0.").addUserOption(o => o.setName("user").setDescription("target user").setRequired(true)))
      .addSubcommand(sub => sub.setName("blacklist").setDescription("toggle xp blacklist for a channel.").addChannelOption(o => o.setName("channel").setDescription("channel to toggle").setRequired(true)))
      .addSubcommand(sub => sub.setName("multiplier").setDescription("set an xp multiplier for a role.").addRoleOption(o => o.setName("role").setDescription("target role").setRequired(true)).addNumberOption(o => o.setName("multiplier").setDescription("multiplier value").setMinValue(1).setMaxValue(10).setRequired(true)))
      .addSubcommand(sub => sub.setName("levelrole").setDescription("assign a role to be given at a specific level.").addIntegerOption(o => o.setName("level").setDescription("level to reward at").setMinValue(1).setRequired(true)).addRoleOption(o => o.setName("role").setDescription("role to assign").setRequired(true)))
      .addSubcommand(sub => sub.setName("channel").setDescription("set a dedicated channel for level up announcements.").addChannelOption(o => o.setName("channel").setDescription("channel for announcements").setRequired(true)))
      .addSubcommand(sub => sub.setName("levelcancel").setDescription("remove a level role reward.").addIntegerOption(o => o.setName("level").setDescription("level to remove role from").setRequired(true)))
      .addSubcommand(sub => sub.setName("levelallow").setDescription("enable xp earning in a channel.").addChannelOption(o => o.setName("channel").setDescription("channel to allow").setRequired(true)))
      .addSubcommand(sub => sub.setName("leveldeny").setDescription("disable xp earning in a channel.").addChannelOption(o => o.setName("channel").setDescription("channel to deny").setRequired(true)))
      .addSubcommand(sub => sub.setName("cards").setDescription("toggle custom level cards on/off.").addBooleanOption(o => o.setName("enabled").setDescription("enabled?").setRequired(true)))
      .addSubcommand(sub => sub.setName("view").setDescription("view current xp settings for this server."))
    ),
  async execute(interaction) {
    const pool = interaction.client.pool;
    const sub = interaction.options.getSubcommand();
    const group = interaction.options.getSubcommandGroup(false);
    await interaction.deferReply();

    if (!group && sub === "rank") {
      const target = interaction.options.getUser("user") || interaction.user;
      const result = await pool.query(
        `SELECT xp, level, prestige FROM user_xp WHERE user_id = $1 AND guild_id = $2`,
        [target.id, interaction.guild.id]
      ).catch(() => null);

      if (!result?.rows.length) {
        return interaction.editReply(`${E.error} ${target.username} hasn't earned any xp yet!`);
      }

      const { xp, prestige } = result.rows[0];
      const { level, progress, needed, percent, bar } = buildProgressBar(xp);

      const cardSetting = await pool.query(
        "SELECT level_cards_enabled FROM xp_settings WHERE guild_id = $1",
        [interaction.guild.id]
      );
      const levelCardsEnabled = cardSetting.rows[0]?.level_cards_enabled ?? true;

      if (levelCardsEnabled) {
        const member = interaction.guild.members.cache.get(target.id) || await interaction.guild.members.fetch(target.id);
        const buffer = await generateLevelCard(member, xp, level, prestige);
        const attachment = new AttachmentBuilder(buffer, { name: "level-card.png" });
        const embed = new EmbedBuilder()
          .setColor(0x7c7ce0)
          .setTitle(`${E.ai} ${target.username}'s rank`)
          .setImage("attachment://level-card.png")
          .setFooter({ text: "level card generated by chromed" });
        return interaction.editReply({ embeds: [embed], files: [attachment] });
      } else {
        const prestigeInfo = prestige > 0 ? getPrestigeInfo(prestige) : null;
        const embed = new EmbedBuilder()
          .setColor(prestigeInfo ? prestigeInfo.color : 0x7c7ce0)
          .setTitle(`${E.ai} ${target.username}'s rank`)
          .setThumbnail(target.displayAvatarURL({ dynamic: true }))
          .addFields(
            { name: "⭐ level", value: `${level}`, inline: true },
            { name: "✨ total xp", value: `${xp.toLocaleString()}`, inline: true },
            { name: "✨ prestige", value: prestigeInfo ? prestigeInfo.label : "none", inline: true },
            { name: `progress to level ${level + 1}`, value: `\`${bar}\` ${percent}%\n${progress.toLocaleString()} / ${needed.toLocaleString()} xp` }
          )
          .setTimestamp();
        return interaction.editReply({ embeds: [embed] });
      }
    }

    if (!group && sub === "leaderboard") {
      const result = await pool.query(
        `SELECT user_id, xp, prestige FROM user_xp WHERE guild_id = $1 ORDER BY xp DESC LIMIT 10`,
        [interaction.guild.id]
      );
      if (!result.rows.length) return interaction.editReply(`${E.error} no xp data yet! start chatting to earn xp.`);

      const medals = ["🥇", "🥈", "🥉"];
      const lines = await Promise.all(result.rows.map(async (row, i) => {
        const user = await interaction.client.users.fetch(row.user_id).catch(() => null);
        const name = user ? user.username : "unknown";
        const level = getLevel(row.xp);
        const prestigeInfo = row.prestige > 0 ? getPrestigeInfo(row.prestige) : null;
        const medal = medals[i] || `**${i + 1}.**`;
        return `${medal} **${name}**${prestigeInfo ? ` ${prestigeInfo.label}` : ""} — lvl ${level} | ${row.xp.toLocaleString()} xp`;
      }));

      const embed = new EmbedBuilder()
        .setColor(0x7c7ce0)
        .setTitle(`${E.crown} ${interaction.guild.name} xp leaderboard`)
        .setDescription(lines.join("\n"))
        .setFooter({ text: "top 10 xp earners" })
        .setTimestamp();
      return interaction.editReply({ embeds: [embed] });
    }

    if (!group && sub === "prestige") {
      const result = await pool.query(
        `SELECT xp, prestige FROM user_xp WHERE user_id = $1 AND guild_id = $2`,
        [interaction.user.id, interaction.guild.id]
      ).catch(() => null);
      if (!result?.rows.length || result.rows[0].xp < PRESTIGE_XP_REQUIREMENT) {
        return interaction.editReply(`${E.error} you need at least **${PRESTIGE_XP_REQUIREMENT.toLocaleString()} xp** to prestige.`);
      }

      const { prestige } = result.rows[0];
      const newPrestige = prestige + 1;
      const prestigeInfo = getPrestigeInfo(newPrestige);
      await pool.query(
        `UPDATE user_xp SET xp = 0, level = 0, prestige = $1 WHERE user_id = $2 AND guild_id = $3`,
        [newPrestige, interaction.user.id, interaction.guild.id]
      );

      const embed = new EmbedBuilder()
        .setColor(prestigeInfo?.color || 0x7c7ce0)
        .setTitle(`${E.crown} prestige unlocked!`)
        .setDescription(`${interaction.user} reached **${prestigeInfo?.label}**! xp reset.`)
        .setTimestamp();
      return interaction.editReply({ embeds: [embed] });
    }

    if (group === "admin") {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.editReply(`${E.error} you need **manage server** permission.`);
      }

      switch (sub) {
        case "set": {
          const target = interaction.options.getUser("user");
          const amount = interaction.options.getInteger("amount");
          const newLevel = getLevel(amount);
          await pool.query(
            `INSERT INTO user_xp (user_id, guild_id, xp, level, prestige) VALUES ($1,$2,$3,$4,0) ON CONFLICT (user_id,guild_id) DO UPDATE SET xp=$3, level=$4`,
            [target.id, interaction.guild.id, amount, newLevel]
          );
          return interaction.editReply(`${E.success} set ${target.username}'s xp to ${amount.toLocaleString()} (level ${newLevel}).`);
        }
        case "reset": {
          const target = interaction.options.getUser("user");
          await pool.query(`UPDATE user_xp SET xp=0, level=0, prestige=0 WHERE user_id=$1 AND guild_id=$2`, [target.id, interaction.guild.id]);
          return interaction.editReply(`${E.success} reset ${target.username}'s xp.`);
        }
        case "blacklist": {
          const channel = interaction.options.getChannel("channel");
          const exists = await pool.query(`SELECT 1 FROM xp_blacklisted_channels WHERE guild_id=$1 AND channel_id=$2`, [interaction.guild.id, channel.id]);
          if (exists.rows.length) {
            await pool.query(`DELETE FROM xp_blacklisted_channels WHERE guild_id=$1 AND channel_id=$2`, [interaction.guild.id, channel.id]);
            return interaction.editReply(`${E.success} ${channel} no longer blacklisted.`);
          } else {
            await pool.query(`INSERT INTO xp_blacklisted_channels (guild_id, channel_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [interaction.guild.id, channel.id]);
            return interaction.editReply(`${E.error} ${channel} blacklisted.`);
          }
        }
        case "multiplier": {
          const role = interaction.options.getRole("role");
          const mult = interaction.options.getNumber("multiplier");
          await pool.query(`INSERT INTO xp_multipliers (guild_id, role_id, multiplier) VALUES ($1,$2,$3) ON CONFLICT (guild_id,role_id) DO UPDATE SET multiplier=$3`, [interaction.guild.id, role.id, mult]);
          return interaction.editReply(`${E.success} set xp multiplier for ${role} to ${mult}x.`);
        }
        case "levelrole": {
          const level = interaction.options.getInteger("level");
          const role = interaction.options.getRole("role");
          await pool.query(`INSERT INTO xp_level_roles (guild_id, level, role_id) VALUES ($1,$2,$3) ON CONFLICT (guild_id,level) DO UPDATE SET role_id=$3`, [interaction.guild.id, level, role.id]);
          return interaction.editReply(`${E.success} ${role} will be assigned at level ${level}.`);
        }
        case "channel": {
          const channel = interaction.options.getChannel("channel");
          await pool.query(`INSERT INTO xp_settings (guild_id, level_up_channel) VALUES ($1,$2) ON CONFLICT (guild_id) DO UPDATE SET level_up_channel=$2`, [interaction.guild.id, channel.id]);
          return interaction.editReply(`${E.success} level up announcements will go to ${channel}.`);
        }
        case "levelcancel": {
          const level = interaction.options.getInteger("level");
          await pool.query(`DELETE FROM xp_level_roles WHERE guild_id=$1 AND level=$2`, [interaction.guild.id, level]);
          return interaction.editReply(`${E.success} removed level ${level} role reward.`);
        }
        case "levelallow": {
          const channel = interaction.options.getChannel("channel");
          await pool.query(`DELETE FROM xp_blacklisted_channels WHERE guild_id=$1 AND channel_id=$2`, [interaction.guild.id, channel.id]);
          return interaction.editReply(`${E.success} xp allowed in ${channel}.`);
        }
        case "leveldeny": {
          const channel = interaction.options.getChannel("channel");
          await pool.query(`INSERT INTO xp_blacklisted_channels (guild_id, channel_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [interaction.guild.id, channel.id]);
          return interaction.editReply(`${E.error} xp denied in ${channel}.`);
        }
        case "cards": {
          const enabled = interaction.options.getBoolean("enabled");
          await pool.query(`INSERT INTO xp_settings (guild_id, level_cards_enabled) VALUES ($1,$2) ON CONFLICT (guild_id) DO UPDATE SET level_cards_enabled=$2`, [interaction.guild.id, enabled]);
          return interaction.editReply(`${E.success} custom level cards ${enabled ? "enabled" : "disabled"}.`);
        }
        case "view": {
          const [multipliers, levelRoles, blacklist, settings] = await Promise.all([
            pool.query(`SELECT role_id, multiplier FROM xp_multipliers WHERE guild_id=$1`, [interaction.guild.id]),
            pool.query(`SELECT level, role_id FROM xp_level_roles WHERE guild_id=$1 ORDER BY level`, [interaction.guild.id]),
            pool.query(`SELECT channel_id FROM xp_blacklisted_channels WHERE guild_id=$1`, [interaction.guild.id]),
            pool.query(`SELECT * FROM xp_settings WHERE guild_id=$1`, [interaction.guild.id]),
          ]);
          const s = settings.rows[0] || {};
          const embed = new EmbedBuilder()
            .setColor(0x7c7ce0)
            .setTitle(`${E.ai} xp system settings`)
            .addFields(
              { name: "✨ multipliers", value: multipliers.rows.length ? multipliers.rows.map(r => `<@&${r.role_id}> → ${r.multiplier}x`).join("\n") : "none" },
              { name: "🎖️ level roles", value: levelRoles.rows.length ? levelRoles.rows.map(r => `level ${r.level} → <@&${r.role_id}>`).join("\n") : "none" },
              { name: "🚫 blacklisted channels", value: blacklist.rows.length ? blacklist.rows.map(r => `<#${r.channel_id}>`).join(", ") : "none" },
              { name: "📢 level up channel", value: s.level_up_channel ? `<#${s.level_up_channel}>` : "current channel" },
              { name: "🧾 level cards", value: s.level_cards_enabled !== false ? "enabled" : "disabled" },
              { name: "⏱️ cooldown", value: `${s.cooldown_seconds || 60} seconds` },
              { name: "base xp", value: `${s.base_xp_min || 5}–${s.base_xp_max || 15} per message` }
            );
          return interaction.editReply({ embeds: [embed] });
        }
      }
    }
  },
};
