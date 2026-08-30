// events/wantedScanner.js

const MODELS = {
  genius: {
    label: "Genius",
    providers: [
      { name: "groq", id: "openai/gpt-oss-120b", url: "https://api.groq.com/openai/v1/chat/completions", keyEnv: "GROQ_API_KEY" },
      { name: "navy", id: "gpt-4.1", url: "https://api.navy/v1/chat/completions", keyEnv: "NAVY_API_KEY" }
    ]
  },
  speedster: {
    label: "Speedster",
    providers: [
      { name: "groq", id: "openai/gpt-oss-20b", url: "https://api.groq.com/openai/v1/chat/completions", keyEnv: "GROQ_API_KEY" },
      { name: "navy", id: "gpt-4.1-mini", url: "https://api.navy/v1/chat/completions", keyEnv: "NAVY_API_KEY" }
    ]
  },
  thinker: {
    label: "Thinker",
    providers: [
      { name: "groq", id: "openai/gpt-oss-120b", url: "https://api.groq.com/openai/v1/chat/completions", keyEnv: "GROQ_API_KEY" },
      { name: "navy", id: "gpt-4.1", url: "https://api.navy/v1/chat/completions", keyEnv: "NAVY_API_KEY" }
    ]
  },
  creative: {
    label: "Creative",
    providers: [
      { name: "groq", id: "qwen/qwen3.6-27b", url: "https://api.groq.com/openai/v1/chat/completions", keyEnv: "GROQ_API_KEY" },
      { name: "navy", id: "gpt-4.1", url: "https://api.navy/v1/chat/completions", keyEnv: "NAVY_API_KEY" }
    ]
  },
  efficient: {
    label: "Efficient",
    providers: [
      { name: "groq", id: "groq/compound-mini", url: "https://api.groq.com/openai/v1/chat/completions", keyEnv: "GROQ_API_KEY" },
      { name: "navy", id: "gpt-4.1-mini", url: "https://api.navy/v1/chat/completions", keyEnv: "NAVY_API_KEY" }
    ]
  },
  vision: {
    label: "Vision",
    providers: [
      { name: "groq", id: "qwen/qwen3.6-27b", url: "https://api.groq.com/openai/v1/chat/completions", keyEnv: "GROQ_API_KEY" },
      { name: "navy", id: "gpt-4.1", url: "https://api.navy/v1/chat/completions", keyEnv: "NAVY_API_KEY" }
    ]
  },
  agent: {
    label: "Agent",
    providers: [
      { name: "groq", id: "groq/compound", url: "https://api.groq.com/openai/v1/chat/completions", keyEnv: "GROQ_API_KEY" },
      { name: "navy", id: "gpt-4.1", url: "https://api.navy/v1/chat/completions", keyEnv: "NAVY_API_KEY" }
    ]
  },
};

const DEFAULT_MODEL = "genius";

async function callAI(modelKey, messages, temperature, maxTokens = 1024) {
  const model = MODELS[modelKey] || MODELS[DEFAULT_MODEL];
  let lastError;
  for (const provider of model.providers) {
    const apiKey = process.env[provider.keyEnv];
    if (!apiKey) continue;
    try {
      const response = await fetch(provider.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: provider.id,
          messages,
          temperature,
          max_tokens: maxTokens,
        }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${provider.name} API error ${response.status}: ${errorText.slice(0, 200)}`);
      }
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (content) return content;
      throw new Error(`No content from ${provider.name}`);
    } catch (err) {
      console.error(`${provider.name} failed:`, err.message);
      lastError = err;
    }
  }
  throw new Error(`All providers failed. Last error: ${lastError?.message || "Unknown"}`);
}

module.exports = {
  name: "messageCreate",
  async execute(message) {
    if (message.author.bot || !message.guild) return;
    const client = message.client;
    const pool = client.pool;
    if (!pool) return;

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

    // set cooldown before scanning
    client.wantedCooldowns.set(cooldownKey, now);

    try {
      // use the hybrid callAI (Groq then Navy)
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
