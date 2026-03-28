const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("nowplaying")
    .setDescription("Show the currently playing song."),

  async execute(interaction) {
    const player = interaction.client.lavalink.getPlayer(interaction.guild.id);
    if (!player || !player.queue.current) return interaction.reply("❌ Nothing is playing!");

    const track = player.queue.current;
    const msToTime = interaction.client.msToTime;
    const position = player.position;
    const duration = track.info.duration;
    const percent = Math.floor((position / duration) * 20);
    const bar = "▓".repeat(percent) + "░".repeat(20 - percent);

    return interaction.reply({ embeds: [
      new EmbedBuilder()
        .setColor("#5865F2")
        .setTitle("🎵 Now Playing")
        .setDescription(`**[${track.info.title}](${track.info.uri})**`)
        .addFields(
          { name: "Author", value: track.info.author, inline: true },
          { name: "Requested by", value: `<@${track.info.requester?.id || "Unknown"}>`, inline: true },
          { name: "Loop", value: player.repeatMode === "off" ? "Off" : player.repeatMode === "track" ? "🔂 Track" : "🔁 Queue", inline: true },
          { name: "Progress", value: `\`${bar}\`\n${msToTime(position)} / ${msToTime(duration)}` }
        )
        .setThumbnail(track.info.artworkUrl)
        .setTimestamp()
    ]});
  }
};
