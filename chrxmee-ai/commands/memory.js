const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { Pool } = require("pg");

const E = {
  success: "<:Verified_Icon:1527194184841167010>",
  error: "<:no:1530373946795364362>",
  ai: "<:Chrxmaticc_AI:1480094799292928132>",
  angry: "<:angry_cry:1526029511882440744>",
};

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

module.exports = {
  data: new SlashCommandBuilder()
    .setName("memory")
    .setDescription("control what chromed remembers about you")
    .addSubcommand(sub =>
      sub.setName("clear").setDescription("wipe your conversation history")
    )
    .addSubcommand(sub =>
      sub.setName("dump").setDescription("see what chromed knows about you")
    )
    .addSubcommand(sub =>
      sub.setName("set")
        .setDescription("save personal info for chromed to remember")
        .addStringOption(opt => opt.setName("key").setDescription("what to save (e.g., name, age)").setRequired(true))
        .addStringOption(opt => opt.setName("value").setDescription("the value").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("forget").setDescription("delete your personal info from database")
    ),

  async execute(interaction) {
    const isButtonSim = interaction.isButton && interaction.isButton();
    if (!isButtonSim) { try { await interaction.deferReply({ ephemeral: true }); } catch { try { await interaction.deferReply(); } catch {} } }

    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    const client = interaction.client;

    const sendEmbed = async (title, description, color = 0x7c7ce0) => {
      const embed = new EmbedBuilder().setColor(color).setTitle(title).setDescription(description);
      return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
    };

    try {
      if (sub === "clear") {
        const userData = client.memory?.get(userId) || { history: [], personal: {} };
        userData.history = [];
        client.memory?.set(userId, userData);
        return sendEmbed(`${E.ai} memory cleared`, `${E.success} i've forgotten our conversation.`);
      }

      if (sub === "dump") {
        const userData = client.memory?.get(userId) || { history: [], personal: {} };
        let knownFacts = "";
        if (userData.personal && Object.keys(userData.personal).length > 0) {
          knownFacts = Object.entries(userData.personal).map(([k, v]) => `• ${k.replace(/_/g, " ")}: ${v}`).join("\n");
        } else {
          knownFacts = `${E.error} no personal info saved. use /memory set.`;
        }
        const interactionCount = userData.history ? userData.history.filter(m => m.role === "user").length : 0;
        return sendEmbed(`${E.ai} brain dump`, `**known facts:**\n${knownFacts}\n\n**recent context:** ${interactionCount} messages`);
      }

      if (sub === "set") {
        const key = interaction.options.getString("key").toLowerCase().replace(/\s+/g, "_");
        const value = interaction.options.getString("value");
        let userData = client.memory?.get(userId) || { history: [], personal: {} };
        if (!userData.personal) userData.personal = {};
        userData.personal[key] = value;
        client.memory?.set(userId, userData);

        // persist to database
        await pool.query(
          "INSERT INTO user_personal_info (user_id, personal_info, updated_at) VALUES ($1,$2,NOW()) ON CONFLICT (user_id) DO UPDATE SET personal_info = $2, updated_at = NOW()",
          [userId, JSON.stringify(userData.personal)]
        );
        return sendEmbed(`${E.success} personal info saved`, `${E.agree} saved **${key}**: ${value} — i'll use it when relevant.`);
      }

      if (sub === "forget") {
        await pool.query("DELETE FROM user_personal_info WHERE user_id = $1", [userId]);
        const userData = client.memory?.get(userId);
        if (userData?.personal) {
          delete userData.personal;
          client.memory?.set(userId, userData);
        }
        return sendEmbed(`${E.success} forgotten`, `${E.agree} your personal info is gone from my brain and database.`);
      }
    } catch (err) {
      console.error("memory cmd error:", err);
      return sendEmbed(`${E.error} error`, `${E.angry} ${err.message}`, 0xff0000);
    }
  },
};
