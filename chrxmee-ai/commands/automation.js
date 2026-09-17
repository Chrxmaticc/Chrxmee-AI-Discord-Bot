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

const V2_E = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;

const errBox = (m) => new ContainerBuilder().setAccentColor(0xff3b3b)
  .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.error} ${m}`));
const okBox = (m) => new ContainerBuilder().setAccentColor(0x57f287)
  .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.success} ${m}`));

async function ackModal(sub) {
  try { await sub.deferReply({ flags: 64 }); await sub.deleteReply(); } catch {}
}

function awaitOne(msg, userId, time, filterFn) {
  return new Promise(resolve => {
    const col = msg.createMessageComponentCollector({
      time, max: 1,
      filter: i => i.user.id === userId && (!filterFn || filterFn(i)),
    });
    col.on('collect', i => resolve(i));
    col.on('end', (_, r) => { if (r === 'time') resolve(null); });
  });
}

function buildMain(draft, hint) {
  const c = new ContainerBuilder().setAccentColor(0x5b7fd4);
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.wheel} automation · **${draft.name}**`));
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# id \`${draft.id}\` · ${draft.enabled ? 'enabled' : 'disabled'} · auto-save${hint ? ' · ' + hint : ''}`));
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
    new ButtonBuilder().setCustomId('auto_manage').setLabel('manage').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('auto_undo').setLabel('undo').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('auto_toggle').setLabel(draft.enabled ? 'disable' : 'enable').setStyle(draft.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
    new ButtonBuilder().setCustomId('auto_clear').setLabel('clear').setStyle(ButtonStyle.Danger),
  );
  const r3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('auto_export').setLabel('export').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('auto_cancel').setLabel('close').setStyle(ButtonStyle.Secondary),
  );
  c.addActionRowComponents(r1, r2, r3);
  return c;
}

async function showMenu(btn, msg, userId, title, menu) {
  const view = new ContainerBuilder().setAccentColor(0x5b7fd4)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${title}`))
    .addActionRowComponents(new ActionRowBuilder().addComponents(menu));
  await btn.update({ components: [view], flags: V2_E }).catch(() => {});
  return awaitOne(msg, userId, 60000);
}

async function showChannelPicker(btn, msg, userId, title, types = [ChannelType.GuildText, ChannelType.GuildAnnouncement]) {
  const menu = new ChannelSelectMenuBuilder().setCustomId('picker').setPlaceholder('pick a channel').addChannelTypes(...types);
  const view = new ContainerBuilder().setAccentColor(0x5b7fd4)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.channel} ${title}`))
    .addActionRowComponents(new ActionRowBuilder().addComponents(menu));
  await btn.update({ components: [view], flags: V2_E }).catch(() => {});
  return awaitOne(msg, userId, 60000);
}

