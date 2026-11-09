// commands/voice.js
process.env.FFMPEG_PATH = require("ffmpeg-static"); // MUST BE AT THE TOP

const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { 
  joinVoiceChannel, createAudioPlayer, createAudioResource, 
  VoiceConnectionStatus, StreamType, entersState 
} = require("@discordjs/voice");
const { Pool } = require("pg");
const { Readable } = require("stream");
const { EdgeTTS } = require("@travisvn/edge-tts");

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const voiceStates = new Map(); 

// We Lazy-load Cartesia so it doesn't crash the file if the API key is missing
let cartesia = null;
try {
  const { CartesiaClient } = require("@cartesia/cartesia-js");
  if (process.env.CARTESIA_API_KEY) {
    cartesia = new CartesiaClient({ apiKey: process.env.CARTESIA_API_KEY });
  }
} catch (e) {
  console.log("[voice] Cartesia not loaded:", e.message);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("voice")
    .setDescription("chromed voice AI in VC")
    .addSubcommand((s) => s.setName("join").setDescription("join your voice channel"))
    .addSubcommand((s) => s.setName("leave").setDescription("leave the voice channel"))
    .addSubcommand((s) =>
      s.setName("say").setDescription("make chromed speak raw text")
        .addStringOption((o) => o.setName("text").setDescription("what to say").setRequired(true))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const member = interaction.member;
    
    // Reply instantly so Discord doesn't time out
    await interaction.deferReply({ ephemeral: true });

    if (sub === "join") {
      const vc = member.voice.channel;
      if (!vc) return interaction.editReply("you must be in a voice channel first.");

      const permissions = vc.permissionsFor(interaction.guild.members.me);
      if (!permissions.has(PermissionFlagsBits.Connect) || !permissions.has(PermissionFlagsBits.Speak)) {
        return interaction.editReply("i don't have `Connect` or `Speak` permissions in that voice channel.");
      }

      try {
        console.log(`[voice] Attempting to join VC: ${vc.id} in Guild: ${guildId}`);
        
        const connection = joinVoiceChannel({
          channelId: vc.id,
          guildId: guildId,
          adapterCreator: interaction.guild.voiceAdapterCreator,
          selfDeaf: false,
          selfMute: false
        });

        const player = createAudioPlayer();
        connection.subscribe(player);
        
        // Listen for errors so we can print them
        player.on('error', err => console.error(`[voice] Player Error:`, err));
        connection.on('error', err => console.error(`[voice] Connection Error:`, err));

        const state = { connection, player, channelId: vc.id };
        voiceStates.set(guildId, state);

        // Wait up to 5 seconds for the connection to actually establish
        try {
          await entersState(connection, VoiceConnectionStatus.Ready, 5000);
          console.log(`[voice] Connection is READY in ${vc.id}`);
          return interaction.editReply(`🔊 joined **${vc.name}**. i'm listening.`);
        } catch (error) {
          connection.destroy();
          voiceStates.delete(guildId);
          console.error(`[voice] Failed to connect within 5 seconds. State:`, connection.state.status);
          return interaction.editReply(`failed to connect. Check Render console for errors.`);
        }

      } catch (err) {
        console.error("[voice] Fatal join error:", err);
        return interaction.editReply(`fatal error joining: ${err.message}`);
      }
    }

    if (sub === "leave") {
      const state = voiceStates.get(guildId);
      if (!state) return interaction.editReply("i'm not in a voice channel.");
      state.connection.destroy();
      voiceStates.delete(guildId);
      return interaction.editReply("left the voice channel.");
    }

    if (sub === "say") {
      const state = voiceStates.get(guildId);
      if (!state) return interaction.editReply("i'm not in a voice channel. use `/voice join` first.");
      
      let text = interaction.options.getString("text");
      await speak(guildId, text);
      return interaction.editReply(`🔊 spoke: *${text.slice(0, 100)}*`);
    }
  }
};

// ── HELPER: Speak Audio ──
async function speak(guildId, text) {
  const state = voiceStates.get(guildId);
  if (!state) return;

  try {
    state.player.stop();
    console.log(`[voice] fetching Edge TTS for: "${text}"`);
    
    const tts = new EdgeTTS(text.slice(0, 300), "en-US-GuyNeural");
    const result = await tts.synthesize();
    const audioBuffer = Buffer.from(await result.audio.arrayBuffer());

    const stream = Readable.from(audioBuffer);
    const resource = createAudioResource(stream, { 
      inputType: StreamType.Arbitrary,
      ffmpegPath: require("ffmpeg-static")
    });
    
    state.player.play(resource);
    console.log(`[voice] successfully piped audio to VC.`);
  } catch (err) {
    console.error("[voice] speak error:", err);
  }
}
