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
    if (!player.filterManager) return interaction.reply("❌ Filters aren't supported on this node!");

    const type = interaction.options.getString("type");

    const descriptions = {
      bassboost: "🔊 **Bass Boost** — Pumping up the low end!",
      nightcore: "🌙 **Nightcore** — Sped up and pitch shifted!",
      vaporwave: "🌊 **Vaporwave** — Slowed down and dreamy!",
      "8d":      "🎧 **8D Audio** — Audio rotating around your head!",
      karaoke:   "🎤 **Karaoke** — Attempting to remove vocals!",
      tremolo:   "〰️ **Tremolo** — Wavering volume effect!",
      vibrato:   "🎸 **Vibrato** — Wavering pitch effect!",
      soft:      "🌥️ **Soft** — Smoothed out audio!",
    };

    try {
      await player.filterManager.resetFilters();

      switch (type) {
        case "clear":
          return interaction.reply("✅ Cleared all filters!");
        case "bassboost":
          await player.filterManager.setEQPreset("boost");
          break;
        case "nightcore":
          await player.filterManager.toggleNightcore();
          break;
        case "vaporwave":
          await player.filterManager.toggleVaporwave();
          break;
        case "8d":
          await player.filterManager.toggleRotation();
          break;
        case "karaoke":
          await player.filterManager.toggleKaraoke();
          break;
        case "tremolo":
          await player.filterManager.toggleTremolo();
          break;
        case "vibrato":
          await player.filterManager.toggleVibrato();
          break;
        case "soft":
          await player.filterManager.toggleLowPass();
          break;
      }
    } catch (err) {
      console.error("Filter error:", err.message);
      return interaction.reply(`❌ Filter failed: \`${err.message}\``);
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
