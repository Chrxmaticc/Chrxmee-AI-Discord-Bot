const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");

const E = {
  success: "<:Verified_Icon:1527194184841167010>",
  error: "<:no:1530373946795364362>",
  ai: "<:Chrxmaticc_AI:1480094799292928132>",
  sneaky: "<:sneaky:1527401423690792970>",
  crown: "<:Holographic_owner_crown:1527401510487461969>",
};

module.exports = {
  name: "interactionCreate",
  async execute(interaction) {
    const pool = interaction.client.pool;

    // ── Button interactions ──────────────────────────────
    if (interaction.isButton()) {
      const customId = interaction.customId;

      // Report button
      if (customId.startsWith("confess_report_")) {
        const confessionNumber = parseInt(customId.replace("confess_report_", ""));
        const guild = interaction.guild;
        const reporter = interaction.user;

        // Defer update immediately to avoid timeout
        await interaction.deferUpdate().catch(() => {});

        const settings = await pool.query(
          `SELECT channel_id FROM confession_settings WHERE guild_id = $1`,
          [guild.id]
        );
        const targetChannel = guild.channels.cache.get(settings.rows[0]?.channel_id);
        if (!targetChannel) {
          return interaction.followUp({
            content: `${E.error} confession channel not found.`,
            ephemeral: true,
          });
        }

        const reportEmbed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle("confession reported")
          .addFields(
            { name: "confession", value: `#${confessionNumber}`, inline: true },
            { name: "reported by", value: `${reporter.username} (${reporter.id})`, inline: true }
          )
          .setTimestamp();

        await targetChannel.send({ embeds: [reportEmbed] });
        return interaction.followUp({
          content: `${E.success} report submitted. admins will review.`,
          ephemeral: true,
        });
      }

      // Public / Anonymous confession buttons
      if (customId !== "confess_public_button" && customId !== "confess_anonymous_button") return;

      const mode = customId === "confess_public_button" ? "public" : "anonymous";

      // Check settings
      const settingsRes = await pool.query(
        `SELECT * FROM confession_settings WHERE guild_id = $1`,
        [interaction.guildId]
      );
      if (!settingsRes.rows[0] || !settingsRes.rows[0].enabled) {
        return interaction.reply({
          content: `${E.error} confessions are closed.`,
          ephemeral: true,
        });
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

      const modalRow = new ActionRowBuilder().addComponents(textInput);
      modal.addComponents(modalRow);

      await interaction.showModal(modal);
      return;
    }

    // ── Modal submissions ─────────────────────────────────
    if (!interaction.isModalSubmit()) return;
    if (!interaction.customId.startsWith("confess_modal_")) return;

    const mode = interaction.customId.replace("confess_modal_", "");
    const isAnonymous = mode === "anonymous";
    const guild = interaction.guild;

    // Defer reply before async work
    await interaction.deferReply({ ephemeral: true }).catch(() => {});

    try {
      const settingsRes = await pool.query(
        `SELECT * FROM confession_settings WHERE guild_id = $1`,
        [guild.id]
      );
      if (!settingsRes.rows[0]) {
        return interaction.editReply({
          content: `${E.error} not configured. use /confess setup first.`,
        });
      }
      const settings = settingsRes.rows[0];
      if (!settings.enabled) {
        return interaction.editReply({
          content: `${E.error} confessions are closed.`,
        });
      }

      const content = interaction.fields.getTextInputValue("confession_text");

      // Next confession number
      const countRes = await pool.query(
        `SELECT COUNT(*) FROM confessions WHERE guild_id = $1`,
        [guild.id]
      );
      const nextNumber = parseInt(countRes.rows[0].count) + 1;

      await pool.query(
        `INSERT INTO confessions (guild_id, confession_number, content, user_id, is_anonymous)
         VALUES ($1,$2,$3,$4,$5)`,
        [guild.id, nextNumber, content, interaction.user.id, isAnonymous]
      );

      const channel = guild.channels.cache.get(settings.channel_id);
      if (!channel) {
        return interaction.editReply({
          content: `${E.error} confession channel not found.`,
        });
      }

      // Report button for each confession
      const reportButton = new ButtonBuilder()
        .setCustomId(`confess_report_${nextNumber}`)
        .setLabel("report")
        .setStyle(ButtonStyle.Danger);

      const reportRow = new ActionRowBuilder().addComponents(reportButton);

      // Output as embed or text
      if (settings.output_type === "text") {
        let text = `**confession #${nextNumber}**\n${content}`;
        if (!isAnonymous) {
          text = `**${interaction.user.username}** — confession #${nextNumber}\n${content}`;
        }
        await channel.send({ content: text, components: [reportRow] });
      } else {
        const embed = new EmbedBuilder()
          .setColor(parseInt(settings.embed_color || "7c7ce0", 16))
          .setTitle(
            settings.embed_title || (isAnonymous ? "anonymous confession" : "public confession")
          )
          .setDescription(content)
          .setFooter({ text: settings.embed_footer || "chromed confessions" });

        if (!isAnonymous) {
          embed.setAuthor({
            name: interaction.user.username,
            iconURL: interaction.user.displayAvatarURL(),
          });
        }
        if (settings.show_number) {
          embed.addFields({ name: "confession", value: `#${nextNumber}`, inline: true });
        }
        if (settings.show_timestamp) {
          embed.setTimestamp();
        }
        await channel.send({ embeds: [embed], components: [reportRow] });
      }

      return interaction.editReply({
        content: `${E.success} your ${isAnonymous ? "anonymous" : "public"} confession has been submitted as **#${nextNumber}**.`,
      });
    } catch (err) {
      console.error("confession modal error:", err);
      return interaction.editReply({
        content: `${E.error} something went wrong.`,
      });
    }
  },
};
