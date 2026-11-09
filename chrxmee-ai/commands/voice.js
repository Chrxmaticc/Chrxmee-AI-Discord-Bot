// commands/voice.js
process.env.FFMPEG_PATH = require("ffmpeg-static");
require("opusscript"); // Force load pure JS opus
require("libsodium-wrappers").ready.then(() => console.log("[voice] libsodium encryption ready"));

const { SlashCommandBuilder } = require("discord.js");
const { 
  joinVoiceChannel, createAudioPlayer, createAudioResource, 
  VoiceConnectionStatus, StreamType, entersState, generateDependencyReport 
} = require("@discordjs/voice");
const { Pool } = require("pg");
const { Readable } = require("stream");
const { EdgeTTS } = require("@travisvn/edge-tts");

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const voiceStates = new Map(); 

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
    
    await interaction.deferReply({ ephemeral: true });

    if (sub === "join") {
      const vc = member.voice.channel;
      if (!vc) return interaction.editReply("you must be in a voice channel first.");

      // 1. Print dependency report to console (Helps us debug missing packages)
      console.log(generateDependencyReport());

      try {
        // 2. Nuke any ghost connection
        const oldState = voiceStates.get(guildId);
        if (oldState) {
          oldState.connection.destroy();
          voiceStates.delete(guildId);
        }

        console.log(`[voice] Attempting to join VC: ${vc.id}`);
        
        const connection = joinVoiceChannel({
          channelId: vc.id,
          guildId: guildId,
          adapterCreator: interaction.guild.voiceAdapterCreator,
          selfDeaf: false,
          selfMute: false
        });

        const player = createAudioPlayer();
        connection.subscribe(player);

        // Logs exactly what Discord is doing
        connection.on('stateChange', (oldState, newState) => {
          console.log(`[voice] Connection: ${oldState.status} -> ${newState.status}`);
        });

        connection.on('error', (err) => console.error(`[voice] Connection Error:`, err));

        const state = { connection, player, channelId: vc.id };
        voiceStates.set(guildId, state);

        try {
          // Wait up to 10 seconds for Discord to say "Ready"
          await entersState(connection, VoiceConnectionStatus.Ready, 10000);
          console.log(`[voice] Connection is READY in ${vc.id}`);
          return interaction.editReply(`🔊 joined **${vc.name}**. i'm listening.`);
        } catch (error) {
          connection.destroy();
          voiceStates.delete(guildId);
          console.error(`[voice] Failed to connect within 10s. State: ${connection.state.status}`);
          return interaction.editReply(`failed to connect. check Render console for state logs.`);
        }

      } catch (err) {
        console.error("[voice] Fatal join error:", err);
        return interaction.editReply(`fatal error: ${err.message}`);
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
      if (!state) return interaction.editReply("i'm not in a voice channel.");
      
      let text = interaction.options.getString("text");
      
      try {
        state.player.stop();
        console.log(`[voice] Fetching Edge TTS...`);
        
        const tts = new EdgeTTS(text.slice(0, 300), "en-US-GuyNeural");
        const result = await tts.synthesize();
        const audioBuffer = Buffer.from(await result.audio.arrayBuffer());

        const stream = Readable.from(audioBuffer);
        const resource = createAudioResource(stream, { 
          inputType: StreamType.Arbitrary,
          ffmpegPath: require("ffmpeg-static")
        });
        
        state.player.play(resource);
        console.log(`[voice] Playing audio...`);
        
        return interaction.editReply(`🔊 spoke: *${text.slice(0, 100)}*`);
      } catch (err) {
        console.error("[voice] speak error:", err);
        return interaction.editReply(`failed to speak: ${err.message}`);
      }
    }
  }
};
