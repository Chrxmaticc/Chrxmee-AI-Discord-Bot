const fs = require("fs");
const path = require("path");

module.exports = {
  name: "messageCreate",
  async execute(message) {
    if (message.author.bot) return;

    const client = message.client;
    const pool = client.pool;

    // ─── Get server-specific prefix from DB ────
    let prefix = "!";
    if (message.guild) {
      try {
        const res = await pool.query(`SELECT prefix FROM guild_settings WHERE guild_id = $1`, [message.guildId]);
        if (res.rows[0]?.prefix) prefix = res.rows[0].prefix;
      } catch {}
    }

    // Ignore if message doesn't start with prefix
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift()?.toLowerCase();
    if (!commandName) return;

    // ─── Dedicated prefix commands ────
    if (commandName === "ping") {
      return message.reply("pong!");
    }

    if (commandName === "id") {
      return message.reply(`Client ID: ${client.user.id}\nTag: ${client.user.tag}`);
    }

    if (commandName === "deploy") {
      const allowedOwners = [process.env.OWNER_ID, process.env.OWNER_ID2].filter(Boolean);
      if (!allowedOwners.includes(message.author.id)) return message.reply("Owner only.");

      const { REST, Routes } = require("discord.js");
      const fs = require("fs");
      const path = require("path");

      const commands = [];
      const seen = new Set();
      const duplicates = [];
      const commandsPath = path.join(__dirname, "..", "commands");
      const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".js"));

      for (const file of commandFiles) {
        try {
          const command = require(path.join(commandsPath, file));
          if ("data" in command && "execute" in command) {
            const name = command.data.name.toLowerCase();
            if (seen.has(name)) {
              duplicates.push(command.data.name);
              console.warn(`duplicate command name skipped: ${command.data.name} (from ${file})`);
              continue;
            }
            seen.add(name);
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
        return message.reply(`registered **${registered.length}** slash commands twin.${duplicates.length ? ` (skipped duplicates: ${duplicates.join(", ")})` : ""}`);
      } catch (err) {
        return message.reply(`registration failed: ${err.message}`);
      }
    }

    // ─── Universal handler for other slash commands ────
    if (!client.prefixCommands) {
      const commandsPath = path.join(__dirname, "..", "commands");
      const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".js"));
      const commands = new Map();
      for (const file of commandFiles) {
        try {
          const command = require(path.join(commandsPath, file));
          if ("data" in command && "execute" in command) {
            commands.set(command.data.name.toLowerCase(), command);
          }
        } catch {}
      }
      client.prefixCommands = commands;
    }

    const command = client.prefixCommands.get(commandName);
    if (!command) return;

    // Build fake interaction object
    const interaction = {
      user: message.author,
      member: message.member,
      guild: message.guild,
      channel: message.channel,
      client: client,
      guildId: message.guildId,
      channelId: message.channelId,
      isButton: () => false,
      deferReply: async () => {},
      reply: async (options) => {
        if (typeof options === "string") return message.reply(options);
        if (options && options.embeds) return message.reply({ embeds: options.embeds });
        if (options && options.content) return message.reply(options.content);
        return message.reply("Done.");
      },
      followUp: async (options) => {
        if (typeof options === "string") return message.channel.send(options);
        if (options && options.embeds) return message.channel.send({ embeds: options.embeds });
        return message.channel.send(options.content || "Done.");
      },
      editReply: async (options) => message.reply(options.content || "Done."),
      options: {
        getSubcommand: () => args[0] || null,
        getString: () => args.join(" ") || null,
        getInteger: () => parseInt(args.join(" ")) || null,
        getBoolean: () => args[0] === "true",
        getUser: () => message.mentions.users.first() || null,
        getChannel: () => message.mentions.channels.first() || null,
        getRole: () => message.mentions.roles.first() || null,
        getAttachment: () => message.attachments.first() || null,
        getNumber: () => parseFloat(args.join(" ")) || null,
      },
    };

    try {
      await command.execute(interaction, client);
    } catch (err) {
      console.error(`prefix execution error for ${commandName}:`, err.message);
      message.reply("something went wrong with that prefix command twin.").catch(() => {});
    }
  },
};
