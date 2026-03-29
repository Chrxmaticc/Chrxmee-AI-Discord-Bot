const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("join")
    .setDescription("Make the bot join your voice channel."),

  async execute(interaction) {
    const voiceChannel = interaction.member.voice.channel;
    if (!voiceChannel) return interaction.reply("❌ You need to be in a voice channel!");

    if (!voiceChannel.permissionsFor(interaction.guild.members.me).has(["Connect", "Speak"]))
      return interaction.reply("❌ I don't have permission to join your voice channel!");

    let player = interaction.client.lavalink.getPlayer(interaction.guild.id);
    if (!player) {
      player = await interaction.client.lavalink.createPlayer({
        guildId: interaction.guild.id,
        voiceChannelId: voiceChannel.id,
        textChannelId: interaction.channel.id,
        selfDeaf: false,
        volume: 80,
      });
    }

    if (player.connected) return interaction.reply("✅ Already in a voice channel!");
    await player.connect();
    return interaction.reply(`✅ Joined **${voiceChannel.name}**!`);
  }
};
