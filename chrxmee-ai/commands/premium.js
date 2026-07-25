const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require("discord.js");

const E = {
  success: "<:Verified_Icon:1527194184841167010>",
  error: "<:no:1530373946795364362>",
  ai: "<:Chrxmaticc_AI:1480094799292928132>",
  agree: "<:agreed:1525639597135237131>",
  crown: "<:Holographic_owner_crown:1527401510487461969>",
};

const PRICES = {
  month: 1000,
  forever: 3000,
};

// ONLY WORKS IN MY SERVER – change this to your guild ID
const YOUR_GUILD_ID = '1463346110566502443';

module.exports = {
  data: new SlashCommandBuilder()
    .setName("premium")
    .setDescription("Chrxmaticc AI Premium — earn it with merits")
    .addSubcommand(sub => sub.setName("info").setDescription("See what premium gets you"))
    .addSubcommand(sub => sub.setName("buy").setDescription("Buy premium with your merits")
      .addStringOption(opt => opt.setName("type").setDescription("Month or Forever").setRequired(true)
        .addChoices({ name: "1 Month (1,000 merits)", value: "month" }, { name: "Forever (3,000 merits)", value: "forever" })))
    .addSubcommand(sub => sub.setName("status").setDescription("Check your premium status"))
    .addSubcommand(sub => sub.setName("grant").setDescription("(Owner) Give premium to a user")
      .addUserOption(opt => opt.setName("user").setDescription("The user").setRequired(true))
      .addStringOption(opt => opt.setName("type").setDescription("Month or Forever").setRequired(true)
        .addChoices({ name: "1 Month", value: "month" }, { name: "Forever", value: "forever" }))),

  async execute(interaction, client) {
    // Block usage outside MY server
    if (interaction.guildId !== YOUR_GUILD_ID) {
      return interaction.reply({
        content: `${E.error} this command can only be used in the **official** /chrxmaticc server**.\n ${E.ai} [join the server](https://discord.gg/chrxmaticc)`,
        ephemeral: true
      });
    }

    const sub = interaction.options.getSubcommand();
    const pool = client.pool;
    const userId = interaction.user.id;

    // ─── INFO ────────────────────────────────
    if (sub === "info") {
      const embed = new EmbedBuilder()
        .setColor(0x7c7ce0)          // periwinkle
        .setTitle(`${E.crown} Chrxmaticc AI Premium`)
        .setDescription(`unlock exclusive perks by saving up your hard‑earned merits!\nuse **/premium buy** when you're ready.`)
        .setThumbnail(client.user.displayAvatarURL())
        .addFields(
          {
            name: `${E.agree} 1 Month Premium`,
            value: `**1,000 merits**\nAll perks for 30 days.`,
            inline: true
          },
          {
            name: `${E.crown} Forever Premium`,
            value: `**3,000 merits**\nAll perks permanently. Never expires.`,
            inline: true
          },
          {
            name: `${E.success} Perks`,
            value: [
              `• **Premium Badge** – a special role & spot on your profile card`,
              `• **Bigger Brain Size** – From 20 message context to 50 messages for context.`,
              `• **Temperature Control** – Control the AI Temperature (WIP)`,
              `• **Early Access** – test new features before anyone else`,
              `• **Premium Lounge** – hidden channel for premium members`,
            ].join("\n"),
            inline: false
          }
        )
        .setFooter({ text: "Chrxmaticc AI · 炫克人工智能" })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ─── BUY ──────────────────────────────────
    if (sub === "buy") {
      const type = interaction.options.getString("type");
      const price = PRICES[type];

      const meritRes = await pool.query(`SELECT merits FROM user_merits WHERE user_id = $1 AND guild_id = $2`, [userId, interaction.guildId]);
      const merits = meritRes.rows[0]?.merits || 0;
      if (merits < price) {
        return interaction.reply({ content: `${E.error} You need **${price}** merits. You have **${merits}**.`, ephemeral: true });
      }

      await pool.query(`UPDATE user_merits SET merits = merits - $1 WHERE user_id = $2 AND guild_id = $3`, [price, userId, interaction.guildId]);

      const expiresAt = type === "month" ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null;
      await pool.query(`INSERT INTO user_premium (user_id, premium_type, expires_at)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id) DO UPDATE SET premium_type = $2, expires_at = $3`,
        [userId, type, expiresAt]);

      const embed = new EmbedBuilder()
        .setColor(0x7c7ce0)
        .setTitle(`${E.crown} Premium Activated!`)
        .setDescription(`You now have **${type === "month" ? "1 Month" : "Forever"}** premium!`)
        .addFields({ name: "Merits Spent", value: `${price}`, inline: true });
      if (type === "month") embed.addFields({ name: "Expires", value: `<t:${Math.floor(expiresAt.getTime() / 1000)}:R>`, inline: true });
      else embed.addFields({ name: "Expires", value: "Never", inline: true });

      return interaction.reply({ embeds: [embed] });
    }

    // ─── STATUS ──────────────────────────────
    if (sub === "status") {
      const res = await pool.query(`SELECT premium_type, expires_at FROM user_premium WHERE user_id = $1`, [userId]);
      if (!res.rows[0]) {
        return interaction.reply({ content: `${E.error} You don't have premium. Save up **${PRICES.month}** merits for 1 month or **${PRICES.forever}** for forever!`, ephemeral: true });
      }

      const { premium_type, expires_at } = res.rows[0];
      const isForever = premium_type === "forever";
      const isExpired = !isForever && expires_at && new Date(expires_at) < new Date();

      if (isExpired) {
        await pool.query(`DELETE FROM user_premium WHERE user_id = $1`, [userId]);
        return interaction.reply({ content: `${E.error} Your premium has expired.`, ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setColor(0x7c7ce0)
        .setTitle(`${E.crown} Premium Status`)
        .addFields(
          { name: "Type", value: isForever ? "Forever" : "1 Month", inline: true },
          { name: "Expires", value: isForever ? "Never" : `<t:${Math.floor(new Date(expires_at).getTime() / 1000)}:R>`, inline: true }
        );
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ─── GRANT (Owner only) ──────────────────
    if (sub === "grant") {
      if (interaction.user.id !== process.env.OWNER_ID) {
        return interaction.reply({ content: `${E.error} Owner only.`, ephemeral: true });
      }
      const user = interaction.options.getUser("user");
      const type = interaction.options.getString("type");
      const expiresAt = type === "month" ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null;

      await pool.query(`INSERT INTO user_premium (user_id, premium_type, expires_at)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id) DO UPDATE SET premium_type = $2, expires_at = $3`,
        [user.id, type, expiresAt]);

      return interaction.reply({ content: `${E.success} Granted **${type === "month" ? "1 Month" : "Forever"}** premium to **${user.username}**.`, ephemeral: true });
    }
  },
};
