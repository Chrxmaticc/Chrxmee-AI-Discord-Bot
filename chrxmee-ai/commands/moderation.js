const {
  SlashCommandBuilder, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
  ChannelSelectMenuBuilder, RoleSelectMenuBuilder, ContainerBuilder, TextDisplayBuilder,
  SeparatorBuilder, SeparatorSpacingSize, MessageFlags, ChannelType,
} = require('discord.js');

const { store, constants } = require('../cogs/moderation');
const { AUTOMOD_RULES, ESCALATION_PRESETS } = constants;

const E = {
  success:  "<:Verified_Icon:1527194184841167010>",
  error:    "<:no:1530373946795364362>",
  settings: "<:Settings:1525601248278216725>",
  file:     "<:File_Icon:1526542046213570681>",
  folder:   "<:Folder_Icon:1526542112806539274>",
  warn:     "<:angry_cry:1526029511882440744>",
  lock:     "<:lock:1530377198324945056>",
  ban:      "<:hammer:1530375976381448303>",
  kick:     "<:Personkick:1530376715698704574>",
  on:       "<:on:1545571641684135946>",
  off:      "<:off:1545571608897265726>",
  compass:  "<:Compass_Discover_Icon:1526542192494248067>",
  wheel:    "<:Adaption_Wheel:1526537780229046342>",
  member:   "<:member:1530383558710005960>",
  channel:  "<:Channel:1531901854361849929>",
  owner:    "<:Owner:1525494515169759253>",
};

const V2_E = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;

const errBox = (m) => new ContainerBuilder().setAccentColor(0xff3b3b)
  .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.error} ${m}`));
const okBox = (m) => new ContainerBuilder().setAccentColor(0x57f287)
  .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.success} ${m}`));

async function ackModal(sub) {
  try { await sub.deferReply({ flags: 64 }); await sub.deleteReply(); } catch {}
}

function awaitNext(interaction, userId, time = 60000) {
  return new Promise(resolve => {
    const col = interaction.createMessageComponentCollector({ time, max: 1, filter: i => i.user.id === userId });
    col.on('collect', i => resolve(i));
    col.on('end', (_, reason) => { if (reason === 'time') resolve(null); });
  });
}

function buildMain(guildId, hint) {
  const c = store.getConfig(guildId);
  const cont = new ContainerBuilder().setAccentColor(c.enabled ? 0x57f287 : 0x5b7fd4);
  cont.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.wheel} moderation setup`));
  cont.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${hint || 'configure moderation for this server'}`));
  cont.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
  cont.addTextDisplayComponents(new TextDisplayBuilder().setContent(`${c.enabled ? E.on : E.off} **status:** ${c.enabled ? 'enabled' : 'disabled'}`));
  cont.addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.file} **modlog:** ${c.logChannel ? `<#${c.logChannel}>` : '*not set*'}`));
  cont.addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.warn} **escalation:** ${c.escalation.length} rule(s) · warn expiry \`${c.warnExpiryDays}d\``));
  cont.addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.lock} **automod:** \`${c.automodEnabled ? 'on' : 'off'}\` · rules \`${c.automodRules.length}\``));
  cont.addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.ban} **raid mode:** \`${c.raidEnabled ? 'on' : 'off'}\` · \`${c.raidThreshold}/${c.raidWindowSeconds}s\``));
  cont.addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.member} **immune:** ${c.immuneRoles.length} role(s) · ${c.immuneUsers.length} user(s)`));
  cont.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));

  const r1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('mod_log').setLabel('modlog channels').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('mod_esc').setLabel('escalation').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('mod_automod').setLabel('automod').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('mod_raid').setLabel('raid mode').setStyle(ButtonStyle.Secondary),
  );
  const r2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('mod_immune').setLabel('immune roles/users').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('mod_dm').setLabel('dm templates').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('mod_presets').setLabel('presets').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('mod_warns').setLabel('warn expiry').setStyle(ButtonStyle.Secondary),
  );
  const r3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('mod_toggle').setLabel(c.enabled ? 'disable' : 'enable').setStyle(c.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
    new ButtonBuilder().setCustomId('mod_close').setLabel('close').setStyle(ButtonStyle.Secondary),
  );
  cont.addActionRowComponents(r1, r2, r3);
  return cont;
}

async function pickMenu(interaction, userId, title, options, multi = false, min = 1, max = 5) {
  const menu = new StringSelectMenuBuilder().setCustomId('pick').setPlaceholder('pick').addOptions(options);
  if (multi) menu.setMinValues(min).setMaxValues(max);
  await interaction.editReply({ components: [new ContainerBuilder().setAccentColor(0x5b7fd4)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${title}`))
    .addActionRowComponents(new ActionRowBuilder().addComponents(menu))] }).catch(() => {});
  const p = await awaitNext(interaction, userId, 60000);
  if (!p) return null;
  await p.deferUpdate().catch(() => {});
  return p;
}

