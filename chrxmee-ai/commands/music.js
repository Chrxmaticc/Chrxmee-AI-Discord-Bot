const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { scheduleMarkers, stopEndMarkerWatcher, parseTime, formatTime } = require("../songMarkers");

// ==================== HELPERS ====================
async function ensureVC(interaction, client) {
  const gid = interaction.guildId;
  const vc = interaction.member?.voice?.channel;
  if (!vc) return null;

  let conn = client.voiceConnections?.get(gid);
  if (conn?.state?.status === "ready") return conn;

  const { joinVoiceChannel, createAudioPlayer, createAudioResource, StreamType, VoiceConnectionStatus, entersState } = require("@discordjs/voice");
  const { PassThrough } = require("stream");

  conn = joinVoiceChannel({ channelId: vc.id, guildId: gid, adapterCreator: interaction.guild.voiceAdapterCreator });
  try { await entersState(conn, VoiceConnectionStatus.Ready, 10000); } catch {
    try { conn.destroy(); } catch {}; return null;
  }

  if (!client.voiceConnections) client.voiceConnections = new Map();
  if (!client.audioStreams) client.audioStreams = new Map();
  if (!client.audioPlayers) client.audioPlayers = new Map();
  client.voiceConnections.set(gid, conn);

  const stream = new PassThrough();
  client.audioStreams.set(gid, stream);
  const player = createAudioPlayer();
  player.play(createAudioResource(stream, { inputType: StreamType.Raw }));
  conn.subscribe(player);
  client.audioPlayers.set(gid, player);

  conn.on(VoiceConnectionStatus.Disconnected, async () => {
    try { await Promise.race([entersState(conn, VoiceConnectionStatus.Signalling, 5000), entersState(conn, VoiceConnectionStatus.Connecting, 5000)]); } catch {
      try { conn.destroy(); } catch {}
      client.voiceConnections?.delete(gid); client.audioStreams?.delete(gid); client.audioPlayers?.delete(gid);
      global.sendToChrxmee?.(gid, { op: "destroy" });
    }
  });
  return conn;
}

function sendOp(gid, op) { global.sendToChrxmee?.(gid, op); }

