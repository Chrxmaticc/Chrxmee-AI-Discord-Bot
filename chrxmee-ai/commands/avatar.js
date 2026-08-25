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

const sizes = [128, 256, 512, 1024, 2048, 4096];

module.exports = {
  data: new SlashCommandBuilder()
    .setName("avatar")
    .setDescription("fetch someone's avatar")
    .addUserOption(opt =>
      opt.setName("user")
        .setDescription("user to fetch avatar from")
        .setRequired(false)
    )
    .addIntegerOption(opt =>
      opt.setName("size")
        .setDescription("avatar size")
        .setRequired(false)
        .addChoices(...sizes.map(s => ({ name: `${s}x${s}`, value: s })))
    ),

  async execute(interaction) {
    const isButtonSim = interaction.isButton && interaction.isButton();
    if (!isButtonSim) {
      try { await interaction.deferReply(); } catch {}
    }

    const target = interaction.options.getUser("user") || interaction.user;
    let size = interaction.options.getInteger("size") || 1024;
    if (!sizes.includes(size)) size = 1024;

    const avatarURL = target.displayAvatarURL({ size, extension: "png" });
    const fallbackURL = target.displayAvatarURL({ size: 1024, extension: "png" });

    const embed = new EmbedBuilder()
      .setColor(0x7c7ce0) // periwinkle
      .setTitle(`${E.ai} avatar — ${target.username}`)
      .setImage(avatarURL)
      .setDescription(`requested size: **${size}x${size}**`)
      .setFooter({ text: "click the link if image doesn't load" })
      .setTimestamp();


    embed.addFields({ name: "direct link", value: `[open avatar](${avatarURL})`, inline: true });

    try {
      return interaction.editReply({ embeds: [embed] });
    } catch {
      return interaction.followUp({ embeds: [embed] }).catch(() => {});
    }
  },
};
