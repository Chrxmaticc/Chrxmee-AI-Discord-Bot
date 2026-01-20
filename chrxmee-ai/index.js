require("dotenv").config();

const { Client, GatewayIntentBits, Collection } = require("discord.js");
const fs = require("fs");
const path = require("path");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.commands = new Collection();
client.memory = new Map(); // The "brain" storage

// Load commands from /commands folder
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith(".js"));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  if ("data" in command && "execute" in command) {
    client.commands.set(command.data.name, command);
    console.log(`Loaded command: ${command.data.name}`);
  }
}

client.once("clientReady", (c) => {
  console.log(`Chrxmee AI ready as ${c.user.tag}`);
});

process.on("unhandledRejection", (error) => {
  console.error("Unhandled promise rejection:", error);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
});

client.on("interactionCreate", async (interaction) => {
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (err) {
      console.error(`Error executing ${interaction.commandName}:`, err);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "Error executing command!",
          ephemeral: true,
        });
      }
    }
  } else if (interaction.isButton()) {
    const [action, userId, prompt] = interaction.customId.split("|");
    if (interaction.user.id !== userId) {
      return interaction.reply({ content: "This is not for you!", ephemeral: true });
    }

    if (action === "explain_yes") {
      await interaction.update({ content: "Re-explaining in a different way...", components: [] });
      const command = client.commands.get("ask");
      if (command) {
        interaction.options = { getString: () => `Explain ${prompt} in a different way` };
        await command.execute(interaction);
      }
    } else if (action === "explain_no") {
      await interaction.update({ content: "Okay, I won't explain it.", components: [] });
    }
  }
});

client.login(process.env.BOT_TOKEN);
