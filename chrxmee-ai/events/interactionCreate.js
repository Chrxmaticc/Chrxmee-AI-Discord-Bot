module.exports = {
  name: "interactionCreate",
  async execute(interaction) {
    const client = interaction.client;
    
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;

      try {
        await command.execute(interaction);
      } catch (err) {
        console.error(`Error executing ${interaction.commandName}:`, err);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: "Error executing command!",
            ephemeral: true,
          });
        }
      }
    } else if (interaction.isButton()) {
      const [action, userId, prompt] = interaction.customId.split("|");
      if (interaction.user.id !== userId) {
        return interaction.reply({ content: "This is not for you!", ephemeral: true });
      }

      if (action === "explain_yes") {
        await interaction.update({ content: "Re-explaining in a different way...", components: [] });
        const command = client.commands.get("ask");
        if (command) {
          // Mocking options for the re-execution
          interaction.options = {
            getString: (name) => name === "question" ? `Explain ${prompt} in a different way` : null
          };
          await command.execute(interaction);
        }
      } else if (action === "explain_no") {
        await interaction.update({ content: "Okay, I won't explain it.", components: [] });
      }
    }
  },
};