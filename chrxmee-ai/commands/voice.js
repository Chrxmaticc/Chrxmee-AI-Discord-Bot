// commands/voice.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { 
  joinVoiceChannel, createAudioPlayer, createAudioResource, 
  VoiceConnectionStatus, StreamType // Added StreamType
} = require("@discordjs/voice");
const { Pool } = require("pg");
const { Readable } = require("stream");

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const voiceStates = new Map(); 
let speechListenerAttached = false; // Prevents duplicate listeners

const SE_API = "https://api.streamelements.com/kappa/v2/speech";

const TTS_VOICES = {
  brian: "Brian",
  matthew: "Matthew",
  joey: "Joey",
  amy: "Amy",
  emma: "Emma",
  nicole: "Nicole",
  russell: "Russell",
  kendra: "Kendra",
  justin: "Justin"
};

async function ensureOptTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS voice_optouts (
      user_id TEXT PRIMARY KEY
    );
  `);
}
ensureOptTable().catch(console.error);

async function callAI(client, prompt) {
  try {
    const aiModule = require("../events/messageCreate"); 
    if (aiModule.callAI) {
        return await aiModule.callAI("genius", [{ role: "user", content: prompt }], 0.85, 250);
    }
  } catch (e) {
    console.warn("[voice] AI call failed:", e.message);
  }
  return "My brain is lagging. Say that again.";
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
    )
    .addSubcommand((s) =>
      s.setName("voice").setDescription("change the TTS voice")
        .addStringOption((o) => o.setName("name").setDescription("voice name").setRequired(true)
          .addChoices(
            { name: "Brian (Casual)", value: "brian" },
            { name: "Matthew (Deep)", value: "matthew" },
            { name: "Joey (Young)", value: "joey" },
            { name: "Amy (British)", value: "amy" }
          ))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const member = interaction.member;
    await interaction.deferReply({ ephemeral: true });

    const getState = () => voiceStates.get(guildId) || { listening: false, voice: "brian" };

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

        // Add error listeners so we can see if FFmpeg fails
        player.on('error', error => {
          console.error(`[voice] Player Error: ${error.message}`);
        });

        const state = {
          connection,
          player,
          listening: true,
          channelId: vc.id,
          voice: getState().voice,
          emptyTimer: null
        };
        voiceStates.set(guildId, state);

        // ── FIXED: Only attach the speech listener ONCE globally ──
        if (!speechListenerAttached) {
          speechListenerAttached = true;
          interaction.client.on("speech", async (msg) => {
            if (!msg.guild || !msg.content) return;
            
            const currentState = voiceStates.get(msg.guild.id);
            if (!currentState?.listening) return;

            const isOptedOut = await pool.query("SELECT 1 FROM voice_optouts WHERE user_id = $1", [msg.author.id]);
            if (isOptedOut.rows.length > 0) return;

            const content = msg.content.toLowerCase();
            if (content.includes("chromed") || content.includes("chrxmee")) {
              console.log(`[voice] Heard: "${msg.content}" from ${msg.author.username}`);
              const reply = await callAI(interaction.client, msg.content);
              await speak(interaction.client, msg.guild.id, reply);
            }
          });
        }

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
                console.log(`[voice] Auto-left empty channel in ${guildId}`);
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
        text = await callAI(interaction.client, text);
      }

      await speak(interaction.client, guildId, text);
      return interaction.editReply(`🔊 spoke: *${text.slice(0, 100)}${text.length > 100 ? "..." : ""}*`);
    }

    if (sub === "voice") {
      const state = voiceStates.get(guildId) || { voice: "brian" };
      const newVoice = interaction.options.getString("name");
      state.voice = newVoice;
      voiceStates.set(guildId, state);
      return interaction.editReply(`🎙️ voice changed to **${TTS_VOICES[newVoice] || newVoice}**.`);
    }
  }
};

// ── HELPER: Speak Audio ──
async function speak(client, guildId, text) {
  const state = voiceStates.get(guildId);
  if (!state) return;

  try {
    state.player.stop();

    const voiceId = TTS_VOICES[state.voice] || "Brian";
    const url = `${SE_API}?voice=${voiceId}&text=${encodeURIComponent(text.slice(0, 300))}`;
    
    console.log(`[voice] fetching TTS from StreamElements...`);
    const res = await fetch(url);
    
    if (!res.ok) throw new Error(`TTS API error: ${res.status}`);
    
    const buffer = Buffer.from(await res.arrayBuffer());
    
    // ── DEBUG LOG ──
    // If StreamElements blocks you, it returns a tiny JSON error string instead of an MP3
    if (buffer.length < 1000) {
       console.error("[voice] TTS Failed. Response was:", buffer.toString());
       return;
    }

    const stream = Readable.from(buffer);
    
    // We tell discord explicitly to pass this raw stream to ffmpeg
    const resource = createAudioResource(stream, { inputType: StreamType.Arbitrary });
    state.player.play(resource);

    console.log(`[voice] successfully piped audio to VC.`);
  } catch (err) {
    console.error("[voice] speak error:", err.message);
  }
}