async function showRolePicker(btn, msg, userId, title) {
  const menu = new RoleSelectMenuBuilder().setCustomId('picker').setPlaceholder('pick a role');
  const view = new ContainerBuilder().setAccentColor(0x5b7fd4)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.member} ${title}`))
    .addActionRowComponents(new ActionRowBuilder().addComponents(menu));
  await btn.update({ components: [view], flags: V2_E }).catch(() => {});
  return awaitOne(msg, userId, 60000);
}

async function modalFlow(trigger, modal, filterFn) {
  await trigger.showModal(modal).catch(() => {});
  const sub = await trigger.awaitModalSubmit({ time: 120000, filter: filterFn }).catch(() => null);
  if (!sub) return null;
  await ackModal(sub);
  return sub;
}

async function promptTrigger(interaction, msg, userId, btn) {
  const menu = new StringSelectMenuBuilder().setCustomId('picker').setPlaceholder('pick a trigger')
    .addOptions(TRIGGERS.map(t => new StringSelectMenuOptionBuilder().setLabel(t.label).setValue(t.value).setDescription(t.desc)));
  const pick = await showMenu(btn, msg, userId, `${E.compass} pick a trigger`, menu);
  if (!pick) return null;
  const type = pick.values[0];

  if (type === 'message') {
    const modal = new ModalBuilder().setCustomId('auto_trig_msg').setTitle('message trigger');
    modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('kw').setLabel('keyword').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(150)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('mode').setLabel('contains/exact/starts/ends/regex').setStyle(TextInputStyle.Short).setRequired(true).setValue('contains').setMaxLength(10)),
    );
    const sub = await modalFlow(pick, modal, m => m.customId === 'auto_trig_msg' && m.user.id === userId);
    if (!sub) return null;
    const raw = (sub.fields.getTextInputValue('mode') || 'contains').toLowerCase().trim();
    const valid = ['contains','exact','starts','ends','regex'];
    return { type, keyword: sub.fields.getTextInputValue('kw'), matchMode: valid.includes(raw) ? raw : 'contains' };
  }

  if (type === 'reaction_add' || type === 'reaction_remove') {
    const modal = new ModalBuilder().setCustomId('auto_trig_rx').setTitle('reaction trigger');
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('emoji').setLabel('emoji (blank = any)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(60)
    ));
    const sub = await modalFlow(pick, modal, m => m.customId === 'auto_trig_rx' && m.user.id === userId);
    if (!sub) return null;
    return { type, emoji: sub.fields.getTextInputValue('emoji') || '' };
  }

  if (type === 'role_added' || type === 'role_removed') {
    await pick.deferUpdate().catch(() => {});
    const role = await showRolePicker(btn, msg, userId, 'pick a role (blank = any)');
    if (!role) return { type };
    await role.deferUpdate().catch(() => {});
    return { type, roleId: role.values[0] };
  }

  if (type === 'scheduled') {
    const menu2 = new StringSelectMenuBuilder().setCustomId('picker').setPlaceholder('schedule type').addOptions(
      new StringSelectMenuOptionBuilder().setLabel('interval').setValue('interval').setDescription('every N minutes'),
      new StringSelectMenuOptionBuilder().setLabel('daily').setValue('daily').setDescription('every day at HH:MM'),
      new StringSelectMenuOptionBuilder().setLabel('weekly').setValue('weekly').setDescription('every week'),
    );
    const sched = await showMenu(btn, msg, userId, `${E.settings} schedule type`, menu2);
    if (!sched) return null;
    const mode = sched.values[0];

    if (mode === 'interval') {
      const modal = new ModalBuilder().setCustomId('auto_sched').setTitle('interval');
      modal.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('min').setLabel('minutes').setStyle(TextInputStyle.Short).setRequired(true).setValue('60').setMaxLength(4)
      ));
      const sub = await modalFlow(sched, modal, m => m.customId === 'auto_sched' && m.user.id === userId);
      if (!sub) return null;
      return { type, mode, minutes: Math.max(1, parseInt(sub.fields.getTextInputValue('min'), 10) || 60) };
    }
    if (mode === 'daily' || mode === 'weekly') {
      const modal = new ModalBuilder().setCustomId('auto_sched').setTitle(mode);
      if (mode === 'weekly') {
        modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('d').setLabel('day 0=sun 6=sat').setStyle(TextInputStyle.Short).setRequired(true).setValue('1').setMaxLength(1)));
      }
      modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('h').setLabel('hour 0-23').setStyle(TextInputStyle.Short).setRequired(true).setValue('9').setMaxLength(2)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('m').setLabel('minute 0-59').setStyle(TextInputStyle.Short).setRequired(true).setValue('0').setMaxLength(2)),
      );
      const sub = await modalFlow(sched, modal, m => m.customId === 'auto_sched' && m.user.id === userId);
      if (!sub) return null;
      const out = { type, mode, hour: Math.min(23, Math.max(0, parseInt(sub.fields.getTextInputValue('h'), 10) || 0)), minute: Math.min(59, Math.max(0, parseInt(sub.fields.getTextInputValue('m'), 10) || 0)) };
      if (mode === 'weekly') out.day = Math.min(6, Math.max(0, parseInt(sub.fields.getTextInputValue('d'), 10) || 1));
      return out;
    }
  }

  if (type === 'button_click') {
    const modal = new ModalBuilder().setCustomId('auto_trig_btn').setTitle('button trigger');
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('cid').setLabel('custom id (blank = any)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(100)
    ));
    const sub = await modalFlow(pick, modal, m => m.customId === 'auto_trig_btn' && m.user.id === userId);
    if (!sub) return null;
    return { type, customId: sub.fields.getTextInputValue('cid') || null };
  }

  await pick.deferUpdate().catch(() => {});
  return { type };
}

async function promptCondition(interaction, msg, userId, btn) {
  const menu = new StringSelectMenuBuilder().setCustomId('picker').setPlaceholder('pick a condition')
    .addOptions(CONDITIONS.map(c => new StringSelectMenuOptionBuilder().setLabel(c.label).setValue(c.value).setDescription(c.desc)));
  const pick = await showMenu(btn, msg, userId, `${E.folder} pick a condition`, menu);
  if (!pick) return null;
  const type = pick.values[0];
  const def = CONDITIONS.find(x => x.value === type);

  const askOp = async () => {
    const opMenu = new StringSelectMenuBuilder().setCustomId('picker').setPlaceholder('operator').addOptions(
      new StringSelectMenuOptionBuilder().setLabel('is').setValue('is'),
      new StringSelectMenuOptionBuilder().setLabel('is not').setValue('is not'),
    );
    const opPick = await showMenu(btn, msg, userId, `${E.settings} operator`, opMenu);
    if (!opPick) return null;
    await opPick.deferUpdate().catch(() => {});
    return opPick.values[0];
  };

  if (def.input === 'channel') {
    await pick.deferUpdate().catch(() => {});
    const ch = await showChannelPicker(btn, msg, userId, 'pick a channel');
    if (!ch) return null;
    await ch.deferUpdate().catch(() => {});
    const op = await askOp();
    return op ? { type, op, value: ch.values[0] } : null;
  }
  if (def.input === 'role') {
    await pick.deferUpdate().catch(() => {});
    const role = await showRolePicker(btn, msg, userId, 'pick a role');
    if (!role) return null;
    await role.deferUpdate().catch(() => {});
    const op = await askOp();
    return op ? { type, op, value: role.values[0] } : null;
  }
  if (def.input === 'text' || def.input === 'number' || def.input === 'user' || def.input === 'hour_range') {
    const modal = new ModalBuilder().setCustomId('auto_cond').setTitle(type);
    const label = def.input === 'number' ? 'threshold' : def.input === 'user' ? 'user id' : def.input === 'hour_range' ? 'range like 9-17' : 'string';
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('v').setLabel(label).setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(200)
    ));
    const sub = await modalFlow(pick, modal, m => m.customId === 'auto_cond' && m.user.id === userId);
    if (!sub) return null;
    const op = await askOp();
    return op ? { type, op, value: sub.fields.getTextInputValue('v') } : null;
  }
  if (def.input === 'bool') {
    await pick.deferUpdate().catch(() => {});
    const op = await askOp();
    return op ? { type, op } : null;
  }
  await pick.deferUpdate().catch(() => {});
  return null;
}

async function promptAction(interaction, msg, userId, btn, draft) {
  const menu = new StringSelectMenuBuilder().setCustomId('picker').setPlaceholder('pick an action')
    .addOptions(ACTIONS.map(a => new StringSelectMenuOptionBuilder().setLabel(a.label).setValue(a.value).setDescription(a.desc)));
  const pick = await showMenu(btn, msg, userId, `${E.cursor} pick an action`, menu);
  if (!pick) return null;
  const type = pick.values[0];
  const def = ACTIONS.find(x => x.value === type);

  const askText = async (title, id, style = TextInputStyle.Paragraph) => {
    const modal = new ModalBuilder().setCustomId(id).setTitle(title);
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('v').setLabel(title).setStyle(style).setRequired(true).setMaxLength(2000)
        .setPlaceholder('{user} {server} {channel} {message}')
    ));
    return await modalFlow(pick, modal, m => m.customId === id && m.user.id === userId);
  };

  if (def.input === 'channel+text') {
    await pick.deferUpdate().catch(() => {});
    const ch = await showChannelPicker(btn, msg, userId, 'pick a channel');
    if (!ch) return null;
    await ch.deferUpdate().catch(() => {});
    const sub = await askText('message content', 'auto_act_txt');
    if (!sub) return null;
    return { type, channelId: ch.values[0], content: sub.fields.getTextInputValue('v'), summary: `-> <#${ch.values[0]}>` };
  }
  if (def.input === 'channel+container' || def.input === 'channel+embed') {
    await pick.deferUpdate().catch(() => {});
    const ch = await showChannelPicker(btn, msg, userId, 'pick a channel');
    if (!ch) return null;
    await ch.deferUpdate().catch(() => {});
    const modal = new ModalBuilder().setCustomId('auto_act_rich').setTitle(type);
    modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('title').setLabel('title').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(200)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('desc').setLabel('description').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(2000)),
    );
    const sub = await modalFlow(pick, modal, m => m.customId === 'auto_act_rich' && m.user.id === userId);
    if (!sub) return null;
    return { type, channelId: ch.values[0], title: sub.fields.getTextInputValue('title'), description: sub.fields.getTextInputValue('desc'), color: 0x5b7fd4, summary: `-> <#${ch.values[0]}>` };
  }
  if (def.input === 'text' || def.input === 'text_reason') {
    const sub = await askText(def.input === 'text_reason' ? 'reason' : 'content', 'auto_act_text', def.input === 'text_reason' ? TextInputStyle.Short : TextInputStyle.Paragraph);
    if (!sub) return null;
    if (def.input === 'text_reason') return { type, reason: sub.fields.getTextInputValue('v'), summary: type };
    return { type, content: sub.fields.getTextInputValue('v'), summary: sub.fields.getTextInputValue('v').slice(0, 40) };
  }
  if (def.input === 'webhook+text') {
    const modal = new ModalBuilder().setCustomId('auto_act_wh').setTitle('webhook');
    modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('url').setLabel('webhook url').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(500)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('v').setLabel('content').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(2000)),
    );
    const sub = await modalFlow(pick, modal, m => m.customId === 'auto_act_wh' && m.user.id === userId);
    if (!sub) return null;
    return { type, url: sub.fields.getTextInputValue('url'), content: sub.fields.getTextInputValue('v'), summary: 'webhook' };
  }
  if (def.input === 'user_id+text') {
    const modal = new ModalBuilder().setCustomId('auto_act_dmu').setTitle('dm user');
    modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('uid').setLabel('user id').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(25)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('v').setLabel('content').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(2000)),
    );
    const sub = await modalFlow(pick, modal, m => m.customId === 'auto_act_dmu' && m.user.id === userId);
    if (!sub) return null;
    return { type, userId: sub.fields.getTextInputValue('uid'), content: sub.fields.getTextInputValue('v'), summary: 'dm' };
  }
  if (def.input === 'role+text') {
    await pick.deferUpdate().catch(() => {});
    const role = await showRolePicker(btn, msg, userId, 'pick a role');
    if (!role) return null;
    await role.deferUpdate().catch(() => {});
    const sub = await askText('dm content', 'auto_act_dmrh');
    if (!sub) return null;
    return { type, roleId: role.values[0], content: sub.fields.getTextInputValue('v'), summary: `dm <@&${role.values[0]}>` };
  }
  if (def.input === 'role') {
    await pick.deferUpdate().catch(() => {});
    const role = await showRolePicker(btn, msg, userId, 'pick a role');
    if (!role) return null;
    await role.deferUpdate().catch(() => {});
    return { type, roleId: role.values[0], summary: `<@&${role.values[0]}>` };
  }
  if (def.input === 'emoji') {
    const modal = new ModalBuilder().setCustomId('auto_act_emj').setTitle('emoji');
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('v').setLabel('emoji').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(60).setValue('⭐')
    ));
    const sub = await modalFlow(pick, modal, m => m.customId === 'auto_act_emj' && m.user.id === userId);
    if (!sub) return null;
    return { type, emoji: sub.fields.getTextInputValue('v'), summary: sub.fields.getTextInputValue('v') };
  }
  if (def.input === 'seconds' || def.input === 'minutes') {
    const modal = new ModalBuilder().setCustomId('auto_act_num').setTitle(type);
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('v').setLabel(def.input === 'minutes' ? 'minutes' : 'seconds 1-60').setStyle(TextInputStyle.Short).setRequired(true).setValue(def.input === 'minutes' ? '10' : '3').setMaxLength(6)
    ));
    const sub = await modalFlow(pick, modal, m => m.customId === 'auto_act_num' && m.user.id === userId);
    if (!sub) return null;
    const n = parseInt(sub.fields.getTextInputValue('v'), 10) || (def.input === 'minutes' ? 10 : 3);
    if (def.input === 'minutes') return { type, minutes: Math.max(1, Math.min(40320, n)), reason: 'automation', summary: `${n}m` };
    return { type, seconds: Math.max(1, Math.min(60, n)), summary: `${n}s` };
  }
  if (def.input === 'automation') {
    const list = store.listForGuild(interaction.guild.id).filter(w => w.id !== draft.id);
    if (!list.length) { await pick.deferUpdate().catch(() => {}); return null; }
    const opts = list.slice(0, 25).map(w => new StringSelectMenuOptionBuilder().setLabel(w.name.slice(0, 100)).setValue(w.name));
    const pk = await showMenu(btn, msg, userId, `${E.link} chain into...`, new StringSelectMenuBuilder().setCustomId('picker').setPlaceholder('pick').addOptions(opts));
    if (!pk) return null;
    await pk.deferUpdate().catch(() => {});
    return { type, name: pk.values[0], summary: pk.values[0] };
  }
  if (def.input === 'none') {
    await pick.deferUpdate().catch(() => {});
    return { type, summary: 'on trigger' };
  }
  await pick.deferUpdate().catch(() => {});
  return null;
}

