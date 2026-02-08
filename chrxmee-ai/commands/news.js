const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("news")
    .setDescription("Get the latest AI-generated tech and bot news summaries"),
  async execute(interaction) {
    await interaction.deferReply();

    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [
            { role: "system", content: "You are a tech news anchor. Generate 3 fictional but plausible and exciting 'breaking news' headlines about AI, Discord bots, and the future of Chrxmee AI." },
            { role: "user", content: "What's the latest in the AI world?" }
          ],
          temperature: 0.8,
        }),
      });

      const data = await response.json();
      const news = data.choices[0].message.content;

      const embed = new EmbedBuilder()
        .setColor(0x00FFFF)
        .setTitle("🌐 Chrxmee News Network")
        .setDescription(news)
        .setTimestamp()
        .setFooter({ text: "LIVE from the Snow Kingdom ❄️" });

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error(err);
      await interaction.editReply("News signal lost. Check back later!");
    }
  },
};
