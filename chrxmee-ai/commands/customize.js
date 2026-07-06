const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("customize")
    .setDescription("Customize the bot's appearance")
    .addSubcommand(sub =>
      sub.setName("pfp")
        .setDescription("Change the bot's profile picture")
        .addAttachmentOption(opt =>
          opt.setName("image").setDescription("New profile picture").setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName("banner")
        .setDescription("Change the bot's banner")
        .addAttachmentOption(opt =>
          opt.setName("image").setDescription("New banner image").setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName("bio")
        .setDescription("Change the bot's About Me")
        .addStringOption(opt =>
          opt.setName("text").setDescription("New bio (max 190 chars)").setRequired(true).setMaxLength(190)
        )
    )
    .addSubcommand(sub =>
      sub.setName("username")
        .setDescription("Change the bot's username")
        .addStringOption(opt =>
          opt.setName("name").setDescription("New username").setRequired(true).setMaxLength(32)
        )
    ),

  async execute(interaction, client) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: "You need Administrator permissions.", ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();
    await interaction.deferReply();

    // PFP
    if (sub === "pfp") {
      const image = interaction.options.getAttachment("image");
      if (!image.contentType?.startsWith("image/")) return interaction.editReply("That's not an image.");
      try {
        const res = await fetch(image.url);
        const buffer = Buffer.from(await res.arrayBuffer());
        await client.user.setAvatar(buffer);
        await interaction.editReply("✅ Bot PFP updated!");
      } catch (err) {
        await interaction.editReply(`❌ Failed: ${err.message}`);
      }
    }

    // Banner
    if (sub === "banner") {
      const image = interaction.options.getAttachment("image");
      if (!image.contentType?.startsWith("image/")) return interaction.editReply("That's not an image.");
      try {
        const res = await fetch(image.url);
        const buffer = Buffer.from(await res.arrayBuffer());
        await client.user.setBanner(buffer);
        await interaction.editReply("✅ Bot banner updated!");
      } catch (err) {
        await interaction.editReply(`❌ Failed: ${err.message}`);
      }
    }

    // Bio
    if (sub === "bio") {
      const bio = interaction.options.getString("text");
      try {
        await client.rest.patch("/users/@me", { body: { bio } });
        await interaction.editReply(`✅ Bio updated to:\n> ${bio}`);
      } catch (err) {
        await interaction.editReply(`❌ Failed: ${err.message}`);
      }
    }

    // Username
    if (sub === "username") {
      const name = interaction.options.getString("name");
      try {
        await client.user.setUsername(name);
        await interaction.editReply(`✅ Username changed to **${name}**`);
      } catch (err) {
        await interaction.editReply(`❌ Failed: ${err.message}`);
      }
    }
  },
};
