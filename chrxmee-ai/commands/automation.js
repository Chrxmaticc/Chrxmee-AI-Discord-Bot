const {
  SlashCommandBuilder, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
  ChannelSelectMenuBuilder, RoleSelectMenuBuilder, ContainerBuilder, TextDisplayBuilder,
  SeparatorBuilder, SeparatorSpacingSize, MessageFlags, ChannelType,
} = require('discord.js');

const { store, templates, constants } = require('../cogs/automation');
const { TRIGGERS, CONDITIONS, ACTIONS } = constants;

const E = {
  success:  "<:Verified_Icon:1527194184841167010>",
  error:    "<:no:1530373946795364362>",
  settings: "<:Settings:1525601248278216725>",
  agree:    "<:agreed:1525639597135237131>",
  angry:    "<:angry_cry:1526029511882440744>",
  file:     "<:File_Icon:1526542046213570681>",
  folder:   "<:Folder_Icon:1526542112806539274>",
  cursor:   "<:Cursor_Code:1526703109345116310>",
  compass:  "<:Compass_Discover_Icon:1526542192494248067>",
  wheel:    "<:Adaption_Wheel:1526537780229046342>",
  link:     "<:Link:1525603398341103806>",
  on:       "<:on:1545571641684135946>",
  off:      "<:off:1545571608897265726>",
  rename:   "<:Pencil:1530377899251601408>",
  member:   "<:member:1530383558710005960>",
  channel:  "<:Channel:1531901854361849929>",
};

const V2 = MessageFlags.IsComponentsV2;
const V2_E = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;

const errBox = (m) => new ContainerBuilder().setAccentColor(0xff3b3b)
  .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.error} ${m}`));
const okBox = (m) => new ContainerBuilder().setAccentColor(0x57f287)
  .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.success} ${m}`));

/* ── ack modal WITHOUT touching the builder message ── */
async function ackModal(sub) {
  try {
    await sub.deferReply({ flags: 64 });
    await sub.deleteReply();
  } catch {}
}

/* ── one-shot collector scoped to the interaction — works for ephemerals ── */
function awaitNext(interaction, userId, time = 60000) {
  return new Promise(resolve => {
    const col = interaction.createMessageComponentCollector({
      time,
      max: 1,
      filter: i => i.user.id === userId,
    });
    col.on('collect', i => resolve(i));
    col.on('end', (_, reason) => { if (reason === 'time') resolve(null); });
  });
}

function buildMain(draft, hint) {
  const c = new ContainerBuilder().setAccentColor(0x5b7fd4);
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.wheel} automation builder`));
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${hint || 'trigger → conditions → actions'}`));
  c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));

  const t = draft.trigger;
  const tLine = t
    ? `**${t.type}**${t.keyword ? ` · \`${t.keyword}\` · ${t.matchMode}` : ''}${t.emoji ? ` · ${t.emoji}` : ''}${t.mode ? ` · ${t.mode}` : ''}`
    : '*not set*';
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`${t ? E.on : E.off} **trigger:** ${tLine}`));

  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.folder} **conditions** (${draft.conditions.length}) · mode \`${draft.conditionMode}\``));
  if (!draft.conditions.length) c.addTextDisplayComponents(new TextDisplayBuilder().setContent('-# none'));
  else draft.conditions.forEach((cd, i) => {
    const val = Array.isArray(cd.value) ? cd.value.join(', ') : cd.value;
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`  \`${i + 1}.\` **${cd.type}** ${cd.op} ${val ?? ''}`));
  });

  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.cursor} **actions** (${draft.actions.length}) · cooldown \`${draft.cooldownSeconds}s\``));
  if (!draft.actions.length) c.addTextDisplayComponents(new TextDisplayBuilder().setContent('-# none'));
  else draft.actions.forEach((a, i) => {
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`  \`${i + 1}.\` **${a.type}** · ${a.summary || ''}`));
  });

  c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));

  const r1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('auto_set_trigger').setLabel(t ? 'change trigger' : 'set trigger').setStyle(t ? ButtonStyle.Secondary : ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('auto_add_cond').setLabel('add condition').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('auto_add_action').setLabel('add action').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('auto_mode').setLabel(`mode: ${draft.conditionMode}`).setStyle(ButtonStyle.Secondary),
  );
  const r2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('auto_cooldown').setLabel(`cooldown: ${draft.cooldownSeconds}s`).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('auto_undo').setLabel('undo').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('auto_manage').setLabel('manage').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('auto_test').setLabel('test').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('auto_clear').setLabel('clear').setStyle(ButtonStyle.Danger),
  );
  const r3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('auto_save').setLabel('save').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('auto_cancel').setLabel('cancel').setStyle(ButtonStyle.Secondary),
  );
  c.addActionRowComponents(r1, r2, r3);
  return c;
}

/* ── pickers — take `interaction`, use awaitNext ── */
async function pickMenu(interaction, userId, title, options, multi = false, min = 1, max = 5) {
  const menu = new StringSelectMenuBuilder().setCustomId('pick').setPlaceholder('pick one').addOptions(options);
  if (multi) menu.setMinValues(min).setMaxValues(max);
  const c = new ContainerBuilder().setAccentColor(0x5b7fd4)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${title}`))
    .addActionRowComponents(new ActionRowBuilder().addComponents(menu));
  await interaction.editReply({ components: [c] }).catch(() => {});
  const p = await awaitNext(interaction, userId, 60000);
  if (!p) return null;
  await p.deferUpdate().catch(() => {});
  return p;
}

async function pickChannel(interaction, userId, title, types = [ChannelType.GuildText, ChannelType.GuildAnnouncement]) {
  const menu = new ChannelSelectMenuBuilder().setCustomId('pick_ch').setPlaceholder('pick a channel').addChannelTypes(...types);
  const c = new ContainerBuilder().setAccentColor(0x5b7fd4)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.channel} ${title}`))
    .addActionRowComponents(new ActionRowBuilder().addComponents(menu));
  await interaction.editReply({ components: [c] }).catch(() => {});
  const p = await awaitNext(interaction, userId, 60000);
  if (!p) return null;
  await p.deferUpdate().catch(() => {});
  return p.values[0];
}

