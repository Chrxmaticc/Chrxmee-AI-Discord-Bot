const { SlashCommandBuilder } = require("discord.js");
const { Client } = require("pg");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("custom-interactions")
    .setDescription("Set a custom personality or behavior for your AI sessions")
    .addStringOption(option =>
      option.setName("behavior")
        .setDescription("Describe how you want the AI to act (e.g., 'act sarcastic and natural')")
        .setRequired(true)),
  async execute(interaction) {
    const behavior = interaction.options.getString("behavior");
    const userId = interaction.user.id;

    const db = new Client({ connectionString: process.env.DATABASE_URL });
    await db.connect();

    try {
      await db.query(
        "INSERT INTO user_interactions (user_id, custom_prompt, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (user_id) DO UPDATE SET custom_prompt = $2, updated_at = NOW()",
        [userId, behavior]
      );
      
      // Update memory immediately if they are in a session
      let userData = interaction.client.memory.get(userId) || { history: [], model: "smart" };
      userData.customPrompt = behavior;
      interaction.client.memory.set(userId, userData);

      return interaction.reply(`✅ **Custom personality set!** I will now: *${behavior}*\nThis behavior will be applied to your future chat sessions.`);
    } catch (err) {
      console.error("DB Error in custom-interactions:", err);
      return interaction.reply("Failed to save your custom behavior. Please try again later.");
    } finally {
      await db.end();
    }
  },
};
