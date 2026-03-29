const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("remove")
    .setDescription("Remove a song from the queue.")
    .addIntegerOption(opt =>
      opt.setName("position").setDescription("Position in queue to remove").setMinValue(1).setRequired(true)
    ),

  async execute(interaction) {
    const player = interaction.client.lavalink.getPlayer(interaction.guild.id);
    if (!player || !player.queue.tracks.length) return interaction.reply("❌ The queue is empty!");
    if (!interaction.member.voice.channel) return interaction.reply("❌ You need to be in a voice channel!");

    const pos = interaction.options.getInteger("position") - 1;
    if (pos >= player.queue.tracks.length) return interaction.reply(`❌ No track at position ${pos + 1}!`);

    const removed = player.queue.tracks[pos];
    player.queue.splice(pos, 1);
    return interaction.reply(`🗑️ Removed **${removed.info.title}** from the queue.`);
  }
};