async function pickRole(interaction, userId, title) {
  const menu = new RoleSelectMenuBuilder().setCustomId('pick_rl').setPlaceholder('pick a role');
  const c = new ContainerBuilder().setAccentColor(0x5b7fd4)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.member} ${title}`))
    .addActionRowComponents(new ActionRowBuilder().addComponents(menu));
  await interaction.editReply({ components: [c] }).catch(() => {});
  const p = await awaitNext(interaction, userId, 60000);
  if (!p) return null;
  await p.deferUpdate().catch(() => {});
  return p.values[0];
}

async function pickOp(interaction, userId, a = 'is', b = 'is not') {
  const m = new StringSelectMenuBuilder().setCustomId('pick_op').setPlaceholder('operator').addOptions(
    new StringSelectMenuOptionBuilder().setLabel(a).setValue(a),
    new StringSelectMenuOptionBuilder().setLabel(b).setValue(b),
  );
  const c = new ContainerBuilder().setAccentColor(0x5b7fd4)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.settings} operator`))
    .addActionRowComponents(new ActionRowBuilder().addComponents(m));
  await interaction.editReply({ components: [c] }).catch(() => {});
  const p = await awaitNext(interaction, userId, 60000);
  if (!p) return null;
  await p.deferUpdate().catch(() => {});
  return p.values[0];
}

