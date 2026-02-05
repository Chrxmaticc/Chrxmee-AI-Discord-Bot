const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("auto-respond")
    .setDescription("Configure Chrxmee AI to auto-respond in this channel")
    .addStringOption(option =>
      option.setName("option")
        .setDescription("Choose an auto-respond setting")
        .setRequired(true)
        .addChoices(
          { name: "Yes, auto-respond every message", value: "yes" },
          { name: "Make a channel that auto-responds automatically", value: "create" },
          { name: "No", value: "no" }
        )),
  async execute(interaction) {
    const choice = interaction.options.getString("option");
    const userId = interaction.user.id;
    const channel = interaction.channel;

    if (choice === "no") {
      let userData = interaction.client.memory.get(userId) || { history: [], model: "smart" };
      if (userData.inChat && userData.chatChannelId === channel.id) {
        userData.inChat = false;
        interaction.client.memory.set(userId, userData);
        return interaction.reply("✅ Auto-respond disabled for you in this channel.");
      }
      return interaction.reply("Auto-respond was not active.");
    }

    if (choice === "yes") {
      let userData = interaction.client.memory.get(userId) || { history: [], model: "smart" };
      userData.inChat = true;
      userData.chatChannelId = channel.id;
      userData.chatMode = "solo";
      userData.lastActivity = Date.now();
      interaction.client.memory.set(userId, userData);
      return interaction.reply("✅ **Auto-respond enabled!** I will now reply to every message you send in this channel. Say 'stop' to disable.");
    }

    if (choice === "create") {
      if (!interaction.guild) return interaction.reply("This option is only available in servers.");
      
      // RESTRICTION: Only moderators/owners can create the auto-respond channel
      const isModerator = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels) || 
                          interaction.member.permissions.has(PermissionFlagsBits.Administrator) ||
                          interaction.guild.ownerId === userId;

      if (!isModerator) {
        return interaction.reply("❌ Only server moderators or the owner can create a dedicated auto-respond channel.");
      }

      try {
        const newChannel = await interaction.guild.channels.create({
          name: "chrxmee-ai-chat",
          type: ChannelType.GuildText,
          topic: "Automatic AI Chat Channel"
        });

        let userData = interaction.client.memory.get(userId) || { history: [], model: "smart" };
        userData.inChat = true;
        userData.chatChannelId = newChannel.id;
        userData.chatMode = "group"; 
        userData.lastActivity = Date.now();
        interaction.client.memory.set(userId, userData);

        return interaction.reply(`✅ Created ${newChannel}! I will automatically respond to everyone in that channel.`);
      } catch (err) {
        console.error(err);
        return interaction.reply("Failed to create the channel. Check my permissions!");
      }
    }
  },
};
