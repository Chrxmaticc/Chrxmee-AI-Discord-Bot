const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
const { handleKeywords } = require("../commands/keyword-responder");

const db = new Client({
  connectionString: process.env.DATABASE_URL,
});
db.connect().catch(err => console.error("DB Connection Error:", err));

const MODELS = {
  genius:    { id: "llama-3.3-70b-versatile",         label: "Genius" },
  speedster: { id: "llama-3.1-8b-instant",            label: "Speedster" },
  thinker:   { id: "openai/gpt-oss-120b",             label: "Thinker" },
  creative:  { id: "qwen/qwen3-32b",                  label: "Creative" },
  efficient: { id: "qwen-qwq-32b",                    label: "Efficient" },
  vision:    { id: "llama-3.2-11b-vision-preview",    label: "Vision" },
  agent:     { id: "compound-beta",                   label: "Agent" },
};

const DEFAULT_MODEL = "genius";

function buildSystemPrompt(modelPreference, customPrompt, personalInfo, isGroup) {
  return `You are Chrxmee AI — a witty, slightly edgy, and genuinely helpful Discord bot. You are casual, fun, and a little sarcastic when appropriate. You grow with your users over time and build a real relationship with them.

Current mode: '${modelPreference}'
- genius: Smart and thorough. Like a brilliant friend who explains things clearly.
- speedster: Quick and punchy. No fluff, just answers.
- thinker: Methodical and step-by-step. Think deeply before answering.
- creative: Expressive and imaginative. Great for writing and ideas.
- efficient: Concise and practical. As few words as needed.
- vision: Analytical and observant. Great at interpreting complex info.
- agent: Research-oriented. Comprehensive answers with context.

${isGroup ? "You are in a GROUP chat. Multiple people may be talking — their username is prefixed before each message. Address them by name when relevant." : "You are in a SOLO session. Be personal and conversational."}

Rules:
- Be casual, use internet slang, match the user's energy.
- Never flag normal words, slang, memes, or mild language like "corny", "sus", "bruh", "wild" — those are totally fine.
- You learn about the user over time — reference what you know naturally like a friend would.
- Only refuse if something genuinely involves: detailed weapon/drug/malware instructions, sexual content, or targeted harassment.
- If the user has a custom personality set, follow it as your actual character — make it feel natural, not forced.
${personalInfo ? `\nWhat you know about this user: ${personalInfo}. Reference this naturally when relevant.` : ""}
${customPrompt ? `\nCustom personality the user set: ${customPrompt}` : ""}`;
}

