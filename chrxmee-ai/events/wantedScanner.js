// events/wantedScanner.js

const MODELS = { /* same MODELS object as before */ };
const DEFAULT_MODEL = "genius";

async function callAI(modelKey, messages, temperature, maxTokens = 1024) {
  /* same hybrid callAI as before */
}

module.exports = {
  name: "messageCreate",
  async execute(message) {
    if (message.author.bot || !message.guild) return;
    const client = message.client;
    const pool = client.pool;
    if (!pool) return;

    // Ensure tables exist (scanner runs before command sometimes)
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS wanted_levels (
          guild_id TEXT,
          user_id TEXT,
          points INTEGER DEFAULT 0,
          updated_at TIMESTAMP DEFAULT NOW(),
          PRIMARY KEY (guild_id, user_id)
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS wanted_settings (
          guild_id TEXT PRIMARY KEY,
          ai_scan_enabled BOOLEAN DEFAULT FALSE,
          scan_cooldown_seconds INTEGER DEFAULT 300,
          insane_threshold INTEGER DEFAULT 3,
          points_per_star INTEGER DEFAULT 1
        )
      `);
    } catch (err) {
      console.error("wanted scanner table creation error:", err.message);
      return;
    }

    // check if AI scanner enabled for this guild
    const settingsRes = await pool.query(
      "SELECT * FROM wanted_settings WHERE guild_id = $1",
      [message.guild.id]
    );
    const settings = settingsRes.rows[0];
    if (!settings || !settings.ai_scan_enabled) return;

    // cooldown per user (default 5 min)
    if (!client.wantedCooldowns) client.wantedCooldowns = new Map();
    const cooldownKey = `${message.guild.id}-${message.author.id}`;
    const lastScan = client.wantedCooldowns.get(cooldownKey) || 0;
    const now = Date.now();
    const cooldownMs = (settings.scan_cooldown_seconds || 300) * 1000;
    if (now - lastScan < cooldownMs) return;

    client.wantedCooldowns.set(cooldownKey, now);

    try {
      const prompt = `Rate the following Discord message from 0 to 5 stars for how insane/chaotic it is. Respond with only a number (0-5).\n\nMessage: "${message.content}"`;
      const ratingText = await callAI(
        "genius",
        [{ role: "user", content: prompt }],
        0.3,
        10
      );
      const rating = parseInt(ratingText.trim());
      if (isNaN(rating) || rating < 0 || rating > 5) return;

      const threshold = settings.insane_threshold || 3;
      if (rating >= threshold) {
        const pointsToAdd = (rating - threshold + 1) * (settings.points_per_star || 1);
        await pool.query(
          "INSERT INTO wanted_levels (guild_id, user_id, points) VALUES ($1,$2,$3) ON CONFLICT (guild_id,user_id) DO UPDATE SET points = wanted_levels.points + $3",
          [message.guild.id, message.author.id, pointsToAdd]
        );
      }
    } catch (err) {
      console.error("wanted scanner AI error:", err.message);
    }
  },
};
