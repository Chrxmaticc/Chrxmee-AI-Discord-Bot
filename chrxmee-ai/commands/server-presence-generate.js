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
    .setName("server-presence-generate")
    .setDescription("ai research on a user (or yourself) based on server presence")
    .addUserOption(option =>
      option.setName("target")
        .setDescription("the user to research")
        .setRequired(false)
    ),

  async execute(interaction) {
    const isButtonSim = interaction.isButton && interaction.isButton();
    if (!isButtonSim) {
      try { await interaction.deferReply(); } catch {}
    }

    const target = interaction.options.getUser("target") || interaction.user;

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
            { role: "system", content: "You are an Elite Investigator AI. Based on the username and the fact that they are in this Discord server, generate a 'cool investigator profile' for them. Be creative, slightly mysterious, and hype them up. Use custom emojis if possible, keep it lowercase, and make it feel like an underground intelligence file." },
            { role: "user", content: `Generate a profile for: ${target.username}` },
          ],
          temperature: 0.8,
        }),
      });

      if (!response.ok) {
        throw new Error(`groq error ${response.status}`);
      }

      const data = await response.json();
      const profile = data.choices?.[0]?.message?.content || "couldn't generate profile.";

      const embed = new EmbedBuilder()
        .setColor(0x7c7ce0) // periwinkle
        .setTitle(`${E.ai} intelligence file: ${target.username}`)
        .setDescription(profile)
        .setThumbnail(target.displayAvatarURL({ size: 256, extension: "png" }))
        .setFooter({ text: "profile generated via neural network analysis" })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));

    } catch (err) {
      console.error("server-presence-generate error:", err);
      const errorEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle(`${E.error} investigation failed`)
        .setDescription(`${E.sneaky} the target is too well hidden! maybe stop being so sneaky?`);
      return interaction.editReply({ embeds: [errorEmbed] }).catch(() => interaction.followUp({ embeds: [errorEmbed] }));
    }
  },
};
