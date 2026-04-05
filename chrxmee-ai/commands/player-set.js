/**
 * commands/music/player-set.js
 * /player-set start <time> [song]
 * /player-set end   <time> [song]
 * /player-set clear <start|end|both> [song]
 */

const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const {
  parseTime,
  formatTime,
  setMarker,
  getMarkers,
  clearMarker,
  startEndMarkerWatcher,
  stopEndMarkerWatcher,
  applyStartMarker,
} = require("../../utils/songMarkers");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("player-set")
    .setDescription("Set start/end markers on a song for instant seeking.")

    // ── /player-set start ──────────────────────────────────────────────────
    .addSubcommand((sub) =>
      sub
        .setName("start")
        .setDescription("Set the timestamp a song will seek to when it begins playing.")
        .addStringOption((opt) =>
          opt
            .setName("time")
            .setDescription('Timestamp to jump to when the song starts (e.g. "1:43")')
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName("song")
            .setDescription("Song title to target (leave blank for the current song)")
            .setRequired(false)
        )
    )

    // ── /player-set end ────────────────────────────────────────────────────
    .addSubcommand((sub) =>
      sub
        .setName("end")
        .setDescription("Set the timestamp a song will stop (or loop back) at.")
        .addStringOption((opt) =>
          opt
            .setName("time")
            .setDescription('Timestamp to cut off at (e.g. "2:44")')
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName("song")
            .setDescription("Song title to target (leave blank for the current song)")
            .setRequired(false)
        )
        .addBooleanOption((opt) =>
          opt
            .setName("loop")
            .setDescription("Loop back to the start marker instead of stopping? (default: false)")
            .setRequired(false)
        )
    )

    // ── /player-set clear ──────────────────────────────────────────────────
    .addSubcommand((sub) =>
      sub
        .setName("clear")
        .setDescription("Remove a start/end marker from a song.")
        .addStringOption((opt) =>
          opt
            .setName("type")
            .setDescription("Which marker to clear")
            .setRequired(true)
            .addChoices(
              { name: "Start", value: "start" },
              { name: "End", value: "end" },
              { name: "Both", value: "both" }
            )
        )
        .addStringOption((opt) =>
          opt
            .setName("song")
            .setDescription("Song title to target (leave blank for the current song)")
            .setRequired(false)
        )
    ),

  // ── execute ──────────────────────────────────────────────────────────────
  async execute(interaction) {
    const { client, guild, member } = interaction;

    // ── Voice & player checks ─────────────────────────────────────────────
    if (!member.voice?.channel) {
      return interaction.reply({
        content: "❌ You need to be in a voice channel to use this.",
        ephemeral: true,
      });
    }

    const player = client.lavalink.getPlayer(guild.id);

    if (!player || !player.queue?.current) {
      return interaction.reply({
        content: "❌ Nothing is currently playing.",
        ephemeral: true,
      });
    }

    // ── Resolve target track ──────────────────────────────────────────────
    const songQuery = interaction.options.getString("song");
    let targetTrack = null;

    if (songQuery) {
      // Search through queue for a matching title
      const allTracks = [
        player.queue.current,
        ...(player.queue.tracks || []),
      ];
      targetTrack = allTracks.find((t) =>
        (t.info?.title || t.title || "")
          .toLowerCase()
          .includes(songQuery.toLowerCase())
      );

      if (!targetTrack) {
        return interaction.reply({
          content: `❌ Couldn't find **"${songQuery}"** in the current queue.`,
          ephemeral: true,
        });
      }
    } else {
      targetTrack = player.queue.current;
    }

    const trackTitle = targetTrack.info?.title || targetTrack.title || "Unknown Track";
    const isCurrent = targetTrack === player.queue.current;
    const sub = interaction.options.getSubcommand();

    // ── Subcommand: start ─────────────────────────────────────────────────
    if (sub === "start") {
      const timeStr = interaction.options.getString("time");
      const ms = parseTime(timeStr);

      if (ms === null) {
        return interaction.reply({
          content: `❌ Invalid time format. Use \`mm:ss\` or \`hh:mm:ss\` (e.g. \`1:43\`).`,
          ephemeral: true,
        });
      }

      // Validate against track duration
      const duration = targetTrack.info?.duration || targetTrack.duration;
      if (duration && ms >= duration) {
        return interaction.reply({
          content: `❌ Start time \`${timeStr}\` exceeds the track duration.`,
          ephemeral: true,
        });
      }

      // Validate against existing end marker
      const existing = getMarkers(targetTrack);
      if (existing?.end && ms >= existing.end) {
        return interaction.reply({
          content: `❌ Start time \`${formatTime(ms)}\` must be before the existing end marker (\`${formatTime(existing.end)}\`).`,
          ephemeral: true,
        });
      }

      setMarker(targetTrack, "start", ms);

      // If this is the current song, seek immediately
      if (isCurrent) {
        await interaction.deferReply();
        await new Promise((res) => setTimeout(res, 200));
        player.seek(ms);

        return interaction.editReply({
          embeds: [
            buildEmbed(
              "▶️ Start Marker Set",
              `**${trackTitle}** will now jump to \`${formatTime(ms)}\` when it plays.\nSeeked the current playback immediately.`,
              0x5865f2
            ),
          ],
        });
      }

      return interaction.reply({
        embeds: [
          buildEmbed(
            "▶️ Start Marker Set",
            `**${trackTitle}** will jump to \`${formatTime(ms)}\` when it starts playing.`,
            0x5865f2
          ),
        ],
      });
    }

    // ── Subcommand: end ───────────────────────────────────────────────────
    if (sub === "end") {
      const timeStr = interaction.options.getString("time");
      const loop = interaction.options.getBoolean("loop") ?? false;
      const ms = parseTime(timeStr);

      if (ms === null) {
        return interaction.reply({
          content: `❌ Invalid time format. Use \`mm:ss\` or \`hh:mm:ss\` (e.g. \`2:44\`).`,
          ephemeral: true,
        });
      }

      const duration = targetTrack.info?.duration || targetTrack.duration;
      if (duration && ms > duration) {
        return interaction.reply({
          content: `❌ End time \`${timeStr}\` exceeds the track duration.`,
          ephemeral: true,
        });
      }

      // Validate against existing start marker
      const existing = getMarkers(targetTrack);
      if (existing?.start && ms <= existing.start) {
        return interaction.reply({
          content: `❌ End time \`${formatTime(ms)}\` must be after the existing start marker (\`${formatTime(existing.start)}\`).`,
          ephemeral: true,
        });
      }

      setMarker(targetTrack, "end", ms);

      // If this is the current song, start the watcher now
      if (isCurrent) {
        startEndMarkerWatcher(player, targetTrack, loop);
      }

      const loopNote = loop ? " It will then loop back to the start marker." : " It will stop there.";

      return interaction.reply({
        embeds: [
          buildEmbed(
            "⏹️ End Marker Set",
            `**${trackTitle}** will cut off at \`${formatTime(ms)}\`.${loopNote}`,
            0xed4245
          ),
        ],
      });
    }

    // ── Subcommand: clear ─────────────────────────────────────────────────
    if (sub === "clear") {
      const type = interaction.options.getString("type");

      if (type === "both") {
        clearMarker(targetTrack, "start");
        clearMarker(targetTrack, "end");
      } else {
        clearMarker(targetTrack, type);
      }

      // Stop any active end-watcher if clearing the end marker on the current song
      if (isCurrent && (type === "end" || type === "both")) {
        stopEndMarkerWatcher(guild.id);
      }

      return interaction.reply({
        embeds: [
          buildEmbed(
            "🗑️ Marker Cleared",
            `Removed the **${type}** marker${type === "both" ? "s" : ""} from **${trackTitle}**.`,
            0xfee75c
          ),
        ],
      });
    }
  },
};

// ── Helper ──────────────────────────────────────────────────────────────────
function buildEmbed(title, description, color) {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setTimestamp();
}
