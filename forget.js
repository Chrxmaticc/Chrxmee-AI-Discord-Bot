const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("forgetpersonal")
    .setDescription(
      "Make Chrxmee AI forget only your personal info (name, age, etc.)",
    ),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const userId = interaction.user.id;

    const userData = interaction.client.memory.get(userId);

    if (userData && userData.personal) {
      delete userData.personal;
      interaction.client.memory.set(userId, userData);
      await interaction.editReply(
        "Poof — your personal info is forgotten! (History and model preference still intact)",
      );
    } else {
      await interaction.editReply(
        "I didn't have any personal info about you to forget!",
      );
    }
  },
};
