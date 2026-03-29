const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("move")
    .setDescription("Move a song to a different position in the queue.")
    .addIntegerOption(opt =>
      opt.setName("from").setDescription("Current position").setMinValue(1).setRequired(true)
    )
    .addIntegerOption(opt =>
      opt.setName("to").setDescription("New position").setMinValue(1).setRequired(true)
    ),

  async execute(interaction) {
    const player = interaction.client.lavalink.getPlayer(interaction.guild.id);
    if (!player || !player.queue.tracks.length) return interaction.reply("❌ The queue is empty!");
    if (!interaction.member.voice.channel) return interaction.reply("❌ You need to be in a voice channel!");

    const from = interaction.options.getInteger("from") - 1;
    const to = interaction.options.getInteger("to") - 1;

    if (from >= player.queue.tracks.length) return interaction.reply(`❌ No track at position ${from + 1}!`);
    if (to >= player.queue.tracks.length) return interaction.reply(`❌ No track at position ${to + 1}!`);

    const track = player.queue.tracks.splice(from, 1)[0];
    player.queue.tracks.splice(to, 0, track);

    return interaction.reply(`↕️ Moved **${track.info.title}** to position **${to + 1}**.`);
  }
};
