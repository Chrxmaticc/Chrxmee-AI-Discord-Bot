// commands/voice.js
process.env.FFMPEG_PATH = require("ffmpeg-static"); // MUST BE AT THE TOP

const { SlashCommandBuilder } = require("discord.js");
const { 
  joinVoiceChannel, createAudioPlayer, createAudioResource, 
  StreamType 
} = require("@discordjs/voice");
const { Pool } = require("pg");
const { Readable } = require("stream");
const googleTTS = require("google-tts-api");

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const voiceStates = new Map(); 
let speechListenerAttached = false; 

async function ensureOptTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS voice_optouts (
      user_id TEXT PRIMARY KEY
    );
  `);
}
ensureOptTable().catch(console.error);

// ── LOCAL AI WRAPPER FOR VOICE ──
// This keeps the LLM in check specifically for voice chat
async function getVoiceAI(client, prompt) {
  try {
    const aiModule = require("../events/messageCreate"); 
    
    // We force the AI to act like a voice chat participant
    const systemOverride = `You are Chromed in a Voice Chat. You are speaking OUT LOUD.
RULES:
1. MAX 2 sentences. Keep it brief.
2. NO markdown, NO asterisks, NO emojis. (They can't be spoken).
3. Speak casually, using slang like "twin", "cooked", "fr".
4. Never say "Hey bro" or generic greetings. Answer the prompt directly.`;

    const messages = [
      { role: "system", content: systemOverride },
      { role: "user", content: prompt }
    ];

    // Call your existing AI function
    const reply = await aiModule.callAI("genius", messages, 0.85, 150);
    return reply || "i have no idea what you just said twin.";
  } catch (e) {
    console.warn("[voice] AI call failed:", e.message);
    return "my brain is lagging right now.";
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("voice")
    .setDescription("chromed voice AI in VC")
    .setDMPermission(false)
    .addSubcommand((s) => s.setName("join").setDescription("join your voice channel"))
    .addSubcommand((s) => s.setName("leave").setDescription("leave the voice channel"))
    .addSubcommand((s) => s.setName("optout").setDescription("stop chromed from listening to you"))
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

    if (sub === "join") {
      const vc = member.voice.channel;
      if (!vc) return interaction.editReply("you must be in a voice channel first.");

      try {
        const connection = joinVoiceChannel({
          channelId: vc.id,
          guildId: guildId,
          adapterCreator: interaction.guild.voiceAdapterCreator,
          selfDeaf: false,
          selfMute: false
        });

        const player = createAudioPlayer();
        connection.subscribe(player);

        player.on('error', error => console.error(`[voice] Player Error: ${error.message}`));

        const state = {
          connection,
          player,
          listening: true,
          channelId: vc.id,
          emptyTimer: null
        };
        voiceStates.set(guildId, state);

        // ── SPEECH RECOGNITION LISTENER ──
        if (!speechListenerAttached) {
          speechListenerAttached = true;
          interaction.client.on("speech", async (msg) => {
            if (!msg.guild || !msg.content) return;
            
            const currentState = voiceStates.get(msg.guild.id);
            if (!currentState?.listening) return;

            const isOptedOut = await pool.query("SELECT 1 FROM voice_optouts WHERE user_id = $1", [msg.author.id]);
            if (isOptedOut.rows.length > 0) return;

            const content = msg.content.toLowerCase();
            // Triggers if they say "chromed" or if it's a direct question ending in ?
            if (content.includes("chromed") || content.includes("chrxmee") || content.endsWith("?")) {
              console.log(`[voice] Heard: "${msg.content}" from ${msg.author.username}`);
              const reply = await getVoiceAI(interaction.client, msg.content);
              await speak(interaction.client, msg.guild.id, reply);
            }
          });
        }

        // ── AUTO LEAVE ──
        const checkEmpty = () => {
          const ch = interaction.guild.channels.cache.get(vc.id);
          if (!ch) return;
          const humans = ch.members.filter(m => !m.user.bot);
          const state = voiceStates.get(guildId);
          
          if (humans.size === 0 && !state.emptyTimer) {
            state.emptyTimer = setTimeout(() => {
              if (voiceStates.has(guildId)) {
                voiceStates.get(guildId).connection.destroy();
                voiceStates.delete(guildId);
                console.log(`[voice] Auto-left empty channel.`);
              }
            }, 30_000);
          } else if (humans.size > 0 && state?.emptyTimer) {
            clearTimeout(state.emptyTimer);
            state.emptyTimer = null;
          }
        };

        const emptyInterval = setInterval(checkEmpty, 5000);
        state.emptyInterval = emptyInterval;
        voiceStates.set(guildId, state);

        return interaction.editReply(`🔊 joined **${vc.name}**. i'm listening.`);
      } catch (err) {
        console.error("[voice] join error:", err);
        return interaction.editReply("failed to join voice channel.");
      }
    }

    if (sub === "leave") {
      const state = voiceStates.get(guildId);
      if (!state) return interaction.editReply("i'm not in a voice channel.");
      if (state.emptyInterval) clearInterval(state.emptyInterval);
      if (state.emptyTimer) clearTimeout(state.emptyTimer);
      state.connection.destroy();
      voiceStates.delete(guildId);
      return interaction.editReply("left the voice channel.");
    }

    if (sub === "optout") {
      const res = await pool.query("SELECT 1 FROM voice_optouts WHERE user_id = $1", [member.id]);
      if (res.rows.length > 0) {
        await pool.query("DELETE FROM voice_optouts WHERE user_id = $1", [member.id]);
        return interaction.editReply("✅ chromed will now listen to you again.");
      } else {
        await pool.query("INSERT INTO voice_optouts (user_id) VALUES ($1) ON CONFLICT DO NOTHING", [member.id]);
        return interaction.editReply("🚫 chromed will no longer listen to your voice.");
      }
    }

    if (sub === "say" || sub === "ai") {
      const state = voiceStates.get(guildId);
      if (!state) return interaction.editReply("i'm not in a voice channel. use `/voice join` first.");

      let text = interaction.options.getString("text") || interaction.options.getString("prompt");
      
      if (sub === "ai") {
        text = await getVoiceAI(interaction.client, text);
      }

      await speak(interaction.client, guildId, text);
      return interaction.editReply(`🔊 spoke: *${text.slice(0, 100)}${text.length > 100 ? "..." : ""}*`);
    }
  }
};

// ── HELPER: Speak Audio (Using Google TTS) ──
async function speak(client, guildId, text) {
  const state = voiceStates.get(guildId);
  if (!state) return;

  try {
    state.player.stop();

    // Trim text to 200 chars max (Google TTS limit)
    const safeText = text.slice(0, 200);
    
    // Fetch free Google TTS
    const url = googleTTS.getAudioUrl(safeText, {
      lang: 'en',
      slow: false,
      host: 'https://translate.google.com',
    });

    console.log(`[voice] fetching Google TTS...`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Google TTS API error: ${res.status}`);
    
    const buffer = Buffer.from(await res.arrayBuffer());
    const stream = Readable.from(buffer);

    // Explicitly use static ffmpeg path
    const resource = createAudioResource(stream, { 
      inputType: StreamType.Arbitrary,
      ffmpegPath: require("ffmpeg-static")
    });
    
    state.player.play(resource);
    console.log(`[voice] successfully piped audio to VC.`);
  } catch (err) {
    console.error("[voice] speak error:", err.message);
  }
}
