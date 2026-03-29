const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("playlist")
    .setDescription("Manage your music playlists.")

    .addSubcommand(sub =>
      sub.setName("create").setDescription("Create a new playlist.")
        .addStringOption(opt => opt.setName("name").setDescription("Playlist name").setRequired(true))
        .addBooleanOption(opt => opt.setName("public").setDescription("Make it public for others to use?"))
    )
    .addSubcommand(sub =>
      sub.setName("delete").setDescription("Delete a playlist.")
        .addStringOption(opt => opt.setName("name").setDescription("Playlist name").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("add").setDescription("Add current song to a playlist.")
        .addStringOption(opt => opt.setName("name").setDescription("Playlist name").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("load").setDescription("Load a playlist into the queue.")
        .addStringOption(opt => opt.setName("name").setDescription("Playlist name").setRequired(true))
        .addStringOption(opt => opt.setName("user").setDescription("Load another user's public playlist (their user ID)").setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName("import").setDescription("Import a YouTube/SoundCloud playlist URL.")
        .addStringOption(opt => opt.setName("name").setDescription("Name to save as").setRequired(true))
        .addStringOption(opt => opt.setName("url").setDescription("Playlist URL").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("list").setDescription("List all your playlists.")
    )
    .addSubcommand(sub =>
      sub.setName("view").setDescription("View songs in a playlist.")
        .addStringOption(opt => opt.setName("name").setDescription("Playlist name").setRequired(true))
    ),

  async execute(interaction) {
    await interaction.deferReply();
    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    const pool = interaction.client.pool;

    // ── create ────────────────────────────────────────────────
    if (sub === "create") {
      const name = interaction.options.getString("name");
      const isPublic = interaction.options.getBoolean("public") || false;
      try {
        await pool.query(
          `INSERT INTO playlists (user_id, name, is_public) VALUES ($1, $2, $3)`,
          [userId, name, isPublic]
        );
        return interaction.editReply(`✅ Created playlist **${name}**${isPublic ? " (public)" : ""}!`);
      } catch {
        return interaction.editReply(`❌ A playlist called **${name}** already exists!`);
      }
    }

    // ── delete ────────────────────────────────────────────────
    if (sub === "delete") {
      const name = interaction.options.getString("name");
      const result = await pool.query(
        `DELETE FROM playlists WHERE user_id = $1 AND name = $2 RETURNING id`,
        [userId, name]
      );
      if (!result.rows.length) return interaction.editReply(`❌ No playlist called **${name}** found!`);
      return interaction.editReply(`🗑️ Deleted playlist **${name}**!`);
    }

    // ── add ───────────────────────────────────────────────────
    if (sub === "add") {
      const name = interaction.options.getString("name");
      const player = interaction.client.lavalink.getPlayer(interaction.guild.id);
      if (!player?.queue.current) return interaction.editReply("❌ Nothing is playing!");

      const playlist = await pool.query(
        `SELECT id FROM playlists WHERE user_id = $1 AND name = $2`,
        [userId, name]
      );
      if (!playlist.rows.length) return interaction.editReply(`❌ No playlist called **${name}** found!`);

      const track = player.queue.current;
      await pool.query(
        `INSERT INTO playlist_tracks (playlist_id, title, uri, author, duration) VALUES ($1, $2, $3, $4, $5)`,
        [playlist.rows[0].id, track.info.title, track.info.uri, track.info.author, track.info.duration]
      );
      return interaction.editReply(`✅ Added **${track.info.title}** to **${name}**!`);
    }

    // ── load ──────────────────────────────────────────────────
    if (sub === "load") {
      const name = interaction.options.getString("name");
      const targetUserId = interaction.options.getString("user") || userId;
      const voiceChannel = interaction.member.voice.channel;
      if (!voiceChannel) return interaction.editReply("❌ You need to be in a voice channel!");

      const playlist = await pool.query(
        `SELECT p.id, p.is_public FROM playlists p WHERE p.user_id = $1 AND p.name = $2`,
        [targetUserId, name]
      );

      if (!playlist.rows.length) return interaction.editReply(`❌ No playlist called **${name}** found!`);
      if (targetUserId !== userId && !playlist.rows[0].is_public)
        return interaction.editReply("❌ That playlist is private!");

      const tracks = await pool.query(
        `SELECT * FROM playlist_tracks WHERE playlist_id = $1 ORDER BY added_at`,
        [playlist.rows[0].id]
      );
      if (!tracks.rows.length) return interaction.editReply("❌ That playlist is empty!");

      let player = interaction.client.lavalink.getPlayer(interaction.guild.id);
      if (!player) {
        player = await interaction.client.lavalink.createPlayer({
          guildId: interaction.guild.id,
          voiceChannelId: voiceChannel.id,
          textChannelId: interaction.channel.id,
          selfDeaf: true,
          volume: 80,
        });
      }
      if (!player.connected) await player.connect();

      for (const t of tracks.rows) {
        const result = await player.search({ query: t.uri }, interaction.user);
        if (result?.tracks.length) player.queue.add(result.tracks[0]);
      }

      if (!player.playing && !player.paused) await player.play();
      return interaction.editReply({ embeds: [
        new EmbedBuilder()
          .setColor("#5865F2")
          .setTitle("📋 Playlist Loaded")
          .setDescription(`Loaded **${tracks.rows.length} tracks** from **${name}** into the queue!`)
          .setTimestamp()
      ]});
    }

    // ── import ────────────────────────────────────────────────
    if (sub === "import") {
      const name = interaction.options.getString("name");
      const url = interaction.options.getString("url");
      const voiceChannel = interaction.member.voice.channel;
      if (!voiceChannel) return interaction.editReply("❌ You need to be in a voice channel!");

      let player = interaction.client.lavalink.getPlayer(interaction.guild.id);
      if (!player) {
        player = await interaction.client.lavalink.createPlayer({
          guildId: interaction.guild.id,
          voiceChannelId: voiceChannel.id,
          textChannelId: interaction.channel.id,
          selfDeaf: true,
          volume: 80,
        });
      }
      if (!player.connected) await player.connect();

      const result = await player.search({ query: url }, interaction.user);
      if (!result?.tracks.length) return interaction.editReply("❌ No tracks found at that URL!");
      if (result.loadType !== "playlist") return interaction.editReply("❌ That doesn't look like a playlist URL!");

      try {
        await pool.query(
          `INSERT INTO playlists (user_id, name, is_public) VALUES ($1, $2, false)`,
          [userId, name]
        );
      } catch {
        return interaction.editReply(`❌ A playlist called **${name}** already exists!`);
      }

      const playlist = await pool.query(
        `SELECT id FROM playlists WHERE user_id = $1 AND name = $2`,
        [userId, name]
      );

      for (const t of result.tracks) {
        await pool.query(
          `INSERT INTO playlist_tracks (playlist_id, title, uri, author, duration) VALUES ($1, $2, $3, $4, $5)`,
          [playlist.rows[0].id, t.info.title, t.info.uri, t.info.author, t.info.duration]
        );
        player.queue.add(t);
      }

      if (!player.playing && !player.paused) await player.play();
      return interaction.editReply({ embeds: [
        new EmbedBuilder()
          .setColor("#5865F2")
          .setTitle("📋 Playlist Imported")
          .setDescription(`Imported **${result.tracks.length} tracks** from **${result.playlist?.name}** and saved as **${name}**!`)
          .setTimestamp()
      ]});
    }

    // ── list ──────────────────────────────────────────────────
    if (sub === "list") {
      const playlists = await pool.query(
        `SELECT p.name, p.is_public, COUNT(pt.id) as track_count FROM playlists p LEFT JOIN playlist_tracks pt ON p.id = pt.playlist_id WHERE p.user_id = $1 GROUP BY p.id ORDER BY p.created_at DESC`,
        [userId]
      );
      if (!playlists.rows.length) return interaction.editReply("❌ You have no playlists! Create one with `/playlist create`.");

      const embed = new EmbedBuilder()
        .setColor("#5865F2")
        .setTitle(`📋 ${interaction.user.username}'s Playlists`)
        .setDescription(playlists.rows.map((p, i) =>
          `\`${i + 1}.\` **${p.name}** — ${p.track_count} tracks ${p.is_public ? "🌐" : "🔒"}`
        ).join("\n"))
        .setFooter({ text: "🌐 Public  🔒 Private" })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    // ── view ──────────────────────────────────────────────────
    if (sub === "view") {
      const name = interaction.options.getString("name");
      const playlist = await pool.query(
        `SELECT id FROM playlists WHERE user_id = $1 AND name = $2`,
        [userId, name]
      );
      if (!playlist.rows.length) return interaction.editReply(`❌ No playlist called **${name}** found!`);

      const tracks = await pool.query(
        `SELECT title, author, duration FROM playlist_tracks WHERE playlist_id = $1 ORDER BY added_at`,
        [playlist.rows[0].id]
      );
      if (!tracks.rows.length) return interaction.editReply("❌ That playlist is empty!");

      const msToTime = interaction.client.msToTime;
      const embed = new EmbedBuilder()
        .setColor("#5865F2")
        .setTitle(`📋 ${name}`)
        .setDescription(tracks.rows.map((t, i) =>
          `\`${i + 1}.\` **${t.title}** — ${t.author} (${msToTime(t.duration)})`
        ).join("\n").substring(0, 4000))
        .setFooter({ text: `${tracks.rows.length} tracks total` })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }
  }
};
