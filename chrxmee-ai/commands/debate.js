const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

// ─── CUSTOM EMOJIS ──────────────────────────────
const E = {
  success: "<:Verified_Icon:1527194184841167010>",
  error: "<:no:1530373946795364362>",
  ai: "<:Chrxmaticc_AI:1480094799292928132>",
  agree: "<:agreed:1525639597135237131>",
  angry: "<:angry_cry:1526029511882440744>",
  announce: "<:Discord_Announcements:1526028541270167593>",
  link: "<:Link:1525603398341103806>",
};

// ─── MODELS (Navy API) ─────────────────────────
const MODELS = {
  genius:    { id: "gpt-4.1",      label: "Genius" },
  speedster: { id: "gpt-4.1-mini", label: "Speedster" },
  thinker:   { id: "gpt-4.1",      label: "Thinker" },
  creative:  { id: "gpt-4.1",      label: "Creative" },
  efficient: { id: "gpt-4.1-mini", label: "Efficient" },
  vision:    { id: "gpt-4.1",      label: "Vision" },
  agent:     { id: "gpt-4.1",      label: "Agent" },
};
const DEFAULT_MODEL = "genius";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("debate")
    .setDescription("Start an interactive group or solo debate with Chromed AI")
    .addStringOption(option =>
      option.setName("mode")
        .setDescription("Solo (just you vs AI) or Group (anyone can join)")
        .setRequired(true)
        .addChoices(
          { name: "Solo", value: "solo" },
          { name: "Group", value: "group" }
        ))
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

    const starterData = interaction.client.memory.get(starter.id) || { model: DEFAULT_MODEL };
    const modelKey = starterData.model || DEFAULT_MODEL;
    const modelEntry = MODELS[modelKey] || MODELS[DEFAULT_MODEL];

    try {
      const thread = await interaction.channel.threads.create({
        name: `⚖️ ${mode === "solo" ? "Solo" : "Group"} Debate: ${topic.substring(0, 40)}`,
        autoArchiveDuration: 60,
      });

      await thread.members.add(starter.id);

      // Navy API call helper
      const getNavyResponse = async (prompt) => {
        const response = await fetch("https://api.navy/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.NAVY_API_KEY}`,
          },
          body: JSON.stringify({
            model: modelEntry.id,
            messages: [
              { role: "system", content: "You are a logical and persuasive debater." },
              { role: "user", content: prompt },
            ],
            temperature: 0.8,
            max_tokens: 1024,
          }),
        });
        const data = await response.json();
        return data.choices?.[0]?.message?.content || "I'm lost in thought...";
      };

      await interaction.editReply(`${E.success} **${mode === "solo" ? "Solo" : "Group"} Debate thread created:** ${thread}\n${E.ai} **Bot side:** ${botSide.toUpperCase()} (${modelEntry.label})`);

      const sides = new Map();
      sides.set(starter.id, starterSide);

      const startDebate = async () => {
        await thread.send(`${E.announce} **The debate begins!**\nTopic: *${topic}*`);

        const opening = await getNavyResponse(
          `Debate Topic: "${topic}". You are on the ${botSide.toUpperCase()} side. Provide a powerful opening argument.`
        );

        if (opening.length > 2000) {
          const chunks = opening.match(/[\s\S]{1,1900}/g);
          for (const chunk of chunks) await thread.send(`${E.ai} **Chromed AI (${botSide.toUpperCase()}):** ${chunk}`);
        } else {
          await thread.send(`${E.ai} **Chromed AI (${botSide.toUpperCase()}):** ${opening}`);
        }

        const debateCollector = thread.createMessageCollector({
          filter: (m) => !m.author.bot && sides.has(m.author.id),
          idle: 300000, // 5 mins
        });

        debateCollector.on("collect", async (m) => {
          const userSide = sides.get(m.author.id);
          await thread.sendTyping();

          let instruction =
            userSide === botSide
              ? "They are your teammate. Support their point and add a new layer of argument."
              : "They are your opponent. Counter their specific point with logic and evidence.";

          const response = await getNavyResponse(
            `Topic: "${topic}". User (${userSide.toUpperCase()}) said: "${m.content}". You are ${botSide.toUpperCase()}. ${instruction}`
          );

          if (response.length > 2000) {
            const chunks = response.match(/[\s\S]{1,1900}/g);
            for (const chunk of chunks) await thread.send(`${E.ai} **Chromed AI:** ${chunk}`);
          } else {
            await thread.send(`${E.ai} **Chromed AI:** ${response}`);
          }
        });

        debateCollector.on("end", () => {
          thread.send(`${E.success} **Debate concluded.** Thanks for the discussion!`);
        });
      };

      if (mode === "group") {
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("debate_join_pro")
            .setLabel("Join PRO")
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId("debate_join_con")
            .setLabel("Join CON")
            .setStyle(ButtonStyle.Danger)
        );

        const joinMsg = await thread.send({
          content: `${E.announce} **Debate Topic:** ${topic}\n\nClick below to join a side! (Ends in 60s)`,
          components: [row],
        });

        const filter = (i) => i.customId.startsWith("debate_join_");
        const collector = joinMsg.createMessageComponentCollector({ filter, time: 60000 });

        collector.on("collect", async (i) => {
          const side = i.customId === "debate_join_pro" ? "pro" : "con";
          sides.set(i.user.id, side);
          await i.reply({ content: `${E.success} You joined the **${side.toUpperCase()}** side!`, flags: [64] });
          await thread.send(`${E.agree} **${i.user.username}** joined side **${side.toUpperCase()}**!`);
        });

        collector.on("end", async () => {
          await joinMsg.edit({ components: [] });
          await startDebate();
        });
      } else {
        await startDebate();
      }
    } catch (err) {
      console.error("Debate command error:", err);
      await interaction.editReply(`${E.error} Failed to start the debate. Make sure I have permissions to create threads!`);
    }
  },
};
