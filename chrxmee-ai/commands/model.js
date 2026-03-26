const { SlashCommandBuilder } = require("discord.js");

const MODELS = {
  genius:    { id: "llama-3.3-70b-versatile",          label: "Genius",       desc: "Smart, thorough, and detailed answers." },
  speedster: { id: "llama-3.1-8b-instant",             label: "Speedster",    desc: "Fast and snappy. No fluff." },
  thinker:   { id: "deepseek-r1-distill-llama-70b",    label: "Deep Thinker", desc: "Slow, methodical step-by-step reasoning." },
  creative:  { id: "mixtral-8x7b-32768",               label: "Creative",     desc: "Expressive, imaginative, great for writing." },
  efficient: { id: "gemma2-9b-it",                     label: "Efficient",    desc: "Lightweight and concise." },
  vision:    { id: "llama-3.2-11b-vision-preview",     label: "Vision",       desc: "Analytical and observant." },
  agent:     { id: "compound-beta",                    label: "Agent",        desc: "Research-oriented with web search." },
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("model")
    .setDescription("Switch Chrxmee AI's model or set a custom personality.")
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
              { name: "🧠 Genius — Llama 3.3 70B",      value: "genius" },
              { name: "⚡ Speedster — Llama 3.1 8B",     value: "speedster" },
              { name: "🤔 Deep Thinker — DeepSeek R1",   value: "thinker" },
              { name: "🎨 Creative — Mixtral 8x7B",      value: "creative" },
              { name: "🔋 Efficient — Gemma 2 9B",       value: "efficient" },
              { name: "👁️ Vision — Llama 3.2 11B",       value: "vision" },
              { name: "🌐 Agent — Compound Beta",        value: "agent" }
            )
        )
    )

    .addSubcommand(sub =>
      sub.setName("custom")
        .setDescription("Set a custom personality prompt for Chrxmee AI.")
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
    let userData = interaction.client.memory.get(userId) || { history: [], model: "genius" };

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

      return interaction.reply(`✅ Switched to **${model.label}** (\`${model.id}\`)\n> ${model.desc}`);
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

      return interaction.reply(`✅ Custom personality set!\n> "${prompt}"\nChrxmee AI will act like this until you reset it.`);
    }

    if (sub === "reset") {
      userData.model = "genius";
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

      return interaction.reply(`✅ Reset to **Genius** and cleared your custom personality.`);
    }

    if (sub === "info") {
      const currentModel = MODELS[userData.model] || MODELS["genius"];
      const customPrompt = userData.customPrompt || "None";

      return interaction.reply({
        content: `**Your Chrxmee AI Settings:**\n🧠 **Model:** ${currentModel.label} (\`${currentModel.id}\`)\n> ${currentModel.desc}\n\n✏️ **Custom Personality:** ${customPrompt}`,
        ephemeral: true
      });
    }
  },
};
