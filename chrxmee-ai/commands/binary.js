const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

const E = {
  ai: "<:Chrxmaticc_AI:1480094799292928132>",
  success: "<:Verified_Icon:1527194184841167010>",
  error: "<:no:1530373946795364362>",
  angry: "<:angry_cry:1526029511882440744>",
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("binary")
    .setDescription("encode or decode text to/from binary")
    .addStringOption(option =>
      option.setName("mode")
        .setDescription("encode or decode")
        .setRequired(true)
        .addChoices(
          { name: "encode", value: "encode" },
          { name: "decode", value: "decode" }
        )
    )
    .addStringOption(option =>
      option.setName("text")
        .setDescription("the text to process")
        .setRequired(true)
    ),

  async execute(interaction) {
    const isButtonSim = interaction.isButton && interaction.isButton();
    if (!isButtonSim) {
      try { await interaction.deferReply(); } catch {}
    }

    const mode = interaction.options.getString("mode");
    const text = interaction.options.getString("text");

    let result;
    try {
      if (mode === "encode") {
        result = text
          .split("")
          .map((char) => char.charCodeAt(0).toString(2).padStart(8, "0"))
          .join(" ");
      } else {
        // decode: trim spaces, then split by spaces
        const binaryArray = text.trim().split(/\s+/);
        result = binaryArray
          .map((bin) => String.fromCharCode(parseInt(bin, 2)))
          .join("");
      }
    } catch (err) {
      console.error("binary processing error:", err);
      const errorEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle(`${E.error} binary failed`)
        .setDescription(`${E.angry} something went wrong: ${err.message}`);
      return interaction.editReply({ embeds: [errorEmbed] }).catch(() => interaction.followUp({ embeds: [errorEmbed] }));
    }

    const embed = new EmbedBuilder()
      .setColor(0x7c7ce0) // periwinkle
      .setTitle(`${E.ai} binary ${mode}`)
      .setDescription(`${E.success} **${mode}ed:** \`${result}\``)
      .setFooter({ text: "lowercase only, as always" })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
  },
};
