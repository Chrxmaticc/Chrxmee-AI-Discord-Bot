const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('forgetpersonal')
    .setDescription('Make Chrxmee AI forget your personal info (keeps history/model)'),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const userId = interaction.user.id;
    const userData = interaction.client.memory.get(userId);

    const { Client } = require("pg");
    const db = new Client({ connectionString: process.env.DATABASE_URL });

    try {
      await db.connect();
      await db.query("DELETE FROM user_personal_info WHERE user_id = $1", [userId]);
      
      if (userData && userData.personal) {
        delete userData.personal;
        interaction.client.memory.set(userId, userData);
      }
      await interaction.editReply('Poof — your personal info is gone from my brain and database! (History and model still intact)');
    } catch (err) {
      console.error(err);
      await interaction.editReply('Error clearing your info.');
    } finally {
      await db.end();
    }
  },
};