const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require("discord.js");

const E = {
  success: "<:Verified_Icon:1527194184841167010>",
  error: "<:no:1530373946795364362>",
  ai: "<:Chrxmaticc_AI:1480094799292928132>",
  crown: "<:Holographic_owner_crown:1527401510487461969>",
  agree: "<:agreed:1525639597135237131>",
  settings: "<:Settings:1525601248278216725>",
  money: "<:Money_Cry_Son:1526538340264841257>",
  happy: "<:happy_cry:1526029243333611530>",
  son: "<:Son:1526536930693484575>",
  cringe: "<:Cringe_Laughing_Son:1526539082564374710>",
  link: "<:Link:1525603398341103806>",
};

const PRICES = {
  month: 1000,
  forever: 3000,
};

const YOUR_GUILD_ID = '1463346110566502443';   // Official server where purchases happen

module.exports = {
  data: new SlashCommandBuilder()
    .setName("premium")
    .setDescription("Chrxmaticc AI Premium — buy, gift, or manage your membership")
    .addSubcommand(sub => sub.setName("info").setDescription("What is Premium?"))
    .addSubcommand(sub => sub.setName("buy").setDescription("Buy a premium token with merits")
      .addStringOption(opt => opt.setName("type").setDescription("Month or Forever").setRequired(true)
        .addChoices({ name: "1 Month (1,000 merits)", value: "month" }, { name: "Forever (3,000 merits)", value: "forever" })))
    .addSubcommand(sub => sub.setName("activate").setDescription("Use a token to activate your own premium"))
    .addSubcommand(sub => sub.setName("user-give").setDescription("Give a token to a friend")
      .addUserOption(opt => opt.setName("user").setDescription("The lucky friend").setRequired(true))
      .addStringOption(opt => opt.setName("type").setDescription("Which type to give (leave empty for oldest)").setRequired(false)
        .addChoices({ name: "1 Month", value: "month" }, { name: "Forever", value: "forever" })))
    .addSubcommand(sub => sub.setName("server-give").setDescription("Boost a server with a token")
      .addStringOption(opt => opt.setName("guild_id").setDescription("Server ID to boost").setRequired(true))
      .addStringOption(opt => opt.setName("type").setDescription("Which type to use (leave empty for oldest)").setRequired(false)
        .addChoices({ name: "1 Month", value: "month" }, { name: "Forever", value: "forever" })))
    .addSubcommand(sub => sub.setName("inventory").setDescription("Check your unused premium tokens"))
    .addSubcommand(sub => sub.setName("status").setDescription("Your current premium status"))
    .addSubcommand(sub => sub.setName("card").setDescription("Show your animated premium profile card"))
    .addSubcommand(sub => sub.setName("temperature").setDescription("Set your AI temperature")
      .addNumberOption(opt => opt.setName("value").setDescription("0.1 = safe, 2.0 = wild").setRequired(true).setMinValue(0.1).setMaxValue(2.0)))
    .addSubcommand(sub => sub.setName("embed-toggle").setDescription("Turn rich embed replies on/off")
      .addStringOption(opt => opt.setName("mode").setDescription("on or off").setRequired(true)
        .addChoices({ name: "On", value: "on" }, { name: "Off", value: "off" })))
    .addSubcommand(sub => sub.setName("embed-color").setDescription("Set your embed colour")
      .addStringOption(opt => opt.setName("hex").setDescription("Hex code without #").setRequired(true).setMaxLength(6)))
    .addSubcommand(sub => sub.setName("grant").setDescription("(Owner) Give premium directly")
      .addUserOption(opt => opt.setName("user").setDescription("The user").setRequired(true))
      .addStringOption(opt => opt.setName("type").setDescription("Month or Forever").setRequired(true)
        .addChoices({ name: "1 Month", value: "month" }, { name: "Forever", value: "forever" })))
    .addSubcommand(sub => sub.setName("remove").setDescription("(Admin) Remove premium")
      .addUserOption(opt => opt.setName("user").setDescription("User (optional)").setRequired(false))
      .addStringOption(opt => opt.setName("guild_id").setDescription("Or remove from a server by ID").setRequired(false)))
    .addSubcommand(sub => sub.setName("server-status").setDescription("Check a server's premium status")
      .addStringOption(opt => opt.setName("guild_id").setDescription("Server ID (leave empty for this server)").setRequired(false))),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const pool = client.pool;
    const userId = interaction.user.id;

    // Helper to check personal premium (applied, not tokens)
    async function hasPersonalPremium(userId) {
      const res = await pool.query(
        `SELECT 1 FROM user_premium WHERE user_id = $1 AND server_id IS NULL
         AND (premium_type = 'forever' OR (expires_at > NOW()))`,
        [userId]
      );
      return res.rows.length > 0;
    }

    // Helper to require the buyer to be in the official server
    async function requireOfficialServer() {
      if (interaction.guildId !== YOUR_GUILD_ID) {
        await interaction.reply({ content: `${E.error} You can only do this in the **[official server](https://discord.gg/chrxmaticc)**.`, ephemeral: true });
        return false;
      }
      return true;
    }

    // ─── INFO ────────────────────────────────
    if (sub === "info") {
      const embed = new EmbedBuilder()
        .setColor(0x7c7ce0)
        .setTitle(`${E.crown} Chrxmaticc AI Premium`)
        .setDescription(`Earn merits, buy tokens, then choose how to use them.`)
        .setThumbnail(client.user.displayAvatarURL())
        .addFields(
          { name: `${E.agree} 1 Month Token`, value: `**1,000 merits**`, inline: true },
          { name: `${E.crown} Forever Token`, value: `**3,000 merits**`, inline: true },
          { name: "🎁 Ways to Spend", value: [
            `• \`/premium activate\` – keep it yourself`,
            `• \`/premium user-give @friend\` – gift it`,
            `• \`/premium server-give <id>\` – boost a server`
          ].join("\n"), inline: false },
          { name: "✨ Perks", value: [
            `• Custom AI temperature`,
            `• Longer memory (40 messages)`,
            `• Rich embed replies`,
            `• Animated profile card`,
            `• Custom embed colour`,
            `• Early access & more`
          ].join("\n"), inline: false }
        )
        .setFooter({ text: "Chrxmaticc AI · 炫克人工智能" })
        .setTimestamp();
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ─── BUY TOKEN ────────────────────────────
    if (sub === "buy") {
      if (!await requireOfficialServer()) return;
      const type = interaction.options.getString("type");
      const price = PRICES[type];

      const meritRes = await pool.query(`SELECT merits FROM user_merits WHERE user_id = $1 AND guild_id = $2`, [userId, YOUR_GUILD_ID]);
      const merits = meritRes.rows[0]?.merits || 0;
      if (merits < price) {
        return interaction.reply({ content: `${E.error} You need **${price}** merits. You have **${merits}**.`, ephemeral: true });
      }

      await pool.query(`UPDATE user_merits SET merits = merits - $1 WHERE user_id = $2 AND guild_id = $3`, [price, userId, YOUR_GUILD_ID]);
      await pool.query(`INSERT INTO premium_tokens (owner_id, type) VALUES ($1, $2)`, [userId, type]);

      const embed = new EmbedBuilder()
        .setColor(0x7c7ce0)
        .setTitle(`${E.crown} Token Purchased!`)
        .setDescription(`You now have a **${type}** premium token.`)
        .setThumbnail(client.user.displayAvatarURL())
        .addFields(
          { name: "Merits Spent", value: `${price}`, inline: true },
          { name: "Next Step", value: "Use `/premium activate`, `/premium user-give`, or `/premium server-give` to redeem it.", inline: false }
        );
      return interaction.reply({ embeds: [embed] });
    }

    // ─── ACTIVATE (self) ─────────────────────
    if (sub === "activate") {
      const token = await pool.query(`SELECT id, type FROM premium_tokens WHERE owner_id = $1 ORDER BY created_at ASC LIMIT 1`, [userId]);
      if (!token.rows[0]) {
        return interaction.reply({ content: `${E.error} You don't have any unused tokens. Buy one first!`, ephemeral: true });
      }

      const { id: tokenId, type } = token.rows[0];
      await pool.query(`DELETE FROM premium_tokens WHERE id = $1`, [tokenId]);

      const expiresAt = type === "month" ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null;
      await pool.query(
        `INSERT INTO user_premium (user_id, premium_type, expires_at, temperature, embed_mode, embed_color)
         VALUES ($1, $2, $3, 0.75, FALSE, '7c7ce0')
         ON CONFLICT (user_id) WHERE server_id IS NULL
         DO UPDATE SET premium_type = $2, expires_at = $3`,
        [userId, type, expiresAt]
      );

      if (PREMIUM_ROLE_ID) {
        try { await interaction.member.roles.add(PREMIUM_ROLE_ID); } catch {}
      }

      const embed = new EmbedBuilder()
        .setColor(0x7c7ce0)
        .setTitle(`${E.crown} Premium Activated!`)
        .setDescription(`Your **${type}** premium is now active.`)
        .setThumbnail(interaction.user.displayAvatarURL());
      if (type === "month") embed.addFields({ name: "Expires", value: `<t:${Math.floor(expiresAt.getTime() / 1000)}:R>`, inline: true });
      else embed.addFields({ name: "Expires", value: "Never", inline: true });
      return interaction.reply({ embeds: [embed] });
    }

    // ─── USER-GIVE ────────────────────────────
    if (sub === "user-give") {
      const target = interaction.options.getUser("user");
      if (target.bot) return interaction.reply({ content: `${E.error} You can't give tokens to bots.`, ephemeral: true });

      const typeFilter = interaction.options.getString("type");
      let tokenQuery = `SELECT id, type FROM premium_tokens WHERE owner_id = $1`;
      const params = [userId];
      if (typeFilter) {
        tokenQuery += ` AND type = $2`;
        params.push(typeFilter);
      }
      tokenQuery += ` ORDER BY created_at ASC LIMIT 1`;
      const token = await pool.query(tokenQuery, params);
      if (!token.rows[0]) {
        return interaction.reply({ content: `${E.error} You don't have a${typeFilter ? ' ' + typeFilter : 'ny'} token to give.`, ephemeral: true });
      }

      await pool.query(`UPDATE premium_tokens SET owner_id = $1 WHERE id = $2`, [target.id, token.rows[0].id]);

      const embed = new EmbedBuilder()
        .setColor(0x7c7ce0)
        .setTitle(`${E.link} Token Gifted`)
        .setDescription(`You gave a **${token.rows[0].type}** token to **${target.username}**.`)
        .setThumbnail(target.displayAvatarURL());
      return interaction.reply({ embeds: [embed] });
    }

    // ─── SERVER-GIVE ──────────────────────────
    if (sub === "server-give") {
      const guildId = interaction.options.getString("guild_id");
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return interaction.reply({ content: `${E.error} I'm not in that server or the ID is invalid.`, ephemeral: true });

      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) return interaction.reply({ content: `${E.error} You must be a member of that server to boost it.`, ephemeral: true });

      const typeFilter = interaction.options.getString("type");
      let tokenQuery = `SELECT id, type FROM premium_tokens WHERE owner_id = $1`;
      const params = [userId];
      if (typeFilter) {
        tokenQuery += ` AND type = $2`;
        params.push(typeFilter);
      }
      tokenQuery += ` ORDER BY created_at ASC LIMIT 1`;
      const token = await pool.query(tokenQuery, params);
      if (!token.rows[0]) {
        return interaction.reply({ content: `${E.error} You don't have a${typeFilter ? ' ' + typeFilter : 'ny'} token.`, ephemeral: true });
      }

      await pool.query(`DELETE FROM premium_tokens WHERE id = $1`, [token.rows[0].id]);

      const expiresAt = token.rows[0].type === "month" ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null;

      // ✅ FIX: Delete any existing server premium for this guild first, then insert fresh
      await pool.query(`DELETE FROM user_premium WHERE server_id = $1`, [guildId]);

      await pool.query(
        `INSERT INTO user_premium (user_id, server_id, premium_type, expires_at, temperature, embed_mode, embed_color)
         VALUES ($1, $2, $3, $4, 0.75, FALSE, '7c7ce0')`,
        [userId, guildId, token.rows[0].type, expiresAt]
      );

      const embed = new EmbedBuilder()
        .setColor(0x7c7ce0)
        .setTitle(`${E.crown} Server Boosted! (with chrxmaticc ai premium)`)
        .setDescription(`**${guild.name}** now has **${token.rows[0].type}** premium!`)
        .setThumbnail(guild.iconURL() || client.user.displayAvatarURL());
      if (token.rows[0].type === "month") embed.addFields({ name: "Expires", value: `<t:${Math.floor(expiresAt.getTime() / 1000)}:R>`, inline: true });
      else embed.addFields({ name: "Expires", value: "Never", inline: true });
      return interaction.reply({ embeds: [embed] });
    }

    // ─── INVENTORY ────────────────────────────
    if (sub === "inventory") {
      const tokens = await pool.query(`SELECT type, created_at FROM premium_tokens WHERE owner_id = $1 ORDER BY created_at ASC`, [userId]);
      if (!tokens.rows.length) {
        return interaction.reply({ content: "You have no unused tokens.", ephemeral: true });
      }
      const list = tokens.rows.map(t => `**${t.type}** – obtained <t:${Math.floor(t.created_at.getTime() / 1000)}:R>`).join("\n");
      const embed = new EmbedBuilder()
        .setColor(0x7c7ce0)
        .setTitle(`${E.money} Your Tokens`)
        .setDescription(list)
        .setThumbnail(interaction.user.displayAvatarURL());
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ─── STATUS ──────────────────────────────
    if (sub === "status") {
      const res = await pool.query(`SELECT premium_type, expires_at FROM user_premium WHERE user_id = $1 AND server_id IS NULL`, [userId]);
      if (!res.rows[0]) return interaction.reply({ content: `${E.error} No personal premium active.`, ephemeral: true });
      const { premium_type, expires_at } = res.rows[0];
      const isForever = premium_type === "forever";
      const isExpired = !isForever && expires_at && new Date(expires_at) < new Date();
      if (isExpired) {
        await pool.query(`DELETE FROM user_premium WHERE user_id = $1 AND server_id IS NULL`, [userId]);
        return interaction.reply({ content: `${E.error} Your premium has expired.`, ephemeral: true });
      }
      const embed = new EmbedBuilder()
        .setColor(0x7c7ce0)
        .setTitle(`${E.crown} Your Premium`)
        .setThumbnail(interaction.user.displayAvatarURL())
        .addFields(
          { name: "Type", value: isForever ? "Forever" : "1 Month", inline: true },
          { name: "Expires", value: isForever ? "Never" : `<t:${Math.floor(new Date(expires_at).getTime() / 1000)}:R>`, inline: true }
        );
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ─── CARD ────────────────────────────────
    if (sub === "card") {
      if (!await hasPersonalPremium(userId)) return interaction.reply({ content: `${E.error} You need active personal premium.`, ephemeral: true });
      const [xpRes, meritRes] = await Promise.all([
        pool.query(`SELECT xp, level, prestige FROM user_xp WHERE user_id = $1 AND guild_id = $2`, [userId, YOUR_GUILD_ID]),
        pool.query(`SELECT merits FROM user_merits WHERE user_id = $1 AND guild_id = $2`, [userId, YOUR_GUILD_ID]),
      ]);
      const embed = new EmbedBuilder()
        .setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL() })
        .setTitle(`${E.crown} Premium Profile`)
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 256 }))
        .addFields(
          { name: "Merits", value: `${meritRes.rows[0]?.merits || 0}`, inline: true },
          { name: "Level", value: `${xpRes.rows[0]?.level || 0}`, inline: true },
          { name: "XP", value: `${xpRes.rows[0]?.xp || 0}`, inline: true }
        )
        .setFooter({ text: "Chrxmaticc AI · 炫克人工智能" })
        .setTimestamp();
      const reply = await interaction.reply({ embeds: [embed], fetchReply: true });
      const colors = [0x7c7ce0, 0x9b59b6, 0xe74c3c, 0xf1c40f, 0x2ecc71, 0x3498db];
      let i = 0;
      const interval = setInterval(async () => {
        embed.setColor(colors[i % colors.length]);
        await reply.edit({ embeds: [embed] }).catch(() => {});
        i++;
      }, 700);
      setTimeout(() => { clearInterval(interval); embed.setColor(0x7c7ce0); reply.edit({ embeds: [embed] }).catch(() => {}); }, 10000);
      return;
    }

    // ─── TEMPERATURE ──────────────────────────
    if (sub === "temperature") {
      if (!await hasPersonalPremium(userId)) return interaction.reply({ content: `${E.error} Personal premium required.`, ephemeral: true });
      const value = interaction.options.getNumber("value");
      await pool.query(`UPDATE user_premium SET temperature = $1 WHERE user_id = $2 AND server_id IS NULL`, [value, userId]);
      const embed = new EmbedBuilder()
        .setColor(0x7c7ce0)
        .setTitle(`${E.settings} Temperature Updated`)
        .setDescription(`Your AI temperature is now **${value}**.`)
        .setThumbnail(client.user.displayAvatarURL());
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ─── EMBED TOGGLE ─────────────────────────
    if (sub === "embed-toggle") {
      if (!await hasPersonalPremium(userId)) return interaction.reply({ content: `${E.error} Personal premium required.`, ephemeral: true });
      const mode = interaction.options.getString("mode") === "on";
      await pool.query(`UPDATE user_premium SET embed_mode = $1 WHERE user_id = $2 AND server_id IS NULL`, [mode, userId]);
      const embed = new EmbedBuilder()
        .setColor(0x7c7ce0)
        .setTitle(`${E.settings} Embed Mode`)
        .setDescription(`AI replies will now be **${mode ? "rich embeds" : "plain text"}**.`)
        .setThumbnail(client.user.displayAvatarURL());
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ─── EMBED COLOR ──────────────────────────
    if (sub === "embed-color") {
      if (!await hasPersonalPremium(userId)) return interaction.reply({ content: `${E.error} Personal premium required.`, ephemeral: true });
      const hex = interaction.options.getString("hex").replace("#", "").toLowerCase();
      if (!/^[0-9a-f]{6}$/.test(hex)) return interaction.reply({ content: `${E.error} Invalid hex code.`, ephemeral: true });
      await pool.query(`UPDATE user_premium SET embed_color = $1 WHERE user_id = $2 AND server_id IS NULL`, [hex, userId]);
      const embed = new EmbedBuilder()
        .setColor(parseInt(hex, 16))
        .setTitle(`${E.crown} Embed Colour Set`)
        .setDescription(`Your colour is now **#${hex}**.`)
        .setThumbnail(client.user.displayAvatarURL());
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ─── GRANT (owner) ────────────────────────
    if (sub === "grant") {
      if (interaction.user.id !== process.env.OWNER_ID) return interaction.reply({ content: `${E.error} Owner only.`, ephemeral: true });
      const user = interaction.options.getUser("user");
      const type = interaction.options.getString("type");
      const expiresAt = type === "month" ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null;
      await pool.query(
        `INSERT INTO user_premium (user_id, premium_type, expires_at, temperature, embed_mode, embed_color)
         VALUES ($1, $2, $3, 0.75, FALSE, '7c7ce0')
         ON CONFLICT (user_id) WHERE server_id IS NULL
         DO UPDATE SET premium_type = $2, expires_at = $3`,
        [user.id, type, expiresAt]
      );
      return interaction.reply({ content: `${E.success} Granted **${type}** premium to **${user.username}**.`, ephemeral: true });
    }

    // ─── REMOVE (admin) ───────────────────────
    if (sub === "remove") {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: `${E.error} Admin only.`, ephemeral: true });
      }
      const user = interaction.options.getUser("user");
      const guildId = interaction.options.getString("guild_id");

      if (user) {
        await pool.query(`DELETE FROM user_premium WHERE user_id = $1 AND server_id IS NULL`, [user.id]);
        if (PREMIUM_ROLE_ID) {
          try { const member = await interaction.guild.members.fetch(user.id); await member.roles.remove(PREMIUM_ROLE_ID); } catch {}
        }
        return interaction.reply({ content: `${E.success} Removed personal premium from **${user.username}**.`, ephemeral: true });
      }

      if (guildId) {
        await pool.query(`DELETE FROM user_premium WHERE server_id = $1`, [guildId]);
        return interaction.reply({ content: `${E.success} Removed premium from server ID **${guildId}**.`, ephemeral: true });
      }

      return interaction.reply({ content: `${E.error} You must specify a user or a guild ID.`, ephemeral: true });
    }

    // ─── SERVER STATUS ────────────────────────
    if (sub === "server-status") {
      const guildId = interaction.options.getString("guild_id") || interaction.guildId;
      const res = await pool.query(
        `SELECT premium_type, expires_at FROM user_premium WHERE server_id = $1`,
        [guildId]
      );
      if (!res.rows[0]) return interaction.reply({ content: "This server does not have premium.", ephemeral: true });
      const { premium_type, expires_at } = res.rows[0];
      const isForever = premium_type === "forever";
      const embed = new EmbedBuilder()
        .setColor(0x7c7ce0)
        .setTitle(`Server Premium Status`)
        .addFields(
          { name: "Type", value: isForever ? "Forever" : "1 Month", inline: true },
          { name: "Expires", value: isForever ? "Never" : `<t:${Math.floor(new Date(expires_at).getTime() / 1000)}:R>`, inline: true }
        );
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};
