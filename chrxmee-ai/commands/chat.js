const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("chat")
    .setDescription("Start or continue a continuous conversation session")
    .addStringOption(option =>
      option.setName("mode")
        .setDescription("Choose between Solo or Group mode")
        .setRequired(true)
        .addChoices(
          { name: "Solo (Only responds to you)", value: "solo" },
          { name: "Group (Responds to everyone in the channel)", value: "group" }
        ))
    .setContexts([0, 1, 2])
    .setIntegrationTypes([0, 1]),
  async execute(interaction) {
    const userId = interaction.user.id;
    const client = interaction.client;
    const mode = interaction.options.getString("mode");
    const channelId = interaction.channelId;
    
    let userData = client.memory.get(userId) || { history: [], model: "smart", inChat: false };
    userData.inChat = true;
    userData.chatMode = mode;
    userData.chatChannelId = channelId;
    userData.lastActivity = Date.now();
    client.memory.set(userId, userData);
    
    const modeText = mode === "solo" ? "👤 **Solo Mode** (I will only respond to you)" : "👥 **Group Mode** (I will respond to everyone here)";
    await interaction.reply(`💬 **Continuous Conversation Active!**\n${modeText}\nJust type messages normally. Say 'stop' to end.\nSession will timeout after 3 minutes of inactivity.`);
  },
};