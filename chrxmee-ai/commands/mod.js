const {
  SlashCommandBuilder, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize,
  MessageFlags, ChannelType,
} = require('discord.js');

const engine = require('../cogs/moderation/engine');
const store = require('../cogs/moderation/store');
const cases = require('../cogs/moderation/cases');
const constants = require('../cogs/moderation/constants');
const { CASE_TYPES } = constants;

const E = {
  success:  "<:Verified_Icon:1527194184841167010>",
  error:    "<:no:1530373946795364362>",
  agree:    "<:agreed:1525639597135237131>",
  lock:     "<:lock:1530377198324945056>",
  unlock:   "<:unlock:1530377714995826831>",
  kick:     "<:Personkick:1530376715698704574>",
  ban:      "<:hammer:1530375976381448303>",
  warn:     "<:angry_cry:1526029511882440744>",
  file:     "<:File_Icon:1526542046213570681>",
  folder:   "<:Folder_Icon:1526542112806539274>",
  compass:  "<:Compass_Discover_Icon:1526542192494248067>",
  owner:    "<:Owner:1525494515169759253>",
  member:   "<:member:1530383558710005960>",
  channel:  "<:Channel:1531901854361849929>",
};

const V2_E = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;

const errBox = (m) => new ContainerBuilder().setAccentColor(0xff3b3b)
  .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.error} ${m}`));
const okBox = (m) => new ContainerBuilder().setAccentColor(0x57f287)
  .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.success} ${m}`));

function isImmune(member, executor, config) {
  if (!member || !executor) return true;
  if (!member.guild) return true;
  if (executor.id === member.guild.ownerId) return false;
  if (member.id === member.guild.ownerId) return true;
  if (member.id === executor.client.user.id) return true;
  if (member.id === executor.id) return true;
  if (config.immuneUsers?.includes(member.id)) return true;
  if (config.immuneRoles?.some(r => member.roles.cache.has(r))) return true;
  if (member.roles.highest.position >= executor.roles.highest.position && executor.id !== member.guild.ownerId) return true;
  return false;
}

function parseDuration(str) {
  if (!str) return null;
  const m = String(str).trim().match(/^(\d+)\s*(s|m|h|d|w)$/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const unit = m[2].toLowerCase();
  return n * { s: 1000, m: 60000, h: 3600000, d: 86400000, w: 604800000 }[unit];
}

async function caseContainer(guildId, c) {
  const info = CASE_TYPES.find(t => t.id === c.type) || {};
  const cont = new ContainerBuilder().setAccentColor(info.color || 0x5b7fd4);
  cont.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.file} case \`${c.id}\``));
  cont.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
  const lines = [
    `**type:** \`${c.type}\``,
    `**target:** <@${c.targetId}> · \`${c.targetId}\``,
    `**mod:** ${c.modId === 'auto-escalation' ? '🤖 auto-escalation' : `<@${c.modId}>`}`,
    `**reason:** ${c.reason || '*none*'}`,
    c.duration ? `**duration:** \`${cases.fmtDuration(c.duration)}\`` : null,
    `**status:** \`${c.status}\``,
    `**when:** <t:${Math.floor(c.createdAt / 1000)}:F>`,
  ].filter(Boolean);
  cont.addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')));
  if (c.notes && c.notes.length) {
    cont.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
    cont.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**notes:**`));
    for (const n of c.notes) {
      cont.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# <@${n.modId}> · <t:${Math.floor(n.at / 1000)}:R> · ${n.note}`));
    }
  }
  return cont;
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

