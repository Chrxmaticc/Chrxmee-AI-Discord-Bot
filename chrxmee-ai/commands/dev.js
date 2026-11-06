// commands/dev.js
const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, ActivityType } = require("discord.js");
const { exec } = require("child_process");
const util = require("util");
const fs = require("fs/promises");
const path = require("path");
const os = require("os");

const execAsync = util.promisify(exec);

// ── OWNER ID CHECK ──
// Supports single OWNER_ID or multiple OWNER_IDS
function isOwner(userId) {
  const single = process.env.OWNER_ID;
  const multi = (process.env.OWNER_IDS || "").split(",").map(s => s.trim());
  if (single && userId === single) return true;
  return multi.includes(userId);
}

// Helper to format bytes
function formatBytes(bytes) {
  return (bytes / 1024 / 1024 / 1024).toFixed(2) + " GB";
}

// Helper to send long output
async function sendOutput(interaction, title, text, isError = false) {
  const cleanText = String(text || "No output").trim();
  
  if (cleanText.length > 1900) {
    const buffer = Buffer.from(cleanText, "utf-8");
    const attachment = new AttachmentBuilder(buffer, { name: "output.txt" });
    return interaction.editReply({ 
      content: isError ? `❌ **${title}** (too long, attached)` : `✅ **${title}** (too long, attached)`, 
      files: [attachment] 
    });
  }

  const embed = new EmbedBuilder()
    .setColor(isError ? 0xff4444 : 0x57F287)
    .setTitle(title)
    .setDescription(`\`\`\`\n${cleanText}\n\`\`\``)
    .setFooter({ text: "chromed god mode" });

  return interaction.editReply({ embeds: [embed] });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("dev")
    .setDescription("bot owner only god mode")
    .setDMPermission(false)
    .addSubcommand((s) =>
      s.setName("shell").setDescription("execute a shell command")
        .addStringOption((o) => o.setName("command").setDescription("the command to run").setRequired(true))
    )
    .addSubcommand((s) =>
      s.setName("eval").setDescription("evaluate raw javascript")
        .addStringOption((o) => o.setName("code").setDescription("js code to run").setRequired(true))
    )
    .addSubcommand((s) =>
      s.setName("sql").setDescription("run a raw postgres query")
        .addStringOption((o) => o.setName("query").setDescription("SQL query").setRequired(true))
    )
    .addSubcommand((s) =>
      s.setName("file").setDescription("read, write, or list files")
        .addStringOption((o) => o.setName("action").setDescription("read, write, or list").setRequired(true)
          .addChoices(
            { name: "read", value: "read" },
            { name: "write", value: "write" },
            { name: "delete", value: "delete" },
            { name: "list", value: "list" }
          ))
        .addStringOption((o) => o.setName("path").setDescription("file or directory path").setRequired(true))
        .addStringOption((o) => o.setName("content").setDescription("content to write (required for 'write')").setRequired(false))
    )
    .addSubcommand((s) => s.setName("stats").setDescription("view system and bot stats"))
    .addSubcommand((s) =>
      s.setName("reload").setDescription("hot-reload a command without restarting")
        .addStringOption((o) => o.setName("command").setDescription("command name to reload (e.g. 'phone')").setRequired(true))
    )
    .addSubcommand((s) =>
      s.setName("presence").setDescription("change bot status")
        .addStringOption((o) => o.setName("status").setDescription("online, idle, dnd, invisible").setRequired(true)
          .addChoices(
            { name: "online", value: "online" },
            { name: "idle", value: "idle" },
            { name: "dnd", value: "dnd" },
            { name: "invisible", value: "invisible" }
          ))
        .addStringOption((o) => o.setName("text").setDescription("the activity text").setRequired(true))
        .addStringOption((o) => o.setName("type").setDescription("activity type").setRequired(false)
          .addChoices(
            { name: "playing", value: "playing" },
            { name: "watching", value: "watching" },
            { name: "listening", value: "listening" },
            { name: "competing", value: "competing" }
          ))
    )
    .addSubcommand((s) =>
      s.setName("say").setDescription("make chromed say something in a channel")
        .addChannelOption((o) => o.setName("channel").setDescription("where to say it").setRequired(true))
        .addStringOption((o) => o.setName("text").setDescription("what to say").setRequired(true))
    )
    .addSubcommand((s) =>
      s.setName("dm").setDescription("make chromed dm a user")
        .addUserOption((o) => o.setName("user").setDescription("who to dm").setRequired(true))
        .addStringOption((o) => o.setName("text").setDescription("what to say").setRequired(true))
    )
    .addSubcommand((s) => s.setName("shutdown").setDescription("kill the bot process"))
    .addSubcommand((s) => s.setName("restart").setDescription("restart the bot (requires process manager)")),

  async execute(interaction) {
    // ── STRICT OWNER CHECK ──
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({ content: "you are not my owner. fuck off.", ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();
    await interaction.deferReply();

    // 1. SHELL
    if (sub === "shell") {
      const cmd = interaction.options.getString("command");
      try {
        const { stdout, stderr } = await execAsync(cmd, { cwd: path.join(__dirname, ".."), timeout: 15000 });
        if (stderr && !stdout) return sendOutput(interaction, `Shell: ${cmd}`, stderr, true);
        return sendOutput(interaction, `Shell: ${cmd}`, stdout + (stderr ? `\n\nSTDERR:\n${stderr}` : ""));
      } catch (err) {
        return sendOutput(interaction, `Shell Error: ${cmd}`, err.message, true);
      }
    }

    // 2. EVAL
    if (sub === "eval") {
      const code = interaction.options.getString("code");
      try {
        let evaled = await eval(`(async () => { ${code} })()`);
        if (typeof evaled !== "string") evaled = util.inspect(evaled, { depth: 2 });
        return sendOutput(interaction, "Eval Result", evaled);
      } catch (err) {
        return sendOutput(interaction, "Eval Error", err.stack || err.message, true);
      }
    }

    // 3. SQL
    if (sub === "sql") {
      const query = interaction.options.getString("query");
      try {
        const res = await interaction.client.pool.query(query);
        const output = res.rows.length > 0 
          ? JSON.stringify(res.rows, null, 2) 
          : `Query OK. Rows affected: ${res.rowCount}`;
        return sendOutput(interaction, "SQL Result", output);
      } catch (err) {
        return sendOutput(interaction, "SQL Error", err.message, true);
      }
    }

    // 4. FILE SYSTEM
    if (sub === "file") {
      const action = interaction.options.getString("action");
      const content = interaction.options.getString("content");
      const targetPath = path.resolve(path.join(__dirname, ".."), interaction.options.getString("path"));

      try {
        if (action === "list") {
          const files = await fs.readdir(targetPath);
          return sendOutput(interaction, `Directory: ${targetPath}`, files.join("\n") || "Empty directory");
        } 
        if (action === "read") {
          const fileContent = await fs.readFile(targetPath, "utf-8");
          return sendOutput(interaction, `File: ${targetPath}`, fileContent);
        }
        if (action === "write") {
          if (!content) return interaction.editReply("❌ you must provide `content` to write.");
          await fs.writeFile(targetPath, content, "utf-8");
          return sendOutput(interaction, "File Write", `Successfully wrote to ${targetPath}`);
        }
        if (action === "delete") {
          await fs.unlink(targetPath);
          return sendOutput(interaction, "File Delete", `Successfully deleted ${targetPath}`);
        }
      } catch (err) {
        return sendOutput(interaction, "File System Error", err.message, true);
      }
    }

    // 5. STATS
    if (sub === "stats") {
      const uptime = process.uptime();
      const days = Math.floor(uptime / 86400);
      const hours = Math.floor((uptime % 86400) / 3600);
      const mins = Math.floor((uptime % 3600) / 60);
      
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      const cpu = os.loadavg()[0].toFixed(2);

      const embed = new EmbedBuilder()
        .setColor(0x7c7ce0)
        .setTitle("⚙️ System & Bot Stats")
        .addFields(
          { name: "Uptime", value: `${days}d ${hours}h ${mins}m`, inline: true },
          { name: "Ping", value: `${interaction.client.ws.ping}ms`, inline: true },
          { name: "Guilds", value: `${interaction.client.guilds.cache.size}`, inline: true },
          { name: "RAM (System)", value: `${formatBytes(usedMem)} / ${formatBytes(totalMem)}`, inline: true },
          { name: "RAM (Node)", value: `${formatBytes(process.memoryUsage().rss)}`, inline: true },
          { name: "CPU Load (1m)", value: `${cpu}`, inline: true },
          { name: "Node Version", value: process.version, inline: true },
          { name: "Platform", value: os.platform(), inline: true }
        );
      return interaction.editReply({ embeds: [embed] });
    }

    // 6. RELOAD
    if (sub === "reload") {
      const cmdName = interaction.options.getString("command").toLowerCase();
      const cmdPath = path.join(__dirname, `${cmdName}.js`);
      try {
        delete require.cache[require.resolve(cmdPath)];
        const newCmd = require(cmdPath);
        interaction.client.commands.set(newCmd.data.name, newCmd);
        return sendOutput(interaction, "Hot Reload", `Successfully reloaded \`${cmdName}.js\`!`);
      } catch (err) {
        return sendOutput(interaction, "Reload Error", err.message, true);
      }
    }

    // 7. PRESENCE
    if (sub === "presence") {
      const status = interaction.options.getString("status");
      const text = interaction.options.getString("text");
      const type = interaction.options.getString("type") || "playing";
      
      const types = {
        playing: ActivityType.Playing,
        watching: ActivityType.Watching,
        listening: ActivityType.Listening,
        competing: ActivityType.Competing
      };

      interaction.client.user.setPresence({
        status: status,
        activities: [{ name: text, type: types[type] }]
      });
      return sendOutput(interaction, "Presence Updated", `Status: ${status}\nActivity: ${type} ${text}`);
    }

    // 8. SAY
    if (sub === "say") {
      const channel = interaction.options.getChannel("channel");
      const text = interaction.options.getString("text");
      try {
        await channel.send(text);
        return interaction.editReply(`✅ Sent message to ${channel}.`);
      } catch (err) {
        return interaction.editReply(`❌ Failed to send: ${err.message}`);
      }
    }

    // 9. DM
    if (sub === "dm") {
      const user = interaction.options.getUser("user");
      const text = interaction.options.getString("text");
      try {
        await user.send(text);
        return interaction.editReply(`✅ Sent DM to ${user.tag}.`);
      } catch (err) {
        return interaction.editReply(`❌ Failed to DM: ${err.message}`);
      }
    }

    // 10. SHUTDOWN / RESTART
    if (sub === "shutdown") {
      await sendOutput(interaction, "Shutdown", "shutting down chromed. goodbye.");
      process.exit(0);
    }

    if (sub === "restart") {
      await sendOutput(interaction, "Restart", "restarting chromed... (make sure your host auto-restarts, like pm2 or systemd)");
      process.exit(1);
    }
  },
};
