// commands/voice.js
process.env.FFMPEG_PATH = require("ffmpeg-static"); // MUST BE AT THE TOP

const { SlashCommandBuilder } = require("discord.js");
const { 
  joinVoiceChannel, createAudioPlayer, createAudioResource, 
  StreamType 
} = require("@discordjs/voice");
const { Pool } = require("pg");
const { Readable } = require("stream");
const { EdgeTTS } = require("@travisvn/edge-tts");
const googleTTS = require("@sefinek/google-tts-api");
const { CartesiaClient } = require("@cartesia/cartesia-js");

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

// Initialize Cartesia (Requires API Key)
const cartesia = new CartesiaClient({ apiKey: process.env.CARTESIA_API_KEY });

const voiceStates = new Map(); 
let speechListenerAttached = false; 

// Available voices for each provider
const VOICES = {
  edge: {
    "en-US-GuyNeural": "Guy (American Male)",
    "en-US-EmmaMultilingualNeural": "Emma (Multilingual Female)",
    "en-GB-SoniaNeural": "Sonia (British Female)",
    "en-AU-NatashaNeural": "Natasha (Australian Female)"
  },
  cartesia: {
    "sonic-english": "Sonic (Default)",
    // Add other Cartesia voice IDs here
  },
  google: {
    "en": "English (Default)",
    "es": "Spanish",
    "fr": "French"
  }
};

async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS voice_optouts (user_id TEXT PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS voice_preferences (
      user_id TEXT PRIMARY KEY,
      provider TEXT DEFAULT 'edge',
      voice_id TEXT DEFAULT 'en-US-GuyNeural'
    );
  `);
}
ensureTables().catch(console.error);

// ... (getVoiceAI function remains the same)

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
    )
    .addSubcommand((s) =>
      s.setName("set").setDescription("choose your TTS provider and voice")
        .addStringOption((o) => o.setName("provider").setDescription("Choose a provider").setRequired(true)
          .addChoices(
            { name: "Edge (Free, Fast)", value: "edge" },
            { name: "Cartesia (Premium, Natural)", value: "cartesia" },
            { name: "Google (Backup)", value: "google" }
          ))
        .addStringOption((o) => o.setName("voice").setDescription("Choose a voice (optional, use exact ID)").setRequired(false))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const member = interaction.member;
    await interaction.deferReply({ ephemeral: true });

    // ... (join, leave, optout commands remain largely the same, handling state)

    if (sub === "set") {
      const provider = interaction.options.getString("provider");
      let voiceId = interaction.options.getString("voice");

      if (!voiceId) {
        // Pick default for that provider
        voiceId = Object.keys(VOICES[provider])[0];
      }

      await pool.query(
        `INSERT INTO voice_preferences (user_id, provider, voice_id) VALUES ($1, $2, $3)
         ON CONFLICT (user_id) DO UPDATE SET provider = $2, voice_id = $3`,
        [member.id, provider, voiceId]
      );

      return interaction.editReply(`✅ Your voice is now set to **${provider}** with voice ID \`${voiceId}\`.`);
    }

    // ... (say/ai commands need to fetch user preference and call the new speak function)
    // Example for /voice ai:
    if (sub === "ai") {
      const state = voiceStates.get(guildId);
      if (!state) return interaction.editReply("i'm not in a voice channel. use `/voice join` first.");

      let text = interaction.options.getString("prompt");
      const reply = await getVoiceAI(interaction.client, text);
      
      // Fetch user preference
      const pref = await pool.query("SELECT provider, voice_id FROM voice_preferences WHERE user_id = $1", [member.id]);
      const provider = pref.rows[0]?.provider || "edge";
      const voiceId = pref.rows[0]?.voice_id || "en-US-GuyNeural";

      await speak(interaction.client, guildId, reply, provider, voiceId);
      return interaction.editReply(`🔊 spoke: *${reply.slice(0, 100)}...*`);
    }
  }
};

// ── HELPER: Speak Audio (Tiered Fallback) ──
async function speak(client, guildId, text, preferredProvider = "edge", voiceId) {
  const state = voiceStates.get(guildId);
  if (!state) return;

  let audioBuffer = null;
  let usedProvider = preferredProvider;
  let fallbackNotice = "";

  try {
    state.player.stop();

    // 1. Try the preferred provider
    try {
      audioBuffer = await fetchTTS(text, preferredProvider, voiceId);
    } catch (e) {
      console.warn(`[voice] ${preferredProvider} failed:`, e.message);
      
      // 2. Fallback to Edge TTS
      usedProvider = "edge";
      fallbackNotice = `⚠️ **${preferredProvider}** failed. Falling back to **Edge TTS**.`;
      try {
        audioBuffer = await fetchTTS(text, "edge", "en-US-GuyNeural");
      } catch (e2) {
        // 3. Fallback to Google TTS
        usedProvider = "google";
        fallbackNotice = `⚠️ **${preferredProvider}** and **Edge TTS** failed. Falling back to **Google TTS**.`;
        audioBuffer = await fetchTTS(text, "google", "en");
      }
    }

    if (!audioBuffer) throw new Error("All TTS providers failed.");

    const stream = Readable.from(audioBuffer);
    const resource = createAudioResource(stream, { 
      inputType: StreamType.Arbitrary,
      ffmpegPath: require("ffmpeg-static")
    });
    
    state.player.play(resource);

    // If a fallback happened, notify the user (you might want to send this to a specific channel or DM)
    if (fallbackNotice) {
      console.log(fallbackNotice);
      // Optionally send to an interaction or channel
    }

  } catch (err) {
    console.error("[voice] speak error:", err.message);
  }
}

// ── HELPER: Fetch TTS Audio Buffer ──
async function fetchTTS(text, provider, voiceId) {
  const safeText = text.slice(0, 300); // TTS limits

  if (provider === "edge") {
    const tts = new EdgeTTS(safeText, voiceId || "en-US-GuyNeural");
    const result = await tts.synthesize();
    return Buffer.from(await result.audio.arrayBuffer());
  }

  if (provider === "cartesia") {
    const response = await cartesia.tts.bytes({
      modelId: "sonic-english",
      transcript: safeText,
      voice: { mode: "id", id: voiceId || "sonic-english" },
      output_format: { container: "raw", encoding: "pcm_s16le", sample_rate: 44100 },
    });
    return Buffer.from(await response.arrayBuffer());
  }

  if (provider === "google") {
    const url = googleTTS.getAudioUrl(safeText, { lang: voiceId || "en", slow: false });
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Google TTS HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }

  throw new Error(`Unknown provider: ${provider}`);
}