module.exports = {
  name: "messageCreate",
  async execute(message) {
    if (message.author.bot) return;

    await handleKeywords(message, message.client);

    try {
      const result = await db.query(
        "INSERT INTO processed_messages (message_id) VALUES ($1) ON CONFLICT (message_id) DO NOTHING RETURNING message_id",
        [message.id]
      );
      if (result.rowCount === 0) return;
    } catch (err) {
      console.error("Deduplication DB error:", err.message);
    }

    await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 100));

    const client = message.client;
    const userId = message.author.id;
    const channelId = message.channelId;
    const guildId = message.guildId;

    if (guildId) {
      try {
        const settingsRes = await db.query("SELECT wake_up_mode FROM guild_settings WHERE guild_id = $1", [guildId]);
        const mode = settingsRes.rows[0]?.wake_up_mode || 'ping';
        const isMentioned = (message.mentions.has(client.user) && !message.mentions.everyone)
          || (message.reference && (await message.fetchReference().catch(() => null))?.author?.id === client.user.id);

        if (mode === 'off') return;

        if (mode === 'ping' || mode === 'commands') {
          let isInSession = false;
          for (const [id, data] of client.memory.entries()) {
            if (data.inChat && data.chatChannelId === channelId && (data.chatMode === "group" || id === userId)) {
              isInSession = true;
              break;
            }
          }
          if (mode === 'ping' && !isMentioned && !isInSession) return;
          if (mode === 'commands' && !isInSession) return;
        }

        if (isMentioned) {
          let currentSession = null;
          for (const [id, data] of client.memory.entries()) {
            if (data.inChat && data.chatChannelId === channelId && (data.chatMode === "group" || id === userId)) {
              currentSession = data;
              break;
            }
          }

          if (!currentSession) {
            const cleanContent = message.content.replace(/<@!?[0-9]+>/g, "").trim();
            if (!cleanContent) return message.reply("Hey! How can I help? (Use `/chat` to start a full session!)");

            try {
              message.channel.sendTyping();

              let userData = client.memory.get(userId) || { history: [], model: DEFAULT_MODEL };
              let customPrompt = userData.customPrompt || "";
              let personalInfo = "";

              if (!userData.customPrompt && !userData.personal) {
                try {
                  const [customRes, personalRes] = await Promise.all([
                    db.query("SELECT custom_prompt, preferred_model FROM user_interactions WHERE user_id = $1", [userId]),
                    db.query("SELECT personal_info FROM user_personal_info WHERE user_id = $1", [userId])
                  ]);
                  if (customRes.rows[0]) {
                    customPrompt = customRes.rows[0].custom_prompt || "";
                    userData.customPrompt = customPrompt;
                    if (customRes.rows[0].preferred_model) userData.model = customRes.rows[0].preferred_model;
                  }
                  if (personalRes.rows[0]?.personal_info) {
                    try { userData.personal = JSON.parse(personalRes.rows[0].personal_info); }
                    catch { userData.personal = { info: personalRes.rows[0].personal_info }; }
                  }
                } catch (err) { console.error("Ping DB Error:", err); }
              }

              if (userData.personal) {
                personalInfo = Object.entries(userData.personal).map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`).join(", ");
              }

              const modelKey = userData.model || DEFAULT_MODEL;
              const modelEntry = MODELS[modelKey] || MODELS[DEFAULT_MODEL];
              const systemPrompt = buildSystemPrompt(modelKey, customPrompt, personalInfo, false);

              userData.history.push({ role: "user", content: cleanContent });
              if (userData.history.length > 20) userData.history = userData.history.slice(-20);

              const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
                body: JSON.stringify({
                  model: modelEntry.id,
                  messages: [{ role: "system", content: systemPrompt }, ...userData.history],
                  temperature: 0.75,
                  max_tokens: 1024
                }),
              });

              const data = await response.json();
              const answer = data.choices?.[0]?.message?.content || "I'm a bit lost in thought...";

              userData.history.push({ role: "assistant", content: answer });
              client.memory.set(userId, userData);
              return message.reply(answer);
            } catch (err) {
              console.error("Ping Response Error:", err);
              return message.reply("Sorry, I hit a snag! Try again in a moment.");
            }
          }
        }
      } catch (err) {
        console.error("Check Guild Settings Error:", err);
      }
    }

    let activeSessionUser = null;
    let userData = null;

    for (const [id, data] of client.memory.entries()) {
      if (data.inChat && data.chatChannelId === channelId) {
        if (data.chatMode === "group" || id === userId) {
          activeSessionUser = id;
          userData = data;
          break;
        }
      }
    }

    if (!userData || !userData.inChat) return;

    const now = Date.now();

    if (userData.lastActivity && (now - userData.lastActivity > 180000)) {
      userData.inChat = false;
      client.memory.set(activeSessionUser, userData);
      return;
    }

    const content = message.content.toLowerCase();
    const stopPhrases = ["bye chrxmee ai.", "stop", "bye"];
    if (stopPhrases.includes(content) && activeSessionUser === userId) {
      const logDir = path.join(__dirname, "../conversations");
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);
      const logFile = path.join(logDir, `${activeSessionUser}_${Date.now()}.json`);
      fs.writeFileSync(logFile, JSON.stringify(userData.history, null, 2));
      userData.inChat = false;
      client.memory.set(activeSessionUser, userData);
      return message.reply("👋 Conversation ended and saved! See you later.");
    }

    userData.lastActivity = now;
    client.memory.set(activeSessionUser, userData);

    try { if (message.guild) message.channel.sendTyping(); } catch {}

    if (!userData.customPrompt && !userData.personal) {
      try {
        const [customRes, personalRes] = await Promise.all([
          db.query("SELECT custom_prompt, preferred_model FROM user_interactions WHERE user_id = $1", [userId]),
          db.query("SELECT personal_info FROM user_personal_info WHERE user_id = $1", [userId])
        ]);
        if (customRes.rows[0]) {
          userData.customPrompt = customRes.rows[0].custom_prompt || "";
          if (customRes.rows[0].preferred_model) userData.model = customRes.rows[0].preferred_model;
        }
        if (personalRes.rows[0]?.personal_info) {
          try { userData.personal = JSON.parse(personalRes.rows[0].personal_info); }
          catch { userData.personal = { info: personalRes.rows[0].personal_info }; }
        }
        client.memory.set(userId, userData);
      } catch (err) { console.error("Session DB fetch error:", err); }
    }

    let personalInfo = "";
    if (userData.personal) {
      personalInfo = Object.entries(userData.personal).map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`).join(", ");
    }

    const modelKey = userData.model || DEFAULT_MODEL;
    const modelEntry = MODELS[modelKey] || MODELS[DEFAULT_MODEL];
    const isGroup = userData.chatMode === "group";
    const systemPrompt = buildSystemPrompt(modelKey, userData.customPrompt || "", personalInfo, isGroup);

    const msgContent = isGroup ? `${message.author.username}: ${message.content}` : message.content;
    userData.history.push({ role: "user", content: msgContent });
    if (userData.history.length > 30) userData.history = userData.history.slice(-30);

    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
        body: JSON.stringify({
          model: modelEntry.id,
          messages: [{ role: "system", content: systemPrompt }, ...userData.history],
          temperature: 0.75,
          max_tokens: 1024
        }),
      });

      const data = await response.json();

      if (!data.choices?.[0]) {
        console.error("API Error Response:", JSON.stringify(data));
        throw new Error("Invalid API response from Groq");
      }

      const answer = data.choices[0].message.content;
      userData.history.push({ role: "assistant", content: answer });
      client.memory.set(activeSessionUser, userData);

      if (answer.length > 3000) {
        const chunks = answer.match(/[\s\S]{1,1900}/g);
        for (const chunk of chunks) await message.reply(chunk).catch(console.error);
      } else {
        await message.reply(answer).catch(console.error);
      }
    } catch (err) {
      console.error("AI execution error:", err);
      if (!err.message.includes("Unknown interaction")) {
        message.reply("Sorry, I hit a snag in our conversation. Try again in a sec!").catch(() => {});
      }
    }
  },
};
