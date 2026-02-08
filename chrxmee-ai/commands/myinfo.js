const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mypersonal')
    .setDescription('View what personal info Chrxmee AI remembers about you'),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const userId = interaction.user.id;
    let userData = interaction.client.memory.get(userId);

    // If not in memory, try fetching from DB
    if (!userData || !userData.personal) {
      const { Client } = require("pg");
      const db = new Client({ connectionString: process.env.DATABASE_URL });
      try {
        await db.connect();
        const personalRes = await db.query("SELECT personal_info FROM user_personal_info WHERE user_id = $1", [userId]);
        if (personalRes.rows[0]?.personal_info) {
          if (!userData) userData = { history: [], model: "smart" };
          userData.personal = JSON.parse(personalRes.rows[0].personal_info);
          interaction.client.memory.set(userId, userData);
        }
      } catch (err) { console.error(err); }
      finally { await db.end(); }
    }

    const info = userData?.personal || {};

    if (Object.keys(info).length === 0) {
      return interaction.editReply('I don\'t remember any personal info yet — use /setpersonal!');
    }

    const embed = new EmbedBuilder()
      .setTitle('Chrxmee AI Personal Memory')
      .setColor('#00FF00')
      .addFields(Object.entries(info).map(([k, v]) => ({ name: k.replace('_', ' ').toUpperCase(), value: v, inline: true })));

    await interaction.editReply({ embeds: [embed] });
  },
};