async function pickChannel(interaction, userId, title) {
  const menu = new ChannelSelectMenuBuilder().setCustomId('pick_ch').setPlaceholder('pick a channel').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement);
  await interaction.editReply({ components: [new ContainerBuilder().setAccentColor(0x5b7fd4)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.channel} ${title}`))
    .addActionRowComponents(new ActionRowBuilder().addComponents(menu))] }).catch(() => {});
  const p = await awaitNext(interaction, userId, 60000);
  if (!p) return null;
  await p.deferUpdate().catch(() => {});
  return p.values[0];
}

async function pickRole(interaction, userId, title) {
  const menu = new RoleSelectMenuBuilder().setCustomId('pick_rl').setPlaceholder('pick a role');
  await interaction.editReply({ components: [new ContainerBuilder().setAccentColor(0x5b7fd4)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.member} ${title}`))
    .addActionRowComponents(new ActionRowBuilder().addComponents(menu))] }).catch(() => {});
  const p = await awaitNext(interaction, userId, 60000);
  if (!p) return null;
  await p.deferUpdate().catch(() => {});
  return p.values[0];
}

async function openModal(interaction, userId, modal, label = 'open') {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('open_modal').setLabel(label).setStyle(ButtonStyle.Primary)
  );
  await interaction.editReply({ components: [new ContainerBuilder().setAccentColor(0x5b7fd4)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${modal.data.title}`))
    .addActionRowComponents(row)] }).catch(() => {});
  const open = await awaitNext(interaction, userId, 60000);
  if (!open) return null;
  await open.showModal(modal).catch(() => {});
  const sub = await open.awaitModalSubmit({ time: 120000, filter: m => m.customId === modal.data.custom_id && m.user.id === userId }).catch(() => null);
  if (!sub) return null;
  await ackModal(sub);
  return sub;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('moderation')
    .setDescription('configure moderation for this server')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
    .addSubcommand(s => s.setName('setup').setDescription('open the moderation builder'))
    .addSubcommand(s => s.setName('enable').setDescription('enable moderation'))
    .addSubcommand(s => s.setName('disable').setDescription('disable moderation'))
    .addSubcommand(s => s.setName('stats').setDescription('server-wide moderation stats'))
    .addSubcommand(s => s.setName('watchlist').setDescription('view the watchlist'))
    .addSubcommand(s => s.setName('reset-config').setDescription('wipe all moderation config')),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
      return interaction.reply({ components: [errBox('manage server required.')], flags: V2_E });
    }
    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    const guildId = interaction.guild.id;

    if (sub === 'enable' || sub === 'disable') {
      await interaction.deferReply({ flags: V2_E });
      store.updateConfig(guildId, { enabled: sub === 'enable' });
      return interaction.editReply({ components: [okBox(`moderation ${sub === 'enable' ? 'enabled' : 'disabled'}.`)], flags: V2_E });
    }

    if (sub === 'stats') {
      await interaction.deferReply({ flags: V2_E });
      const s = store.stats(guildId);
      const c = new ContainerBuilder().setAccentColor(0x5b7fd4);
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.compass} moderation stats`));
      c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent([
        `${E.file} **total cases:** ${s.total}`,
        `${E.warn} **active warns:** ${s.activeWarns}`,
        '',
        `**by type:**`,
        ...Object.entries(s.byType).map(([t, n]) => `  \`${t}\` · ${n}`),
      ].join('\n')));
      return interaction.editReply({ components: [c], flags: V2_E });
    }

    if (sub === 'watchlist') {
      await interaction.deferReply({ flags: V2_E });
      const list = store.listWatchlist(guildId);
      if (!list.length) return interaction.editReply({ components: [errBox('watchlist empty.')], flags: V2_E });
      const lines = list.map(w => `<@${w.userId}> · *${w.reason.slice(0, 60)}* · <t:${Math.floor(w.at / 1000)}:R>`);
      return interaction.editReply({
        components: [new ContainerBuilder().setAccentColor(0x5b7fd4)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.owner} watchlist (${list.length})`))
          .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')))],
        flags: V2_E,
      });
    }

    if (sub === 'reset-config') {
      await interaction.deferReply({ flags: V2_E });
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('rc_yes').setLabel('yes, wipe').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('rc_no').setLabel('cancel').setStyle(ButtonStyle.Secondary),
      );
      await interaction.editReply({ components: [new ContainerBuilder().setAccentColor(0xff3b3b)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.error} wipe all moderation config? cannot be undone.`))
        .addActionRowComponents(row)], flags: V2_E });
      const pick = await awaitNext(interaction, userId, 60000);
      if (!pick) return;
      await pick.deferUpdate().catch(() => {});
      if (pick.customId === 'rc_yes') {
        store.resetConfig(guildId);
        return interaction.editReply({ components: [okBox('wiped.')], flags: V2_E });
      }
      return interaction.editReply({ components: [okBox('cancelled.')], flags: V2_E });
    }

    /* ── setup builder ── */
    await interaction.deferReply({ flags: V2_E });
    await interaction.editReply({ components: [buildMain(guildId)] }).catch(() => {});
    const redraw = (msg) => interaction.editReply({ components: [buildMain(guildId, msg)] }).catch(() => {});

    const col = interaction.createMessageComponentCollector({ time: 900000, filter: i => i.user.id === userId });

    col.on('collect', async btn => {
      try {
        /* modlog */
        if (btn.customId === 'mod_log') {
          await btn.deferUpdate().catch(() => {});
          const opts = [
            ['logChannel', 'unified'],
            ['logBans', 'bans'],
            ['logKicks', 'kicks'],
            ['logMutes', 'timeouts'],
            ['logWarns', 'warns'],
            ['logNotes', 'notes'],
            ['logDeletes', 'deletes'],
            ['logJoins', 'joins'],
            ['logLeaves', 'leaves'],
          ].map(([k, l]) => new StringSelectMenuOptionBuilder().setLabel(l).setValue(k));
          const p = await pickMenu(interaction, userId, `${E.file} pick a log to set`, opts);
          if (p) {
            const ch = await pickChannel(interaction, userId, `channel for ${p.values[0]}`);
            if (ch) store.updateConfig(guildId, { [p.values[0]]: ch });
          }
          return redraw();
        }

        /* escalation */
        if (btn.customId === 'mod_esc') {
          await btn.deferUpdate().catch(() => {});
          const config = store.getConfig(guildId);
          const opts = [
            new StringSelectMenuOptionBuilder().setLabel('view / clear rules').setValue('view'),
            new StringSelectMenuOptionBuilder().setLabel('add rule').setValue('add'),
            ...ESCALATION_PRESETS.map(p => new StringSelectMenuOptionBuilder().setLabel(`use preset: ${p.label}`).setValue(`preset_${p.id}`).setDescription(p.desc)),
          ];
          const p = await pickMenu(interaction, userId, `${E.warn} escalation rules`, opts);
          if (!p) return redraw();
          if (p.values[0] === 'add') {
            const m = new ModalBuilder().setCustomId('esc_add').setTitle('add escalation rule');
            m.addComponents(
              new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('w').setLabel('warn count').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(3)),
              new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('a').setLabel('action: timeout/kick/ban/tempban').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(10)),
              new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('d').setLabel('duration (blank for perm) e.g. 1h, 1d').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(5)),
            );
            const s = await openModal(interaction, userId, m, 'add rule');
            if (s) {
              const warns = parseInt(s.fields.getTextInputValue('w'), 10);
              const action = s.fields.getTextInputValue('a').toLowerCase();
              const dStr = s.fields.getTextInputValue('d');
              const dur = dStr ? parseDuration(dStr) : null;
              if (warns > 0 && ['timeout','kick','ban','tempban','mute'].includes(action)) {
                config.escalation.push({ warns, action, duration: dur });
                store.updateConfig(guildId, { escalation: config.escalation });
              }
            }
          } else if (p.values[0] === 'view') {
            store.updateConfig(guildId, { escalation: [] });
          } else if (p.values[0].startsWith('preset_')) {
            const preset = ESCALATION_PRESETS.find(x => x.id === p.values[0].slice(7));
            if (preset) store.updateConfig(guildId, { escalation: preset.rules });
          }
          return redraw();
        }

        /* automod */
        if (btn.customId === 'mod_automod') {
          await btn.deferUpdate().catch(() => {});
          const config = store.getConfig(guildId);
          const opts = [
            new StringSelectMenuOptionBuilder().setLabel(`${config.automodEnabled ? '✅ ' : '⬜ '}toggle automod`).setValue('toggle'),
            ...AUTOMOD_RULES.map(r => new StringSelectMenuOptionBuilder()
              .setLabel(`${config.automodRules.includes(r.id) ? '✅ ' : '⬜ '}${r.label}`)
              .setValue(`rule_${r.id}`)
              .setDescription(r.desc)),
            new StringSelectMenuOptionBuilder().setLabel('configure thresholds').setValue('thresholds'),
          ];
          const p = await pickMenu(interaction, userId, `${E.lock} automod`, opts);
          if (!p) return redraw();
          if (p.values[0] === 'toggle') {
            store.updateConfig(guildId, { automodEnabled: !config.automodEnabled });
          } else if (p.values[0] === 'thresholds') {
            const m = new ModalBuilder().setCustomId('am_th').setTitle('automod thresholds');
            m.addComponents(
              new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('men').setLabel('max mentions').setStyle(TextInputStyle.Short).setRequired(true).setValue(String(config.automodMentionCap)).setMaxLength(2)),
              new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cap').setLabel('caps %').setStyle(TextInputStyle.Short).setRequired(true).setValue(String(config.automodCapsPercent)).setMaxLength(3)),
              new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('sp').setLabel('spam: count').setStyle(TextInputStyle.Short).setRequired(true).setValue(String(config.automodSpamCount)).setMaxLength(2)),
              new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('spw').setLabel('spam: window seconds').setStyle(TextInputStyle.Short).setRequired(true).setValue(String(config.automodSpamWindow)).setMaxLength(3)),
            );
            const s = await openModal(interaction, userId, m, 'set thresholds');
            if (s) {
              store.updateConfig(guildId, {
                automodMentionCap: Math.max(1, Math.min(50, parseInt(s.fields.getTextInputValue('men'), 10) || 5)),
                automodCapsPercent: Math.max(50, Math.min(100, parseInt(s.fields.getTextInputValue('cap'), 10) || 70)),
                automodSpamCount: Math.max(2, Math.min(20, parseInt(s.fields.getTextInputValue('sp'), 10) || 4)),
                automodSpamWindow: Math.max(2, Math.min(60, parseInt(s.fields.getTextInputValue('spw'), 10) || 6)),
              });
            }
          } else if (p.values[0].startsWith('rule_')) {
            const id = p.values[0].slice(5);
            const has = config.automodRules.includes(id);
            const next = has ? config.automodRules.filter(r => r !== id) : [...config.automodRules, id];
            store.updateConfig(guildId, { automodRules: next });
          }
          return redraw();
        }

        /* raid */
        if (btn.customId === 'mod_raid') {
          await btn.deferUpdate().catch(() => {});
          const config = store.getConfig(guildId);
          const opts = [
            new StringSelectMenuOptionBuilder().setLabel(`${config.raidEnabled ? '✅ ' : '⬜ '}toggle raid mode`).setValue('toggle'),
            new StringSelectMenuOptionBuilder().setLabel('configure thresholds').setValue('config'),
          ];
          const p = await pickMenu(interaction, userId, `${E.ban} raid mode`, opts);
          if (!p) return redraw();
          if (p.values[0] === 'toggle') {
            store.updateConfig(guildId, { raidEnabled: !config.raidEnabled });
          } else {
            const m = new ModalBuilder().setCustomId('raid_th').setTitle('raid thresholds');
            m.addComponents(
              new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('t').setLabel('joins threshold').setStyle(TextInputStyle.Short).setRequired(true).setValue(String(config.raidThreshold)).setMaxLength(3)),
              new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('w').setLabel('window (seconds)').setStyle(TextInputStyle.Short).setRequired(true).setValue(String(config.raidWindowSeconds)).setMaxLength(3)),
              new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('d').setLabel('raid duration (minutes)').setStyle(TextInputStyle.Short).setRequired(true).setValue(String(config.raidDurationMinutes)).setMaxLength(3)),
            );
            const s = await openModal(interaction, userId, m, 'set thresholds');
            if (s) {
              store.updateConfig(guildId, {
                raidThreshold: Math.max(3, Math.min(100, parseInt(s.fields.getTextInputValue('t'), 10) || 15)),
                raidWindowSeconds: Math.max(10, Math.min(600, parseInt(s.fields.getTextInputValue('w'), 10) || 60)),
                raidDurationMinutes: Math.max(1, Math.min(120, parseInt(s.fields.getTextInputValue('d'), 10) || 10)),
              });
            }
          }
          return redraw();
        }

        /* immune roles/users */
        if (btn.customId === 'mod_immune') {
          await btn.deferUpdate().catch(() => {});
          const config = store.getConfig(guildId);
          const opts = [
            new StringSelectMenuOptionBuilder().setLabel('add immune role').setValue('role'),
            new StringSelectMenuOptionBuilder().setLabel('clear immune roles').setValue('clear_roles'),
            new StringSelectMenuOptionBuilder().setLabel('clear immune users').setValue('clear_users'),
            ...(config.immuneRoles.length ? config.immuneRoles.slice(0, 10).map(r => new StringSelectMenuOptionBuilder().setLabel(`remove role ${r}`).setValue(`rmr_${r}`)) : []),
            ...(config.immuneUsers.length ? config.immuneUsers.slice(0, 10).map(u => new StringSelectMenuOptionBuilder().setLabel(`remove user ${u}`).setValue(`rmu_${u}`)) : []),
          ];
          const p = await pickMenu(interaction, userId, `${E.member} immune`, opts);
          if (!p) return redraw();
          if (p.values[0] === 'role') {
            const r = await pickRole(interaction, userId, 'pick role to make immune');
            if (r) store.updateConfig(guildId, { immuneRoles: [...new Set([...config.immuneRoles, r])] });
          } else if (p.values[0] === 'clear_roles') {
            store.updateConfig(guildId, { immuneRoles: [] });
          } else if (p.values[0] === 'clear_users') {
            store.updateConfig(guildId, { immuneUsers: [] });
          } else if (p.values[0].startsWith('rmr_')) {
            store.updateConfig(guildId, { immuneRoles: config.immuneRoles.filter(x => x !== p.values[0].slice(4)) });
          } else if (p.values[0].startsWith('rmu_')) {
            store.updateConfig(guildId, { immuneUsers: config.immuneUsers.filter(x => x !== p.values[0].slice(4)) });
          }
          return redraw();
        }

        /* dm templates */
        if (btn.customId === 'mod_dm') {
          await btn.deferUpdate().catch(() => {});
          const opts = [
            ['dmOnWarn', 'dm on warn'],
            ['dmOnMute', 'dm on timeout'],
            ['dmOnKick', 'dm on kick'],
            ['dmOnBan', 'dm on ban'],
            ['dmWarn', 'template: warn'],
            ['dmMute', 'template: timeout'],
            ['dmKick', 'template: kick'],
            ['dmBan', 'template: ban'],
          ].map(([k, l]) => new StringSelectMenuOptionBuilder().setLabel(l).setValue(k));
          const p = await pickMenu(interaction, userId, `${E.settings} dm settings`, opts);
          if (!p) return redraw();
          const key = p.values[0];
          if (key.startsWith('dmOn')) {
            const config = store.getConfig(guildId);
            store.updateConfig(guildId, { [key]: !config[key] });
          } else {
            const config = store.getConfig(guildId);
            const m = new ModalBuilder().setCustomId('dm_tpl').setTitle(`edit ${key}`);
            m.addComponents(new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('v').setLabel('template').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000).setValue(config[key])
            ));
            const s = await openModal(interaction, userId, m, 'edit template');
            if (s) store.updateConfig(guildId, { [key]: s.fields.getTextInputValue('v') });
          }
          return redraw();
        }

        /* warn expiry */
        if (btn.customId === 'mod_warns') {
          const m = new ModalBuilder().setCustomId('warn_exp').setTitle('warn expiry');
          m.addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('d').setLabel('days (0 = never expire)').setStyle(TextInputStyle.Short).setRequired(true).setValue(String(store.getConfig(guildId).warnExpiryDays)).setMaxLength(3)
          ));
          await btn.showModal(m).catch(() => {});
          const s = await btn.awaitModalSubmit({ time: 60000, filter: x => x.customId === 'warn_exp' && x.user.id === userId }).catch(() => null);
          if (s) {
            await ackModal(s);
            store.updateConfig(guildId, { warnExpiryDays: Math.max(0, Math.min(365, parseInt(s.fields.getTextInputValue('d'), 10) || 30)) });
          }
          return redraw();
        }

        /* presets */
        if (btn.customId === 'mod_presets') {
          await btn.deferUpdate().catch(() => {});
          const p = await pickMenu(interaction, userId, `${E.wheel} presets`,
            ESCALATION_PRESETS.map(x => new StringSelectMenuOptionBuilder().setLabel(x.label).setValue(x.id).setDescription(x.desc)));
          if (p) {
            const preset = ESCALATION_PRESETS.find(x => x.id === p.values[0]);
            if (preset) store.updateConfig(guildId, { escalation: preset.rules });
          }
          return redraw();
        }

        /* enable toggle */
        if (btn.customId === 'mod_toggle') {
          await btn.deferUpdate().catch(() => {});
          const config = store.getConfig(guildId);
          store.updateConfig(guildId, { enabled: !config.enabled });
          return redraw();
        }

        /* close */
        if (btn.customId === 'mod_close') {
          await btn.update({ components: [okBox('moderation config saved.')] }).catch(() => {});
          col.stop('saved');
          return;
        }
      } catch (e) {
        console.error('[moderation] collect error:', e);
        try { await redraw(); } catch {}
      }
    });

    col.on('end', () => {});
  },
};

function parseDuration(str) {
  if (!str) return null;
  const m = String(str).trim().match(/^(\d+)\s*(s|m|h|d|w)$/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const unit = m[2].toLowerCase();
  return n * { s: 1000, m: 60000, h: 3600000, d: 86400000, w: 604800000 }[unit];
}
