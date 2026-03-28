const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play a song from YouTube or SoundCloud.")
    .addStringOption(opt =>
      opt.setName("query").setDescription("Song name or URL").setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply();
    const query = interaction.options.getString("query");
    const voiceChannel = interaction.member.voice.channel;

    if (!voiceChannel) return interaction.editReply("❌ You need to be in a voice channel first!");
    if (!voiceChannel.permissionsFor(interaction.guild.members.me).has(["Connect", "Speak"]))
      return interaction.editReply("❌ I don't have permission to join your voice channel!");

    let player = interaction.client.lavalink.getPlayer(interaction.guild.id);

    if (!player) {
      player = await interaction.client.lavalink.createPlayer({
        guildId: interaction.guild.id,
        voiceChannelId: voiceChannel.id,
        textChannelId: interaction.channel.id,
        selfDeaf: false, // 🔥 IMPORTANT FIX
        volume: 100,     // 🔥 FORCE VOLUME
      });
    }

    if (!player.connected) await player.connect();

    // 🔥 EXTRA SAFETY (some libs ignore constructor volume)
    await player.setVolume(100);

    let result = await player.search({ query, source: "ytsearch" }, interaction.user);
    if (!result?.tracks.length)
      result = await player.search({ query, source: "scsearch" }, interaction.user);

    if (!result?.tracks.length)
      return interaction.editReply("❌ No results found!");

    if (result.loadType === "playlist") {
      for (const track of result.tracks) player.queue.add(track);

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor("#5865F2")
            .setTitle("📋 Playlist Added")
            .setDescription(`Added **${result.tracks.length} tracks** from **${result.playlist?.name}**`)
            .setTimestamp()
        ]
      });

    } else {
      const track = result.tracks[0];
      player.queue.add(track);

      if (player.playing || player.queue.tracks.length > 1) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("#5865F2")
              .setTitle("✅ Added to Queue")
              .setDescription(`**[${track.info.title}](${track.info.uri})**`)
              .addFields(
                { name: "Duration", value: interaction.client.msToTime(track.info.duration), inline: true },
                { name: "Position", value: `#${player.queue.tracks.length}`, inline: true }
              )
              .setThumbnail(track.info.artworkUrl)
              .setTimestamp()
          ]
        });
      } else {
        await interaction.editReply("🎵 Starting playback...");
      }
    }

    // 🔥 FORCE PLAY (most important trigger)
    if (!player.playing && !player.paused) {
      await player.play();
    }
  }
};
