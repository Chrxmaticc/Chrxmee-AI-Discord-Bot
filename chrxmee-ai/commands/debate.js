const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('debate')
    .setDescription('Start an interactive group or solo debate with Chrxmee AI')
    .addStringOption(option =>
      option.setName('mode')
        .setDescription('Solo (just you vs AI) or Group (anyone can join)')
        .setRequired(true)
        .addChoices(
          { name: 'Solo', value: 'solo' },
          { name: 'Group', value: 'group' }
        ))
    .addStringOption(option =>
      option.setName('topic')
        .setDescription('The debate topic')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('side')
        .setDescription('Your side as starter')
        .setRequired(true)
        .addChoices(
          { name: 'Pro (agree)', value: 'pro' },
          { name: 'Con (disagree)', value: 'con' }
        )
    ),
  async execute(interaction) {
    await interaction.deferReply();

    const mode = interaction.options.getString('mode');
    const topic = interaction.options.getString('topic');
    const starterSide = interaction.options.getString('side');
    const botSide = starterSide === 'pro' ? 'con' : 'pro';
    const starter = interaction.user;

    const starterData = interaction.client.memory.get(starter.id) || { model: "smart" };
    const model = starterData.model || "smart";

    try {
      const thread = await interaction.channel.threads.create({
        name: `⚖️ ${mode === 'solo' ? 'Solo' : 'Group'} Debate: ${topic.substring(0, 40)}`,
        autoArchiveDuration: 60,
      });

      await thread.members.add(starter.id);

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

      const getGroqResponse = async (prompt, modelKey) => {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model: models[modelKey] || models.smart,
            messages: [{ role: "system", content: "You are a logical and persuasive debater." }, { role: "user", content: prompt }],
            temperature: 0.8,
            max_tokens: 1024
          }),
        });
        const data = await response.json();
        return data.choices?.[0]?.message?.content || "I'm lost in thought...";
      };

      await interaction.editReply(`✅ **${mode === 'solo' ? 'Solo' : 'Group'} Debate thread created:** ${thread}\n👤 **You:** ${starterSide.toUpperCase()}\n🤖 **Bot:** ${botSide.toUpperCase()} (${model})`);

      const sides = new Map();
      sides.set(starter.id, starterSide);

      if (mode === 'group') {
        const row = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('debate_join_pro')
              .setLabel('Join PRO')
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId('debate_join_con')
              .setLabel('Join CON')
              .setStyle(ButtonStyle.Danger)
          );

        const joinMsg = await thread.send({
          content: `⚖️ **Debate Topic:** ${topic}\n\nClick below to join a side! (Ends in 60s)`,
          components: [row]
        });

        const filter = i => i.customId.startsWith('debate_join_');
        const collector = joinMsg.createMessageComponentCollector({ filter, time: 60000 });

        collector.on('collect', async i => {
          const side = i.customId === 'debate_join_pro' ? 'pro' : 'con';
          sides.set(i.user.id, side);
          await i.reply({ content: `You joined the **${side.toUpperCase()}** side!`, flags: [64] });
          await thread.send(`📢 **${i.user.username}** joined side **${side.toUpperCase()}**!`);
        });

        collector.on('end', async () => {
          await joinMsg.edit({ components: [] });
          await startDebate();
        });
      } else {
        await startDebate();
      }

      async function startDebate() {
        await thread.send(`🏁 **The debate begins!**\nTopic: *${topic}*`);

        const opening = await getGroqResponse(`Debate Topic: "${topic}". You are on the ${botSide.toUpperCase()} side. Provide a powerful opening argument.`, model);
        
        if (opening.length > 2000) {
          const chunks = opening.match(/[\s\S]{1,1900}/g);
          for (const chunk of chunks) await thread.send(`🎙️ **Chrxmee AI (${botSide.toUpperCase()}):** ${chunk}`);
        } else {
          await thread.send(`🎙️ **Chrxmee AI (${botSide.toUpperCase()}):** ${opening}`);
        }

        const debateCollector = thread.createMessageCollector({
          filter: m => !m.author.bot && sides.has(m.author.id),
          idle: 300000 // 5 mins
        });

        debateCollector.on('collect', async m => {
          const userSide = sides.get(m.author.id);
          await thread.sendTyping();
          
          let instruction = userSide === botSide 
            ? "They are your teammate. Support their point and add a new layer of argument." 
            : "They are your opponent. Counter their specific point with logic and evidence.";

          const response = await getGroqResponse(`Topic: "${topic}". User (${userSide.toUpperCase()}) said: "${m.content}". You are ${botSide.toUpperCase()}. ${instruction}`, model);
          
          if (response.length > 2000) {
            const chunks = response.match(/[\s\S]{1,1900}/g);
            for (const chunk of chunks) await thread.send(`🎙️ **Chrxmee AI:** ${chunk}`);
          } else {
            await thread.send(`🎙️ **Chrxmee AI:** ${response}`);
          }
        });

        debateCollector.on('end', () => {
          thread.send('🛑 **Debate concluded.** Thanks for the discussion!');
        });
      }

    } catch (err) {
      console.error("Debate command error:", err);
      await interaction.editReply("❌ Failed to start the debate. Make sure I have permissions to create threads!");
    }
  },
};
