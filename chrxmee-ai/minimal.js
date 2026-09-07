const http = require("http");
const { Client, GatewayIntentBits } = require("discord.js");

console.log(" minimal starting");

// Simple web server to keep Render alive
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("chromed test alive");
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(` test server listening on ${PORT}`);
});

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once("ready", () => {
  console.log(` logged in as ${client.user.tag}`);
});

client.login(process.env.BOT_TOKEN).catch(err => {
  console.error(" login error:", err.message);
});
