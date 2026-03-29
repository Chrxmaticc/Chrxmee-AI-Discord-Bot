const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("shuffle")
    .setDescription("Shuffle the current queue."),

  async execute(interaction) {
    const player = interaction.client.lavalink.getPlayer(interaction.guild.id);
    if (!player || !player.queue.tracks.length) return interaction.reply("❌ The queue is empty!");
    if (!interaction.member.voice.channel) return interaction.reply("❌ You need to be in a voice channel!");

    player.queue.shuffle();
    return interaction.reply(`🔀 Shuffled **${player.queue.tracks.length} tracks** in the queue!`);
  }
};
