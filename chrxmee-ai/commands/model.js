const { SlashCommandBuilder } = require("discord.js");

// ─── CUSTOM EMOJIS ──────────────────────────────
const E = {
  success: "<:Verified_Icon:1527194184841167010>",
  error: "<:no:1530373946795364362>",
  ai: "<:Chrxmaticc_AI:1480094799292928132>",
  settings: "<:Settings:1525601248278216725>",
  agree: "<:agreed:1525639597135237131>",
  angry: "<:angry_cry:1526029511882440744>",
  crown: "<:Holographic_owner_crown:1527401510487461969>",
  link: "<:Link:1525603398341103806>",
};

// ─── MODELS (Navy API) ─────────────────────────
const MODELS = {
  genius:    { id: "gpt-4.1",      label: "Genius",      desc: "Smart, thorough, and detailed answers." },
  speedster: { id: "gpt-4.1-mini", label: "Speedster",   desc: "Fast and snappy. No fluff." },
  thinker:   { id: "gpt-4.1",      label: "Thinker",     desc: "Deep reasoning and analysis." },
  creative:  { id: "gpt-4.1",      label: "Creative",    desc: "Imaginative and expressive writing." },
  efficient: { id: "gpt-4.1-mini", label: "Efficient",   desc: "Lightweight and concise responses." },
  vision:    { id: "gpt-4.1",      label: "Vision",      desc: "Vision-enabled analysis." },
  agent:     { id: "gpt-4.1",      label: "Agent",       desc: "Research agent with web tools." },
};

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
              { name: "Genius — GPT-4.1",        value: "genius" },
              { name: "Speedster — GPT-4.1 Mini", value: "speedster" },
              { name: "Thinker — GPT-4.1",       value: "thinker" },
              { name: "Creative — GPT-4.1",      value: "creative" },
              { name: "Efficient — GPT-4.1 Mini", value: "efficient" },
              { name: "Vision — GPT-4.1",        value: "vision" },
              { name: "Agent — GPT-4.1",         value: "agent" }
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
    let userData = interaction.client.memory.get(userId) || { history: [], model: "genius" };

    if (sub === "switch") {
      const type = interaction.options.getString("type");
      const model = MODELS[type];
      if (!model) return interaction.reply({ content: `${E.error} Unknown model.`, ephemeral: true });

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

      return interaction.reply(`${E.success} Switched to **${model.label}** (\`${model.id}\`)\n> ${model.desc}`);
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

      return interaction.reply(`${E.success} Custom personality set!\n> "${prompt}"\nChromed AI will act like this until you reset it.`);
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

      return interaction.reply(`${E.success} Reset to **Genius** and cleared your custom personality.`);
    }

    if (sub === "info") {
      const currentModel = MODELS[userData.model] || MODELS["genius"];
      const customPrompt = userData.customPrompt || "None";

      return interaction.reply({
        content: `${E.ai} **Your Chromed AI Settings:**\n **Model:** ${currentModel.label} (\`${currentModel.id}\`)\n> ${currentModel.desc}\n\n **Custom Personality:** ${customPrompt}`,
        ephemeral: true
      });
    }
  },
};
