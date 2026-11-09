// commands/music.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

// Store queues for each server
const queues = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName("music")
    .setDescription("play music via Lavalink")
    .addSubcommand((s) =>
      s.setName("play").setDescription("play a song or playlist")
        .addStringOption((o) => o.setName("query").setDescription("song name or URL").setRequired(true))
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
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const member = interaction.member;
    const client = interaction.client;
    
    await interaction.deferReply();

    // Check if Lavalink is connected
    if (!client.shoukaku) return interaction.editReply("❌ Lavalink is not initialized.");
    const node = client.shoukaku.options.nodeResolver(client.shoukaku.nodes);
    if (!node) return interaction.editReply("❌ No Lavalink nodes available.");

    let player = client.shoukaku.players.get(guildId);
    let queue = queues.get(guildId) || [];

    // ── PLAY ──
    if (sub === "play") {
      const vc = member.voice.channel;
      if (!vc) return interaction.editReply("❌ you must be in a voice channel.");

      const query = interaction.options.getString("query");
      
      // If it's not a URL, search YouTube
      const searchQuery = /^https?:\/\//i.test(query) ? query : `ytsearch:${query}`;

      const result = await node.rest.resolve(searchQuery);
      if (!result || !result.data) return interaction.editReply("❌ no results found.");

      // If no player exists, join the VC
      if (!player) {
        player = await client.shoukaku.joinVoiceChannel({
          guildId: guildId,
          channelId: vc.id,
          shardId: interaction.guild.shardId
        });
      }

      let tracksToAdd = [];
      let embedTitle = "🎵 Added to Queue";

      if (result.loadType === "track") {
        tracksToAdd.push(result.data);
      } else if (result.loadType === "playlist") {
        tracksToAdd = result.data.tracks;
        embedTitle = `🎵 Added Playlist: ${result.data.info.name}`;
      } else if (result.loadType === "search") {
        tracksToAdd.push(result.data[0]);
      } else {
        return interaction.editReply("❌ could not load that track.");
      }

      // Add to queue
      queue.push(...tracksToAdd);
      queues.set(guildId, queue);

      // If nothing is playing, start playing
      if (queue.length === tracksToAdd.length) {
        playNext(player, guildId, interaction.channel);
      }

      const embed = new EmbedBuilder()
        .setColor(0x7c7ce0)
        .setTitle(embedTitle)
        .setDescription(tracksToAdd.length > 1 
          ? `Added **${tracksToAdd.length}** tracks to the queue.` 
          : `[${tracksToAdd[0].info.title}](${tracksToAdd[0].info.uri}) by ${tracksToAdd[0].info.author}`);

      return interaction.editReply({ embeds: [embed] });
    }

    // If no player exists for the rest of the commands, bail out
    if (!player) return interaction.editReply("❌ nothing is playing right now.");

    // ── SKIP ──
    if (sub === "skip") {
      if (queue.length === 0) return interaction.editReply("❌ queue is empty.");
      player.stopTrack(); 
      return interaction.editReply("⏭️ skipped.");
    }

    // ── STOP ──
    if (sub === "stop") {
      queues.delete(guildId);
      await client.shoukaku.leaveVoiceChannel(guildId);
      return interaction.editReply("⏹️ stopped and left the voice channel.");
    }

    // ── QUEUE ──
    if (sub === "queue") {
      if (queue.length === 0) return interaction.editReply("📭 queue is empty.");
      
      const list = queue.slice(0, 10).map((t, i) => `**${i + 1}.** [${t.info.title}](${t.info.uri})`).join("\n");
      const embed = new EmbedBuilder()
        .setColor(0x7c7ce0)
        .setTitle("🎶 Current Queue")
        .setDescription(list + (queue.length > 10 ? `\n\n*...and ${queue.length - 10} more*` : ""));
      
      return interaction.editReply({ embeds: [embed] });
    }

    // ── NOW PLAYING ──
    if (sub === "nowplaying") {
      const current = queue[0];
      if (!current) return interaction.editReply("❌ nothing is playing.");

      const embed = new EmbedBuilder()
        .setColor(0x7c7ce0)
        .setTitle("🎧 Now Playing")
        .setDescription(`[${current.info.title}](${current.info.uri})\nby **${current.info.author}**`)
        .addFields({ name: "Length", value: formatTime(current.info.length), inline: true })
        .setThumbnail(current.info.artworkUrl || null);
      
      return interaction.editReply({ embeds: [embed] });
    }

    // ── PAUSE / RESUME ──
    if (sub === "pause") {
      player.setPaused(true);
      return interaction.editReply("⏸️ paused.");
    }

    if (sub === "resume") {
      player.setPaused(false);
      return interaction.editReply("▶️ resumed.");
    }

    // ── VOLUME ──
    if (sub === "volume") {
      const vol = interaction.options.getInteger("percent");
      player.setGlobalVolume(vol * 10); // Shoukaku uses 1-1000, command uses 1-100
      return interaction.editReply(`🔊 volume set to **${vol}%**.`);
    }

    // ── LEAVE ──
    if (sub === "leave") {
      queues.delete(guildId);
      await client.shoukaku.leaveVoiceChannel(guildId);
      return interaction.editReply("👋 left the voice channel.");
    }
  }
};

// ── HELPER: Play Next Track ──
async function playNext(player, guildId, textChannel) {
  const queue = queues.get(guildId);
  if (!queue || queue.length === 0) {
    if (player) {
      // Auto-disconnect when queue ends
      // client.shoukaku.leaveVoiceChannel(guildId);
    }
    return;
  }

  const track = queue[0];

  // Setup event listeners (only once per player)
  if (!player._hasListeners) {
    player._hasListeners = true;

    player.on('end', (data) => {
      if (data.reason === 'FINISHED') {
        queue.shift(); // Remove finished song
        playNext(player, guildId, textChannel);
      } else if (data.reason === 'REPLACED') {
        // Song was skipped, the command handles the next song
      } else if (data.reason === 'STOPPED') {
        // Queue was cleared
      }
    });

    player.on('exception', (data) => {
      console.error(`[Lavalink] Track Exception:`, data.exception);
      textChannel.send(`❌ failed to play track: ${data.exception.message}`).catch(()=>{});
      queue.shift();
      playNext(player, guildId, textChannel);
    });

    player.on('stuck', () => {
      console.log(`[Lavalink] Track stuck, skipping...`);
      player.stopTrack();
    });
  }

  try {
    await player.playTrack({ track: track.encoded });
    textChannel.send(`🎵 now playing: **[${track.info.title}](${track.info.uri})**`).catch(()=>{});
  } catch (err) {
    console.error("[Lavalink] Play Error:", err);
    queue.shift();
    playNext(player, guildId, textChannel);
  }
}

// Format milliseconds to mm:ss
function formatTime(ms) {
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor(ms / (1000 * 60 * 60));
  
  if (hours > 0) return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
