const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

const E = {
  success: "<:Verified_Icon:1527194184841167010>",
  error: "<:no:1530373946795364362>",
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("whitelist")
    .setDescription("Owner only: whitelist a user or server")
    .addSubcommand(sub =>
      sub.setName("user")
        .setDescription("whitelist a user")
        .addUserOption(opt => opt.setName("user").setDescription("user to whitelist").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("server")
        .setDescription("whitelist a server")
        .addStringOption(opt => opt.setName("server_id").setDescription("server id to whitelist").setRequired(true))
    ),

  async execute(interaction) {
    const allowedOwners = [process.env.OWNER_ID, process.env.OWNER_ID2].filter(Boolean);
    if (!allowedOwners.includes(interaction.user.id)) {
      return interaction.reply({ content: `${E.error} owner only.`, ephemeral: true });
    }

    const pool = interaction.client.pool;
    const sub = interaction.options.getSubcommand();

    if (sub === "user") {
      const user = interaction.options.getUser("user");
      await pool.query(
        `INSERT INTO user_whitelist (user_id) VALUES ($1)
         ON CONFLICT (user_id) DO NOTHING`,
        [user.id]
      );
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x00ff00).setDescription(`${E.success} whitelisted **${user.username}**.`)] });
    }

    if (sub === "server") {
      const serverId = interaction.options.getString("server_id");
      await pool.query(
        `INSERT INTO server_whitelist (guild_id) VALUES ($1)
         ON CONFLICT (guild_id) DO NOTHING`,
        [serverId]
      );
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x00ff00).setDescription(`${E.success} whitelisted server **${serverId}**.`)] });
    }
  },
};