async function manage(interaction, msg, userId, btn, draft) {
  const items = [
    ...draft.conditions.map((c, i) => ({ k: 'c', i, label: `cond ${i + 1}: ${c.type} ${c.op} ${Array.isArray(c.value) ? c.value.join(',') : c.value ?? ''}` })),
    ...draft.actions.map((a, i) => ({ k: 'a', i, label: `act ${i + 1}: ${a.type} · ${a.summary || ''}` })),
  ];
  if (!items.length) return false;

  const menu = new StringSelectMenuBuilder().setCustomId('picker').setPlaceholder('pick to edit')
    .addOptions(items.map(x => new StringSelectMenuOptionBuilder().setLabel(x.label.slice(0, 100)).setValue(`${x.k}:${x.i}`)));
  const pick = await showMenu(btn, msg, userId, `${E.folder} manage items`, menu);
  if (!pick) return false;

  const [k, i] = pick.values[0].split(':');
  const idx = parseInt(i, 10);
  const arr = k === 'c' ? draft.conditions : draft.actions;
  const label = k === 'c' ? 'condition' : 'action';

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('mg_up').setLabel('move up').setStyle(ButtonStyle.Secondary).setDisabled(idx === 0),
    new ButtonBuilder().setCustomId('mg_down').setLabel('move down').setStyle(ButtonStyle.Secondary).setDisabled(idx === arr.length - 1),
    new ButtonBuilder().setCustomId('mg_del').setLabel('remove').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('mg_back').setLabel('back').setStyle(ButtonStyle.Secondary),
  );
  const view = new ContainerBuilder().setAccentColor(0x5b7fd4)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.folder} editing — ${label} ${idx + 1}`))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${items.find(x => x.k === k && x.i === idx)?.label || ''}`))
    .addActionRowComponents(row);
  await pick.update({ components: [view], flags: V2_E }).catch(() => {});

  const action = await awaitOne(msg, userId, 30000);
  if (!action) return true;

  if (action.customId === 'mg_del') {
    arr.splice(idx, 1);
    await action.deferUpdate().catch(() => {});
  } else if (action.customId === 'mg_up' && idx > 0) {
    [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
    await action.deferUpdate().catch(() => {});
  } else if (action.customId === 'mg_down' && idx < arr.length - 1) {
    [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
    await action.deferUpdate().catch(() => {});
  } else {
    await action.deferUpdate().catch(() => {});
  }
  return true;
}

async function runBuilder(interaction, userId, guildId, draft, hint) {
  const history = [];
  const pushHistory = () => {
    history.push(JSON.stringify({ trigger: draft.trigger, conditions: draft.conditions, actions: draft.actions, conditionMode: draft.conditionMode, cooldownSeconds: draft.cooldownSeconds }));
    if (history.length > 15) history.shift();
  };

  await interaction.editReply({ components: [buildMain(draft, hint)], flags: V2_E }).catch(() => {});
  const msg = await interaction.fetchReply().catch(() => null);
  if (!msg) return;

  const save = () => {
    try {
      store.update(draft.id, draft);
      console.log(`[automation] saved id=${draft.id} enabled=${draft.enabled}`);
    } catch (e) {
      console.error('[automation] save error:', e);
    }
  };

  while (true) {
    const btn = await awaitOne(msg, userId, 900000);
    if (!btn) return;

    try {
      /* ── simple changes: btn.update directly ── */
      if (btn.customId === 'auto_toggle') {
        draft.enabled = !draft.enabled;
        save();
        console.log(`[automation] toggle → ${draft.enabled}`);
        await btn.update({ components: [buildMain(draft, draft.enabled ? 'enabled' : 'disabled')], flags: V2_E }).catch(e => console.error('[auto] toggle err:', e.message));
        continue;
      }

      if (btn.customId === 'auto_mode') {
        pushHistory();
        draft.conditionMode = draft.conditionMode === 'all' ? 'any' : 'all';
        save();
        await btn.update({ components: [buildMain(draft)], flags: V2_E }).catch(() => {});
        continue;
      }

      if (btn.customId === 'auto_clear') {
        pushHistory();
        draft.trigger = null; draft.conditions = []; draft.actions = [];
        save();
        await btn.update({ components: [buildMain(draft, 'cleared')], flags: V2_E }).catch(() => {});
        continue;
      }

      if (btn.customId === 'auto_undo') {
        if (!history.length) {
          await btn.update({ components: [buildMain(draft, 'nothing to undo')], flags: V2_E }).catch(() => {});
          continue;
        }
        const prev = JSON.parse(history.pop());
        Object.assign(draft, prev);
        save();
        await btn.update({ components: [buildMain(draft, 'undone')], flags: V2_E }).catch(() => {});
        continue;
      }

      if (btn.customId === 'auto_cancel') {
        await btn.update({ components: [okBox(`closed. **${draft.name}** saved as id \`${draft.id}\`.`)], flags: V2_E }).catch(() => {});
        return;
      }

      if (btn.customId === 'auto_export') {
        const json = JSON.stringify({
          name: draft.name, trigger: draft.trigger, conditions: draft.conditions,
          conditionMode: draft.conditionMode, actions: draft.actions,
          cooldownSeconds: draft.cooldownSeconds,
        }, null, 2);
        await btn.reply({
          components: [new ContainerBuilder().setAccentColor(0x5b7fd4)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.file} export\n\`\`\`json\n${json.slice(0, 3800)}\n\`\`\``))],
          flags: V2_E | MessageFlags.Ephemeral,
        }).catch(() => {});
        continue;
      }

      /* ── flows with pickers/modals: deferUpdate + editReply ── */
      if (btn.customId === 'auto_set_trigger') {
        await btn.deferUpdate().catch(() => {});
        const t = await promptTrigger(interaction, msg, userId, btn);
        if (t) { pushHistory(); draft.trigger = t; }
        save();
        await interaction.editReply({ components: [buildMain(draft)], flags: V2_E }).catch(e => console.error('[auto] redraw err:', e.message));
        continue;
      }

      if (btn.customId === 'auto_add_cond') {
        await btn.deferUpdate().catch(() => {});
        const c = await promptCondition(interaction, msg, userId, btn);
        if (c) { pushHistory(); draft.conditions.push(c); }
        save();
        await interaction.editReply({ components: [buildMain(draft)], flags: V2_E }).catch(e => console.error('[auto] redraw err:', e.message));
        continue;
      }

      if (btn.customId === 'auto_add_action') {
        await btn.deferUpdate().catch(() => {});
        const a = await promptAction(interaction, msg, userId, btn, draft);
        if (a) { pushHistory(); draft.actions.push(a); }
        save();
        await interaction.editReply({ components: [buildMain(draft)], flags: V2_E }).catch(e => console.error('[auto] redraw err:', e.message));
        continue;
      }

      if (btn.customId === 'auto_cooldown') {
        const modal = new ModalBuilder().setCustomId('auto_cd').setTitle('cooldown');
        modal.addComponents(new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('sec').setLabel('seconds 0-600').setStyle(TextInputStyle.Short).setRequired(true).setValue(String(draft.cooldownSeconds)).setMaxLength(3)
        ));
        const sub = await modalFlow(btn, modal, m => m.customId === 'auto_cd' && m.user.id === userId);
        if (sub) {
          pushHistory();
          const n = parseInt(sub.fields.getTextInputValue('sec'), 10);
          draft.cooldownSeconds = Number.isFinite(n) ? Math.max(0, Math.min(600, n)) : 5;
          save();
        }
        await interaction.editReply({ components: [buildMain(draft)], flags: V2_E }).catch(() => {});
        continue;
      }

      if (btn.customId === 'auto_manage') {
        await btn.deferUpdate().catch(() => {});
        pushHistory();
        await manage(interaction, msg, userId, btn, draft);
        save();
        await interaction.editReply({ components: [buildMain(draft)], flags: V2_E }).catch(() => {});
        continue;
      }

      await btn.deferUpdate().catch(() => {});
      await interaction.editReply({ components: [buildMain(draft)], flags: V2_E }).catch(() => {});
    } catch (e) {
      console.error('[automation] collect error:', e);
      try { await interaction.editReply({ components: [buildMain(draft)], flags: V2_E }); } catch {}
    }
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('automation')
    .setDescription('build server automations (mod only)')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
    .addSubcommand(s => s.setName('create').setDescription('create a new automation'))
    .addSubcommand(s => s.setName('edit').setDescription('edit an existing automation')
      .addIntegerOption(o => o.setName('id').setDescription('automation id').setRequired(true)))
    .addSubcommand(s => s.setName('list').setDescription('list all automations'))
    .addSubcommand(s => s.setName('search').setDescription('search automations')
      .addStringOption(o => o.setName('query').setDescription('query').setRequired(true)))
    .addSubcommand(s => s.setName('recent').setDescription('recent fires across all automations'))
    .addSubcommand(s => s.setName('info').setDescription('view an automation')
      .addIntegerOption(o => o.setName('id').setDescription('automation id').setRequired(true)))
    .addSubcommand(s => s.setName('delete').setDescription('delete an automation')
      .addIntegerOption(o => o.setName('id').setDescription('automation id').setRequired(true)))
    .addSubcommand(s => s.setName('duplicate').setDescription('duplicate an automation')
      .addIntegerOption(o => o.setName('id').setDescription('automation id').setRequired(true))
      .addStringOption(o => o.setName('new_name').setDescription('new name').setRequired(true)))
    .addSubcommand(s => s.setName('enable').setDescription('enable an automation')
      .addIntegerOption(o => o.setName('id').setDescription('automation id').setRequired(true)))
    .addSubcommand(s => s.setName('disable').setDescription('disable an automation')
      .addIntegerOption(o => o.setName('id').setDescription('automation id').setRequired(true)))
    .addSubcommand(s => s.setName('enable-all').setDescription('enable every automation'))
    .addSubcommand(s => s.setName('disable-all').setDescription('disable every automation'))
    .addSubcommand(s => s.setName('export').setDescription('export an automation as json')
      .addIntegerOption(o => o.setName('id').setDescription('automation id').setRequired(true)))
    .addSubcommand(s => s.setName('import').setDescription('import from json (single or array)')
      .addStringOption(o => o.setName('json').setDescription('json').setRequired(true)))
    .addSubcommand(s => s.setName('templates').setDescription('browse pre-made automations'))
    .addSubcommand(s => s.setName('from-template').setDescription('create from a template')
      .addStringOption(o => o.setName('id').setDescription('template id').setRequired(true)))
    .addSubcommand(s => s.setName('stats').setDescription('automation stats')),

  async execute(interaction) {
    await interaction.deferReply({ flags: V2_E }).catch(() => {});

    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild)) {
      return interaction.editReply({ components: [errBox('manage server required.')], flags: V2_E }).catch(() => {});
    }

    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    const guildId = interaction.guild.id;

    try {
      if (sub === 'create') {
        const modal = new ModalBuilder().setCustomId('auto_create_name').setTitle('name your automation');
        modal.addComponents(new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('name').setLabel('name').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(50).setPlaceholder('welcome-new-members')
        ));

        const startRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('auto_start').setLabel('start building').setStyle(ButtonStyle.Primary)
        );
        await interaction.editReply({
          components: [new ContainerBuilder().setAccentColor(0x5b7fd4)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.wheel} new automation\n-# click to name it. saves automatically as you build.`))
            .addActionRowComponents(startRow)],
          flags: V2_E,
        });

        const startMsg = await interaction.fetchReply();
        const startClick = await awaitOne(startMsg, userId, 60000);
        if (!startClick) return;

        await startClick.showModal(modal).catch(() => {});
        const nameSub = await startClick.awaitModalSubmit({ time: 120000, filter: m => m.customId === 'auto_create_name' && m.user.id === userId }).catch(() => null);
        if (!nameSub) return;
        await ackModal(nameSub);

        const name = nameSub.fields.getTextInputValue('name');
        if (store.listForGuild(guildId).some(w => w.name.toLowerCase() === name.toLowerCase())) {
          return interaction.editReply({ components: [errBox(`an automation named **${name}** already exists.`)], flags: V2_E });
        }

        const draft = { name, trigger: null, conditions: [], conditionMode: 'all', actions: [], cooldownSeconds: 5, enabled: false, createdBy: userId };
        const wf = store.create(guildId, draft);
        draft.id = wf.id;

        return runBuilder(interaction, userId, guildId, draft, 'created — set a trigger');
      }

      if (sub === 'edit') {
        const id = interaction.options.getInteger('id');
        const wf = store.get(id);
        if (!wf || wf.guildId !== guildId) {
          return interaction.editReply({ components: [errBox(`no automation with id \`${id}\`.`)], flags: V2_E });
        }
        const draft = {
          id: wf.id, name: wf.name,
          trigger: wf.trigger ? JSON.parse(JSON.stringify(wf.trigger)) : null,
          conditions: JSON.parse(JSON.stringify(wf.conditions || [])),
          conditionMode: wf.conditionMode || 'all',
          actions: JSON.parse(JSON.stringify(wf.actions || [])),
          cooldownSeconds: wf.cooldownSeconds ?? 5,
          enabled: wf.enabled ?? false,
          createdBy: wf.createdBy,
        };
        return runBuilder(interaction, userId, guildId, draft, `editing · ${draft.trigger ? 'has trigger' : 'no trigger yet'}`);
      }

      if (sub === 'list') {
        const list = store.listForGuild(guildId);
        if (!list.length) return interaction.editReply({ components: [new ContainerBuilder().setAccentColor(0x5b7fd4).addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.folder} no automations yet.`))], flags: V2_E });
        const lines = list.map(w => `${w.enabled ? E.on : E.off} **${w.name}** · id \`${w.id}\` · \`${w.trigger?.type || 'none'}\` · ${w.conditions.length}c / ${w.actions.length}a`);
        return interaction.editReply({ components: [new ContainerBuilder().setAccentColor(0x5b7fd4)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.folder} automations (${list.length})`))
          .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')))], flags: V2_E });
      }

      if (sub === 'search') {
        const q = interaction.options.getString('query').toLowerCase().trim();
        const list = store.listForGuild(guildId).filter(w => w.name.toLowerCase().includes(q) || (w.trigger?.type || '').toLowerCase().includes(q) || w.actions.some(a => a.type.toLowerCase().includes(q)));
        if (!list.length) return interaction.editReply({ components: [errBox(`no automations matching **${q}**.`)], flags: V2_E });
        const lines = list.map(w => `${w.enabled ? E.on : E.off} **${w.name}** · id \`${w.id}\``);
        return interaction.editReply({ components: [new ContainerBuilder().setAccentColor(0x5b7fd4)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.compass} search · "${q}" (${list.length})`))
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')))], flags: V2_E });
      }

      if (sub === 'recent') {
        const all = [];
        for (const wf of store.listForGuild(guildId)) for (const f of (wf.lastFires || [])) all.push({ ...f, name: wf.name });
        all.sort((a, b) => b.at - a.at);
        const top = all.slice(0, 20);
        if (!top.length) return interaction.editReply({ components: [errBox('no recent fires.')], flags: V2_E });
        const lines = top.map(f => `${f.ok ? E.success : E.error} <t:${Math.floor(f.at / 1000)}:R> · **${f.name}**`);
        return interaction.editReply({ components: [new ContainerBuilder().setAccentColor(0x5b7fd4)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.cursor} recent fires`))
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')))], flags: V2_E });
      }

      if (sub === 'info') {
        const id = interaction.options.getInteger('id');
        const wf = store.get(id);
        if (!wf || wf.guildId !== guildId) return interaction.editReply({ components: [errBox(`no automation with id \`${id}\`.`)], flags: V2_E });
        const c = new ContainerBuilder().setAccentColor(0x5b7fd4);
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.file} ${wf.name}`));
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# id \`${wf.id}\` · ${wf.enabled ? 'enabled' : 'disabled'} · ${wf.fireCount || 0} fires`));
        c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.compass} **trigger:** \`${wf.trigger?.type || 'none'}\``));
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.folder} **conditions** (${wf.conditions.length})\n${E.cursor} **actions** (${wf.actions.length})`));
        return interaction.editReply({ components: [c], flags: V2_E });
      }

      if (sub === 'delete') {
        const id = interaction.options.getInteger('id');
        const wf = store.get(id);
        if (!wf || wf.guildId !== guildId) return interaction.editReply({ components: [errBox(`no automation with id \`${id}\`.`)], flags: V2_E });
        const name = wf.name;
        store.remove(id);
        return interaction.editReply({ components: [okBox(`deleted **${name}**.`)], flags: V2_E });
      }

      if (sub === 'duplicate') {
        const id = interaction.options.getInteger('id');
        const newName = interaction.options.getString('new_name');
        const wf = store.get(id);
        if (!wf || wf.guildId !== guildId) return interaction.editReply({ components: [errBox(`no automation with id \`${id}\`.`)], flags: V2_E });
        if (store.listForGuild(guildId).some(w => w.name.toLowerCase() === newName.toLowerCase())) {
          return interaction.editReply({ components: [errBox(`name already taken.`)], flags: V2_E });
        }
        const copy = store.create(guildId, {
          name: newName,
          trigger: JSON.parse(JSON.stringify(wf.trigger)),
          conditions: JSON.parse(JSON.stringify(wf.conditions)),
          conditionMode: wf.conditionMode,
          actions: JSON.parse(JSON.stringify(wf.actions)),
          cooldownSeconds: wf.cooldownSeconds,
          createdBy: userId,
        });
        return interaction.editReply({ components: [okBox(`duplicated → **${copy.name}** · id \`${copy.id}\``)], flags: V2_E });
      }

      if (sub === 'enable' || sub === 'disable') {
        const id = interaction.options.getInteger('id');
        const wf = store.get(id);
        if (!wf || wf.guildId !== guildId) return interaction.editReply({ components: [errBox(`no automation with id \`${id}\`.`)], flags: V2_E });
        wf.enabled = sub === 'enable';
        store.update(id, wf);
        return interaction.editReply({ components: [okBox(`**${wf.name}** is now ${wf.enabled ? 'enabled' : 'disabled'}.`)], flags: V2_E });
      }

      if (sub === 'enable-all' || sub === 'disable-all') {
        const enabled = sub === 'enable-all';
        const n = store.setEnabledAll(guildId, enabled);
        return interaction.editReply({ components: [okBox(`${enabled ? 'enabled' : 'disabled'} **${n}** automation(s).`)], flags: V2_E });
      }

      if (sub === 'export') {
        const id = interaction.options.getInteger('id');
        const wf = store.get(id);
        if (!wf || wf.guildId !== guildId) return interaction.editReply({ components: [errBox(`no automation with id \`${id}\`.`)], flags: V2_E });
        const json = JSON.stringify({
          name: wf.name, trigger: wf.trigger, conditions: wf.conditions,
          conditionMode: wf.conditionMode, actions: wf.actions, cooldownSeconds: wf.cooldownSeconds,
        }, null, 2);
        return interaction.editReply({ components: [new ContainerBuilder().setAccentColor(0x5b7fd4)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.file} export — ${wf.name}`))
          .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`\`\`\`json\n${json.slice(0, 3800)}\n\`\`\``))], flags: V2_E });
      }

      if (sub === 'import') {
        const raw = interaction.options.getString('json');
        let data;
        try { data = JSON.parse(raw); } catch { return interaction.editReply({ components: [errBox('invalid json.')], flags: V2_E }); }
        const items = Array.isArray(data) ? data : [data];
        const imported = [], skipped = [];
        for (const item of items) {
          if (!item.name || !item.trigger) { skipped.push(item.name || '(unnamed)'); continue; }
          if (store.listForGuild(guildId).some(w => w.name.toLowerCase() === String(item.name).toLowerCase())) { skipped.push(item.name); continue; }
          const wf = store.create(guildId, {
            name: String(item.name).slice(0, 50),
            trigger: item.trigger,
            conditions: Array.isArray(item.conditions) ? item.conditions : [],
            conditionMode: item.conditionMode === 'any' ? 'any' : 'all',
            actions: Array.isArray(item.actions) ? item.actions : [],
            cooldownSeconds: Number(item.cooldownSeconds) || 5,
            createdBy: userId,
          });
          imported.push(`${wf.name} (\`${wf.id}\`)`);
        }
        const lines = [];
        if (imported.length) lines.push(`${E.success} imported ${imported.length}:\n${imported.map(x => '  · ' + x).join('\n')}`);
        if (skipped.length) lines.push(`${E.error} skipped ${skipped.length}:\n${skipped.map(x => '  · ' + x).join('\n')}`);
        return interaction.editReply({ components: [new ContainerBuilder().setAccentColor(imported.length ? 0x57f287 : 0xff3b3b)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n\n') || 'nothing imported.'))], flags: V2_E });
      }

      if (sub === 'templates') {
        const lines = templates.map(t => `${E.file} **${t.name}** · id \`${t.id}\`\n-# ${t.desc}`);
        return interaction.editReply({ components: [new ContainerBuilder().setAccentColor(0x5b7fd4)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.folder} templates`))
          .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n\n')))], flags: V2_E });
      }

      if (sub === 'from-template') {
        const tplId = interaction.options.getString('id');
        const tpl = templates.find(t => t.id === tplId);
        if (!tpl) return interaction.editReply({ components: [errBox(`no template \`${tplId}\`.`)], flags: V2_E });
        const wf = store.create(guildId, { ...tpl, createdBy: userId });
        return interaction.editReply({ components: [okBox(`created **${wf.name}** · id \`${wf.id}\``)], flags: V2_E });
      }

      if (sub === 'stats') {
        const list = store.listForGuild(guildId);
        const enabled = list.filter(w => w.enabled).length;
        const totalFires = list.reduce((s, w) => s + (w.fireCount || 0), 0);
        const totalErrors = list.reduce((s, w) => s + (w.errorCount || 0), 0);
        const c = new ContainerBuilder().setAccentColor(0x5b7fd4);
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.wheel} automation stats`));
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent([
          `${E.file} total: ${list.length}`,
          `${E.on} enabled: ${enabled}`,
          `${E.off} disabled: ${list.length - enabled}`,
          `${E.cursor} fires: ${totalFires}`,
          `${E.error} errors: ${totalErrors}`,
        ].join('\n')));
        return interaction.editReply({ components: [c], flags: V2_E });
      }
    } catch (err) {
      console.error('[automation] execute error:', err);
      if (err.rawError) console.error('[automation] rawError:', JSON.stringify(err.rawError));
      interaction.editReply({ components: [errBox(`error: ${String(err.message).slice(0, 200)}`)], flags: V2_E }).catch(() => {});
    }
  },
};
