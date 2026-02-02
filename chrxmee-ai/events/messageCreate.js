const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const db = new Client({
  connectionString: process.env.DATABASE_URL,
});
db.connect().catch(err => console.error("DB Connection Error:", err));

module.exports = {
  name: "messageCreate",
  async execute(message) {
    if (message.author.bot) return;

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

    // Check Guild Wake-up Settings
    if (guildId) {
      try {
        const settingsRes = await db.query("SELECT wake_up_mode FROM guild_settings WHERE guild_id = $1", [guildId]);
        const mode = settingsRes.rows[0]?.wake_up_mode || 'ping';

        if (mode === 'off') return;
        
        if (mode === 'ping') {
          const isMentioned = message.mentions.has(client.user) && !message.mentions.everyone;
          // If not mentioned AND not in a continuous chat session, ignore
          let isInSession = false;
          for (const [id, data] of client.memory.entries()) {
            if (data.inChat && data.chatChannelId === channelId && (data.chatMode === "group" || id === userId)) {
              isInSession = true;
              break;
            }
          }
          if (!isMentioned && !isInSession) return;
        }
        
        if (mode === 'commands') {
          // In 'commands' mode, we only respond to messages if they are part of an active /chat session
          let isInSession = false;
          for (const [id, data] of client.memory.entries()) {
            if (data.inChat && data.chatChannelId === channelId && (data.chatMode === "group" || id === userId)) {
              isInSession = true;
              break;
            }
          }
          if (!isInSession) return;
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

    const content = message.content.toLowerCase();
    const stopPhrases = ["bye chrxmee ai.", "stop", "bye"];

    const now = Date.now();
    if (userData.lastActivity && (now - userData.lastActivity > 180000)) {
      userData.inChat = false;
      client.memory.set(activeSessionUser, userData);
      return; 
    }

    if (stopPhrases.includes(content) && (activeSessionUser === userId)) {
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

    try {
      if (message.guild) {
        message.channel.sendTyping();
      }
    } catch (e) { }

    const models = {
      smart: "llama-3.3-70b-versatile",
      fast: "llama-3.1-8b-instant",
      thinker: "deepseek-r1-distill-llama-70b",
      creative: "llama-3.3-70b-versatile",
      efficient: "llama-3.1-8b-instant",
      visionary: "llama-3.3-70b-versatile",
      analyst: "llama-3.1-8b-instant",
      classic: "llama-3.3-70b-versatile"
    };

    const msgContent = userData.chatMode === "group" ? `${message.author.username}: ${message.content}` : message.content;
    
    userData.history.push({ role: "user", content: msgContent });
    if (userData.history.length > 15) userData.history = userData.history.slice(-15);

    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: models[userData.model || "smart"],
          messages: [
            { role: "system", content: "You are Chrxmee AI, a helpful and friendly AI assistant. Keep responses natural and concise." },
            ...userData.history
          ],
          temperature: 0.7,
          max_tokens: 1024
        }),
      });

      const data = await response.json();
      
      if (!data.choices || !data.choices[0]) {
        console.error("API Error Response:", JSON.stringify(data));
        throw new Error("Invalid API response from Groq");
      }

      const answer = data.choices[0].message.content;
      userData.history.push({ role: "assistant", content: answer });
      client.memory.set(activeSessionUser, userData);

      if (answer.length > 2000) {
        const chunks = answer.match(/[\s\S]{1,1900}/g);
        for (const chunk of chunks) {
          await message.reply(chunk).catch(console.error);
        }
      } else {
        await message.reply(answer).catch(console.error);
      }
    } catch (err) {
      console.error("AI execution error:", err);
      if (!err.message.includes("Unknown interaction")) {
        message.reply("Sorry, I hit a snag in our conversation. Please try saying that again!").catch(() => {});
      }
    }
  },
};
