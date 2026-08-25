const { SlashCommandBuilder, EmbedBuilder, version: discordJsVersion } = require("discord.js");

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

const MODEL_LABELS = {
  genius: "genius (gpt-oss-120b)",
  speedster: "speedster (gpt-oss-20b)",
  thinker: "thinker (gpt-oss-120b)",
  creative: "creative (qwen 27b)",
  efficient: "efficient (compound-mini)",
  vision: "vision (qwen 27b)",
  agent: "agent (compound)",
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("status")
    .setDescription("check the bot's current state and your settings")
    .setContexts([0, 1, 2])
    .setIntegrationTypes([0, 1]),

  async execute(interaction) {
    const isButtonSim = interaction.isButton && interaction.isButton();
    if (!isButtonSim) {
      try { await interaction.deferReply(); } catch {}
    }

    const client = interaction.client;
    const userId = interaction.user.id;
    const userData = client.memory?.get(userId) || { history: [], model: "genius", customPrompt: "" };

    const modelKey = userData.model || "genius";
    const modelLabel = MODEL_LABELS[modelKey] || MODEL_LABELS.genius;

    // uptime
    const uptimeMs = client.uptime || 0;
    const uptimeStr = msToTime(uptimeMs);

    // ping
    const ping = Math.round(client.ws.ping);

    // server & user count
    const serverCount = client.guilds.cache.size;
    const userCount = client.users.cache.size;

    const embed = new EmbedBuilder()
      .setColor(0x7c7ce0) // periwinkle
      .setTitle(`${E.ai} chromed status`)
      .addFields(
        { name: "bot version", value: "**2.00**", inline: true },
        { name: "your model", value: `\`${modelLabel}\``, inline: true },
        { name: "brain size", value: `${userData.history?.length || 0}/30 messages`, inline: true },
        { name: "provider", value: "groq cloud", inline: true },
        { name: "personality", value: userData.customPrompt || "standard", inline: true },
        { name: "uptime", value: uptimeStr, inline: true },
        { name: "ping", value: `${ping}ms`, inline: true },
        { name: "servers", value: `${serverCount}`, inline: true },
        { name: "users", value: `${userCount}`, inline: true },
        { name: "discord.js", value: `v${discordJsVersion}`, inline: true }
      )
      .setFooter({ text: "tuff as always" })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
  },
};

function msToTime(ms) {
  if (!ms || ms <= 0) return "0s";
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (seconds) parts.push(`${seconds}s`);
  return parts.join(" ");
}
