const { EmbedBuilder } = require("discord.js");

const E = {
  success: "<:Verified_Icon:1527194184841167010>",
  ai: "<:Chrxmaticc_AI:1480094799292928132>",
  sneaky: "<:sneaky:1527401423690792970>",
};

module.exports = {
  name: "interactionCreate",
  async execute(interaction) {
    if (!interaction.isModalSubmit()) return;

    const customId = interaction.customId;
    if (!customId.startsWith("confess_modal_")) return;

    const mode = customId.replace("confess_modal_", ""); // "public" or "anonymous"
    const isAnonymous = mode === "anonymous";

    const pool = interaction.client.pool;
    const guild = interaction.guild;

    try {
      const settingsRes = await pool.query(`SELECT * FROM confession_settings WHERE guild_id = $1`, [guild.id]);
      if (!settingsRes.rows[0]) {
        return interaction.reply({ content: `${E.error} not configured. use /confess setup first.`, ephemeral: true });
      }
      const settings = settingsRes.rows[0];
      if (!settings.enabled) {
        return interaction.reply({ content: `${E.error} confessions are closed.`, ephemeral: true });
      }

      const content = interaction.fields.getTextInputValue("confession_text");

      // Get next confession number
      const countRes = await pool.query(`SELECT COUNT(*) FROM confessions WHERE guild_id = $1`, [guild.id]);
      const nextNumber = parseInt(countRes.rows[0].count) + 1;

      // Save confession
      await pool.query(
        `INSERT INTO confessions (guild_id, confession_number, content, user_id, is_anonymous) VALUES ($1,$2,$3,$4,$5)`,
        [guild.id, nextNumber, content, interaction.user.id, isAnonymous]
      );

      // Build embed
      const embed = new EmbedBuilder()
        .setColor(parseInt(settings.embed_color || "7c7ce0", 16))
        .setTitle(settings.embed_title || (isAnonymous ? "anonymous confession" : "public confession"))
        .setDescription(content)
        .setFooter({ text: settings.embed_footer || "chromed confessions" });

      if (!isAnonymous) {
        embed.setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL() });
      }

      if (settings.show_number) {
        embed.addFields({ name: "confession", value: `#${nextNumber}`, inline: true });
      }
      if (settings.show_timestamp) {
        embed.setTimestamp();
      }

      const channel = guild.channels.cache.get(settings.channel_id);
      if (channel) {
        await channel.send({ embeds: [embed] });
      }

      await interaction.reply({ content: `${E.success} your ${isAnonymous ? "anonymous" : "public"} confession has been submitted as **#${nextNumber}**.`, ephemeral: true });
    } catch (err) {
      console.error("confession modal error:", err);
      await interaction.reply({ content: `${E.error} something went wrong.`, ephemeral: true });
    }
  },
};
