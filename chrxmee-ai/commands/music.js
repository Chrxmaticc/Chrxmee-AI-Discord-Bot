// commands/music.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

const queues = new Map();
const markers = new Map();
const endWatchers = new Map();

// ── KEEP-ALIVE ──
setInterval(async () => {
  try {
    const client = require("../index.js"); 
    if (client.shoukaku) {
      const node = client.shoukaku.options.nodeResolver(client.shoukaku.nodes);
      if (node) await fetch(`https://${node.url}/version`).catch(() => {});
    }
  } catch (e) {}
}, 10 * 60 * 1000);

// ── HELPERS ──
function parseTime(str) {
  if (!str) return null;
  const parts = str.split(":").map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 2) return (parts[0] * 60 + parts[1]) * 1000; 
  if (parts.length === 3) return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000; 
  if (parts.length === 1) return parts[0] * 1000; 
  return null;
}

function formatTime(ms) {
  if (!ms) return "0:00";
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor(ms / (1000 * 60 * 60));
  if (hours > 0) return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

async function wakeLavalink(node) {
  try {
    const res = await fetch(`https://${node.url}/version`, {
      headers: { Authorization: node.auth }
    });
    return res.ok;
  } catch (err) {
    return false;
  }
}

// ── COMMAND ──
module.exports = {
  data: new SlashCommandBuilder()
    .setName("music")
    .setDescription("play music via Lavalink")
    .addSubcommand((s) => s.setName("join").setDescription("make the bot join your voice channel"))
    .addSubcommand((s) =>
      s.setName("play").setDescription("play a song or playlist")
        .addStringOption((o) => o.setName("query").setDescription("song name or URL").setRequired(true))
        .addStringOption((o) => o.setName("provider").setDescription("where to search (ignored if URL is provided)").setRequired(false)
          .addChoices(
            { name: "YouTube", value: "ytsearch" },
            { name: "YouTube Music", value: "ytmsearch" },
            { name: "SoundCloud", value: "scsearch" }
          ))
    )
    .addSubcommand((s) => s.setName("skip").setDescription("skip the current song"))
    .addSubcommand((s) => s.setName("stop").setDescription("stop music and clear the queue"))
    .addSubcommand((s) => s.setName("queue").setDescription("view the current queue"))
    .addSubcommand((s) => s.setName("nowplaying").setDescription("see what's currently playing"))
    .addSubcommand((s) => s.setName("pause").setDescription("pause the current song"))
    .addSubcommand((s) => s.setName("resume").setDescription("resume the current song"))
    .addSubcommand((s) => s.setName("leave").setDescription("make the bot leave the voice channel"))
    .addSubcommand((s) => 
      s.setName("volume").setDescription("change the volume")
        .addIntegerOption((o) => o.setName("percent").setDescription("1-100").setRequired(true).setMinValue(1).setMaxValue(100))
    )
    .addSubcommand((s) => 
      s.setName("filter").setDescription("apply an audio filter")
        .addStringOption((o) => o.setName("type").setDescription("the filter to apply").setRequired(true)
          .addChoices(
            { name: "Bassboost", value: "bassboost" },
            { name: "Nightcore", value: "nightcore" },
            { name: "Vaporwave", value: "vaporwave" },
            { name: "8D Audio", value: "8d" },
            { name: "Karaoke", value: "karaoke" },
            { name: "Tremolo", value: "tremolo" },
            { name: "Vibrato", value: "vibrato" },
            { name: "Reset", value: "reset" }
          ))
    )
    .addSubcommand((s) => 
      s.setName("player-set").setDescription("set the start marker (jump to time)")
        .addStringOption((o) => o.setName("time").setDescription("e.g. 1:30").setRequired(true))
    )
    .addSubcommand((s) => 
      s.setName("player-end").setDescription("set the end marker (stop at time)")
        .addStringOption((o) => o.setName("time").setDescription("e.g. 2:45").setRequired(true))
    )
    .addSubcommand((s) => s.setName("player-loop").setDescription("toggle looping between markers"))
    .addSubcommand((s) => s.setName("player-clear").setDescription("clear all markers")),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const member = interaction.member;
    const client = interaction.client;
    
    await interaction.deferReply();

    if (!client.shoukaku) return interaction.editReply("❌ Lavalink is not initialized.");
    const node = client.shoukaku.options.nodeResolver(client.shoukaku.nodes);
    if (!node) return interaction.editReply("❌ No Lavalink nodes available. Check Render logs.");

    let player = client.shoukaku.players.get(guildId);
    let queue = queues.get(guildId) || [];
    let gm = markers.get(guildId) || { start: null, end: null, loop: false };

    // ── JOIN ──
    if (sub === "join") {
      const vc = member.voice.channel;
      if (!vc) return interaction.editReply("❌ you must be in a voice channel.");
      if (player) return interaction.editReply("❌ i'm already in a voice channel.");

      try {
        player = await client.shoukaku.joinVoiceChannel({
          guildId: guildId,
          channelId: vc.id,
          shardId: interaction.guild.shardId
        });
        return interaction.editReply(`🔊 joined **${vc.name}**. use \`/music play\` to queue a song.`);
      } catch (err) {
        return interaction.editReply(`❌ failed to join: ${err.message}`);
      }
    }

    // ── PLAY ──
    if (sub === "play") {
      const vc = member.voice.channel;
      if (!vc) return interaction.editReply("❌ you must be in a voice channel.");

      const query = interaction.options.getString("query");
      const provider = interaction.options.getString("provider") || "ytsearch";
      
      // Wake up Lavalink if Render put it to sleep
      await interaction.editReply("⏳ *waking up music server...*");
      let isAwake = false;
      for (let i = 0; i < 12; i++) { 
        if (await wakeLavalink(node)) { isAwake = true; break; }
        await new Promise(r => setTimeout(r, 5000)); 
      }
      if (!isAwake) return interaction.editReply("❌ Music server failed to wake up. Try again in a minute.");

      // If it's a URL, ignore provider. If not, use the selected provider.
      const searchQuery = /^https?:\/\//i.test(query) ? query : `${provider}:${query}`;

      const result = await node.rest.resolve(searchQuery);
      if (!result || !result.data) return interaction.editReply("❌ no results found.");

      if (!player) {
        player = await client.shoukaku.joinVoiceChannel({
          guildId: guildId,
          channelId: vc.id,
          shardId: interaction.guild.shardId
        });
      }

      let tracksToAdd = [];
      if (result.loadType === "track") tracksToAdd.push(result.data);
      else if (result.loadType === "playlist") tracksToAdd = result.data.tracks;
      else if (result.loadType === "search") tracksToAdd.push(result.data[0]);
      else return interaction.editReply("❌ could not load that track. (If SoundCloud, try a full URL, not a shortlink).");

      queue.push(...tracksToAdd);
      queues.set(guildId, queue);

      if (queue.length === tracksToAdd.length) {
        playNext(player, guildId, interaction.channel);
      }

      const embed = new EmbedBuilder()
        .setColor(0x7c7ce0)
        .setTitle("🎵 Added to Queue")
        .setDescription(`[${tracksToAdd[0].info.title}](${tracksToAdd[0].info.uri}) by ${tracksToAdd[0].info.author}`);

      return interaction.editReply({ embeds: [embed] });
    }

    // ── PLAYER MARKERS ──
    if (sub === "player-set") {
      const timeStr = interaction.options.getString("time");
      const ms = parseTime(timeStr);
      if (ms === null) return interaction.editReply("❌ invalid time format (use 1:30).");

      gm.start = ms;
      markers.set(guildId, gm);

      if (player && player.track) {
        await player.seekTo(ms);
      }
      return interaction.editReply(`⏩ start marker set to **${formatTime(ms)}**.`);
    }

    if (sub === "player-end") {
      const timeStr = interaction.options.getString("time");
      const ms = parseTime(timeStr);
      if (ms === null) return interaction.editReply("❌ invalid time format (use 1:30).");

      gm.end = ms;
      markers.set(guildId, gm);

      if (player && player.track) {
        startEndWatcher(player, guildId, interaction.channel);
      }
      return interaction.editReply(`⏹️ end marker set to **${formatTime(ms)}**.`);
    }

    if (sub === "player-loop") {
      gm.loop = !gm.loop;
      markers.set(guildId, gm);
      return interaction.editReply(`🔁 marker loop is now **${gm.loop ? "ON" : "OFF"}**.`);
    }

    if (sub === "player-clear") {
      markers.delete(guildId);
      clearEndWatcher(guildId);
      return interaction.editReply("🧹 markers cleared.");
    }

    // Rest of commands require an active player
    if (!player) return interaction.editReply("❌ i'm not in a voice channel. use `/music join` or `/music play` first.");

    // ── FILTERS ──
    if (sub === "filter") {
      const filterType = interaction.options.getString("type");
      let filters = {};
      let filterName = "";

      if (filterType === "bassboost") {
        filters = { equalizer: [{ band: 0, gain: 0.25 }, { band: 1, gain: 0.2 }, { band: 2, gain: 0.15 }]};
        filterName = "**Bassboost**";
      } else if (filterType === "nightcore") {
        filters = { timescale: { speed: 1.2, pitch: 1.2, rate: 1.0 }};
        filterName = "**Nightcore**";
      } else if (filterType === "vaporwave") {
        filters = { timescale: { speed: 0.8, pitch: 0.8, rate: 1.0 }};
        filterName = "**Vaporwave**";
      } else if (filterType === "8d") {
        filters = { rotation: { rotationHz: 0.2 }};
        filterName = "**8D Audio**";
      } else if (filterType === "karaoke") {
        filters = { karaoke: { level: 1.0, monoLevel: 1.0, filterBand: 220.0, filterWidth: 100.0 }};
        filterName = "**Karaoke**";
      } else if (filterType === "tremolo") {
        filters = { tremolo: { frequency: 4.0, depth: 0.75 }};
        filterName = "**Tremolo**";
      } else if (filterType === "vibrato") {
        filters = { vibrato: { frequency: 4.0, depth: 0.75 }};
        filterName = "**Vibrato**";
      } else if (filterType === "reset") {
        filters = {};
        filterName = "**All Filters Removed**";
      }

      await player.setFilters(filters);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x7c7ce0).setDescription(`🎛️ Applied: ${filterName}`)] });
    }

    // ── BASIC CONTROLS ──
    if (sub === "skip") {
      if (queue.length === 0) return interaction.editReply("❌ queue is empty.");
      player.stopTrack(); 
      return interaction.editReply("⏭️ skipped.");
    }

    if (sub === "stop") {
      queues.delete(guildId);
      markers.delete(guildId);
      clearEndWatcher(guildId);
      await client.shoukaku.leaveVoiceChannel(guildId);
      return interaction.editReply("⏹️ stopped and left the voice channel.");
    }

    if (sub === "queue") {
      if (queue.length === 0) return interaction.editReply("📭 queue is empty.");
      const list = queue.slice(0, 10).map((t, i) => `**${i + 1}.** [${t.info.title}](${t.info.uri})`).join("\n");
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x7c7ce0).setTitle("🎶 Current Queue").setDescription(list)] });
    }

    if (sub === "nowplaying") {
      const current = queue[0];
      if (!current) return interaction.editReply("❌ nothing is playing.");
      return interaction.editReply({ embeds: [
        new EmbedBuilder().setColor(0x7c7ce0).setTitle("🎧 Now Playing")
          .setDescription(`[${current.info.title}](${current.info.uri})\nby **${current.info.author}**`)
          .addFields({ name: "Length", value: formatTime(current.info.length), inline: true })
      ]});
    }

    if (sub === "pause") {
      player.setPaused(true);
      return interaction.editReply("⏸️ paused.");
    }

    if (sub === "resume") {
      player.setPaused(false);
      return interaction.editReply("▶️ resumed.");
    }

    if (sub === "volume") {
      const vol = interaction.options.getInteger("percent");
      player.setGlobalVolume(vol * 10);
      return interaction.editReply(`🔊 volume set to **${vol}%**.`);
    }

    if (sub === "leave") {
      queues.delete(guildId);
      markers.delete(guildId);
      clearEndWatcher(guildId);
      await client.shoukaku.leaveVoiceChannel(guildId);
      return interaction.editReply("👋 left the voice channel.");
    }
  }
};

