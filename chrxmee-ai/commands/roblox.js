const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

const E = {
  success: "<:Verified_Icon:1527194184841167010>",
  error: "<:no:1530373946795364362>",
  ai: "<:Chrxmaticc_AI:1480094799292928132>",
  agree: "<:agreed:1525639597135237131>",
  angry: "<:angry_cry:1526029511882440744>",
  sneaky: "<:sneaky:1527401423690792970>",
  money_cry: "<:Money_Cry_Son:1526538340264841257>",
  cringe_laugh: "<:Cringe_Laughing_Son:1526539082564374710>",
  point_laugh: "<:PointAndLaughingEmoji:1525657154567016469>",
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("roblox")
    .setDescription("look up a roblox user")
    .addSubcommand(sub =>
      sub.setName("profile")
        .setDescription("get roblox user profile")
        .addStringOption(opt => opt.setName("username").setDescription("roblox username").setRequired(true))
    ),

  async execute(interaction) {
    const isButtonSim = interaction.isButton && interaction.isButton();
    if (!isButtonSim) { try { await interaction.deferReply(); } catch {} }

    const username = interaction.options.getString("username");

    try {
      const idRes = await fetch(`https://api.roblox.com/users/get-by-username?username=${encodeURIComponent(username)}`);
      const idData = await idRes.json();
      if (!idData.Id) throw new Error("user not found");

      const userId = idData.Id;
      const avatarRes = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=256x256&format=Png`);
      const avatarData = await avatarRes.json();
      const avatarUrl = avatarData.data?.[0]?.imageUrl || null;

      const embed = new EmbedBuilder()
        .setColor(0x7c7ce0)
        .setTitle(`${E.ai} roblox profile`)
        .setDescription(`**${idData.Username}**`)
        .addFields(
          { name: "user id", value: idData.Id.toString(), inline: true },
          { name: "avatar", value: `[link](${avatarUrl})`, inline: true }
        )
        .setThumbnail(avatarUrl)
        .setFooter({ text: "data from roblox api" })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
    } catch (err) {
      console.error("roblox error:", err);
      const errorEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle(`${E.error} roblox lookup failed`)
        .setDescription(`${E.angry} couldn't find that user: ${err.message}`);
      return interaction.editReply({ embeds: [errorEmbed] }).catch(() => interaction.followUp({ embeds: [errorEmbed] }));
    }
  },
};
