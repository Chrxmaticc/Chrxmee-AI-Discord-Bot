const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getLevel, xpForLevel, buildProgressBar, getPrestigeInfo } = require("../utils/xpHelper");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("rank")
    .setDescription("Check your XP rank or another user's.")
    .addUserOption(o => o.setName("user").setDescription("User to check").setRequired(false)),

  async execute(interaction) {
    const pool = interaction.client.pool;
    const target = interaction.options.getUser("user") || interaction.user;

    await interaction.deferReply();

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

    const embed = new EmbedBuilder()
      .setColor(prestigeInfo?.color || "#5865F2")
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
  },
};
