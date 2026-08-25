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
    .setName("weather")
    .setDescription("get the current weather for a city")
    .addStringOption(option => option.setName("city").setDescription("the city to check").setRequired(true)),

  async execute(interaction) {
    const isButtonSim = interaction.isButton && interaction.isButton();
    if (!isButtonSim) {
      try { await interaction.deferReply(); } catch {}
    }

    const city = interaction.options.getString("city");

    // ─── API 1: wttr.in ───
    try {
      const res = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`);
      if (res.ok) {
        const data = await res.json();
        const current = data.current_condition?.[0];
        if (current) {
          const embed = new EmbedBuilder()
            .setColor(0x7c7ce0)
            .setTitle(`${E.ai} weather in ${city}`)
            .addFields(
              { name: "temperature", value: `${current.temp_C}°C (${current.temp_F}°F)`, inline: true },
              { name: "condition", value: current.weatherDesc?.[0]?.value || "unknown", inline: true },
              { name: "humidity", value: `${current.humidity}%`, inline: true },
              { name: "wind", value: `${current.windspeedKmph} km/h`, inline: true }
            )
            .setFooter({ text: "data from wttr.in" })
            .setTimestamp();
          return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
        }
      }
    } catch (err) {
      console.warn("weather api 1 failed:", err.message);
    }

    // ─── API 2: Open-Meteo (geocoding + current weather) ───
    try {
      // step 1: geocode city to lat/lon
      const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`);
      if (geoRes.ok) {
        const geoData = await geoRes.json();
        const place = geoData.results?.[0];
        if (place) {
          const { latitude, longitude } = place;
          // step 2: fetch weather
          const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`);
          if (weatherRes.ok) {
            const weatherData = await weatherRes.json();
            const cw = weatherData.current_weather;
            if (cw) {
              const embed = new EmbedBuilder()
                .setColor(0x7c7ce0)
                .setTitle(`${E.ai} weather in ${place.name || city}`)
                .addFields(
                  { name: "temperature", value: `${cw.temperature}°C`, inline: true },
                  { name: "wind speed", value: `${cw.windspeed} km/h`, inline: true },
                  { name: "wind direction", value: `${cw.winddirection}°`, inline: true }
                )
                .setFooter({ text: "data from open-meteo" })
                .setTimestamp();
              return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
            }
          }
        }
      }
    } catch (err) {
      console.warn("weather api 2 failed:", err.message);
    }

    // ─── API 3: WeatherAPI (only if key exists) ───
    if (process.env.WEATHER_API_KEY) {
      try {
        const res = await fetch(`https://api.weatherapi.com/v1/current.json?key=${process.env.WEATHER_API_KEY}&q=${encodeURIComponent(city)}`);
        if (res.ok) {
          const data = await res.json();
          const cur = data.current;
          if (cur) {
            const embed = new EmbedBuilder()
              .setColor(0x7c7ce0)
              .setTitle(`${E.ai} weather in ${data.location?.name || city}`)
              .addFields(
                { name: "temperature", value: `${cur.temp_c}°C (${cur.temp_f}°F)`, inline: true },
                { name: "condition", value: cur.condition?.text || "unknown", inline: true },
                { name: "humidity", value: `${cur.humidity}%`, inline: true },
                { name: "wind", value: `${cur.wind_kph} km/h`, inline: true }
              )
              .setFooter({ text: "data from weatherapi" })
              .setTimestamp();
            return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
          }
        }
      } catch (err) {
        console.warn("weather api 3 failed:", err.message);
      }
    }

    // if all failed
    const errorEmbed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle(`${E.error} couldn't get weather`)
      .setDescription(`${E.angry} couldn't find weather for **${city}**! check the spelling or try again.`)
      .setFooter({ text: "all weather sources are down" })
      .setTimestamp();

    return interaction.editReply({ embeds: [errorEmbed] }).catch(() => interaction.followUp({ embeds: [errorEmbed] }));
  },
};
