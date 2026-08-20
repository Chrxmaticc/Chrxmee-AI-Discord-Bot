const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

// ─── HYBRID MODELS (Groq primary, Navy backup) ───────────────────
const MODELS = {
  genius: {
    label: "Genius",
    providers: [
      { name: "groq", id: "openai/gpt-oss-120b", url: "https://api.groq.com/openai/v1/chat/completions", keyEnv: "GROQ_API_KEY" },
      { name: "navy", id: "gpt-4.1", url: "https://api.navy/v1/chat/completions", keyEnv: "NAVY_API_KEY" }
    ]
  },
  speedster: {
    label: "Speedster",
    providers: [
      { name: "groq", id: "openai/gpt-oss-20b", url: "https://api.groq.com/openai/v1/chat/completions", keyEnv: "GROQ_API_KEY" },
      { name: "navy", id: "gpt-4.1-mini", url: "https://api.navy/v1/chat/completions", keyEnv: "NAVY_API_KEY" }
    ]
  },
  thinker: {
    label: "Thinker",
    providers: [
      { name: "groq", id: "openai/gpt-oss-120b", url: "https://api.groq.com/openai/v1/chat/completions", keyEnv: "GROQ_API_KEY" },
      { name: "navy", id: "gpt-4.1", url: "https://api.navy/v1/chat/completions", keyEnv: "NAVY_API_KEY" }
    ]
  },
  creative: {
    label: "Creative",
    providers: [
      { name: "groq", id: "qwen/qwen3.6-27b", url: "https://api.groq.com/openai/v1/chat/completions", keyEnv: "GROQ_API_KEY" },
      { name: "navy", id: "gpt-4.1", url: "https://api.navy/v1/chat/completions", keyEnv: "NAVY_API_KEY" }
    ]
  },
  efficient: {
    label: "Efficient",
    providers: [
      { name: "groq", id: "groq/compound-mini", url: "https://api.groq.com/openai/v1/chat/completions", keyEnv: "GROQ_API_KEY" },
      { name: "navy", id: "gpt-4.1-mini", url: "https://api.navy/v1/chat/completions", keyEnv: "NAVY_API_KEY" }
    ]
  },
  vision: {
    label: "Vision",
    providers: [
      { name: "groq", id: "qwen/qwen3.6-27b", url: "https://api.groq.com/openai/v1/chat/completions", keyEnv: "GROQ_API_KEY" },
      { name: "navy", id: "gpt-4.1", url: "https://api.navy/v1/chat/completions", keyEnv: "NAVY_API_KEY" }
    ]
  },
  agent: {
    label: "Agent",
    providers: [
      { name: "groq", id: "groq/compound", url: "https://api.groq.com/openai/v1/chat/completions", keyEnv: "GROQ_API_KEY" },
      { name: "navy", id: "gpt-4.1", url: "https://api.navy/v1/chat/completions", keyEnv: "NAVY_API_KEY" }
    ]
  },
};

const DEFAULT_MODEL = "genius";

