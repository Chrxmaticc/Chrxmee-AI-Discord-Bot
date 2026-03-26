const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

const MODELS = {
  genius:    { id: "llama-3.3-70b-versatile",         label: "Genius (llama 3.3 70B)" },
  speedster: { id: "llama-3.1-8b-instant",            label: "Speedster (llama 3.1 8B)" },
  thinker:   { id: "openai/gpt-oss-120b",             label: "Thinker (GPT-OSS 120B)" },
  creative:  { id: "qwen/qwen3-32b",                  label: "Creative (Qwen3 32B)" },
  efficient: { id: "qwen-qwq-32b",                    label: "Efficient (QwQ 32B)" },
  vision:    { id: "llama-3.2-11b-vision-preview",    label: "Vision (llama 3.2 11B)" },
  agent:     { id: "compound-beta",                   label: "Agent (Compound Beta)" },
};

const DEFAULT_MODEL = "genius";

function buildSystemPrompt(modelPreference, customPrompt, personalInfo) {
  return `You are Chrxmee AI, a smart, witty, and slightly edgy Discord bot assistant. You are helpful, casual, and fun to talk to.

Personality for '${modelPreference}' mode:
- genius: Deep, intelligent, thorough answers. Like a brilliant friend who explains things clearly.
- speedster: Quick, punchy, get-to-the-point answers. No fluff. 
- thinker: Slow, methodical reasoning. Think step by step before answering.
- creative: Expressive, imaginative, loves wordplay and storytelling. 
- efficient: Concise and practical. Answer in as few words as needed.
- vision: Analytical and observant. Great at describing and interpreting visual or complex info.
- agent: Research-oriented. Gather info and give comprehensive answers. Be too smart for an average human.

Rules:
- You can be edgy, sarcastic, and use casual/internet language freely.
- Never flag normal words, slang, memes, or mild language. Words like "corny", "sus", "bruh", "wild", "slay" etc. are totally fine.
- Only flag content if it genuinely involves: detailed instructions for making weapons, drugs, or malware; sexual content; content targeting real individuals harmfully; or clearly illegal activity with real harm potential.
- If something is actually too harmful to answer, start your response ONLY with 'WILD_CONTENT_DETECTED' (nothing else before it).
- Do NOT over-flag. If in doubt, just answer normally.
- If the user has a custom personality set, follow it naturally as part of your character — don't ignore it or treat it as a separate instruction.
${personalInfo ? `\nWhat you know about this user: ${personalInfo}. Use this naturally like a friend would.` : ""}
${customPrompt ? `\nCustom personality the user set for you: ${customPrompt}` : ""}`;
}

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

    let userData = interaction.client.memory.get(userId) || { history: [], model: DEFAULT_MODEL };
    let history = userData.history || [];
    const modelPreference = userData.model || DEFAULT_MODEL;
    const modelEntry = MODELS[modelPreference] || MODELS[DEFAULT_MODEL];

    let customPrompt = userData.customPrompt || "";
    let personalInfo = "";

    if (!userData.customPrompt && !userData.personal) {
      const { Client } = require("pg");
      const db = new Client({ connectionString: process.env.DATABASE_URL });
      try {
        await db.connect();
        const [customRes, personalRes] = await Promise.all([
          db.query("SELECT custom_prompt, preferred_model FROM user_interactions WHERE user_id = $1", [userId]),
          db.query("SELECT personal_info FROM user_personal_info WHERE user_id = $1", [userId])
        ]);
        if (customRes.rows[0]) {
          customPrompt = customRes.rows[0].custom_prompt || "";
          userData.customPrompt = customPrompt;
          if (customRes.rows[0].preferred_model && !userData.model) {
            userData.model = customRes.rows[0].preferred_model;
          }
        }
        if (personalRes.rows[0]?.personal_info) {
          try { userData.personal = JSON.parse(personalRes.rows[0].personal_info); }
          catch { userData.personal = { info: personalRes.rows[0].personal_info }; }
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

    const systemContent = buildSystemPrompt(modelPreference, customPrompt, personalInfo);

    history.push({ role: "user", content: question });
    if (history.length > 25) history = history.slice(-25);

    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
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
      const errText = `Failed to reach Chrxmee AI: ${err.message.substring(0, 100)}`;
      if (isButtonSim) await interaction.followUp(errText);
      else await interaction.editReply(errText);
    }
  },
};
