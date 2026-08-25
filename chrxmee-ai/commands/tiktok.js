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
    .setName("tiktok")
    .setDescription("scrape tiktok videos, profiles, and search")
    .addSubcommand(sub =>
      sub.setName("video")
        .setDescription("get tiktok video info and mp4")
        .addStringOption(opt => opt.setName("url").setDescription("tiktok video url").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("profile")
        .setDescription("get tiktok user profile")
        .addStringOption(opt => opt.setName("username").setDescription("tiktok username").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("search")
        .setDescription("search tiktok videos")
        .addStringOption(opt => opt.setName("query").setDescription("search query").setRequired(true))
    ),

  async execute(interaction) {
    const isButtonSim = interaction.isButton && interaction.isButton();
    if (!isButtonSim) { try { await interaction.deferReply(); } catch {} }

    const sub = interaction.options.getSubcommand();

    try {
    if (sub === "video") {
  const url = interaction.options.getString("url");
  let videoData = null;

  // try popcat first
  try {
    const popcatRes = await fetch(`https://api.popcat.xyz/tiktok?url=${encodeURIComponent(url)}`);
    const data = await popcatRes.json();
    if (data && data.video) {
      videoData = {
        title: data.title || "no title",
        author: data.author || "unknown",
        videoUrl: data.video,
        cover: data.cover || null,
      };
    }
  } catch {}

  // fallback to tikwm
  if (!videoData) {
    const tikwmRes = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`);
    const data = await tikwmRes.json();
    if (data.code === 0 && data.data) {
      videoData = {
        title: data.data.title || "no title",
        author: data.data.author?.nickname || "unknown",
        videoUrl: data.data.play,
        cover: data.data.cover || null,
      };
    }
  }

  if (!videoData) throw new Error("couldn't fetch tiktok video");

  // fetch video buffer
  const videoRes = await fetch(videoData.videoUrl);
  const videoBuffer = Buffer.from(await videoRes.arrayBuffer());

  const embed = new EmbedBuilder()
    .setColor(0x7c7ce0)
    .setTitle(`${E.ai} tiktok video`)
    .setDescription(`**${videoData.title}**`)
    .addFields(
      { name: "author", value: videoData.author, inline: true }
    )
    .setImage(videoData.cover)
    .setFooter({ text: "scraped by chromed" })
    .setTimestamp();

  const attachment = new AttachmentBuilder(videoBuffer, { name: "tiktok.mp4" });
  return interaction.editReply({ embeds: [embed], files: [attachment] }).catch(() => interaction.followUp({ embeds: [embed], files: [attachment] }));
}
      if (sub === "profile") {
        const username = interaction.options.getString("username");
        const apiUrl = `https://api.popcat.xyz/tiktok?user=${encodeURIComponent(username)}`;
        const res = await fetch(apiUrl);
        const data = await res.json();
        if (!data || !data.user) throw new Error("profile not found");

        const embed = new EmbedBuilder()
          .setColor(0x7c7ce0)
          .setTitle(`${E.ai} tiktok profile`)
          .setDescription(`**${data.user.nickname || username}**`)
          .addFields(
            { name: "followers", value: data.user.followers || "0", inline: true },
            { name: "following", value: data.user.following || "0", inline: true },
            { name: "likes", value: data.user.likes || "0", inline: true },
            { name: "videos", value: data.user.videos || "0", inline: true }
          )
          .setThumbnail(data.user.avatar || null)
          .setFooter({ text: "scraped by chromed" })
          .setTimestamp();
        return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
      }

      if (sub === "search") {
        const query = interaction.options.getString("query");
        const apiUrl = `https://api.popcat.xyz/tiktok?search=${encodeURIComponent(query)}`;
        const res = await fetch(apiUrl);
        const data = await res.json();
        if (!data || !data.results || !data.results.length) throw new Error("no results");

        const first = data.results[0];
        const embed = new EmbedBuilder()
          .setColor(0x7c7ce0)
          .setTitle(`${E.ai} tiktok search: ${query}`)
          .setDescription(`**${first.title}**`)
          .addFields(
            { name: "author", value: first.author || "unknown", inline: true },
            { name: "url", value: first.url || "no url", inline: true }
          )
          .setImage(first.cover || null)
          .setFooter({ text: `showing 1 of ${data.results.length} results` })
          .setTimestamp();
        return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
      }
    } catch (err) {
      console.error("tiktok error:", err);
      const errorEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle(`${E.error} tiktok scrape failed`)
        .setDescription(`${E.angry} couldn't fetch tiktok data: ${err.message}`);
      return interaction.editReply({ embeds: [errorEmbed] }).catch(() => interaction.followUp({ embeds: [errorEmbed] }));
    }
  },
};
