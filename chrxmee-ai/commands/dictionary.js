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
    .setName("dictionary")
    .setDescription("look up a word on urban dictionary")
    .addStringOption(option =>
      option.setName("word")
        .setDescription("the word or phrase to define")
        .setRequired(true)
    ),

  async execute(interaction) {
    const isButtonSim = interaction.isButton && interaction.isButton();
    if (!isButtonSim) {
      try { await interaction.deferReply(); } catch {}
    }

    const word = interaction.options.getString("word").trim();

    try {
      // use HTTPS to avoid mixed content / render failures
      const res = await fetch(`https://api.urbandictionary.com/v0/define?term=${encodeURIComponent(word)}`);
      const data = await res.json();

      if (!data.list || data.list.length === 0) {
        return interaction.editReply(`${E.error} no definition found for **${word}**... maybe it's too underground even for urban.`);
      }

      const def = data.list[0];
      const embed = new EmbedBuilder()
        .setColor(0x7c7ce0)
        .setTitle(`${E.ai} urban dictionary: ${def.word}`)
        .setDescription(def.definition.replace(/\[|\]/g, ""))
        .addFields(
          { name: "example", value: def.example ? def.example.replace(/\[|\]/g, "") : "no example given", inline: false },
          { name: "👍 / 👎", value: `${def.thumbs_up} / ${def.thumbs_down}`, inline: true },
          { name: "by", value: def.author || "anonymous", inline: true }
        )
        .setFooter({ text: "definitions from the streets" })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
    } catch (err) {
      console.error("urban fetch error:", err);
      return interaction.editReply(`${E.angry} urban dictionary is down or wifi betrayed me... try again?`).catch(() => interaction.followUp({ content: `${E.angry} urban dictionary is down or wifi betrayed me... try again?` }));
    }
  },
};
