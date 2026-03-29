const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("repeat")
    .setDescription("Toggle repeat for the current song."),

  async execute(interaction) {
    const player = interaction.client.lavalink.getPlayer(interaction.guild.id);
    if (!player || !player.queue.current) return interaction.reply("❌ Nothing is playing!");
    if (!interaction.member.voice.channel) return interaction.reply("❌ You need to be in a voice channel!");

    const newMode = player.repeatMode === "track" ? "off" : "track";
    await player.setRepeatMode(newMode);
    return interaction.reply(newMode === "track" ? "🔂 Repeating the current song!" : "➡️ Repeat **disabled**.");
  }
};
