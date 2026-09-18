const {
  SlashCommandBuilder, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize,
  MessageFlags,
} = require('discord.js');

const FRIENDS = '<:Friends:1550655356445659226>';

const E = {
  success:  "<:Verified_Icon:1527194184841167010>",
  error:    "<:no:1530373946795364362>",
  member:   "<:member:1530383558710005960>",
  file:     "<:File_Icon:1526542046213570681>",
  folder:   "<:Folder_Icon:1526542112806539274>",
  compass:  "<:Compass_Discover_Icon:1526542192494248067>",
  warn:     "<:angry_cry:1526029511882440744>",
};

const V2_E = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;

const errBox = (m) => new ContainerBuilder().setAccentColor(0xff3b3b)
  .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.error} ${m}`));
const okBox = (m) => new ContainerBuilder().setAccentColor(0x57f287)
  .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.success} ${m}`));

const runningJobs = new Set();
const snapshots = new Map(); // guildId -> Map<userId, previousNick | null>

function wildcardToRegex(pattern) {
  const escaped = String(pattern).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`, 'i');
}

async function confirm(interaction, userId, title, body) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('nick_yes').setLabel('confirm').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('nick_no').setLabel('cancel').setStyle(ButtonStyle.Secondary),
  );
  await interaction.editReply({
    components: [new ContainerBuilder().setAccentColor(0xff3b3b)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.warn} ${title}`))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(body))
      .addActionRowComponents(row)],
    flags: V2_E,
  });
  const msg = await interaction.fetchReply();
  return new Promise(resolve => {
    const col = msg.createMessageComponentCollector({ time: 30000, max: 1, filter: i => i.user.id === userId });
    col.on('collect', async i => { await i.deferUpdate().catch(() => {}); resolve(i.customId === 'nick_yes'); });
    col.on('end', (_, r) => { if (r === 'time') resolve(false); });
  });
}

async function bulkChange(guild, targets, changeFn, progressCb) {
  const results = { ok: 0, failed: 0, skipped: 0 };
  let i = 0;
  for (const member of targets) {
    try {
      const newNick = changeFn(member);
      if (newNick === member.nickname) { results.skipped++; }
      else if (newNick === null && !member.nickname) { results.skipped++; }
      else if (member.manageable) {
        await member.setNickname(newNick, 'bulk nick command').catch(() => { throw new Error('set failed'); });
        results.ok++;
      } else { results.skipped++; }
    } catch { results.failed++; }
    i++;
    if (i % 25 === 0 && progressCb) await progressCb(results, i, targets.length).catch(() => {});
    if (i % 5 === 0) await new Promise(r => setTimeout(r, 10000));
  }
  return results;
}

