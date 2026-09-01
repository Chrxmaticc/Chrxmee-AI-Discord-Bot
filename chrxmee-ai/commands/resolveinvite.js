const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

const E = {
  success: "<:Verified_Icon:1527194184841167010>",
  error: "<:no:1530373946795364362>",
  ai: "<:Chrxmaticc_AI:1480094799292928132>",
  angry: "<:angry_cry:1526029511882440744>",
  crown: "<:Holographic_owner_crown:1527401510487461969>",
  sneaky: "<:sneaky:1527401423690792970>",
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("resolveinvite")
    .setDescription("get server id from an invite code")
    .addStringOption(opt =>
      opt.setName("code")
        .setDescription("discord invite code or full link")
        .setRequired(true)
    ),

  async execute(interaction) {
    const isButtonSim = interaction.isButton && interaction.isButton();
    if (!isButtonSim) {
      try { await interaction.deferReply(); } catch {}
    }

    // owner check
    const ownerIds = [process.env.OWNER_ID, process.env.OWNER_ID2].filter(Boolean);
    if (!ownerIds.includes(interaction.user.id)) {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle(`${E.error} owner only`)
        .setDescription(`${E.angry} you can't use this command.`);
      return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
    }

    if (!process.env.BOT_TOKEN) {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle(`${E.error} missing token`)
        .setDescription(`${E.angry} bot token not set.`);
      return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
    }

    // extract invite code from possible link
    let code = interaction.options.getString("code").trim();
    code = code.replace(/^https?:\/\/(discord\.gg|discord\.com\/invite)\//i, "")
               .replace(/^discord\.gg\//i, "")
               .split(/[/? ]/)[0];

    if (!code) {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle(`${E.error} invalid invite`)
        .setDescription(`${E.angry} that doesn't look like a valid invite code.`);
      return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
    }

    try {
      const res = await fetch(`https://discord.com/api/v10/invites/${encodeURIComponent(code)}?with_counts=true&with_expiration=true`, {
        headers: {
          Authorization: `Bot ${process.env.BOT_TOKEN}`,
        },
      });
      const data = await res.json();

      if (!res.ok || !data.guild) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle(`${E.error} failed to resolve`)
          .setDescription(`${E.angry} ${data.message || "invite not found or expired."}`);
        return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
      }

      const guild = data.guild;
      const embed = new EmbedBuilder()
        .setColor(0x7c7ce0)
        .setTitle(`${E.success} invite resolved`)
        .addFields(
          { name: "guild name", value: guild.name || "unknown", inline: true },
          { name: "guild id", value: guild.id, inline: true },
          { name: "member count", value: data.approximate_member_count?.toString() || "unknown", inline: true },
          { name: "presence count", value: data.approximate_presence_count?.toString() || "unknown", inline: true },
          { name: "invite code", value: code, inline: true }
        )
        .setThumbnail(guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=256` : null)
        .setFooter({ text: "resolved by chromed" })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
    } catch (err) {
      console.error("resolveinvite error:", err);
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle(`${E.error} error`)
        .setDescription(`${E.angry} ${err.message}`);
      return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
    }
  },
};
