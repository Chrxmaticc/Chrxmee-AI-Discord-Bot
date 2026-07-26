const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

const E = {
  success: "<:Verified_Icon:1527194184841167010>",
  error: "<:no:1530373946795364362>",
  ai: "<:Chrxmaticc_AI:1480094799292928132>",
};

const OWNER_ID = process.env.OWNER_ID;   // your Discord user ID
const GLOBAL_GUILD_ID = '0';            // special ID for global settings

module.exports = {
  data: new SlashCommandBuilder()
    .setName("swearblock")
    .setDescription("Owner-only: block dangerous words globally")
    .addSubcommand(sub => sub.setName("enable").setDescription("Turn on the global filter"))
    .addSubcommand(sub => sub.setName("disable").setDescription("Turn off the global filter"))
    .addSubcommand(sub => sub.setName("add").setDescription("Add a word to the global blocklist")
      .addStringOption(opt => opt.setName("word").setDescription("Word to block").setRequired(true)))
    .addSubcommand(sub => sub.setName("remove").setDescription("Remove a word from the global blocklist")
      .addStringOption(opt => opt.setName("word").setDescription("Word to remove").setRequired(true)))
    .addSubcommand(sub => sub.setName("list").setDescription("Show the global blocked words")),

  async execute(interaction, client) {
    // 🔒 Owner only
    if (interaction.user.id !== OWNER_ID) {
      return interaction.reply({ content: `${E.error} This command is only for the bot owner.`, ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();
    const pool = client.pool;

    if (sub === "enable") {
      await pool.query(
        `INSERT INTO swear_block (guild_id, enabled) VALUES ($1, TRUE)
         ON CONFLICT (guild_id) DO UPDATE SET enabled = TRUE`,
        [GLOBAL_GUILD_ID]
      );
      return interaction.reply({ content: `${E.success} Global swear block **enabled**.`, ephemeral: true });
    }

    if (sub === "disable") {
      await pool.query(
        `UPDATE swear_block SET enabled = FALSE WHERE guild_id = $1`,
        [GLOBAL_GUILD_ID]
      );
      return interaction.reply({ content: `${E.success} Global swear block **disabled**.`, ephemeral: true });
    }

    if (sub === "add") {
      const word = interaction.options.getString("word").toLowerCase().trim();
      // Insert the global row if it doesn't exist, then append the word
      await pool.query(
        `INSERT INTO swear_block (guild_id, enabled, words) VALUES ($1, FALSE, ARRAY[$2]::TEXT[])
         ON CONFLICT (guild_id) DO UPDATE SET words = array_append(swear_block.words, $2)`,
        [GLOBAL_GUILD_ID, word]
      );
      return interaction.reply({ content: `${E.success} Added \`${word}\` to the global blocklist.`, ephemeral: true });
    }

    if (sub === "remove") {
      const word = interaction.options.getString("word").toLowerCase().trim();
      await pool.query(
        `UPDATE swear_block SET words = array_remove(words, $2) WHERE guild_id = $1`,
        [GLOBAL_GUILD_ID, word]
      );
      return interaction.reply({ content: `${E.success} Removed \`${word}\` from the global blocklist.`, ephemeral: true });
    }

    if (sub === "list") {
      const res = await pool.query(`SELECT words FROM swear_block WHERE guild_id = $1`, [GLOBAL_GUILD_ID]);
      const words = res.rows[0]?.words || [];
      const embed = new EmbedBuilder()
        .setColor(0x7c7ce0)
        .setTitle(`${E.ai} Global Blocked Words`)
        .setDescription(words.length ? words.map(w => `\`${w}\``).join(", ") : "No words blocked yet.")
        .setFooter({ text: "Chrxmaticc AI · 炫克人工智能" });
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};
