const { EmbedBuilder } = require("discord.js");

module.exports = {
  name: "interactionCreate",
  async execute(interaction) {
    const client = interaction.client;

    if (interaction.user.bot) return;

    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;

      try {
        await command.execute(interaction, client);
      } catch (err) {
        console.error(`Error executing ${interaction.commandName}:`, err);
        const errorContent = "there was an error while executing this command.";
        try {
          if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: errorContent }).catch(() => {});
          } else {
            await interaction.reply({ content: errorContent, flags: 64 }).catch(() => {});
          }
        } catch (e) {
          console.error("failed to send error message:", e.message);
        }
      }
      return;
    }

    if (interaction.isButton()) {
      if (interaction.customId.startsWith("debate_join_")) return;
      if (!interaction.customId.includes("|")) return;

      const [action, userId, prompt] = interaction.customId.split("|");
      if (interaction.user.id !== userId) {
        return interaction.reply({ content: "this is not for you!", flags: 64 });
      }

      try {
        if (action === "explain_yes") {
          await interaction.update({ content: "re-explaining in a different way...", components: [] });
          const command = client.commands.get("ask");
          if (command) {
            interaction.options = {
              getString: (name) => name === "question" ? `explain ${prompt} in a different way` : null
            };
            await command.execute(interaction, client);
          }
        } else if (action === "explain_no") {
          await interaction.update({ content: "okay, i won't explain it.", components: [] });
        }
      } catch (err) {
        console.error("button error:", err);
      }
      return;
    }

    if (interaction.isStringSelectMenu()) {
      if (interaction.customId.startsWith("search_select|")) return;
    }
  },
};
