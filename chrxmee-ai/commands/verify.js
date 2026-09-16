const {
  SlashCommandBuilder,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ChannelSelectMenuBuilder,
  RoleSelectMenuBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
  ChannelType,
} = require('discord.js');

const { config, store, panel, presets, engine, antiRaid, constants } = require('../cogs/verification');
const { METHODS, FAIL_ACTIONS, AGE_GATE_ACTIONS, ALT_SIGNALS } = constants;

const E = {
  success:  "<:Verified_Icon:1527194184841167010>",
  error:    "<:no:1530373946795364362>",
  settings: "<:Settings:1525601248278216725>",
  on:       "<:on:1545571641684135946>",
  off:      "<:off:1545571608897265726>",
  lock:     "<:lock:1530377198324945056>",
  member:   "<:member:1530383558710005960>",
  channel:  "<:Channel:1531901854361849929>",
  file:     "<:File_Icon:1526542046213570681>",
  folder:   "<:Folder_Icon:1526542112806539274>",
  compass:  "<:Compass_Discover_Icon:1526542192494248067>",
  wheel:    "<:Adaption_Wheel:1526537780229046342>",
};

const V2 = MessageFlags.IsComponentsV2;
const V2_E = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;

const errBox = (m) => new ContainerBuilder().setAccentColor(0xff3b3b)
  .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.error} ${m}`));
const okBox = (m) => new ContainerBuilder().setAccentColor(0x57f287)
  .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.success} ${m}`));

/* ───── main container ───── */
function buildMain(guildId, hint) {
  const cfg = config.get(guildId);
  const c = new ContainerBuilder().setAccentColor(cfg.enabled ? 0x57f287 : 0x5b7fd4);
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.wheel} verification setup`));
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${hint || 'configure verification for this server'}`));
  c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));

  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`${cfg.enabled ? E.on : E.off} **status:** ${cfg.enabled ? 'enabled' : 'disabled'}`));
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.compass} **methods:** ${(cfg.methods || []).map(m => `\`${m}\``).join(' ') || '*none*'} · primary \`${cfg.methodPrimary || 'n/a'}\``));
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.member} **roles:** unver \`${cfg.roleUnverified ? 'set' : '—'}\` · ver \`${cfg.roleVerified ? 'set' : '—'}\` · quar \`${cfg.roleQuarantine ? 'set' : '—'}\``));
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.file} **panel:** ${cfg.panelChannel ? `<#${cfg.panelChannel}>` : '*not posted*'}`));
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.lock} **antiraid:** \`${cfg.antiraidEnabled ? 'on' : 'off'}\` · threshold \`${cfg.antiraidThreshold}/${cfg.antiraidWindowSeconds}s\``));
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.wheel} **age gate:** \`${cfg.ageGateEnabled ? 'on' : 'off'}\` · \`${cfg.ageGateDays}d\` → \`${cfg.ageGateAction}\``));
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.error} **on fail:** \`${cfg.failAction}\` · remember \`${cfg.rememberDays}d\``));
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.settings} **bloxlink trap:** \`${cfg.bloxlinkTrap ? 'on' : 'off'}\` · strip-on-detect \`${cfg.bloxlinkStripOnDetect ? 'on' : 'off'}\``));

  c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));

  const r1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ver_methods').setLabel('methods').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('ver_roles').setLabel('roles').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('ver_captcha').setLabel('captcha cfg').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('ver_antiraid').setLabel('antiraid').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('ver_agegate').setLabel('age gate').setStyle(ButtonStyle.Secondary),
  );
  const r2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ver_alt').setLabel('alt signals').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('ver_bloxlink').setLabel('bloxlink').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('ver_dm').setLabel('dm messages').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('ver_logs').setLabel('log channel').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('ver_welcome').setLabel('welcome').setStyle(ButtonStyle.Secondary),
  );
  const r3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ver_panel_post').setLabel('post panel').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('ver_panel_preview').setLabel('preview').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('ver_toggle').setLabel(cfg.enabled ? 'disable' : 'enable').setStyle(cfg.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
    new ButtonBuilder().setCustomId('ver_presets').setLabel('presets').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('ver_save').setLabel('close').setStyle(ButtonStyle.Secondary),
  );
  c.addActionRowComponents(r1, r2, r3);
  return c;
}

