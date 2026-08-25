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
    .setName("imagine")
    .setDescription("generate an image from your imagination")
    .addStringOption(option =>
      option.setName("prompt")
        .setDescription("what do you want to imagine?")
        .setRequired(true)
    )
    .setContexts([0, 1, 2])
    .setIntegrationTypes([0, 1]),

  async execute(interaction) {
    const isButtonSim = interaction.isButton && interaction.isButton();
    if (!isButtonSim) {
      try { await interaction.deferReply(); } catch {}
    }

    const prompt = interaction.options.getString("prompt");
    const seed = Math.floor(Math.random() * 1000000); // random seed for variety

    // Pollinations free image API — no key needed
    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&seed=${seed}&nologo=true`;

    const embed = new EmbedBuilder()
      .setColor(0x7c7ce0) // periwinkle
      .setTitle(`${E.ai} imagine`)
      .setDescription(`${E.success} here's your image for: **${prompt}**`)
      .setImage(imageUrl)
      .setFooter({ text: "generated with pollinations ai" })
      .setTimestamp();

    try {
      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error("imagine error:", err);
      return interaction.followUp({ content: `${E.error} image generation failed: ${err.message}` }).catch(() => {});
    }
  },
};
