const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

const E = {
  success: "<:Verified_Icon:1527194184841167010>",
  error: "<:no:1530373946795364362>",
  ai: "<:Chrxmaticc_AI:1480094799292928132>",
  agree: "<:agreed:1525639597135237131>",
  angry: "<:angry_cry:1526029511882440744>",
  sneaky: "<:sneaky:1527401423690792970>",
  money_cry: "<:Money_Cry_Son:1526538340264841257>",
  cringe_laugh: "<:Cringe_Laughing_Son:1526539082564374710>",
  point_laugh: "<:PointAndLaughingEmoji:1525657154567016469>",
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("forget")
    .setDescription("make chromed forget your personal info (keeps history/model)"),

  async execute(interaction) {
    const isButtonSim = interaction.isButton && interaction.isButton();
    if (!isButtonSim) {
      try { await interaction.deferReply({ ephemeral: true }); } catch { try { await interaction.deferReply(); } catch {} }
    }

    const userId = interaction.user.id;
    const userData = interaction.client.memory?.get(userId);

    try {
      const pool = interaction.client.pool;
      if (pool) {
        await pool.query("DELETE FROM user_personal_info WHERE user_id = $1", [userId]);
      } else {
        // fallback if pool not present
        const { Client } = require("pg");
        const db = new Client({ connectionString: process.env.DATABASE_URL });
        await db.connect();
        await db.query("DELETE FROM user_personal_info WHERE user_id = $1", [userId]);
        await db.end();
      }

      if (userData && userData.personal) {
        delete userData.personal;
        interaction.client.memory?.set(userId, userData);
      }

      const embed = new EmbedBuilder()
        .setColor(0x7c7ce0) // periwinkle
        .setTitle(`${E.ai} poof`)
        .setDescription(`${E.success} your personal info is gone from my brain and database! (history and model still intact)`)
        .setFooter({ text: "privacy first" })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
    } catch (err) {
      console.error("forget error:", err);
      const errorEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle(`${E.error} error`)
        .setDescription(`${E.angry} couldn't clear your info: ${err.message}`);
      return interaction.editReply({ embeds: [errorEmbed] }).catch(() => interaction.followUp({ embeds: [errorEmbed] }));
    }
  },
};
