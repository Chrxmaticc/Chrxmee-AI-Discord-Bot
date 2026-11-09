// commands/voice.js
process.env.FFMPEG_PATH = require("ffmpeg-static");
require("opusscript"); 
require("libsodium-wrappers").ready.then(() => console.log("[voice] libsodium ready"));

const { SlashCommandBuilder } = require("discord.js");
const { 
  joinVoiceChannel, createAudioPlayer, createAudioResource, 
  VoiceConnectionStatus, StreamType, entersState 
} = require("@discordjs/voice");
const { Readable } = require("stream");
const { EdgeTTS } = require("@travisvn/edge-tts");

// ── STATE ──
const voiceStates = new Map(); 
let speechListenerAttached = false;

async function getVoiceAI(client, prompt) {
  try {
    const aiModule = require("../events/messageCreate"); 
    const systemOverride = `You are Chromed in a Voice Chat. Max 2 sentences. No emojis. Speak casually, using slang like "twin", "cooked", "fr". Never say generic greetings.`;
    
    const messages = [
      { role: "system", content: systemOverride },
      { role: "user", content: prompt }
    ];
    
    const reply = await aiModule.callAI("genius", messages, 0.85, 150);
    return reply || "i have no idea what you just said twin.";
  } catch (e) {
    console.error("[voice] AI Error:", e.message);
    return "my brain is lagging right now.";
  }
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
    )
    .addSubcommand((s) =>
      s.setName("ai").setDescription("speak an AI response")
        .addStringOption((o) => o.setName("prompt").setDescription("ask chromed something").setRequired(true))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const member = interaction.member;
    
    await interaction.deferReply({ ephemeral: true });

    // ── JOIN ──
    if (sub === "join") {
      const vc = member.voice.channel;
      if (!vc) return interaction.editReply("you must be in a voice channel first.");

      try {
        // Nuke old connection if it exists to avoid ghost states
        const oldState = voiceStates.get(guildId);
        if (oldState) {
          oldState.connection.destroy();
          voiceStates.delete(guildId);
        }

        console.log(`[voice] Connecting to VC: ${vc.id}`);
        
        const connection = joinVoiceChannel({
          channelId: vc.id,
          guildId: guildId,
          adapterCreator: interaction.guild.voiceAdapterCreator,
          selfDeaf: false,
          selfMute: false
        });

        const player = createAudioPlayer();
        connection.subscribe(player);

        voiceStates.set(guildId, { connection, player, channelId: vc.id });

        try {
          // Wait 15 seconds to give Render time to establish the UDP socket
          await entersState(connection, VoiceConnectionStatus.Ready, 15000);
          console.log(`[voice] Connection READY in ${vc.id}`);
          
          // Attach Speech Recognition once
          if (!speechListenerAttached) {
            speechListenerAttached = true;
            interaction.client.on("speech", async (msg) => {
              if (!msg.guild || !msg.content) return;
              
              const currentState = voiceStates.get(msg.guild.id);
              if (!currentState) return;

              // Triggers if they say "chromed" or ask a direct question
              const content = msg.content.toLowerCase();
              if (content.includes("chromed") || content.includes("chrxmee") || content.endsWith("?")) {
                console.log(`[voice] Heard: "${msg.content}" from ${msg.author.username}`);
                const reply = await getVoiceAI(interaction.client, msg.content);
                await speak(msg.guild.id, reply);
              }
            });
          }

          return interaction.editReply(`🔊 joined **${vc.name}**. i'm listening.`);
        } catch (error) {
          connection.destroy();
          voiceStates.delete(guildId);
          console.error(`[voice] Failed to connect in 15s. State: ${connection.state.status}`);
          return interaction.editReply(`failed to connect. Render might be blocking UDP.`);
        }

      } catch (err) {
        console.error("[voice] Fatal join error:", err);
        return interaction.editReply(`fatal error: ${err.message}`);
      }
    }

    // ── LEAVE ──
    if (sub === "leave") {
      const state = voiceStates.get(guildId);
      if (!state) return interaction.editReply("i'm not in a voice channel.");
      state.connection.destroy();
      voiceStates.delete(guildId);
      return interaction.editReply("left the voice channel.");
    }

    // ── SAY / AI ──
    if (sub === "say" || sub === "ai") {
      const state = voiceStates.get(guildId);
      if (!state) return interaction.editReply("i'm not in a voice channel.");
      
      let text = interaction.options.getString("text") || interaction.options.getString("prompt");
      
      if (sub === "ai") {
        await interaction.editReply(`🧠 thinking...`);
        text = await getVoiceAI(interaction.client, text);
      }

      try {
        await speak(guildId, text);
        return interaction.editReply(`🔊 spoke: *${text.slice(0, 100)}${text.length > 100 ? "..." : ""}*`);
      } catch (err) {
        return interaction.editReply(`failed to speak: ${err.message}`);
      }
    }
  }
};

// ── HELPER: Speak ──
async function speak(guildId, text) {
  const state = voiceStates.get(guildId);
  if (!state) return;

  state.player.stop();
  console.log(`[voice] Generating TTS for: "${text.slice(0, 50)}..."`);
  
  // Edge TTS
  const tts = new EdgeTTS(text.slice(0, 300), "en-US-GuyNeural");
  const result = await tts.synthesize();
  const audioBuffer = Buffer.from(await result.audio.arrayBuffer());

  // Pipe to voice
  const stream = Readable.from(audioBuffer);
  const resource = createAudioResource(stream, { 
    inputType: StreamType.Arbitrary,
    ffmpegPath: require("ffmpeg-static")
  });
  
  state.player.play(resource);
  console.log(`[voice] Audio piping to VC...`);
}
