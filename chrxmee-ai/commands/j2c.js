const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, UserSelectMenuBuilder } = require("discord.js");

// Custom emojis
const E = {
  success: "<:Verified_Icon:1527194184841167010>",
  error: "<:no:1530373946795364362>",
  rename: "<:Pencil:1530377899251601408>",
  limit: "<:member:1530383558710005960>",
  lock: "<:lock:1530377198324945056>",
  unlock: "<:unlock:1530377714995826831>",
  hide: "<:hellokitty_hide:1530376139854577735>",
  show: "<:nobara_SIDEEYE:1525658447045988382>",
  kick: "<:Personkick:1530376715698704574>",
  ban: "<:hammer:1530375976381448303>",
  ai: "<:Chrxmaticc_AI:1480094799292928132>",
  settings: "<:Settings:1525601248278216725>",
};

function brandEmbed(title, desc, color = 0x9146ff) {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(desc)
    .setFooter({ text: "Chrxmaticc AI · 炫克人工智能" })
    .setTimestamp();
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("j2c")
    .setDescription("join to create — manage your temporary vc")
    // Admin
    .addSubcommand(sub => sub.setName("setup").setDescription("set the trigger vc channel")
      .addChannelOption(opt => opt.setName("channel").setDescription("voice channel to use as trigger").setRequired(true).addChannelTypes(ChannelType.GuildVoice)))
    .addSubcommand(sub => sub.setName("disable").setDescription("disable the j2c system"))
    .addSubcommand(sub => sub.setName("category").setDescription("set category for temp vcs")
      .addChannelOption(opt => opt.setName("category").setDescription("category channel").setRequired(true).addChannelTypes(ChannelType.GuildCategory)))
    .addSubcommand(sub => sub.setName("default-name").setDescription("set default name format. use {user} for username")
      .addStringOption(opt => opt.setName("format").setDescription("name format (e.g. {user}'s room)").setRequired(true).setMaxLength(100)))
    .addSubcommand(sub => sub.setName("default-limit").setDescription("set default user limit for new vcs")
      .addIntegerOption(opt => opt.setName("limit").setDescription("0 = no limit, max 99").setRequired(true).setMinValue(0).setMaxValue(99)))
    .addSubcommand(sub => sub.setName("trusted").setDescription("add/remove a trusted role that bypasses locks")
      .addRoleOption(opt => opt.setName("role").setDescription("the role").setRequired(true))
      .addStringOption(opt => opt.setName("action").setDescription("add or remove").setRequired(true).addChoices({ name: "Add", value: "add" }, { name: "Remove", value: "remove" })))
    .addSubcommand(sub => sub.setName("log").setDescription("set log channel for vc events")
      .addChannelOption(opt => opt.setName("channel").setDescription("text channel for logs").setRequired(true)))
    // Info
    .addSubcommand(sub => sub.setName("status").setDescription("view j2c config for this server"))
    .addSubcommand(sub => sub.setName("info").setDescription("info about a temp vc")
      .addChannelOption(opt => opt.setName("channel").setDescription("the vc to check").setRequired(false).addChannelTypes(ChannelType.GuildVoice)))
    // Owner
    .addSubcommand(sub => sub.setName("showcase").setDescription("open vc control panel with buttons"))
    .addSubcommand(sub => sub.setName("name").setDescription("rename your vc")
      .addStringOption(opt => opt.setName("name").setDescription("new name").setRequired(true).setMaxLength(100)))
    .addSubcommand(sub => sub.setName("limit").setDescription("set user limit for your vc")
      .addIntegerOption(opt => opt.setName("limit").setDescription("0-99, 0 = no limit").setRequired(true).setMinValue(0).setMaxValue(99)))
    .addSubcommand(sub => sub.setName("lock").setDescription("lock your vc"))
    .addSubcommand(sub => sub.setName("unlock").setDescription("unlock your vc"))
    .addSubcommand(sub => sub.setName("hide").setDescription("hide your vc from @everyone"))
    .addSubcommand(sub => sub.setName("show").setDescription("make your vc visible to @everyone"))
    .addSubcommand(sub => sub.setName("kick").setDescription("kick someone from your vc")
      .addUserOption(opt => opt.setName("user").setDescription("user to kick").setRequired(true)))
    .addSubcommand(sub => sub.setName("ban").setDescription("ban someone from your vc")
      .addUserOption(opt => opt.setName("user").setDescription("user to ban").setRequired(true)))
    .addSubcommand(sub => sub.setName("unban").setDescription("unban someone from your vc")
      .addUserOption(opt => opt.setName("user").setDescription("user to unban").setRequired(true)))
    .addSubcommand(sub => sub.setName("transfer").setDescription("transfer ownership to someone else")
      .addUserOption(opt => opt.setName("user").setDescription("new owner").setRequired(true)))
    .addSubcommand(sub => sub.setName("reset").setDescription("reset your vc to default name and limit"))
    // Admin override
    .addSubcommand(sub => sub.setName("claim").setDescription("(admin) claim ownership of a temp vc")
      .addChannelOption(opt => opt.setName("channel").setDescription("the vc to claim").setRequired(false).addChannelTypes(ChannelType.GuildVoice))),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const pool = client.pool;

    async function requireAdmin() {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ embeds: [brandEmbed(`${E.error} no permission`, "you need the administrator permission to use this command.", 0xff0000)], ephemeral: true });
        return false;
      }
      return true;
    }

    // ==================== ADMIN SETUP ====================
    if (sub === "setup") {
      if (!await requireAdmin()) return;
      const channel = interaction.options.getChannel("channel");
      await pool.query(`INSERT INTO j2c_config (guild_id, trigger_channel_id) VALUES ($1, $2) ON CONFLICT (guild_id) DO UPDATE SET trigger_channel_id = $2, enabled = TRUE`, [guildId, channel.id]);
      return interaction.reply({ embeds: [brandEmbed(`${E.success} j2c setup complete`, `users who join ${channel} will get their own temporary voice channel.`)], ephemeral: true });
    }

    if (sub === "disable") {
      if (!await requireAdmin()) return;
      await pool.query(`UPDATE j2c_config SET enabled = FALSE WHERE guild_id = $1`, [guildId]);
      return interaction.reply({ embeds: [brandEmbed(`${E.success} j2c disabled`, "the join to create system has been turned off.")], ephemeral: true });
    }

    if (sub === "category") {
      if (!await requireAdmin()) return;
      const cat = interaction.options.getChannel("category");
      await pool.query(`INSERT INTO j2c_config (guild_id, category_id) VALUES ($1, $2) ON CONFLICT (guild_id) DO UPDATE SET category_id = $2`, [guildId, cat.id]);
      return interaction.reply({ embeds: [brandEmbed(`${E.success} category set`, `new temp vcs will be created under **${cat.name}**.`)], ephemeral: true });
    }

    if (sub === "default-name") {
      if (!await requireAdmin()) return;
      const format = interaction.options.getString("format");
      await pool.query(`INSERT INTO j2c_config (guild_id, default_name) VALUES ($1, $2) ON CONFLICT (guild_id) DO UPDATE SET default_name = $2`, [guildId, format]);
      return interaction.reply({ embeds: [brandEmbed(`${E.success} default name updated`, `new vcs will be named \`${format}\`. use \`{user}\` for the member's name.`)], ephemeral: true });
    }

    if (sub === "default-limit") {
      if (!await requireAdmin()) return;
      const limit = interaction.options.getInteger("limit");
      await pool.query(`INSERT INTO j2c_config (guild_id, default_limit) VALUES ($1, $2) ON CONFLICT (guild_id) DO UPDATE SET default_limit = $2`, [guildId, limit]);
      return interaction.reply({ embeds: [brandEmbed(`${E.success} default limit updated`, `limit set to **${limit === 0 ? "no limit" : limit}**.`)], ephemeral: true });
    }

    if (sub === "trusted") {
      if (!await requireAdmin()) return;
      const role = interaction.options.getRole("role");
      const action = interaction.options.getString("action");
      if (action === "add") {
        await pool.query(`INSERT INTO j2c_trusted (guild_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [guildId, role.id]);
        return interaction.reply({ embeds: [brandEmbed(`${E.success} trusted role added`, `${role} can now bypass vc locks and limits.`)], ephemeral: true });
      } else {
        await pool.query(`DELETE FROM j2c_trusted WHERE guild_id = $1 AND role_id = $2`, [guildId, role.id]);
        return interaction.reply({ embeds: [brandEmbed(`${E.success} trusted role removed`, `${role} no longer has trusted access.`)], ephemeral: true });
      }
    }

    if (sub === "log") {
      if (!await requireAdmin()) return;
      const channel = interaction.options.getChannel("channel");
      await pool.query(`UPDATE j2c_config SET log_channel_id = $1 WHERE guild_id = $2`, [channel.id, guildId]);
      return interaction.reply({ embeds: [brandEmbed(`${E.success} log channel set`, `vc events will be logged in ${channel}.`)], ephemeral: true });
    }

    // ==================== INFO ====================
    if (sub === "status") {
      const config = await pool.query(`SELECT * FROM j2c_config WHERE guild_id = $1`, [guildId]);
      if (!config.rows[0] || !config.rows[0].enabled) return interaction.reply({ embeds: [brandEmbed(`${E.error} j2c status`, "j2c is currently disabled in this server.", 0xff0000)], ephemeral: true });
      const c = config.rows[0];
      const trigger = interaction.guild.channels.cache.get(c.trigger_channel_id);
      const embed = brandEmbed(`${E.settings} j2c configuration`, null)
        .addFields(
          { name: "enabled", value: `${E.success} yes`, inline: true },
          { name: "trigger channel", value: trigger ? `${trigger.name}` : "unknown", inline: true },
          { name: "default name", value: c.default_name || "{user}'s vc", inline: true },
          { name: "default limit", value: c.default_limit === 0 ? "no limit" : `${c.default_limit}`, inline: true }
        );
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === "info") {
      const channel = interaction.options.getChannel("channel") || interaction.member.voice?.channel;
      if (!channel) return interaction.reply({ embeds: [brandEmbed(`${E.error} error`, "you're not in a vc and no channel specified.", 0xff0000)], ephemeral: true });
      const data = await pool.query(`SELECT * FROM j2c_channels WHERE channel_id = $1`, [channel.id]);
      if (!data.rows[0]) return interaction.reply({ embeds: [brandEmbed(`${E.error} error`, "that's not a j2c temp channel.", 0xff0000)], ephemeral: true });
      const d = data.rows[0];
      const owner = await client.users.fetch(d.owner_id).catch(() => null);
      const embed = brandEmbed(`🔊 ${channel.name}`, null)
        .addFields(
          { name: "owner", value: owner ? `${owner.username}` : d.owner_id, inline: true },
          { name: "created", value: `<t:${Math.floor(new Date(d.created_at).getTime() / 1000)}:R>`, inline: true }
        );
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ==================== GET OWNER VC ====================
    async function getOwnerVC() {
      const memberVC = interaction.member.voice?.channel;
      if (!memberVC) return null;
      const data = await pool.query(`SELECT * FROM j2c_channels WHERE channel_id = $1 AND owner_id = $2`, [memberVC.id, userId]);
      if (!data.rows[0]) {
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
      if (!vcData) return interaction.reply({ embeds: [brandEmbed(`${E.error} not your vc`, "you must be in your own j2c temp vc to use this command.", 0xff0000)], ephemeral: true });
      const vc = interaction.guild.channels.cache.get(vcData.channel_id);
      if (!vc) return interaction.reply({ embeds: [brandEmbed(`${E.error} vc missing`, "your vc no longer exists.", 0xff0000)], ephemeral: true });
    }

    if (sub === "showcase") {
      const vcData = await getOwnerVC();
      if (!vcData) return;
      const vc = interaction.guild.channels.cache.get(vcData.channel_id);

      const locked = vc.permissionsFor(interaction.guild.roles.everyone).has("Connect") ? "no" : "yes";
      const lockEmoji = locked === "yes" ? E.lock : E.unlock;

      const embed = brandEmbed(`${E.ai} vc control — ${vc.name}`, null)
        .addFields(
          { name: "owner", value: `<@${vcData.owner_id}>`, inline: true },
          { name: "limit", value: vc.userLimit === 0 ? "none" : `${vc.userLimit}`, inline: true },
          { name: "locked", value: `${lockEmoji} ${locked}`, inline: true }
        );

      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("j2c_rename").setEmoji({ id: "1530377899251601408" }).setLabel("rename").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("j2c_limit").setEmoji({ id: "1530383558710005960" }).setLabel("limit").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("j2c_lock").setEmoji({ id: "1530377198324945056" }).setLabel("lock").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("j2c_unlock").setEmoji({ id: "1530377714995826831" }).setLabel("unlock").setStyle(ButtonStyle.Secondary)
      );
      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("j2c_hide").setEmoji({ id: "1530376139854577735" }).setLabel("hide").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("j2c_show").setEmoji({ id: "1525658447045988382" }).setLabel("show").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("j2c_kick").setEmoji({ id: "1530376715698704574" }).setLabel("kick").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId("j2c_ban").setEmoji({ id: "1530375976381448303" }).setLabel("ban").setStyle(ButtonStyle.Danger)
      );

      const msg = await interaction.reply({ embeds: [embed], components: [row1, row2], ephemeral: true, fetchReply: true });
      const collector = msg.createMessageComponentCollector({ time: 300000 });

      collector.on("collect", async (btn) => {
        if (btn.user.id !== userId) return btn.reply({ content: `${E.error} not your panel.`, ephemeral: true });
        const currentVC = interaction.guild.channels.cache.get(vcData.channel_id);
        if (!currentVC) { collector.stop(); return btn.reply({ content: `${E.error} vc deleted.`, ephemeral: true }); }

        try {
          if (btn.customId === "j2c_rename") {
            const modal = new ModalBuilder().setCustomId("j2c_modal_rename").setTitle("rename vc");
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("name").setLabel("new name").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100).setValue(currentVC.name)));
            await btn.showModal(modal);
            const submitted = await btn.awaitModalSubmit({ time: 60000 }).catch(() => null);
            if (!submitted) return;
            await submitted.deferUpdate();
            const newName = submitted.fields.getTextInputValue("name");
            await currentVC.setName(newName);
            return btn.followUp({ embeds: [brandEmbed(`${E.success} renamed`, `vc is now **${newName}**. or use \`/j2c name\``)], ephemeral: true });
          }

          if (btn.customId === "j2c_limit") {
            const modal = new ModalBuilder().setCustomId("j2c_modal_limit").setTitle("set user limit");
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("limit").setLabel("0-99, 0 = no limit").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(2).setValue(String(currentVC.userLimit || 0))));
            await btn.showModal(modal);
            const submitted = await btn.awaitModalSubmit({ time: 60000 }).catch(() => null);
            if (!submitted) return;
            await submitted.deferUpdate();
            const limit = parseInt(submitted.fields.getTextInputValue("limit"));
            if (isNaN(limit) || limit < 0 || limit > 99) return btn.followUp({ embeds: [brandEmbed(`${E.error} invalid`, "limit must be 0-99.", 0xff0000)], ephemeral: true });
            await currentVC.setUserLimit(limit);
            return btn.followUp({ embeds: [brandEmbed(`${E.success} limit set`, `limit is now ${limit === 0 ? "none" : limit}. or use \`/j2c limit\``)], ephemeral: true });
          }

          await btn.deferUpdate();
          if (btn.customId === "j2c_lock") { await currentVC.permissionOverwrites.edit(interaction.guild.roles.everyone, { Connect: false }); return btn.followUp({ embeds: [brandEmbed(`${E.lock} locked`, "your vc is locked. or use `/j2c lock`")], ephemeral: true }); }
          if (btn.customId === "j2c_unlock") { await currentVC.permissionOverwrites.edit(interaction.guild.roles.everyone, { Connect: null }); return btn.followUp({ embeds: [brandEmbed(`${E.unlock} unlocked`, "your vc is unlocked. or use `/j2c unlock`")], ephemeral: true }); }
          if (btn.customId === "j2c_hide") { await currentVC.permissionOverwrites.edit(interaction.guild.roles.everyone, { ViewChannel: false }); return btn.followUp({ embeds: [brandEmbed(`${E.hide} hidden`, "your vc is hidden. or use `/j2c hide`")], ephemeral: true }); }
          if (btn.customId === "j2c_show") { await currentVC.permissionOverwrites.edit(interaction.guild.roles.everyone, { ViewChannel: null }); return btn.followUp({ embeds: [brandEmbed(`${E.show} visible`, "your vc is visible. or use `/j2c show`")], ephemeral: true }); }

          if (btn.customId === "j2c_kick" || btn.customId === "j2c_ban") {
            const menu = new UserSelectMenuBuilder().setCustomId(btn.customId === "j2c_kick" ? "j2c_select_kick" : "j2c_select_ban").setPlaceholder(`select user to ${btn.customId === "j2c_kick" ? "kick" : "ban"}`);
            await btn.followUp({ content: `select a user to **${btn.customId === "j2c_kick" ? "kick" : "ban"}**:`, components: [new ActionRowBuilder().addComponents(menu)], ephemeral: true });
          }
        } catch (err) {
          console.error("J2C Button Error:", err);
          btn.followUp({ content: `${E.error} button failed. use the slash command instead: \`/j2c ${btn.customId.replace("j2c_", "")}\``, ephemeral: true }).catch(() => {});
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
      return interaction.reply({ embeds: [brandEmbed(`${E.success} renamed`, `vc renamed to **${name}**.`)], ephemeral: true });
    }

    if (sub === "limit") {
      const vcData = await getOwnerVC();
      if (!vcData) return;
      const vc = interaction.guild.channels.cache.get(vcData.channel_id);
      const limit = interaction.options.getInteger("limit");
      await vc.setUserLimit(limit);
      return interaction.reply({ embeds: [brandEmbed(`${E.success} limit set`, `limit set to **${limit === 0 ? "none" : limit}**.`)], ephemeral: true });
    }

    if (sub === "lock") {
      const vcData = await getOwnerVC();
      if (!vcData) return;
      const vc = interaction.guild.channels.cache.get(vcData.channel_id);
      await vc.permissionOverwrites.edit(interaction.guild.roles.everyone, { Connect: false });
      return interaction.reply({ embeds: [brandEmbed(`${E.lock} locked`, "vc locked.")], ephemeral: true });
    }

    if (sub === "unlock") {
      const vcData = await getOwnerVC();
      if (!vcData) return;
      const vc = interaction.guild.channels.cache.get(vcData.channel_id);
      await vc.permissionOverwrites.edit(interaction.guild.roles.everyone, { Connect: null });
      return interaction.reply({ embeds: [brandEmbed(`${E.unlock} unlocked`, "vc unlocked.")], ephemeral: true });
    }

    if (sub === "hide") {
      const vcData = await getOwnerVC();
      if (!vcData) return;
      const vc = interaction.guild.channels.cache.get(vcData.channel_id);
      await vc.permissionOverwrites.edit(interaction.guild.roles.everyone, { ViewChannel: false });
      return interaction.reply({ embeds: [brandEmbed(`${E.hide} hidden`, "vc hidden.")], ephemeral: true });
    }

    if (sub === "show") {
      const vcData = await getOwnerVC();
      if (!vcData) return;
      const vc = interaction.guild.channels.cache.get(vcData.channel_id);
      await vc.permissionOverwrites.edit(interaction.guild.roles.everyone, { ViewChannel: null });
      return interaction.reply({ embeds: [brandEmbed(`${E.show} visible`, "vc visible.")], ephemeral: true });
    }

    if (sub === "kick") {
      const vcData = await getOwnerVC();
      if (!vcData) return;
      const vc = interaction.guild.channels.cache.get(vcData.channel_id);
      const user = interaction.options.getUser("user");
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);
      if (!member || !member.voice.channel || member.voice.channelId !== vc.id) return interaction.reply({ embeds: [brandEmbed(`${E.error} not found`, "user is not in your vc.", 0xff0000)], ephemeral: true });
      await member.voice.disconnect();
      return interaction.reply({ embeds: [brandEmbed(`${E.kick} kicked`, `**${user.username}** kicked.`)], ephemeral: true });
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
      return interaction.reply({ embeds: [brandEmbed(`${E.ban} banned`, `**${user.username}** banned from your vc.`)], ephemeral: true });
    }

    if (sub === "unban") {
      const vcData = await getOwnerVC();
      if (!vcData) return;
      const vc = interaction.guild.channels.cache.get(vcData.channel_id);
      const user = interaction.options.getUser("user");
      await vc.permissionOverwrites.delete(user.id).catch(() => {});
      await pool.query(`DELETE FROM j2c_bans WHERE channel_id = $1 AND user_id = $2`, [vc.id, user.id]);
      return interaction.reply({ embeds: [brandEmbed(`${E.success} unbanned`, `**${user.username}** unbanned.`)], ephemeral: true });
    }

    if (sub === "transfer") {
      const vcData = await getOwnerVC();
      if (!vcData) return;
      const vc = interaction.guild.channels.cache.get(vcData.channel_id);
      const user = interaction.options.getUser("user");
      await pool.query(`UPDATE j2c_channels SET owner_id = $1 WHERE channel_id = $2`, [user.id, vc.id]);
      return interaction.reply({ embeds: [brandEmbed(`${E.success} transferred`, `ownership given to **${user.username}**.`)], ephemeral: true });
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
      return interaction.reply({ embeds: [brandEmbed(`${E.success} reset`, "vc reset to default settings.")], ephemeral: true });
    }

    // ==================== CLAIM ====================
    if (sub === "claim") {
      if (!await requireAdmin()) return;
      const channel = interaction.options.getChannel("channel") || interaction.member.voice?.channel;
      if (!channel) return interaction.reply({ embeds: [brandEmbed(`${E.error} error`, "you're not in a vc and no channel specified.", 0xff0000)], ephemeral: true });
      const data = await pool.query(`SELECT * FROM j2c_channels WHERE channel_id = $1`, [channel.id]);
      if (!data.rows[0]) return interaction.reply({ embeds: [brandEmbed(`${E.error} error`, "that's not a j2c temp channel.", 0xff0000)], ephemeral: true });
      await pool.query(`UPDATE j2c_channels SET owner_id = $1 WHERE channel_id = $2`, [userId, channel.id]);
      return interaction.reply({ embeds: [brandEmbed(`${E.success} claimed`, `you now own ${channel}.`)], ephemeral: true });
    }
  },
};
