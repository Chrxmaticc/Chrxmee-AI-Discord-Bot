const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { buildSystemPrompt, MODELS, DEFAULT_MODEL, DEFAULT_MODE } = require("../events/messageCreate");

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
    const isButtonSim = interaction.isButton && interaction.isButton();
    if (!isButtonSim) await interaction.deferReply();

    const question = interaction.options.getString("question");
    const userId = interaction.user.id;

    // Initialize user data with mode
    let userData = interaction.client.memory.get(userId) || {
      history: [],
      model: DEFAULT_MODEL,
      mode: DEFAULT_MODE,
    };
    let history = userData.history || [];
    const modelPreference = userData.model || DEFAULT_MODEL;
    const modePreference = userData.mode || DEFAULT_MODE;
    const modelEntry = MODELS[modelPreference] || MODELS[DEFAULT_MODEL];

    let customPrompt = userData.customPrompt || "";
    let personalInfo = "";

    if (!userData.customPrompt && !userData.personal) {
      const { Client } = require("pg");
      const db = new Client({ connectionString: process.env.DATABASE_URL });
      try {
        await db.connect();
        const [customRes, personalRes, modeRes] = await Promise.all([
          db.query("SELECT custom_prompt, preferred_model FROM user_interactions WHERE user_id = $1", [userId]),
          db.query("SELECT personal_info FROM user_personal_info WHERE user_id = $1", [userId]),
          db.query("SELECT preferred_mode FROM mode_interactions WHERE user_id = $1", [userId])
        ]);
        if (customRes.rows[0]) {
          customPrompt = customRes.rows[0].custom_prompt || "";
          userData.customPrompt = customPrompt;
          if (customRes.rows[0].preferred_model) {
            userData.model = customRes.rows[0].preferred_model;
          }
        }
        if (personalRes.rows[0]?.personal_info) {
          try { userData.personal = JSON.parse(personalRes.rows[0].personal_info); }
          catch { userData.personal = { info: personalRes.rows[0].personal_info }; }
        }
        if (modeRes.rows[0]?.preferred_mode) {
          userData.mode = modeRes.rows[0].preferred_mode;
        }
        interaction.client.memory.set(userId, userData);
      } catch (err) {
        console.error("Ask DB error:", err.message);
      } finally {
        await db.end();
      }
    }

    if (userData.personal) {
      personalInfo = Object.entries(userData.personal)
        .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`)
        .join(", ");
    }

    // Use the user's preferred mode (or default if not set)
    const systemContent = buildSystemPrompt(
      modelPreference,
      modePreference,
      customPrompt,
      personalInfo,
      false
    );

    history.push({ role: "user", content: question });
    if (history.length > 25) history = history.slice(-25);

    try {
      const response = await fetch("https://api.navy/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.NAVY_API_KEY}`,
        },
        body: JSON.stringify({
          model: modelEntry.id,
          messages: [{ role: "system", content: systemContent }, ...history],
          temperature: 0.75,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `API error ${response.status}`;
        try { errorMessage = JSON.parse(errorText).error?.message || errorText; } catch {}
        throw new Error(errorMessage);
      }

      const data = await response.json();
      if (!data.choices?.length) throw new Error("No response from AI.");

      const answer = data.choices[0].message.content;

      if (answer.trimStart().startsWith("WILD_CONTENT_DETECTED")) {
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`explain_yes|${userId}|${question.substring(0, 50)}`)
            .setLabel("Yes")
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`explain_no|${userId}|${question.substring(0, 50)}`)
            .setLabel("No")
            .setStyle(ButtonStyle.Danger)
        );
        const replyOptions = {
          content: `> **Q:** ${question}\nHmm, that's a bit much — but I can explain it a different way. Want me to?`,
          components: [row]
        };
        if (isButtonSim) await interaction.followUp(replyOptions);
        else await interaction.editReply(replyOptions);
        return;
      }

      history.push({ role: "assistant", content: answer });
      userData.history = history;
      interaction.client.memory.set(userId, userData);

      const responseHeader = `> **Q:** ${question}\n**Chrxmee AI (${modelEntry.label}):**`;

      if (answer.length > 1900) {
        const chunks = answer.match(/[\s\S]{1,1900}/g);
        const first = `${responseHeader} ${chunks[0]}...`;
        if (isButtonSim) await interaction.followUp(first);
        else await interaction.editReply(first);
        for (let i = 1; i < chunks.length; i++) await interaction.followUp(chunks[i]);
      } else {
        const replyText = `${responseHeader} ${answer}`;
        if (isButtonSim) await interaction.followUp(replyText);
        else await interaction.editReply(replyText);
      }

    } catch (err) {
      console.error(`Ask command error: ${err.message}`);
      const errText = `failed to reach me slowpoke! nah jk but heres the error msg: ${err.message.substring(0, 100)}`;
      if (isButtonSim) await interaction.followUp(errText);
      else await interaction.editReply(errText);
    }
  },
};
