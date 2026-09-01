const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

const E = {
  success: "<:Verified_Icon:1527194184841167010>",
  error: "<:no:1530373946795364362>",
  ai: "<:Chrxmaticc_AI:1480094799292928132>",
  crown: "<:Holographic_owner_crown:1527401510487461969>",
  agree: "<:agreed:1525639597135237131>",
  settings: "<:Settings:1525601248278216725>",
  money: "<:Money_Cry_Son:1526538340264841257>",
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("premium-stats")
    .setDescription("view your premium stats and settings"),

  async execute(interaction) {
    const isButtonSim = interaction.isButton && interaction.isButton();
    if (!isButtonSim) { try { await interaction.deferReply(); } catch {} }

    const pool = interaction.client.pool;
    const userId = interaction.user.id;

    // Fetch all premium info
    const [premiumRes, tokensRes, prefixRes, xpRes, meritRes] = await Promise.all([
      pool.query(
        `SELECT premium_type, expires_at, temperature, embed_mode, embed_color
         FROM user_premium WHERE user_id = $1 AND server_id IS NULL`,
        [userId]
      ),
      pool.query(
        `SELECT type, created_at FROM premium_tokens WHERE owner_id = $1 ORDER BY created_at ASC`,
        [userId]
      ),
      pool.query(`SELECT prefix FROM self_prefixes WHERE user_id = $1`, [userId]),
      pool.query(`SELECT xp, level, prestige FROM user_xp WHERE user_id = $1 AND guild_id = $2`, [userId, interaction.guildId]),
      pool.query(`SELECT merits FROM user_merits WHERE user_id = $1 AND guild_id = $2`, [userId, interaction.guildId]),
    ]);

    const premium = premiumRes.rows[0];
    const isPremium = premium && (premium.premium_type === "forever" || (premium.expires_at && new Date(premium.expires_at) > new Date()));

    if (!isPremium) {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle(`${E.error} no active premium`)
        .setDescription(`${E.angry} you don't have personal premium.`);
      return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
    }

    const tokensList = tokensRes.rows.length
      ? tokensRes.rows.map(t => `**${t.type}** (obtained <t:${Math.floor(t.created_at.getTime() / 1000)}:R>)`).join("\n")
      : "none";

    const embed = new EmbedBuilder()
      .setColor(0x7c7ce0)
      .setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL() })
      .setTitle(`${E.crown} premium stats`)
      .addFields(
        { name: "type", value: premium.premium_type, inline: true },
        { name: "expires", value: premium.premium_type === "forever" ? "never" : `<t:${Math.floor(new Date(premium.expires_at).getTime() / 1000)}:R>`, inline: true },
        { name: "temperature", value: `${premium.temperature}`, inline: true },
        { name: "embed mode", value: premium.embed_mode ? "on" : "off", inline: true },
        { name: "embed color", value: `#${premium.embed_color}`, inline: true },
        { name: "self prefix", value: prefixRes.rows[0]?.prefix || "not set", inline: true },
        { name: "tokens", value: tokensList, inline: false },
        { name: "xp", value: `${xpRes.rows[0]?.xp || 0} (lvl ${xpRes.rows[0]?.level || 0})`, inline: true },
        { name: "merits", value: `${meritRes.rows[0]?.merits || 0}`, inline: true }
      )
      .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
  },
};