/* ───── helpers ───── */
async function pickMenu(interaction, userId, id, title, options, multi = false, min = 1, max = 25) {
  const menu = new StringSelectMenuBuilder().setCustomId(id).setPlaceholder('pick').addOptions(options);
  if (multi) menu.setMinValues(min).setMaxValues(max);
  const c = new ContainerBuilder().setAccentColor(0x5b7fd4)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${title}`))
    .addActionRowComponents(new ActionRowBuilder().addComponents(menu));
  await interaction.editReply({ components: [c], flags: V2_E });
  const msg = await interaction.fetchReply();
  const p = await msg.awaitMessageComponent({ time: 60000, filter: i => i.user.id === userId }).catch(() => null);
  if (!p) return null;
  await p.deferUpdate().catch(() => {});
  return p;
}

async function pickChannel(interaction, userId, title, types = [ChannelType.GuildText, ChannelType.GuildAnnouncement]) {
  const menu = new ChannelSelectMenuBuilder().setCustomId('ver_channel').setPlaceholder('pick a channel').addChannelTypes(...types);
  const c = new ContainerBuilder().setAccentColor(0x5b7fd4)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.channel} ${title}`))
    .addActionRowComponents(new ActionRowBuilder().addComponents(menu));
  await interaction.editReply({ components: [c], flags: V2_E });
  const msg = await interaction.fetchReply();
  const p = await msg.awaitMessageComponent({ time: 60000, filter: i => i.user.id === userId }).catch(() => null);
  if (!p) return null;
  await p.deferUpdate().catch(() => {});
  return p.values[0];
}

async function pickRole(interaction, userId, title) {
  const menu = new RoleSelectMenuBuilder().setCustomId('ver_role').setPlaceholder('pick a role');
  const c = new ContainerBuilder().setAccentColor(0x5b7fd4)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.member} ${title}`))
    .addActionRowComponents(new ActionRowBuilder().addComponents(menu));
  await interaction.editReply({ components: [c], flags: V2_E });
  const msg = await interaction.fetchReply();
  const p = await msg.awaitMessageComponent({ time: 60000, filter: i => i.user.id === userId }).catch(() => null);
  if (!p) return null;
  await p.deferUpdate().catch(() => {});
  return p.values[0];
}

async function openModal(interaction, userId, modal, label = 'open modal') {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ver_open_modal').setLabel(label).setStyle(ButtonStyle.Primary)
  );
  const c = new ContainerBuilder().setAccentColor(0x5b7fd4)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${modal.data.title}`))
    .addActionRowComponents(row);
  await interaction.editReply({ components: [c], flags: V2_E });
  const msg = await interaction.fetchReply();
  const open = await msg.awaitMessageComponent({ time: 60000, filter: i => i.user.id === userId }).catch(() => null);
  if (!open) return null;
  await open.showModal(modal).catch(() => {});
  const sub = await open.awaitModalSubmit({ time: 120000, filter: m => m.customId === modal.data.custom_id && m.user.id === userId }).catch(() => null);
  if (!sub) return null;
  await sub.deferUpdate().catch(() => {});
  return sub;
}

