const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ask")
    .setDescription("Ask Chrxmee AI anything!")
    .addStringOption((option) =>
      option
        .setName("question")
        .setDescription("Your question")
        .setRequired(true)
    ),
  async execute(interaction) {
    // Check if it's an interaction or a simulated interaction from button
    const isButtonSim = interaction.isButton && interaction.isButton();
    if (!isButtonSim) await interaction.deferReply();

    const question = interaction.options.getString("question");
    const userId = interaction.user.id;

    // Brain: Retrieve conversation history
    let history = interaction.client.memory.get(userId) || [];
    history.push({ role: "user", content: question });

    // Limit history to last 10 messages
    if (history.length > 10) history = history.slice(-10);

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
            { role: "system", content: "You are Chrxmee AI. If the user says something too wild, dangerous, or inappropriate, start your response with 'WILD_CONTENT_DETECTED'." },
            ...history
          ],
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `API error ${response.status}`;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error?.message || errorText;
        } catch (e) {
          errorMessage = errorText;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      if (!data.choices || data.choices.length === 0) {
        throw new Error("No response from AI.");
      }
      const answer = data.choices[0].message.content;

      // Check for "wild" content
      if (answer.includes("WILD_CONTENT_DETECTED")) {
        const row = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(`explain_yes|${userId}|${question.substring(0, 50)}`)
              .setLabel('Yes')
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId(`explain_no|${userId}|${question.substring(0, 50)}`)
              .setLabel('No')
              .setStyle(ButtonStyle.Danger),
          );

        const replyOptions = {
          content: "Okay, too wild but I can explain it in a different way. Would you like me to?",
          components: [row]
        };

        if (isButtonSim) {
          await interaction.followUp(replyOptions);
        } else {
          await interaction.editReply(replyOptions);
        }
        return;
      }

      // Update brain with AI response
      history.push({ role: "assistant", content: answer });
      interaction.client.memory.set(userId, history);

      if (answer.length > 2000) {
        const chunks = answer.match(/[\s\S]{1,1900}/g);
        const replyText = `**Chrxmee AI (Groq):** ${chunks[0]}...`;
        if (isButtonSim) {
          await interaction.followUp(replyText);
        } else {
          await interaction.editReply(replyText);
        }
        for (let i = 1; i < chunks.length; i++) {
          await interaction.followUp(chunks[i]);
        }
      } else {
        const replyText = `**Chrxmee AI (Groq):** ${answer}`;
        if (isButtonSim) {
          await interaction.followUp(replyText);
        } else {
          await interaction.editReply(replyText);
        }
      }
    } catch (err) {
      console.error(`Ask command error: ${err.message}`);
      const errorText = `Failed to reach Chrxmee AI (Groq): ${err.message.substring(0, 100)}`;
      if (isButtonSim) {
        await interaction.followUp(errorText);
      } else {
        await interaction.editReply(errorText);
      }
    }
  },
};
