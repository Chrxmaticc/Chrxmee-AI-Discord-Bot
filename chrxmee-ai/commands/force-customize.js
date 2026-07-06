const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

const OWNER_ID = process.env.OWNER_ID;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("force-customize")
    .setDescription("Owner only — force change anything on the bot")
    .addSubcommand(sub =>
      sub.setName("pfp")
        .setDescription("Force change PFP")
        .addAttachmentOption(opt => opt.setName("image").setDescription("New PFP").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("banner")
        .setDescription("Force change banner")
        .addAttachmentOption(opt => opt.setName("image").setDescription("New banner").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("bio")
        .setDescription("Force change bio")
        .addStringOption(opt => opt.setName("text").setDescription("New bio").setRequired(true).setMaxLength(190))
    )
    .addSubcommand(sub =>
      sub.setName("username")
        .setDescription("Force change username")
        .addStringOption(opt => opt.setName("name").setDescription("New username").setRequired(true).setMaxLength(32))
    )
    .addSubcommand(sub =>
      sub.setName("status")
        .setDescription("Force change streaming status text")
        .addStringOption(opt => opt.setName("text").setDescription("New status text").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("avatar-url")
        .setDescription("Force change PFP from a URL")
        .addStringOption(opt => opt.setName("url").setDescription("Direct image URL").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("all")
        .setDescription("Change everything at once")
        .addAttachmentOption(opt => opt.setName("pfp").setDescription("New PFP"))
        .addAttachmentOption(opt => opt.setName("banner").setDescription("New banner"))
        .addStringOption(opt => opt.setName("bio").setDescription("New bio").setMaxLength(190))
        .addStringOption(opt => opt.setName("username").setDescription("New username").setMaxLength(32))
        .addStringOption(opt => opt.setName("status").setDescription("New status text"))
    ),

  async execute(interaction, client) {
    if (interaction.user.id !== OWNER_ID) {
      return interaction.reply({ content: "🚫 Owner only.", ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();
    await interaction.deferReply();
    const results = [];

    // Helper to change PFP from attachment
    async function changePfp(attachment) {
      if (!attachment) return;
      const res = await fetch(attachment.url);
      const buffer = Buffer.from(await res.arrayBuffer());
      await client.user.setAvatar(buffer);
      results.push("✅ PFP updated");
    }

    // Helper to change PFP from URL
    async function changePfpUrl(url) {
      const res = await fetch(url);
      const buffer = Buffer.from(await res.arrayBuffer());
      await client.user.setAvatar(buffer);
      results.push("✅ PFP updated (URL)");
    }

    // Helper to change banner
    async function changeBanner(attachment) {
      if (!attachment) return;
      const res = await fetch(attachment.url);
      const buffer = Buffer.from(await res.arrayBuffer());
      await client.user.setBanner(buffer);
      results.push("✅ Banner updated");
    }

    // Helper to change bio
    async function changeBio(text) {
      if (!text) return;
      await client.rest.patch("/users/@me", { body: { bio: text } });
      results.push("✅ Bio updated");
    }

    // Helper to change username
    async function changeUsername(name) {
      if (!name) return;
      await client.user.setUsername(name);
      results.push(`✅ Username → **${name}**`);
    }

    // Helper to change status
    async function changeStatus(text) {
      if (!text) return;
      client.user.setPresence({
        status: "online",
        activities: [{ name: text, type: 1, url: "https://twitch.tv/chrxmeelst" }],
      });
      results.push(`✅ Status → "${text}"`);
    }

    // Execute based on subcommand
    try {
      if (sub === "pfp") await changePfp(interaction.options.getAttachment("image"));
      if (sub === "banner") await changeBanner(interaction.options.getAttachment("image"));
      if (sub === "bio") await changeBio(interaction.options.getString("text"));
      if (sub === "username") await changeUsername(interaction.options.getString("name"));
      if (sub === "status") await changeStatus(interaction.options.getString("text"));
      if (sub === "avatar-url") await changePfpUrl(interaction.options.getString("url"));

      if (sub === "all") {
        await changePfp(interaction.options.getAttachment("pfp"));
        await changeBanner(interaction.options.getAttachment("banner"));
        await changeBio(interaction.options.getString("bio"));
        await changeUsername(interaction.options.getString("username"));
        await changeStatus(interaction.options.getString("status"));
      }

      const embed = new EmbedBuilder()
        .setTitle("🔧 Force Customize Results")
        .setDescription(results.join("\n") || "Nothing changed — provide at least one option.")
        .setColor(0x00ff00)
        .setFooter({ text: "chrxmaticc ai — owner override" });

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      results.push(`❌ Error: ${err.message}`);
      const embed = new EmbedBuilder()
        .setTitle("🔧 Force Customize Results")
        .setDescription(results.join("\n"))
        .setColor(0xff0000);
      await interaction.editReply({ embeds: [embed] });
    }
  },
};
