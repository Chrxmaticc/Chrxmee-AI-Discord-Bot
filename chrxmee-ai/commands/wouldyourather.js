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

// fallback questions in case api fails
const fallbackQuestions = [
  "would you rather fight 100 duck-sized horses or 1 horse-sized duck?",
  "would you rather have unlimited battery life on your phone or unlimited storage?",
  "would you rather know the date of your death or the cause of your death?",
  "would you rather be able to talk to animals or speak every human language fluently?",
  "would you rather have fingers as long as your legs or legs as long as your fingers?",
  "would you rather live in a world where everyone can read minds or everyone can fly?",
  "would you rather have a rewind button for your life or a pause button?",
  "would you rather be able to see 10 minutes into the future or 150 years into the future?",
  "would you rather be the best player on a losing team or the worst player on a winning team?",
  "would you rather have to wear a clown costume every day or have to sing everything you say?",
  "would you rather be able to time travel but only to the past or only to the future?",
  "would you rather have unlimited money but only spend it on other people or have no money but everything you need?",
  "would you rather be stuck in a room with a tarantula or a room full of clowns?",
  "would you rather have a permanent clown nose or permanent clown shoes?",
  "would you rather be able to teleport anywhere but only once a day or be able to fly but only 10 feet off the ground?",
  "would you rather have to eat only spicy food for the rest of your life or only bland food?",
  "would you rather know every language or be able to play every instrument?",
  "would you rather have to wear wet socks forever or have to wear shoes two sizes too small forever?",
  "would you rather be able to stop time for 10 seconds a day or rewind time by 10 seconds once a day?",
  "would you rather have a personal theme song play every time you enter a room or have a laugh track follow you everywhere?",
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName("wouldyourather")
    .setDescription("get a random would you rather question"),

  async execute(interaction) {
    const isButtonSim = interaction.isButton && interaction.isButton();
    if (!isButtonSim) {
      try { await interaction.deferReply(); } catch {}
    }

    let question = "";

    try {
      // try popcat api
      const res = await fetch("https://api.popcat.xyz/wyr");
      const data = await res.json();
      if (data && data.questions && data.questions[0]?.question) {
        question = data.questions[0].question;
      }
    } catch (err) {
      console.warn("popcat wyr api failed, using fallback:", err.message);
    }

    // fallback if api gave nothing or failed
    if (!question) {
      question = fallbackQuestions[Math.floor(Math.random() * fallbackQuestions.length)];
    }

    const embed = new EmbedBuilder()
      .setColor(0x7c7ce0) // periwinkle
      .setTitle(`${E.ai} would you rather...?`)
      .setDescription(question)
      .setFooter({ text: "choose wisely... or don't. up to you." })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
  },
};
