const { SlashCommandBuilder } = require("discord.js");
const { Client } = require("pg");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("custom-interactions")
    .setDescription("Set or reset your AI personality")
    .addStringOption(option =>
      option.setName("behavior")
        .setDescription("Describe behavior (e.g., 'act sarcastic') OR type 'reset' to go back to normal")
        .setRequired(true)),
  async execute(interaction) {
    const behavior = interaction.options.getString("behavior");
    const userId = interaction.user.id;

    const db = new Client({ connectionString: process.env.DATABASE_URL });
    await db.connect();

    try {
      if (behavior.toLowerCase() === 'reset') {
        await db.query("DELETE FROM user_interactions WHERE user_id = $1", [userId]);
        let userData = interaction.client.memory.get(userId) || { history: [], model: "smart" };
        delete userData.customPrompt;
        interaction.client.memory.set(userId, userData);
        return interaction.reply("✅ **Personality Reset!** I am back to my standard helpful self.");
      }

      await db.query(
        "INSERT INTO user_interactions (user_id, custom_prompt, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (user_id) DO UPDATE SET custom_prompt = $2, updated_at = NOW()",
        [userId, behavior]
      );
      
      let userData = interaction.client.memory.get(userId) || { history: [], model: "smart" };
      userData.customPrompt = behavior;
      interaction.client.memory.set(userId, userData);

      return interaction.reply(`✅ **Custom personality set!** I will now: *${behavior}*`);
    } catch (err) {
      console.error(err);
      return interaction.reply("Failed to update behavior.");
    } finally {
      await db.end();
    }
  },
};
