module.exports = {
  name: "messageCreate",
  async execute(message) {
    if (message.author.bot || !message.content.startsWith("!")) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const commandName = args.shift()?.toLowerCase();
    const client = message.client;
    const allowedOwners = [process.env.OWNER_ID, process.env.OWNER_ID2].filter(Boolean);

    if (commandName === "ping") {
      return message.reply("pong!");
    }

    if (commandName === "id") {
      return message.reply(`Client ID: ${client.user.id}\nTag: ${client.user.tag}`);
    }

    if (commandName === "deploy") {
      if (!allowedOwners.includes(message.author.id)) {
        return message.reply("Owner only.");
      }

      const { REST, Routes } = require("discord.js");
      const fs = require("fs");
      const path = require("path");

      const commands = [];
      const commandsPath = path.join(__dirname, "..", "commands");
      const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".js"));

      for (const file of commandFiles) {
        try {
          const command = require(path.join(commandsPath, file));
          if ("data" in command && "execute" in command) {
            commands.push(command.data.toJSON());
          }
        } catch (e) {
          console.error(`Skipped ${file}: ${e.message}`);
        }
      }

      const rest = new REST({ version: "10" }).setToken(process.env.BOT_TOKEN);

      try {
        const registered = await rest.put(
          Routes.applicationCommands(client.user.id),
          { body: commands }
        );
        return message.reply(` Registered **${registered.length}** slash commands. They should appear shortly.`);
      } catch (err) {
        return message.reply(` Registration failed: ${err.message}`);
      }
    }
  },
};
