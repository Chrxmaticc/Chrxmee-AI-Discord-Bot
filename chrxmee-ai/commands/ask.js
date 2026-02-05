const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
module.exports = {
  data: new SlashCommandBuilder()
    .setName("ask")
    .setDescription("Ask Chrxmee AI anything!")
    .setContexts([0, 1, 2])
    .setIntegrationTypes([0, 1])
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
    // Brain: Retrieve user data (history + preferred model)
    let userData = interaction.client.memory.get(userId) || { history: [], model: "smart" };
    let history = userData.history || [];
    const modelPreference = userData.model || "smart";

    // PERSONALIZATION ADDITION (only this block added)
    let personalInfo = '';
    if (userData.personal) {
      personalInfo = `User personal info: ${Object.entries(userData.personal).map(([k, v]) => `${k.replace('_', ' ')}: ${v}`).join(', ')}. Use this naturally if relevant to the question.`;
    }

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
    history.push({ role: "user", content: question });
    if (history.length > 10) history = history.slice(-10);
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: models[modelPreference],
          messages: [
            { role: "system", content: `You are Chrxmee AI acting as the '${modelPreference}' personality. If the user says something too wild, dangerous, or inappropriate, start your response with 'WILD_CONTENT_DETECTED'. ${personalInfo}` },
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
      userData.history = history;
      interaction.client.memory.set(userId, userData);
      if (answer.length > 2000) {
        const chunks = answer.match(/[\s\S]{1,1900}/g);
        const replyText = `**Chrxmee AI (Groq - ${modelPreference}):** ${chunks[0]}...`;
        if (isButtonSim) {
          await interaction.followUp(replyText);
        } else {
          await interaction.editReply(replyText);
        }
        for (let i = 1; i < chunks.length; i++) {
          await interaction.followUp(chunks[i]);
        }
      } else {
        const replyText = `**Chrxmee AI (Groq - ${modelPreference}):** ${answer}`;
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