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
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.wheel} automation builder`));
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${hint || 'trigger -> conditions -> actions'}`));
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

async function modalFlow(triggerInteraction, modal, filterFn) {
  await triggerInteraction.showModal(modal).catch(() => {});
  const sub = await triggerInteraction.awaitModalSubmit({ time: 120000, filter: filterFn }).catch(() => null);
  if (!sub) return null;
  await ackModal(sub);
  return sub;
}

/* ── prompt: trigger ── */
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

    const modal = new ModalBuilder().setCustomId('auto_sched').setTitle(`scheduled: ${mode}`);
    if (mode === 'interval') {
      modal.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('min').setLabel('minutes').setStyle(TextInputStyle.Short).setRequired(true).setValue('60').setMaxLength(4)
      ));
      const sub = await modalFlow(sched, modal, m => m.customId === 'auto_sched' && m.user.id === userId);
      if (!sub) return null;
      return { type, mode, minutes: Math.max(1, parseInt(sub.fields.getTextInputValue('min'), 10) || 60) };
    }
    if (mode === 'daily') {
      modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('h').setLabel('hour 0-23').setStyle(TextInputStyle.Short).setRequired(true).setValue('9').setMaxLength(2)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('m').setLabel('minute 0-59').setStyle(TextInputStyle.Short).setRequired(true).setValue('0').setMaxLength(2)),
      );
      const sub = await modalFlow(sched, modal, m => m.customId === 'auto_sched' && m.user.id === userId);
      if (!sub) return null;
      return { type, mode, hour: Math.min(23, Math.max(0, parseInt(sub.fields.getTextInputValue('h'), 10) || 0)), minute: Math.min(59, Math.max(0, parseInt(sub.fields.getTextInputValue('m'), 10) || 0)) };
    }
    if (mode === 'weekly') {
      modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('d').setLabel('day 0=sun 6=sat').setStyle(TextInputStyle.Short).setRequired(true).setValue('1').setMaxLength(1)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('h').setLabel('hour 0-23').setStyle(TextInputStyle.Short).setRequired(true).setValue('9').setMaxLength(2)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('m').setLabel('minute 0-59').setStyle(TextInputStyle.Short).setRequired(true).setValue('0').setMaxLength(2)),
      );
      const sub = await modalFlow(sched, modal, m => m.customId === 'auto_sched' && m.user.id === userId);
      if (!sub) return null;
      return { type, mode, day: Math.min(6, Math.max(0, parseInt(sub.fields.getTextInputValue('d'), 10) || 1)), hour: Math.min(23, Math.max(0, parseInt(sub.fields.getTextInputValue('h'), 10) || 0)), minute: Math.min(59, Math.max(0, parseInt(sub.fields.getTextInputValue('m'), 10) || 0)) };
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

/* ── prompt: condition ── */
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

