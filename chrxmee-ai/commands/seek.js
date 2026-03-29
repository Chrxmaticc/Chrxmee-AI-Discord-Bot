const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("seek")
    .setDescription("Seek to a position in the current song.")
    .addStringOption(opt =>
      opt.setName("time").setDescription("Time to seek to (e.g. 1:30 or 90)").setRequired(true)
    ),

  async execute(interaction) {
    const player = interaction.client.lavalink.getPlayer(interaction.guild.id);
    if (!player || !player.queue.current) return interaction.reply("❌ Nothing is playing!");
    if (!interaction.member.voice.channel) return interaction.reply("❌ You need to be in a voice channel!");

    const input = interaction.options.getString("time");
    let ms = 0;

    if (input.includes(":")) {
      const parts = input.split(":").map(Number);
      if (parts.length === 2) ms = (parts[0] * 60 + parts[1]) * 1000;
      if (parts.length === 3) ms = (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
    } else {
      ms = parseInt(input) * 1000;
    }

    if (isNaN(ms) || ms < 0) return interaction.reply("❌ Invalid time format! Use `1:30` or `90`.");
    if (ms > player.queue.current.info.duration) return interaction.reply("❌ That's longer than the song!");

    await player.seek(ms);
    return interaction.reply(`⏩ Seeked to **${interaction.client.msToTime(ms)}**!`);
  }
};
