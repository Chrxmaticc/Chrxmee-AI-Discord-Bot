const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

const E = {
  success: "<:Verified_Icon:1527194184841167010>",
  error: "<:no:1530373946795364362>",
  ai: "<:Chrxmaticc_AI:1480094799292928132>",
  sneaky: "<:sneaky:1527401423690792970>",
};

module.exports = {
  name: "interactionCreate",
  async execute(interaction) {
    const pool = interaction.client.pool;

    // Button clicks for confession panel
    if (interaction.isButton()) {
      const customId = interaction.customId;
      if (customId !== "confess_public_button" && customId !== "confess_anonymous_button") return;

      const mode = customId === "confess_public_button" ? "public" : "anonymous";

      // Check settings
      const settingsRes = await pool.query(`SELECT * FROM confession_settings WHERE guild_id = $1`, [interaction.guildId]);
      if (!settingsRes.rows[0] || !settingsRes.rows[0].enabled) {
        return interaction.reply({ content: `${E.error} confessions are closed.`, ephemeral: true });
      }

      const modal = new ModalBuilder()
        .setCustomId(`confess_modal_${mode}`)
        .setTitle(`${mode} confession`);

      const textInput = new TextInputBuilder()
        .setCustomId("confession_text")
        .setLabel("your confession")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(1000)
        .setPlaceholder("type your confession here...");

      const row = new ActionRowBuilder().addComponents(textInput);
      modal.addComponents(row);

      await interaction.showModal(modal);
      return;
    }

    // Modal submissions
    if (!interaction.isModalSubmit()) return;
    if (!interaction.customId.startsWith("confess_modal_")) return;

    const mode = interaction.customId.replace("confess_modal_", "");
    const isAnonymous = mode === "anonymous";

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

      // Next confession number
      const countRes = await pool.query(`SELECT COUNT(*) FROM confessions WHERE guild_id = $1`, [guild.id]);
      const nextNumber = parseInt(countRes.rows[0].count) + 1;

      await pool.query(
        `INSERT INTO confessions (guild_id, confession_number, content, user_id, is_anonymous) VALUES ($1,$2,$3,$4,$5)`,
        [guild.id, nextNumber, content, interaction.user.id, isAnonymous]
      );

      const channel = guild.channels.cache.get(settings.channel_id);
      if (!channel) {
        return interaction.reply({ content: `${E.error} confession channel not found.`, ephemeral: true });
      }

      // Output as embed or text
      if (settings.output_type === "text") {
        let text = `**confession #${nextNumber}**\n${content}`;
        if (!isAnonymous) text = `**${interaction.user.username}** — confession #${nextNumber}\n${content}`;
        await channel.send({ content: text });
      } else {
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
        await channel.send({ embeds: [embed] });
      }

      await interaction.reply({ content: `${E.success} your ${isAnonymous ? "anonymous" : "public"} confession has been submitted as **#${nextNumber}**.`, ephemeral: true });
    } catch (err) {
      console.error("confession modal error:", err);
      await interaction.reply({ content: `${E.error} something went wrong.`, ephemeral: true });
    }
  },
};
