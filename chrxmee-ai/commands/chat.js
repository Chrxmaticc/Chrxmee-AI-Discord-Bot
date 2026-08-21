const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("chat")
    .setDescription("Start or continue a continuous conversation session")
    .addStringOption(option =>
      option.setName("mode")
        .setDescription("choose between solo or group mode to chat to me.")
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
    
    const modeText = mode === "solo" ? "hey, ur in solo mode so ima ONLY respond to YOU, AND YOU ONLY." : "hey, we all talking as a group (anybody in this channel gets replied to!)";
    await interaction.reply(`WEEE BOUTTA CHATTTTT, also heres your chat mode.\n${modeText}\njust type normally to respond to me, mentions and replies also work twin!.\nif no one talks for 3 mins, the session cancels!.`);
  },
};
