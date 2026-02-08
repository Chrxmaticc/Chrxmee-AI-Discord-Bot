const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setpersonal')
    .setDescription('Set personal info for Chrxmee AI to remember about you')
    .addStringOption(option =>
      option.setName('key')
        .setDescription('What to set, names, etc.')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('value')
        .setDescription('The value')
        .setRequired(true)
    ),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const key = interaction.options.getString('key').toLowerCase().replace(' ', '_');
    const value = interaction.options.getString('value');
    const userId = interaction.user.id;

    let userData = interaction.client.memory.get(userId) || { history: [], model: "smart", personal: {} };
    if (!userData.personal) userData.personal = {};
    userData.personal[key] = value;
    interaction.client.memory.set(userId, userData);

    // PERSIST TO DATABASE
    const { Client } = require("pg");
    const db = new Client({ connectionString: process.env.DATABASE_URL });
    try {
      await db.connect();
      await db.query(
        "INSERT INTO user_personal_info (user_id, personal_info, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (user_id) DO UPDATE SET personal_info = $2, updated_at = NOW()",
        [userId, JSON.stringify(userData.personal)]
      );
    } catch (err) {
      console.error("DB Save Error in setpersonal:", err);
    } finally {
      await db.end();
    }

    await interaction.editReply(`Saved your ${key}: ${value} — I'll use it when relevant!`);
  },
};