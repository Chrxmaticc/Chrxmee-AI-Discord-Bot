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
  ContainerBuilder,
  TextDisplayBuilder,
  SectionBuilder,
  ThumbnailBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
} = require('discord.js');

/* ═══════════════ emoji map ═══════════════ */
const E = {
  success:   "<:Verified_Icon:1527194184841167010>",
  golden:    "<:Golden_Verified:1531893351920697484>",
  error:     "<:no:1530373946795364362>",
  ai:        "<:Chrxmaticc_AI:1480094799292928132>",
  settings:  "<:Settings:1525601248278216725>",
  dev:       "<:Developer:1525492198035161192>",
  bot:       "<:Bot:1525492838727548999>",
  link:      "<:Link:1525603398341103806>",
  agree:     "<:agreed:1525639597135237131>",
  angry:     "<:angry_cry:1526029511882440744>",
  announce:  "<:Discord_Announcements:1526028541270167593>",
  owner:     "<:Owner:1525494515169759253>",
  crown:     "<:Holographic_owner_crown:1527401510487461969>",
  file:      "<:File_Icon:1526542046213570681>",
  folder:    "<:Folder_Icon:1526542112806539274>",
  cursor:    "<:Cursor_Code:1526703109345116310>",
  pc:        "<:Computer_PC:1526541989376688318>",
  compass:   "<:Compass_Discover_Icon:1526542192494248067>",
  admin:     "<:Admin_Badge:1527194281234665622>",
  rename:    "<:Pencil:1530377899251601408>",
  member:    "<:member:1530383558710005960>",
  lock:      "<:lock:1530377198324945056>",
  unlock:    "<:unlock:1530377714995826831>",
  hide:      "<:hellokitty_hide:1530376139854577735>",
  show:      "<:nobara_SIDEEYE:1525658447045988382>",
  kick:      "<:Personkick:1530376715698704574>",
  ban:       "<:hammer:1530375976381448303>",
  money:     "<:Money_Cry_Son:1526538340264841257>",
  sneaky:    "<:sneaky:1527401423690792970>",
  qsob:      "<:qsob:1526706054396645487>",
  happy_cry: "<:happy_cry:1526029243333611530>",
  laugh:     "<:Cringe_Laughing_Son:1526539082564374710>",
  point:     "<:PointAndLaughingEmoji:1525657154567016469>",
  son:       "<:Son:1526536930693484575>",
  son3:      "<:Son_3:1529441775461339196>",
  off:       "<:off:1545571608897265726>",
  on:        "<:on:1545571641684135946>",
  channel:   "<:Channel:1531901854361849929>",
  forum:     "<:Forum:1531902590315397190>",
  threads:   "<:Threads:1531902029113327678>",
  bugs:      "<:Bugs_Blurple:1531909906129490091>",
  gold:      "<:GoldDiscord:1531896474529431668>",
  reply:     "<:Reply_Continued:1531902914824638584>",
  skull:     "<a:skulllmao:1544845693762535477>",
};

/* ═══════════════ color map ═══════════════ */
const COLORS = {
  blue: 0x7289da, red: 0xff3b3b, green: 0x57f287,
  purple: 0x9b59b6, gold: 0xf1c40f, default: 0x5b7fd4,
  orange: 0xe67e22, pink: 0xff69b4, cyan: 0x00ffff,
  white: 0xffffff, black: 0x000000, yellow: 0xffff00,
  blurple: 0x5865f2, teal: 0x1abc9c,
};

