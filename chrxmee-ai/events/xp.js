const { EmbedBuilder } = require("discord.js");
const { getLevel, xpForLevel, getPrestigeInfo } = require("../events/xpHelper");

const cooldowns = new Map();
const COOLDOWN_MS = 60_000;
const XP_MIN = 15;
const XP_MAX = 25;

module.exports = {
  name: "messageCreate",
  async execute(message) {
    if (message.author.bot || !message.guild) return;

    const userId = message.author.id;
    const guildId = message.guild.id;
    const now = Date.now();
    const pool = message.client.pool;

    // Cooldown check
    const key = `${guildId}-${userId}`;
    if (cooldowns.has(key) && now - cooldowns.get(key) < COOLDOWN_MS) return;

    // Blacklist check
    try {
      const blResult = await pool.query(
        `SELECT 1 FROM xp_blacklisted_channels WHERE guild_id = $1 AND channel_id = $2`,
        [guildId, message.channel.id]
      );
      if (blResult.rows.length > 0) return;
    } catch (err) {
      console.error("XP blacklist check failed:", err.message);
      return;
    }

    cooldowns.set(key, now);

    // Calculate XP with multipliers
    let xpGain = Math.floor(Math.random() * (XP_MAX - XP_MIN + 1)) + XP_MIN;
    try {
      const member = await message.guild.members.fetch(userId).catch(() => null);
      if (member) {
        const roleIds = [...member.roles.cache.keys()];
        if (roleIds.length > 0) {
          const placeholders = roleIds.map((_, i) => `$${i + 2}`).join(", ");
          const multResult = await pool.query(
            `SELECT MAX(multiplier) as best FROM xp_multipliers WHERE guild_id = $1 AND role_id IN (${placeholders})`,
            [guildId, ...roleIds]
          );
          const best = parseFloat(multResult.rows[0]?.best);
          if (!isNaN(best) && best > 1) xpGain = Math.floor(xpGain * best);
        }
      }
    } catch (err) {
      console.error("XP multiplier check failed:", err.message);
    }

    try {
      const result = await pool.query(
        `INSERT INTO user_xp (user_id, guild_id, xp, level, prestige)
         VALUES ($1, $2, $3, 0, 0)
         ON CONFLICT (user_id, guild_id) DO UPDATE
           SET xp = user_xp.xp + $3
         RETURNING xp, level, prestige`,
        [userId, guildId, xpGain]
      );

      const { xp, level: oldLevel, prestige } = result.rows[0];
      const newLevel = getLevel(xp);

      if (newLevel > oldLevel) {
        await pool.query(
          `UPDATE user_xp SET level = $1 WHERE user_id = $2 AND guild_id = $3`,
          [newLevel, userId, guildId]
        );

        // Assign level roles
        try {
          const roleResult = await pool.query(
            `SELECT role_id FROM xp_level_roles WHERE guild_id = $1 AND level = $2`,
            [guildId, newLevel]
          );
          if (roleResult.rows.length > 0) {
            const member = await message.guild.members.fetch(userId).catch(() => null);
            if (member) {
              for (const row of roleResult.rows) {
                const role = message.guild.roles.cache.get(row.role_id);
                if (role) await member.roles.add(role).catch(console.error);
              }
            }
          }
        } catch (err) {
          console.error("Level role assignment failed:", err.message);
        }

        const prestigeInfo = prestige > 0 ? getPrestigeInfo(prestige) : null;
        const embedColor = prestigeInfo ? prestigeInfo.color : "#5865F2";
        const prestigeText = prestigeInfo ? `\n${prestigeInfo.label} Prestige` : "";

        const embed = new EmbedBuilder()
          .setColor(embedColor)
          .setTitle("Guild Level Up!")
          .setDescription(`Nice work, ${message.author}! You've reached **Level ${newLevel}**!${prestigeText}`)
          .addFields(
            { name: "Guild Total XP", value: `${xp.toLocaleString()} XP`, inline: true },
            { name: "Guild Next Level", value: `${xpForLevel(newLevel + 1).toLocaleString()} XP`, inline: true }
          )
          .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
          .setTimestamp();

        message.channel.send({ embeds: [embed] }).catch(() => {});
      }
    } catch (err) {
      console.error("XP system error:", err.message);
    }
  },
};
