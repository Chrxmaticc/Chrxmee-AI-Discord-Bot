const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ship")
    .setDescription("AI calculates the love compatibility between two users")
    .addUserOption(option => option.setName("user1").setDescription("First user").setRequired(true))
    .addUserOption(option => option.setName("user2").setDescription("Second user").setRequired(false)),
  async execute(interaction) {
    const user1 = interaction.options.getUser("user1");
    const user2 = interaction.options.getUser("user2") || interaction.user;
    
    const percent = Math.floor(Math.random() * 101);
    let comment = "";
    if (percent > 90) comment = "A match made in the digital heavens! 💖";
    else if (percent > 75) comment = "The spark is definitely there! ";
    else if (percent > 50) comment = "There's some potential here.";
    else if (percent > 25) comment = "Maybe just friends for now? ";
    else comment = "Total system error. No compatibility found. ❄️";

    const embed = new EmbedBuilder()
      .setColor(0xFF69B4)
      .setTitle("💞 Matchmaking Intelligence")
      .setDescription(`**${user1.username}** + **${user2.username}**\n\n**Compatibility:** ${percent}%\n\n*${comment}*`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
