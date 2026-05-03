const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { joinVoiceChannel, createAudioPlayer, createAudioResource, StreamType, VoiceConnectionStatus, entersState } = require("@discordjs/voice");
const { PassThrough } = require("stream");

// ==================== HELPERS ====================

async function ensureVoiceConnection(interaction, client) {
  const guildId = interaction.guildId;
  const voiceChannel = interaction.member?.voice?.channel;

  if (!voiceChannel) {
    await interaction.reply({ content: "❌ You need to be in a voice channel first.", ephemeral: true });
    return null;
  }

  let connection = client.voiceConnections?.get(guildId);
  if (connection && connection.state?.status === VoiceConnectionStatus.Ready) {
    return connection;
  }

  connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId,
    adapterCreator: interaction.guild.voiceAdapterCreator,
  });

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 10000);
  } catch {
    connection.destroy();
    await interaction.reply({ content: "❌ Could not connect to voice channel.", ephemeral: true });
    return null;
  }

  if (!client.voiceConnections) client.voiceConnections = new Map();
  if (!client.audioStreams) client.audioStreams = new Map();
  if (!client.audioPlayers) client.audioPlayers = new Map();

  client.voiceConnections.set(guildId, connection);

  const audioStream = new PassThrough();
  client.audioStreams.set(guildId, audioStream);

  const audioPlayer = createAudioPlayer();
  const resource = createAudioResource(audioStream, { inputType: StreamType.Raw });
  audioPlayer.play(resource);
  connection.subscribe(audioPlayer);
  client.audioPlayers.set(guildId, audioPlayer);

  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 5000),
        entersState(connection, VoiceConnectionStatus.Connecting, 5000),
      ]);
    } catch {
      connection.destroy();
      client.voiceConnections?.delete(guildId);
      client.audioStreams?.delete(guildId);
      client.audioPlayers?.delete(guildId);
      if (typeof global.sendToChrxmee === "function") {
        global.sendToChrxmee(guildId, { op: "destroy" });
      }
    }
  });

  return connection;
}

function sendToChrxmee(guildId, op) {
  if (typeof global.sendToChrxmee === "function") {
    global.sendToChrxmee(guildId, op);
  }
}

// ==================== PLAYER MARKER STORAGE ====================
const playerMarkers = new Map(); // guildId -> { start?: number, end?: number, loop?: boolean }

// ==================== COMMAND ====================