/* ───── command ───── */
module.exports = {
  data: new SlashCommandBuilder()
    .setName('verification')
    .setDescription('configure verification for this server')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
    .addSubcommand(s => s.setName('setup').setDescription('open the verification builder'))
    .addSubcommand(s => s.setName('presets').setDescription('apply a preset'))
    .addSubcommand(s => s.setName('panel').setDescription('post / edit the panel'))
    .addSubcommand(s => s.setName('enable').setDescription('enable verification'))
    .addSubcommand(s => s.setName('disable').setDescription('disable verification'))
    .addSubcommand(s => s.setName('stats').setDescription('verification stats'))
    .addSubcommand(s => s.setName('logs').setDescription('recent verify attempts'))
    .addSubcommand(s => s.setName('force-verify').setDescription('manually verify a user')
      .addUserOption(o => o.setName('user').setDescription('user').setRequired(true)))
    .addSubcommand(s => s.setName('force-fail').setDescription('manually quarantine a user')
      .addUserOption(o => o.setName('user').setDescription('user').setRequired(true)))
    .addSubcommand(s => s.setName('reset').setDescription('reset a user\'s verify state')
      .addUserOption(o => o.setName('user').setDescription('user').setRequired(true)))
    .addSubcommand(s => s.setName('reset-config').setDescription('wipe all verification config for this guild')),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
      return interaction.reply({ components: [errBox('manage server required.')], flags: V2_E });
    }

    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    const guildId = interaction.guild.id;

    /* ─── enable / disable ─── */
    if (sub === 'enable' || sub === 'disable') {
      await interaction.deferReply({ flags: V2_E });
      const missing = config.missingSetup(guildId);
      if (sub === 'enable' && missing.length) {
        return interaction.editReply({
          components: [errBox(`cannot enable — missing: ${missing.join(', ')}`)],
          flags: V2_E,
        });
      }
      config.set(guildId, { enabled: sub === 'enable' });
      return interaction.editReply({
        components: [okBox(`verification ${sub === 'enable' ? 'enabled' : 'disabled'}.`)],
        flags: V2_E,
      });
    }

    /* ─── presets ─── */
    if (sub === 'presets') {
      await interaction.deferReply({ flags: V2_E });
      const p = await pickMenu(interaction, userId, 'ver_preset_pick', `${E.wheel} pick a preset`,
        presets.map(x => new StringSelectMenuOptionBuilder().setLabel(x.label).setValue(x.id).setDescription(x.desc)));
      if (!p) return interaction.editReply({ components: [okBox('cancelled.')], flags: V2_E });
      const preset = presets.find(x => x.id === p.values[0]);
      if (!preset) return interaction.editReply({ components: [errBox('preset not found.')], flags: V2_E });
      config.set(guildId, { ...preset.config, preset: preset.id });
      return interaction.editReply({
        components: [okBox(`applied preset **${preset.label}**.\n-# remember to set roles and post the panel before enabling.`)],
        flags: V2_E,
      });
    }

    /* ─── stats ─── */
    if (sub === 'stats') {
      await interaction.deferReply({ flags: V2_E });
      const s = store.getStats(guildId);
      const cfg = config.get(guildId);
      const c = new ContainerBuilder().setAccentColor(0x5b7fd4);
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.wheel} verification stats`));
      c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent([
        `${E.success} verified: ${s.verified}`,
        `${E.error} failed: ${s.failed}`,
        `${E.off} expired: ${s.expired}`,
        `${E.lock} quarantined: ${s.quarantined}`,
        `${E.compass} bloxlink trapped: ${s.bloxlink}`,
      ].join('\n')));
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# enabled: \`${cfg.enabled}\` · methods: \`${(cfg.methods || []).join(',')}\``));
      return interaction.editReply({ components: [c], flags: V2_E });
    }

    /* ─── logs ─── */
    if (sub === 'logs') {
      await interaction.deferReply({ flags: V2_E });
      const rows = store.getAttempts(guildId, 20);
      const c = new ContainerBuilder().setAccentColor(0x5b7fd4);
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.file} recent verify attempts`));
      c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
      if (!rows.length) c.addTextDisplayComponents(new TextDisplayBuilder().setContent('-# no attempts yet.'));
      else {
        const lines = rows.map(r => {
          const icon = r.result === 'success' ? E.success : E.error;
          return `${icon} <t:${Math.floor(r.at / 1000)}:R> · <@${r.userId}> · \`${r.method}\` · \`${r.result}\`${r.reason ? ` · \`${r.reason}\`` : ''}`;
        });
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')));
      }
      return interaction.editReply({ components: [c], flags: V2_E });
    }

    /* ─── force-verify / force-fail / reset ─── */
    if (sub === 'force-verify' || sub === 'force-fail' || sub === 'reset') {
      await interaction.deferReply({ flags: V2_E });
      const target = interaction.options.getUser('user');
      const member = await interaction.guild.members.fetch(target.id).catch(() => null);
      if (!member) return interaction.editReply({ components: [errBox('member not in server.')], flags: V2_E });

      if (sub === 'force-verify') {
        await engine.grantVerified(member, 'manual-staff');
        return interaction.editReply({ components: [okBox(`verified <@${target.id}>.`)], flags: V2_E });
      }
      if (sub === 'force-fail') {
        await engine.punishFail(member, 'staff_action');
        return interaction.editReply({ components: [okBox(`punished <@${target.id}>.`)], flags: V2_E });
      }
      if (sub === 'reset') {
        store.setUser(guildId, target.id, {
          status: 'unverified', method: null, attempts: 0,
          verifiedAt: null, expiresAt: null, quarantinedAt: null,
        });
        const cfg = config.get(guildId);
        if (cfg.roleVerified && member.roles.cache.has(cfg.roleVerified)) {
          await member.roles.remove(cfg.roleVerified).catch(() => {});
        }
        if (cfg.roleUnverified && !member.roles.cache.has(cfg.roleUnverified)) {
          await member.roles.add(cfg.roleUnverified).catch(() => {});
        }
        return interaction.editReply({ components: [okBox(`reset <@${target.id}>.`)], flags: V2_E });
      }
    }

    /* ─── reset-config ─── */
    if (sub === 'reset-config') {
      await interaction.deferReply({ flags: V2_E });
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ver_rc_yes').setLabel('yes, wipe').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('ver_rc_no').setLabel('cancel').setStyle(ButtonStyle.Secondary),
      );
      const c = new ContainerBuilder().setAccentColor(0xff3b3b)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.error} wipe ALL verification config for this server?\n-# this cannot be undone.`))
        .addActionRowComponents(row);
      await interaction.editReply({ components: [c], flags: V2_E });
      const msg = await interaction.fetchReply();
      const pick = await msg.awaitMessageComponent({ time: 60000, filter: i => i.user.id === userId }).catch(() => null);
      if (!pick) return;
      await pick.deferUpdate().catch(() => {});
      if (pick.customId === 'ver_rc_yes') {
        config.reset(guildId);
        return interaction.editReply({ components: [okBox('wiped.')], flags: V2_E });
      }
      return interaction.editReply({ components: [okBox('cancelled.')], flags: V2_E });
    }

    /* ─── panel / setup: full builder UI ─── */
    await interaction.deferReply({ flags: V2_E });

    if (sub === 'panel') {
      /* quick panel shortcut */
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ver_quick_post').setLabel('post panel').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('ver_quick_edit').setLabel('edit in-place').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('ver_quick_preview').setLabel('preview').setStyle(ButtonStyle.Secondary),
      );
      const c = new ContainerBuilder().setAccentColor(0x5b7fd4)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.file} panel manager`))
        .addActionRowComponents(row);
      await interaction.editReply({ components: [c], flags: V2_E });
      const msg = await interaction.fetchReply();
      const pick = await msg.awaitMessageComponent({ time: 60000, filter: i => i.user.id === userId }).catch(() => null);
      if (!pick) return;
      await pick.deferUpdate().catch(() => {});

      if (pick.customId === 'ver_quick_post') {
        const ch = await pickChannel(interaction, userId, 'pick a channel for the panel');
        if (!ch) return;
        await panel.post(interaction.client, guildId, ch);
        return interaction.editReply({ components: [okBox(`panel posted in <#${ch}>.`)], flags: V2_E });
      }
      if (pick.customId === 'ver_quick_edit') {
        const ok = await panel.edit(interaction.client, guildId);
        return interaction.editReply({ components: [ok ? okBox('panel updated.') : errBox('no panel to update.')], flags: V2_E });
      }
      if (pick.customId === 'ver_quick_preview') {
        const preview = panel.buildPreview(config.get(guildId));
        return interaction.editReply({ components: [okBox('preview below:'), preview], flags: V2_E });
      }
      return;
    }

    /* ─── setup: main builder ─── */
    await interaction.editReply({ components: [buildMain(guildId, 'configure everything from the buttons below')], flags: V2_E });
    const builder = await interaction.fetchReply();
    const col = builder.createMessageComponentCollector({ time: 900000 });
    const redraw = () => builder.edit({ components: [buildMain(guildId)] }).catch(() => {});
    const recover = (m) => builder.edit({ components: [buildMain(guildId, m || 'cancelled')] }).catch(() => {});

    col.on('collect', async btn => {
      if (btn.user.id !== userId) return btn.reply({ components: [errBox('not yours.')], flags: V2_E }).catch(() => {});

      /* ── methods ── */
      if (btn.customId === 'ver_methods') {
        await btn.deferUpdate().catch(() => {});
        const cfg = config.get(guildId);
        const opts = METHODS.map(m => new StringSelectMenuOptionBuilder()
          .setLabel(`${cfg.methods.includes(m.id) ? '✅ ' : ''}${m.label}`)
          .setValue(m.id)
          .setDescription(m.desc));
        const p = await pickMenu(interaction, userId, 'ver_methods_pick', `${E.compass} pick methods (multi)`, opts, true, 1, METHODS.length);
        if (!p) return recover();
        config.set(guildId, { methods: p.values });
        /* pick primary */
        const opts2 = p.values.map(id => new StringSelectMenuOptionBuilder()
          .setLabel(METHODS.find(m => m.id === id).label).setValue(id));
        const p2 = await pickMenu(interaction, userId, 'ver_primary_pick', `${E.compass} pick the primary method`, opts2);
        if (p2) config.set(guildId, { methodPrimary: p2.values[0] });
        return redraw();
      }

      /* ── roles ── */
      if (btn.customId === 'ver_roles') {
        await btn.deferUpdate().catch(() => {});
        const cfg = config.get(guildId);
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('ver_role_uv').setLabel(`unverified: ${cfg.roleUnverified ? 'set' : '—'}`).setStyle(cfg.roleUnverified ? ButtonStyle.Success : ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('ver_role_v').setLabel(`verified: ${cfg.roleVerified ? 'set' : '—'}`).setStyle(cfg.roleVerified ? ButtonStyle.Success : ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('ver_role_q').setLabel(`quarantine: ${cfg.roleQuarantine ? 'set' : '—'}`).setStyle(cfg.roleQuarantine ? ButtonStyle.Success : ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('ver_role_bl').setLabel(`bloxlink: ${cfg.roleBloxlink ? 'set' : '—'}`).setStyle(cfg.roleBloxlink ? ButtonStyle.Success : ButtonStyle.Secondary),
        );
        const back = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('ver_roles_back').setLabel('done').setStyle(ButtonStyle.Primary)
        );
        const c = new ContainerBuilder().setAccentColor(0x5b7fd4)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.member} role mapping`))
          .addTextDisplayComponents(new TextDisplayBuilder().setContent('click any button to set that role.'))
          .addActionRowComponents(row, back);
        await interaction.editReply({ components: [c], flags: V2_E });
        const msg = await interaction.fetchReply();
        const pick = await msg.awaitMessageComponent({ time: 120000, filter: i => i.user.id === userId }).catch(() => null);
        if (!pick) return recover();
        await pick.deferUpdate().catch(() => {});
        if (pick.customId === 'ver_roles_back') return redraw();
        const map = {
          ver_role_uv: 'roleUnverified',
          ver_role_v: 'roleVerified',
          ver_role_q: 'roleQuarantine',
          ver_role_bl: 'roleBloxlink',
        };
        const field = map[pick.customId];
        if (field) {
          const rid = await pickRole(interaction, userId, `pick role for ${field}`);
          if (rid) config.set(guildId, { [field]: rid });
        }
        return redraw();
      }

      /* ── captcha cfg ── */
      if (btn.customId === 'ver_captcha') {
        const modal = new ModalBuilder().setCustomId('ver_captcha_modal').setTitle('captcha config');
        const cfg = config.get(guildId);
        modal.addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('len').setLabel('code length (4-7)').setStyle(TextInputStyle.Short).setRequired(true).setValue(String(cfg.captchaLength)).setMaxLength(1)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cs').setLabel('case sensitive? (yes/no)').setStyle(TextInputStyle.Short).setRequired(true).setValue(cfg.captchaCaseSensitive ? 'yes' : 'no').setMaxLength(3)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('exp').setLabel('expiry seconds').setStyle(TextInputStyle.Short).setRequired(true).setValue(String(cfg.captchaExpirySeconds)).setMaxLength(4)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('att').setLabel('max attempts').setStyle(TextInputStyle.Short).setRequired(true).setValue(String(cfg.captchaMaxAttempts)).setMaxLength(2)),
        );
        await btn.showModal(modal).catch(() => {});
        const s = await btn.awaitModalSubmit({ time: 60000, filter: m => m.customId === 'ver_captcha_modal' && m.user.id === userId }).catch(() => null);
        if (!s) return;
        await s.deferUpdate().catch(() => {});
        config.set(guildId, {
          captchaLength: Math.min(7, Math.max(4, parseInt(s.fields.getTextInputValue('len'), 10) || 5)),
          captchaCaseSensitive: s.fields.getTextInputValue('cs').toLowerCase().startsWith('y'),
          captchaExpirySeconds: Math.max(60, Math.min(3600, parseInt(s.fields.getTextInputValue('exp'), 10) || 300)),
          captchaMaxAttempts: Math.max(1, Math.min(10, parseInt(s.fields.getTextInputValue('att'), 10) || 3)),
        });
        return redraw();
      }

      /* ── antiraid ── */
      if (btn.customId === 'ver_antiraid') {
        await btn.deferUpdate().catch(() => {});
        const cfg = config.get(guildId);
        config.set(guildId, { antiraidEnabled: !cfg.antiraidEnabled });
        const modal = new ModalBuilder().setCustomId('ver_ar_modal').setTitle('antiraid config');
        modal.addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('th').setLabel('joins threshold').setStyle(TextInputStyle.Short).setRequired(true).setValue(String(cfg.antiraidThreshold)).setMaxLength(3)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('win').setLabel('window (seconds)').setStyle(TextInputStyle.Short).setRequired(true).setValue(String(cfg.antiraidWindowSeconds)).setMaxLength(3)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('dur').setLabel('raid duration (minutes)').setStyle(TextInputStyle.Short).setRequired(true).setValue(String(cfg.antiraidDurationMinutes)).setMaxLength(3)),
        );
        await btn.showModal(modal).catch(() => {});
        const s = await btn.awaitModalSubmit({ time: 60000, filter: m => m.customId === 'ver_ar_modal' && m.user.id === userId }).catch(() => null);
        if (!s) return;
        await s.deferUpdate().catch(() => {});
        config.set(guildId, {
          antiraidThreshold: Math.max(3, Math.min(100, parseInt(s.fields.getTextInputValue('th'), 10) || 15)),
          antiraidWindowSeconds: Math.max(10, Math.min(600, parseInt(s.fields.getTextInputValue('win'), 10) || 60)),
          antiraidDurationMinutes: Math.max(1, Math.min(120, parseInt(s.fields.getTextInputValue('dur'), 10) || 10)),
        });
        return redraw();
      }

      /* ── age gate ── */
      if (btn.customId === 'ver_agegate') {
        await btn.deferUpdate().catch(() => {});
        const cfg = config.get(guildId);
        config.set(guildId, { ageGateEnabled: !cfg.ageGateEnabled });
        const opts = AGE_GATE_ACTIONS.map(a => new StringSelectMenuOptionBuilder().setLabel(a.label).setValue(a.id));
        const p = await pickMenu(interaction, userId, 'ver_ag_action', `${E.wheel} pick action if too young`, opts);
        if (p) config.set(guildId, { ageGateAction: p.values[0] });
        const modal = new ModalBuilder().setCustomId('ver_ag_modal').setTitle('age gate');
        modal.addComponents(new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('d').setLabel('min account age (days)').setStyle(TextInputStyle.Short).setRequired(true).setValue(String(cfg.ageGateDays)).setMaxLength(3)
        ));
        await interaction.editReply({ components: [new ContainerBuilder().setAccentColor(0x5b7fd4).addTextDisplayComponents(new TextDisplayBuilder().setContent('set min age...'))], flags: V2_E });
        const btnMsg = await interaction.fetchReply();
        const open = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('ver_ag_open').setLabel('open modal').setStyle(ButtonStyle.Primary)
        );
        await interaction.editReply({ components: [new ContainerBuilder().setAccentColor(0x5b7fd4)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.wheel} set min age`))
          .addActionRowComponents(open)], flags: V2_E });
        const bm = await interaction.fetchReply();
        const o = await bm.awaitMessageComponent({ time: 60000, filter: i => i.user.id === userId }).catch(() => null);
        if (o) {
          await o.showModal(modal).catch(() => {});
          const s = await o.awaitModalSubmit({ time: 60000, filter: m => m.customId === 'ver_ag_modal' && m.user.id === userId }).catch(() => null);
          if (s) { await s.deferUpdate().catch(() => {}); config.set(guildId, { ageGateDays: Math.max(1, Math.min(365, parseInt(s.fields.getTextInputValue('d'), 10) || 7)) }); }
        }
        return redraw();
      }

      /* ── alt signals ── */
      if (btn.customId === 'ver_alt') {
        await btn.deferUpdate().catch(() => {});
        const cfg = config.get(guildId);
        const opts = ALT_SIGNALS.map(a => new StringSelectMenuOptionBuilder()
          .setLabel(`${cfg.altSignals.includes(a.id) ? '✅ ' : ''}${a.label}`)
          .setValue(a.id).setDescription(`${a.desc} · weight ${a.weight}`));
        const p = await pickMenu(interaction, userId, 'ver_alt_pick', `${E.error} pick alt signals (multi)`, opts, true, 0, ALT_SIGNALS.length);
        if (p) config.set(guildId, { altSignals: p.values });
        return redraw();
      }

      /* ── bloxlink ── */
      if (btn.customId === 'ver_bloxlink') {
        await btn.deferUpdate().catch(() => {});
        const cfg = config.get(guildId);
        const row1 = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('ver_bl_trap').setLabel(`trap: ${cfg.bloxlinkTrap ? 'on' : 'off'}`).setStyle(cfg.bloxlinkTrap ? ButtonStyle.Success : ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('ver_bl_stripd').setLabel(`strip-on-detect: ${cfg.bloxlinkStripOnDetect ? 'on' : 'off'}`).setStyle(cfg.bloxlinkStripOnDetect ? ButtonStyle.Success : ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('ver_bl_stripv').setLabel(`strip-on-verify: ${cfg.bloxlinkStripOnVerify ? 'on' : 'off'}`).setStyle(cfg.bloxlinkStripOnVerify ? ButtonStyle.Success : ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('ver_bl_dm').setLabel(`auto-dm: ${cfg.bloxlinkAutoDm ? 'on' : 'off'}`).setStyle(cfg.bloxlinkAutoDm ? ButtonStyle.Success : ButtonStyle.Secondary),
        );
        const row2 = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('ver_bl_role').setLabel(`set bloxlink role: ${cfg.roleBloxlink ? 'set' : '—'}`).setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('ver_bl_back').setLabel('done').setStyle(ButtonStyle.Primary),
        );
        const c = new ContainerBuilder().setAccentColor(0x5b7fd4)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.lock} bloxlink trap`))
          .addTextDisplayComponents(new TextDisplayBuilder().setContent('when bloxlink adds its role, chromed forces the user through chromed verification.'))
          .addActionRowComponents(row1, row2);
        await interaction.editReply({ components: [c], flags: V2_E });
        const msg = await interaction.fetchReply();
        const pick = await msg.awaitMessageComponent({ time: 120000, filter: i => i.user.id === userId }).catch(() => null);
        if (!pick) return recover();
        await pick.deferUpdate().catch(() => {});
        if (pick.customId === 'ver_bl_back') return redraw();
        if (pick.customId === 'ver_bl_trap') return config.set(guildId, { bloxlinkTrap: !cfg.bloxlinkTrap }), redraw();
        if (pick.customId === 'ver_bl_stripd') return config.set(guildId, { bloxlinkStripOnDetect: !cfg.bloxlinkStripOnDetect }), redraw();
        if (pick.customId === 'ver_bl_stripv') return config.set(guildId, { bloxlinkStripOnVerify: !cfg.bloxlinkStripOnVerify }), redraw();
        if (pick.customId === 'ver_bl_dm') return config.set(guildId, { bloxlinkAutoDm: !cfg.bloxlinkAutoDm }), redraw();
        if (pick.customId === 'ver_bl_role') {
          const rid = await pickRole(interaction, userId, 'pick the bloxlink role');
          if (rid) config.set(guildId, { roleBloxlink: rid });
          return redraw();
        }
        return;
      }

      /* ── dm messages ── */
      if (btn.customId === 'ver_dm') {
        await btn.deferUpdate().catch(() => {});
        const opts = [
          ['dmOnJoin', 'on join'],
          ['dmBloxlinkDetected', 'on bloxlink detect'],
          ['dmVerifySuccess', 'on success'],
          ['dmVerifyFail', 'on fail'],
          ['dmQuarantine', 'on quarantine'],
        ].map(([k, l]) => new StringSelectMenuOptionBuilder().setLabel(l).setValue(k));
        const p = await pickMenu(interaction, userId, 'ver_dm_pick', `${E.settings} pick a dm to edit`, opts);
        if (!p) return recover();
        const key = p.values[0];
        const modal = new ModalBuilder().setCustomId('ver_dm_modal').setTitle('dm message');
        modal.addComponents(new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('v').setLabel(key).setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(500)
            .setValue(config.get(guildId)[key] || '').setPlaceholder('{user} {server} {channel} {reason}')
        ));
        await interaction.editReply({ components: [new ContainerBuilder().setAccentColor(0x5b7fd4).addTextDisplayComponents(new TextDisplayBuilder().setContent('set message...'))], flags: V2_E });
        const open = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('ver_dm_open').setLabel('open modal').setStyle(ButtonStyle.Primary)
        );
        await interaction.editReply({ components: [new ContainerBuilder().setAccentColor(0x5b7fd4)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.settings} edit ${key}`))
          .addActionRowComponents(open)], flags: V2_E });
        const bm = await interaction.fetchReply();
        const o = await bm.awaitMessageComponent({ time: 60000, filter: i => i.user.id === userId }).catch(() => null);
        if (o) {
          await o.showModal(modal).catch(() => {});
          const s = await o.awaitModalSubmit({ time: 60000, filter: m => m.customId === 'ver_dm_modal' && m.user.id === userId }).catch(() => null);
          if (s) { await s.deferUpdate().catch(() => {}); config.set(guildId, { [key]: s.fields.getTextInputValue('v') }); }
        }
        return redraw();
      }

      /* ── log channel ── */
      if (btn.customId === 'ver_logs') {
        await btn.deferUpdate().catch(() => {});
        const ch = await pickChannel(interaction, userId, 'pick a log channel');
        if (ch) config.set(guildId, { logChannel: ch });
        return redraw();
      }

      /* ── welcome ── */
      if (btn.customId === 'ver_welcome') {
        await btn.deferUpdate().catch(() => {});
        const ch = await pickChannel(interaction, userId, 'pick a welcome channel (verified users)');
        if (ch) config.set(guildId, { verifiedWelcomeChannel: ch });
        return redraw();
      }

      /* ── panel preview ── */
      if (btn.customId === 'ver_panel_preview') {
        await btn.deferUpdate().catch(() => {});
        const preview = panel.buildPreview(config.get(guildId));
        return btn.followUp({ components: [preview], flags: V2_E }).catch(() => {});
      }

      /* ── panel post ── */
      if (btn.customId === 'ver_panel_post') {
        await btn.deferUpdate().catch(() => {});
        const ch = await pickChannel(interaction, userId, 'pick a channel to post the panel in');
        if (!ch) return recover();
        await panel.post(interaction.client, guildId, ch);
        return redraw();
      }

      /* ── presets ── */
      if (btn.customId === 'ver_presets') {
        await btn.deferUpdate().catch(() => {});
        const opts = presets.map(x => new StringSelectMenuOptionBuilder().setLabel(x.label).setValue(x.id).setDescription(x.desc));
        const p = await pickMenu(interaction, userId, 'ver_preset_pick2', `${E.wheel} presets`, opts);
        if (p) {
          const preset = presets.find(x => x.id === p.values[0]);
          config.set(guildId, { ...preset.config, preset: preset.id });
        }
        return redraw();
      }

      /* ── toggle ── */
      if (btn.customId === 'ver_toggle') {
        await btn.deferUpdate().catch(() => {});
        const cfg = config.get(guildId);
        if (!cfg.enabled) {
          const missing = config.missingSetup(guildId);
          if (missing.length) return recover(`cannot enable — missing: ${missing.join(', ')}`);
          config.set(guildId, { enabled: true });
        } else {
          config.set(guildId, { enabled: false });
        }
        return redraw();
      }

      /* ── save / close ── */
      if (btn.customId === 'ver_save') {
        await btn.deferUpdate().catch(() => {});
        await interaction.editReply({
          components: [okBox(`verification config saved. status: \`${config.get(guildId).enabled ? 'enabled' : 'disabled'}\``)],
          flags: V2_E,
        }).catch(() => {});
        col.stop('saved');
        return;
      }
    });

    col.on('end', (_, r) => {
      if (r === 'time') interaction.editReply({ components: [errBox('builder timed out.')], flags: V2_E }).catch(() => {});
    });
  },
};
