const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("oracle")
    .setDescription("The mystical AI Oracle foretells your future")
    .addStringOption(option =>
      option.setName("topic")
        .setDescription("What do you seek guidance on? (e.g., love, career, luck)")
        .setRequired(true))
    .setContexts([0, 1, 2])
    .setIntegrationTypes([0, 1]),
  async execute(interaction) {
    await interaction.deferReply();
    const topic = interaction.options.getString("topic");

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
            { role: "system", content: "You are the Mystical Oracle of Chrxmee. You speak in poetic, mysterious, yet insightful riddles and prophecies. Use emojis like 🔮✨🌙." },
            { role: "user", content: `What is my future regarding: ${topic}?` }
          ],
        }),
      });

      const data = await response.json();
      const prophecy = data.choices[0].message.content;

      const embed = new EmbedBuilder()
        .setColor(0x9B59B6)
        .setTitle("🔮 The Oracle Has Spoken")
        .setDescription(prophecy)
        .setFooter({ text: `Seeker: ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error("Oracle Error:", err);
      await interaction.editReply("The mists of time are too thick to see through right now...");
    }
  },
};
