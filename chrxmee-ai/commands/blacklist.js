const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

const E = {
  success: "<:Verified_Icon:1527194184841167010>",
  error: "<:no:1530373946795364362>",
};
const APPEAL_LINK = "https://discord.gg/rTrJyPyayg";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("blacklist")
    .setDescription("Owner only: blacklist a user or server")
    .addSubcommand(sub =>
      sub.setName("user")
        .setDescription("blacklist a user globally")
        .addUserOption(opt => opt.setName("user").setDescription("user to blacklist").setRequired(true))
        .addStringOption(opt => opt.setName("reason").setDescription("reason").setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName("server")
        .setDescription("blacklist a server")
        .addStringOption(opt => opt.setName("server_id").setDescription("server id to blacklist").setRequired(true))
        .addStringOption(opt => opt.setName("reason").setDescription("reason").setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName("both")
        .setDescription("blacklist both a user and a server")
        .addUserOption(opt => opt.setName("user").setDescription("user to blacklist").setRequired(true))
        .addStringOption(opt => opt.setName("server_id").setDescription("server id to blacklist").setRequired(true))
        .addStringOption(opt => opt.setName("reason").setDescription("reason").setRequired(false))
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
      const reason = interaction.options.getString("reason") || "no reason provided";
      await pool.query(
        `INSERT INTO user_blacklist (user_id, reason) VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET reason = $2`,
        [user.id, reason]
      );
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xff0000).setDescription(`${E.success} blacklisted **${user.username}** globally. reason: ${reason}`)] });
    }

    if (sub === "server") {
      const serverId = interaction.options.getString("server_id");
      const reason = interaction.options.getString("reason") || "no reason provided";
      await pool.query(
        `INSERT INTO server_blacklist (guild_id, reason) VALUES ($1, $2)
         ON CONFLICT (guild_id) DO UPDATE SET reason = $2`,
        [serverId, reason]
      );
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xff0000).setDescription(`${E.success} blacklisted server **${serverId}**. reason: ${reason}`)] });
    }

    if (sub === "both") {
      const user = interaction.options.getUser("user");
      const serverId = interaction.options.getString("server_id");
      const reason = interaction.options.getString("reason") || "no reason provided";

      await pool.query(
        `INSERT INTO user_blacklist (user_id, reason) VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET reason = $2`,
        [user.id, reason]
      );
      await pool.query(
        `INSERT INTO server_blacklist (guild_id, reason) VALUES ($1, $2)
         ON CONFLICT (guild_id) DO UPDATE SET reason = $2`,
        [serverId, reason]
      );
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xff0000).setDescription(`${E.success} blacklisted both **${user.username}** and server **${serverId}**. reason: ${reason}`)] });
    }
  },
};
