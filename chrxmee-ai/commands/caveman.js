// commands/caveman.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS caveman_settings (
      user_id TEXT PRIMARY KEY,
      mode    TEXT DEFAULT 'off',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}
ensureTable().catch((e) => console.error("[caveman] schema:", e.message));

module.exports = {
  data: new SlashCommandBuilder()
    .setName("caveman")
    .setDescription("ultra-compressed communication mode for ai responses")
    .addStringOption((o) =>
      o.setName("mode")
        .setDescription("intensity level")
        .setRequired(true)
        .addChoices(
          { name: "off (normal)", value: "off" },
          { name: "lite", value: "lite" },
          { name: "full (default)", value: "full" },
          { name: "ultra", value: "ultra" },
          { name: "wenyan lite", value: "wenyan-lite" },
          { name: "wenyan full", value: "wenyan-full" },
          { name: "wenyan ultra", value: "wenyan-ultra" }
        )),

  async execute(interaction) {
    const mode = interaction.options.getString("mode");
    const userId = interaction.user.id;

    await interaction.deferReply();

    try {
      await pool.query(
        `INSERT INTO caveman_settings (user_id, mode, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (user_id) DO UPDATE SET mode = $2, updated_at = NOW()`,
        [userId, mode]
      );
    } catch (err) {
      return interaction.editReply({ content: `<:no:1530373946795364362> db error: ${err.message}` });
    }

    const isOff = mode === "off";
    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(isOff ? 0x4f545c : 0x57F287)
          .setTitle(isOff ? `<:sad_trashcan:1559006806825504779> caveman off. normal mode.` : `<:on:1545571641684135946> caveman on. mode: ${mode}`)
          .setDescription(
            isOff
              ? `<:Brain:1560402629014716558> brain return. words return.`
              : `<:Timer:1559004828733018203> ai speak ${mode}. tokens die. meaning stay.`
          ),
      ],
    });
  },

  _pool: pool,
};