// ── HELPERS: Playback & Markers ──
function clearEndWatcher(guildId) {
  if (endWatchers.has(guildId)) {
    clearInterval(endWatchers.get(guildId));
    endWatchers.delete(guildId);
  }
}

function startEndWatcher(player, guildId, textChannel) {
  clearEndWatcher(guildId); 
  const gm = markers.get(guildId);
  if (!gm || !gm.end) return;

  const interval = setInterval(async () => {
    if (!player || !player.track) return clearEndWatcher(guildId);
    if (player.paused) return;

    if (player.position >= gm.end - 1500) {
      clearEndWatcher(guildId);
      if (gm.loop && gm.start !== null) {
        await player.seekTo(gm.start);
        startEndWatcher(player, guildId, textChannel); 
      } else {
        player.stopTrack(); 
      }
    }
  }, 1000);

  endWatchers.set(guildId, interval);
}

async function playNext(player, guildId, textChannel) {
  const queue = queues.get(guildId);
  if (!queue || queue.length === 0) return;

  const track = queue[0];
  const gm = markers.get(guildId);

  if (!player._hasListeners) {
    player._hasListeners = true;

    player.on('end', (data) => {
      if (data.reason === 'FINISHED') {
        queue.shift();
        playNext(player, guildId, textChannel);
      }
    });

    player.on('exception', (data) => {
      textChannel.send(`❌ failed to play track: ${data.exception.message}`).catch(()=>{});
      queue.shift();
      playNext(player, guildId, textChannel);
    });
  }

  try {
    await player.playTrack({ track: { encoded: track.encoded } });
    
    if (gm && gm.start !== null) {
      await player.seekTo(gm.start);
    }
    if (gm && gm.end !== null) {
      startEndWatcher(player, guildId, textChannel);
    }

    textChannel.send(`🎵 now playing: **[${track.info.title}](${track.info.uri})**`).catch(()=>{});
  } catch (err) {
    console.error("[Lavalink] Play Error:", err);
    queue.shift();
    playNext(player, guildId, textChannel);
  }
}
