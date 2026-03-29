const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("previous")
    .setDescription("Go back to the previous song."),

  async execute(interaction) {
    const player = interaction.client.lavalink.getPlayer(interaction.guild.id);
    if (!player) return interaction.reply("❌ Nothing is playing!");
    if (!interaction.member.voice.channel) return interaction.reply("❌ You need to be in a voice channel!");

    const prev = player.queue.previous?.[0];
    if (!prev) return interaction.reply("❌ No previous song to go back to!");

    player.queue.unshift(prev);
    await player.skip();
    return interaction.reply(`⏮️ Going back to **${prev.info.title}**!`);
  }
};
