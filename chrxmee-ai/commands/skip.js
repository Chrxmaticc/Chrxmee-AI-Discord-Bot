const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("skip")
    .setDescription("Skip the current song.")
    .addIntegerOption(opt =>
      opt.setName("amount").setDescription("How many songs to skip (default: 1)").setMinValue(1)
    ),

  async execute(interaction) {
    const player = interaction.client.lavalink.getPlayer(interaction.guild.id);
    if (!player || !player.playing) return interaction.reply("❌ Nothing is playing!");
    if (!interaction.member.voice.channel) return interaction.reply("❌ You need to be in a voice channel!");

    const amount = interaction.options.getInteger("amount") || 1;
    if (amount > 1) player.queue.splice(0, Math.min(amount - 1, player.queue.tracks.length));

    const skipped = player.queue.current;
    await player.skip();
    return interaction.reply(`⏭️ Skipped **${skipped?.info.title || "current track"}**${amount > 1 ? ` + ${amount - 1} more` : ""}.`);
  }
};
