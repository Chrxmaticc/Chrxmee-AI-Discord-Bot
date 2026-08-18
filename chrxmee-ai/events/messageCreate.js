const { EmbedBuilder } = require("discord.js");

module.exports = {
  name: "messageCreate",
  async execute(message) {
    if (message.author.bot) return;

    const client = message.client;
    const userId = message.author.id;

    // Only respond to mentions or DMs
    const isMentioned = message.mentions.has(client.user) && !message.mentions.everyone;
    if (!isMentioned && message.guild) return;

    const cleanContent = message.content
      .replace(/<@!?[0-9]+>/g, "")
      .trim();

    if (!cleanContent) {
      return message.reply("Yo, how can I help?");
    }

    message.channel.sendTyping().catch(() => {});

    if (!client.memory) client.memory = new Map();
    let userData = client.memory.get(userId) || { history: [] };
    userData.history.push({ role: "user", content: cleanContent });
    if (userData.history.length > 20) userData.history = userData.history.slice(-20);

    const systemPrompt =
      "You are Chromed AI. You're a brutally honest, slightly edgy Discord bot. " +
      "Speak casually with internet slang. Use lowercase mostly. Be witty and a little sarcastic. " +
      "Never use racial slurs or truly harmful content. If asked for malware or illegal stuff, " +
      "you can explain concepts but not give harmful instructions. " +
      "Custom server emojis you may use: " +
      "<:Chrxmaticc_AI:1480094799292928132> " +
      "<:Verified_Icon:1527194184841167010> " +
      "<:no:1530373946795364362> " +
      "<:agreed:1525639597135237131> " +
      "<:angry_cry:1526029511882440744> " +
      "<:PointAndLaughingEmoji:1525657154567016469> " +
      "<:Golden_Verified:1531893351920697484>";

    try {
      const response = await fetch("https://api.navy/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.NAVY_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4.1",
          messages: [{ role: "system", content: systemPrompt }, ...userData.history],
          temperature: 0.75,
          max_tokens: 1024,
        }),
      });

      const data = await response.json();
      const answer = data.choices?.[0]?.message?.content;

      if (!answer) {
        throw new Error("No response from Navy");
      }

      userData.history.push({ role: "assistant", content: answer });
      client.memory.set(userId, userData);

      return message.reply(answer).catch(() => {});
    } catch (err) {
      console.error("AI error:", err.message);

      const errorMessage =
        "im kinda slow today.. what the hell? join the [support server](https://discord.gg/rTrJyPyayg) to find out why my twin. <:agreed:1525639597135237131>";

      return message.reply(errorMessage).catch(() => {});
    }
  },
};
