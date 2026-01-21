const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("feedback")
    .setDescription("Send feedback directly to Chrxmee (the creator)")
    .addStringOption(option =>
      option.setName("message")
        .setDescription("What would you like to tell the creator?")
        .setRequired(true))
    .setContexts([0, 1, 2])
    .setIntegrationTypes([0, 1]),
  async execute(interaction) {
    const feedback = interaction.options.getString("message");
    const ownerId = process.env.OWNER_ID;

    if (!ownerId) {
      return interaction.reply({ content: "The owner hasn't set up their ID yet! I can't send feedback right now.", flags: [64] });
    }

    try {
      const owner = await interaction.client.users.fetch(ownerId);
      await owner.send(`📩 **New Feedback Received!**\n**From:** ${interaction.user.tag} (${interaction.user.id})\n**Message:** ${feedback}`);
      
      await interaction.reply({ content: "✅ Your feedback has been sent directly to my creator! Thank you for helping me improve.", flags: [64] });
    } catch (err) {
      console.error("Feedback DM Error:", err);
      await interaction.reply({ content: "❌ I couldn't send the feedback. My creator might have DMs disabled or the ID is incorrect.", flags: [64] });
    }
  },
};
