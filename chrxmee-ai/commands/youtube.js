const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require("discord.js");

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
    .setName("youtube")
    .setDescription("scrape youtube videos")
    .addSubcommand(sub =>
      sub.setName("video")
        .setDescription("get youtube video info and mp4")
        .addStringOption(opt => opt.setName("url").setDescription("youtube video url").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("search")
        .setDescription("search youtube")
        .addStringOption(opt => opt.setName("query").setDescription("search query").setRequired(true))
    ),

  async execute(interaction) {
    const isButtonSim = interaction.isButton && interaction.isButton();
    if (!isButtonSim) { try { await interaction.deferReply(); } catch {} }

    const sub = interaction.options.getSubcommand();

    try {
      if (sub === "video") {
        const url = interaction.options.getString("url");
        const apiUrl = `https://api.popcat.xyz/ytdl?url=${encodeURIComponent(url)}`;
        const res = await fetch(apiUrl);
        const data = await res.json();
        if (!data || !data.title) throw new Error("video not found");

        const embed = new EmbedBuilder()
          .setColor(0x7c7ce0)
          .setTitle(`${E.ai} youtube video`)
          .setDescription(`**${data.title}**`)
          .addFields(
            { name: "duration", value: data.duration || "unknown", inline: true },
            { name: "views", value: data.views || "unknown", inline: true }
          )
          .setThumbnail(data.thumbnail || null)
          .setFooter({ text: "scraped by chromed" })
          .setTimestamp();

        if (data.url) {
          const videoRes = await fetch(data.url);
          const videoBuffer = Buffer.from(await videoRes.arrayBuffer());
          const attachment = new AttachmentBuilder(videoBuffer, { name: "youtube.mp4" });
          return interaction.editReply({ embeds: [embed], files: [attachment] }).catch(() => interaction.followUp({ embeds: [embed], files: [attachment] }));
        } else {
          return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
        }
      }

      if (sub === "search") {
        const query = interaction.options.getString("query");
        const apiUrl = `https://api.popcat.xyz/ytsearch?query=${encodeURIComponent(query)}`;
        const res = await fetch(apiUrl);
        const data = await res.json();
        if (!data || !data.length) throw new Error("no results");

        const first = data[0];
        const embed = new EmbedBuilder()
          .setColor(0x7c7ce0)
          .setTitle(`${E.ai} youtube search: ${query}`)
          .setDescription(`**${first.title}**`)
          .addFields(
            { name: "url", value: first.url || "no url", inline: true },
            { name: "duration", value: first.duration || "unknown", inline: true }
          )
          .setThumbnail(first.thumbnail || null)
          .setFooter({ text: `showing 1 of ${data.length} results` })
          .setTimestamp();
        return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
      }
    } catch (err) {
      console.error("youtube error:", err);
      const errorEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle(`${E.error} youtube scrape failed`)
        .setDescription(`${E.angry} couldn't fetch youtube data: ${err.message}`);
      return interaction.editReply({ embeds: [errorEmbed] }).catch(() => interaction.followUp({ embeds: [errorEmbed] }));
    }
  },
};