async function callAI(modelKey, messages, temperature = 0.8, maxTokens = 1024) {
  const model = MODELS[modelKey] || MODELS[DEFAULT_MODEL];
  let lastError;
  for (const provider of model.providers) {
    const apiKey = process.env[provider.keyEnv];
    if (!apiKey) continue;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
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
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${provider.name} error ${response.status}: ${errorText.slice(0, 200)}`);
      }
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (content) return content;
      throw new Error(`No content from ${provider.name}`);
    } catch (err) {
      clearTimeout(timeout);
      console.error(`${provider.name} failed:`, err.message);
      lastError = err;
    }
  }
  throw new Error(`All providers failed. Last error: ${lastError?.message || "Unknown"}`);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("debate")
    .setDescription("Start an interactive group or solo debate with Chromed AI")
    .addStringOption(option =>
      option.setName("mode")
        .setDescription("Solo or Group")
        .setRequired(true)
        .addChoices(
          { name: "Solo", value: "solo" },
          { name: "Group", value: "group" }
        )
    )
    .addStringOption(option =>
      option.setName("topic")
        .setDescription("The debate topic")
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName("side")
        .setDescription("Your side as starter")
        .setRequired(true)
        .addChoices(
          { name: "Pro (agree)", value: "pro" },
          { name: "Con (disagree)", value: "con" }
        )
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const mode = interaction.options.getString("mode");
    const topic = interaction.options.getString("topic");
    const starterSide = interaction.options.getString("side");
    const botSide = starterSide === "pro" ? "con" : "pro";
    const starter = interaction.user;

    // Use user's selected model if stored, otherwise default
    const starterData = interaction.client.memory?.get(starter.id) || { model: DEFAULT_MODEL };
    const modelKey = starterData.model || DEFAULT_MODEL;
    const modelLabel = MODELS[modelKey]?.label || "Genius";

    try {
      const thread = await interaction.channel.threads.create({
        name: `⚖️ ${mode === "solo" ? "Solo" : "Group"} Debate: ${topic.substring(0, 40)}`,
        autoArchiveDuration: 60,
      });
      await thread.members.add(starter.id);

      await interaction.editReply(` Debate created in ${thread}`);

      // Opening argument from bot
      const opening = await callAI(
        modelKey,
        [
          { role: "system", content: "You are a logical and persuasive debater." },
          { role: "user", content: `Debate Topic: "${topic}". You are on the ${botSide.toUpperCase()} side. Provide a powerful opening argument.` }
        ],
        0.8,
        1024
      );

      await thread.send(`🎙️ **Chromed AI (${modelLabel}):** ${opening}`);

      const sides = new Map();
      sides.set(starter.id, starterSide);

      if (mode === "group") {
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("debate_join_pro").setLabel("Join PRO").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId("debate_join_con").setLabel("Join CON").setStyle(ButtonStyle.Danger)
        );
        const joinMsg = await thread.send({
          content: `⚖️ **Debate Topic:** ${topic}\n\nClick below to join a side! (Ends in 60s)`,
          components: [row],
        });
        const collector = joinMsg.createMessageComponentCollector({ time: 60000 });
        collector.on("collect", async (i) => {
          const side = i.customId === "debate_join_pro" ? "pro" : "con";
          sides.set(i.user.id, side);
          await i.reply({ content: `You joined the **${side.toUpperCase()}** side!`, ephemeral: true });
          await thread.send(`📢 **${i.user.username}** joined side **${side.toUpperCase()}**!`);
        });
        collector.on("end", () => joinMsg.edit({ components: [] }));
      }

      // Collect responses
      const filter = (m) => !m.author.bot && sides.has(m.author.id);
      const debateCollector = thread.createMessageCollector({ filter, idle: 300000 });

      debateCollector.on("collect", async (m) => {
        const userSide = sides.get(m.author.id);
        await thread.sendTyping();
        const instruction = userSide === botSide
          ? "They are your teammate. Support their point and add a new layer of argument."
          : "They are your opponent. Counter their specific point with logic and evidence.";

        const response = await callAI(
          modelKey,
          [
            { role: "system", content: `You are in a debate on "${topic}". You are ${botSide.toUpperCase()}.` },
            { role: "user", content: `User (${userSide.toUpperCase()}) said: "${m.content}". ${instruction}` }
          ],
          0.8,
          1024
        );

        if (response.length > 2000) {
          const chunks = response.match(/[\s\S]{1,1900}/g);
          for (const chunk of chunks) await thread.send(`🎙️ **Chromed AI:** ${chunk}`);
        } else {
          await thread.send(` **Chromed AI:** ${response}`);
        }
      });

      debateCollector.on("end", () => thread.send(" Debate ended."));
    } catch (err) {
      console.error("Debate error:", err);
      await interaction.editReply("Failed to start debate.");
    }
  },
};
