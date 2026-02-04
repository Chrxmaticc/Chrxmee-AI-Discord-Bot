const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check the bot's latency")
    .setContexts([0, 1, 2])
    .setIntegrationTypes([0, 1]),
  async execute(interaction) {
    const sent = await interaction.reply({ content: 'Pinging...', fetchReply: true, flags: [64] });
    interaction.editReply(`📡 **Pong!**\nLatency: \`${sent.createdTimestamp - interaction.createdTimestamp}ms\`\nAPI Latency: \`${Math.round(interaction.client.ws.ping)}ms\``);
  },
};
