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
  member:   "<:member:1530383558710005960>",
  channel:  "<:Channel:1531901854361849929>",
};

const V2_E = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;

const errBox = (m) => new ContainerBuilder().setAccentColor(0xff3b3b)
  .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.error} ${m}`));
const okBox = (m) => new ContainerBuilder().setAccentColor(0x57f287)
  .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.success} ${m}`));

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
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# id \`${draft.id}\` · ${draft.enabled ? 'enabled' : 'disabled'}${hint ? ' · ' + hint : ''}`));
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
    new ButtonBuilder().setCustomId('a_trig').setLabel(t ? 'change trigger' : 'set trigger').setStyle(t ? ButtonStyle.Secondary : ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('a_cond').setLabel('add condition').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('a_act').setLabel('add action').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('a_mode').setLabel(`mode: ${draft.conditionMode}`).setStyle(ButtonStyle.Secondary),
  );
  const r2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('a_cd').setLabel(`cooldown: ${draft.cooldownSeconds}s`).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('a_manage').setLabel('manage').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('a_undo').setLabel('undo').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('a_toggle').setLabel(draft.enabled ? 'disable' : 'enable').setStyle(draft.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
    new ButtonBuilder().setCustomId('a_clear').setLabel('clear').setStyle(ButtonStyle.Danger),
  );
  const r3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('a_export').setLabel('export').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('a_close').setLabel('close').setStyle(ButtonStyle.Secondary),
  );
  c.addActionRowComponents(r1, r2, r3);
  return c;
}