/* ═══════════════ helpers ═══════════════ */
function generateEmbedId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = 'EM-';
  for (let i = 0; i < 4; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

function parseColor(val) {
  const lower = String(val).toLowerCase().trim();
  if (COLORS[lower]) return COLORS[lower];
  const hex = lower.replace('#', '');
  const parsed = parseInt(hex, 16);
  return isNaN(parsed) ? COLORS.default : parsed;
}

/* ═══════════════ components v2: display container ═══════════════ */
function buildDisplayContainer(state) {
  const c = new ContainerBuilder();
  c.setAccentColor(state.color || COLORS.default);

  if (state.author) {
    c.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`-# ${E.owner} ${state.author}`)
    );
  }

  if (state.title) {
    c.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`## ${state.title}`)
    );
  }

  if (state.description && state.thumbnail) {
    c.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(state.description))
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(state.thumbnail))
    );
  } else if (state.description) {
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(state.description));
  } else if (state.thumbnail) {
    c.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(state.thumbnail))
    );
  }

  if (state.fields && state.fields.length) {
    c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
    for (const f of state.fields) {
      c.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`**${f.name}**\n${f.value}`)
      );
    }
  }

  if (state.image) {
    c.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(state.image))
    );
  }

  if (state.footer || state.timestamp) {
    c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
    const parts = [];
    if (state.footer) parts.push(`${E.ai} ${state.footer}`);
    if (state.timestamp) parts.push(`<t:${Math.floor(Date.now() / 1000)}:R>`);
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${parts.join(' · ')}`));
  }

  return c;
}

/* ═══════════════ components v2: builder status container ═══════════════ */
function buildStatusContainer(state) {
  const c = new ContainerBuilder();
  c.setAccentColor(state.color || COLORS.default);

  c.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`## ${E.settings} embed builder`)
  );

  c.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
  );

  const row = (label, value, ok = true) =>
    `${ok ? E.success : E.error} **${label}:** ${value}`;

  c.addTextDisplayComponents(
    new TextDisplayBuilder().setContent([
      row('title', state.title || '*not set*', !!state.title),
      row('description', state.description
        ? (state.description.length > 60 ? state.description.slice(0, 60) + '...' : state.description)
        : '*not set*', !!state.description),
      row('color', state.colorName || 'default', true),
      row('author', state.author || '*not set*', !!state.author),
      row('image', state.image ? 'set' : '*not set*', !!state.image),
      row('thumbnail', state.thumbnail ? 'set' : '*not set*', !!state.thumbnail),
      row('footer', state.footer || '*not set*', !!state.footer),
      `${state.timestamp ? E.on : E.off} **timestamp:** ${state.timestamp ? 'on' : 'off'}`,
      `${E.folder} **fields:** ${state.fields ? state.fields.length : 0}/25`,
    ].join('\n'))
  );

  return c;
}

/* ═══════════════ components v2: builder buttons ═══════════════ */
function buildBuilderRows(state) {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('eb_title').setLabel('title').setEmoji({ id: '1530377899251601408', name: 'Pencil' }).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('eb_desc').setLabel('description').setEmoji({ id: '1526542046213570681', name: 'File_Icon' }).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('eb_color').setLabel('color').setEmoji({ id: '1526537780229046342', name: 'Adaption_Wheel' }).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('eb_author').setLabel('author').setEmoji({ id: '1525494515169759253', name: 'Owner' }).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('eb_footer').setLabel('footer').setEmoji({ id: '1525492198035161192', name: 'Developer' }).setStyle(ButtonStyle.Secondary),
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('eb_image').setLabel('image').setEmoji({ id: '1526541989376688318', name: 'Computer_PC' }).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('eb_thumbnail').setLabel('thumbnail').setEmoji({ id: '1526542046213570681', name: 'File_Icon' }).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('eb_field').setLabel('add field').setEmoji({ id: '1526542112806539274', name: 'Folder_Icon' }).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('eb_timestamp')
      .setLabel(state.timestamp ? 'timestamp on' : 'timestamp off')
      .setEmoji({ id: state.timestamp ? '1545571641684135946' : '1545571608897265726', name: state.timestamp ? 'on' : 'off' })
      .setStyle(state.timestamp ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('eb_clear').setLabel('clear all').setEmoji({ id: '1530373946795364362', name: 'no' }).setStyle(ButtonStyle.Danger),
  );
  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('eb_preview').setLabel('preview').setEmoji({ id: '1525658447045988382', name: 'nobara_SIDEEYE' }).setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('eb_send').setLabel('send').setEmoji({ id: '1527194184841167010', name: 'Verified_Icon' }).setStyle(ButtonStyle.Success),
  );
  return [row1, row2, row3];
}

