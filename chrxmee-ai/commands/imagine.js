const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("imagine")
    .setDescription("Generate a visual description for an AI image generator")
    .addStringOption(option =>
      option.setName("prompt")
        .setDescription("What do you want to imagine?")
        .setRequired(true))
    .setContexts([0, 1, 2])
    .setIntegrationTypes([0, 1]),
  async execute(interaction) {
    await interaction.deferReply();
    const prompt = interaction.options.getString("prompt");

    try {
      const starterData = interaction.client.memory.get(interaction.user.id) || { model: "smart" };
      const userModel = starterData.model || "smart";

      const models = {
        smart: "llama-3.3-70b-versatile",
        fast: "llama-3.1-8b-instant",
        thinker: "deepseek-r1-distill-llama-70b",
        creative: "llama-3.3-70b-versatile",
        efficient: "llama-3.1-8b-instant",
        visionary: "llama-3.3-70b-versatile",
        analyst: "llama-3.1-8b-instant",
        classic: "llama-3.3-70b-versatile"
      };

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: models[userModel] || models.smart,
          messages: [
            { role: "system", content: "You are an expert AI image prompt engineer. Create a highly detailed, cinematic, and professional image generation prompt based on the user's idea. KEEP YOUR RESPONSE UNDER 1800 CHARACTERS." },
            { role: "user", content: `Create a detailed image prompt for: ${prompt}` }
          ],
        }),
      });

      const data = await response.json();
      
      if (!data.choices || !data.choices[0]) {
        console.error("Imagine API Error Response:", JSON.stringify(data));
        throw new Error(data.error?.message || "Invalid API response from Groq");
      }

      let result = data.choices[0].message.content;

      if (result.length > 1900) {
        result = result.substring(0, 1900) + "... (truncated)";
      }

      await interaction.editReply(`🎨 **Image Concept Generated:**\n\n${result}`);
    } catch (err) {
      console.error("Imagine Error:", err);
      await interaction.editReply("Sorry, I couldn't imagine that right now.");
    }
  },
};
