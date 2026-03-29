const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("24-7")
    .setDescription("Toggle 24/7 mode — bot stays in VC even when queue ends."),

  async execute(interaction) {
    const player = interaction.client.lavalink.getPlayer(interaction.guild.id);
    if (!player) return interaction.reply("❌ I'm not in a voice channel! Use `/join` first.");
    if (!interaction.member.voice.channel) return interaction.reply("❌ You need to be in a voice channel!");

    player.twentyFourSeven = !player.twentyFourSeven;

    if (player.twentyFourSeven) {
      player.set("onEmptyQueue", null);
    } else {
      player.set("onEmptyQueue", { destroyAfterMs: 30000 });
    }

    return interaction.reply(player.twentyFourSeven
      ? "🕐 **24/7 mode enabled** — I'll stay in VC even when the queue ends!"
      : "✅ **24/7 mode disabled** — I'll leave after 30 seconds of inactivity."
    );
  }
};
