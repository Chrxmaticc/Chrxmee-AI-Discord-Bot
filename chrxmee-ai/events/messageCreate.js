const fs = require("fs");
const path = require("path");

module.exports = {
  name: "messageCreate",
  async execute(message) {
    if (message.author.bot) return;

    const client = message.client;
    const userId = message.author.id;
    const channelId = message.channelId;

    // Find if there's an active chat session in this channel
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

    // Inactivity check (3 minutes)
    const now = Date.now();
    if (userData.lastActivity && (now - userData.lastActivity > 180000)) {
      userData.inChat = false;
      client.memory.set(activeSessionUser, userData);
      return; 
    }

    if (stopPhrases.includes(content) && (activeSessionUser === userId)) {
      // Save conversation
      const logDir = path.join(__dirname, "../conversations");
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);
      const logFile = path.join(logDir, `${activeSessionUser}_${Date.now()}.json`);
      fs.writeFileSync(logFile, JSON.stringify(userData.history, null, 2));

      userData.inChat = false;
      client.memory.set(activeSessionUser, userData);
      return message.reply("👋 Conversation ended and saved! See you later.");
    }

    userData.lastActivity = now;
    message.channel.sendTyping();

    const models = {
      smart: "llama-3.3-70b-versatile",
      fast: "llama-3.1-8b-instant",
      thinker: "deepseek-r1-distill-llama-70b"
    };

    // Add speaker name if in group mode
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
            { role: "system", content: "You are Chrxmee AI. Engage in a natural, friendly conversation." },
            ...userData.history
          ],
        }),
      });

      const data = await response.json();
      const answer = data.choices[0].message.content;
      userData.history.push({ role: "assistant", content: answer });
      client.memory.set(activeSessionUser, userData);

      if (answer.length > 2000) {
        const chunks = answer.match(/[\s\S]{1,1900}/g);
        for (const chunk of chunks) await message.reply(chunk);
      } else {
        await message.reply(answer);
      }
    } catch (err) {
      console.error(err);
      message.reply("Sorry, I hit a snag in our conversation.");
    }
  },
};
