const { EmbedBuilder } = require("discord.js");

module.exports = {
  name: "interactionCreate",
  async execute(interaction) {
    const client = interaction.client;

    if (interaction.user.bot) return;

    if (interaction.isChatInputCommand()) {
      console.log(`Command received: /${interaction.commandName} from ${interaction.user.tag}`);
      const command = client.commands.get(interaction.commandName);
      if (!command) {
        console.log(`Command not found: ${interaction.commandName}`);
        return;
      }
      console.log(`Executing: /${interaction.commandName}`);
      try {
        await command.execute(interaction, client);
      } catch (err) {
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
      if (interaction.customId.startsWith("debate_join_")) return;
      if (!interaction.customId.includes("|")) return;

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

        } else if (action === "save_song") {
          const musicPlayer = client.lavalink.getPlayer(interaction.guild.id);
          if (!musicPlayer?.queue.current) {
            return interaction.reply({ content: "❌ Nothing is playing!", ephemeral: true });
          }
          const track = musicPlayer.queue.current;
          try {
            await interaction.user.send({
              embeds: [
                new EmbedBuilder()
                  .setColor("#5865F2")
                  .setTitle("💾 Saved Song")
                  .setDescription(`**[${track.info.title}](${track.info.uri})**`)
                  .addFields(
                    { name: "Author", value: track.info.author, inline: true },
                    { name: "Duration", value: client.msToTime(track.info.duration), inline: true }
                  )
                  .setThumbnail(track.info.artworkUrl)
                  .setFooter({ text: `Saved from ${interaction.guild.name}` })
                  .setTimestamp()
              ]
            });
            await interaction.reply({ content: "💾 Saved! Check your DMs.", ephemeral: true });
          } catch {
            await interaction.reply({ content: "❌ I couldn't DM you! Make sure your DMs are open.", ephemeral: true });
          }

        } else if (action === "add_to_playlist") {
          await interaction.reply({ content: "📋 Use `/playlist add <name>` to add the current song to a playlist!", ephemeral: true });
        }

      } catch (err) {
        if (err.code === 10062) {
          console.warn("Button interaction expired.");
        } else {
          console.error("Button Error:", err);
        }
      }

    } else if (interaction.isStringSelectMenu()) {
      if (interaction.customId.startsWith("search_select|")) {
        // handled inside search.js collector, ignore here
        return;
      }
    }
  },
};
