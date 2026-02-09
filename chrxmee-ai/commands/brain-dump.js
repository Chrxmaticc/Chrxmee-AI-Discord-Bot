const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("brain-dump")
    .setDescription("Get a summary of everything I know about you from our conversations"),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const userId = interaction.user.id;
    const userData = interaction.client.memory.get(userId) || { history: [], personal: {} };

    let summary = "**🧠 Memory Analysis:**\n\n";
    
    if (userData.personal && Object.keys(userData.personal).length > 0) {
      summary += "**Known Facts:**\n" + Object.entries(userData.personal)
        .map(([k, v]) => `• ${k.replace('_', ' ')}: ${v}`)
        .join('\n') + "\n\n";
    } else {
      summary += "I don't have any specific personal info saved yet. (Use `/setpersonal` to teach me!)\n\n";
    }

    const interactionCount = userData.history ? userData.history.filter(m => m.role === 'user').length : 0;
    summary += `**Recent Context:** I'm holding onto ${interactionCount} recent exchanges in my active memory.`;

    await interaction.editReply(summary);
  },
};
