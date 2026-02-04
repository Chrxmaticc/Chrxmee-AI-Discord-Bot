const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("debate-topic")
    .setDescription("Get a controversial topic idea for a debate")
    .setContexts([0, 1, 2])
    .setIntegrationTypes([0, 1]),
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
            { role: "system", content: "You are a creative debate moderator. Provide one highly interesting and slightly controversial debate topic. Keep it under 200 characters." },
            { role: "user", content: "Give me a debate topic." }
          ],
          temperature: 0.9,
        }),
      });

      const data = await response.json();
      const topic = data.choices?.[0]?.message?.content || "Is cereal a soup?";
      
      await interaction.editReply(`💡 **Debate Idea:**\n\n"${topic}"\n\nUse \`/debate\` to start the fight!`);
    } catch (err) {
      await interaction.editReply("Couldn't think of a topic right now.");
    }
  },
};
