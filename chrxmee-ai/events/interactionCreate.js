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
        // Handle common interaction errors gracefully
        if (err.code === 10062 || err.code === 40060) {
          console.warn(`Interaction for ${interaction.commandName} expired before response.`);
          return;
        }

        console.error(`Error executing ${interaction.commandName}:`, err);
        const errorContent = "There was an error while executing this command! Please try again in a moment.";
        
        try {
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: errorContent, flags: [64] }).catch(() => {});
          } else {
            await interaction.reply({ content: errorContent, flags: [64] }).catch(() => {});
          }
        } catch (e) {
          console.error("Failed to send error message:", e.message);
        }
      }
    } else if (interaction.isButton()) {
      const [action, userId, prompt] = interaction.customId.split("|");
      if (interaction.user.id !== userId) {
        return interaction.reply({ content: "This is not for you!", flags: [64] });
      }

      try {
        if (action === "explain_yes") {
          await interaction.update({ content: "Re-explaining in a different way...", components: [] });
          const command = client.commands.get("ask");
          if (command) {
            interaction.options = {
              getString: (name) => name === "question" ? `Explain ${prompt} in a different way` : null
            };
            await command.execute(interaction);
          }
        } else if (action === "explain_no") {
          await interaction.update({ content: "Okay, I won't explain it.", components: [] });
        }
      } catch (err) {
        if (err.code === 10062) {
          console.warn("Button interaction expired.");
        } else {
          console.error("Button Error:", err);
        }
      }
    }
  },
};