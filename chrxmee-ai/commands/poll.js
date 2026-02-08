const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("poll")
    .setDescription("Create a quick poll for the channel")
    .addStringOption(option => option.setName("question").setDescription("The poll question").setRequired(true))
    .addStringOption(option => option.setName("options").setDescription("Comma separated options (max 5)").setRequired(true)),
  async execute(interaction) {
    const question = interaction.options.getString("question");
    const optionsRaw = interaction.options.getString("options").split(",");
    const options = optionsRaw.slice(0, 5).map(o => o.trim());
    const emojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣"];

    const embed = new EmbedBuilder()
      .setColor(0x3498DB)
      .setTitle("📊 New Poll!")
      .setDescription(`**${question}**\n\n` + options.map((o, i) => `${emojis[i]} ${o}`).join("\n"))
      .setFooter({ text: `Created by ${interaction.user.tag}` });

    const message = await interaction.reply({ embeds: [embed], fetchReply: true });
    for (let i = 0; i < options.length; i++) {
      await message.react(emojis[i]);
    }
  },
};
