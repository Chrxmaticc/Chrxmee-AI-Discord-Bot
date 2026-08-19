const { SlashCommandBuilder } = require("discord.js");

// ─── HYBRID MODELS (Groq primary, Navy backup) ───────────────────
const MODELS = {
  genius: {
    label: "Genius",
    desc: "Smart, thorough, and detailed answers.",
    providers: [
      { name: "groq", id: "openai/gpt-oss-120b", url: "https://api.groq.com/openai/v1/chat/completions", keyEnv: "GROQ_API_KEY" },
      { name: "navy", id: "gpt-4.1", url: "https://api.navy/v1/chat/completions", keyEnv: "NAVY_API_KEY" }
    ]
  },
  speedster: {
    label: "Speedster",
    desc: "Fast and snappy. No fluff.",
    providers: [
      { name: "groq", id: "openai/gpt-oss-20b", url: "https://api.groq.com/openai/v1/chat/completions", keyEnv: "GROQ_API_KEY" },
      { name: "navy", id: "gpt-4.1-mini", url: "https://api.navy/v1/chat/completions", keyEnv: "NAVY_API_KEY" }
    ]
  },
  thinker: {
    label: "Thinker",
    desc: "Deep reasoning and analysis.",
    providers: [
      { name: "groq", id: "openai/gpt-oss-120b", url: "https://api.groq.com/openai/v1/chat/completions", keyEnv: "GROQ_API_KEY" },
      { name: "navy", id: "gpt-4.1", url: "https://api.navy/v1/chat/completions", keyEnv: "NAVY_API_KEY" }
    ]
  },
  creative: {
    label: "Creative",
    desc: "Imaginative and expressive writing.",
    providers: [
      { name: "groq", id: "qwen/qwen3.6-27b", url: "https://api.groq.com/openai/v1/chat/completions", keyEnv: "GROQ_API_KEY" },
      { name: "navy", id: "gpt-4.1", url: "https://api.navy/v1/chat/completions", keyEnv: "NAVY_API_KEY" }
    ]
  },
  efficient: {
    label: "Efficient",
    desc: "Lightweight and concise responses.",
    providers: [
      { name: "groq", id: "groq/compound-mini", url: "https://api.groq.com/openai/v1/chat/completions", keyEnv: "GROQ_API_KEY" },
      { name: "navy", id: "gpt-4.1-mini", url: "https://api.navy/v1/chat/completions", keyEnv: "NAVY_API_KEY" }
    ]
  },
  vision: {
    label: "Vision",
    desc: "Analytical and observant.",
    providers: [
      { name: "groq", id: "qwen/qwen3.6-27b", url: "https://api.groq.com/openai/v1/chat/completions", keyEnv: "GROQ_API_KEY" },
      { name: "navy", id: "gpt-4.1", url: "https://api.navy/v1/chat/completions", keyEnv: "NAVY_API_KEY" }
    ]
  },
  agent: {
    label: "Agent",
    desc: "Research agent with web tools.",
    providers: [
      { name: "groq", id: "groq/compound", url: "https://api.groq.com/openai/v1/chat/completions", keyEnv: "GROQ_API_KEY" },
      { name: "navy", id: "gpt-4.1", url: "https://api.navy/v1/chat/completions", keyEnv: "NAVY_API_KEY" }
    ]
  },
};

