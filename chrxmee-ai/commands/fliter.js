const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("filter")
    .setDescription("Apply an audio filter to the player.")
    .addStringOption(opt =>
      opt.setName("type").setDescription("Filter to apply").setRequired(true)
        .addChoices(
          { name: "🔊 Bass Boost", value: "bassboost" },
          { name: "🌙 Nightcore (faster + higher pitch)", value: "nightcore" },
          { name: "🌊 Vaporwave (slower + lower pitch)", value: "vaporwave" },
          { name: "🎧 8D Audio (rotation effect)", value: "8d" },
          { name: "🎤 Karaoke (removes vocals)", value: "karaoke" },
          { name: "〰️ Tremolo (wavering volume)", value: "tremolo" },
          { name: "🎸 Vibrato (wavering pitch)", value: "vibrato" },
          { name: "🌥️ Soft (low pass smoothing)", value: "soft" },
          { name: "❌ Clear all filters", value: "clear" }
        )
    ),

  async execute(interaction) {
    const player = interaction.client.lavalink.getPlayer(interaction.guild.id);
    if (!player || !player.queue.current) return interaction.reply("❌ Nothing is playing!");
    if (!interaction.member.voice.channel) return interaction.reply("❌ You need to be in a voice channel!");
    if (!player.filterManager) return interaction.reply("❌ Filters aren't supported on this Lavalink node!");

    const type = interaction.options.getString("type");

    if (type === "clear") {
      await player.filterManager.resetFilters();
      return interaction.reply("✅ Cleared all filters!");
    }

    const descriptions = {
      bassboost:  "🔊 **Bass Boost** — Pumping up the low end!",
      nightcore:  "🌙 **Nightcore** — Sped up and pitch shifted!",
      vaporwave:  "🌊 **Vaporwave** — Slowed down and dreamy!",
      "8d":       "🎧 **8D Audio** — Audio rotating around your head!",
      karaoke:    "🎤 **Karaoke** — Attempting to remove vocals!",
      tremolo:    "〰️ **Tremolo** — Wavering volume effect!",
      vibrato:    "🎸 **Vibrato** — Wavering pitch effect!",
      soft:       "🌥️ **Soft** — Smoothed out audio!",
    };

    try {
      switch (type) {
        case "bassboost":
          await player.filterManager.setEqualizer([
            { band: 0, gain: 0.6 }, { band: 1, gain: 0.7 },
            { band: 2, gain: 0.8 }, { band: 3, gain: 0.55 }, { band: 4, gain: 0.25 }
          ]);
          break;
        case "nightcore":
          await player.filterManager.setTimescale({ speed: 1.2, pitch: 1.3, rate: 1.0 });
          break;
        case "vaporwave":
          await player.filterManager.setTimescale({ speed: 0.8, pitch: 0.8, rate: 1.0 });
          await player.filterManager.setTremolo({ frequency: 14.0, depth: 0.3 });
          break;
        case "8d":
          await player.filterManager.setRotation({ rotationHz: 0.2 });
          break;
        case "karaoke":
          await player.filterManager.setKaraoke({ level: 1.0, monoLevel: 1.0, filterBand: 220.0, filterWidth: 100.0 });
          break;
        case "tremolo":
          await player.filterManager.setTremolo({ frequency: 4.0, depth: 0.75 });
          break;
        case "vibrato":
          await player.filterManager.setVibrato({ frequency: 4.0, depth: 0.75 });
          break;
        case "soft":
          await player.filterManager.setLowPass({ smoothing: 20.0 });
          break;
      }
    } catch (err) {
      console.error("Filter error:", err);
      return interaction.reply("❌ Failed to apply filter! Your Lavalink node may not support this.");
    }

    return interaction.reply({ embeds: [
      new EmbedBuilder()
        .setColor("#5865F2")
        .setTitle("🎛️ Filter Applied")
        .setDescription(descriptions[type])
        .setFooter({ text: "Use /filter clear to remove all filters" })
        .setTimestamp()
    ]});
  }
};
