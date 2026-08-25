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
    .setName("setpersonal")
    .setDescription("set personal info for chromed ai to remember about you")
    .addStringOption(option =>
      option.setName("key")
        .setDescription("what to set, like name or age")
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName("value")
        .setDescription("the value")
        .setRequired(true)
    ),

  async execute(interaction) {
    // handle prefix fake interaction gracefully
    const isButtonSim = interaction.isButton && interaction.isButton();
    if (!isButtonSim) {
      try { await interaction.deferReply({ ephemeral: true }); } catch { try { await interaction.deferReply(); } catch {} }
    }

    const key = interaction.options.getString("key").toLowerCase().replace(/\s+/g, "_");
    const value = interaction.options.getString("value");
    const userId = interaction.user.id;

    // update memory
    let userData = interaction.client.memory?.get(userId) || { history: [], model: "genius", personal: {} };
    if (!userData.personal) userData.personal = {};
    userData.personal[key] = value;
    interaction.client.memory?.set(userId, userData);

    // persist to database
    const { Client } = require("pg");
    const db = new Client({ connectionString: process.env.DATABASE_URL });

    try {
      await db.connect();
      await db.query(
        "INSERT INTO user_personal_info (user_id, personal_info, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (user_id) DO UPDATE SET personal_info = $2, updated_at = NOW()",
        [userId, JSON.stringify(userData.personal)]
      );
    } catch (err) {
      console.error("db save error in setpersonal:", err);
    } finally {
      await db.end();
    }

    const embed = new EmbedBuilder()
      .setColor(0x7c7ce0) // periwinkle
      .setTitle(`${E.ai} personal info saved`)
      .setDescription(`${E.success} saved **${key}**: ${value} — i'll use it when relevant.`)
      .setFooter({ text: "only you and chromed know this" })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
  },
};