const DEFAULT_MODEL = "genius";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("model")
    .setDescription("Switch Chromed AI's model or set a custom personality.")
    .setContexts([0, 1, 2])
    .setIntegrationTypes([0, 1])
    .addSubcommand(sub =>
      sub.setName("switch")
        .setDescription("Switch to a different AI model.")
        .addStringOption(opt =>
          opt.setName("type")
            .setDescription("Choose a model")
            .setRequired(true)
            .addChoices(
              { name: "Genius (Groq: GPT-OSS 120B / Navy: GPT-4.1)", value: "genius" },
              { name: "Speedster (Groq: GPT-OSS 20B / Navy: GPT-4.1 Mini)", value: "speedster" },
              { name: "Thinker (Groq: GPT-OSS 120B / Navy: GPT-4.1)", value: "thinker" },
              { name: "Creative (Groq: Qwen 3.6 27B / Navy: GPT-4.1)", value: "creative" },
              { name: "Efficient (Groq: Compound Mini / Navy: GPT-4.1 Mini)", value: "efficient" },
              { name: "Vision (Groq: Qwen 3.6 27B / Navy: GPT-4.1)", value: "vision" },
              { name: "Agent (Groq: Compound / Navy: GPT-4.1)", value: "agent" }
            )
        )
    )
    .addSubcommand(sub =>
      sub.setName("custom")
        .setDescription("Set a custom personality prompt for Chromed AI.")
        .addStringOption(opt =>
          opt.setName("prompt")
            .setDescription("Describe how you want the AI to act.")
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName("reset")
        .setDescription("Reset your model back to Genius and clear your custom personality.")
    )
    .addSubcommand(sub =>
      sub.setName("info")
        .setDescription("See your current model and custom personality settings.")
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    let userData = interaction.client.memory.get(userId) || { history: [], model: DEFAULT_MODEL };

    if (sub === "switch") {
      const type = interaction.options.getString("type");
      const model = MODELS[type];
      if (!model) return interaction.reply({ content: "Unknown model.", ephemeral: true });

      userData.model = type;
      interaction.client.memory.set(userId, userData);

      const { Client } = require("pg");
      const db = new Client({ connectionString: process.env.DATABASE_URL });
      try {
        await db.connect();
        await db.query(
          `INSERT INTO user_interactions (user_id, preferred_model)
           VALUES ($1, $2)
           ON CONFLICT (user_id) DO UPDATE SET preferred_model = $2`,
          [userId, type]
        );
      } catch (err) {
        console.error("Model switch DB error:", err.message);
      } finally {
        await db.end();
      }

      const providerList = model.providers.map(p => `${p.name}: ${p.id}`).join(" | ");
      return interaction.reply(` Switched to **${model.label}**\n> ${model.desc}\n> Providers: ${providerList}`);
    }

    if (sub === "custom") {
      const prompt = interaction.options.getString("prompt");
      userData.customPrompt = prompt;
      interaction.client.memory.set(userId, userData);

      const { Client } = require("pg");
      const db = new Client({ connectionString: process.env.DATABASE_URL });
      try {
        await db.connect();
        await db.query(
          `INSERT INTO user_interactions (user_id, custom_prompt)
           VALUES ($1, $2)
           ON CONFLICT (user_id) DO UPDATE SET custom_prompt = $2`,
          [userId, prompt]
        );
      } catch (err) {
        console.error("Custom prompt DB error:", err.message);
      } finally {
        await db.end();
      }

      return interaction.reply(` Custom personality set!\n> "${prompt}"\nChromed AI will act like this until you reset it.`);
    }

    if (sub === "reset") {
      userData.model = DEFAULT_MODEL;
      userData.customPrompt = "";
      interaction.client.memory.set(userId, userData);

      const { Client } = require("pg");
      const db = new Client({ connectionString: process.env.DATABASE_URL });
      try {
        await db.connect();
        await db.query(
          `INSERT INTO user_interactions (user_id, preferred_model, custom_prompt)
           VALUES ($1, 'genius', '')
           ON CONFLICT (user_id) DO UPDATE SET preferred_model = 'genius', custom_prompt = ''`,
          [userId]
        );
      } catch (err) {
        console.error("Model reset DB error:", err.message);
      } finally {
        await db.end();
      }

      return interaction.reply(` Reset to **Genius** and cleared your custom personality.`);
    }

    if (sub === "info") {
      const currentModel = MODELS[userData.model] || MODELS[DEFAULT_MODEL];
      const customPrompt = userData.customPrompt || "None";

      return interaction.reply({
        content: `**Your Chromed AI Settings:**\n **Model:** ${currentModel.label}\n> ${currentModel.desc}\n> Providers: ${currentModel.providers.map(p => `${p.name}: ${p.id}`).join(" | ")}\n\n **Custom Personality:** ${customPrompt}`,
        ephemeral: true
      });
    }
  },
};
