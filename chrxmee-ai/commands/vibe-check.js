const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

const E = {
  success: "<:Verified_Icon:1527194184841167010>",
  error: "<:no:1530373946795364362>",
  ai: "<:Chrxmaticc_AI:1480094799292928132>",
  agree: "<:agreed:1525639597135237131>",
  angry: "<:angry_cry:1526029511882440744>",
  sneaky: "<:sneaky:1527401423690792970>",
  money_cry: "<:Money_Cry_Son:1526538340264841257>",
  cringe_laugh: "<:Cringe_Laughing_Son:1526539082564374710>",
  point_laugh: "<:PointAndLaughingEmoji:1525657154567016469>",
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("vibe-check")
    .setDescription("ai analyzes the current vibe of the channel based on recent messages"),

  async execute(interaction) {
    const isButtonSim = interaction.isButton && interaction.isButton();
    if (!isButtonSim) {
      try { await interaction.deferReply(); } catch {}
    }

    try {
      const messages = await interaction.channel.messages.fetch({ limit: 10 });
      const context = messages.map(m => `${m.author.username}: ${m.content}`).join("\n");

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [
            { role: "system", content: "You are a 'Vibe Specialist'. Analyze the provided chat snippet and describe the current 'vibe' of the channel in a cool, modern, and slightly humorous way. Use custom emojis if possible, but keep it lowercase and concise." },
            { role: "user", content: `Analyze this vibe:\n${context}` },
          ],
          temperature: 0.8,
        }),
      });

      if (!response.ok) {
        throw new Error(`groq error ${response.status}`);
      }

      const data = await response.json();
      const vibe = data.choices?.[0]?.message?.content || "couldn't read the vibe, too much static.";

      const embed = new EmbedBuilder()
        .setColor(0x7c7ce0) // periwinkle
        .setTitle(`${E.ai} channel vibe check`)
        .setDescription(vibe)
        .setFooter({ text: "vibe analysis complete" })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));

    } catch (err) {
      console.error("vibe-check error:", err);
      const errorEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle(`${E.error} vibe unreadable`)
        .setDescription(`${E.angry} the vibe is unreadable right now. too much static!`);
      return interaction.editReply({ embeds: [errorEmbed] }).catch(() => interaction.followUp({ embeds: [errorEmbed] }));
    }
  },
};
