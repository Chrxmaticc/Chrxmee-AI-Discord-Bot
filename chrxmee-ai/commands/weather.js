const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("weather")
    .setDescription("Get the current weather for a city")
    .addStringOption(option => option.setName("city").setDescription("The city to check").setRequired(true)),
  async execute(interaction) {
    await interaction.deferReply();
    const city = interaction.options.getString("city");
    try {
      const response = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`);
      const data = await response.json();
      const current = data.current_condition[0];
      
      const embed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle(`🌤️ Weather in ${city}`)
        .addFields(
          { name: "Temperature", value: `${current.temp_C}°C (${current.temp_F}°F)`, inline: true },
          { name: "Condition", value: current.weatherDesc[0].value, inline: true },
          { name: "Humidity", value: `${current.humidity}%`, inline: true },
          { name: "Wind", value: `${current.windspeedKmph} km/h`, inline: true }
        )
        .setFooter({ text: "Data from wttr.in ❄️" });
        
      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      await interaction.editReply("Could not find weather for that city!");
    }
  },
};
