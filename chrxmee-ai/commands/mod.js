const {
  SlashCommandBuilder, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle, ContainerBuilder, TextDisplayBuilder,
  SeparatorBuilder, SeparatorSpacingSize, MessageFlags,
} = require('discord.js');

const { engine, store, cases, warns, constants } = require('../cogs/moderation');
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
  time:     "<:on:1545571641684135946>",
};

const V2_E = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;

const errBox = (m) => new ContainerBuilder().setAccentColor(0xff3b3b)
  .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.error} ${m}`));
const okBox = (m) => new ContainerBuilder().setAccentColor(0x57f287)
  .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.success} ${m}`));

function isImmune(member, executor, config) {
  if (executor.id === member.guild.ownerId) return false;
  if (member.id === member.guild.ownerId) return true;
  if (member.id === executor.client.user.id) return true;
  if (member.id === executor.id) return true;
  if (config.immuneUsers?.includes(member.id)) return true;
  if (config.immuneRoles?.some(r => member.roles.cache.has(r))) return true;
  /* can't moderate someone with higher role */
  if (member.roles.highest.position >= executor.roles.highest.position && executor.id !== member.guild.ownerId) return true;
  return false;
}

function parseDuration(str) {
  if (!str) return null;
  const m = String(str).trim().match(/^(\d+)\s*(s|m|h|d|w)$/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const unit = m[2].toLowerCase();
  const mult = { s: 1000, m: 60000, h: 3600000, d: 86400000, w: 604800000 }[unit];
  return n * mult;
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
  return cont;
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
    .addSubcommand(s => s.setName('unban').setDescription('unban a user')
      .addUserOption(o => o.setName('user').setDescription('user').setRequired(true))
      .addStringOption(o => o.setName('reason').setDescription('reason').setMaxLength(500)))
    .addSubcommand(s => s.setName('note').setDescription('add a note to a user')
      .addUserOption(o => o.setName('user').setDescription('target').setRequired(true))
      .addStringOption(o => o.setName('note').setDescription('note').setRequired(true).setMaxLength(500)))
    .addSubcommand(s => s.setName('case').setDescription('view a case')
      .addStringOption(o => o.setName('id').setDescription('case id like MC-0001').setRequired(true)))
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
    .addSubcommand(s => s.setName('watch').setDescription('add user to watchlist')
      .addUserOption(o => o.setName('user').setDescription('target').setRequired(true))
      .addStringOption(o => o.setName('reason').setDescription('reason').setMaxLength(500)))
    .addSubcommand(s => s.setName('unwatch').setDescription('remove user from watchlist')
      .addUserOption(o => o.setName('user').setDescription('target').setRequired(true)))
    .addSubcommand(s => s.setName('recent').setDescription('view recent cases'))
    .addSubcommand(s => s.setName('stats').setDescription('moderation stats')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const config = store.getConfig(interaction.guild.id);
    const modId = interaction.user.id;
    const guildId = interaction.guild.id;

    /* recent / stats don't need a target */
    if (sub === 'recent') {
      await interaction.deferReply({ flags: V2_E });
      const list = store.recentCases(guildId, 15);
      if (!list.length) return interaction.editReply({ components: [errBox('no cases yet.')], flags: V2_E });
      const lines = list.map(c => {
        const info = CASE_TYPES.find(t => t.id === c.type) || {};
        return `\`${c.id}\` · **${c.type}** · <@${c.targetId}> · <t:${Math.floor(c.createdAt / 1000)}:R>`;
      });
      return interaction.editReply({
        components: [new ContainerBuilder().setAccentColor(0x5b7fd4)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.folder} recent cases`))
          .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')))],
        flags: V2_E,
      });
    }

    if (sub === 'stats') {
      await interaction.deferReply({ flags: V2_E });
      const s = store.stats(guildId);
      const c = new ContainerBuilder().setAccentColor(0x5b7fd4);
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.compass} moderation stats`));
      c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
      const lines = [
        `${E.file} **total cases:** ${s.total}`,
        `${E.warn} **active warns:** ${s.activeWarns}`,
        '',
        `**by type:**`,
        ...Object.entries(s.byType).map(([t, n]) => `  \`${t}\` · ${n}`),
      ];
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')));
      if (s.topMods.length) {
        c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**top mods:**`));
        for (const [id, n] of s.topMods) c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`  <@${id}> · ${n}`));
      }
      return interaction.editReply({ components: [c], flags: V2_E });
    }

    await interaction.deferReply({ flags: V2_E });

    /* ── case ── */
    if (sub === 'case') {
      const id = interaction.options.getString('id').toUpperCase();
      const c = store.getCase(guildId, id);
      if (!c) return interaction.editReply({ components: [errBox(`no case with id \`${id}\`.`)], flags: V2_E });
      return interaction.editReply({ components: [await caseContainer(guildId, c)], flags: V2_E });
    }

    /* ── history ── */
    if (sub === 'history') {
      const user = interaction.options.getUser('user');
      const list = store.listCases(guildId, { targetId: user.id, limit: 20 });
      if (!list.length) return interaction.editReply({ components: [okBox(`${user.username} has no cases.`)], flags: V2_E });
      const lines = list.map(c => `\`${c.id}\` · **${c.type}** · <t:${Math.floor(c.createdAt / 1000)}:R> · *${c.reason.slice(0, 50)}*`);
      const watched = store.isWatched(guildId, user.id);
      return interaction.editReply({
        components: [new ContainerBuilder().setAccentColor(0x5b7fd4)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.file} ${user.username} — case history`))
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# id \`${user.id}\` ${watched ? '· 👁️ watched' : ''}`))
          .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')))],
        flags: V2_E,
      });
    }

    /* ── warns ── */
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
      if (expired.length) {
        lines.push('');
        lines.push(`-# expired: ${expired.length}`);
      }
      if (!lines.length) lines.push('no warns.');
      return interaction.editReply({
        components: [new ContainerBuilder().setAccentColor(0xf5c34a)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.warn} ${user.username} — warns`))
          .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')))],
        flags: V2_E,
      });
    }

    /* ── unwarn ── */
    if (sub === 'unwarn') {
      const user = interaction.options.getUser('user');
      const caseId = interaction.options.getString('case_id').toUpperCase();
      const removed = store.removeWarn(guildId, user.id, caseId);
      if (!removed) return interaction.editReply({ components: [errBox(`no active warn \`${caseId}\` for ${user.username}.`)], flags: V2_E });
      return interaction.editReply({ components: [okBox(`removed warn \`${caseId}\` from ${user.username}.`)], flags: V2_E });
    }

    /* ── watch / unwatch ── */
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

    /* ── member-targeted ── */
    const targetUser = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'no reason';
    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    /* unban works without member */
    if (sub === 'unban') {
      const c = await engine.unban(interaction.guild, targetUser.id, modId, reason);
      return interaction.editReply({ components: [okBox(`unbanned ${targetUser.username}. case \`${c.id}\``)], flags: V2_E });
    }

    if (!member) return interaction.editReply({ components: [errBox('user not in server.')], flags: V2_E });
    if (isImmune(member, interaction.member, config) && modId !== interaction.guild.ownerId) {
      return interaction.editReply({ components: [errBox('cannot moderate this user (immune or higher role).')], flags: V2_E });
    }

    if (sub === 'warn') {
      const c = await engine.warn(member, modId, reason);
      return interaction.editReply({ components: [okBox(`warned ${member.user.username}. case \`${c.id}\``)], flags: V2_E });
    }

    if (sub === 'timeout') {
      const dur = parseDuration(interaction.options.getString('duration'));
      if (!dur || dur < 1000 || dur > 2419200000) return interaction.editReply({ components: [errBox('invalid duration. use e.g. `10m`, `2h`, `1d` (max 28d).')], flags: V2_E });
      const c = await engine.timeout(member, modId, dur, reason);
      return interaction.editReply({ components: [okBox(`timed out ${member.user.username} for \`${cases.fmtDuration(dur)}\`. case \`${c.id}\``)], flags: V2_E });
    }

    if (sub === 'unmute') {
      const c = await engine.unmute(member, modId, reason);
      return interaction.editReply({ components: [okBox(`lifted timeout on ${member.user.username}. case \`${c.id}\``)], flags: V2_E });
    }

    if (sub === 'kick') {
      if (!member.kickable) return interaction.editReply({ components: [errBox('cannot kick this user.')], flags: V2_E });
      const c = await engine.kick(member, modId, reason);
      return interaction.editReply({ components: [okBox(`kicked ${member.user.username}. case \`${c.id}\``)], flags: V2_E });
    }

    if (sub === 'ban') {
      const durStr = interaction.options.getString('duration');
      const dur = durStr ? parseDuration(durStr) : null;
      if (durStr && !dur) return interaction.editReply({ components: [errBox('invalid duration. use e.g. `7d`, `30d`.')], flags: V2_E });
      const c = await engine.ban(interaction.guild, targetUser.id, modId, reason, dur);
      return interaction.editReply({ components: [okBox(`banned ${targetUser.username}${dur ? ` for \`${cases.fmtDuration(dur)}\`` : ''}. case \`${c.id}\``)], flags: V2_E });
    }
  },
};