function menuView(title, menu) {
  return new ContainerBuilder().setAccentColor(0x5b7fd4)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${title}`))
    .addActionRowComponents(new ActionRowBuilder().addComponents(menu));
}

function triggerPicker() {
  return menuView(`${E.compass} pick a trigger`,
    new StringSelectMenuBuilder().setCustomId('p').setPlaceholder('pick a trigger')
      .addOptions(TRIGGERS.map(t => new StringSelectMenuOptionBuilder().setLabel(t.label).setValue(t.value).setDescription(t.desc))));
}
function conditionPicker() {
  return menuView(`${E.folder} pick a condition`,
    new StringSelectMenuBuilder().setCustomId('p').setPlaceholder('pick')
      .addOptions(CONDITIONS.map(c => new StringSelectMenuOptionBuilder().setLabel(c.label).setValue(c.value).setDescription(c.desc))));
}
function actionPicker() {
  return menuView(`${E.cursor} pick an action`,
    new StringSelectMenuBuilder().setCustomId('p').setPlaceholder('pick')
      .addOptions(ACTIONS.map(a => new StringSelectMenuOptionBuilder().setLabel(a.label).setValue(a.value).setDescription(a.desc))));
}
function channelPicker(title, types = [ChannelType.GuildText, ChannelType.GuildAnnouncement]) {
  return menuView(`${E.channel} ${title}`,
    new ChannelSelectMenuBuilder().setCustomId('p').setPlaceholder('pick').addChannelTypes(...types));
}
function rolePicker(title) {
  return menuView(`${E.member} ${title}`,
    new RoleSelectMenuBuilder().setCustomId('p').setPlaceholder('pick'));
}
function scheduleTypePicker() {
  return menuView(`${E.settings} schedule type`,
    new StringSelectMenuBuilder().setCustomId('p').setPlaceholder('pick').addOptions(
      new StringSelectMenuOptionBuilder().setLabel('interval').setValue('interval').setDescription('every N minutes'),
      new StringSelectMenuOptionBuilder().setLabel('daily').setValue('daily').setDescription('every day at HH:MM'),
      new StringSelectMenuOptionBuilder().setLabel('weekly').setValue('weekly').setDescription('every week'),
    ));
}
function opPicker() {
  return menuView(`${E.settings} operator`,
    new StringSelectMenuBuilder().setCustomId('p').setPlaceholder('pick').addOptions(
      new StringSelectMenuOptionBuilder().setLabel('is').setValue('is'),
      new StringSelectMenuOptionBuilder().setLabel('is not').setValue('is not'),
    ));
}

async function runBuilder(interaction, userId, guildId, draft) {
  const history = [];
  const pushH = () => {
    history.push(JSON.stringify({ trigger: draft.trigger, conditions: draft.conditions, actions: draft.actions, conditionMode: draft.conditionMode, cooldownSeconds: draft.cooldownSeconds }));
    if (history.length > 15) history.shift();
  };
  const save = async () => {
    try { await store.update(draft.id, draft); } catch (e) { console.error('[auto] save err:', e.message); }
  };

  const msg = await interaction.fetchReply().catch(() => null);
  if (!msg) return;

  while (true) {
    const btn = await awaitOne(msg, userId, 900000);
    if (!btn) return;

    try {
      /* simple changes — btn.update directly */
      if (btn.customId === 'a_toggle') {
        draft.enabled = !draft.enabled;
        await save();
        await btn.update({ components: [buildMain(draft, draft.enabled ? 'enabled' : 'disabled')], flags: V2_E });
        continue;
      }
      if (btn.customId === 'a_mode') {
        pushH();
        draft.conditionMode = draft.conditionMode === 'all' ? 'any' : 'all';
        await save();
        await btn.update({ components: [buildMain(draft)], flags: V2_E });
        continue;
      }
      if (btn.customId === 'a_clear') {
        pushH();
        draft.trigger = null; draft.conditions = []; draft.actions = [];
        await save();
        await btn.update({ components: [buildMain(draft, 'cleared')], flags: V2_E });
        continue;
      }
      if (btn.customId === 'a_undo') {
        if (!history.length) { await btn.update({ components: [buildMain(draft, 'nothing to undo')], flags: V2_E }); continue; }
        Object.assign(draft, JSON.parse(history.pop()));
        await save();
        await btn.update({ components: [buildMain(draft, 'undone')], flags: V2_E });
        continue;
      }
      if (btn.customId === 'a_close') {
        await btn.update({ components: [okBox(`closed · **${draft.name}** id \`${draft.id}\``)], flags: V2_E });
        return;
      }
      if (btn.customId === 'a_export') {
        const json = JSON.stringify({ name: draft.name, trigger: draft.trigger, conditions: draft.conditions, conditionMode: draft.conditionMode, actions: draft.actions, cooldownSeconds: draft.cooldownSeconds }, null, 2);
        await btn.reply({ components: [new ContainerBuilder().setAccentColor(0x5b7fd4)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.file} export\n\`\`\`json\n${json.slice(0, 3800)}\n\`\`\``))], flags: V2_E | MessageFlags.Ephemeral });
        continue;
      }

      /* trigger */
      if (btn.customId === 'a_trig') {
        await btn.update({ components: [triggerPicker()], flags: V2_E });
        const pick = await awaitOne(msg, userId, 60000);
        if (!pick) return;
        const type = pick.values[0];

        if (type === 'message') {
          const modal = new ModalBuilder().setCustomId('m1').setTitle('message trigger');
          modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('kw').setLabel('keyword').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(150)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('mode').setLabel('contains/exact/starts/ends/regex').setStyle(TextInputStyle.Short).setRequired(true).setValue('contains').setMaxLength(10)),
          );
          await pick.showModal(modal);
          const sub = await pick.awaitModalSubmit({ time: 120000, filter: m => m.customId === 'm1' && m.user.id === userId }).catch(() => null);
          if (!sub) return;
          const raw = (sub.fields.getTextInputValue('mode') || 'contains').toLowerCase().trim();
          const valid = ['contains','exact','starts','ends','regex'];
          pushH();
          draft.trigger = { type, keyword: sub.fields.getTextInputValue('kw'), matchMode: valid.includes(raw) ? raw : 'contains' };
          await save();
          await sub.update({ components: [buildMain(draft)], flags: V2_E });
          continue;
        }
        if (type === 'reaction_add' || type === 'reaction_remove') {
          const modal = new ModalBuilder().setCustomId('m1').setTitle('reaction trigger');
          modal.addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('e').setLabel('emoji (blank = any)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(60)));
          await pick.showModal(modal);
          const sub = await pick.awaitModalSubmit({ time: 120000, filter: m => m.customId === 'm1' && m.user.id === userId }).catch(() => null);
          if (!sub) return;
          pushH();
          draft.trigger = { type, emoji: sub.fields.getTextInputValue('e') || '' };
          await save();
          await sub.update({ components: [buildMain(draft)], flags: V2_E });
          continue;
        }
        if (type === 'role_added' || type === 'role_removed') {
          await pick.update({ components: [rolePicker('pick a role')], flags: V2_E });
          const role = await awaitOne(msg, userId, 60000);
          if (!role) return;
          pushH();
          draft.trigger = { type, roleId: role.values[0] };
          await save();
          await role.update({ components: [buildMain(draft)], flags: V2_E });
          continue;
        }
        if (type === 'scheduled') {
          await pick.update({ components: [scheduleTypePicker()], flags: V2_E });
          const sched = await awaitOne(msg, userId, 60000);
          if (!sched) return;
          const mode = sched.values[0];
          const modal = new ModalBuilder().setCustomId('m1').setTitle(mode);
          if (mode === 'interval') {
            modal.addComponents(new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('min').setLabel('minutes').setStyle(TextInputStyle.Short).setRequired(true).setValue('60').setMaxLength(4)));
          } else if (mode === 'daily' || mode === 'weekly') {
            if (mode === 'weekly') modal.addComponents(new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('d').setLabel('day 0=sun 6=sat').setStyle(TextInputStyle.Short).setRequired(true).setValue('1').setMaxLength(1)));
            modal.addComponents(
              new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('h').setLabel('hour 0-23').setStyle(TextInputStyle.Short).setRequired(true).setValue('9').setMaxLength(2)),
              new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('m').setLabel('minute 0-59').setStyle(TextInputStyle.Short).setRequired(true).setValue('0').setMaxLength(2)),
            );
          }
          await sched.showModal(modal);
          const sub = await sched.awaitModalSubmit({ time: 120000, filter: m => m.customId === 'm1' && m.user.id === userId }).catch(() => null);
          if (!sub) return;
          pushH();
          if (mode === 'interval') draft.trigger = { type, mode, minutes: Math.max(1, parseInt(sub.fields.getTextInputValue('min'), 10) || 60) };
          else {
            const out = { type, mode, hour: Math.min(23, Math.max(0, parseInt(sub.fields.getTextInputValue('h'), 10) || 0)), minute: Math.min(59, Math.max(0, parseInt(sub.fields.getTextInputValue('m'), 10) || 0)) };
            if (mode === 'weekly') out.day = Math.min(6, Math.max(0, parseInt(sub.fields.getTextInputValue('d'), 10) || 1));
            draft.trigger = out;
          }
          await save();
          await sub.update({ components: [buildMain(draft)], flags: V2_E });
          continue;
        }
        if (type === 'button_click') {
          const modal = new ModalBuilder().setCustomId('m1').setTitle('button trigger');
          modal.addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('cid').setLabel('custom id (blank = any)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(100)));
          await pick.showModal(modal);
          const sub = await pick.awaitModalSubmit({ time: 120000, filter: m => m.customId === 'm1' && m.user.id === userId }).catch(() => null);
          if (!sub) return;
          pushH();
          draft.trigger = { type, customId: sub.fields.getTextInputValue('cid') || null };
          await save();
          await sub.update({ components: [buildMain(draft)], flags: V2_E });
          continue;
        }
        pushH();
        draft.trigger = { type };
        await save();
        await pick.update({ components: [buildMain(draft)], flags: V2_E });
        continue;
      }

      /* add condition */
      if (btn.customId === 'a_cond') {
        await btn.update({ components: [conditionPicker()], flags: V2_E });
        const pick = await awaitOne(msg, userId, 60000);
        if (!pick) return;
        const type = pick.values[0];
        const def = CONDITIONS.find(x => x.value === type);

        if (def.input === 'channel') {
          await pick.update({ components: [channelPicker('pick a channel')], flags: V2_E });
          const ch = await awaitOne(msg, userId, 60000);
          if (!ch) return;
          await ch.update({ components: [opPicker()], flags: V2_E });
          const op = await awaitOne(msg, userId, 60000);
          if (!op) return;
          pushH(); draft.conditions.push({ type, op: op.values[0], value: ch.values[0] });
          await save();
          await op.update({ components: [buildMain(draft)], flags: V2_E });
          continue;
        }
        if (def.input === 'role') {
          await pick.update({ components: [rolePicker('pick a role')], flags: V2_E });
          const role = await awaitOne(msg, userId, 60000);
          if (!role) return;
          await role.update({ components: [opPicker()], flags: V2_E });
          const op = await awaitOne(msg, userId, 60000);
          if (!op) return;
          pushH(); draft.conditions.push({ type, op: op.values[0], value: role.values[0] });
          await save();
          await op.update({ components: [buildMain(draft)], flags: V2_E });
          continue;
        }
        if (def.input === 'text' || def.input === 'number' || def.input === 'user' || def.input === 'hour_range') {
          const modal = new ModalBuilder().setCustomId('m2').setTitle(type);
          const label = def.input === 'number' ? 'threshold' : def.input === 'user' ? 'user id' : def.input === 'hour_range' ? 'range like 9-17' : 'string';
          modal.addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('v').setLabel(label).setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(200)));
          await pick.showModal(modal);
          const sub = await pick.awaitModalSubmit({ time: 120000, filter: m => m.customId === 'm2' && m.user.id === userId }).catch(() => null);
          if (!sub) return;
          const val = sub.fields.getTextInputValue('v');
          await sub.update({ components: [opPicker()], flags: V2_E });
          const op = await awaitOne(msg, userId, 60000);
          if (!op) return;
          pushH(); draft.conditions.push({ type, op: op.values[0], value: val });
          await save();
          await op.update({ components: [buildMain(draft)], flags: V2_E });
          continue;
        }
        if (def.input === 'bool') {
          await pick.update({ components: [opPicker()], flags: V2_E });
          const op = await awaitOne(msg, userId, 60000);
          if (!op) return;
          pushH(); draft.conditions.push({ type, op: op.values[0] });
          await save();
          await op.update({ components: [buildMain(draft)], flags: V2_E });
          continue;
        }
        await pick.update({ components: [buildMain(draft, 'cancelled')], flags: V2_E });
        continue;
      }

      /* add action */
      if (btn.customId === 'a_act') {
        await btn.update({ components: [actionPicker()], flags: V2_E });
        const pick = await awaitOne(msg, userId, 60000);
        if (!pick) return;
        const type = pick.values[0];
        const def = ACTIONS.find(x => x.value === type);

        if (def.input === 'channel+text' || def.input === 'channel+container' || def.input === 'channel+embed') {
          await pick.update({ components: [channelPicker('pick a channel')], flags: V2_E });
          const ch = await awaitOne(msg, userId, 60000);
          if (!ch) return;
          if (def.input === 'channel+text') {
            const modal = new ModalBuilder().setCustomId('m3').setTitle('content');
            modal.addComponents(new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('v').setLabel('content').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(2000).setPlaceholder('{user} {server} {channel} {message}')));
            await ch.showModal(modal);
            const sub = await ch.awaitModalSubmit({ time: 120000, filter: m => m.customId === 'm3' && m.user.id === userId }).catch(() => null);
            if (!sub) return;
            pushH(); draft.actions.push({ type, channelId: ch.values[0], content: sub.fields.getTextInputValue('v'), summary: `-> <#${ch.values[0]}>` });
            await save();
            await sub.update({ components: [buildMain(draft)], flags: V2_E });
            continue;
          }
          const modal = new ModalBuilder().setCustomId('m3').setTitle(type);
          modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('t').setLabel('title').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(200)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('d').setLabel('description').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(2000)),
          );
          await ch.showModal(modal);
          const sub = await ch.awaitModalSubmit({ time: 120000, filter: m => m.customId === 'm3' && m.user.id === userId }).catch(() => null);
          if (!sub) return;
          pushH(); draft.actions.push({ type, channelId: ch.values[0], title: sub.fields.getTextInputValue('t'), description: sub.fields.getTextInputValue('d'), color: 0x5b7fd4, summary: `-> <#${ch.values[0]}>` });
          await save();
          await sub.update({ components: [buildMain(draft)], flags: V2_E });
          continue;
        }
        if (def.input === 'text' || def.input === 'text_reason') {
          const modal = new ModalBuilder().setCustomId('m3').setTitle(def.input === 'text_reason' ? 'reason' : 'content');
          modal.addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('v').setLabel('content').setStyle(def.input === 'text_reason' ? TextInputStyle.Short : TextInputStyle.Paragraph).setRequired(true).setMaxLength(2000)));
          await pick.showModal(modal);
          const sub = await pick.awaitModalSubmit({ time: 120000, filter: m => m.customId === 'm3' && m.user.id === userId }).catch(() => null);
          if (!sub) return;
          const val = sub.fields.getTextInputValue('v');
          pushH();
          if (def.input === 'text_reason') draft.actions.push({ type, reason: val, summary: type });
          else draft.actions.push({ type, content: val, summary: val.slice(0, 40) });
          await save();
          await sub.update({ components: [buildMain(draft)], flags: V2_E });
          continue;
        }
        if (def.input === 'role' || def.input === 'role+text') {
          await pick.update({ components: [rolePicker('pick a role')], flags: V2_E });
          const role = await awaitOne(msg, userId, 60000);
          if (!role) return;
          if (def.input === 'role') {
            pushH(); draft.actions.push({ type, roleId: role.values[0], summary: `<@&${role.values[0]}>` });
            await save();
            await role.update({ components: [buildMain(draft)], flags: V2_E });
            continue;
          }
          const modal = new ModalBuilder().setCustomId('m3').setTitle('dm content');
          modal.addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('v').setLabel('content').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(2000)));
          await role.showModal(modal);
          const sub = await role.awaitModalSubmit({ time: 120000, filter: m => m.customId === 'm3' && m.user.id === userId }).catch(() => null);
          if (!sub) return;
          pushH(); draft.actions.push({ type, roleId: role.values[0], content: sub.fields.getTextInputValue('v'), summary: `dm <@&${role.values[0]}>` });
          await save();
          await sub.update({ components: [buildMain(draft)], flags: V2_E });
          continue;
        }
        if (['emoji','seconds','minutes','user_id+text','webhook+text'].includes(def.input)) {
          const modal = new ModalBuilder().setCustomId('m3').setTitle(type);
          if (def.input === 'emoji') modal.addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('v').setLabel('emoji').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(60).setValue('⭐')));
          else if (def.input === 'seconds') modal.addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('v').setLabel('seconds 1-60').setStyle(TextInputStyle.Short).setRequired(true).setValue('3').setMaxLength(3)));
          else if (def.input === 'minutes') modal.addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('v').setLabel('minutes').setStyle(TextInputStyle.Short).setRequired(true).setValue('10').setMaxLength(6)));
          else if (def.input === 'user_id+text') modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('uid').setLabel('user id').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(25)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('v').setLabel('content').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(2000)));
          else if (def.input === 'webhook+text') modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('url').setLabel('webhook url').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(500)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('v').setLabel('content').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(2000)));
          await pick.showModal(modal);
          const sub = await pick.awaitModalSubmit({ time: 120000, filter: m => m.customId === 'm3' && m.user.id === userId }).catch(() => null);
          if (!sub) return;
          pushH();
          if (def.input === 'emoji') draft.actions.push({ type, emoji: sub.fields.getTextInputValue('v'), summary: sub.fields.getTextInputValue('v') });
          else if (def.input === 'seconds') { const n = Math.max(1, Math.min(60, parseInt(sub.fields.getTextInputValue('v'), 10) || 3)); draft.actions.push({ type, seconds: n, summary: `${n}s` }); }
          else if (def.input === 'minutes') { const n = Math.max(1, Math.min(40320, parseInt(sub.fields.getTextInputValue('v'), 10) || 10)); draft.actions.push({ type, minutes: n, reason: 'automation', summary: `${n}m` }); }
          else if (def.input === 'user_id+text') draft.actions.push({ type, userId: sub.fields.getTextInputValue('uid'), content: sub.fields.getTextInputValue('v'), summary: 'dm' });
          else if (def.input === 'webhook+text') draft.actions.push({ type, url: sub.fields.getTextInputValue('url'), content: sub.fields.getTextInputValue('v'), summary: 'webhook' });
          await save();
          await sub.update({ components: [buildMain(draft)], flags: V2_E });
          continue;
        }
        if (def.input === 'automation') {
          const list = (await store.listForGuild(guildId)).filter(w => w.id !== draft.id);
          if (!list.length) { await pick.update({ components: [buildMain(draft, 'no other automations')], flags: V2_E }); continue; }
          const opts = list.slice(0, 25).map(w => new StringSelectMenuOptionBuilder().setLabel(w.name.slice(0, 100)).setValue(w.name));
          await pick.update({ components: [menuView(`${E.link} chain into...`, new StringSelectMenuBuilder().setCustomId('p').setPlaceholder('pick').addOptions(opts))], flags: V2_E });
          const pk = await awaitOne(msg, userId, 60000);
          if (!pk) return;
          pushH(); draft.actions.push({ type, name: pk.values[0], summary: pk.values[0] });
          await save();
          await pk.update({ components: [buildMain(draft)], flags: V2_E });
          continue;
        }
        if (def.input === 'none') {
          pushH(); draft.actions.push({ type, summary: 'on trigger' });
          await save();
          await pick.update({ components: [buildMain(draft)], flags: V2_E });
          continue;
        }
        await pick.update({ components: [buildMain(draft, 'cancelled')], flags: V2_E });
        continue;
      }

      /* cooldown */
      if (btn.customId === 'a_cd') {
        const modal = new ModalBuilder().setCustomId('m4').setTitle('cooldown');
        modal.addComponents(new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('sec').setLabel('seconds 0-600').setStyle(TextInputStyle.Short).setRequired(true).setValue(String(draft.cooldownSeconds)).setMaxLength(3)));
        await btn.showModal(modal);
        const sub = await btn.awaitModalSubmit({ time: 120000, filter: m => m.customId === 'm4' && m.user.id === userId }).catch(() => null);
        if (!sub) return;
        pushH();
        const n = parseInt(sub.fields.getTextInputValue('sec'), 10);
        draft.cooldownSeconds = Number.isFinite(n) ? Math.max(0, Math.min(600, n)) : 5;
        await save();
        await sub.update({ components: [buildMain(draft)], flags: V2_E });
        continue;
      }

      /* manage */
      if (btn.customId === 'a_manage') {
        const items = [
          ...draft.conditions.map((c, i) => ({ k: 'c', i, label: `cond ${i + 1}: ${c.type} ${c.op}` })),
          ...draft.actions.map((a, i) => ({ k: 'a', i, label: `act ${i + 1}: ${a.type}` })),
        ];
        if (!items.length) { await btn.update({ components: [buildMain(draft, 'nothing to manage')], flags: V2_E }); continue; }
        const menu = new StringSelectMenuBuilder().setCustomId('p').setPlaceholder('pick to edit')
          .addOptions(items.map(x => new StringSelectMenuOptionBuilder().setLabel(x.label.slice(0, 100)).setValue(`${x.k}:${x.i}`)));
        await btn.update({ components: [menuView(`${E.folder} manage items`, menu)], flags: V2_E });
        const pick = await awaitOne(msg, userId, 60000);
        if (!pick) return;
        const [k, i] = pick.values[0].split(':');
        const idx = parseInt(i, 10);
        const arr = k === 'c' ? draft.conditions : draft.actions;
        const label = k === 'c' ? 'condition' : 'action';
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('mg_up').setLabel('move up').setStyle(ButtonStyle.Secondary).setDisabled(idx === 0),
          new ButtonBuilder().setCustomId('mg_down').setLabel('move down').setStyle(ButtonStyle.Secondary).setDisabled(idx === arr.length - 1),
          new ButtonBuilder().setCustomId('mg_del').setLabel('remove').setStyle(ButtonStyle.Danger),
        );
        await pick.update({ components: [new ContainerBuilder().setAccentColor(0x5b7fd4)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.folder} editing — ${label} ${idx + 1}`))
          .addActionRowComponents(row)], flags: V2_E });
        const action = await awaitOne(msg, userId, 30000);
        if (!action) return;
        pushH();
        if (action.customId === 'mg_del') arr.splice(idx, 1);
        else if (action.customId === 'mg_up' && idx > 0) [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
        else if (action.customId === 'mg_down' && idx < arr.length - 1) [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
        await save();
        await action.update({ components: [buildMain(draft)], flags: V2_E });
        continue;
      }

      await btn.update({ components: [buildMain(draft)], flags: V2_E });
    } catch (e) {
      console.error('[auto] handler err:', e);
      try { await btn.reply({ content: `error: ${String(e.message).slice(0, 100)}`, flags: MessageFlags.Ephemeral }); } catch {}
    }
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('automation')
    .setDescription('build server automations · beta (mod only)')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
    .addSubcommand(s => s.setName('create').setDescription('create'))
    .addSubcommand(s => s.setName('edit').setDescription('edit').addIntegerOption(o => o.setName('id').setDescription('id').setRequired(true)))
    .addSubcommand(s => s.setName('list').setDescription('list all'))
    .addSubcommand(s => s.setName('search').setDescription('search').addStringOption(o => o.setName('query').setDescription('query').setRequired(true)))
    .addSubcommand(s => s.setName('recent').setDescription('recent fires'))
    .addSubcommand(s => s.setName('info').setDescription('view').addIntegerOption(o => o.setName('id').setDescription('id').setRequired(true)))
    .addSubcommand(s => s.setName('delete').setDescription('delete').addIntegerOption(o => o.setName('id').setDescription('id').setRequired(true)))
    .addSubcommand(s => s.setName('duplicate').setDescription('duplicate').addIntegerOption(o => o.setName('id').setDescription('id').setRequired(true)).addStringOption(o => o.setName('new_name').setDescription('new name').setRequired(true)))
    .addSubcommand(s => s.setName('enable').setDescription('enable').addIntegerOption(o => o.setName('id').setDescription('id').setRequired(true)))
    .addSubcommand(s => s.setName('disable').setDescription('disable').addIntegerOption(o => o.setName('id').setDescription('id').setRequired(true)))
    .addSubcommand(s => s.setName('enable-all').setDescription('enable all'))
    .addSubcommand(s => s.setName('disable-all').setDescription('disable all'))
    .addSubcommand(s => s.setName('export').setDescription('export').addIntegerOption(o => o.setName('id').setDescription('id').setRequired(true)))
    .addSubcommand(s => s.setName('import').setDescription('import').addStringOption(o => o.setName('json').setDescription('json').setRequired(true)))
    .addSubcommand(s => s.setName('templates').setDescription('templates'))
    .addSubcommand(s => s.setName('from-template').setDescription('from template').addStringOption(o => o.setName('id').setDescription('id').setRequired(true)))
    .addSubcommand(s => s.setName('stats').setDescription('stats')),

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
        const startRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('a_start').setLabel('start building').setStyle(ButtonStyle.Primary));
        await interaction.editReply({
          components: [new ContainerBuilder().setAccentColor(0x5b7fd4)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.wheel} new automation\n-# click to name it`))
            .addActionRowComponents(startRow)],
          flags: V2_E,
        });
        const msg = await interaction.fetchReply();
        const startClick = await awaitOne(msg, userId, 60000);
        if (!startClick) return;

        const modal = new ModalBuilder().setCustomId('m_name').setTitle('name your automation');
        modal.addComponents(new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('name').setLabel('name').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(50).setPlaceholder('welcome-new-members')));
        await startClick.showModal(modal);
        const nameSub = await startClick.awaitModalSubmit({ time: 120000, filter: m => m.customId === 'm_name' && m.user.id === userId }).catch(() => null);
        if (!nameSub) return;

        const name = nameSub.fields.getTextInputValue('name');
        const existing = await store.listForGuild(guildId);
        if (existing.some(w => w.name.toLowerCase() === name.toLowerCase())) {
          return nameSub.update({ components: [errBox(`an automation named **${name}** already exists.`)], flags: V2_E });
        }

        const wf = await store.create(guildId, { name, trigger: null, conditions: [], conditionMode: 'all', actions: [], cooldownSeconds: 5, enabled: false, createdBy: userId });
        const draft = { id: wf.id, name: wf.name, trigger: null, conditions: [], conditionMode: 'all', actions: [], cooldownSeconds: 5, enabled: false };
        await nameSub.update({ components: [buildMain(draft, 'created — set a trigger')], flags: V2_E });
        return runBuilder(interaction, userId, guildId, draft);
      }

      if (sub === 'edit') {
        const id = interaction.options.getInteger('id');
        const wf = await store.get(id);
        if (!wf || wf.guildId !== guildId) return interaction.editReply({ components: [errBox(`no automation with id \`${id}\`.`)], flags: V2_E });
        const draft = { id: wf.id, name: wf.name, trigger: wf.trigger, conditions: wf.conditions || [], conditionMode: wf.conditionMode || 'all', actions: wf.actions || [], cooldownSeconds: wf.cooldownSeconds ?? 5, enabled: wf.enabled ?? false };
        await interaction.editReply({ components: [buildMain(draft)], flags: V2_E });
        return runBuilder(interaction, userId, guildId, draft);
      }

      if (sub === 'list') {
        const list = await store.listForGuild(guildId);
        if (!list.length) return interaction.editReply({ components: [new ContainerBuilder().setAccentColor(0x5b7fd4).addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.folder} no automations yet.`))], flags: V2_E });
        const lines = list.map(w => `${w.enabled ? E.on : E.off} **${w.name}** · id \`${w.id}\` · \`${w.trigger?.type || 'none'}\``);
        return interaction.editReply({ components: [new ContainerBuilder().setAccentColor(0x5b7fd4)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.folder} automations (${list.length})`))
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')))], flags: V2_E });
      }

      if (sub === 'search') {
        const q = interaction.options.getString('query').toLowerCase().trim();
        const all = await store.listForGuild(guildId);
        const list = all.filter(w => w.name.toLowerCase().includes(q) || (w.trigger?.type || '').toLowerCase().includes(q) || (w.actions || []).some(a => a.type.toLowerCase().includes(q)));
        if (!list.length) return interaction.editReply({ components: [errBox(`no matches for **${q}**.`)], flags: V2_E });
        const lines = list.map(w => `${w.enabled ? E.on : E.off} **${w.name}** · id \`${w.id}\``);
        return interaction.editReply({ components: [new ContainerBuilder().setAccentColor(0x5b7fd4)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.compass} search (${list.length})`))
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')))], flags: V2_E });
      }

      if (sub === 'recent') {
        const fires = await store.getRecentFires(guildId, 20);
        if (!fires.length) return interaction.editReply({ components: [errBox('no recent fires.')], flags: V2_E });
        const lines = fires.map(f => `${f.ok ? E.success : E.error} <t:${Math.floor(f.at / 1000)}:R> · **${f.name}**`);
        return interaction.editReply({ components: [new ContainerBuilder().setAccentColor(0x5b7fd4)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.cursor} recent fires`))
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')))], flags: V2_E });
      }

      if (sub === 'info') {
        const id = interaction.options.getInteger('id');
        const wf = await store.get(id);
        if (!wf || wf.guildId !== guildId) return interaction.editReply({ components: [errBox(`no automation with id \`${id}\`.`)], flags: V2_E });
        const c = new ContainerBuilder().setAccentColor(0x5b7fd4);
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.file} ${wf.name}`));
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# id \`${wf.id}\` · ${wf.enabled ? 'enabled' : 'disabled'} · ${wf.fireCount} fires`));
        c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.compass} **trigger:** \`${wf.trigger?.type || 'none'}\`\n${E.folder} **conditions:** ${(wf.conditions || []).length}\n${E.cursor} **actions:** ${(wf.actions || []).length}`));
        return interaction.editReply({ components: [c], flags: V2_E });
      }

      if (sub === 'delete') {
        const id = interaction.options.getInteger('id');
        const wf = await store.get(id);
        if (!wf || wf.guildId !== guildId) return interaction.editReply({ components: [errBox(`no automation with id \`${id}\`.`)], flags: V2_E });
        await store.remove(id);
        return interaction.editReply({ components: [okBox(`deleted **${wf.name}**.`)], flags: V2_E });
      }

      if (sub === 'duplicate') {
        const id = interaction.options.getInteger('id');
        const newName = interaction.options.getString('new_name');
        const wf = await store.get(id);
        if (!wf || wf.guildId !== guildId) return interaction.editReply({ components: [errBox(`no automation with id \`${id}\`.`)], flags: V2_E });
        const all = await store.listForGuild(guildId);
        if (all.some(w => w.name.toLowerCase() === newName.toLowerCase())) return interaction.editReply({ components: [errBox('name taken.')], flags: V2_E });
        const copy = await store.create(guildId, { name: newName, trigger: wf.trigger, conditions: wf.conditions, conditionMode: wf.conditionMode, actions: wf.actions, cooldownSeconds: wf.cooldownSeconds, enabled: false, createdBy: userId });
        return interaction.editReply({ components: [okBox(`duplicated → **${copy.name}** · id \`${copy.id}\``)], flags: V2_E });
      }

      if (sub === 'enable' || sub === 'disable') {
        const id = interaction.options.getInteger('id');
        const wf = await store.get(id);
        if (!wf || wf.guildId !== guildId) return interaction.editReply({ components: [errBox(`no automation with id \`${id}\`.`)], flags: V2_E });
        await store.update(id, { enabled: sub === 'enable' });
        return interaction.editReply({ components: [okBox(`**${wf.name}** is now ${sub === 'enable' ? 'enabled' : 'disabled'}.`)], flags: V2_E });
      }

      if (sub === 'enable-all' || sub === 'disable-all') {
        const n = await store.setEnabledAll(guildId, sub === 'enable-all');
        return interaction.editReply({ components: [okBox(`${sub === 'enable-all' ? 'enabled' : 'disabled'} **${n}**.`)], flags: V2_E });
      }

      if (sub === 'export') {
        const id = interaction.options.getInteger('id');
        const wf = await store.get(id);
        if (!wf || wf.guildId !== guildId) return interaction.editReply({ components: [errBox(`no automation with id \`${id}\`.`)], flags: V2_E });
        const json = JSON.stringify({ name: wf.name, trigger: wf.trigger, conditions: wf.conditions, conditionMode: wf.conditionMode, actions: wf.actions, cooldownSeconds: wf.cooldownSeconds }, null, 2);
        return interaction.editReply({ components: [new ContainerBuilder().setAccentColor(0x5b7fd4)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.file} export\n\`\`\`json\n${json.slice(0, 3800)}\n\`\`\``))], flags: V2_E });
      }

      if (sub === 'import') {
        const raw = interaction.options.getString('json');
        let data;
        try { data = JSON.parse(raw); } catch { return interaction.editReply({ components: [errBox('invalid json.')], flags: V2_E }); }
        const items = Array.isArray(data) ? data : [data];
        const imported = [], skipped = [];
        const existing = await store.listForGuild(guildId);
        for (const item of items) {
          if (!item.name || !item.trigger) { skipped.push(item.name || '(unnamed)'); continue; }
          if (existing.some(w => w.name.toLowerCase() === String(item.name).toLowerCase())) { skipped.push(item.name); continue; }
          const wf = await store.create(guildId, { name: String(item.name).slice(0, 50), trigger: item.trigger, conditions: item.conditions || [], conditionMode: item.conditionMode === 'any' ? 'any' : 'all', actions: item.actions || [], cooldownSeconds: Number(item.cooldownSeconds) || 5, enabled: false, createdBy: userId });
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
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n\n')))], flags: V2_E });
      }

      if (sub === 'from-template') {
        const tplId = interaction.options.getString('id');
        const tpl = templates.find(t => t.id === tplId);
        if (!tpl) return interaction.editReply({ components: [errBox(`no template \`${tplId}\`.`)], flags: V2_E });
        const wf = await store.create(guildId, { name: tpl.name, trigger: tpl.trigger, conditions: tpl.conditions || [], conditionMode: 'all', actions: tpl.actions || [], cooldownSeconds: tpl.cooldownSeconds ?? 5, enabled: false, createdBy: userId });
        return interaction.editReply({ components: [okBox(`created **${wf.name}** · id \`${wf.id}\``)], flags: V2_E });
      }

      if (sub === 'stats') {
        const list = await store.listForGuild(guildId);
        const enabled = list.filter(w => w.enabled).length;
        const fires = list.reduce((s, w) => s + (w.fireCount || 0), 0);
        const errors = list.reduce((s, w) => s + (w.errorCount || 0), 0);
        const c = new ContainerBuilder().setAccentColor(0x5b7fd4);
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.wheel} automation stats`));
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent([
          `${E.file} total: ${list.length}`,
          `${E.on} enabled: ${enabled}`,
          `${E.off} disabled: ${list.length - enabled}`,
          `${E.cursor} fires: ${fires}`,
          `${E.error} errors: ${errors}`,
        ].join('\n')));
        return interaction.editReply({ components: [c], flags: V2_E });
      }
    } catch (err) {
      console.error('[automation] execute err:', err);
      interaction.editReply({ components: [errBox(`error: ${String(err.message).slice(0, 200)}`)], flags: V2_E }).catch(() => {});
    }
  },
};
