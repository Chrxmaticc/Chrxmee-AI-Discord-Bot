const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const E = {
  success: "<:Verified_Icon:1527194184841167010>",
  error: "<:no:1530373946795364362>",
  ai: "<:Chrxmaticc_AI:1480094799292928132>",
};

function generateBackupId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = 'BCK-';
  for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

async function imageToBase64(url) {
  try {
    const res = await fetch(url);
    const buffer = await res.buffer();
    return `data:${res.headers.get('content-type')};base64,${buffer.toString('base64')}`;
  } catch { return null; }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("backup")
    .setDescription("Create or restore a full server snapshot (Administrator only)")
    .addSubcommand(sub => sub.setName("create").setDescription("Create a new backup of the entire server"))
    .addSubcommand(sub => sub.setName("load").setDescription("Restore a backup (⚠️ This replaces everything!)")
      .addStringOption(opt => opt.setName("backup_id").setDescription("The backup ID to restore").setRequired(true).setAutocomplete(true)))
    .addSubcommand(sub => sub.setName("list").setDescription("List all backups for this server")),

  async autocomplete(interaction, client) {
    const focused = interaction.options.getFocused().toLowerCase();
    const pool = client.pool;
    const { rows } = await pool.query(
      `SELECT backup_id FROM server_backups WHERE guild_id = $1 ORDER BY created_at DESC LIMIT 25`,
      [interaction.guildId]
    );
    const filtered = rows.filter(r => r.backup_id.toLowerCase().includes(focused));
    await interaction.respond(filtered.map(r => ({ name: r.backup_id, value: r.backup_id })));
  },

  async execute(interaction, client) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: `${E.error} You need Administrator permissions.`, ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();
    const pool = client.pool;
    const guild = interaction.guild;
    const guildId = guild.id;

    // ─── CREATE BACKUP ──────────────────────────
    if (sub === "create") {
      await interaction.deferReply({ ephemeral: true });

      try {
        // ── Roles ─────────────────────────────────
        const roles = (guild.roles?.cache ?? [])
          .filter(r => r.id !== guild.id && !r.managed)
          .sort((a, b) => b.position - a.position)
          .map(r => ({
            name: r.name,
            color: r.hexColor,
            hoist: r.hoist,
            mentionable: r.mentionable,
            permissions: r.permissions.bitfield.toString(),
            position: r.position
          }));

        // ── Channels ──────────────────────────────
        const channels = (guild.channels?.cache ?? [])
          .sort((a, b) => a.position - b.position)
          .map(c => ({
            name: c.name,
            type: c.type,
            position: c.position,
            parentId: c.parentId,
            topic: c.topic || null,
            nsfw: c.nsfw,
            bitrate: c.bitrate || null,
            userLimit: c.userLimit || null,
            rateLimitPerUser: c.rateLimitPerUser || null,
            permissionOverwrites: (c.permissionOverwrites?.cache ?? []).map(o => ({
              id: o.id,
              type: o.type,
              allow: o.allow.bitfield.toString(),
              deny: o.deny.bitfield.toString()
            }))
          }));

        // ── Emojis ────────────────────────────────
        const emojis = [];
        if (guild.emojis?.cache) {
          for (const [, emoji] of guild.emojis.cache) {
            const base64 = await imageToBase64(emoji.url);
            if (base64) {
              emojis.push({
                name: emoji.name,
                base64,
                roles: emoji.roles?.cache?.map(r => r.id) ?? []
              });
            }
          }
        }

        // ── Stickers ──────────────────────────────
        const stickers = [];
        if (guild.stickers?.cache) {
          for (const [, sticker] of guild.stickers.cache) {
            const base64 = await imageToBase64(sticker.url);
            if (base64) {
              stickers.push({
                name: sticker.name,
                tags: sticker.tags,
                description: sticker.description,
                base64
              });
            }
          }
        }

        // ── Server Settings ────────────────────────
        const iconBase64 = guild.iconURL({ size: 4096, format: 'png' }) 
          ? await imageToBase64(guild.iconURL({ size: 4096, format: 'png' })) 
          : null;
        const bannerBase64 = guild.bannerURL({ size: 4096, format: 'png' }) 
          ? await imageToBase64(guild.bannerURL({ size: 4096, format: 'png' })) 
          : null;

        const serverSettings = {
          name: guild.name,
          iconBase64,
          bannerBase64,
          verificationLevel: guild.verificationLevel,
          explicitContentFilter: guild.explicitContentFilter,
          defaultMessageNotifications: guild.defaultMessageNotifications,
          afkChannelId: guild.afkChannelId,
          afkTimeout: guild.afkTimeout,
          systemChannelId: guild.systemChannelId,
          rulesChannelId: guild.rulesChannelId,
          publicUpdatesChannelId: guild.publicUpdatesChannelId,
          preferredLocale: guild.preferredLocale
        };

        const backupData = { roles, channels, emojis, stickers, serverSettings };
        const backupId = generateBackupId();

        await pool.query(
          `INSERT INTO server_backups (guild_id, backup_id, data) VALUES ($1, $2, $3)`,
          [guildId, backupId, JSON.stringify(backupData)]
        );

        const embed = new EmbedBuilder()
          .setColor(0x7c7ce0)
          .setTitle(`${E.success} Full Backup Created`)
          .setDescription(`Server snapshot saved!`)
          .addFields(
            { name: "Backup ID", value: `\`${backupId}\`` },
            { name: "Roles", value: `${roles.length}`, inline: true },
            { name: "Channels", value: `${channels.length}`, inline: true },
            { name: "Emojis", value: `${emojis.length}`, inline: true },
            { name: "Stickers", value: `${stickers.length}`, inline: true }
          )
          .setFooter({ text: "Chrxmaticc AI · 炫克人工智能" });

        return interaction.editReply({ embeds: [embed] });
      } catch (err) {
        console.error("Backup creation error:", err);
        return interaction.editReply({ content: `${E.error} Backup failed: ${err.message}`, ephemeral: true });
      }
    }

    // ─── LIST BACKUPS ───────────────────────────
    if (sub === "list") {
      const { rows } = await pool.query(
        `SELECT backup_id, created_at FROM server_backups WHERE guild_id = $1 ORDER BY created_at DESC LIMIT 25`,
        [guildId]
      );
      if (rows.length === 0) return interaction.reply({ content: "No backups found.", ephemeral: true });
      const embed = new EmbedBuilder()
        .setColor(0x7c7ce0)
        .setTitle("📋 Server Backups")
        .setDescription(rows.map(r => `\`${r.backup_id}\` — <t:${Math.floor(r.created_at.getTime() / 1000)}:R>`).join("\n"))
        .setFooter({ text: "Use /backup load <id> to restore" });
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ─── LOAD BACKUP (with confirmation) ────────
    if (sub === "load") {
      const backupId = interaction.options.getString("backup_id");
      const { rows } = await pool.query(
        `SELECT data FROM server_backups WHERE guild_id = $1 AND backup_id = $2`,
        [guildId, backupId]
      );
      if (!rows[0]) return interaction.reply({ content: `${E.error} Backup not found.`, ephemeral: true });

      const confirmEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle("⚠️ Confirm Full Server Restore")
        .setDescription(`This will **delete everything** (roles, channels, emojis, stickers) and restore the backup \`${backupId}\`. This is irreversible.`)
        .setFooter({ text: "Click Confirm within 30 seconds to proceed." });

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder().setCustomId(`backup_confirm_${backupId}`).setLabel("Confirm Restore").setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId("backup_cancel").setLabel("Cancel").setStyle(ButtonStyle.Secondary)
        );

      const msg = await interaction.reply({ embeds: [confirmEmbed], components: [row], ephemeral: true, fetchReply: true });
      const collector = msg.createMessageComponentCollector({ time: 30000, max: 1 });

      collector.on("collect", async (btn) => {
        if (btn.customId === "backup_cancel") {
          await btn.update({ content: "Restore cancelled.", embeds: [], components: [] });
          return;
        }

        if (btn.customId === `backup_confirm_${backupId}`) {
          await btn.deferUpdate();

          const backupData = rows[0].data;
          const { roles, channels, emojis = [], stickers = [], serverSettings } = backupData;

          try {
            // Delete existing emojis / stickers
            if (guild.emojis?.cache) {
              for (const [, emoji] of guild.emojis.cache) { await emoji.delete().catch(() => {}); }
            }
            if (guild.stickers?.cache) {
              for (const [, sticker] of guild.stickers.cache) { await sticker.delete().catch(() => {}); }
            }

            // Delete channels
            const existingChannels = guild.channels?.cache?.filter(c => c.deletable) ?? [];
            for (const [, channel] of existingChannels) { await channel.delete().catch(() => {}); }

            // Delete roles
            const existingRoles = guild.roles?.cache?.filter(r => r.id !== guild.id && !r.managed && r.editable) ?? [];
            for (const [, role] of existingRoles) { await role.delete().catch(() => {}); }

            // Recreate roles
            for (const r of roles) {
              await guild.roles.create({
                name: r.name,
                color: r.color,
                hoist: r.hoist,
                mentionable: r.mentionable,
                permissions: BigInt(r.permissions),
                position: r.position
              }).catch(() => {});
            }

            // Recreate channels
            for (const c of channels) {
              await guild.channels.create({
                name: c.name,
                type: c.type,
                position: c.position,
                topic: c.topic,
                nsfw: c.nsfw,
                bitrate: c.bitrate || undefined,
                userLimit: c.userLimit || undefined,
                rateLimitPerUser: c.rateLimitPerUser || undefined,
                permissionOverwrites: (c.permissionOverwrites || []).map(o => ({
                  id: o.id,
                  type: o.type,
                  allow: BigInt(o.allow),
                  deny: BigInt(o.deny)
                }))
              }).catch(() => {});
            }

            // Restore emojis
            if (emojis.length > 0) {
              for (const e of emojis) {
                const buffer = Buffer.from(e.base64.split(',')[1], 'base64');
                await guild.emojis.create({ attachment: buffer, name: e.name, roles: e.roles }).catch(() => {});
              }
            }

            // Restore stickers
            if (stickers.length > 0) {
              for (const s of stickers) {
                const buffer = Buffer.from(s.base64.split(',')[1], 'base64');
                await guild.stickers.create({ file: buffer, name: s.name, tags: s.tags, description: s.description }).catch(() => {});
              }
            }

            // Apply server settings
            if (serverSettings) {
              const settingsUpdate = {};
              if (serverSettings.name) settingsUpdate.name = serverSettings.name;
              if (serverSettings.verificationLevel) settingsUpdate.verificationLevel = serverSettings.verificationLevel;
              if (serverSettings.explicitContentFilter) settingsUpdate.explicitContentFilter = serverSettings.explicitContentFilter;
              if (serverSettings.defaultMessageNotifications) settingsUpdate.defaultMessageNotifications = serverSettings.defaultMessageNotifications;
              if (serverSettings.afkChannelId) settingsUpdate.afkChannelId = serverSettings.afkChannelId;
              if (serverSettings.afkTimeout) settingsUpdate.afkTimeout = serverSettings.afkTimeout;
              if (serverSettings.systemChannelId) settingsUpdate.systemChannelId = serverSettings.systemChannelId;
              if (serverSettings.rulesChannelId) settingsUpdate.rulesChannelId = serverSettings.rulesChannelId;
              if (serverSettings.publicUpdatesChannelId) settingsUpdate.publicUpdatesChannelId = serverSettings.publicUpdatesChannelId;
              if (serverSettings.preferredLocale) settingsUpdate.preferredLocale = serverSettings.preferredLocale;
              await guild.edit(settingsUpdate).catch(() => {});

              if (serverSettings.iconBase64) {
                const buffer = Buffer.from(serverSettings.iconBase64.split(',')[1], 'base64');
                await guild.setIcon(buffer).catch(() => {});
              }
              if (serverSettings.bannerBase64) {
                const buffer = Buffer.from(serverSettings.bannerBase64.split(',')[1], 'base64');
                await guild.setBanner(buffer).catch(() => {});
              }
            }

            await btn.followUp({ content: `${E.success} Server fully restored from backup \`${backupId}\`.`, ephemeral: true });
          } catch (err) {
            console.error("Restore failed:", err);
            await btn.followUp({ content: `${E.error} Restore failed: ${err.message}`, ephemeral: true });
          }
        }
      });

      collector.on("end", () => {
        interaction.editReply({ components: [] }).catch(() => {});
      });
      return;
    }
  },
};
