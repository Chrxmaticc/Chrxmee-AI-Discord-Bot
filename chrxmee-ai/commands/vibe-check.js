const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("vibe-check")
    .setDescription("AI analyzes the current 'vibe' of the channel based on recent messages"),
  async execute(interaction) {
    await interaction.deferReply();
    
    try {
      const messages = await interaction.channel.messages.fetch({ limit: 10 });
      const context = messages.map(m => `${m.author.username}: ${m.content}`).join('\n');

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [
            { role: "system", content: "You are a 'Vibe Specialist'. Analyze the provided chat snippet and describe the current 'vibe' of the channel in a cool, modern, and slightly humorous way. Use emojis." },
            { role: "user", content: `Analyze this vibe:\n${context}` }
          ],
          temperature: 0.8,
        }),
      });

      const data = await response.json();
      const vibe = data.choices[0].message.content;

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("✨ Channel Vibe Check")
        .setDescription(vibe)
        .setFooter({ text: "Vibe Analysis complete. ❄️" });

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error(err);
      await interaction.editReply("The vibe is unreadable right now. Too much static!");
    }
  },
};