/* ── openModal — same as pickers, returns the raw (acked) modal submit ── */
async function openModal(interaction, userId, modal, label = 'open modal') {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('open_modal').setLabel(label).setStyle(ButtonStyle.Primary)
  );
  const c = new ContainerBuilder().setAccentColor(0x5b7fd4)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.rename} ${modal.data.title}`))
    .addActionRowComponents(row);
  await interaction.editReply({ components: [c] }).catch(() => {});
  const open = await awaitNext(interaction, userId, 60000);
  if (!open) return null;
  await open.showModal(modal).catch(() => {});
  const sub = await open.awaitModalSubmit({ time: 120000, filter: m => m.customId === modal.data.custom_id && m.user.id === userId }).catch(() => null);
  if (!sub) return null;
  await ackModal(sub);
  return sub;
}

/* ── prompt: trigger ── */
async function promptTrigger(interaction, userId) {
  const p = await pickMenu(interaction, userId, `${E.compass} pick a trigger`,
    TRIGGERS.map(t => new StringSelectMenuOptionBuilder().setLabel(t.label).setValue(t.value).setDescription(t.desc)));
  if (!p) return null;
  const type = p.values[0];

  if (type === 'message') {
    const m = new ModalBuilder().setCustomId('auto_trig_msg').setTitle('message trigger');
    m.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('kw').setLabel('keyword').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(150)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('mode').setLabel('contains/exact/starts/ends/regex').setStyle(TextInputStyle.Short).setRequired(true).setValue('contains').setMaxLength(10)),
    );
    const sub = await openModal(interaction, userId, m, 'set keyword + mode');
    if (!sub) return null;
    const raw = (sub.fields.getTextInputValue('mode') || 'contains').toLowerCase().trim();
    const valid = ['contains','exact','starts','ends','regex'];
    return { type, keyword: sub.fields.getTextInputValue('kw'), matchMode: valid.includes(raw) ? raw : 'contains' };
  }

  if (type === 'reaction_add' || type === 'reaction_remove') {
    const m = new ModalBuilder().setCustomId('auto_trig_rx').setTitle('reaction trigger');
    m.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('emoji').setLabel('emoji (blank = any)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(60)
    ));
    const sub = await openModal(interaction, userId, m, 'set emoji (optional)');
    if (!sub) return null;
    return { type, emoji: sub.fields.getTextInputValue('emoji') || '' };
  }

  if (type === 'role_added' || type === 'role_removed') {
    const r = await pickRole(interaction, userId, 'pick a role (blank = any)');
    return { type, roleId: r || null };
  }

  if (type === 'scheduled') {
    const p2 = await pickMenu(interaction, userId, `${E.settings} schedule type`,
      [
        new StringSelectMenuOptionBuilder().setLabel('interval').setValue('interval').setDescription('every N minutes'),
        new StringSelectMenuOptionBuilder().setLabel('daily').setValue('daily').setDescription('every day at HH:MM'),
        new StringSelectMenuOptionBuilder().setLabel('weekly').setValue('weekly').setDescription('every week on a day at HH:MM'),
      ]);
    if (!p2) return null;
    const mode = p2.values[0];

    if (mode === 'interval') {
      const m = new ModalBuilder().setCustomId('auto_sched_int').setTitle('interval');
      m.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('min').setLabel('minutes (min 1)').setStyle(TextInputStyle.Short).setRequired(true).setValue('60').setMaxLength(4)
      ));
      const sub = await openModal(interaction, userId, m, 'set interval');
      if (!sub) return null;
      const minutes = Math.max(1, parseInt(sub.fields.getTextInputValue('min'), 10) || 60);
      return { type, mode, minutes };
    }
    if (mode === 'daily') {
      const m = new ModalBuilder().setCustomId('auto_sched_daily').setTitle('daily schedule');
      m.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('h').setLabel('hour (0-23)').setStyle(TextInputStyle.Short).setRequired(true).setValue('9').setMaxLength(2)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('mi').setLabel('minute (0-59)').setStyle(TextInputStyle.Short).setRequired(true).setValue('0').setMaxLength(2)),
      );
      const sub = await openModal(interaction, userId, m, 'set time');
      if (!sub) return null;
      return { type, mode, hour: Math.min(23, Math.max(0, parseInt(sub.fields.getTextInputValue('h'), 10) || 0)), minute: Math.min(59, Math.max(0, parseInt(sub.fields.getTextInputValue('mi'), 10) || 0)) };
    }
    if (mode === 'weekly') {
      const m = new ModalBuilder().setCustomId('auto_sched_weekly').setTitle('weekly schedule');
      m.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('d').setLabel('day (0=sun 6=sat)').setStyle(TextInputStyle.Short).setRequired(true).setValue('1').setMaxLength(1)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('h').setLabel('hour (0-23)').setStyle(TextInputStyle.Short).setRequired(true).setValue('9').setMaxLength(2)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('mi').setLabel('minute (0-59)').setStyle(TextInputStyle.Short).setRequired(true).setValue('0').setMaxLength(2)),
      );
      const sub = await openModal(interaction, userId, m, 'set time');
      if (!sub) return null;
      return { type, mode, day: Math.min(6, Math.max(0, parseInt(sub.fields.getTextInputValue('d'), 10) || 1)), hour: Math.min(23, Math.max(0, parseInt(sub.fields.getTextInputValue('h'), 10) || 0)), minute: Math.min(59, Math.max(0, parseInt(sub.fields.getTextInputValue('mi'), 10) || 0)) };
    }
  }

  if (type === 'button_click') {
    const m = new ModalBuilder().setCustomId('auto_trig_btn').setTitle('button trigger');
    m.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('cid').setLabel('custom id (blank = any)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(100)
    ));
    const sub = await openModal(interaction, userId, m, 'set custom id');
    if (!sub) return null;
    return { type, customId: sub.fields.getTextInputValue('cid') || null };
  }

  return { type };
}

/* ── prompt: condition ── */
async function promptCondition(interaction, userId) {
  const p = await pickMenu(interaction, userId, `${E.folder} pick a condition`,
    CONDITIONS.map(c => new StringSelectMenuOptionBuilder().setLabel(c.label).setValue(c.value).setDescription(c.desc)));
  if (!p) return null;
  const type = p.values[0];
  const def = CONDITIONS.find(x => x.value === type);

  if (def.input === 'channel') {
    const v = await pickChannel(interaction, userId, 'pick a channel');
    if (!v) return null;
    const op = await pickOp(interaction, userId);
    return op ? { type, op, value: v } : null;
  }
  if (def.input === 'category') {
    const v = await pickChannel(interaction, userId, 'pick a category', [ChannelType.GuildCategory]);
    if (!v) return null;
    const op = await pickOp(interaction, userId);
    return op ? { type, op, value: v } : null;
  }
  if (def.input === 'role') {
    const v = await pickRole(interaction, userId, 'pick a role');
    if (!v) return null;
    const op = await pickOp(interaction, userId);
    return op ? { type, op, value: v } : null;
  }
  if (def.input === 'roles_multi') {
    const list = interaction.guild.roles.cache.filter(r => !r.managed && r.id !== interaction.guild.id).first(24);
    const opts = list.map(r => new StringSelectMenuOptionBuilder().setLabel(r.name.slice(0, 100)).setValue(r.id));
    const pk = await pickMenu(interaction, userId, `${E.member} pick roles (up to 5)`, opts, true, 1, 5);
    if (!pk) return null;
    const op = await pickOp(interaction, userId);
    return op ? { type, op, value: pk.values } : null;
  }
  if (def.input === 'text') {
    const m = new ModalBuilder().setCustomId('auto_cond_txt').setTitle('text');
    m.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('v').setLabel('string').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(200)
    ));
    const s = await openModal(interaction, userId, m, 'set string');
    if (!s) return null;
    const op = await pickOp(interaction, userId);
    return op ? { type, op, value: s.fields.getTextInputValue('v') } : null;
  }
  if (def.input === 'number') {
    const m = new ModalBuilder().setCustomId('auto_cond_num').setTitle('number');
    m.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('v').setLabel('threshold').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(10)
    ));
    const s = await openModal(interaction, userId, m, 'set number');
    if (!s) return null;
    const op = await pickOp(interaction, userId, 'is (>=)', 'is not (<)');
    return op ? { type, op: op === 'is (>=)' ? 'is' : 'is not', value: s.fields.getTextInputValue('v') } : null;
  }
  if (def.input === 'bool') {
    const op = await pickOp(interaction, userId);
    return op ? { type, op, value: null } : null;
  }
  if (def.input === 'user') {
    const m = new ModalBuilder().setCustomId('auto_cond_usr').setTitle('user id');
    m.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('v').setLabel('user id').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(25)
    ));
    const s = await openModal(interaction, userId, m, 'set user id');
    if (!s) return null;
    const op = await pickOp(interaction, userId);
    return op ? { type, op, value: s.fields.getTextInputValue('v') } : null;
  }
  if (def.input === 'hour_range') {
    const m = new ModalBuilder().setCustomId('auto_cond_hr').setTitle('time of day');
    m.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('v').setLabel('range like 9-17 (24h)').setStyle(TextInputStyle.Short).setRequired(true).setValue('9-17').setMaxLength(5)
    ));
    const s = await openModal(interaction, userId, m, 'set range');
    if (!s) return null;
    const op = await pickOp(interaction, userId);
    return op ? { type, op, value: s.fields.getTextInputValue('v') } : null;
  }
  if (def.input === 'days_multi') {
    const opts = [['sun','0'],['mon','1'],['tue','2'],['wed','3'],['thu','4'],['fri','5'],['sat','6']]
      .map(([l, v]) => new StringSelectMenuOptionBuilder().setLabel(l).setValue(v));
    const pk = await pickMenu(interaction, userId, `${E.settings} pick days`, opts, true, 1, 7);
    if (!pk) return null;
    const op = await pickOp(interaction, userId);
    return op ? { type, op, value: pk.values } : null;
  }
  return null;
}

/* ── prompt: action ── */
async function promptAction(interaction, userId, draft) {
  const p = await pickMenu(interaction, userId, `${E.cursor} pick an action`,
    ACTIONS.map(a => new StringSelectMenuOptionBuilder().setLabel(a.label).setValue(a.value).setDescription(a.desc)));
  if (!p) return null;
  const type = p.values[0];
  const def = ACTIONS.find(x => x.value === type);

  if (def.input === 'channel+text') {
    const ch = await pickChannel(interaction, userId, 'pick a channel');
    if (!ch) return null;
    const m = new ModalBuilder().setCustomId('auto_act_txt').setTitle('message content');
    m.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('v').setLabel('content').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(2000)
        .setValue('hello {user}, welcome to {server}!').setPlaceholder('{user} {server} {channel} {message} {random.1-100}')
    ));
    const s = await openModal(interaction, userId, m, 'set content');
    return s ? { type, channelId: ch, content: s.fields.getTextInputValue('v'), summary: `→ <#${ch}>` } : null;
  }
  if (def.input === 'channel+container') {
    const ch = await pickChannel(interaction, userId, 'pick a channel');
    if (!ch) return null;
    const m = new ModalBuilder().setCustomId('auto_act_con').setTitle('container');
    m.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('title').setLabel('title').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(200)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('desc').setLabel('description').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(2000)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('color').setLabel('accent hex').setStyle(TextInputStyle.Short).setRequired(false).setValue('#5b7fd4').setMaxLength(10)),
    );
    const s = await openModal(interaction, userId, m, 'set container');
    if (!s) return null;
    const hex = (s.fields.getTextInputValue('color') || '#5b7fd4').replace('#','');
    return { type, channelId: ch, title: s.fields.getTextInputValue('title'), description: s.fields.getTextInputValue('desc'), color: /^[0-9a-f]{6}$/i.test(hex) ? parseInt(hex, 16) : 0x5b7fd4, summary: `→ <#${ch}>` };
  }
  if (def.input === 'channel+embed') {
    const ch = await pickChannel(interaction, userId, 'pick a channel');
    if (!ch) return null;
    const m = new ModalBuilder().setCustomId('auto_act_emb').setTitle('embed');
    m.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('title').setLabel('title').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(200)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('desc').setLabel('description').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(2000)),
    );
    const s = await openModal(interaction, userId, m, 'set embed');
    return s ? { type, channelId: ch, title: s.fields.getTextInputValue('title'), description: s.fields.getTextInputValue('desc'), color: 0x5b7fd4, summary: `→ <#${ch}>` } : null;
  }
  if (def.input === 'webhook+text') {
    const m = new ModalBuilder().setCustomId('auto_act_wh').setTitle('webhook post');
    m.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('url').setLabel('webhook url').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(500)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('v').setLabel('content').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(2000)),
    );
    const s = await openModal(interaction, userId, m, 'set webhook');
    return s ? { type, url: s.fields.getTextInputValue('url'), content: s.fields.getTextInputValue('v'), summary: 'webhook' } : null;
  }
  if (def.input === 'text') {
    const m = new ModalBuilder().setCustomId('auto_act_txt2').setTitle('content');
    m.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('v').setLabel('content').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(2000)
        .setPlaceholder('{user} {server} {channel} {message}')
    ));
    const s = await openModal(interaction, userId, m, 'set content');
    return s ? { type, content: s.fields.getTextInputValue('v'), summary: s.fields.getTextInputValue('v').slice(0, 40) } : null;
  }
  if (def.input === 'text_reason') {
    const m = new ModalBuilder().setCustomId('auto_act_rsn').setTitle('reason');
    m.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('v').setLabel('reason').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(200).setValue('automation')
    ));
    const s = await openModal(interaction, userId, m, 'set reason');
    return s ? { type, reason: s.fields.getTextInputValue('v'), summary: type } : null;
  }
  if (def.input === 'user_id+text') {
    const m = new ModalBuilder().setCustomId('auto_act_dmu').setTitle('dm user');
    m.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('uid').setLabel('user id').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(25)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('v').setLabel('content').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(2000)),
    );
    const s = await openModal(interaction, userId, m, 'set dm');
    return s ? { type, userId: s.fields.getTextInputValue('uid'), content: s.fields.getTextInputValue('v'), summary: 'dm' } : null;
  }
  if (def.input === 'role+text') {
    const r = await pickRole(interaction, userId, 'pick a role');
    if (!r) return null;
    const m = new ModalBuilder().setCustomId('auto_act_dmrh').setTitle('dm message');
    m.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('v').setLabel('content').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(2000)
    ));
    const s = await openModal(interaction, userId, m, 'set content');
    return s ? { type, roleId: r, content: s.fields.getTextInputValue('v'), summary: `dm <@&${r}>` } : null;
  }
  if (def.input === 'role') {
    const r = await pickRole(interaction, userId, 'pick a role');
    return r ? { type, roleId: r, summary: `<@&${r}>` } : null;
  }
  if (def.input === 'emoji') {
    const m = new ModalBuilder().setCustomId('auto_act_emj').setTitle('emoji');
    m.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('v').setLabel('emoji').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(60).setValue('⭐')
    ));
    const s = await openModal(interaction, userId, m, 'set emoji');
    return s ? { type, emoji: s.fields.getTextInputValue('v'), summary: s.fields.getTextInputValue('v') } : null;
  }
  if (def.input === 'seconds') {
    const m = new ModalBuilder().setCustomId('auto_act_wait').setTitle('wait seconds');
    m.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('v').setLabel('seconds (1-60)').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(3).setValue('3')
    ));
    const s = await openModal(interaction, userId, m, 'set wait');
    if (!s) return null;
    const n = parseInt(s.fields.getTextInputValue('v'), 10) || 3;
    const sec = Math.max(1, Math.min(60, n));
    return { type, seconds: sec, summary: `${sec}s` };
  }
  if (def.input === 'minutes') {
    const m = new ModalBuilder().setCustomId('auto_act_to').setTitle('timeout');
    m.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('min').setLabel('minutes').setStyle(TextInputStyle.Short).setRequired(true).setValue('10').setMaxLength(6)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('rsn').setLabel('reason').setStyle(TextInputStyle.Short).setRequired(false).setValue('automation').setMaxLength(200)),
    );
    const s = await openModal(interaction, userId, m, 'set timeout');
    if (!s) return null;
    const n = parseInt(s.fields.getTextInputValue('min'), 10) || 10;
    const minutes = Math.max(1, Math.min(40320, n));
    return { type, minutes, reason: s.fields.getTextInputValue('rsn') || 'automation', summary: `${minutes}m` };
  }
  if (def.input === 'automation') {
    const list = store.listForGuild(interaction.guild.id).filter(w => w.name !== draft.name);
    if (!list.length) return null;
    const opts = list.slice(0, 25).map(w => new StringSelectMenuOptionBuilder().setLabel(w.name.slice(0, 100)).setValue(w.name).setDescription(`id ${w.id} · ${w.actions.length} actions`));
    const pk = await pickMenu(interaction, userId, `${E.link} chain into...`, opts);
    if (!pk) return null;
    return { type, name: pk.values[0], summary: pk.values[0] };
  }
  if (def.input === 'none') return { type, summary: 'on trigger' };
  return null;
}

