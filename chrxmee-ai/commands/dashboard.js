const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const fs = require("fs");
const path = require("path");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("dashboard")
    .setDescription("Owner only: View recent chat sessions")
    .setContexts([0, 1, 2])
    .setIntegrationTypes([0, 1]),
  async execute(interaction) {
    const ownerId = process.env.OWNER_ID;
    
    // Strict owner check using secret
    if (interaction.user.id !== ownerId) {
      return interaction.reply({ content: "This command is for the bot owner only!", flags: [64] });
    }

    const logDir = path.join(__dirname, "../conversations");
    if (!fs.existsSync(logDir)) {
      return interaction.reply({ content: "No recent chat logs found.", flags: [64] });
    }

    const files = fs.readdirSync(logDir)
      .filter(f => f.endsWith(".json"))
      .sort((a, b) => fs.statSync(path.join(logDir, b)).mtimeMs - fs.statSync(path.join(logDir, a)).mtimeMs)
      .slice(0, 5);

    if (files.length === 0) {
      return interaction.reply({ content: "No recent chat logs found.", flags: [64] });
    }

    const embed = new EmbedBuilder()
      .setColor(0x00AAFF)
      .setTitle("🛡️ Chrxmee AI - Recent Chats Dashboard")
      .setDescription("Showing the 5 most recent conversation sessions:")
      .setTimestamp();

    for (const file of files) {
      const filePath = path.join(logDir, file);
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      const userId = file.split("_")[0];
      const date = new Date(parseInt(file.split("_")[1])).toLocaleString();
      
      const snippet = data.slice(-2).map(m => `**${m.role}**: ${m.content.substring(0, 50)}...`).join("\n") || "No messages";
      embed.addFields({ name: `User ID: ${userId} (${date})`, value: snippet });
    }

    await interaction.reply({ embeds: [embed], flags: [64] });
  },
};
