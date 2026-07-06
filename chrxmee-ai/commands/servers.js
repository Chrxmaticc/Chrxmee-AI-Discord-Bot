const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

const OWNER_ID = process.env.OWNER_ID;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("servers")
    .setDescription("Owner only — get invite links to all servers the bot is in"),

  async execute(interaction, client) {
    if (interaction.user.id !== OWNER_ID) {
      return interaction.reply({ content: "🚫 Owner only.", ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const guilds = client.guilds.cache;
    const invites = [];
    const failed = [];

    for (const [id, guild] of guilds) {
      try {
        const textChannel = guild.channels.cache.find(c => c.type === 0 && c.permissionsFor(guild.members.me).has("CreateInstantInvite"));
        if (!textChannel) {
          failed.push(`❌ ${guild.name} — No valid channel`);
          continue;
        }
        const invite = await guild.invites.create(textChannel.id, {
          maxAge: 86400,
          maxUses: 1,
          reason: "Owner inspection"
        });
        invites.push(`**${guild.name}**\nhttps://discord.gg/${invite.code}\n`);
      } catch (err) {
        failed.push(`❌ ${guild.name} — ${err.message}`);
      }
    }

    const embed = new EmbedBuilder()
      .setTitle(`🔍 Server Invites (${invites.length}/${guilds.size})`)
      .setColor(0x9146ff)
      .setFooter({ text: "chrxmaticc ai — owner inspection" });

    if (invites.length) {
      embed.setDescription(invites.join("\n"));
    } else {
      embed.setDescription("No invites generated.");
    }

    if (failed.length) {
      embed.addFields({ name: "Failed", value: failed.join("\n").slice(0, 1024) });
    }

    try {
      await interaction.user.send({ embeds: [embed] });
      await interaction.editReply("✅ Check your DMs for the invite list.");
    } catch {
      await interaction.editReply("❌ I couldn't DM you. Make sure your DMs are open.");
    }
  },
};