async function runBulkJob(interaction, userId, guildId, guild, targets, changeFn, snap, headerText) {
  runningJobs.add(guildId);
  snapshots.set(guildId, snap);

  const total = targets.length;
  const est = Math.ceil((total / 5) * 10 / 60);
  await interaction.editReply({
    components: [new ContainerBuilder().setAccentColor(0x5b7fd4)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${FRIENDS} ${headerText}`))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${total}** member(s)\n-# this will take roughly ${est} minute(s) due to rate limits.`))],
    flags: V2_E,
  });

  try {
    const res = await bulkChange(guild, targets, changeFn, async (r, done, tot) => {
      await interaction.editReply({
        components: [new ContainerBuilder().setAccentColor(0x5b7fd4)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${FRIENDS} working...`))
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${done} / ${tot}**\n-# ${r.ok} changed · ${r.skipped} skipped · ${r.failed} failed`))],
        flags: V2_E,
      }).catch(() => {});
    });
    runningJobs.delete(guildId);
    return interaction.editReply({
      components: [okBox(`done — **${res.ok}** changed · ${res.skipped} skipped · ${res.failed} failed\n-# use \`/nick undo\` to restore.`)],
      flags: V2_E,
    });
  } catch (e) {
    runningJobs.delete(guildId);
    return interaction.editReply({ components: [errBox(`job failed: ${e.message.slice(0, 120)}`)], flags: V2_E });
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nick')
    .setDescription('nickname management')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageNicknames)
    .addSubcommand(s => s.setName('set').setDescription('set a user\'s nickname')
      .addUserOption(o => o.setName('user').setDescription('target').setRequired(true))
      .addStringOption(o => o.setName('nickname').setDescription('new nickname (max 32)').setRequired(true).setMaxLength(32)))
    .addSubcommand(s => s.setName('reset').setDescription('reset a user\'s nickname')
      .addUserOption(o => o.setName('user').setDescription('target').setRequired(true)))
    .addSubcommand(s => s.setName('force').setDescription('bypass role-hierarchy block')
      .addUserOption(o => o.setName('user').setDescription('target').setRequired(true))
      .addStringOption(o => o.setName('nickname').setDescription('new nickname (max 32)').setRequired(true).setMaxLength(32)))
    .addSubcommand(s => s.setName('scan').setDescription('preview users whose nickname matches a pattern')
      .addStringOption(o => o.setName('pattern').setDescription('wildcard pattern — * matches anything').setRequired(true).setMaxLength(64))
      .addRoleOption(o => o.setName('role').setDescription('only scan members with this role')))
    .addSubcommand(s => s.setName('reset-matching').setDescription('reset every nickname matching a pattern')
      .addStringOption(o => o.setName('pattern').setDescription('wildcard pattern — * matches anything').setRequired(true).setMaxLength(64))
      .addRoleOption(o => o.setName('role').setDescription('only affect members with this role')))
    .addSubcommand(s => s.setName('reset-all').setDescription('reset EVERY member nickname'))
    .addSubcommand(s => s.setName('reset-role').setDescription('reset nicknames for everyone with a role')
      .addRoleOption(o => o.setName('role').setDescription('role').setRequired(true)))
    .addSubcommand(s => s.setName('prepend').setDescription('add text before every nickname')
      .addStringOption(o => o.setName('text').setDescription('text to prepend').setRequired(true).setMaxLength(16))
      .addRoleOption(o => o.setName('role').setDescription('only affect members with this role')))
    .addSubcommand(s => s.setName('append').setDescription('add text after every nickname')
      .addStringOption(o => o.setName('text').setDescription('text to append').setRequired(true).setMaxLength(16))
      .addRoleOption(o => o.setName('role').setDescription('only affect members with this role')))
    .addSubcommand(s => s.setName('strip').setDescription('remove a prefix/suffix from every nickname')
      .addStringOption(o => o.setName('text').setDescription('text to strip').setRequired(true).setMaxLength(16))
      .addRoleOption(o => o.setName('role').setDescription('only affect members with this role')))
    .addSubcommand(s => s.setName('undo').setDescription('restore nicknames from the last bulk operation')),

  async execute(interaction) {
    await interaction.deferReply({ flags: V2_E }).catch(() => {});

    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageNicknames)) {
      return interaction.editReply({ components: [errBox('manage nicknames permission required.')], flags: V2_E });
    }

    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const guild = interaction.guild;

    /* ── set ── */
    if (sub === 'set') {
      const user = interaction.options.getUser('user');
      const nick = interaction.options.getString('nickname');
      const member = await guild.members.fetch(user.id).catch(() => null);
      if (!member) return interaction.editReply({ components: [errBox('user not in server.')], flags: V2_E });
      if (!member.manageable) return interaction.editReply({ components: [errBox('cannot manage this member.')], flags: V2_E });
      try {
        await member.setNickname(nick, `by ${interaction.user.tag}`);
        return interaction.editReply({ components: [okBox(`set **${user.username}** → **${nick}**.`)], flags: V2_E });
      } catch (e) {
        return interaction.editReply({ components: [errBox(`failed: ${e.message.slice(0, 120)}`)], flags: V2_E });
      }
    }

    /* ── reset ── */
    if (sub === 'reset') {
      const user = interaction.options.getUser('user');
      const member = await guild.members.fetch(user.id).catch(() => null);
      if (!member) return interaction.editReply({ components: [errBox('user not in server.')], flags: V2_E });
      if (!member.manageable) return interaction.editReply({ components: [errBox('cannot manage this member.')], flags: V2_E });
      try {
        await member.setNickname(null, `reset by ${interaction.user.tag}`);
        return interaction.editReply({ components: [okBox(`reset nickname for **${user.username}**.`)], flags: V2_E });
      } catch (e) {
        return interaction.editReply({ components: [errBox(`failed: ${e.message.slice(0, 120)}`)], flags: V2_E });
      }
    }

    /* ── force ── */
    if (sub === 'force') {
      const user = interaction.options.getUser('user');
      const nick = interaction.options.getString('nickname');
      const member = await guild.members.fetch(user.id).catch(() => null);
      if (!member) return interaction.editReply({ components: [errBox('user not in server.')], flags: V2_E });
      if (member.id === guild.ownerId) return interaction.editReply({ components: [errBox('cannot nick the server owner.')], flags: V2_E });
      if (member.id === interaction.client.user.id) return interaction.editReply({ components: [errBox('cannot nick the bot.')], flags: V2_E });
      try {
        await member.setNickname(nick, `forced by ${interaction.user.tag}`);
        return interaction.editReply({ components: [okBox(`forced **${user.username}** → **${nick}**.`)], flags: V2_E });
      } catch (e) {
        return interaction.editReply({ components: [errBox(`failed: ${e.message.slice(0, 120)}`)], flags: V2_E });
      }
    }

    /* ── scan ── */
    if (sub === 'scan') {
      const pattern = interaction.options.getString('pattern');
      const role = interaction.options.getRole('role');
      const regex = wildcardToRegex(pattern);
      const members = await guild.members.fetch().catch(() => null);
      if (!members) return interaction.editReply({ components: [errBox('could not fetch members.')], flags: V2_E });

      const matches = [];
      for (const m of members.values()) {
        if (m.user.bot) continue;
        if (role && !m.roles.cache.has(role.id)) continue;
        if (regex.test(m.nickname || '')) matches.push(m);
      }

      if (!matches.length) return interaction.editReply({ components: [okBox(`no nicknames matched \`${pattern}\`.`)], flags: V2_E });

      const shown = matches.slice(0, 30);
      const lines = shown.map(m => `<@${m.id}> · \`${(m.nickname || '').slice(0, 32)}\``);
      const c = new ContainerBuilder().setAccentColor(0x5b7fd4);
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${FRIENDS} scan — \`${pattern}\``));
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${matches.length} match(es)${role ? ` · role @${role.name}` : ''}`));
      c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')));
      if (matches.length > 30) c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ...and ${matches.length - 30} more`));
      return interaction.editReply({ components: [c], flags: V2_E });
    }

    /* ── guard against stacked bulk jobs ── */
    const isBulk = ['reset-matching', 'reset-all', 'reset-role', 'prepend', 'append', 'strip'].includes(sub);
    if (isBulk && runningJobs.has(guildId)) {
      return interaction.editReply({ components: [errBox('another bulk nick job is already running in this server. wait for it.')], flags: V2_E });
    }

    /* ── fetch members helper ── */
    async function fetchMembers() {
      const m = await guild.members.fetch().catch(() => null);
      if (!m) { await interaction.editReply({ components: [errBox('could not fetch members.')], flags: V2_E }); return null; }
      return m;
    }

    /* ── reset-matching ── */
    if (sub === 'reset-matching') {
      const pattern = interaction.options.getString('pattern');
      const role = interaction.options.getRole('role');
      const regex = wildcardToRegex(pattern);
      const members = await fetchMembers();
      if (!members) return;
      const targets = [...members.values()].filter(m => !m.user.bot && (!role || m.roles.cache.has(role.id)) && regex.test(m.nickname || '') && m.manageable);
      if (!targets.length) return interaction.editReply({ components: [okBox('nothing matched.')], flags: V2_E });

      const ok = await confirm(interaction, userId, `reset ${targets.length} nickname(s)?`, `pattern: \`${pattern}\`${role ? `\nrole: @${role.name}` : ''}\n\nrestorable via \`/nick undo\`.`);
      if (!ok) return interaction.editReply({ components: [okBox('cancelled.')], flags: V2_E });

      const snap = new Map();
      for (const m of targets) snap.set(m.id, m.nickname);
      return runBulkJob(interaction, userId, guildId, guild, targets, () => null, snap, `resetting ${targets.length} nickname(s)`);
    }

    /* ── reset-all ── */
    if (sub === 'reset-all') {
      const members = await fetchMembers();
      if (!members) return;
      const targets = [...members.values()].filter(m => !m.user.bot && m.nickname && m.manageable);
      if (!targets.length) return interaction.editReply({ components: [okBox('no nicknames to reset.')], flags: V2_E });

      const ok = await confirm(interaction, userId, `reset ALL ${targets.length} nicknames?`, `affects everyone with a nickname. use this to nuke a mass-nick.\n\nrestorable via \`/nick undo\`.`);
      if (!ok) return interaction.editReply({ components: [okBox('cancelled.')], flags: V2_E });

      const snap = new Map();
      for (const m of targets) snap.set(m.id, m.nickname);
      return runBulkJob(interaction, userId, guildId, guild, targets, () => null, snap, `resetting all ${targets.length} nickname(s)`);
    }

    /* ── reset-role ── */
    if (sub === 'reset-role') {
      const role = interaction.options.getRole('role');
      const members = await fetchMembers();
      if (!members) return;
      const targets = [...members.values()].filter(m => !m.user.bot && m.nickname && m.roles.cache.has(role.id) && m.manageable);
      if (!targets.length) return interaction.editReply({ components: [okBox('no nicknames to reset.')], flags: V2_E });

      const ok = await confirm(interaction, userId, `reset ${targets.length} nickname(s) in @${role.name}?`, 'restorable via `/nick undo`.');
      if (!ok) return interaction.editReply({ components: [okBox('cancelled.')], flags: V2_E });

      const snap = new Map();
      for (const m of targets) snap.set(m.id, m.nickname);
      return runBulkJob(interaction, userId, guildId, guild, targets, () => null, snap, `resetting ${targets.length} nickname(s)`);
    }

    /* ── prepend / append / strip ── */
    if (sub === 'prepend' || sub === 'append' || sub === 'strip') {
      const text = interaction.options.getString('text');
      const role = interaction.options.getRole('role');
      const members = await fetchMembers();
      if (!members) return;

      const all = [...members.values()].filter(m => !m.user.bot && (!role || m.roles.cache.has(role.id)) && m.manageable);
      const targets = sub === 'strip'
        ? all.filter(m => (m.nickname || '').startsWith(text) || (m.nickname || '').endsWith(text))
        : all;

      if (!targets.length) return interaction.editReply({ components: [okBox('no members to affect.')], flags: V2_E });

      const previewLine = sub === 'prepend' ? `\`${text}nickname\``
        : sub === 'append' ? `\`nickname${text}\``
        : `\`nickname\` → \`nickname\``;

      const ok = await confirm(interaction, userId, `${sub} "${text}" on ${targets.length} member(s)?`, `example: ${previewLine}${role ? `\nrole: @${role.name}` : ''}\n\nrestorable via \`/nick undo\`.`);
      if (!ok) return interaction.editReply({ components: [okBox('cancelled.')], flags: V2_E });

      const snap = new Map();
      for (const m of targets) snap.set(m.id, m.nickname);

      const changeFn = (m) => {
        const base = m.nickname || m.user.username;
        let next;
        if (sub === 'prepend') next = `${text}${base}`;
        else if (sub === 'append') next = `${base}${text}`;
        else {
          next = base;
          if (next.startsWith(text)) next = next.slice(text.length);
          if (next.endsWith(text)) next = next.slice(0, -text.length);
          if (!next) next = null;
        }
        return next ? next.slice(0, 32) : null;
      };

      return runBulkJob(interaction, userId, guildId, guild, targets, changeFn, snap, `${sub}ing ${targets.length} nickname(s)`);
    }

    /* ── undo ── */
    if (sub === 'undo') {
      const snap = snapshots.get(guildId);
      if (!snap || !snap.size) {
        return interaction.editReply({ components: [errBox('no snapshot to undo. run a bulk nick command first.')], flags: V2_E });
      }

      const ok = await confirm(interaction, userId, `undo last bulk nick op?`, `${snap.size} member(s) will be restored to their previous nicknames.`);
      if (!ok) return interaction.editReply({ components: [okBox('cancelled.')], flags: V2_E });

      const members = await fetchMembers();
      if (!members) return;

      const targets = [];
      for (const [id, prevNick] of snap.entries()) {
        const m = members.get(id);
        if (m && m.manageable && m.nickname !== prevNick) targets.push({ member: m, prevNick });
      }

      if (!targets.length) {
        snapshots.delete(guildId);
        return interaction.editReply({ components: [okBox('nothing to restore.')], flags: V2_E });
      }

      runningJobs.add(guildId);
      const total = targets.length;
      const est = Math.ceil((total / 5) * 10 / 60);
      await interaction.editReply({
        components: [new ContainerBuilder().setAccentColor(0x5b7fd4)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${FRIENDS} restoring ${total} nickname(s)`))
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# roughly ${est} minute(s) due to rate limits.`))],
        flags: V2_E,
      });

      let ok2 = 0, failed = 0;
      let i = 0;
      for (const { member, prevNick } of targets) {
        try {
          await member.setNickname(prevNick, 'nick undo').catch(() => { throw new Error('fail'); });
          ok2++;
        } catch { failed++; }
        i++;
        if (i % 25 === 0) {
          await interaction.editReply({
            components: [new ContainerBuilder().setAccentColor(0x5b7fd4)
              .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${FRIENDS} restoring...`))
              .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${i} / ${total}**\n-# ${ok2} restored · ${failed} failed`))],
            flags: V2_E,
          }).catch(() => {});
        }
        if (i % 5 === 0) await new Promise(r => setTimeout(r, 10000));
      }
      runningJobs.delete(guildId);
      snapshots.delete(guildId);
      return interaction.editReply({
        components: [okBox(`undo complete — **${ok2}** restored · ${failed} failed`)],
        flags: V2_E,
      });
    }
  },
};