/* ═══════════════ flags helper ═══════════════ */
const V2 = MessageFlags.IsComponentsV2;
const V2_E = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;

/* ═══════════════ command ═══════════════ */
module.exports = {
  data: new SlashCommandBuilder()
    .setName('embed')
    .setDescription('create and manage embeds (mod only)')
    .addSubcommand(sub => sub.setName('builder').setDescription('interactive embed builder with live preview'))
    .addSubcommand(sub =>
      sub.setName('template')
        .setDescription('use a pre-made template')
        .addStringOption(opt => opt.setName('type').setDescription('template type').setRequired(true)
          .addChoices(
            { name: 'welcome', value: 'welcome' },
            { name: 'goodbye', value: 'goodbye' },
            { name: 'announcement', value: 'announcement' },
          ))
        .addStringOption(opt => opt.setName('title').setDescription('title').setRequired(true))
        .addStringOption(opt => opt.setName('description').setDescription('description').setRequired(true))
        .addStringOption(opt => opt.setName('color').setDescription('color name or hex').setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName('advanced')
        .setDescription('send custom embed via key:value lines')
        .addStringOption(opt => opt.setName('code').setDescription('paste key:value lines').setRequired(true))
    )
    .addSubcommand(sub => sub.setName('advanced-paste').setDescription('get copyable template'))
    .addSubcommand(sub =>
      sub.setName('system')
        .setDescription('use pre-made system embeds')
        .addStringOption(opt => opt.setName('type').setDescription('choose system embed').setRequired(true)
          .addChoices(
            { name: 'welcome message', value: 'welcome' },
            { name: 'goodbye message', value: 'goodbye' },
            { name: 'log join', value: 'log-join' },
            { name: 'log leave', value: 'log-leave' },
            { name: 'announcement', value: 'announcement' },
            { name: 'rule reminder', value: 'rule' },
            { name: 'event announcement', value: 'event' },
            { name: 'mod alert', value: 'mod-alert' },
            { name: 'status update', value: 'status' },
            { name: 'fun message', value: 'fun' },
          ))
    )
    .addSubcommand(sub =>
      sub.setName('save')
        .setDescription('save a custom embed by name')
        .addStringOption(opt => opt.setName('name').setDescription('name for this embed').setRequired(true))
        .addStringOption(opt => opt.setName('code').setDescription('paste key:value lines').setRequired(true))
    )
    .addSubcommand(sub => sub.setName('view').setDescription('view your saved embeds'))
    .addSubcommand(sub => sub.setName('send').setDescription('send a saved embed'))
    .addSubcommand(sub =>
      sub.setName('delete')
        .setDescription('delete a saved embed by name or id')
        .addStringOption(opt => opt.setName('query').setDescription('embed name or id (e.g. EM-AB12)').setRequired(true))
    ),

  async execute(interaction, client) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return interaction.reply({
        components: [new ContainerBuilder()
          .setAccentColor(COLORS.red)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.error} mods only.`))],
        flags: V2_E,
      });
    }

    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    const guildId = interaction.guild.id;
    const storageKey = `embeds_${guildId}_${userId}`;
    let savedEmbeds = client.memory.get(storageKey) || {};

    /* ─────────────── builder ─────────────── */
    if (sub === 'builder') {
      await interaction.deferReply({ flags: V2_E });

      let state = {
        title: null, description: null, color: COLORS.default,
        colorName: 'default', footer: null, image: null,
        thumbnail: null, author: null, timestamp: false, fields: [],
      };

      await interaction.editReply({
        components: [buildStatusContainer(state), ...buildBuilderRows(state).map(r => r)],
        flags: V2_E,
      });

      // need to attach action rows to container properly
      const wrapContainer = () => {
        const c = buildStatusContainer(state);
        const rows = buildBuilderRows(state);
        for (const r of rows) c.addActionRowComponents(r);
        return c;
      };

      await interaction.editReply({
        components: [wrapContainer()],
        flags: V2_E,
      });

      const builderMsg = await interaction.fetchReply();
      const collector = builderMsg.createMessageComponentCollector({ time: 300000 });

      collector.on('collect', async btn => {
        if (btn.user.id !== userId) {
          return btn.reply({
            components: [new ContainerBuilder()
              .setAccentColor(COLORS.red)
              .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.error} not your builder.`))],
            flags: V2_E,
          }).catch(() => {});
        }

        if (btn.customId === 'eb_timestamp') {
          try { await btn.deferUpdate(); } catch { return; }
          state.timestamp = !state.timestamp;
          await builderMsg.edit({ components: [wrapContainer()] }).catch(() => {});
          return;
        }

        if (btn.customId === 'eb_clear') {
          try { await btn.deferUpdate(); } catch { return; }
          state = {
            title: null, description: null, color: COLORS.default,
            colorName: 'default', footer: null, image: null,
            thumbnail: null, author: null, timestamp: false, fields: [],
          };
          await builderMsg.edit({ components: [wrapContainer()] }).catch(() => {});
          return;
        }

        if (btn.customId === 'eb_preview') {
          try { await btn.deferUpdate(); } catch { return; }
          await btn.followUp({
            components: [buildDisplayContainer(state)],
            flags: V2_E,
          }).catch(() => {});
          return;
        }

        if (btn.customId === 'eb_send') {
          try { await btn.deferUpdate(); } catch { return; }
          const embedId = generateEmbedId();
          try {
            await interaction.channel.send({
              components: [buildDisplayContainer(state)],
              flags: V2,
            });

            const saveRow = new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId(`eb_save_${embedId}`).setLabel('save embed').setEmoji({ id: '1527194184841167010', name: 'Verified_Icon' }).setStyle(ButtonStyle.Primary),
              new ButtonBuilder().setCustomId(`eb_nosave_${embedId}`).setLabel('no thanks').setEmoji({ id: '1530373946795364362', name: 'no' }).setStyle(ButtonStyle.Secondary),
            );

            const promptC = new ContainerBuilder()
              .setAccentColor(COLORS.green)
              .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.success} embed sent! **id: \`${embedId}\`**\n-# wanna save this for later?`))
              .addActionRowComponents(saveRow);

            await btn.followUp({ components: [promptC], flags: V2_E }).catch(() => {});

            const saveCollector = builderMsg.createMessageComponentCollector({
              time: 60000,
              max: 1,
              filter: b => b.customId.startsWith(`eb_save_${embedId}`) || b.customId === `eb_nosave_${embedId}`,
            });

            saveCollector.on('collect', async savBtn => {
              if (savBtn.customId === `eb_save_${embedId}`) {
                const nameModal = new ModalBuilder().setCustomId(`eb_savename_${embedId}`).setTitle('save embed');
                const nameInput = new TextInputBuilder().setCustomId('embed_save_name').setLabel('name for this embed').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(50);
                nameModal.addComponents(new ActionRowBuilder().addComponents(nameInput));
                await savBtn.showModal(nameModal).catch(() => {});

                try {
                  const modal = await savBtn.awaitModalSubmit({ filter: m => m.customId === `eb_savename_${embedId}` && m.user.id === userId, time: 30000 });
                  const name = modal.fields.getTextInputValue('embed_save_name');
                  savedEmbeds = client.memory.get(storageKey) || {};
                  savedEmbeds[embedId] = { id: embedId, name, state, createdAt: Date.now() };
                  client.memory.set(storageKey, savedEmbeds);
                  await modal.reply({
                    components: [new ContainerBuilder()
                      .setAccentColor(COLORS.green)
                      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.success} saved as **${name}** · id \`${embedId}\``))],
                    flags: V2_E,
                  });
                } catch {}
              } else {
                await savBtn.deferUpdate().catch(() => {});
              }
            });
          } catch (err) {
            await btn.followUp({
              components: [new ContainerBuilder()
                .setAccentColor(COLORS.red)
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.error} failed to send: ${String(err.message).slice(0, 100)}`))],
              flags: V2_E,
            }).catch(() => {});
          }
          return;
        }

        const modalMap = {
          eb_title: { id: 'ebm_title', title: 'set title', fields: [{ id: 'val', label: 'title', style: TextInputStyle.Short, max: 256 }] },
          eb_desc: { id: 'ebm_desc', title: 'set description', fields: [{ id: 'val', label: 'description', style: TextInputStyle.Paragraph, max: 4096 }] },
          eb_color: { id: 'ebm_color', title: 'set color', fields: [{ id: 'val', label: 'color (name or hex like #7289da)', style: TextInputStyle.Short, max: 20, placeholder: 'blue, red, green, purple, gold, or #hex' }] },
          eb_author: { id: 'ebm_author', title: 'set author', fields: [{ id: 'val', label: 'author name', style: TextInputStyle.Short, max: 256 }] },
          eb_footer: { id: 'ebm_footer', title: 'set footer', fields: [{ id: 'val', label: 'footer text', style: TextInputStyle.Short, max: 2048 }] },
          eb_image: { id: 'ebm_image', title: 'set image url', fields: [{ id: 'val', label: 'image url (must start with https)', style: TextInputStyle.Short, max: 500 }] },
          eb_thumbnail: { id: 'ebm_thumbnail', title: 'set thumbnail url', fields: [{ id: 'val', label: 'thumbnail url (must start with https)', style: TextInputStyle.Short, max: 500 }] },
          eb_field: { id: 'ebm_field', title: 'add field', fields: [
            { id: 'fname', label: 'field name', style: TextInputStyle.Short, max: 256 },
            { id: 'fvalue', label: 'field value', style: TextInputStyle.Paragraph, max: 1024 },
          ] },
        };

        const modalDef = modalMap[btn.customId];
        if (!modalDef) return;

        const modal = new ModalBuilder().setCustomId(modalDef.id).setTitle(modalDef.title);
        modal.addComponents(modalDef.fields.map(f => {
          const input = new TextInputBuilder().setCustomId(f.id).setLabel(f.label).setStyle(f.style).setRequired(true).setMaxLength(f.max);
          if (f.placeholder) input.setPlaceholder(f.placeholder);
          return new ActionRowBuilder().addComponents(input);
        }));

        await btn.showModal(modal).catch(() => {});
        const modalSubmit = await btn.awaitModalSubmit({ time: 120000 }).catch(() => null);
        if (!modalSubmit) return;
        await modalSubmit.deferUpdate().catch(() => {});

        if (btn.customId === 'eb_title') state.title = modalSubmit.fields.getTextInputValue('val');
        else if (btn.customId === 'eb_desc') state.description = modalSubmit.fields.getTextInputValue('val');
        else if (btn.customId === 'eb_color') {
          const v = modalSubmit.fields.getTextInputValue('val');
          state.color = parseColor(v);
          state.colorName = v;
        }
        else if (btn.customId === 'eb_author') state.author = modalSubmit.fields.getTextInputValue('val');
        else if (btn.customId === 'eb_footer') state.footer = modalSubmit.fields.getTextInputValue('val');
        else if (btn.customId === 'eb_image') {
          const v = modalSubmit.fields.getTextInputValue('val');
          state.image = v.startsWith('https') ? v : null;
        }
        else if (btn.customId === 'eb_thumbnail') {
          const v = modalSubmit.fields.getTextInputValue('val');
          state.thumbnail = v.startsWith('https') ? v : null;
        }
        else if (btn.customId === 'eb_field') {
          const fname = modalSubmit.fields.getTextInputValue('fname');
          const fvalue = modalSubmit.fields.getTextInputValue('fvalue');
          if (!state.fields) state.fields = [];
          if (state.fields.length < 25) state.fields.push({ name: fname, value: fvalue });
        }

        await builderMsg.edit({ components: [wrapContainer()] }).catch(() => {});
      });

      collector.on('end', () => {
        builderMsg.edit({ components: [] }).catch(() => {});
      });
      return;
    }

    /* ─────────────── template ─────────────── */
    if (sub === 'template') {
      await interaction.deferReply({ flags: V2_E });
      const type = interaction.options.getString('type');
      const title = interaction.options.getString('title');
      const desc = interaction.options.getString('description');
      const colorVal = interaction.options.getString('color') || 'default';
      const color = parseColor(colorVal);
      const embedId = generateEmbedId();

      const state = {
        title, description: desc, color, colorName: colorVal,
        footer: 'chromed', timestamp: true,
        author: type === 'welcome' ? 'welcome!' : type === 'goodbye' ? 'goodbye :(' : 'announcement!',
        fields: [],
      };

      await interaction.channel.send({ components: [buildDisplayContainer(state)], flags: V2 });

      savedEmbeds[embedId] = { id: embedId, name: `${type}-${embedId}`, state, createdAt: Date.now() };
      client.memory.set(storageKey, savedEmbeds);

      const saveRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`eb_save_${embedId}`).setLabel('save embed').setEmoji({ id: '1527194184841167010', name: 'Verified_Icon' }).setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`eb_nosave_${embedId}`).setLabel('no thanks').setEmoji({ id: '1530373946795364362', name: 'no' }).setStyle(ButtonStyle.Secondary),
      );

      const confirmC = new ContainerBuilder()
        .setAccentColor(COLORS.green)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.success} template sent · **id \`${embedId}\`**\n-# wanna save this embed?`))
        .addActionRowComponents(saveRow);

      await interaction.editReply({ components: [confirmC], flags: V2_E });

      const msg = await interaction.fetchReply();
      const saveCollector = msg.createMessageComponentCollector({ time: 30000, max: 1 });
      saveCollector.on('collect', async btn => {
        try { await btn.deferUpdate(); } catch { return; }
        if (btn.customId === `eb_save_${embedId}`) {
          await interaction.editReply({
            components: [new ContainerBuilder()
              .setAccentColor(COLORS.green)
              .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.success} saved · name **${type}-${embedId}** · id \`${embedId}\`\n-# use \`/embed send\` to use it later.`))],
            flags: V2_E,
          });
        } else {
          delete savedEmbeds[embedId];
          client.memory.set(storageKey, savedEmbeds);
          await interaction.editReply({
            components: [new ContainerBuilder()
              .setAccentColor(COLORS.default)
              .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.success} template sent · id \`${embedId}\``))],
            flags: V2_E,
          });
        }
      });
      saveCollector.on('end', () => { interaction.editReply({ components: [] }).catch(() => {}); });
      return;
    }

    /* ─────────────── advanced ─────────────── */
    if (sub === 'advanced') {
      await interaction.deferReply({ flags: V2_E });
      const code = interaction.options.getString('code').trim();
      const embedId = generateEmbedId();
      const state = { fields: [], timestamp: false };

      const lines = code.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('//'));
      for (const line of lines) {
        if (!line.includes(':')) continue;
        const [keyRaw, ...valueParts] = line.split(':');
        const key = keyRaw.trim().toLowerCase();
        const value = valueParts.join(':').trim();
        if (key === 'title') state.title = value;
        if (key === 'desc' || key === 'description') state.description = value;
        if (key === 'color') { state.color = parseColor(value); state.colorName = value; }
        if (key === 'footer') state.footer = value;
        if (key === 'image' && value.startsWith('http')) state.image = value;
        if (key === 'thumbnail' && value.startsWith('http')) state.thumbnail = value;
        if (key === 'author') state.author = value;
      }

      try {
        await interaction.channel.send({ components: [buildDisplayContainer(state)], flags: V2 });
        savedEmbeds[embedId] = { id: embedId, name: `advanced-${embedId}`, state, createdAt: Date.now() };
        client.memory.set(storageKey, savedEmbeds);

        await interaction.editReply({
          components: [new ContainerBuilder()
            .setAccentColor(COLORS.green)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.success} advanced embed sent · id \`${embedId}\``))],
          flags: V2_E,
        });
      } catch (err) {
        await interaction.editReply({
          components: [new ContainerBuilder()
            .setAccentColor(COLORS.red)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.error} send failed: ${String(err.message).slice(0, 100)}`))],
          flags: V2_E,
        });
      }
      return;
    }

    /* ─────────────── advanced-paste ─────────────── */
    if (sub === 'advanced-paste') {
      await interaction.deferReply({ flags: V2_E });
      const template = [
        'title: welcome!',
        "desc: hey everyone! glad you're here.",
        'color: #5b7fd4',
        'footer: chromed',
        'author: server name',
        'image: https://example.com/image.png',
        'thumbnail: https://example.com/thumb.png',
        '// paste into /embed advanced code:',
        '// remove lines you don\'t need',
      ].join('\n');

      await interaction.editReply({
        components: [new ContainerBuilder()
          .setAccentColor(COLORS.default)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.file} template\n\`\`\`\n${template}\n\`\`\``))],
        flags: V2_E,
      });
      return;
    }

    /* ─────────────── system ─────────────── */
    if (sub === 'system') {
      await interaction.deferReply({ flags: V2_E });
      const type = interaction.options.getString('type');
      const embedId = generateEmbedId();

      const systems = {
        'welcome': { color: 0x57f287, title: 'welcome!', description: 'welcome to the server! please read the rules and enjoy your stay.' },
        'goodbye': { color: 0xff3b3b, title: 'goodbye!', description: "a member has left the server. we'll miss you!" },
        'log-join': { color: 0x57f287, title: 'member joined', description: 'a new member has joined the server.' },
        'log-leave': { color: 0xff3b3b, title: 'member left', description: 'a member has left the server.' },
        'announcement': { color: 0xf1c40f, title: 'announcement', description: 'important announcement from the staff team.' },
        'rule': { color: 0x7289da, title: 'rule reminder', description: 'please remember to follow the server rules at all times.' },
        'event': { color: 0xe67e22, title: 'event announcement', description: 'an exciting event is coming up! stay tuned for more details.' },
        'mod-alert': { color: 0xff3b3b, title: 'mod alert', description: 'attention moderators — please check the mod channel.' },
        'status': { color: 0x9b59b6, title: 'status update', description: 'here is a status update from the team.' },
        'fun': { color: 0xff69b4, title: 'fun time!', description: "let's have some fun! check out what's going on." },
      };

      const sys = systems[type];
      if (!sys) {
        return interaction.editReply({
          components: [new ContainerBuilder()
            .setAccentColor(COLORS.red)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.error} unknown system embed type.`))],
          flags: V2_E,
        });
      }

      const state = { ...sys, colorName: 'system', timestamp: true, fields: [] };
      await interaction.channel.send({ components: [buildDisplayContainer(state)], flags: V2 });

      return interaction.editReply({
        components: [new ContainerBuilder()
          .setAccentColor(COLORS.green)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.success} system embed sent · id \`${embedId}\``))],
        flags: V2_E,
      });
    }

    /* ─────────────── save ─────────────── */
    if (sub === 'save') {
      await interaction.deferReply({ flags: V2_E });
      const name = interaction.options.getString('name');
      const code = interaction.options.getString('code').trim();
      const embedId = generateEmbedId();
      const state = { fields: [] };

      const lines = code.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('//'));
      for (const line of lines) {
        if (!line.includes(':')) continue;
        const [keyRaw, ...valueParts] = line.split(':');
        const key = keyRaw.trim().toLowerCase();
        const value = valueParts.join(':').trim();
        if (key === 'title') state.title = value;
        if (key === 'desc' || key === 'description') state.description = value;
        if (key === 'color') { state.color = parseColor(value); state.colorName = value; }
        if (key === 'footer') state.footer = value;
        if (key === 'image' && value.startsWith('http')) state.image = value;
        if (key === 'thumbnail' && value.startsWith('http')) state.thumbnail = value;
        if (key === 'author') state.author = value;
      }

      savedEmbeds[embedId] = { id: embedId, name, state, createdAt: Date.now() };
      client.memory.set(storageKey, savedEmbeds);

      return interaction.editReply({
        components: [new ContainerBuilder()
          .setAccentColor(COLORS.green)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.success} embed **${name}** saved · id \`${embedId}\`\n-# use \`/embed send\` to send it.`))],
        flags: V2_E,
      });
    }

    /* ─────────────── view ─────────────── */
    if (sub === 'view') {
      await interaction.deferReply({ flags: V2_E });
      const embeds = Object.values(savedEmbeds);

      if (embeds.length === 0) {
        return interaction.editReply({
          components: [new ContainerBuilder()
            .setAccentColor(COLORS.default)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.folder} no saved embeds. use \`/embed save\` or \`/embed builder\` to create some!`))],
          flags: V2_E,
        });
      }

      const lines = embeds.map(e => `${E.file} **${e.name}** · id \`${e.id}\` · *${new Date(e.createdAt).toLocaleDateString()}*`);

      return interaction.editReply({
        components: [new ContainerBuilder()
          .setAccentColor(COLORS.default)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.folder} your saved embeds (${embeds.length})`))
          .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')))
          .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# use \`/embed send\` to send one, or \`/embed delete\` to remove one.`))],
        flags: V2_E,
      });
    }

    /* ─────────────── send ─────────────── */
    if (sub === 'send') {
      await interaction.deferReply({ flags: V2_E });
      const embeds = Object.values(savedEmbeds);

      if (embeds.length === 0) {
        return interaction.editReply({
          components: [new ContainerBuilder()
            .setAccentColor(COLORS.red)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.error} no saved embeds! use \`/embed builder\` or \`/embed save\` first.`))],
          flags: V2_E,
        });
      }

      const options = embeds.slice(0, 25).map(e =>
        new StringSelectMenuOptionBuilder().setLabel(e.name).setValue(e.id).setDescription(`id: ${e.id}`)
      );
      const menu = new StringSelectMenuBuilder().setCustomId('eb_send_select').setPlaceholder('choose an embed to send...').addOptions(options);
      const row = new ActionRowBuilder().addComponents(menu);

      const selectC = new ContainerBuilder()
        .setAccentColor(COLORS.default)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.compass} select an embed`))
        .addActionRowComponents(row);

      await interaction.editReply({ components: [selectC], flags: V2_E });
      const msg = await interaction.fetchReply();
      const collector = msg.createMessageComponentCollector({ time: 30000, max: 1 });

      collector.on('collect', async sel => {
        try { await sel.deferUpdate(); } catch { return; }
        const chosen = savedEmbeds[sel.values[0]];
        if (!chosen) {
          return sel.followUp({
            components: [new ContainerBuilder()
              .setAccentColor(COLORS.red)
              .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.error} embed not found.`))],
            flags: V2_E,
          }).catch(() => {});
        }

        await interaction.channel.send({ components: [buildDisplayContainer(chosen.state)], flags: V2 });

        await interaction.editReply({
          components: [new ContainerBuilder()
            .setAccentColor(COLORS.green)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.success} embed **${chosen.name}** sent · id \`${chosen.id}\``))],
          flags: V2_E,
        });
      });

      collector.on('end', () => {
        interaction.editReply({ components: [] }).catch(() => {});
      });
      return;
    }

    /* ─────────────── delete ─────────────── */
    if (sub === 'delete') {
      await interaction.deferReply({ flags: V2_E });
      const query = interaction.options.getString('query').trim();
      const found = Object.values(savedEmbeds).find(e =>
        e.id === query.toUpperCase() || e.name.toLowerCase() === query.toLowerCase()
      );

      if (!found) {
        return interaction.editReply({
          components: [new ContainerBuilder()
            .setAccentColor(COLORS.red)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.error} no embed found with name or id **${query}**.`))],
          flags: V2_E,
        });
      }

      delete savedEmbeds[found.id];
      client.memory.set(storageKey, savedEmbeds);

      return interaction.editReply({
        components: [new ContainerBuilder()
          .setAccentColor(COLORS.green)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.success} embed **${found.name}** · id \`${found.id}\` deleted.`))],
        flags: V2_E,
      });
    }
  },
};
