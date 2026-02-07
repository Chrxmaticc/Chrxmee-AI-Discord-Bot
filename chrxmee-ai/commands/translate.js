const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("translate")
    .setDescription("Translate text to any language")
    .setContexts([0, 1, 2])
    .setIntegrationTypes([0, 1])
    .addStringOption((option) =>
      option.setName("text").setDescription("The text to translate").setRequired(true)
    )
    .addStringOption((option) =>
      option.setName("language").setDescription("The target language").setRequired(true)
    ),
  async execute(interaction) {
    await interaction.deferReply();
    const text = interaction.options.getString("text");
    const language = interaction.options.getString("language");

    try {
      const userId = interaction.user.id;
      const starterData = interaction.client.memory.get(userId) || { model: "smart" };
      const userModel = starterData.model || "smart";

      // Fetch custom behavior
      let customPrompt = "";
      const { Client } = require("pg");
      const db = new Client({ connectionString: process.env.DATABASE_URL });
      try {
        await db.connect();
        const customRes = await db.query("SELECT custom_prompt FROM user_interactions WHERE user_id = $1", [userId]);
        if (customRes.rows[0]) customPrompt = customRes.rows[0].custom_prompt;
      } catch (err) { console.error("Translate DB error:", err); }
      finally { await db.end(); }

      const systemPrompt = customPrompt 
        ? `You are a translator. Translate the following text into ${language}. Only provide the translation. Adhere to this behavior style if possible: ${customPrompt}`
        : `You are a translator. Translate the following text into ${language}. Only provide the translation.`;

      const models = {
        smart: "llama-3.3-70b-versatile",
        fast: "llama-3.1-8b-instant",
        thinker: "deepseek-r1-distill-llama-70b",
        creative: "llama-3.3-70b-versatile",
        efficient: "llama-3.1-8b-instant",
        visionary: "llama-3.3-70b-versatile",
        analyst: "llama-3.1-8b-instant",
        classic: "llama-3.3-70b-versatile"
      };

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: models[userModel] || models.smart,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: text }
          ],
          temperature: 0.3,
        }),
      });

      const data = await response.json();
      const translation = data.choices[0].message.content;
      await interaction.editReply(`**Original:** ${text}\n**Translation (${language}):** ${translation}`);
    } catch (err) {
      await interaction.editReply("Failed to translate.");
    }
  },
};