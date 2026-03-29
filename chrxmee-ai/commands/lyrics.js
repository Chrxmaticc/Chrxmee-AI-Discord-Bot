const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("lyrics")
    .setDescription("Get lyrics for the current or a specific song.")
    .addStringOption(opt =>
      opt.setName("song").setDescription("Song to search lyrics for (defaults to current)").setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    let query = interaction.options.getString("song");

    if (!query) {
      const player = interaction.client.lavalink.getPlayer(interaction.guild.id);
      if (!player?.queue.current) return interaction.editReply("❌ Nothing is playing and no song specified!");
      query = `${player.queue.current.info.title} ${player.queue.current.info.author}`;
    }

    try {
      const res = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();

      if (!data.length) return interaction.editReply("❌ No lyrics found for that song!");

      const track = data[0];
      const lyrics = track.plainLyrics || track.syncedLyrics?.replace(/\[\d+:\d+\.\d+\]/g, "").trim();

      if (!lyrics) return interaction.editReply("❌ Lyrics not available for this song!");

      const chunks = lyrics.match(/[\s\S]{1,4000}/g);

      const embed = new EmbedBuilder()
        .setColor("#5865F2")
        .setTitle(`🎵 ${track.trackName} — ${track.artistName}`)
        .setDescription(chunks[0])
        .setFooter({ text: "Lyrics provided by lrclib.net" })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      for (let i = 1; i < Math.min(chunks.length, 3); i++) {
        await interaction.followUp({ embeds: [new EmbedBuilder().setColor("#5865F2").setDescription(chunks[i])] });
      }
    } catch (err) {
      console.error("Lyrics error:", err);
      return interaction.editReply("❌ Failed to fetch lyrics!");
    }
  }
};
