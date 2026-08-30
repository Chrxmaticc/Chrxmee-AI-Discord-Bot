const { getLevel, BASE_XP_MIN, BASE_XP_MAX, XP_COOLDOWN_MS } = require("./xpHelper");
const { createCanvas, loadImage } = require("@napi-rs/canvas");

const E = {
  success: "<:Verified_Icon:1527194184841167010>",
  error: "<:no:1530373946795364362>",
  ai: "<:Chrxmaticc_AI:1480094799292928132>",
  crown: "<:Holographic_owner_crown:1527401510487461969>",
};

async function ensureTables(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_xp (
      user_id TEXT,
      guild_id TEXT,
      xp INTEGER DEFAULT 0,
      level INTEGER DEFAULT 0,
      prestige INTEGER DEFAULT 0,
      updated_at TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (user_id, guild_id)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS xp_blacklisted_channels (
      guild_id TEXT,
      channel_id TEXT,
      PRIMARY KEY (guild_id, channel_id)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS xp_multipliers (
      guild_id TEXT,
      role_id TEXT,
      multiplier REAL DEFAULT 1,
      PRIMARY KEY (guild_id, role_id)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS xp_level_roles (
      guild_id TEXT,
      level INTEGER,
      role_id TEXT,
      PRIMARY KEY (guild_id, level)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS xp_settings (
      guild_id TEXT PRIMARY KEY,
      base_xp_min INTEGER DEFAULT 5,
      base_xp_max INTEGER DEFAULT 15,
      cooldown_seconds INTEGER DEFAULT 60,
      level_up_channel TEXT,
      level_up_enabled BOOLEAN DEFAULT TRUE,
      level_cards_enabled BOOLEAN DEFAULT TRUE
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS merit_config (
      guild_id TEXT PRIMARY KEY,
      log_channel_id TEXT,
      xp_merit_enabled BOOLEAN DEFAULT FALSE
    )
  `);
}

module.exports = {
  name: "messageCreate",
  async execute(message) {
    if (message.author.bot || !message.guild) return;

    const client = message.client;
    const pool = client.pool;
    if (!pool) return;

    await ensureTables(pool);

    const blacklist = await pool.query(
      "SELECT 1 FROM xp_blacklisted_channels WHERE guild_id = $1 AND channel_id = $2",
      [message.guild.id, message.channel.id]
    );
    if (blacklist.rows.length > 0) return;

    if (!client.xpCooldowns) client.xpCooldowns = new Map();
    const cooldownKey = `${message.guild.id}-${message.author.id}`;
    const lastGain = client.xpCooldowns.get(cooldownKey) || 0;

    const settingsRes = await pool.query(
      "SELECT base_xp_min, base_xp_max, cooldown_seconds FROM xp_settings WHERE guild_id = $1",
      [message.guild.id]
    );
    const settings = settingsRes.rows[0] || { base_xp_min: BASE_XP_MIN, base_xp_max: BASE_XP_MAX, cooldown_seconds: XP_COOLDOWN_MS / 1000 };
    const cooldownMs = settings.cooldown_seconds * 1000;
    const now = Date.now();
    if (now - lastGain < cooldownMs) return;

    const min = settings.base_xp_min ?? BASE_XP_MIN;
    const max = settings.base_xp_max ?? BASE_XP_MAX;
    let xpEarned = Math.floor(Math.random() * (max - min + 1)) + min;

    if (message.member) {
      const multipliers = await pool.query(
        "SELECT role_id, multiplier FROM xp_multipliers WHERE guild_id = $1",
        [message.guild.id]
      );
      for (const row of multipliers.rows) {
        if (message.member.roles.cache.has(row.role_id)) {
          xpEarned = Math.floor(xpEarned * row.multiplier);
        }
      }
    }

    const result = await pool.query(
      `INSERT INTO user_xp (user_id, guild_id, xp, level)
       VALUES ($1, $2, $3, 0)
       ON CONFLICT (user_id, guild_id) DO UPDATE SET xp = user_xp.xp + $3, updated_at = NOW()
       RETURNING xp, level, prestige`,
      [message.author.id, message.guild.id, xpEarned]
    );

    const userXp = result.rows[0];
    const newLevel = getLevel(userXp.xp);

    if (newLevel > userXp.level) {
      await pool.query(
        "UPDATE user_xp SET level = $1 WHERE user_id = $2 AND guild_id = $3",
        [newLevel, message.author.id, message.guild.id]
      );

      const levelRoles = await pool.query(
        "SELECT role_id FROM xp_level_roles WHERE guild_id = $1 AND level <= $2",
        [message.guild.id, newLevel]
      );
      for (const row of levelRoles.rows) {
        const role = message.guild.roles.cache.get(row.role_id);
        if (role && message.member && !message.member.roles.cache.has(role.id)) {
          await message.member.roles.add(role, "level up reward").catch(() => {});
        }
      }

      const levelUpSettings = await pool.query(
        "SELECT level_up_channel, level_up_enabled FROM xp_settings WHERE guild_id = $1",
        [message.guild.id]
      );
      const lvlUp = levelUpSettings.rows[0];
      if (lvlUp && lvlUp.level_up_enabled !== false) {
        const targetChannelId = lvlUp.level_up_channel || message.channel.id;
        const targetChannel = message.guild.channels.cache.get(targetChannelId);
        if (targetChannel) {
          await targetChannel.send(`${E.crown} **${message.author.username}** leveled up to **level ${newLevel}**!`).catch(() => {});
        }
      }
    }

    // XP-linked merits if enabled
    const meritCfg = await pool.query(
      "SELECT xp_merit_enabled FROM merit_config WHERE guild_id = $1",
      [message.guild.id]
    );
    if (meritCfg.rows[0]?.xp_merit_enabled) {
      const meritsEarned = Math.max(1, Math.floor(xpEarned / 10));
      await pool.query(
        `INSERT INTO user_merits (user_id, guild_id, merits) VALUES ($1, $2, $3)
         ON CONFLICT (user_id, guild_id) DO UPDATE SET merits = user_merits.merits + $3`,
        [message.author.id, message.guild.id, meritsEarned]
      );
    }

    client.xpCooldowns.set(cooldownKey, now);
  },
};