module.exports = {
  data: new SlashCommandBuilder()
    .setName("music")
    .setDescription("All music commands powered by ChrxmeeStream v2.0")
    .addSubcommand(sub =>
      sub.setName("play")
        .setDescription("Play a song from URL, search, or WRITE(file.mp3)")
        .addStringOption(o => o.setName("source").setDescription("URL, search query, or WRITE(filename.mp3)").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("stop")
        .setDescription("Stop playback and clear the current track")
    )
    .addSubcommand(sub =>
      sub.setName("pause")
        .setDescription("Pause the current track")
    )
    .addSubcommand(sub =>
      sub.setName("resume")
        .setDescription("Resume a paused track")
    )
    .addSubcommand(sub =>
      sub.setName("skip")
        .setDescription("Skip the current track")
    )
    .addSubcommand(sub =>
      sub.setName("volume")
        .setDescription("Set the volume (0–200)")
        .addIntegerOption(o => o.setName("value").setDescription("Volume 0–200").setRequired(true).setMinValue(0).setMaxValue(200))
    )
    .addSubcommand(sub =>
      sub.setName("seek")
        .setDescription("Jump to a position in the track")
        .addStringOption(o => o.setName("position").setDescription("Position (e.g. 1:30 or 90)").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("filter")
        .setDescription("Apply an audio filter")
        .addStringOption(o => o.setName("name").setDescription("Filter name (use /music filters to see all)").setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName("filters")
        .setDescription("List all available audio filters")
    )
    .addSubcommand(sub =>
      sub.setName("loop")
        .setDescription("Set loop mode")
        .addStringOption(o => o.setName("mode").setDescription("Loop mode").setRequired(true)
          .addChoices(
            { name: "Off", value: "off" },
            { name: "Track", value: "track" },
            { name: "Queue", value: "queue" },
          ))
    )
    .addSubcommand(sub =>
      sub.setName("shuffle")
        .setDescription("Shuffle the queue")
    )
    .addSubcommand(sub =>
      sub.setName("queue")
        .setDescription("View the current queue")
    )
    .addSubcommand(sub =>
      sub.setName("clearqueue")
        .setDescription("Clear the entire queue")
    )
    .addSubcommand(sub =>
      sub.setName("remove")
        .setDescription("Remove a track from the queue")
        .addIntegerOption(o => o.setName("position").setDescription("Position in queue (1-based)").setRequired(true).setMinValue(1))
    )
    .addSubcommand(sub =>
      sub.setName("move")
        .setDescription("Move a track to a different position")
        .addIntegerOption(o => o.setName("from").setDescription("Current position").setRequired(true).setMinValue(1))
        .addIntegerOption(o => o.setName("to").setDescription("New position").setRequired(true).setMinValue(1))
    )
    .addSubcommand(sub =>
      sub.setName("autoplay")
        .setDescription("Toggle Auto DJ (auto-queues similar tracks)")
        .addBooleanOption(o => o.setName("enabled").setDescription("Enable or disable").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("nowplaying")
        .setDescription("Show what's currently playing")
    )
    .addSubcommand(sub =>
      sub.setName("leave")
        .setDescription("Leave the voice channel")
    )
    .addSubcommand(sub =>
      sub.setName("player-set")
        .setDescription("Set a start marker — playback begins at this timestamp")
        .addStringOption(o => o.setName("start").setDescription("Start time (e.g. 1:30 or 90)").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("player-end")
        .setDescription("Set an end marker — playback stops at this timestamp")
        .addStringOption(o => o.setName("end").setDescription("End time (e.g. 2:30 or 150)").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("player-loop")
        .setDescription("Toggle looping between start and end markers")
    )
    .addSubcommand(sub =>
      sub.setName("player-clear")
        .setDescription("Clear all player markers (start/end/loop)")
    )
    .addSubcommand(sub =>
      sub.setName("lyrics")
        .setDescription("Get lyrics for the current track")
    )
    .addSubcommand(sub =>
      sub.setName("save")
        .setDescription("DM yourself the current track info")
    )
    .addSubcommand(sub =>
      sub.setName("history")
        .setDescription("View recently played tracks")
    ),

  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    // ==================== HELPERS ====================

    function parseTime(input) {
      if (typeof input === "number") return input;
      if (input.includes(":")) {
        const parts = input.split(":");
        if (parts.length === 2) return parseInt(parts[0]) * 60 + parseInt(parts[1]);
        if (parts.length === 3) return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
      }
      return parseInt(input) || 0;
    }

    function formatTime(seconds) {
      const m = Math.floor(seconds / 60).toString().padStart(2, "0");
      const s = (seconds % 60).toString().padStart(2, "0");
      return `${m}:${s}`;
    }

    // ==================== ROUTER ====================

    switch (subcommand) {

      // ── PLAY ──────────────────────────────────

      case "play": {
        const source = interaction.options.getString("source");
        const connection = await ensureVoiceConnection(interaction, client);
        if (!connection) return;

        // Apply player-set start marker if configured
        const markers = playerMarkers.get(guildId);
        if (markers?.start != null) {
          sendToChrxmee(guildId, { op: "play", source });
          // Seek to start marker after a short delay
          setTimeout(() => {
            sendToChrxmee(guildId, { op: "seek", value: markers.start });
          }, 500);

          // If end marker is set, schedule a stop
          if (markers.end != null) {
            const duration = markers.end - markers.start;
            setTimeout(() => {
              sendToChrxmee(guildId, { op: "stop" });
              if (markers.loop) {
                // Re-play with loop
                setTimeout(() => {
                  this.execute(interaction, client);
                }, 500);
              }
            }, duration * 1000 + 1000);
          }

          await interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setColor("#9b59b6")
                .setTitle("▶️ Now Playing (Markers Active)")
                .setDescription(`\`${source}\``)
                .addFields(
                  markers.start != null ? { name: "⏩ Start", value: formatTime(markers.start), inline: true } : { name: "\u200b", value: "\u200b", inline: true },
                  markers.end != null ? { name: "⏹️ End", value: formatTime(markers.end), inline: true } : { name: "\u200b", value: "\u200b", inline: true },
                  { name: "🔁 Loop", value: markers.loop ? "ON" : "OFF", inline: true },
                )
                .setFooter({ text: "ChrxmeeStream v2.0" }),
            ],
          });
        } else {
          sendToChrxmee(guildId, { op: "play", source });
          await interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setColor("#9b59b6")
                .setTitle("▶️ Now Playing")
                .setDescription(`\`${source}\``)
                .setFooter({ text: "ChrxmeeStream v2.0" }),
            ],
          });
        }
        break;
      }

      // ── STOP ──────────────────────────────────

      case "stop":
        sendToChrxmee(guildId, { op: "stop" });
        await interaction.reply("⏹️ Stopped.");
        break;

      // ── PAUSE ─────────────────────────────────

      case "pause":
        sendToChrxmee(guildId, { op: "pause" });
        await interaction.reply("⏸️ Paused.");
        break;

      // ── RESUME ────────────────────────────────

      case "resume":
        sendToChrxmee(guildId, { op: "resume" });
        await interaction.reply("▶️ Resumed.");
        break;

      // ── SKIP ──────────────────────────────────

      case "skip":
        sendToChrxmee(guildId, { op: "stop" });
        await interaction.reply("⏭️ Skipped.");
        break;

      // ── VOLUME ────────────────────────────────

      case "volume": {
        const value = interaction.options.getInteger("value");
        sendToChrxmee(guildId, { op: "volume", value });
        await interaction.reply(`🔊 Volume set to **${value}**`);
        break;
      }

      // ── SEEK ──────────────────────────────────

      case "seek": {
        const input = interaction.options.getString("position");
        const seconds = parseTime(input);
        sendToChrxmee(guildId, { op: "seek", value: seconds });
        await interaction.reply(`⏩ Seeked to **${formatTime(seconds)}**`);
        break;
      }

      // ── FILTER ────────────────────────────────

      case "filter": {
        const name = interaction.options.getString("name");
        if (!name) {
          sendToChrxmee(guildId, { op: "filter", filters: [] });
          await interaction.reply("🎛️ All filters cleared.");
        } else {
          sendToChrxmee(guildId, { op: "filter", filters: [name] });
          await interaction.reply(`🎛️ Filter **${name}** applied.`);
        }
        break;
      }

      // ── FILTERS LIST ──────────────────────────

      case "filters": {
        const FILTERS = [
          "bassboost", "nightcore", "vaporwave", "slowed", "echo", "reverb",
          "normalize", "earrape", "karaoke", "mono", "treble", "soft",
          "underwater", "telephone", "chipmunk", "deep", "robot",
        ];
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor("#1db954")
              .setTitle("🎛️ Available Filters")
              .setDescription(FILTERS.map(f => `\`${f}\``).join("  "))
              .setFooter({ text: "Use /music filter <name> to apply" }),
          ],
        });
        break;
      }

      // ── LOOP ──────────────────────────────────

      case "loop": {
        const mode = interaction.options.getString("mode");
        sendToChrxmee(guildId, { op: "queue_loop", value: mode });
        await interaction.reply(`🔁 Loop set to **${mode}**`);
        break;
      }

      // ── SHUFFLE ───────────────────────────────

      case "shuffle":
        sendToChrxmee(guildId, { op: "queue_shuffle" });
        await interaction.reply("🔀 Queue shuffled.");
        break;

      // ── QUEUE ─────────────────────────────────

      case "queue":
        sendToChrxmee(guildId, { op: "queue_list" });
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor("#9b59b6")
              .setTitle("📋 Queue")
              .setDescription("Queue requested. Use `/music queue` to refresh.")
              .setFooter({ text: "ChrxmeeStream v2.0" }),
          ],
        });
        break;

      // ── CLEAR QUEUE ───────────────────────────

      case "clearqueue":
        sendToChrxmee(guildId, { op: "queue_clear" });
        await interaction.reply("🗑️ Queue cleared.");
        break;

      // ── REMOVE ────────────────────────────────

      case "remove": {
        const position = interaction.options.getInteger("position") - 1; // 0-based
        sendToChrxmee(guildId, { op: "queue_remove", position });
        await interaction.reply(`🗑️ Removed track at position **${position + 1}**.`);
        break;
      }

      // ── MOVE ──────────────────────────────────

      case "move": {
        const from = interaction.options.getInteger("from") - 1;
        const to = interaction.options.getInteger("to") - 1;
        sendToChrxmee(guildId, { op: "queue_move", from, to });
        await interaction.reply(`↔️ Moved track from **${from + 1}** to **${to + 1}**.`);
        break;
      }

      // ── AUTOPLAY ──────────────────────────────

      case "autoplay": {
        const enabled = interaction.options.getBoolean("enabled");
        sendToChrxmee(guildId, { op: enabled ? "autodj_enable" : "autodj_disable" });
        await interaction.reply(`🤖 Auto DJ **${enabled ? "enabled" : "disabled"}**.`);
        break;
      }

      // ── NOW PLAYING ───────────────────────────

      case "nowplaying":
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor("#9b59b6")
              .setTitle("🎵 Now Playing")
              .setDescription("Check `/music queue` for current track info.")
              .setFooter({ text: "ChrxmeeStream v2.0" }),
          ],
        });
        break;

      // ── LEAVE ─────────────────────────────────

      case "leave": {
        const connection = client.voiceConnections?.get(guildId);
        if (connection) {
          connection.destroy();
          client.voiceConnections?.delete(guildId);
          client.audioStreams?.delete(guildId);
          client.audioPlayers?.delete(guildId);
        }
        sendToChrxmee(guildId, { op: "destroy" });
        await interaction.reply("👋 Left the voice channel.");
        break;
      }

      // ── PLAYER-SET (START MARKER) ─────────────

      case "player-set": {
        const input = interaction.options.getString("start");
        const startSeconds = parseTime(input);

        if (!playerMarkers.has(guildId)) {
          playerMarkers.set(guildId, {});
        }
        playerMarkers.get(guildId).start = startSeconds;

        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor("#e67e22")
              .setTitle("⏩ Player Start Marker Set")
              .setDescription(`Playback will start at **${formatTime(startSeconds)}**`)
              .addFields(
                { name: "Start", value: formatTime(startSeconds), inline: true },
                { name: "End", value: playerMarkers.get(guildId).end != null ? formatTime(playerMarkers.get(guildId).end) : "Not set", inline: true },
                { name: "Loop", value: playerMarkers.get(guildId).loop ? "ON" : "OFF", inline: true },
              )
              .setFooter({ text: "Use /music play to start with markers" }),
          ],
        });
        break;
      }

      // ── PLAYER-END (END MARKER) ───────────────

      case "player-end": {
        const input = interaction.options.getString("end");
        const endSeconds = parseTime(input);

        if (!playerMarkers.has(guildId)) {
          playerMarkers.set(guildId, {});
        }
        playerMarkers.get(guildId).end = endSeconds;

        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor("#e74c3c")
              .setTitle("⏹️ Player End Marker Set")
              .setDescription(`Playback will stop at **${formatTime(endSeconds)}**`)
              .addFields(
                { name: "Start", value: playerMarkers.get(guildId).start != null ? formatTime(playerMarkers.get(guildId).start) : "Not set", inline: true },
                { name: "End", value: formatTime(endSeconds), inline: true },
                { name: "Loop", value: playerMarkers.get(guildId).loop ? "ON" : "OFF", inline: true },
              )
              .setFooter({ text: "Use /music play to start with markers" }),
          ],
        });
        break;
      }

      // ── PLAYER-LOOP ───────────────────────────

      case "player-loop": {
        if (!playerMarkers.has(guildId)) {
          playerMarkers.set(guildId, {});
        }

        const markers = playerMarkers.get(guildId);
        markers.loop = !markers.loop;

        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(markers.loop ? "#2ecc71" : "#95a5a6")
              .setTitle(markers.loop ? "🔁 Player Loop ON" : "🔁 Player Loop OFF")
              .setDescription(markers.loop
                ? `Looping between **${formatTime(markers.start || 0)}** and **${formatTime(markers.end || 0)}**`
                : "Loop between markers disabled.")
              .addFields(
                { name: "Start", value: markers.start != null ? formatTime(markers.start) : "Not set", inline: true },
                { name: "End", value: markers.end != null ? formatTime(markers.end) : "Not set", inline: true },
                { name: "Loop", value: markers.loop ? "ON" : "OFF", inline: true },
              )
              .setFooter({ text: "ChrxmeeStream v2.0" }),
          ],
        });
        break;
      }

      // ── PLAYER-CLEAR ──────────────────────────

      case "player-clear":
        playerMarkers.delete(guildId);
        await interaction.reply("🧹 Player markers cleared.");
        break;

      // ── LYRICS ────────────────────────────────

      case "lyrics":
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor("#1db954")
              .setTitle("🎤 Lyrics")
              .setDescription("Lyrics feature coming soon to ChrxmeeStream v2.1")
              .setFooter({ text: "ChrxmeeStream v2.0" }),
          ],
        });
        break;

      // ── SAVE ──────────────────────────────────

      case "save":
        try {
          await interaction.user.send({
            embeds: [
              new EmbedBuilder()
                .setColor("#9b59b6")
                .setTitle("💾 Saved Track")
                .setDescription("Current track info sent to your DMs!")
                .setFooter({ text: "ChrxmeeStream v2.0" }),
            ],
          });
          await interaction.reply({ content: "📬 Track info sent to your DMs!", ephemeral: true });
        } catch {
          await interaction.reply({ content: "❌ Couldn't DM you. Check your privacy settings.", ephemeral: true });
        }
        break;

      // ── HISTORY ───────────────────────────────

      case "history":
        sendToChrxmee(guildId, { op: "history", limit: 10 });
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor("#9b59b6")
              .setTitle("🕓 Recently Played")
              .setDescription("History requested. Check console for details.")
              .setFooter({ text: "ChrxmeeStream v2.0" }),
          ],
        });
        break;
    }
  },
};