async function confirmDestructive(interaction, userId, title, body) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('mod_yes').setLabel('confirm').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('mod_no').setLabel('cancel').setStyle(ButtonStyle.Secondary),
  );
  await interaction.editReply({
    components: [new ContainerBuilder().setAccentColor(0xff3b3b)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.error} ${title}`))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(body))
      .addActionRowComponents(row)],
    flags: V2_E,
  });
  const msg = await interaction.fetchReply();
  const pick = await awaitOne(msg, userId, 30000);
  if (!pick) return false;
  await pick.deferUpdate().catch(() => {});
  return pick.customId === 'mod_yes';
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mod')
    .setDescription('moderate server members')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ModerateMembers)
    .addSubcommand(s => s.setName('warn').setDescription('warn a user')
      .addUserOption(o => o.setName('user').setDescription('target').setRequired(true))
      .addStringOption(o => o.setName('reason').setDescription('reason').setMaxLength(500)))
    .addSubcommand(s => s.setName('timeout').setDescription('time a user out')
      .addUserOption(o => o.setName('user').setDescription('target').setRequired(true))
      .addStringOption(o => o.setName('duration').setDescription('e.g. 10m, 2h, 1d').setRequired(true))
      .addStringOption(o => o.setName('reason').setDescription('reason').setMaxLength(500)))
    .addSubcommand(s => s.setName('unmute').setDescription('lift a timeout')
      .addUserOption(o => o.setName('user').setDescription('target').setRequired(true))
      .addStringOption(o => o.setName('reason').setDescription('reason').setMaxLength(500)))
    .addSubcommand(s => s.setName('kick').setDescription('kick a user')
      .addUserOption(o => o.setName('user').setDescription('target').setRequired(true))
      .addStringOption(o => o.setName('reason').setDescription('reason').setMaxLength(500)))
    .addSubcommand(s => s.setName('ban').setDescription('ban a user')
      .addUserOption(o => o.setName('user').setDescription('target').setRequired(true))
      .addStringOption(o => o.setName('duration').setDescription('optional — blank = permanent'))
      .addStringOption(o => o.setName('reason').setDescription('reason').setMaxLength(500)))
    .addSubcommand(s => s.setName('softban').setDescription('ban then unban (wipes recent messages)')
      .addUserOption(o => o.setName('user').setDescription('target').setRequired(true))
      .addStringOption(o => o.setName('reason').setDescription('reason').setMaxLength(500)))
    .addSubcommand(s => s.setName('unban').setDescription('unban a user')
      .addUserOption(o => o.setName('user').setDescription('user').setRequired(true))
      .addStringOption(o => o.setName('reason').setDescription('reason').setMaxLength(500)))
    .addSubcommand(s => s.setName('note').setDescription('add a note to a user')
      .addUserOption(o => o.setName('user').setDescription('target').setRequired(true))
      .addStringOption(o => o.setName('note').setDescription('note').setRequired(true).setMaxLength(500)))
    .addSubcommand(s => s.setName('notes').setDescription('view a user\'s notes')
      .addUserOption(o => o.setName('user').setDescription('target').setRequired(true)))
    .addSubcommand(s => s.setName('case').setDescription('view a case')
      .addStringOption(o => o.setName('id').setDescription('case id like MC-0001').setRequired(true)))
    .addSubcommand(s => s.setName('case-note').setDescription('add a staff note to a case')
      .addStringOption(o => o.setName('id').setDescription('case id').setRequired(true))
      .addStringOption(o => o.setName('note').setDescription('note').setRequired(true).setMaxLength(500)))
    .addSubcommand(s => s.setName('history').setDescription('view a user\'s case history')
      .addUserOption(o => o.setName('user').setDescription('target').setRequired(true)))
    .addSubcommand(s => s.setName('warns').setDescription('view a user\'s warns')
      .addUserOption(o => o.setName('user').setDescription('target').setRequired(true)))
    .addSubcommand(s => s.setName('unwarn').setDescription('remove a warn')
      .addUserOption(o => o.setName('user').setDescription('target').setRequired(true))
      .addStringOption(o => o.setName('case_id').setDescription('case id to remove').setRequired(true)))
    .addSubcommand(s => s.setName('purge').setDescription('bulk delete messages')
      .addIntegerOption(o => o.setName('count').setDescription('1-100').setRequired(true).setMinValue(1).setMaxValue(100))
      .addUserOption(o => o.setName('user').setDescription('filter by user'))
      .addStringOption(o => o.setName('contains').setDescription('filter by text')))
    .addSubcommand(s => s.setName('purge-user').setDescription('purge messages from one user in this channel')
      .addUserOption(o => o.setName('user').setDescription('user').setRequired(true))
      .addIntegerOption(o => o.setName('count').setDescription('max to scan (1-100)').setRequired(true).setMinValue(1).setMaxValue(100)))
    .addSubcommand(s => s.setName('lock').setDescription('lock a channel')
      .addChannelOption(o => o.setName('channel').setDescription('channel (blank = this one)').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
      .addStringOption(o => o.setName('reason').setDescription('reason').setMaxLength(200)))
    .addSubcommand(s => s.setName('unlock').setDescription('unlock a channel')
      .addChannelOption(o => o.setName('channel').setDescription('channel (blank = this one)').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)))
    .addSubcommand(s => s.setName('slowmode').setDescription('set channel slowmode')
      .addIntegerOption(o => o.setName('seconds').setDescription('0-21600 (0 = off)').setRequired(true).setMinValue(0).setMaxValue(21600))
      .addChannelOption(o => o.setName('channel').setDescription('channel (blank = this one)').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)))
    .addSubcommand(s => s.setName('nick').setDescription('set a user\'s nickname')
      .addUserOption(o => o.setName('user').setDescription('target').setRequired(true))
      .addStringOption(o => o.setName('nickname').setDescription('new nickname').setRequired(true).setMaxLength(32)))
    .addSubcommand(s => s.setName('resetnick').setDescription('reset a user\'s nickname')
      .addUserOption(o => o.setName('user').setDescription('target').setRequired(true)))
    .addSubcommand(s => s.setName('vckick').setDescription('disconnect a user from voice')
      .addUserOption(o => o.setName('user').setDescription('target').setRequired(true))
      .addStringOption(o => o.setName('reason').setDescription('reason').setMaxLength(200)))
    .addSubcommand(s => s.setName('watch').setDescription('add user to watchlist')
      .addUserOption(o => o.setName('user').setDescription('target').setRequired(true))
      .addStringOption(o => o.setName('reason').setDescription('reason').setMaxLength(500)))
    .addSubcommand(s => s.setName('unwatch').setDescription('remove user from watchlist')
      .addUserOption(o => o.setName('user').setDescription('target').setRequired(true)))
    .addSubcommand(s => s.setName('watchlist').setDescription('view the watchlist'))
    .addSubcommand(s => s.setName('recent').setDescription('view recent cases'))
    .addSubcommand(s => s.setName('stats').setDescription('moderation stats')),

  async execute(interaction) {
    await interaction.deferReply({ flags: V2_E }).catch(() => {});

    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ModerateMembers)) {
      return interaction.editReply({ components: [errBox('moderate members permission required.')], flags: V2_E });
    }

    const sub = interaction.options.getSubcommand();
    const modId = interaction.user.id;
    const guildId = interaction.guildId;

    if (!interaction.member) {
      await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    }
    if (!interaction.member) {
      return interaction.editReply({ components: [errBox('could not load your member data.')], flags: V2_E });
    }

    const config = store.getConfig(guildId);

    /* ── no-target subs ── */
    if (sub === 'recent') {
      const list = store.recentCases(guildId, 15);
      if (!list.length) return interaction.editReply({ components: [errBox('no cases yet.')], flags: V2_E });
      const lines = list.map(c => `\`${c.id}\` · **${c.type}** · <@${c.targetId}> · <t:${Math.floor(c.createdAt / 1000)}:R>`);
      return interaction.editReply({
        components: [new ContainerBuilder().setAccentColor(0x5b7fd4)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.folder} recent cases`))
          .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')))],
        flags: V2_E,
      });
    }

    if (sub === 'stats') {
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
      if (s.topMods.length) {
        c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**top mods:**`));
        for (const [id, n] of s.topMods) c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`  <@${id}> · ${n}`));
      }
      return interaction.editReply({ components: [c], flags: V2_E });
    }

    if (sub === 'watchlist') {
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

    /* ── case ── */
    if (sub === 'case') {
      const id = interaction.options.getString('id').toUpperCase();
      const c = store.getCase(guildId, id);
      if (!c) return interaction.editReply({ components: [errBox(`no case with id \`${id}\`.`)], flags: V2_E });
      return interaction.editReply({ components: [await caseContainer(guildId, c)], flags: V2_E });
    }

    if (sub === 'case-note') {
      const id = interaction.options.getString('id').toUpperCase();
      const note = interaction.options.getString('note');
      const c = store.getCase(guildId, id);
      if (!c) return interaction.editReply({ components: [errBox(`no case with id \`${id}\`.`)], flags: V2_E });
      if (!c.notes) c.notes = [];
      c.notes.push({ modId, note, at: Date.now() });
      store.updateCase(guildId, id, { notes: c.notes });
      return interaction.editReply({ components: [okBox(`note added to case \`${id}\`.`)], flags: V2_E });
    }

    /* ── history / notes / warns / unwarn ── */
    if (sub === 'history') {
      const user = interaction.options.getUser('user');
      const list = store.listCases(guildId, { targetId: user.id, limit: 20 });
      if (!list.length) return interaction.editReply({ components: [okBox(`${user.username} has no cases.`)], flags: V2_E });
      const lines = list.map(c => `\`${c.id}\` · **${c.type}** · <t:${Math.floor(c.createdAt / 1000)}:R> · *${c.reason.slice(0, 50)}*`);
      const watched = store.isWatched(guildId, user.id);
      return interaction.editReply({
        components: [new ContainerBuilder().setAccentColor(0x5b7fd4)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.file} ${user.username} — history`))
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# id \`${user.id}\`${watched ? ' · watched' : ''}`))
          .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')))],
        flags: V2_E,
      });
    }

    if (sub === 'notes') {
      const user = interaction.options.getUser('user');
      const list = store.listNotes(guildId, user.id);
      if (!list.length) return interaction.editReply({ components: [okBox(`${user.username} has no notes.`)], flags: V2_E });
      const lines = list.map(n => `\`${n.id}\` · <@${n.modId}> · <t:${Math.floor(n.at / 1000)}:R>\n  *${n.note}*`);
      return interaction.editReply({
        components: [new ContainerBuilder().setAccentColor(0x5b7fd4)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.file} ${user.username} — notes`))
          .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n\n')))],
        flags: V2_E,
      });
    }

    if (sub === 'warns') {
      const user = interaction.options.getUser('user');
      const { active, expired } = store.listWarns(guildId, user.id);
      const lines = [];
      if (active.length) {
        lines.push(`**active warns (${active.length}):**`);
        for (const w of active) {
          const exp = w.expiresAt ? ` · expires <t:${Math.floor(w.expiresAt / 1000)}:R>` : ' · permanent';
          lines.push(`  \`${w.caseId}\` · <@${w.modId}> · *${w.reason.slice(0, 60)}*${exp}`);
        }
      }
      if (expired.length) lines.push('', `-# expired: ${expired.length}`);
      if (!lines.length) lines.push('no warns.');
      return interaction.editReply({
        components: [new ContainerBuilder().setAccentColor(0xf5c34a)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.warn} ${user.username} — warns`))
          .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')))],
        flags: V2_E,
      });
    }

    if (sub === 'unwarn') {
      const user = interaction.options.getUser('user');
      const caseId = interaction.options.getString('case_id').toUpperCase();
      const removed = store.removeWarn(guildId, user.id, caseId);
      if (!removed) return interaction.editReply({ components: [errBox(`no active warn \`${caseId}\` for ${user.username}.`)], flags: V2_E });
      return interaction.editReply({ components: [okBox(`removed warn \`${caseId}\` from ${user.username}.`)], flags: V2_E });
    }

    /* ── watch ── */
    if (sub === 'watch') {
      const user = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason') || 'no reason';
      store.watch(guildId, user.id, { modId, reason });
      return interaction.editReply({ components: [okBox(`watching ${user.username}.`)], flags: V2_E });
    }
    if (sub === 'unwatch') {
      const user = interaction.options.getUser('user');
      const had = store.unwatch(guildId, user.id);
      return interaction.editReply({ components: [had ? okBox(`stopped watching ${user.username}.`) : errBox(`${user.username} wasn't watched.`)], flags: V2_E });
    }

    /* ── note ── */
    if (sub === 'note') {
      const user = interaction.options.getUser('user');
      const text = interaction.options.getString('note');
      engine.note(interaction.guild, user.id, modId, text);
      return interaction.editReply({ components: [okBox(`note added to ${user.username}.`)], flags: V2_E });
    }

    /* ── purge ── */
    if (sub === 'purge') {
      const count = interaction.options.getInteger('count');
      const filterUser = interaction.options.getUser('user');
      const contains = interaction.options.getString('contains');
      const filter = {};
      if (filterUser) filter.user = filterUser.id;
      if (contains) filter.contains = contains;
      const res = await engine.purge(interaction.channel, count, modId, filter);
      return interaction.editReply({ components: [okBox(`purged **${res.deleted}** message(s).`)], flags: V2_E });
    }

    if (sub === 'purge-user') {
      const user = interaction.options.getUser('user');
      const count = interaction.options.getInteger('count');
      const res = await engine.purge(interaction.channel, count, modId, { user: user.id });
      return interaction.editReply({ components: [okBox(`purged **${res.deleted}** message(s) from ${user.username}.`)], flags: V2_E });
    }

    /* ── lock / unlock / slowmode ── */
    if (sub === 'lock') {
      const ch = interaction.options.getChannel('channel') || interaction.channel;
      const reason = interaction.options.getString('reason') || 'channel locked';
      try {
        await ch.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false }, { reason });
        return interaction.editReply({ components: [okBox(`locked <#${ch.id}>.`)], flags: V2_E });
      } catch (e) {
        return interaction.editReply({ components: [errBox(`could not lock: ${e.message.slice(0, 100)}`)], flags: V2_E });
      }
    }

    if (sub === 'unlock') {
      const ch = interaction.options.getChannel('channel') || interaction.channel;
      try {
        await ch.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: null }, { reason: 'unlocked' });
        return interaction.editReply({ components: [okBox(`unlocked <#${ch.id}>.`)], flags: V2_E });
      } catch (e) {
        return interaction.editReply({ components: [errBox(`could not unlock: ${e.message.slice(0, 100)}`)], flags: V2_E });
      }
    }

    if (sub === 'slowmode') {
      const seconds = interaction.options.getInteger('seconds');
      const ch = interaction.options.getChannel('channel') || interaction.channel;
      try {
        await ch.setRateLimitPerUser(seconds, `set by ${interaction.user.tag}`);
        return interaction.editReply({ components: [okBox(`slowmode on <#${ch.id}> set to **${seconds}s**.`)], flags: V2_E });
      } catch (e) {
        return interaction.editReply({ components: [errBox(`could not set slowmode: ${e.message.slice(0, 100)}`)], flags: V2_E });
      }
    }

    /* ── unban (no member) ── */
    if (sub === 'unban') {
      const targetUser = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason') || 'no reason';
      const c = await engine.unban(interaction.guild, targetUser.id, modId, reason);
      return interaction.editReply({ components: [okBox(`unbanned ${targetUser.username}. case \`${c.id}\``)], flags: V2_E });
    }

    /* ── member-required ── */
    const targetUser = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'no reason';
    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    if (!member) return interaction.editReply({ components: [errBox('user not in server.')], flags: V2_E });
    if (isImmune(member, interaction.member, config) && modId !== interaction.guild.ownerId) {
      return interaction.editReply({ components: [errBox('cannot moderate this user.')], flags: V2_E });
    }

    if (sub === 'warn') {
      const c = await engine.warn(member, modId, reason);
      return interaction.editReply({ components: [okBox(`warned ${member.user.username}. case \`${c.id}\``)], flags: V2_E });
    }

    if (sub === 'timeout') {
      const dur = parseDuration(interaction.options.getString('duration'));
      if (!dur || dur < 1000 || dur > 2419200000) return interaction.editReply({ components: [errBox('invalid duration (max 28d).')], flags: V2_E });
      const c = await engine.timeout(member, modId, dur, reason);
      return interaction.editReply({ components: [okBox(`timed out ${member.user.username} for \`${cases.fmtDuration(dur)}\`. case \`${c.id}\``)], flags: V2_E });
    }

    if (sub === 'unmute') {
      const c = await engine.unmute(member, modId, reason);
      return interaction.editReply({ components: [okBox(`lifted timeout on ${member.user.username}. case \`${c.id}\``)], flags: V2_E });
    }

    if (sub === 'kick') {
      if (!member.kickable) return interaction.editReply({ components: [errBox('cannot kick this user.')], flags: V2_E });
      const ok = await confirmDestructive(interaction, modId, `kick ${member.user.username}?`, `reason: **${reason}**`);
      if (!ok) return interaction.editReply({ components: [okBox('cancelled.')], flags: V2_E });
      const c = await engine.kick(member, modId, reason);
      return interaction.editReply({ components: [okBox(`kicked ${member.user.username}. case \`${c.id}\``)], flags: V2_E });
    }

    if (sub === 'ban') {
      const durStr = interaction.options.getString('duration');
      const dur = durStr ? parseDuration(durStr) : null;
      if (durStr && !dur) return interaction.editReply({ components: [errBox('invalid duration.')], flags: V2_E });
      const ok = await confirmDestructive(interaction, modId, `ban ${member.user.username}?`, `reason: **${reason}**${dur ? `\nduration: \`${cases.fmtDuration(dur)}\`` : '\npermanent'}`);
      if (!ok) return interaction.editReply({ components: [okBox('cancelled.')], flags: V2_E });
      const c = await engine.ban(interaction.guild, targetUser.id, modId, reason, dur);
      return interaction.editReply({ components: [okBox(`banned ${targetUser.username}${dur ? ` for \`${cases.fmtDuration(dur)}\`` : ''}. case \`${c.id}\``)], flags: V2_E });
    }

    if (sub === 'softban') {
      const ok = await confirmDestructive(interaction, modId, `softban ${member.user.username}?`, `bans then unbans (wipes 7d of messages).\nreason: **${reason}**`);
      if (!ok) return interaction.editReply({ components: [okBox('cancelled.')], flags: V2_E });
      try {
        await member.ban({ reason: `softban: ${reason}`, deleteMessageSeconds: 604800 });
        await interaction.guild.members.unban(targetUser.id, 'softban auto-unban').catch(() => {});
        const c = store.createCase(guildId, { type: 'softban', targetId: targetUser.id, modId, reason });
        return interaction.editReply({ components: [okBox(`softbanned ${targetUser.username}. case \`${c.id}\``)], flags: V2_E });
      } catch (e) {
        return interaction.editReply({ components: [errBox(`softban failed: ${e.message.slice(0, 100)}`)], flags: V2_E });
      }
    }

    if (sub === 'nick') {
      if (!member.manageable) return interaction.editReply({ components: [errBox('cannot manage this member.')], flags: V2_E });
      const nick = interaction.options.getString('nickname');
      try {
        await member.setNickname(nick, `by ${interaction.user.tag}`);
        return interaction.editReply({ components: [okBox(`set nickname for ${member.user.username} to **${nick}**.`)], flags: V2_E });
      } catch (e) {
        return interaction.editReply({ components: [errBox(`nickname change failed: ${e.message.slice(0, 100)}`)], flags: V2_E });
      }
    }

    if (sub === 'resetnick') {
      if (!member.manageable) return interaction.editReply({ components: [errBox('cannot manage this member.')], flags: V2_E });
      try {
        await member.setNickname(null, `reset by ${interaction.user.tag}`);
        return interaction.editReply({ components: [okBox(`reset nickname for ${member.user.username}.`)], flags: V2_E });
      } catch (e) {
        return interaction.editReply({ components: [errBox(`nickname reset failed: ${e.message.slice(0, 100)}`)], flags: V2_E });
      }
    }

    if (sub === 'vckick') {
      if (!member.voice || !member.voice.channel) {
        return interaction.editReply({ components: [errBox(`${member.user.username} is not in voice.`)], flags: V2_E });
      }
      try {
        await member.voice.disconnect(reason);
        return interaction.editReply({ components: [okBox(`disconnected ${member.user.username} from voice.`)], flags: V2_E });
      } catch (e) {
        return interaction.editReply({ components: [errBox(`vckick failed: ${e.message.slice(0, 100)}`)], flags: V2_E });
      }
    }
  },
};
