const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const E = {
  success: "<:Verified_Icon:1527194184841167010>",
  error: "<:no:1530373946795364362>",
  ai: "<:Chrxmaticc_AI:1480094799292928132>",
  agree: "<:agreed:1525639597135237131>",
  angry: "<:angry_cry:1526029511882440744>",
  crown: "<:Holographic_owner_crown:1527401510487461969>",
  giveaway: "<:Giveaway:1546601314870497524>",
  trophy: "<:GiveawayTrophy:1546601598405447749>",
  calendar: "<:Calendar:1546601902240702564>",
};

function parseDuration(str) {
  const match = str.match(/^(\d+)(s|m|h|d)$/i);
  if (!match) return null;
  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return value * multipliers[unit];
}

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (seconds || parts.length === 0) parts.push(`${seconds}s`);
  return parts.join(' ');
}

function buildGiveawayEmbed(giveaway, entriesCount = 0, ended = false) {
  const embed = new EmbedBuilder()
    .setColor(parseInt(giveaway.embed_color || "7c7ce0", 16))
    .setTitle(`${E.giveaway} **${giveaway.prize}**`)
    .setDescription(
      giveaway.description
        ? `${giveaway.description}\n\n`
        : "" +
          `**Entries:** ${entriesCount}\n` +
          `**Winners:** ${giveaway.winners}\n` +
          `**Ends:** <t:${Math.floor(giveaway.end_time / 1000)}:R>\n` +
          `**Hosted by:** <@${giveaway.created_by}>`
    )
    .setFooter({ text: giveaway.footer_text || "chromed giveaway" })
    .setTimestamp();

  if (giveaway.thumbnail_url) embed.setThumbnail(giveaway.thumbnail_url);

  return embed;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("giveaway")
    .setDescription("host giveaways with full customization")
    .addSubcommand(sub =>
      sub.setName("start")
        .setDescription("start a giveaway")
        .addStringOption(opt => opt.setName("prize").setDescription("what are you giving away?").setRequired(true))
        .addStringOption(opt => opt.setName("duration").setDescription("duration (e.g., 10s, 5m, 1h, 2d)").setRequired(true))
        .addIntegerOption(opt => opt.setName("winners").setDescription("number of winners").setRequired(true).setMinValue(1).setMaxValue(20))
        .addChannelOption(opt => opt.setName("channel").setDescription("channel to host (default: current)").setRequired(false))
        .addRoleOption(opt => opt.setName("role_requirement").setDescription("role required to enter (optional)").setRequired(false))
        .addStringOption(opt => opt.setName("description").setDescription("extra description").setRequired(false))
        .addStringOption(opt => opt.setName("color").setDescription("embed hex color (default 7c7ce0)").setRequired(false))
        .addStringOption(opt => opt.setName("thumbnail").setDescription("image url for thumbnail").setRequired(false))
        .addStringOption(opt => opt.setName("footer").setDescription("footer text").setRequired(false))
        .addStringOption(opt => opt.setName("button_label").setDescription("entry button label").setRequired(false))
    )
    .addSubcommand(sub => sub.setName("end").setDescription("end a giveaway early")
      .addStringOption(opt => opt.setName("message_id").setDescription("giveaway message id").setRequired(true))
    )
    .addSubcommand(sub => sub.setName("reroll").setDescription("reroll winners")
      .addStringOption(opt => opt.setName("message_id").setDescription("giveaway message id").setRequired(true))
    )
    .addSubcommand(sub => sub.setName("list").setDescription("list active giveaways"))
    .addSubcommand(sub => sub.setName("cancel").setDescription("cancel a giveaway")
      .addStringOption(opt => opt.setName("message_id").setDescription("giveaway message id").setRequired(true))
    ),

  async execute(interaction) {
    const isButtonSim = interaction.isButton && interaction.isButton();
    if (!isButtonSim) {
      try { await interaction.deferReply({ ephemeral: true }); } catch { try { await interaction.deferReply(); } catch {} }
    }

    const pool = interaction.client.pool;
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;
    const member = interaction.member;

    const sendEmbed = async (title, description, color = 0x7c7ce0, ephemeral = true) => {
      const embed = new EmbedBuilder().setColor(color).setTitle(title).setDescription(description);
      return interaction.editReply({ embeds: [embed], ephemeral }).catch(() => interaction.followUp({ embeds: [embed], ephemeral }));
    };

    // Permission check: manage messages or admin
    if (sub !== "list" && !member.permissions.has(PermissionFlagsBits.ManageMessages) && !member.permissions.has(PermissionFlagsBits.Administrator)) {
      return sendEmbed(`${E.error} permission denied`, `${E.angry} you need **manage messages** permission.`, 0xff0000);
    }

    try {
      if (sub === "start") {
        const prize = interaction.options.getString("prize");
        const durationStr = interaction.options.getString("duration");
        const winners = interaction.options.getInteger("winners");
        const channel = interaction.options.getChannel("channel") || interaction.channel;
        const roleReq = interaction.options.getRole("role_requirement") || null;
        const description = interaction.options.getString("description") || "";
        const color = interaction.options.getString("color") || "7c7ce0";
        const thumbnail = interaction.options.getString("thumbnail") || null;
        const footer = interaction.options.getString("footer") || "chromed giveaway";
        const buttonLabel = interaction.options.getString("button_label") || "enter giveaway";

        const durationMs = parseDuration(durationStr);
        if (!durationMs) return sendEmbed(`${E.error} invalid duration`, `${E.angry} use format like 10s, 5m, 1h, 2d.`, 0xff0000);

        const endTime = Date.now() + durationMs;

        // Build embed
        const embed = new EmbedBuilder()
          .setColor(parseInt(color, 16))
          .setTitle(`${E.giveaway} **${prize}**`)
          .setDescription(
            `${description ? description + "\n\n" : ""}` +
            `**Entries:** 0\n` +
            `**Winners:** ${winners}\n` +
            `**Ends:** <t:${Math.floor(endTime / 1000)}:R>\n` +
            `**Hosted by:** ${member}`
          )
          .setFooter({ text: footer })
          .setTimestamp();
        if (thumbnail) embed.setThumbnail(thumbnail);

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("giveaway_enter")
            .setLabel(buttonLabel)
            .setEmoji({ name: "Giveaway", id: "1546601314870497524" })
            .setStyle(ButtonStyle.Primary)
        );

        const msg = await channel.send({ embeds: [embed], components: [row] });

        // Save to DB
        const insertRes = await pool.query(
          `INSERT INTO giveaways (guild_id, channel_id, message_id, prize, description, duration_ms, end_time, winners, role_requirement_id, created_by, embed_color, thumbnail_url, footer_text, button_label)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
          [guild.id, channel.id, msg.id, prize, description, durationMs, endTime, winners, roleReq?.id || null, member.id, color, thumbnail, footer, buttonLabel]
        );
        const giveawayId = insertRes.rows[0].id;

        // Button collector for entries
        const collector = msg.createMessageComponentCollector({ time: durationMs });

        collector.on("collect", async (btn) => {
          try { await btn.deferUpdate(); } catch (e) { return; }
          // Check role requirement
          if (roleReq && !btn.member.roles.cache.has(roleReq.id)) {
            return btn.followUp({ content: `${E.error} you need ${roleReq} to enter!`, ephemeral: true }).catch(() => {});
          }
          // Toggle entry
          const existing = await pool.query(
            `SELECT 1 FROM giveaway_entries WHERE giveaway_id=$1 AND user_id=$2`,
            [giveawayId, btn.user.id]
          );
          if (existing.rows.length > 0) {
            await pool.query(`DELETE FROM giveaway_entries WHERE giveaway_id=$1 AND user_id=$2`, [giveawayId, btn.user.id]);
            await btn.followUp({ content: `${E.error} you left the giveaway.`, ephemeral: true }).catch(() => {});
          } else {
            await pool.query(`INSERT INTO giveaway_entries (giveaway_id, user_id) VALUES ($1,$2)`, [giveawayId, btn.user.id]);
            await btn.followUp({ content: `${E.success} you're entered! good luck!`, ephemeral: true }).catch(() => {});
          }
          // Update entry count in embed
          const countRes = await pool.query(`SELECT COUNT(*) FROM giveaway_entries WHERE giveaway_id=$1`, [giveawayId]);
          const count = parseInt(countRes.rows[0].count);
          const updatedEmbed = EmbedBuilder.from(msg.embeds[0]).setDescription(
            msg.embeds[0].description.replace(/\*\*Entries:\*\* \d+/, `**Entries:** ${count}`)
          );
          await msg.edit({ embeds: [updatedEmbed] }).catch(() => {});
        });

        return sendEmbed(`${E.giveaway} giveaway started`, `${E.success} started **${prize}** in ${channel}.`, 0x7c7ce0);
      }

      // END
      if (sub === "end" || sub === "reroll") {
        const messageId = interaction.options.getString("message_id");
        const giveawayRes = await pool.query(`SELECT * FROM giveaways WHERE guild_id=$1 AND message_id=$2`, [guild.id, messageId]);
        if (!giveawayRes.rows[0]) return sendEmbed(`${E.error} not found`, `${E.angry} giveaway not found.`, 0xff0000);
        const giveaway = giveawayRes.rows[0];

        if (sub === "end" && giveaway.ended) return sendEmbed(`${E.error} already ended`, `${E.angry} giveaway already ended.`, 0xff0000);

        const entriesRes = await pool.query(`SELECT user_id FROM giveaway_entries WHERE giveaway_id=$1`, [giveaway.id]);
        const entries = entriesRes.rows.map(r => r.user_id);

        if (entries.length === 0) {
          return sendEmbed(`${E.error} no entries`, `${E.angry} nobody entered.`, 0xff0000);
        }

        const winnersCount = Math.min(giveaway.winners, entries.length);
        const winners = [];
        for (let i = 0; i < winnersCount; i++) {
          const idx = Math.floor(Math.random() * entries.length);
          winners.push(entries.splice(idx, 1)[0]);
        }

        const channel = guild.channels.cache.get(giveaway.channel_id);
        if (channel) {
          const embed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle(`${E.trophy} giveaway ended`)
            .setDescription(`**${giveaway.prize}**\n` +
              `Winners: ${winners.map(w => `<@${w}>`).join(", ")}\n` +
              `Congratulations!`)
            .setFooter({ text: "chromed giveaway" });

          await channel.send({ embeds: [embed] });
        }

        // Mark ended if end command
        if (sub === "end") {
          await pool.query(`UPDATE giveaways SET ended=TRUE WHERE id=$1`, [giveaway.id]);
        }

        return sendEmbed(`${E.trophy} winners selected`, `${E.success} winners: ${winners.map(w => `<@${w}>`).join(", ")}`, 0xFFD700);
      }

      // LIST
      if (sub === "list") {
        const res = await pool.query(`SELECT * FROM giveaways WHERE guild_id=$1 AND ended=FALSE AND end_time > $2`, [guild.id, Date.now()]);
        if (!res.rows.length) return sendEmbed(`${E.giveaway} no active giveaways`, `${E.agree} none right now.`, 0x7c7ce0, false);
        const lines = res.rows.map(g => `**${g.prize}** — <#${g.channel_id}> (ends <t:${Math.floor(g.end_time/1000)}:R>)`);
        return sendEmbed(`${E.giveaway} active giveaways`, lines.join('\n'), 0x7c7ce0, false);
      }

      // CANCEL
      if (sub === "cancel") {
        const messageId = interaction.options.getString("message_id");
        const res = await pool.query(`SELECT * FROM giveaways WHERE guild_id=$1 AND message_id=$2`, [guild.id, messageId]);
        if (!res.rows[0]) return sendEmbed(`${E.error} not found`, `${E.angry} giveaway not found.`, 0xff0000);
        await pool.query(`UPDATE giveaways SET ended=TRUE WHERE id=$1`, [res.rows[0].id]);
        await pool.query(`DELETE FROM giveaway_entries WHERE giveaway_id=$1`, [res.rows[0].id]);
        const channel = guild.channels.cache.get(res.rows[0].channel_id);
        if (channel) {
          const msg = await channel.messages.fetch(messageId).catch(() => null);
          if (msg) await msg.delete().catch(() => {});
        }
        return sendEmbed(`${E.error} giveaway cancelled`, `${E.agree} cancelled.`, 0xff0000);
      }

      return sendEmbed(`${E.error} unknown`, "unknown subcommand.");
    } catch (err) {
      console.error("giveaway command error:", err);
      return sendEmbed(`${E.error} error`, `${E.angry} ${err.message}`, 0xff0000);
    }
  },
};
