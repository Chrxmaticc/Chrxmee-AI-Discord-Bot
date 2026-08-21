const fs = require("fs");
const path = require("path");

const E = {
  success: "<:Verified_Icon:1527194184841167010>",
  error: "<:no:1530373946795364362>",
  ai: "<:Chrxmaticc_AI:1480094799292928132>",
  agree: "<:agreed:1525639597135237131>",
};
const APPEAL_LINK = "https://discord.gg/rTrJyPyayg";

module.exports = {
  name: "messageCreate",
  async execute(message) {
    if (message.author.bot) return;

    const client = message.client;
    const pool = client.pool;

    // ─── GET PREFIX FIRST ───
    let prefix = "!";
    if (message.guild) {
      try {
        const res = await pool.query(`SELECT prefix FROM guild_settings WHERE guild_id = $1`, [message.guildId]);
        if (res.rows[0]?.prefix) prefix = res.rows[0].prefix;
      } catch {}
    }

    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift()?.toLowerCase();
    if (!commandName) return;

    const userId = message.author.id;
    const guildId = message.guildId;

    // ─── WHITELIST / BLACKLIST CHECK ───
    try {
      const userWl = await pool.query(`SELECT 1 FROM user_whitelist WHERE user_id = $1`, [userId]);
      const isUserWhitelisted = userWl.rows.length > 0;
      let isServerWhitelisted = false;
      if (guildId) {
        const serverWl = await pool.query(`SELECT 1 FROM server_whitelist WHERE guild_id = $1`, [guildId]);
        isServerWhitelisted = serverWl.rows.length > 0;
      }

      const isFullyWhitelisted = isUserWhitelisted && (guildId ? isServerWhitelisted : true);

      if (!isFullyWhitelisted) {
        if (!isUserWhitelisted) {
          const userBl = await pool.query(`SELECT reason FROM user_blacklist WHERE user_id = $1`, [userId]);
          if (userBl.rows[0]) {
            const reason = userBl.rows[0].reason || "no reason provided";
            return message.reply(`${E.error} yeah you can’t access this command, WELL FOLLOW THE RULES BUDDY. heres the reason, appeal in ${APPEAL_LINK} if you think this is false. reason: ${reason}`).catch(() => {});
          }
        }
        if (guildId && !isServerWhitelisted) {
          const serverBl = await pool.query(`SELECT reason FROM server_blacklist WHERE guild_id = $1`, [guildId]);
          if (serverBl.rows[0]) {
            const reason = serverBl.rows[0].reason || "no reason provided";
            return message.reply(`${E.error} this server is blacklisted. reason: ${reason}. appeal at ${APPEAL_LINK}`).catch(() => {});
          }
        }
      }
    } catch (err) {
      console.error("blacklist/whitelist check in prefix failed:", err.message);
    }

    if (commandName === "ping") return message.reply(`${E.agree} pong!`);
    if (commandName === "id") return message.reply(`${E.ai} client id: ${client.user.id}\ntag: ${client.user.tag}`);

    if (commandName === "deploy") {
      const allowedOwners = [process.env.OWNER_ID, process.env.OWNER_ID2].filter(Boolean);
      if (!allowedOwners.includes(message.author.id)) return message.reply(`${E.error} owner only.`);

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
              console.warn(`⚠️ duplicate command name skipped: ${command.data.name} (from ${file})`);
              continue;
            }
            seen.add(name);
            commands.push(command.data.toJSON());
          }
        } catch (e) {
          console.error(`skipped ${file}: ${e.message}`);
        }
      }

      const rest = new REST({ version: "10" }).setToken(process.env.BOT_TOKEN);
      try {
        const registered = await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        return message.reply(`${E.success} registered **${registered.length}** slash commands.${duplicates.length ? ` (skipped duplicates: ${duplicates.join(", ")})` : ""}`);
      } catch (err) {
        return message.reply(`${E.error} registration failed: ${err.message}`);
      }
    }

    // Universal handler
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

    // ─── COMMAND ACCESS CHECK ───
    if (message.guild) {
      try {
        const defRes = await pool.query(`SELECT cmd_default_mode FROM guild_settings WHERE guild_id = $1`, [message.guildId]);
        const defaultMode = defRes.rows[0]?.cmd_default_mode || "allow_all";

        const rules = await pool.query(
          `SELECT target_type, target_id, access, reason FROM cmd_access
           WHERE guild_id = $1 AND (command_name = $2 OR command_name = 'all')`,
          [message.guildId, commandName]
        );

        let allowed = defaultMode === "allow_all";
        let denialReason = null;

        for (const rule of rules.rows) {
          const isMatch = rule.target_type === "user"
            ? rule.target_id === message.author.id
            : message.member?.roles.cache.has(rule.target_id);
          if (!isMatch) continue;
          if (rule.access === "deny") {
            allowed = false;
            denialReason = rule.reason || null;
            break;
          } else if (rule.access === "allow") {
            allowed = true;
            denialReason = null;
          }
        }
        if (!allowed) {
          const errorMsg = denialReason
            ? `${E.error} ${denialReason}`
            : `${E.error} you don't have permission to use this command in this server.`;
          return message.reply(errorMsg).catch(() => {});
        }
      } catch (err) {
        console.error("command access check failed:", err.message);
      }
    }

    // Fake interaction
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
        if (options && options.embeds && options.content) return message.reply({ content: options.content, embeds: options.embeds });
        return message.reply(`${E.error} done.`);
      },
      followUp: async (options) => {
        if (typeof options === "string") return message.channel.send(options);
        if (options && options.embeds) return message.channel.send({ embeds: options.embeds });
        if (options && options.content) return message.channel.send(options.content);
        if (options && options.embeds && options.content) return message.channel.send({ content: options.content, embeds: options.embeds });
        return message.channel.send(`${E.error} done.`);
      },
      editReply: async (options) => {
        if (typeof options === "string") return message.reply(options);
        if (options && options.embeds) return message.reply({ embeds: options.embeds });
        if (options && options.content) return message.reply(options.content);
        if (options && options.embeds && options.content) return message.reply({ content: options.content, embeds: options.embeds });
        return message.reply(`${E.error} done.`);
      },
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
      message.reply(`${E.error} something went wrong with that prefix command.`).catch(() => {});
    }
  },
};
