const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("volume")
    .setDescription("Set the player volume.")
    .addIntegerOption(opt =>
      opt.setName("level").setDescription("Volume (1-100)").setMinValue(1).setMaxValue(100).setRequired(true)
    ),

  async execute(interaction) {
    const player = interaction.client.lavalink.getPlayer(interaction.guild.id);
    if (!player) return interaction.reply("❌ Nothing is playing!");
    if (!interaction.member.voice.channel) return interaction.reply("❌ You need to be in a voice channel!");

    const level = interaction.options.getInteger("level");
    await player.setVolume(level);
    const bar = "█".repeat(Math.floor(level / 10)) + "░".repeat(10 - Math.floor(level / 10));
    return interaction.reply(`🔊 Volume set to **${level}%**\n\`${bar}\``);
  }
};
