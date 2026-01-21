const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("reminder")
    .setDescription("Set an AI-powered reminder")
    .addStringOption(option =>
      option.setName("time")
        .setDescription("When should I remind you? (e.g., 'in 5 minutes', 'at 5pm')")
        .setRequired(true))
    .addStringOption(option =>
      option.setName("message")
        .setDescription("What should I remind you about?")
        .setRequired(true))
    .setContexts([0, 1, 2])
    .setIntegrationTypes([0, 1]),
  async execute(interaction) {
    const timeStr = interaction.options.getString("time");
    const task = interaction.options.getString("message");
    
    // Simple parser for common relative times
    let delay = 0;
    const minutesMatch = timeStr.match(/(\d+)\s*min/);
    const hoursMatch = timeStr.match(/(\d+)\s*hour/);
    
    if (minutesMatch) delay = parseInt(minutesMatch[1]) * 60000;
    else if (hoursMatch) delay = parseInt(hoursMatch[1]) * 3600000;
    else delay = 60000; // Default to 1 min if unparseable

    await interaction.reply({ content: `⏰ Got it! I'll remind you about "${task}" in approximately ${timeStr}.`, flags: [64] });

    setTimeout(async () => {
      try {
        await interaction.user.send(`🔔 **REMINDER:** ${task}`);
      } catch (e) {
        console.error("Could not send DM reminder:", e);
      }
    }, delay);
  },
};