/* ── manage ── */
async function manage(interaction, userId, draft) {
  const items = [
    ...draft.conditions.map((c, i) => ({ k: 'c', i, label: `cond ${i + 1}: ${c.type} ${c.op} ${Array.isArray(c.value) ? c.value.join(',') : c.value ?? ''}` })),
    ...draft.actions.map((a, i) => ({ k: 'a', i, label: `act ${i + 1}: ${a.type} · ${a.summary || ''}` })),
  ];
  if (!items.length) {
    await interaction.editReply({ components: [errBox('nothing to manage.')] }).catch(() => {});
    return false;
  }
  const opts = items.map(x => new StringSelectMenuOptionBuilder().setLabel(x.label.slice(0, 100)).setValue(`${x.k}:${x.i}`));
  const p = await pickMenu(interaction, userId, `${E.folder} pick an item to edit`, opts);
  if (!p) return false;
  const [k, i] = p.values[0].split(':');
  const idx = parseInt(i, 10);
  const arr = k === 'c' ? draft.conditions : draft.actions;

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('mg_up').setLabel('move up').setStyle(ButtonStyle.Secondary).setDisabled(idx === 0),
    new ButtonBuilder().setCustomId('mg_down').setLabel('move down').setStyle(ButtonStyle.Secondary).setDisabled(idx === arr.length - 1),
    new ButtonBuilder().setCustomId('mg_del').setLabel('remove').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('mg_back').setLabel('back').setStyle(ButtonStyle.Secondary),
  );
  const c = new ContainerBuilder().setAccentColor(0x5b7fd4)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.folder} editing — ${k === 'c' ? 'condition' : 'action'} ${idx + 1}`))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${items.find(x => x.k === k && x.i === idx)?.label || ''}`))
    .addActionRowComponents(row);
  await interaction.editReply({ components: [c] }).catch(() => {});
  const action = await awaitNext(interaction, userId, 30000);
  if (!action) return false;
  await action.deferUpdate().catch(() => {});

  if (action.customId === 'mg_del') arr.splice(idx, 1);
  else if (action.customId === 'mg_up' && idx > 0) [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
  else if (action.customId === 'mg_down' && idx < arr.length - 1) [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
  return true;
}

/* ── shared builder runner — collector pattern, no races ── */
async function runBuilder(interaction, userId, guildId, initialDraft, hint, editingId) {
  const draft = initialDraft;
  const undo = [];
  const push = () => {
    undo.push(JSON.stringify({ trigger: draft.trigger, conditions: draft.conditions, actions: draft.actions, conditionMode: draft.conditionMode, cooldownSeconds: draft.cooldownSeconds }));
    if (undo.length > 10) undo.shift();
  };

  await interaction.editReply({ components: [buildMain(draft, hint)] }).catch(() => {});
  const builder = await interaction.fetchReply();
  const redraw = (msg) => interaction.editReply({ components: [buildMain(draft, msg)] }).catch(() => {});

  const col = interaction.createMessageComponentCollector({
    time: 900000,
    filter: i => i.user.id === userId,
  });

  col.on('collect', async btn => {
    try {
      /* ── set trigger ── */
      if (btn.customId === 'auto_set_trigger') {
        await btn.deferUpdate().catch(() => {});
        const t = await promptTrigger(interaction, userId);
        if (t) { push(); draft.trigger = t; }
        return redraw();
      }

      /* ── add condition ── */
      if (btn.customId === 'auto_add_cond') {
        await btn.deferUpdate().catch(() => {});
        const c = await promptCondition(interaction, userId);
        if (c) { push(); draft.conditions.push(c); }
        return redraw();
      }

      /* ── add action ── */
      if (btn.customId === 'auto_add_action') {
        await btn.deferUpdate().catch(() => {});
        const a = await promptAction(interaction, userId, draft);
        if (a) { push(); draft.actions.push(a); }
        return redraw();
      }

      /* ── mode ── */
      if (btn.customId === 'auto_mode') {
        await btn.deferUpdate().catch(() => {});
        draft.conditionMode = draft.conditionMode === 'all' ? 'any' : 'all';
        return redraw();
      }

      /* ── cooldown ── */
      if (btn.customId === 'auto_cooldown') {
        const modal = new ModalBuilder().setCustomId('auto_cd').setTitle('cooldown');
        modal.addComponents(new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('sec').setLabel('seconds (0-600)').setStyle(TextInputStyle.Short).setRequired(true).setValue(String(draft.cooldownSeconds)).setMaxLength(3)
        ));
        await btn.showModal(modal).catch(() => {});
        const s = await btn.awaitModalSubmit({ time: 60000, filter: m => m.customId === 'auto_cd' && m.user.id === userId }).catch(() => null);
        if (s) {
          await ackModal(s);
          const n = parseInt(s.fields.getTextInputValue('sec'), 10);
          push(); draft.cooldownSeconds = Number.isFinite(n) ? Math.max(0, Math.min(600, n)) : 5;
        }
        return redraw();
      }

      /* ── undo ── */
      if (btn.customId === 'auto_undo') {
        await btn.deferUpdate().catch(() => {});
        if (!undo.length) return redraw('nothing to undo');
        const prev = JSON.parse(undo.pop());
        Object.assign(draft, prev);
        return redraw();
      }

      /* ── manage ── */
      if (btn.customId === 'auto_manage') {
        await btn.deferUpdate().catch(() => {});
        push();
        await manage(interaction, userId, draft);
        return redraw();
      }

      /* ── clear ── */
      if (btn.customId === 'auto_clear') {
        await btn.deferUpdate().catch(() => {});
        push();
        draft.trigger = null; draft.conditions = []; draft.actions = [];
        return redraw('cleared');
      }

      /* ── test ── */
      if (btn.customId === 'auto_test') {
        await btn.deferUpdate().catch(() => {});
        const summary = [
          `${E.compass} **trigger:** ${draft.trigger ? draft.trigger.type : '*none*'}`,
          `${E.folder} **conditions:** ${draft.conditions.length} · \`${draft.conditionMode}\``,
          `${E.cursor} **actions:** ${draft.actions.length} · cooldown \`${draft.cooldownSeconds}s\``,
          '',
          draft.trigger ? `fires on \`${draft.trigger.type}\` event` : 'no trigger — never fires',
          draft.actions.length ? `${draft.actions.length} action(s) will run in order` : 'no actions — nothing happens',
        ].join('\n');
        await btn.followUp({ components: [new ContainerBuilder().setAccentColor(0x5b7fd4)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.file} dry run`))
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(summary))], flags: V2_E }).catch(() => {});
        return redraw();
      }

      /* ── cancel ── */
      if (btn.customId === 'auto_cancel') {
        await btn.update({ components: [okBox('cancelled.')], flags: V2_E }).catch(() => {});
        col.stop('cancel');
        return;
      }

      /* ── save ── */
      if (btn.customId === 'auto_save') {
        await btn.deferUpdate().catch(() => {});
        if (!draft.trigger) return redraw('set a trigger first');
        if (!draft.actions.length) return redraw('add at least one action');

        if (editingId) {
          const updated = store.update(editingId, draft);
          await interaction.editReply({ components: [okBox(`updated **${updated.name}** · id \`${updated.id}\`\n-# ${updated.trigger.type} · ${updated.conditions.length}c / ${updated.actions.length}a`)] }).catch(() => {});
          col.stop('saved');
          return;
        }

        if (store.listForGuild(guildId).some(w => w.name.toLowerCase() === draft.name.toLowerCase())) {
          return redraw('name already taken');
        }
        const wf = store.create(guildId, draft);
        await interaction.editReply({ components: [okBox(`saved **${wf.name}** · id \`${wf.id}\`\n-# ${wf.trigger.type} · ${wf.conditions.length}c / ${wf.actions.length}a`)] }).catch(() => {});
        col.stop('saved');
        return;
      }
    } catch (e) {
      console.error('[automation] collect error:', e);
      try { await redraw(); } catch {}
    }
  });

  col.on('end', () => {
    /* nothing — timeouts just leave the last view up */
  });
}

