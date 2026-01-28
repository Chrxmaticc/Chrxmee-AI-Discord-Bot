require("dotenv").config();
const { Client, GatewayIntentBits, Collection } = require("discord.js");
const fs = require("fs");
const path = require("path");
// KEEP-ALIVE SERVER (forced on port 3000 for Replit/UptimeRobot pings)
// This keeps the repl awake by responding to HTTP requests
const http = require('http');
console.log("Starting keep-alive server...");
const server = http.createServer((req, res) => {
  console.log("Ping received on keep-alive server from:", req.url);
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Chrxmee AI is alive! Ping received. 🚀');
});
const PORT = 3000; // Forced to Replit's default port
server.listen(PORT, () => {
  console.log(`Keep-alive server listening on port ${PORT}`);
});
// Server error logging (helps debug if it fails)
server.on('error', (err) => {
  console.error('Keep-alive server error:', err.message);
});
// END KEEP-ALIVE
// Keep Replit session alive even when tab is backgrounded
setInterval(() => {
  console.log("Heartbeat - keeping session active");
}, 5 * 60 * 1000); // Every 5 minutes

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [1, 3], // CHANNEL, MESSAGE for DMs
});
client.commands = new Collection();
client.memory = new Map(); // The "brain" storage
// Load commands
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".js"));
for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  if ("data" in command && "execute" in command) {
    client.commands.set(command.data.name, command);
  }
}
// Load events
const eventsPath = path.join(__dirname, "events");
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith(".js"));
for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  const event = require(filePath);
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
}

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);

  client.user.setPresence({
    status: 'testing',
    activities: [{
      name: "Discord World AI Competition",
      type: 0, // Playing
      details: "All AIs show off their models and intelligence.",
      state: "Winning against Chatcord", // This is fine — state is allowed up to 128 chars
      application_id: "1458944258454065377", // Double-check this is correct
      party: {
        id: "chrxmee-party-" + Date.now(), // Unique ID fixes "state is wrong" for most users
        size: [1, 1] // Current / max players (1/1 for single bot)
      },
      assets: {
        large_image: "play_button", // Your uploaded image name
        large_text: "Chrxmee AI",
        small_image: "snow_king", // Optional
        small_text: "Chrxmee Bot"
      },
      buttons: [
        { label: "Invite Bot", url: "https://discord.com/invite/your-bot-invite" },
        { label: "Join Server", url: "https://discord.gg/your-server" }
      ],
      timestamps: { start: Date.now() },
      instance: true
    }]
  });
    
  });


client.login(process.env.BOT_TOKEN);