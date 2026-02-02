const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { Client } = require("pg");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("guild-settings")
    .setDescription("Configure how the bot wakes up in this server")
    .addStringOption(option =>
      option.setName("wakeup")
        .setDescription("Choose wake-up mode")
        .setRequired(true)
        .addChoices(
          { name: "Ping (Respond when mentioned)", value: "ping" },
          { name: "Commands Only (Ignore pings, only /commands)", value: "commands" },
          { name: "Off (Ignore everything except specific commands)", value: "off" }
        ))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts([0]) // Only in guilds
    .setIntegrationTypes([0]),
  async execute(interaction) {
    if (!interaction.guildId) {
      return interaction.reply({ content: "This command can only be used in servers!", flags: [64] });
    }

    const mode = interaction.options.getString("wakeup");
    
    const db = new Client({ connectionString: process.env.DATABASE_URL });
    await db.connect();

    try {
      await db.query(
        "INSERT INTO guild_settings (guild_id, wake_up_mode) VALUES ($1, $2) ON CONFLICT (guild_id) DO UPDATE SET wake_up_mode = $2",
        [interaction.guildId, mode]
      );
      await interaction.reply({ content: `✅ Wake-up mode for this server has been set to: **${mode.toUpperCase()}**`, flags: [64] });
    } catch (err) {
      console.error("Guild Settings Error:", err);
      await interaction.reply({ content: "❌ Failed to update settings.", flags: [64] });
    } finally {
      await db.end();
    }
  },
};
