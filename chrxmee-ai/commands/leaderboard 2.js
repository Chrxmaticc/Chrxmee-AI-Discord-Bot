const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getLevel, getPrestigeInfo } = require("../utils/xpHelper");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("View the top XP earners in this server."),

  async execute(interaction) {
    const pool = interaction.client.pool;

    await interaction.deferReply();

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
        const name = user ? user.username : "Unknown";
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
  },
};
