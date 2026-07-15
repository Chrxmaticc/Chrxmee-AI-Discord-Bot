const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, UserSelectMenuBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("j2c")
    .setDescription("Join to Create — manage your temporary VC")
    // Admin
    .addSubcommand(sub => sub.setName("setup").setDescription("Set the trigger VC channel")
      .addChannelOption(opt => opt.setName("channel").setDescription("Voice channel to use as trigger").setRequired(true).addChannelTypes(ChannelType.GuildVoice)))
    .addSubcommand(sub => sub.setName("disable").setDescription("Disable the J2C system"))
    .addSubcommand(sub => sub.setName("category").setDescription("Set category for temp VCs")
      .addChannelOption(opt => opt.setName("category").setDescription("Category channel").setRequired(true).addChannelTypes(ChannelType.GuildCategory)))
    .addSubcommand(sub => sub.setName("default-name").setDescription("Set default name format. Use {user} for username")
      .addStringOption(opt => opt.setName("format").setDescription("Name format (e.g. {user}'s Room)").setRequired(true).setMaxLength(100)))
    .addSubcommand(sub => sub.setName("default-limit").setDescription("Set default user limit for new VCs")
      .addIntegerOption(opt => opt.setName("limit").setDescription("0 = no limit, max 99").setRequired(true).setMinValue(0).setMaxValue(99)))
    .addSubcommand(sub => sub.setName("trusted").setDescription("Add/remove a trusted role that bypasses locks")
      .addRoleOption(opt => opt.setName("role").setDescription("The role").setRequired(true))
      .addStringOption(opt => opt.setName("action").setDescription("Add or remove").setRequired(true).addChoices({ name: "Add", value: "add" }, { name: "Remove", value: "remove" })))
    .addSubcommand(sub => sub.setName("log").setDescription("Set log channel for VC events")
      .addChannelOption(opt => opt.setName("channel").setDescription("Text channel for logs").setRequired(true)))
    // Info
    .addSubcommand(sub => sub.setName("status").setDescription("View J2C config for this server"))
    .addSubcommand(sub => sub.setName("info").setDescription("Info about a temp VC")
      .addChannelOption(opt => opt.setName("channel").setDescription("The VC to check").setRequired(false).addChannelTypes(ChannelType.GuildVoice)))
    // Owner
    .addSubcommand(sub => sub.setName("showcase").setDescription("Open VC control panel with buttons"))
    .addSubcommand(sub => sub.setName("name").setDescription("Rename your VC")
      .addStringOption(opt => opt.setName("name").setDescription("New name").setRequired(true).setMaxLength(100)))
    .addSubcommand(sub => sub.setName("limit").setDescription("Set user limit for your VC")
      .addIntegerOption(opt => opt.setName("limit").setDescription("0-99, 0 = no limit").setRequired(true).setMinValue(0).setMaxValue(99)))
    .addSubcommand(sub => sub.setName("lock").setDescription("Lock your VC"))
    .addSubcommand(sub => sub.setName("unlock").setDescription("Unlock your VC"))
    .addSubcommand(sub => sub.setName("hide").setDescription("Hide your VC from @everyone"))
    .addSubcommand(sub => sub.setName("show").setDescription("Make your VC visible to @everyone"))
    .addSubcommand(sub => sub.setName("kick").setDescription("Kick someone from your VC")
      .addUserOption(opt => opt.setName("user").setDescription("User to kick").setRequired(true)))
    .addSubcommand(sub => sub.setName("ban").setDescription("Ban someone from your VC")
      .addUserOption(opt => opt.setName("user").setDescription("User to ban").setRequired(true)))
    .addSubcommand(sub => sub.setName("unban").setDescription("Unban someone from your VC")
      .addUserOption(opt => opt.setName("user").setDescription("User to unban").setRequired(true)))
    .addSubcommand(sub => sub.setName("transfer").setDescription("Transfer ownership to someone else")
      .addUserOption(opt => opt.setName("user").setDescription("New owner").setRequired(true)))
    .addSubcommand(sub => sub.setName("reset").setDescription("Reset your VC to default name and limit"))
    // Admin override
    .addSubcommand(sub => sub.setName("claim").setDescription("(Admin) Claim ownership of a temp VC")
      .addChannelOption(opt => opt.setName("channel").setDescription("The VC to claim").setRequired(false).addChannelTypes(ChannelType.GuildVoice))),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const pool = client.pool;

    // ==================== ADMIN SETUP ====================
    if (sub === "setup") {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: "❌ Admin only.", ephemeral: true });
      const channel = interaction.options.getChannel("channel");
      await pool.query(`INSERT INTO j2c_config (guild_id, trigger_channel_id) VALUES ($1, $2) ON CONFLICT (guild_id) DO UPDATE SET trigger_channel_id = $2, enabled = TRUE`, [guildId, channel.id]);
      return interaction.reply({ content: `✅ J2C trigger set to ${channel}. Users who join it will get their own VC.`, ephemeral: true });
    }

    if (sub === "disable") {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: "❌ Admin only.", ephemeral: true });
      await pool.query(`UPDATE j2c_config SET enabled = FALSE WHERE guild_id = $1`, [guildId]);
      return interaction.reply({ content: "✅ J2C system disabled.", ephemeral: true });
    }

    if (sub === "category") {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: "❌ Admin only.", ephemeral: true });
      const cat = interaction.options.getChannel("category");
      await pool.query(`INSERT INTO j2c_config (guild_id, category_id) VALUES ($1, $2) ON CONFLICT (guild_id) DO UPDATE SET category_id = $2`, [guildId, cat.id]);
      return interaction.reply({ content: `✅ Temp VCs will be created under **${cat.name}**.`, ephemeral: true });
    }

    if (sub === "default-name") {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: "❌ Admin only.", ephemeral: true });
      const format = interaction.options.getString("format");
      await pool.query(`INSERT INTO j2c_config (guild_id, default_name) VALUES ($1, $2) ON CONFLICT (guild_id) DO UPDATE SET default_name = $2`, [guildId, format]);
      return interaction.reply({ content: `✅ Default name set to \`${format}\`. Use \`{user}\` for username.`, ephemeral: true });
    }

    if (sub === "default-limit") {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: "❌ Admin only.", ephemeral: true });
      const limit = interaction.options.getInteger("limit");
      await pool.query(`INSERT INTO j2c_config (guild_id, default_limit) VALUES ($1, $2) ON CONFLICT (guild_id) DO UPDATE SET default_limit = $2`, [guildId, limit]);
      return interaction.reply({ content: `✅ Default limit set to **${limit === 0 ? "no limit" : limit}**.`, ephemeral: true });
    }

    if (sub === "trusted") {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: "❌ Admin only.", ephemeral: true });
      const role = interaction.options.getRole("role");
      const action = interaction.options.getString("action");
      if (action === "add") {
        await pool.query(`INSERT INTO j2c_trusted (guild_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [guildId, role.id]);
        return interaction.reply({ content: `✅ ${role} is now trusted (bypasses locks/limits).`, ephemeral: true });
      } else {
        await pool.query(`DELETE FROM j2c_trusted WHERE guild_id = $1 AND role_id = $2`, [guildId, role.id]);
        return interaction.reply({ content: `✅ ${role} removed from trusted roles.`, ephemeral: true });
      }
    }

    if (sub === "log") {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: "❌ Admin only.", ephemeral: true });
      const channel = interaction.options.getChannel("channel");
      await pool.query(`UPDATE j2c_config SET log_channel_id = $1 WHERE guild_id = $2`, [channel.id, guildId]);
      return interaction.reply({ content: `✅ VC logs will be sent to ${channel}.`, ephemeral: true });
    }

    // ==================== INFO ====================
    if (sub === "status") {
      const config = await pool.query(`SELECT * FROM j2c_config WHERE guild_id = $1`, [guildId]);
      if (!config.rows[0] || !config.rows[0].enabled) return interaction.reply({ content: "J2C is disabled in this server.", ephemeral: true });
      const c = config.rows[0];
      const trigger = interaction.guild.channels.cache.get(c.trigger_channel_id);
      const embed = new EmbedBuilder().setTitle("J2C Status").setColor(0x9146ff)
        .addFields({ name: "Enabled", value: "✅ Yes", inline: true }, { name: "Trigger Channel", value: trigger ? trigger.name : "Unknown", inline: true }, { name: "Default Name", value: c.default_name || "{user}'s VC", inline: true }, { name: "Default Limit", value: c.default_limit === 0 ? "No limit" : `${c.default_limit}`, inline: true });
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === "info") {
      const channel = interaction.options.getChannel("channel") || interaction.member.voice?.channel;
      if (!channel) return interaction.reply({ content: "❌ You're not in a VC and no channel specified.", ephemeral: true });
      const data = await pool.query(`SELECT * FROM j2c_channels WHERE channel_id = $1`, [channel.id]);
      if (!data.rows[0]) return interaction.reply({ content: "That's not a J2C temp channel.", ephemeral: true });
      const d = data.rows[0];
      const owner = await client.users.fetch(d.owner_id).catch(() => null);
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle(`ℹ️ ${channel.name}`).setColor(0x9146ff).addFields({ name: "Owner", value: owner ? owner.tag : d.owner_id, inline: true }, { name: "Created", value: `<t:${Math.floor(new Date(d.created_at).getTime() / 1000)}:R>`, inline: true })] });
    }

    // ==================== GET OWNER VC ====================
    async function getOwnerVC() {
      const memberVC = interaction.member.voice?.channel;
      if (!memberVC) return null;
      const data = await pool.query(`SELECT * FROM j2c_channels WHERE channel_id = $1 AND owner_id = $2`, [memberVC.id, userId]);
      if (!data.rows[0]) {
        // Check if admin override
        if (interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
          const anyData = await pool.query(`SELECT * FROM j2c_channels WHERE channel_id = $1`, [memberVC.id]);
          return anyData.rows[0] ? { ...anyData.rows[0], adminOverride: true } : null;
        }
        return null;
      }
      return data.rows[0];
    }

    // ==================== OWNER COMMANDS ====================
    if (["showcase", "name", "limit", "lock", "unlock", "hide", "show", "kick", "ban", "unban", "transfer", "reset"].includes(sub)) {
      const vcData = await getOwnerVC();
      if (!vcData) return interaction.reply({ content: "❌ You must be in your own J2C temp VC to use this command.", ephemeral: true });
      const vc = interaction.guild.channels.cache.get(vcData.channel_id);
      if (!vc) return interaction.reply({ content: "❌ Your VC no longer exists.", ephemeral: true });
    }

    if (sub === "showcase") {
      const vcData = await getOwnerVC();
      if (!vcData) return;
      const vc = interaction.guild.channels.cache.get(vcData.channel_id);

      const embed = new EmbedBuilder().setTitle(`🎛️ VC Control — ${vc.name}`).setColor(0x9146ff)
        .addFields({ name: "Owner", value: `<@${vcData.owner_id}>`, inline: true }, { name: "Limit", value: vc.userLimit === 0 ? "None" : `${vc.userLimit}`, inline: true }, { name: "Locked", value: vc.permissionsFor(interaction.guild.roles.everyone).has("Connect") ? "🔓 No" : "🔒 Yes", inline: true });

      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("j2c_rename").setLabel("✏️ Rename").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("j2c_limit").setLabel("👥 Limit").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("j2c_lock").setLabel("🔒 Lock").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("j2c_unlock").setLabel("🔓 Unlock").setStyle(ButtonStyle.Secondary)
      );
      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("j2c_hide").setLabel("🙈 Hide").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("j2c_show").setLabel("👁️ Show").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("j2c_kick").setLabel("👢 Kick").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId("j2c_ban").setLabel("🚫 Ban").setStyle(ButtonStyle.Danger)
      );

      const msg = await interaction.reply({ embeds: [embed], components: [row1, row2], ephemeral: true, fetchReply: true });
      const collector = msg.createMessageComponentCollector({ time: 300000 });

      collector.on("collect", async (btn) => {
        if (btn.user.id !== userId) return btn.reply({ content: "❌ Not your panel.", ephemeral: true });
        const currentVC = interaction.guild.channels.cache.get(vcData.channel_id);
        if (!currentVC) { collector.stop(); return btn.reply({ content: "❌ VC deleted.", ephemeral: true }); }

        try {
          if (btn.customId === "j2c_rename") {
            const modal = new ModalBuilder().setCustomId("j2c_modal_rename").setTitle("Rename VC");
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("name").setLabel("New name").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100).setValue(currentVC.name)));
            await btn.showModal(modal);
            const submitted = await btn.awaitModalSubmit({ time: 60000 }).catch(() => null);
            if (!submitted) return;
            await submitted.deferUpdate();
            const newName = submitted.fields.getTextInputValue("name");
            await currentVC.setName(newName);
            return btn.followUp({ content: `✅ Renamed to **${newName}**. Or use \`/j2c name\``, ephemeral: true });
          }

          if (btn.customId === "j2c_limit") {
            const modal = new ModalBuilder().setCustomId("j2c_modal_limit").setTitle("Set User Limit");
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("limit").setLabel("0-99, 0 = no limit").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(2).setValue(String(currentVC.userLimit || 0))));
            await btn.showModal(modal);
            const submitted = await btn.awaitModalSubmit({ time: 60000 }).catch(() => null);
            if (!submitted) return;
            await submitted.deferUpdate();
            const limit = parseInt(submitted.fields.getTextInputValue("limit"));
            if (isNaN(limit) || limit < 0 || limit > 99) return btn.followUp({ content: "❌ Invalid limit (0-99).", ephemeral: true });
            await currentVC.setUserLimit(limit);
            return btn.followUp({ content: `✅ Limit set to ${limit === 0 ? "none" : limit}. Or use \`/j2c limit\``, ephemeral: true });
          }

          await btn.deferUpdate();
          if (btn.customId === "j2c_lock") { await currentVC.permissionOverwrites.edit(interaction.guild.roles.everyone, { Connect: false }); return btn.followUp({ content: "🔒 VC locked. Or use `/j2c lock`", ephemeral: true }); }
          if (btn.customId === "j2c_unlock") { await currentVC.permissionOverwrites.edit(interaction.guild.roles.everyone, { Connect: null }); return btn.followUp({ content: "🔓 VC unlocked. Or use `/j2c unlock`", ephemeral: true }); }
          if (btn.customId === "j2c_hide") { await currentVC.permissionOverwrites.edit(interaction.guild.roles.everyone, { ViewChannel: false }); return btn.followUp({ content: "🙈 VC hidden. Or use `/j2c hide`", ephemeral: true }); }
          if (btn.customId === "j2c_show") { await currentVC.permissionOverwrites.edit(interaction.guild.roles.everyone, { ViewChannel: null }); return btn.followUp({ content: "👁️ VC visible. Or use `/j2c show`", ephemeral: true }); }

          if (btn.customId === "j2c_kick" || btn.customId === "j2c_ban") {
            const menu = new UserSelectMenuBuilder().setCustomId(btn.customId === "j2c_kick" ? "j2c_select_kick" : "j2c_select_ban").setPlaceholder(`Select user to ${btn.customId === "j2c_kick" ? "kick" : "ban"}`);
            await btn.followUp({ content: `Select a user to **${btn.customId === "j2c_kick" ? "kick" : "ban"}**:`, components: [new ActionRowBuilder().addComponents(menu)], ephemeral: true });
          }
        } catch (err) {
          console.error("J2C Button Error:", err);
          btn.followUp({ content: `❌ Button failed. Use the slash command instead: \`/j2c ${btn.customId.replace("j2c_", "")}\``, ephemeral: true }).catch(() => {});
        }
      });

      collector.on("end", () => { interaction.editReply({ components: [] }).catch(() => {}); });
      return;
    }

    // ==================== SLASH OWNER COMMANDS ====================
    if (sub === "name") {
      const vcData = await getOwnerVC();
      if (!vcData) return;
      const vc = interaction.guild.channels.cache.get(vcData.channel_id);
      const name = interaction.options.getString("name");
      await vc.setName(name);
      return interaction.reply({ content: `✅ VC renamed to **${name}**.`, ephemeral: true });
    }

    if (sub === "limit") {
      const vcData = await getOwnerVC();
      if (!vcData) return;
      const vc = interaction.guild.channels.cache.get(vcData.channel_id);
      const limit = interaction.options.getInteger("limit");
      await vc.setUserLimit(limit);
      return interaction.reply({ content: `✅ Limit set to **${limit === 0 ? "none" : limit}**.`, ephemeral: true });
    }

    if (sub === "lock") {
      const vcData = await getOwnerVC();
      if (!vcData) return;
      const vc = interaction.guild.channels.cache.get(vcData.channel_id);
      await vc.permissionOverwrites.edit(interaction.guild.roles.everyone, { Connect: false });
      return interaction.reply({ content: "🔒 VC locked.", ephemeral: true });
    }

    if (sub === "unlock") {
      const vcData = await getOwnerVC();
      if (!vcData) return;
      const vc = interaction.guild.channels.cache.get(vcData.channel_id);
      await vc.permissionOverwrites.edit(interaction.guild.roles.everyone, { Connect: null });
      return interaction.reply({ content: "🔓 VC unlocked.", ephemeral: true });
    }

    if (sub === "hide") {
      const vcData = await getOwnerVC();
      if (!vcData) return;
      const vc = interaction.guild.channels.cache.get(vcData.channel_id);
      await vc.permissionOverwrites.edit(interaction.guild.roles.everyone, { ViewChannel: false });
      return interaction.reply({ content: "🙈 VC hidden.", ephemeral: true });
    }

    if (sub === "show") {
      const vcData = await getOwnerVC();
      if (!vcData) return;
      const vc = interaction.guild.channels.cache.get(vcData.channel_id);
      await vc.permissionOverwrites.edit(interaction.guild.roles.everyone, { ViewChannel: null });
      return interaction.reply({ content: "👁️ VC visible.", ephemeral: true });
    }

    if (sub === "kick") {
      const vcData = await getOwnerVC();
      if (!vcData) return;
      const vc = interaction.guild.channels.cache.get(vcData.channel_id);
      const user = interaction.options.getUser("user");
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);
      if (!member || !member.voice.channel || member.voice.channelId !== vc.id) return interaction.reply({ content: "❌ User is not in your VC.", ephemeral: true });
      await member.voice.disconnect();
      return interaction.reply({ content: `👢 Kicked **${user.tag}**.`, ephemeral: true });
    }

    if (sub === "ban") {
      const vcData = await getOwnerVC();
      if (!vcData) return;
      const vc = interaction.guild.channels.cache.get(vcData.channel_id);
      const user = interaction.options.getUser("user");
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);
      if (member?.voice.channelId === vc.id) await member.voice.disconnect();
      await vc.permissionOverwrites.create(user.id, { Connect: false });
      await pool.query(`INSERT INTO j2c_bans (guild_id, channel_id, user_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, [guildId, vc.id, user.id]);
      return interaction.reply({ content: `🚫 Banned **${user.tag}** from your VC.`, ephemeral: true });
    }

    if (sub === "unban") {
      const vcData = await getOwnerVC();
      if (!vcData) return;
      const vc = interaction.guild.channels.cache.get(vcData.channel_id);
      const user = interaction.options.getUser("user");
      await vc.permissionOverwrites.delete(user.id).catch(() => {});
      await pool.query(`DELETE FROM j2c_bans WHERE channel_id = $1 AND user_id = $2`, [vc.id, user.id]);
      return interaction.reply({ content: `✅ Unbanned **${user.tag}**.`, ephemeral: true });
    }

    if (sub === "transfer") {
      const vcData = await getOwnerVC();
      if (!vcData) return;
      const vc = interaction.guild.channels.cache.get(vcData.channel_id);
      const user = interaction.options.getUser("user");
      await pool.query(`UPDATE j2c_channels SET owner_id = $1 WHERE channel_id = $2`, [user.id, vc.id]);
      return interaction.reply({ content: `✅ Ownership transferred to **${user.tag}**.`, ephemeral: true });
    }

    if (sub === "reset") {
      const vcData = await getOwnerVC();
      if (!vcData) return;
      const vc = interaction.guild.channels.cache.get(vcData.channel_id);
      const config = await pool.query(`SELECT default_name, default_limit FROM j2c_config WHERE guild_id = $1`, [guildId]);
      const name = (config.rows[0]?.default_name || "{user}'s VC").replace("{user}", interaction.user.displayName);
      await vc.setName(name);
      await vc.setUserLimit(config.rows[0]?.default_limit || 0);
      await vc.permissionOverwrites.edit(interaction.guild.roles.everyone, { Connect: null, ViewChannel: null });
      return interaction.reply({ content: "✅ VC reset to defaults.", ephemeral: true });
    }

    // ==================== CLAIM ====================
    if (sub === "claim") {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: "❌ Admin only.", ephemeral: true });
      const channel = interaction.options.getChannel("channel") || interaction.member.voice?.channel;
      if (!channel) return interaction.reply({ content: "❌ You're not in a VC and no channel specified.", ephemeral: true });
      const data = await pool.query(`SELECT * FROM j2c_channels WHERE channel_id = $1`, [channel.id]);
      if (!data.rows[0]) return interaction.reply({ content: "That's not a J2C temp channel.", ephemeral: true });
      await pool.query(`UPDATE j2c_channels SET owner_id = $1 WHERE channel_id = $2`, [userId, channel.id]);
      return interaction.reply({ content: `✅ You now own ${channel}.`, ephemeral: true });
    }
  },
};
