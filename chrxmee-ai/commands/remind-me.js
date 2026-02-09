const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("remind-me")
    .setDescription("Set a reminder for yourself")
    .addStringOption(option => option.setName("time").setDescription("Time (e.g., 5m, 1h)").setRequired(true))
    .addStringOption(option => option.setName("task").setDescription("What to remind you about").setRequired(true)),
  async execute(interaction) {
    const timeStr = interaction.options.getString("time");
    const task = interaction.options.getString("task");
    
    const timeMatch = timeStr.match(/^(\d+)([smh])$/);
    if (!timeMatch) return interaction.reply({ content: "Invalid time format! Use something like `5m` or `1h`.", ephemeral: true });
    
    const amount = parseInt(timeMatch[1]);
    const unit = timeMatch[2];
    const ms = unit === 's' ? amount * 1000 : unit === 'm' ? amount * 60000 : amount * 3600000;

    await interaction.reply({ content: `Got it! I'll remind you about "${task}" in ${timeStr}. ⏰`, ephemeral: true });

    setTimeout(() => {
      interaction.user.send(`🔔 **Reminder:** ${task}`).catch(() => {
        interaction.channel.send(`${interaction.user}, I couldn't DM you, but here's your reminder: **${task}**`);
      });
    }, ms);
  },
};
