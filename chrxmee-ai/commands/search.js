const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("search")
    .setDescription("Search for a song and pick from results.")
    .addStringOption(opt =>
      opt.setName("query").setDescription("Song to search for").setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply();
    const query = interaction.options.getString("query");
    const voiceChannel = interaction.member.voice.channel;

    if (!voiceChannel) return interaction.editReply("❌ You need to be in a voice channel!");

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
    if (!player.connected) await player.connect();

    const result = await player.search({ query, source: "ytsearch" }, interaction.user);
    if (!result?.tracks.length) return interaction.editReply("❌ No results found!");

    const tracks = result.tracks.slice(0, 10);

    const menu = new StringSelectMenuBuilder()
      .setCustomId(`search_select|${interaction.user.id}`)
      .setPlaceholder("Pick a song...")
      .addOptions(tracks.map((t, i) => ({
        label: t.info.title.substring(0, 100),
        description: `${t.info.author} — ${interaction.client.msToTime(t.info.duration)}`,
        value: `${i}`,
      })));

    const embed = new EmbedBuilder()
      .setColor("#5865F2")
      .setTitle(`🔍 Search results for "${query}"`)
      .setDescription(tracks.map((t, i) => `\`${i + 1}.\` **${t.info.title}** — ${t.info.author}`).join("\n"))
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(menu);
    const msg = await interaction.editReply({ embeds: [embed], components: [row] });

    const collector = msg.createMessageComponentCollector({ time: 30000 });
    collector.on("collect", async (i) => {
      if (i.user.id !== interaction.user.id) return i.reply({ content: "❌ This isn't for you!", ephemeral: true });
      const index = parseInt(i.values[0]);
      const track = tracks[index];
      player.queue.add(track);
      if (!player.playing && !player.paused) await player.play();
      await i.update({
        embeds: [new EmbedBuilder().setColor("#5865F2").setTitle("✅ Added to Queue").setDescription(`**[${track.info.title}](${track.info.uri})**`).setThumbnail(track.info.artworkUrl).setTimestamp()],
        components: []
      });
      collector.stop();
    });

    collector.on("end", async (_, reason) => {
      if (reason === "time") await interaction.editReply({ components: [] }).catch(() => {});
    });
  }
};
