const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("customize")
    .setDescription("Customize the bot's appearance in this server")
    .addSubcommand(sub =>
      sub.setName("pfp")
        .setDescription("Change bot's server avatar")
        .addAttachmentOption(opt =>
          opt.setName("image").setDescription("New server avatar").setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName("banner")
        .setDescription("Change bot's server banner")
        .addAttachmentOption(opt =>
          opt.setName("image").setDescription("New server banner").setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName("bio")
        .setDescription("Change bot's server bio")
        .addStringOption(opt =>
          opt.setName("text").setDescription("New server bio (max 190)").setRequired(true).setMaxLength(190)
        )
    )
    .addSubcommand(sub =>
      sub.setName("nickname")
        .setDescription("Change bot's nickname in this server")
        .addStringOption(opt =>
          opt.setName("name").setDescription("New nickname").setRequired(true).setMaxLength(32)
        )
    )
    .addSubcommand(sub =>
      sub.setName("reset")
        .setDescription("Reset bot's appearance in this server")
        .addStringOption(opt =>
          opt.setName("what")
            .setDescription("What to reset")
            .setRequired(true)
            .addChoices(
              { name: "PFP", value: "pfp" },
              { name: "Banner", value: "banner" },
              { name: "Bio", value: "bio" },
              { name: "Nickname", value: "nickname" },
              { name: "Everything", value: "all" }
            )
        )
    )
    .addSubcommand(sub =>
      sub.setName("view")
        .setDescription("View current server customization settings")
    ),

  async execute(interaction, client) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: "You need Administrator permissions to customize the bot.", ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    await interaction.deferReply();

    // ============ PFP ============
    if (sub === "pfp") {
      const image = interaction.options.getAttachment("image");
      if (!image.contentType?.startsWith("image/")) {
        return interaction.editReply("That's not an image file.");
      }
      try {
        const res = await fetch(image.url);
        const buffer = Buffer.from(await res.arrayBuffer());
        const base64 = `data:${image.contentType};base64,${buffer.toString("base64")}`;

        await client.rest.patch(`/guilds/${guildId}/members/@me`, {
          body: { avatar: base64 },
        });
        await interaction.editReply("✅ Bot's server avatar updated!");
      } catch (err) {
        await interaction.editReply(`❌ Failed to set server avatar: ${err.message}`);
      }
    }

    // ============ BANNER ============
    if (sub === "banner") {
      const image = interaction.options.getAttachment("image");
      if (!image.contentType?.startsWith("image/")) {
        return interaction.editReply("That's not an image file.");
      }
      try {
        const res = await fetch(image.url);
        const buffer = Buffer.from(await res.arrayBuffer());
        const base64 = `data:${image.contentType};base64,${buffer.toString("base64")}`;

        await client.rest.patch(`/guilds/${guildId}/members/@me`, {
          body: { banner: base64 },
        });
        await interaction.editReply("✅ Bot's server banner updated!");
      } catch (err) {
        await interaction.editReply(`❌ Failed to set server banner: ${err.message}`);
      }
    }

    // ============ BIO ============
    if (sub === "bio") {
      const bio = interaction.options.getString("text");
      try {
        await client.rest.patch(`/guilds/${guildId}/members/@me`, {
          body: { bio },
        });
        await interaction.editReply(`✅ Bot's server bio updated to:\n> ${bio}`);
      } catch (err) {
        await interaction.editReply(`❌ Failed to set server bio: ${err.message}`);
      }
    }

    // ============ NICKNAME ============
    if (sub === "nickname") {
      const name = interaction.options.getString("name");
      try {
        await interaction.guild.members.me.setNickname(name);
        await interaction.editReply(`✅ Bot's nickname changed to **${name}**`);
      } catch (err) {
        await interaction.editReply(`❌ Failed to set nickname: ${err.message}`);
      }
    }

    // ============ RESET ============
    if (sub === "reset") {
      const what = interaction.options.getString("what");
      const results = [];

      try {
        if (what === "pfp" || what === "all") {
          await client.rest.patch(`/guilds/${guildId}/members/@me`, {
            body: { avatar: null },
          });
          results.push("✅ PFP reset to global");
        }
        if (what === "banner" || what === "all") {
          await client.rest.patch(`/guilds/${guildId}/members/@me`, {
            body: { banner: null },
          });
          results.push("✅ Banner reset to global");
        }
        if (what === "bio" || what === "all") {
          await client.rest.patch(`/guilds/${guildId}/members/@me`, {
            body: { bio: "" },
          });
          results.push("✅ Bio reset to global");
        }
        if (what === "nickname" || what === "all") {
          await interaction.guild.members.me.setNickname(null);
          results.push("✅ Nickname reset to default");
        }

        await interaction.editReply(results.join("\n"));
      } catch (err) {
        await interaction.editReply(`❌ Reset failed: ${err.message}`);
      }
    }

    // ============ VIEW ============
    if (sub === "view") {
      try {
        const member = await interaction.guild.members.fetchMe();
        const embed = new EmbedBuilder()
          .setTitle("🎨 Current Server Customization")
          .addFields(
            { name: "Nickname", value: member.nickname || "None (using global username)", inline: true },
            { name: "Avatar", value: member.avatar ? "Custom server avatar set" : "Using global avatar", inline: true },
            { name: "Banner", value: "Check bot profile to view", inline: true },
            { name: "Bio", value: "Check bot profile to view", inline: true }
          )
          .setColor(0x9146ff)
          .setFooter({ text: `Server: ${interaction.guild.name}` });

        await interaction.editReply({ embeds: [embed] });
      } catch (err) {
        await interaction.editReply(`❌ Failed to fetch settings: ${err.message}`);
      }
    }
  },
};
