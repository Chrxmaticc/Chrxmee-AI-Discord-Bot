const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("history")
    .setDescription("View a summary of your current conversation history")
    .setContexts([0, 1, 2])
    .setIntegrationTypes([0, 1]),
  async execute(interaction) {
    const userId = interaction.user.id;
    const userData = interaction.client.memory.get(userId);

    if (!userData || userData.history.length === 0) {
      return interaction.reply({ content: "📜 Your conversation history is empty.", flags: [64] });
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle("📜 Conversation History Summary")
      .setDescription(`Showing last ${userData.history.length} messages in your brain:`)
      .setTimestamp();

    const historyText = userData.history.map((m, i) => `**${i + 1}. ${m.role.toUpperCase()}**: ${m.content.substring(0, 100)}${m.content.length > 100 ? '...' : ''}`).join("\n");
    
    embed.addFields({ name: "Recent Messages", value: historyText.substring(0, 1024) });

    await interaction.reply({ embeds: [embed], flags: [64] });
  },
};
