const { SlashCommandBuilder, InteractionContextType, ApplicationIntegrationType } = require("discord.js");

// ─── CUSTOM EMOJIS ──────────────────────────────
const E = {
  success: "<:Verified_Icon:1527194184841167010>",
  error: "<:no:1530373946795364362>",
  ai: "<:Chrxmaticc_AI:1480094799292928132>",
  agree: "<:agreed:1525639597135237131>",
  angry: "<:angry_cry:1526029511882440744>",
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("chat")
    .setDescription("start or continue a continuous conversation session")
    .addStringOption(option =>
      option.setName("mode")
        .setDescription("choose between solo or group mode to chat to me.")
        .setRequired(true)
        .addChoices(
          { name: "Solo (Only responds to you)", value: "solo" },
          { name: "Group (Responds to everyone in the channel)", value: "group" }
        ))
    .setContexts([InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel])
    .setIntegrationTypes([ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall]),

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

    const modeText = mode === "solo"
      ? `${E.agree} hey, ur in solo mode so ima ONLY respond to YOU, AND YOU ONLY.`
      : `${E.agree} hey, we all talking as a group (anybody in this channel gets replied to!)`;

    await interaction.reply(
      `${E.ai} **WEEE BOUTTA CHATTTTT**\n${modeText}\n` +
      `just type normally to respond to me, mentions and replies also work twin!\n` +
      `if no one talks for 3 mins, the session cancels!`
    );
  },
};
