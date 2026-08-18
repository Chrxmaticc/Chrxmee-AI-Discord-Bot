const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

// ─── HYBRID MODELS (Navy primary, Groq backup) ───────────────────
const MODELS = {
  genius: {
    label: "Genius",
    providers: [
      { name: "navy", id: "gpt-4.1",      url: "https://api.navy/v1/chat/completions",      keyEnv: "NAVY_API_KEY" },
      { name: "groq", id: "llama-3.3-70b-versatile", url: "https://api.groq.com/openai/v1/chat/completions", keyEnv: "GROQ_API_KEY" }
    ]
  },
  speedster: {
    label: "Speedster",
    providers: [
      { name: "navy", id: "gpt-4.1-mini", url: "https://api.navy/v1/chat/completions",      keyEnv: "NAVY_API_KEY" },
      { name: "groq", id: "llama-3.1-8b-instant",    url: "https://api.groq.com/openai/v1/chat/completions", keyEnv: "GROQ_API_KEY" }
    ]
  },
  thinker: {
    label: "Thinker",
    providers: [
      { name: "navy", id: "gpt-4.1",      url: "https://api.navy/v1/chat/completions",      keyEnv: "NAVY_API_KEY" },
      { name: "groq", id: "openai/gpt-oss-120b",     url: "https://api.groq.com/openai/v1/chat/completions", keyEnv: "GROQ_API_KEY" }
    ]
  },
  creative: {
    label: "Creative",
    providers: [
      { name: "navy", id: "gpt-4.1",      url: "https://api.navy/v1/chat/completions",      keyEnv: "NAVY_API_KEY" },
      { name: "groq", id: "qwen/qwen3-32b",          url: "https://api.groq.com/openai/v1/chat/completions", keyEnv: "GROQ_API_KEY" }
    ]
  },
  efficient: {
    label: "Efficient",
    providers: [
      { name: "navy", id: "gpt-4.1-mini", url: "https://api.navy/v1/chat/completions",      keyEnv: "NAVY_API_KEY" },
      { name: "groq", id: "qwen-qwq-32b",            url: "https://api.groq.com/openai/v1/chat/completions", keyEnv: "GROQ_API_KEY" }
    ]
  },
  vision: {
    label: "Vision",
    providers: [
      { name: "navy", id: "gpt-4.1",      url: "https://api.navy/v1/chat/completions",      keyEnv: "NAVY_API_KEY" },
      { name: "groq", id: "llama-3.2-11b-vision-preview", url: "https://api.groq.com/openai/v1/chat/completions", keyEnv: "GROQ_API_KEY" }
    ]
  },
  agent: {
    label: "Agent",
    providers: [
      { name: "navy", id: "gpt-4.1",      url: "https://api.navy/v1/chat/completions",      keyEnv: "NAVY_API_KEY" },
      { name: "groq", id: "compound-beta",           url: "https://api.groq.com/openai/v1/chat/completions", keyEnv: "GROQ_API_KEY" }
    ]
  },
};

const DEFAULT_MODEL = "genius";

async function callAI(modelKey, messages, temperature = 0.75, maxTokens = 1024) {
  const model = MODELS[modelKey] || MODELS[DEFAULT_MODEL];
  let lastError;
  for (const provider of model.providers) {
    const apiKey = process.env[provider.keyEnv];
    if (!apiKey) continue;
    try {
      const response = await fetch(provider.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: provider.id,
          messages,
          temperature,
          max_tokens: maxTokens,
        }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${provider.name} error ${response.status}: ${errorText.slice(0, 200)}`);
      }
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (content) return content;
      throw new Error(`No content from ${provider.name}`);
    } catch (err) {
      console.error(`${provider.name} failed:`, err.message);
      lastError = err;
    }
  }
  throw new Error(`All providers failed. Last error: ${lastError?.message || "Unknown"}`);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ask")
    .setDescription("Ask Chromed AI anything!")
    .setContexts([0, 1, 2])
    .setIntegrationTypes([0, 1])
    .addStringOption((option) =>
      option.setName("question").setDescription("Your question").setRequired(true)
    ),
  async execute(interaction) {
    const isButtonSim = interaction.isButton && interaction.isButton();
    if (!isButtonSim) await interaction.deferReply();

    const question = interaction.options.getString("question");
    const userId = interaction.user.id;

    // In-memory history
    if (!interaction.client.memory) interaction.client.memory = new Map();
    let userData = interaction.client.memory.get(userId) || { history: [], model: DEFAULT_MODEL };
    const modelKey = userData.model || DEFAULT_MODEL;
    const history = userData.history || [];

    // Build system prompt
    const systemPrompt = `You are Chromed AI, a witty and edgy Discord bot. You speak with internet slang and lowercase mostly. Keep answers helpful and slightly sarcastic. Never use racial slurs or harmful content.`;

    const messages = [{ role: "system", content: systemPrompt }, ...history, { role: "user", content: question }];

    try {
      const answer = await callAI(modelKey, messages, 0.75, 1024);

      // Store history
      history.push({ role: "user", content: question });
      history.push({ role: "assistant", content: answer });
      if (history.length > 25) history = history.slice(-25);
      userData.history = history;
      interaction.client.memory.set(userId, userData);

      const modelLabel = MODELS[modelKey]?.label || "Genius";
      const replyText = `> **Q:** ${question}\n**Chromed AI (${modelLabel}):** ${answer}`;

      if (answer.length > 1900) {
        const chunks = answer.match(/[\s\S]{1,1900}/g);
        const first = `> **Q:** ${question}\n**Chromed AI (${modelLabel}):** ${chunks[0]}...`;
        if (isButtonSim) await interaction.followUp(first);
        else await interaction.editReply(first);
        for (let i = 1; i < chunks.length; i++) await interaction.followUp(chunks[i]);
      } else {
        if (isButtonSim) await interaction.followUp(replyText);
        else await interaction.editReply(replyText);
      }
    } catch (err) {
      console.error("Ask error:", err.message);
      const errorMsg = "AI services are down. Try again later.";
      if (isButtonSim) await interaction.followUp(errorMsg);
      else await interaction.editReply(errorMsg);
    }
  },
};
