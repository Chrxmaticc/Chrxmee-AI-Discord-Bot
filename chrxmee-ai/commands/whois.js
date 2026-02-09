const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("server-persence-generate")
    .setDescription("AI research on a user (or yourself) based on server presence")
    .addUserOption(option => option.setName("target").setDescription("The user to research")),
  async execute(interaction) {
    await interaction.deferReply();
    const target = interaction.options.getUser("target") || interaction.user;
    
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: "You are an Elite Investigator AI. Based on the username and the fact that they are in this Discord server, generate a 'cool investigator profile' for them. Be creative, slightly mysterious, and hype them up. Use emojis." },
            { role: "user", content: `Generate a profile for: ${target.username}` }
          ],
          temperature: 0.8,
        }),
      });

      const data = await response.json();
      const profile = data.choices[0].message.content;

      const embed = new EmbedBuilder()
        .setColor(0xFF00FF)
        .setTitle(`🔍 Intelligence File: ${target.username}`)
        .setDescription(profile)
        .setThumbnail(target.displayAvatarURL())
        .setFooter({ text: "Profile generated via Neural Network Analysis." });

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error(err);
      await interaction.editReply("Investigation failed. The target is too well hidden! Maybe stop being so sneaky?");
    }
  },
};