/* ── prompt: action ── */
async function promptAction(interaction, msg, userId, btn, draft) {
  const menu = new StringSelectMenuBuilder().setCustomId('picker').setPlaceholder('pick an action')
    .addOptions(ACTIONS.map(a => new StringSelectMenuOptionBuilder().setLabel(a.label).setValue(a.value).setDescription(a.desc)));
  const pick = await showMenu(btn, msg, userId, `${E.cursor} pick an action`, menu);
  if (!pick) return null;
  const type = pick.values[0];
  const def = ACTIONS.find(x => x.value === type);

  const askText = async (title, id) => {
    const modal = new ModalBuilder().setCustomId(id).setTitle(title);
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('v').setLabel(title).setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(2000)
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
    const sub = await askText(def.input === 'text_reason' ? 'reason' : 'content', 'auto_act_text');
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
  if (def.input === 'none') {
    await pick.deferUpdate().catch(() => {});
    return { type, summary: 'on trigger' };
  }
  await pick.deferUpdate().catch(() => {});
  return null;
}

/* ── manage ── */
async function manage(interaction, msg, userId, btn, draft) {
  const items = [
    ...draft.conditions.map((c, i) => ({ k: 'c', i, label: `cond ${i + 1}: ${c.type} ${c.op} ${Array.isArray(c.value) ? c.value.join(',') : c.value ?? ''}` })),
    ...draft.actions.map((a, i) => ({ k: 'a', i, label: `act ${i + 1}: ${a.type} · ${a.summary || ''}` })),
  ];
  if (!items.length) return false;

  const menu = new StringSelectMenuBuilder().setCustomId('picker').setPlaceholder('pick to remove')
    .addOptions(items.map(x => new StringSelectMenuOptionBuilder().setLabel(x.label.slice(0, 100)).setValue(`${x.k}:${x.i}`)));
  const pick = await showMenu(btn, msg, userId, `${E.folder} remove an item`, menu);
  if (!pick) return false;
  await pick.deferUpdate().catch(() => {});
  const [k, i] = pick.values[0].split(':');
  const idx = parseInt(i, 10);
  if (k === 'c') draft.conditions.splice(idx, 1);
  if (k === 'a') draft.actions.splice(idx, 1);
  return true;
}

/* ── main loop ── */
async function runBuilder(interaction, userId, guildId, draft, editingId, hint) {
  await interaction.editReply({ components: [buildMain(draft, hint || 'set a trigger first')], flags: V2_E }).catch(() => {});
  const msg = await interaction.fetchReply().catch(() => null);
  if (!msg) return;

  const redraw = (hint) => interaction.editReply({ components: [buildMain(draft, hint)], flags: V2_E }).catch(() => {});

  while (true) {
    const btn = await awaitOne(msg, userId, 900000);
    if (!btn) return;

    try {
      if (btn.customId === 'auto_cancel') {
        await btn.update({ components: [okBox('cancelled.')], flags: V2_E }).catch(() => {});
        return;
      }

      if (btn.customId === 'auto_save') {
        await btn.deferUpdate().catch(() => {});
        if (!draft.trigger) { await redraw('set a trigger first'); continue; }
        if (!draft.actions.length) { await redraw('add at least one action'); continue; }
        if (editingId) {
          const updated = store.update(editingId, draft);
          await interaction.editReply({ components: [okBox(`updated **${updated.name}** · id \`${updated.id}\``)], flags: V2_E }).catch(() => {});
          return;
        }
        if (store.listForGuild(guildId).some(w => w.name.toLowerCase() === draft.name.toLowerCase())) {
          await redraw('name already taken');
          continue;
        }
        const wf = store.create(guildId, draft);
        await interaction.editReply({ components: [okBox(`saved **${wf.name}** · id \`${wf.id}\``)], flags: V2_E }).catch(() => {});
        return;
      }

      if (btn.customId === 'auto_set_trigger') {
        const t = await promptTrigger(interaction, msg, userId, btn);
        if (t) draft.trigger = t;
        await redraw();
        continue;
      }

      if (btn.customId === 'auto_add_cond') {
        const c = await promptCondition(interaction, msg, userId, btn);
        if (c) draft.conditions.push(c);
        await redraw();
        continue;
      }

      if (btn.customId === 'auto_add_action') {
        const a = await promptAction(interaction, msg, userId, btn, draft);
        if (a) draft.actions.push(a);
        await redraw();
        continue;
      }

      if (btn.customId === 'auto_mode') {
        await btn.deferUpdate().catch(() => {});
        draft.conditionMode = draft.conditionMode === 'all' ? 'any' : 'all';
        await redraw();
        continue;
      }

      if (btn.customId === 'auto_cooldown') {
        const modal = new ModalBuilder().setCustomId('auto_cd').setTitle('cooldown');
        modal.addComponents(new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('sec').setLabel('seconds 0-600').setStyle(TextInputStyle.Short).setRequired(true).setValue(String(draft.cooldownSeconds)).setMaxLength(3)
        ));
        const sub = await modalFlow(btn, modal, m => m.customId === 'auto_cd' && m.user.id === userId);
        if (sub) {
          const n = parseInt(sub.fields.getTextInputValue('sec'), 10);
          draft.cooldownSeconds = Number.isFinite(n) ? Math.max(0, Math.min(600, n)) : 5;
        }
        await redraw();
        continue;
      }

      if (btn.customId === 'auto_manage') {
        await manage(interaction, msg, userId, btn, draft);
        await redraw();
        continue;
      }

      if (btn.customId === 'auto_clear') {
        await btn.deferUpdate().catch(() => {});
        draft.trigger = null; draft.conditions = []; draft.actions = [];
        await redraw('cleared');
        continue;
      }

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
        await redraw();
        continue;
      }

      /* unknown button — just ack + redraw */
      await btn.deferUpdate().catch(() => {});
      await redraw();
    } catch (e) {
      console.error('[automation] collect error:', e);
      try { await redraw(); } catch {}
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
    .addSubcommand(s => s.setName('templates').setDescription('browse pre-made automations'))
    .addSubcommand(s => s.setName('from-template').setDescription('create from a template')
      .addStringOption(o => o.setName('id').setDescription('template id').setRequired(true)))
    .addSubcommand(s => s.setName('list').setDescription('list all automations'))
    .addSubcommand(s => s.setName('info').setDescription('view an automation')
      .addIntegerOption(o => o.setName('id').setDescription('automation id').setRequired(true)))
    .addSubcommand(s => s.setName('delete').setDescription('delete an automation')
      .addIntegerOption(o => o.setName('id').setDescription('automation id').setRequired(true)))
    .addSubcommand(s => s.setName('enable').setDescription('enable an automation')
      .addIntegerOption(o => o.setName('id').setDescription('automation id').setRequired(true)))
    .addSubcommand(s => s.setName('disable').setDescription('disable an automation')
      .addIntegerOption(o => o.setName('id').setDescription('automation id').setRequired(true)))
    .addSubcommand(s => s.setName('stats').setDescription('automation stats')),

  async execute(interaction) {
    /* ack FIRST so we never time out */
    await interaction.deferReply({ flags: V2_E }).catch(() => {});

    /* permission check AFTER ack */
    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild)) {
      return interaction.editReply({ components: [errBox('manage server required.')], flags: V2_E }).catch(() => {});
    }

    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    const guildId = interaction.guild.id;

    try {
      if (sub === 'create') {
        const startRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('auto_start').setLabel('start building').setStyle(ButtonStyle.Primary)
        );
        await interaction.editReply({
          components: [new ContainerBuilder().setAccentColor(0x5b7fd4)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.wheel} new automation\n-# click to name it`))
            .addActionRowComponents(startRow)],
          flags: V2_E,
        });
        const msg = await interaction.fetchReply();
        const startClick = await awaitOne(msg, userId, 60000);
        if (!startClick) return;

        const modal = new ModalBuilder().setCustomId('auto_name').setTitle('name your automation');
        modal.addComponents(new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('name').setLabel('name').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(50).setPlaceholder('welcome-new-members')
        ));
        await startClick.showModal(modal).catch(() => {});
        const nameSub = await startClick.awaitModalSubmit({ time: 120000, filter: m => m.customId === 'auto_name' && m.user.id === userId }).catch(() => null);
        if (!nameSub) return;
        await ackModal(nameSub);

        const draft = { name: nameSub.fields.getTextInputValue('name'), trigger: null, conditions: [], conditionMode: 'all', actions: [], cooldownSeconds: 5, createdBy: userId };
        return runBuilder(interaction, userId, guildId, draft, null);
      }

      if (sub === 'edit') {
        const id = interaction.options.getInteger('id');
        const wf = store.get(id);
        if (!wf || wf.guildId !== guildId) return interaction.editReply({ components: [errBox(`no automation with id \`${id}\`.`)], flags: V2_E });
        const draft = { name: wf.name, trigger: JSON.parse(JSON.stringify(wf.trigger)), conditions: JSON.parse(JSON.stringify(wf.conditions || [])), conditionMode: wf.conditionMode || 'all', actions: JSON.parse(JSON.stringify(wf.actions || [])), cooldownSeconds: wf.cooldownSeconds ?? 5, createdBy: wf.createdBy };
        return runBuilder(interaction, userId, guildId, draft, wf.id, `editing **${wf.name}**`);
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

      if (sub === 'list') {
        const list = store.listForGuild(guildId);
        if (!list.length) return interaction.editReply({ components: [new ContainerBuilder().setAccentColor(0x5b7fd4).addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.folder} no automations yet.`))], flags: V2_E });
        const lines = list.map(w => `${w.enabled ? E.on : E.off} **${w.name}** · id \`${w.id}\` · \`${w.trigger?.type || 'none'}\``);
        return interaction.editReply({ components: [new ContainerBuilder().setAccentColor(0x5b7fd4)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.folder} automations (${list.length})`))
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')))], flags: V2_E });
      }

      if (sub === 'info') {
        const id = interaction.options.getInteger('id');
        const wf = store.get(id);
        if (!wf || wf.guildId !== guildId) return interaction.editReply({ components: [errBox(`no automation with id \`${id}\`.`)], flags: V2_E });
        const c = new ContainerBuilder().setAccentColor(0x5b7fd4);
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.file} ${wf.name}`));
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# id \`${wf.id}\` · ${wf.enabled ? 'enabled' : 'disabled'}`));
        c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.compass} **trigger:** \`${wf.trigger?.type || 'none'}\`\n${E.folder} **conditions:** ${wf.conditions.length}\n${E.cursor} **actions:** ${wf.actions.length}`));
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

      if (sub === 'enable' || sub === 'disable') {
        const id = interaction.options.getInteger('id');
        const wf = store.get(id);
        if (!wf || wf.guildId !== guildId) return interaction.editReply({ components: [errBox(`no automation with id \`${id}\`.`)], flags: V2_E });
        wf.enabled = sub === 'enable';
        store.update(id, wf);
        return interaction.editReply({ components: [okBox(`**${wf.name}** is now ${wf.enabled ? 'enabled' : 'disabled'}.`)], flags: V2_E });
      }

      if (sub === 'stats') {
        const list = store.listForGuild(guildId);
        const enabled = list.filter(w => w.enabled).length;
        const totalFires = list.reduce((s, w) => s + (w.fireCount || 0), 0);
        const c = new ContainerBuilder().setAccentColor(0x5b7fd4);
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.wheel} automation stats`));
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent([
          `${E.file} total: ${list.length}`,
          `${E.on} enabled: ${enabled}`,
          `${E.off} disabled: ${list.length - enabled}`,
          `${E.cursor} fires: ${totalFires}`,
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
