const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

const E = {
  success: "<:Verified_Icon:1527194184841167010>",
  error: "<:no:1530373946795364362>",
  ai: "<:Chrxmaticc_AI:1480094799292928132>",
  settings: "<:Settings:1525601248278216725>",
};

// Must match the keys in your messageCreate.js fontStyles object
const STYLES = [
  "normal", "serif", "script", "monospace", "doubles",
  "smallcaps", "bubble", "square", "upside", "leet",
  "mirror", "subscript", "superscript", "fraktur"
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName("font")
    .setDescription("change how the ai displays text for you")
    .addSubcommand(sub =>
      sub.setName("set")
        .setDescription("choose a text style")
        .addStringOption(opt =>
          opt.setName("style")
            .setDescription("the style name")
            .setRequired(true)
            .addChoices(...STYLES.map(s => ({ name: s, value: s })))))
    .addSubcommand(sub =>
      sub.setName("info")
        .setDescription("see your current text style")),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const pool = client.pool;
    const userId = interaction.user.id;

    if (sub === "set") {
      const style = interaction.options.getString("style");
      await pool.query(
        `INSERT INTO user_fonts (user_id, style) VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET style = $2`,
        [userId, style]
      );
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x7c7ce0)
            .setDescription(`${E.success} your text style is now **${style}**`)
        ],
        ephemeral: true
      });
    }

    if (sub === "info") {
      const res = await pool.query(`SELECT style FROM user_fonts WHERE user_id = $1`, [userId]);
      const style = res.rows[0]?.style || "normal";
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x7c7ce0)
            .setDescription(`${E.ai} your current text style is **${style}**`)
        ],
        ephemeral: true
      });
    }
  }
};
