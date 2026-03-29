const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("clear-queue")
    .setDescription("Clear all songs from the queue."),

  async execute(interaction) {
    const player = interaction.client.lavalink.getPlayer(interaction.guild.id);
    if (!player || !player.queue.tracks.length) return interaction.reply("❌ The queue is already empty!");
    if (!interaction.member.voice.channel) return interaction.reply("❌ You need to be in a voice channel!");

    const count = player.queue.tracks.length;
    player.queue.splice(0, player.queue.tracks.length);
    return interaction.reply(`🗑️ Cleared **${count} tracks** from the queue!`);
  }
};
