const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("leave")
    .setDescription("Make the bot leave the voice channel."),

  async execute(interaction) {
    const player = interaction.client.lavalink.getPlayer(interaction.guild.id);
    if (!player) return interaction.reply("❌ I'm not in a voice channel!");
    if (!interaction.member.voice.channel) return interaction.reply("❌ You need to be in a voice channel!");

    await player.destroy();
    return interaction.reply("👋 Left the voice channel!");
  }
};

// Destroys the player cuz why not yeah everyone knows im a fuckass
