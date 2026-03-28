const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("queue")
    .setDescription("Show the current queue.")
    .addIntegerOption(opt =>
      opt.setName("page").setDescription("Page number").setMinValue(1)
    ),

  async execute(interaction) {
    const player = interaction.client.lavalink.getPlayer(interaction.guild.id);
    if (!player || !player.queue.current) return interaction.reply("❌ Nothing is playing!");

    const msToTime = interaction.client.msToTime;
    const page = (interaction.options.getInteger("page") || 1) - 1;
    const pageSize = 10;
    const tracks = player.queue.tracks;
    const totalPages = Math.max(1, Math.ceil(tracks.length / pageSize));
    if (page >= totalPages) return interaction.reply(`❌ Max page is ${totalPages}.`);

    const current = player.queue.current;
    const slice = tracks.slice(page * pageSize, page * pageSize + pageSize);
    const queueList = slice.length
      ? slice.map((t, i) => `\`${page * pageSize + i + 1}.\` **[${t.info.title}](${t.info.uri})** — ${msToTime(t.info.duration)}`).join("\n")
      : "No more tracks in queue.";
    const totalDuration = tracks.reduce((acc, t) => acc + t.info.duration, 0);

    return interaction.reply({ embeds: [
      new EmbedBuilder()
        .setColor("#5865F2")
        .setTitle(`📋 Queue — ${interaction.guild.name}`)
        .setDescription(`**Now Playing:**\n**[${current.info.title}](${current.info.uri})** — ${msToTime(current.info.duration)}\n\n**Up Next:**\n${queueList}`)
        .setFooter({ text: `Page ${page + 1}/${totalPages} • ${tracks.length} tracks • Total: ${msToTime(totalDuration)}` })
        .setTimestamp()
    ]});
  }
};
