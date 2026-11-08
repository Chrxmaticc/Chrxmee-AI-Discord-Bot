// events/autoreact.js
const { Pool } = require("pg");
const { _pool, _cache } = require("../commands/autoreact");

// We use the pool and cache exported from the command file
const pool = _pool;
const reactCache = _cache;

module.exports = {
  name: "messageCreate",
  async execute(message) {
    if (!message.guild) return;
    if (message.author.bot) return;

    // 1. Load from cache or DB
    let reacts = reactCache.get(message.guildId);
    if (!reacts) {
      const res = await pool.query(`SELECT word, emoji FROM autoreacts WHERE guild_id = $1`, [message.guildId]);
      reacts = res.rows;
      reactCache.set(message.guildId, reacts);
      
      // Auto-clear cache every 5 minutes so updates apply
      setTimeout(() => reactCache.delete(message.guildId), 300000);
    }

    if (!reacts || reacts.length === 0) return;

    const content = message.content.toLowerCase();
    if (!content) return;

    // 2. Check if message contains any trigger words
    for (const r of reacts) {
      // \b ensures it matches whole words (so "ass" doesn't trigger on "class")
      const regex = new RegExp(`\\b${r.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      
      if (regex.test(content)) {
        await message.react(r.emoji).catch(() => {});
      }
    }
  },
};
