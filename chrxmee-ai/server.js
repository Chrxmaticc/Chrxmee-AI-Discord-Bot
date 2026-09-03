const http = require("http");
require("dotenv").config();
const { callAI } = require("./tools");

const webChatSessions = new Map();

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  if (req.method === "POST" && req.url === "/api/chat") {
    let body = "";
    req.on("data", chunk => { body += chunk.toString(); });
    req.on("end", async () => {
      try {
        const { message, userId } = JSON.parse(body);
        if (!message || !userId) {
          res.writeHead(400, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ error: "message and userId required" }));
        }

        let history = webChatSessions.get(userId) || [];
        history.push({ role: "user", content: message });
        if (history.length > 20) history = history.slice(-20);

        const answer = await callAI(
          "genius",
          [
            { role: "system", content: "You are Chromed AI, a witty and edgy Discord bot. Speak with internet slang and lowercase mostly. Keep answers helpful and slightly sarcastic." },
            ...history,
          ],
          0.75,
          1024
        );

        history.push({ role: "assistant", content: answer });
        webChatSessions.set(userId, history);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ response: answer }));
      } catch (err) {
        console.error("API chat error:", err);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "AI failed to respond" }));
      }
    });
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found");
});

const CHAT_PORT = process.env.CHAT_PORT || 3001;
server.listen(CHAT_PORT, "0.0.0.0", () => {
  console.log(`Chat server listening on port ${CHAT_PORT}`);
});