/* ── command ── */
module.exports = {
  data: new SlashCommandBuilder()
    .setName('automation')
    .setDescription('build server automations (mod only)')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
    .addSubcommand(s => s.setName('create').setDescription('create a new automation'))
    .addSubcommand(s => s.setName('edit').setDescription('edit an existing automation')
      .addIntegerOption(o => o.setName('id').setDescription('automation id').setRequired(true)))
    .addSubcommand(s => s.setName('templates').setDescription('browse pre-made automations'))
    .addSubcommand(s => s.setName('from-template').setDescription('create from a template')
      .addStringOption(o => o.setName('id').setDescription('template id').setRequired(true)))
    .addSubcommand(s => s.setName('list').setDescription('list all automations'))
    .addSubcommand(s => s.setName('search').setDescription('search automations')
      .addStringOption(o => o.setName('query').setDescription('search query').setRequired(true)))
    .addSubcommand(s => s.setName('info').setDescription('view an automation')
      .addIntegerOption(o => o.setName('id').setDescription('automation id').setRequired(true)))
    .addSubcommand(s => s.setName('logs').setDescription('recent fires for an automation')
      .addIntegerOption(o => o.setName('id').setDescription('automation id').setRequired(true)))
    .addSubcommand(s => s.setName('recent').setDescription('last fires across all automations'))
    .addSubcommand(s => s.setName('stats').setDescription('server-wide automation stats'))
    .addSubcommand(s => s.setName('enable').setDescription('enable an automation')
      .addIntegerOption(o => o.setName('id').setDescription('automation id').setRequired(true)))
    .addSubcommand(s => s.setName('disable').setDescription('disable an automation')
      .addIntegerOption(o => o.setName('id').setDescription('automation id').setRequired(true)))
    .addSubcommand(s => s.setName('toggle').setDescription('flip enabled state')
      .addIntegerOption(o => o.setName('id').setDescription('automation id').setRequired(true)))
    .addSubcommand(s => s.setName('enable-all').setDescription('enable every automation'))
    .addSubcommand(s => s.setName('disable-all').setDescription('disable every automation'))
    .addSubcommand(s => s.setName('delete').setDescription('delete an automation')
      .addIntegerOption(o => o.setName('id').setDescription('automation id').setRequired(true)))
    .addSubcommand(s => s.setName('duplicate').setDescription('duplicate an automation')
      .addIntegerOption(o => o.setName('id').setDescription('automation id').setRequired(true))
      .addStringOption(o => o.setName('new_name').setDescription('new name').setRequired(true)))
    .addSubcommand(s => s.setName('export').setDescription('export as json')
      .addIntegerOption(o => o.setName('id').setDescription('automation id').setRequired(true)))
    .addSubcommand(s => s.setName('import').setDescription('import from json (single or array)')
      .addStringOption(o => o.setName('json').setDescription('the exported json').setRequired(true))),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
      return interaction.reply({ components: [errBox('manage server required.')], flags: V2_E });
    }

    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    const guildId = interaction.guild.id;

    if (sub === 'create') {
      await interaction.deferReply({ flags: V2_E });
      const nameModal = new ModalBuilder().setCustomId('auto_name').setTitle('name your automation');
      nameModal.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('name').setLabel('name').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(50).setPlaceholder('welcome-new-members')
      ));
      const startRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('auto_start').setLabel('start building').setStyle(ButtonStyle.Primary)
      );
      await interaction.editReply({
        components: [new ContainerBuilder().setAccentColor(0x5b7fd4)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.wheel} new automation\n-# click to name it`))
          .addActionRowComponents(startRow)],
      });
      const pick = await awaitNext(interaction, userId, 60000);
      if (!pick) return;
      await pick.showModal(nameModal).catch(() => {});
      const nameSub = await pick.awaitModalSubmit({ time: 120000, filter: m => m.customId === 'auto_name' && m.user.id === userId }).catch(() => null);
      if (!nameSub) return;
      await ackModal(nameSub);
      const draft = { name: nameSub.fields.getTextInputValue('name'), trigger: null, conditions: [], conditionMode: 'all', actions: [], cooldownSeconds: 5, createdBy: userId };
      return runBuilder(interaction, userId, guildId, draft, 'set a trigger first', null);
    }

    if (sub === 'edit') {
      await interaction.deferReply({ flags: V2_E });
      const id = interaction.options.getInteger('id');
      const wf = store.get(id);
      if (!wf || wf.guildId !== guildId) return interaction.editReply({ components: [errBox(`no automation with id \`${id}\`.`)], flags: V2_E });
      const draft = {
        name: wf.name, trigger: JSON.parse(JSON.stringify(wf.trigger)),
        conditions: JSON.parse(JSON.stringify(wf.conditions || [])), conditionMode: wf.conditionMode || 'all',
        actions: JSON.parse(JSON.stringify(wf.actions || [])), cooldownSeconds: wf.cooldownSeconds ?? 5, createdBy: wf.createdBy,
      };
      return runBuilder(interaction, userId, guildId, draft, `editing **${wf.name}** · id \`${wf.id}\``, wf.id);
    }

    if (sub === 'templates') {
      await interaction.deferReply({ flags: V2_E });
      const lines = templates.map(t => `${E.file} **${t.name}** · id \`${t.id}\`\n-# ${t.desc}`);
      return interaction.editReply({ components: [new ContainerBuilder().setAccentColor(0x5b7fd4)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.folder} templates (${templates.length})`))
        .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n\n')))
        .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# use \`/automation from-template <id>\``))], flags: V2_E });
    }

    if (sub === 'from-template') {
      await interaction.deferReply({ flags: V2_E });
      const tplId = interaction.options.getString('id');
      const tpl = templates.find(t => t.id === tplId);
      if (!tpl) return interaction.editReply({ components: [errBox(`no template with id \`${tplId}\`.`)], flags: V2_E });
      const nameModal = new ModalBuilder().setCustomId('auto_tpl_name').setTitle(`create from ${tpl.name}`);
      nameModal.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('name').setLabel('name').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(50).setValue(tpl.name)
      ));
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('auto_tpl_go').setLabel('create it').setStyle(ButtonStyle.Primary)
      );
      await interaction.editReply({ components: [new ContainerBuilder().setAccentColor(0x5b7fd4)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.file} ${tpl.name}`))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${tpl.desc}`))
        .addActionRowComponents(row)], flags: V2_E });
      const pick = await awaitNext(interaction, userId, 60000);
      if (!pick) return;
      await pick.showModal(nameModal).catch(() => {});
      const sub2 = await pick.awaitModalSubmit({ time: 120000, filter: m => m.customId === 'auto_tpl_name' && m.user.id === userId }).catch(() => null);
      if (!sub2) return;
      await ackModal(sub2);
      const name = sub2.fields.getTextInputValue('name');
      if (store.listForGuild(guildId).some(w => w.name.toLowerCase() === name.toLowerCase())) {
        return interaction.editReply({ components: [errBox(`name **${name}** already taken.`)], flags: V2_E });
      }
      const wf = store.create(guildId, { ...tpl, name, createdBy: userId });
      return interaction.editReply({ components: [okBox(`created **${wf.name}** · id \`${wf.id}\``)], flags: V2_E });
    }

    if (sub === 'list') {
      await interaction.deferReply({ flags: V2_E });
      const list = store.listForGuild(guildId);
      if (!list.length) return interaction.editReply({ components: [new ContainerBuilder().setAccentColor(0x5b7fd4)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.folder} no automations yet.`))], flags: V2_E });
      const lines = list.map(w => `${w.enabled ? E.on : E.off} **${w.name}** · id \`${w.id}\` · \`${w.trigger?.type || 'none'}\` · ${w.conditions.length}c / ${w.actions.length}a · ${w.fireCount || 0}🔥`);
      return interaction.editReply({ components: [new ContainerBuilder().setAccentColor(0x5b7fd4)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.folder} automations (${list.length})`))
        .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')))], flags: V2_E });
    }

    if (sub === 'search') {
      await interaction.deferReply({ flags: V2_E });
      const q = interaction.options.getString('query').toLowerCase().trim();
      const list = store.listForGuild(guildId).filter(w => w.name.toLowerCase().includes(q) || (w.trigger?.type || '').toLowerCase().includes(q) || w.actions.some(a => a.type.toLowerCase().includes(q)));
      if (!list.length) return interaction.editReply({ components: [errBox(`no automations matching **${q}**.`)], flags: V2_E });
      const lines = list.map(w => `${w.enabled ? E.on : E.off} **${w.name}** · id \`${w.id}\``);
      return interaction.editReply({ components: [new ContainerBuilder().setAccentColor(0x5b7fd4)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.compass} search · "${q}" (${list.length})`))
        .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')))], flags: V2_E });
    }

    if (sub === 'info') {
      await interaction.deferReply({ flags: V2_E });
      const id = interaction.options.getInteger('id');
      const wf = store.get(id);
      if (!wf || wf.guildId !== guildId) return interaction.editReply({ components: [errBox(`no automation with id \`${id}\`.`)], flags: V2_E });
      const c = new ContainerBuilder().setAccentColor(0x5b7fd4);
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.file} ${wf.name}`));
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# id \`${wf.id}\` · ${wf.enabled ? 'enabled' : 'disabled'} · ${wf.fireCount || 0} fires`));
      c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.compass} **trigger:** \`${wf.trigger?.type || 'none'}\``));
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.folder} **conditions** (${wf.conditions.length})`));
      wf.conditions.forEach((cd, i) => c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`  \`${i + 1}.\` **${cd.type}** ${cd.op}`)));
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.cursor} **actions** (${wf.actions.length})`));
      wf.actions.forEach((a, i) => c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`  \`${i + 1}.\` **${a.type}**`)));
      return interaction.editReply({ components: [c], flags: V2_E });
    }

    if (sub === 'logs') {
      await interaction.deferReply({ flags: V2_E });
      const id = interaction.options.getInteger('id');
      const wf = store.get(id);
      if (!wf || wf.guildId !== guildId) return interaction.editReply({ components: [errBox(`no automation with id \`${id}\`.`)], flags: V2_E });
      const c = new ContainerBuilder().setAccentColor(0x5b7fd4);
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.file} logs — ${wf.name}`));
      c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
      if (!wf.lastFires?.length) c.addTextDisplayComponents(new TextDisplayBuilder().setContent('-# no recent fires.'));
      else {
        const lines = wf.lastFires.map(f => `${f.ok ? E.success : E.error} <t:${Math.floor(f.at / 1000)}:R> · <@${f.userId}>`);
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')));
      }
      return interaction.editReply({ components: [c], flags: V2_E });
    }

    if (sub === 'recent') {
      await interaction.deferReply({ flags: V2_E });
      const all = [];
      for (const wf of store.listForGuild(guildId)) for (const f of (wf.lastFires || [])) all.push({ ...f, name: wf.name, id: wf.id });
      all.sort((a, b) => b.at - a.at);
      const top = all.slice(0, 20);
      if (!top.length) return interaction.editReply({ components: [errBox('no recent fires.')], flags: V2_E });
      const lines = top.map(f => `${f.ok ? E.success : E.error} <t:${Math.floor(f.at / 1000)}:R> · **${f.name}**`);
      return interaction.editReply({ components: [new ContainerBuilder().setAccentColor(0x5b7fd4)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.cursor} recent fires`))
        .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')))], flags: V2_E });
    }

    if (sub === 'stats') {
      await interaction.deferReply({ flags: V2_E });
      const list = store.listForGuild(guildId);
      const enabled = list.filter(w => w.enabled).length;
      const totalFires = list.reduce((s, w) => s + (w.fireCount || 0), 0);
      const totalErrors = list.reduce((s, w) => s + (w.errorCount || 0), 0);
      const c = new ContainerBuilder().setAccentColor(0x5b7fd4);
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.wheel} automation stats`));
      c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent([
        `${E.file} **total:** ${list.length}`,
        `${E.on} **enabled:** ${enabled}`,
        `${E.off} **disabled:** ${list.length - enabled}`,
        `${E.cursor} **fires:** ${totalFires}`,
        `${E.error} **errors:** ${totalErrors}`,
      ].join('\n')));
      return interaction.editReply({ components: [c], flags: V2_E });
    }

    if (sub === 'enable' || sub === 'disable' || sub === 'toggle') {
      await interaction.deferReply({ flags: V2_E });
      const id = interaction.options.getInteger('id');
      const wf = store.get(id);
      if (!wf || wf.guildId !== guildId) return interaction.editReply({ components: [errBox(`no automation with id \`${id}\`.`)], flags: V2_E });
      if (sub === 'enable') wf.enabled = true;
      else if (sub === 'disable') wf.enabled = false;
      else wf.enabled = !wf.enabled;
      store.update(id, wf);
      return interaction.editReply({ components: [okBox(`**${wf.name}** is now ${wf.enabled ? 'enabled' : 'disabled'}.`)], flags: V2_E });
    }

    if (sub === 'enable-all' || sub === 'disable-all') {
      await interaction.deferReply({ flags: V2_E });
      const enabled = sub === 'enable-all';
      const n = store.setEnabledAll(guildId, enabled);
      return interaction.editReply({ components: [okBox(`${enabled ? 'enabled' : 'disabled'} **${n}** automation(s).`)], flags: V2_E });
    }

    if (sub === 'delete') {
      await interaction.deferReply({ flags: V2_E });
      const id = interaction.options.getInteger('id');
      const wf = store.get(id);
      if (!wf || wf.guildId !== guildId) return interaction.editReply({ components: [errBox(`no automation with id \`${id}\`.`)], flags: V2_E });
      const name = wf.name;
      store.remove(id);
      return interaction.editReply({ components: [okBox(`deleted **${name}**.`)], flags: V2_E });
    }

    if (sub === 'duplicate') {
      await interaction.deferReply({ flags: V2_E });
      const id = interaction.options.getInteger('id');
      const newName = interaction.options.getString('new_name');
      const wf = store.get(id);
      if (!wf || wf.guildId !== guildId) return interaction.editReply({ components: [errBox(`no automation with id \`${id}\`.`)], flags: V2_E });
      if (store.listForGuild(guildId).some(w => w.name.toLowerCase() === newName.toLowerCase())) {
        return interaction.editReply({ components: [errBox(`name already taken.`)], flags: V2_E });
      }
      const copy = store.create(guildId, { name: newName, trigger: JSON.parse(JSON.stringify(wf.trigger)), conditions: JSON.parse(JSON.stringify(wf.conditions)), conditionMode: wf.conditionMode, actions: JSON.parse(JSON.stringify(wf.actions)), cooldownSeconds: wf.cooldownSeconds, createdBy: userId });
      return interaction.editReply({ components: [okBox(`duplicated → **${copy.name}** · id \`${copy.id}\``)], flags: V2_E });
    }

    if (sub === 'export') {
      await interaction.deferReply({ flags: V2_E });
      const id = interaction.options.getInteger('id');
      const wf = store.get(id);
      if (!wf || wf.guildId !== guildId) return interaction.editReply({ components: [errBox(`no automation with id \`${id}\`.`)], flags: V2_E });
      const json = JSON.stringify({ name: wf.name, trigger: wf.trigger, conditions: wf.conditions, conditionMode: wf.conditionMode, actions: wf.actions, cooldownSeconds: wf.cooldownSeconds }, null, 2);
      return interaction.editReply({ components: [new ContainerBuilder().setAccentColor(0x5b7fd4)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.file} export — ${wf.name}`))
        .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`\`\`\`json\n${json.slice(0, 3800)}\n\`\`\``))], flags: V2_E });
    }

    if (sub === 'import') {
      await interaction.deferReply({ flags: V2_E });
      const raw = interaction.options.getString('json');
      let data;
      try { data = JSON.parse(raw); } catch { return interaction.editReply({ components: [errBox('invalid json.')], flags: V2_E }); }
      const items = Array.isArray(data) ? data : [data];
      const imported = [], skipped = [];
      for (const item of items) {
        if (!item.name || !item.trigger) { skipped.push(item.name || '(unnamed)'); continue; }
        if (store.listForGuild(guildId).some(w => w.name.toLowerCase() === String(item.name).toLowerCase())) { skipped.push(item.name); continue; }
        const wf = store.create(guildId, { name: String(item.name).slice(0, 50), trigger: item.trigger, conditions: Array.isArray(item.conditions) ? item.conditions : [], conditionMode: item.conditionMode === 'any' ? 'any' : 'all', actions: Array.isArray(item.actions) ? item.actions : [], cooldownSeconds: Number(item.cooldownSeconds) || 5, createdBy: userId });
        imported.push(`${wf.name} (\`${wf.id}\`)`);
      }
      const lines = [];
      if (imported.length) lines.push(`${E.success} imported ${imported.length}:\n${imported.map(x => '  · ' + x).join('\n')}`);
      if (skipped.length) lines.push(`${E.error} skipped ${skipped.length}:\n${skipped.map(x => '  · ' + x).join('\n')}`);
      return interaction.editReply({ components: [new ContainerBuilder().setAccentColor(imported.length ? 0x57f287 : 0xff3b3b)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n\n') || 'nothing imported.'))], flags: V2_E });
    }
  },
};
