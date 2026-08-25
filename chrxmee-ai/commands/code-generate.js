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
  js: "<:JavaScript:1526535186391633950>",
  python: "<:PythonIcon:1525493663604408350>",
};

const MODEL_MAP = {
  smart: "llama-3.3-70b-versatile",
  fast: "llama-3.1-8b-instant",
  thinker: "deepseek-r1-distill-llama-70b",
  creative: "llama-3.3-70b-versatile",
  efficient: "llama-3.1-8b-instant",
  visionary: "llama-3.3-70b-versatile",
  analyst: "llama-3.1-8b-instant",
  classic: "llama-3.3-70b-versatile",
  genius: "llama-3.3-70b-versatile", // genius falls back to smartest
};

const DEFAULT_MODEL = "llama-3.3-70b-versatile"; // smartest

module.exports = {
  data: new SlashCommandBuilder()
    .setName("code-generate")
    .setDescription("generate high-quality code snippets")
    .setContexts([0, 1, 2])
    .setIntegrationTypes([0, 1])
    .addStringOption((option) =>
      option.setName("prompt").setDescription("what code do you need?").setRequired(true)
    ),

  async execute(interaction) {
    const isButtonSim = interaction.isButton && interaction.isButton();
    if (!isButtonSim) {
      try { await interaction.deferReply(); } catch {}
    }

    const prompt = interaction.options.getString("prompt");
    const userId = interaction.user.id;

    // get user model from memory; fallback to genius (smartest)
    const userData = interaction.client.memory?.get(userId) || { model: "genius" };
    const userModel = userData.model || "genius";
    const modelToUse = MODEL_MAP[userModel] || DEFAULT_MODEL;

    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: modelToUse,
          messages: [
            { role: "system", content: "You are an expert software engineer. Provide clean, well-commented code. respond in lowercase except for code. always wrap code in a code block using ```." },
            { role: "user", content: prompt },
          ],
          temperature: 0.2,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`groq error ${response.status}: ${errText.slice(0, 200)}`);
      }

      const data = await response.json();
      const code = data.choices?.[0]?.message?.content || "no code returned";

      // split if too long
      const chunks = code.match(/[\s\S]{1,1900}/g) || [code];

      const embed = new EmbedBuilder()
        .setColor(0x7c7ce0)
        .setTitle(`${E.js} code generated`)
        .setDescription(`${E.success} model: ${userModel} — here's your code`)
        .setFooter({ text: "made with chromed" })
        .setTimestamp();

      // first chunk in embed, rest as follow-ups
      embed.addFields({ name: "code", value: chunks[0] });
      await interaction.editReply({ embeds: [embed] });

      for (let i = 1; i < chunks.length; i++) {
        const followUpEmbed = new EmbedBuilder()
          .setColor(0x7c7ce0)
          .setDescription(chunks[i]);
        await interaction.followUp({ embeds: [followUpEmbed] }).catch(() => {});
      }

    } catch (err) {
      console.error("code-generate error:", err.message);
      const errorEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle(`${E.error} code generation failed`)
        .setDescription(`${E.angry} something went wrong: ${err.message}`);
      return interaction.editReply({ embeds: [errorEmbed] }).catch(() => interaction.followUp({ embeds: [errorEmbed] }));
    }
  },
};
