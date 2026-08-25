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

const responses = [
  { text: "yeah, for sure", emoji: E.agree },
  { text: "no way lil bro", emoji: E.angry },
  { text: "maybe, but don't hold your breath", emoji: E.sneaky },
  { text: "ask again later, i'm busy", emoji: E.cringe_laugh },
  { text: "bro, absolutely not", emoji: E.error },
  { text: "100% yes, no cap", emoji: E.success },
  { text: "that's a hard no", emoji: E.angry },
  { text: "i'm seeing good vibes", emoji: E.ai },
  { text: "don't even think about it", emoji: E.point_laugh },
  { text: "yeah, but it's gonna cost you", emoji: E.money_cry },
  { text: "the universe says yes", emoji: E.agree },
  { text: "the universe says no, ggs", emoji: E.error },
  { text: "chances are slim, just like your wifi", emoji: E.cringe_laugh },
  { text: "hell yeah twin", emoji: E.success },
  { text: "idk, go ask someone else", emoji: E.sneaky },
  { text: "only if you slide some robux", emoji: E.money_cry },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName("8ball")
    .setDescription("ask the magic 8ball")
    .addStringOption(opt =>
      opt.setName("question")
        .setDescription("what u wanna ask")
        .setRequired(true)
    ),

  async execute(interaction) {
    // handle prefix fake interaction
    const isButtonSim = interaction.isButton && interaction.isButton();
    if (!isButtonSim) {
      try { await interaction.deferReply(); } catch {}
    }

    const question = interaction.options.getString("question");
    const random = responses[Math.floor(Math.random() * responses.length)];

    const embed = new EmbedBuilder()
      .setColor(0x7c7ce0)
      .setTitle(`${E.ai} 8ball`)
      .addFields(
        { name: "question", value: question, inline: false },
        { name: "answer", value: `${random.emoji} ${random.text}`, inline: false }
      )
      .setFooter({ text: "made by @chrxmeelst, peak right?" })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  },
};