// ==================== COMMAND ====================
module.exports = {
  data: new SlashCommandBuilder()
    .setName("music")
    .setDescription("Music controls powered by ChrxmeeStream v2.0")
    .addSubcommand(s => s.setName("play").setDescription("Play a song").addStringOption(o => o.setName("source").setDescription("URL, search, or WRITE(file.mp3)").setRequired(true)))
    .addSubcommand(s => s.setName("stop").setDescription("Stop playback"))
    .addSubcommand(s => s.setName("pause").setDescription("Pause"))
    .addSubcommand(s => s.setName("resume").setDescription("Resume"))
    .addSubcommand(s => s.setName("skip").setDescription("Skip current track"))
    .addSubcommand(s => s.setName("volume").setDescription("Set volume (0-200)").addIntegerOption(o => o.setName("value").setDescription("0-200").setRequired(true).setMinValue(0).setMaxValue(200)))
    .addSubcommand(s => s.setName("seek").setDescription("Jump to position").addStringOption(o => o.setName("position").setDescription("e.g. 1:30 or 90").setRequired(true)))
    .addSubcommand(s => s.setName("filter").setDescription("Apply audio filter").addStringOption(o => o.setName("name").setDescription("Filter name").setRequired(false)))
    .addSubcommand(s => s.setName("filters").setDescription("List all filters"))
    .addSubcommand(s => s.setName("loop").setDescription("Set loop mode").addStringOption(o => o.setName("mode").setDescription("Loop mode").setRequired(true).addChoices({ name: "Off", value: "off" }, { name: "Track", value: "track" }, { name: "Queue", value: "queue" })))
    .addSubcommand(s => s.setName("shuffle").setDescription("Shuffle queue"))
    .addSubcommand(s => s.setName("queue").setDescription("View queue"))
    .addSubcommand(s => s.setName("clearqueue").setDescription("Clear queue"))
    .addSubcommand(s => s.setName("remove").setDescription("Remove track from queue").addIntegerOption(o => o.setName("position").setDescription("Position (1-based)").setRequired(true).setMinValue(1)))
    .addSubcommand(s => s.setName("autoplay").setDescription("Toggle Auto DJ").addBooleanOption(o => o.setName("enabled").setDescription("On/Off").setRequired(true)))
    .addSubcommand(s => s.setName("nowplaying").setDescription("Now playing"))
    .addSubcommand(s => s.setName("leave").setDescription("Leave voice channel"))
    .addSubcommand(s => s.setName("player-set").setDescription("Set start marker").addStringOption(o => o.setName("start").setDescription("Start time (e.g. 1:30)").setRequired(true)))
    .addSubcommand(s => s.setName("player-end").setDescription("Set end marker").addStringOption(o => o.setName("end").setDescription("End time (e.g. 2:30)").setRequired(true)))
    .addSubcommand(s => s.setName("player-loop").setDescription("Toggle loop between markers"))
    .addSubcommand(s => s.setName("player-clear").setDescription("Clear all markers"))
    .addSubcommand(s => s.setName("lyrics").setDescription("Get lyrics"))
    .addSubcommand(s => s.setName("save").setDescription("DM yourself the track"))
    .addSubcommand(s => s.setName("history").setDescription("Recently played")),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const gid = interaction.guildId;

    // Defer everything upfront
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply().catch(() => {});
    }

    if (!client.playerMarkers) client.playerMarkers = new Map();
    const pm = client.playerMarkers;

    switch (sub) {

      case "play": {
        const src = interaction.options.getString("source");
        const conn = await ensureVC(interaction, client);
        if (!conn) {
          await interaction.editReply({ content: "❌ Could not connect to voice channel." }).catch(() => {});
          return;
        }
        stopEndMarkerWatcher(gid);
        sendOp(gid, { op: "play", source: src });

        const m = pm.get(gid);
        if (m?.start != null || m?.end != null) {
          scheduleMarkers(gid, m, src);
          await interaction.editReply({ embeds: [new EmbedBuilder().setColor("#e67e22").setTitle("▶️ Playing (Markers Active)").setDescription(`\`${src}\``).addFields({ name: "⏩ Start", value: formatTime(m.start || 0), inline: true }, { name: "⏹️ End", value: m.end ? formatTime(m.end) : "None", inline: true }, { name: "🔁 Loop", value: m.loop ? "ON" : "OFF", inline: true }).setFooter({ text: "ChrxmeeStream v2.0" })] }).catch(() => {});
        } else {
          await interaction.editReply({ embeds: [new EmbedBuilder().setColor("#9b59b6").setTitle("▶️ Now Playing").setDescription(`\`${src}\``).setFooter({ text: "ChrxmeeStream v2.0" })] }).catch(() => {});
        }
        break;
      }

      case "stop": sendOp(gid, { op: "stop" }); stopEndMarkerWatcher(gid); await interaction.editReply("⏹️ Stopped.").catch(() => {}); break;
      case "pause": sendOp(gid, { op: "pause" }); await interaction.editReply("⏸️ Paused.").catch(() => {}); break;
      case "resume": sendOp(gid, { op: "resume" }); await interaction.editReply("▶️ Resumed.").catch(() => {}); break;
      case "skip": sendOp(gid, { op: "stop" }); stopEndMarkerWatcher(gid); await interaction.editReply("⏭️ Skipped.").catch(() => {}); break;

      case "volume": {
        const v = interaction.options.getInteger("value");
        sendOp(gid, { op: "volume", value: v });
        await interaction.editReply(`🔊 Volume: **${v}**`).catch(() => {});
        break;
      }

      case "seek": {
        const sec = parseTime(interaction.options.getString("position"));
        if (sec == null) { await interaction.editReply("❌ Invalid time format.").catch(() => {}); return; }
        sendOp(gid, { op: "seek", value: sec });
        await interaction.editReply(`⏩ Seeked to **${formatTime(sec)}**`).catch(() => {});
        break;
      }

      case "filter": {
        const name = interaction.options.getString("name");
        sendOp(gid, { op: "filter", filters: name ? [name] : [] });
        await interaction.editReply(name ? `🎛️ Filter **${name}** applied.` : "🎛️ Filters cleared.").catch(() => {});
        break;
      }

      case "filters": {
        const list = ["bassboost","nightcore","vaporwave","slowed","echo","reverb","normalize","earrape","karaoke","mono","treble","soft","underwater","telephone","chipmunk","deep","robot"];
        await interaction.editReply({ embeds: [new EmbedBuilder().setColor("#1db954").setTitle("🎛️ Filters").setDescription(list.map(f => `\`${f}\``).join("  "))] }).catch(() => {});
        break;
      }

      case "loop": {
        const mode = interaction.options.getString("mode");
        sendOp(gid, { op: "queue_loop", value: mode });
        await interaction.editReply(`🔁 Loop: **${mode}**`).catch(() => {});
        break;
      }

      case "shuffle": sendOp(gid, { op: "queue_shuffle" }); await interaction.editReply("🔀 Shuffled.").catch(() => {}); break;
      case "queue": sendOp(gid, { op: "queue_list" }); await interaction.editReply({ embeds: [new EmbedBuilder().setColor("#9b59b6").setTitle("📋 Queue").setDescription("Use `/music queue` to refresh.")] }).catch(() => {}); break;
      case "clearqueue": sendOp(gid, { op: "queue_clear" }); await interaction.editReply("🗑️ Queue cleared.").catch(() => {}); break;

      case "remove": {
        const pos = interaction.options.getInteger("position") - 1;
        sendOp(gid, { op: "queue_remove", position: pos });
        await interaction.editReply(`🗑️ Removed position **${pos + 1}**.`).catch(() => {});
        break;
      }

      case "autoplay": {
        const on = interaction.options.getBoolean("enabled");
        sendOp(gid, { op: on ? "autodj_enable" : "autodj_disable" });
        await interaction.editReply(`🤖 Auto DJ **${on ? "ON" : "OFF"}**`).catch(() => {});
        break;
      }

      case "nowplaying":
        await interaction.editReply({ embeds: [new EmbedBuilder().setColor("#9b59b6").setTitle("🎵 Now Playing").setDescription("Check `/music queue` for details.").setFooter({ text: "ChrxmeeStream v2.0" })] }).catch(() => {});
        break;

      case "leave": {
        const c = client.voiceConnections?.get(gid);
        if (c) { try { c.destroy(); } catch {}; client.voiceConnections?.delete(gid); client.audioStreams?.delete(gid); client.audioPlayers?.delete(gid); }
        sendOp(gid, { op: "destroy" }); stopEndMarkerWatcher(gid);
        await interaction.editReply("👋 Left.").catch(() => {});
        break;
      }

      case "player-set": {
        const sec = parseTime(interaction.options.getString("start"));
        if (sec == null) { await interaction.editReply("❌ Invalid time.").catch(() => {}); return; }
        if (!pm.has(gid)) pm.set(gid, {});
        pm.get(gid).start = sec;
        await interaction.editReply({ embeds: [new EmbedBuilder().setColor("#e67e22").setTitle("⏩ Start Marker").setDescription(`Starts at **${formatTime(sec)}**`)] }).catch(() => {});
        break;
      }

      case "player-end": {
        const sec = parseTime(interaction.options.getString("end"));
        if (sec == null) { await interaction.editReply("❌ Invalid time.").catch(() => {}); return; }
        if (!pm.has(gid)) pm.set(gid, {});
        pm.get(gid).end = sec;
        await interaction.editReply({ embeds: [new EmbedBuilder().setColor("#e74c3c").setTitle("⏹️ End Marker").setDescription(`Ends at **${formatTime(sec)}**`)] }).catch(() => {});
        break;
      }

      case "player-loop": {
        if (!pm.has(gid)) pm.set(gid, {});
        pm.get(gid).loop = !pm.get(gid).loop;
        await interaction.editReply(`🔁 Marker loop **${pm.get(gid).loop ? "ON" : "OFF"}**`).catch(() => {});
        break;
      }

      case "player-clear": pm.delete(gid); stopEndMarkerWatcher(gid); await interaction.editReply("🧹 Markers cleared.").catch(() => {}); break;

      case "lyrics": await interaction.editReply({ embeds: [new EmbedBuilder().setColor("#1db954").setTitle("🎤 Lyrics").setDescription("Coming in v2.1").setFooter({ text: "ChrxmeeStream v2.0" })] }).catch(() => {}); break;

      case "save": {
        try {
          await interaction.user.send({ embeds: [new EmbedBuilder().setColor("#9b59b6").setTitle("💾 Track Saved").setDescription("Track info sent!").setFooter({ text: "ChrxmeeStream v2.0" })] });
          await interaction.editReply("📬 Sent to DMs!").catch(() => {});
        } catch { await interaction.editReply("❌ Enable DMs.").catch(() => {}); }
        break;
      }

      case "history": sendOp(gid, { op: "history", limit: 10 }); await interaction.editReply({ embeds: [new EmbedBuilder().setColor("#9b59b6").setTitle("🕓 History").setDescription("Recently played tracks.")] }).catch(() => {}); break;
    }
  },
};
