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
  ChannelType,
} = require('discord.js');

/* ═══════════════ emojis ═══════════════ */
const E = {
  success:  "<:Verified_Icon:1527194184841167010>",
  golden:   "<:Golden_Verified:1531893351920697484>",
  error:    "<:no:1530373946795364362>",
  ai:       "<:Chrxmaticc_AI:1480094799292928132>",
  settings: "<:Settings:1525601248278216725>",
  dev:      "<:Developer:1525492198035161192>",
  bot:      "<:Bot:1525492838727548999>",
  link:     "<:Link:1525603398341103806>",
  agree:    "<:agreed:1525639597135237131>",
  angry:    "<:angry_cry:1526029511882440744>",
  announce: "<:Discord_Announcements:1526028541270167593>",
  owner:    "<:Owner:1525494515169759253>",
  crown:    "<:Holographic_owner_crown:1527401510487461969>",
  file:     "<:File_Icon:1526542046213570681>",
  folder:   "<:Folder_Icon:1526542112806539274>",
  cursor:   "<:Cursor_Code:1526703109345116310>",
  pc:       "<:Computer_PC:1526541989376688318>",
  compass:  "<:Compass_Discover_Icon:1526542192494248067>",
  wheel:    "<:Adaption_Wheel:1526537780229046342>",
  admin:    "<:Admin_Badge:1527194281234665622>",
  rename:   "<:Pencil:1530377899251601408>",
  member:   "<:member:1530383558710005960>",
  lock:     "<:lock:1530377198324945056>",
  unlock:   "<:unlock:1530377714995826831>",
  hide:     "<:hellokitty_hide:1530376139854577735>",
  show:     "<:nobara_SIDEEYE:1525658447045988382>",
  kick:     "<:Personkick:1530376715698704574>",
  ban:      "<:hammer:1530375976381448303>",
  money:    "<:Money_Cry_Son:1526538340264841257>",
  sneaky:   "<:sneaky:1527401423690792970>",
  qsob:     "<:qsob:1526706054396645487>",
  happy:    "<:happy_cry:1526029243333611530>",
  laugh:    "<:Cringe_Laughing_Son:1526539082564374710>",
  point:    "<:PointAndLaughingEmoji:1525657154567016469>",
  son:      "<:Son:1526536930693484575>",
  son3:     "<:Son_3:1529441775461339196>",
  off:      "<:off:1545571608897265726>",
  on:       "<:on:1545571641684135946>",
  channel:  "<:Channel:1531901854361849929>",
  forum:    "<:Forum:1531902590315397190>",
  threads:  "<:Threads:1531902029113327678>",
  bugs:     "<:Bugs_Blurple:1531909906129490091>",
  gold:     "<:GoldDiscord:1531896474529431668>",
  reply:    "<:Reply_Continued:1531902914824638584>",
  skull:    "<a:skulllmao:1544845693762535477>",
};

/* ═══════════════ colors ═══════════════ */
const COLORS = {
  blue: 0x7289da, red: 0xff3b3b, green: 0x57f287,
  purple: 0x9b59b6, gold: 0xf1c40f, default: 0x5b7fd4,
  orange: 0xe67e22, pink: 0xff69b4, cyan: 0x00ffff,
  white: 0xffffff, black: 0x000000, yellow: 0xffff00,
  blurple: 0x5865f2, teal: 0x1abc9c, lime: 0x84cc16,
};

const NAMED_COLORS = Object.keys(COLORS);

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
  const hex = lower.replace('#', '').replace('0x', '');
  if (!/^[0-9a-f]{6}$/i.test(hex)) return null;
  return parseInt(hex, 16);
}

function hexToInt(hex) {
  return parseInt(String(hex).replace('#', ''), 16);
}

function intToHex(int) {
  return '#' + int.toString(16).padStart(6, '0');
}

function defaultState() {
  return {
    title: null,
    description: null,
    color: COLORS.default,
    colorName: 'default',
    author: null,
    authorIcon: null,
    footer: null,
    footerIcon: null,
    image: null,
    thumbnail: null,
    timestamp: false,
    fields: [],
    buttons: [],
  };
}

/* ═══════════════ display container ═══════════════ */
function buildDisplayContainer(state) {
  const c = new ContainerBuilder();
  c.setAccentColor(state.color || COLORS.default);

  if (state.author) {
    if (state.authorIcon) {
      c.addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${E.owner} ${state.author}`))
          .setThumbnailAccessory(new ThumbnailBuilder().setURL(state.authorIcon))
      );
    } else {
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${E.owner} ${state.author}`));
    }
  }

  if (state.title) {
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${state.title}`));
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

  if (state.fields && state.fields.length > 0) {
    c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
    for (const f of state.fields) {
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${f.name}**\n${f.value}`));
    }
  }

  if (state.image) {
    c.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(state.image))
    );
  }

  if (state.buttons && state.buttons.length > 0) {
    const row = new ActionRowBuilder();
    for (const b of state.buttons.slice(0, 5)) {
      row.addComponents(new ButtonBuilder().setLabel(b.label.slice(0, 80)).setURL(b.url).setStyle(ButtonStyle.Link));
    }
    c.addActionRowComponents(row);
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

/* ═══════════════ builder status container ═══════════════ */
function buildStatusContainer(state, hint = 'use buttons below to build') {
  const c = new ContainerBuilder();
  c.setAccentColor(state.color || COLORS.default);

  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.settings} embed builder`));
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${hint}`));
  c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));

  const clamp = (v, n = 55) => (v && v.length > n ? v.slice(0, n) + '...' : v);
  const line = (ok, label, value) => `${ok ? E.success : E.error} **${label}:** ${value}`;

  c.addTextDisplayComponents(new TextDisplayBuilder().setContent([
    line(!!state.title, 'title', clamp(state.title) || '*not set*'),
    line(!!state.description, 'description', clamp(state.description) || '*not set*'),
    line(true, 'color', state.colorName || intToHex(state.color || COLORS.default)),
    line(!!state.author, 'author', clamp(state.author) || '*not set*'),
    line(!!state.authorIcon, 'author icon', state.authorIcon ? 'set' : '*not set*'),
    line(!!state.footer, 'footer', clamp(state.footer) || '*not set*'),
    line(!!state.footerIcon, 'footer icon', state.footerIcon ? 'set' : '*not set*'),
    line(!!state.image, 'image', state.image ? 'set' : '*not set*'),
    line(!!state.thumbnail, 'thumbnail', state.thumbnail ? 'set' : '*not set*'),
    `${state.timestamp ? E.on : E.off} **timestamp:** ${state.timestamp ? 'on' : 'off'}`,
    `${E.folder} **fields:** ${state.fields.length}/25`,
    `${E.link} **buttons:** ${state.buttons.length}/5`,
  ].join('\n')));

  return c;
}

/* ═══════════════ builder action rows ═══════════════ */
function buildBuilderRows(state) {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('eb_title').setLabel('title').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('eb_desc').setLabel('description').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('eb_color').setLabel('color').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('eb_author').setLabel('author').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('eb_footer').setLabel('footer').setStyle(ButtonStyle.Secondary),
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('eb_image').setLabel('image').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('eb_thumbnail').setLabel('thumbnail').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('eb_author_icon').setLabel('author icon').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('eb_footer_icon').setLabel('footer icon').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('eb_timestamp')
      .setLabel(state.timestamp ? 'timestamp on' : 'timestamp off')
      .setStyle(state.timestamp ? ButtonStyle.Success : ButtonStyle.Secondary),
  );
  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('eb_field').setLabel('add field').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('eb_manage_fields').setLabel('manage fields').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('eb_add_button').setLabel('add button').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('eb_manage_buttons').setLabel('manage buttons').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('eb_random_color').setLabel('random color').setStyle(ButtonStyle.Secondary),
  );
  const row4 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('eb_undo').setLabel('undo').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('eb_clear').setLabel('clear all').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('eb_preview').setLabel('preview').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('eb_save').setLabel('save').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('eb_send').setLabel('send').setStyle(ButtonStyle.Success),
  );
  return [row1, row2, row3, row4];
}

/* ═══════════════ flags ═══════════════ */
const V2 = MessageFlags.IsComponentsV2;
const V2_E = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;

/* ═══════════════ key:value parser ═══════════════ */
function parseKeyValue(code) {
  const state = { fields: [], buttons: [], timestamp: false };
  const lines = String(code).split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('//'));

  let currentField = null;
  for (const line of lines) {
    if (line.toLowerCase().startsWith('field:')) {
      if (currentField) state.fields.push(currentField);
      const rest = line.slice(6).trim();
      const [name, ...valParts] = rest.split('|');
      currentField = { name: name.trim(), value: valParts.join('|').trim() };
      continue;
    }
    if (currentField && line.startsWith('>')) {
      currentField.value += '\n' + line.slice(1).trim();
      continue;
    }
    if (currentField) {
      state.fields.push(currentField);
      currentField = null;
    }
    if (!line.includes(':')) continue;
    const [keyRaw, ...valueParts] = line.split(':');
    const key = keyRaw.trim().toLowerCase();
    const value = valueParts.join(':').trim();
    if (key === 'title') state.title = value;
    else if (key === 'desc' || key === 'description') state.description = value;
    else if (key === 'color') {
      const parsed = parseColor(value);
      if (parsed !== null) { state.color = parsed; state.colorName = value; }
    }
    else if (key === 'footer') state.footer = value;
    else if (key === 'footer_icon') state.footerIcon = value.startsWith('http') ? value : null;
    else if (key === 'author') state.author = value;
    else if (key === 'author_icon') state.authorIcon = value.startsWith('http') ? value : null;
    else if (key === 'image') state.image = value.startsWith('http') ? value : null;
    else if (key === 'thumbnail') state.thumbnail = value.startsWith('http') ? value : null;
    else if (key === 'timestamp') state.timestamp = value === 'true' || value === 'on' || value === 'yes';
    else if (key === 'button') {
      const [label, url] = value.split('|').map(s => s.trim());
      if (label && url && state.buttons.length < 5) state.buttons.push({ label, url });
    }
  }
  if (currentField) state.fields.push(currentField);
  return state;
}

function stateToKeyValue(state) {
  const lines = [];
  if (state.title) lines.push(`title: ${state.title}`);
  if (state.description) lines.push(`desc: ${state.description}`);
  if (state.color) lines.push(`color: ${state.colorName && NAMED_COLORS.includes(state.colorName.toLowerCase()) ? state.colorName : intToHex(state.color)}`);
  if (state.author) lines.push(`author: ${state.author}`);
  if (state.authorIcon) lines.push(`author_icon: ${state.authorIcon}`);
  if (state.footer) lines.push(`footer: ${state.footer}`);
  if (state.footerIcon) lines.push(`footer_icon: ${state.footerIcon}`);
  if (state.image) lines.push(`image: ${state.image}`);
  if (state.thumbnail) lines.push(`thumbnail: ${state.thumbnail}`);
  if (state.timestamp) lines.push(`timestamp: true`);
  for (const f of state.fields || []) {
    lines.push(`field: ${f.name} | ${f.value.replace(/\n/g, ' ')}`);
  }
  for (const b of state.buttons || []) {
    lines.push(`button: ${b.label} | ${b.url}`);
  }
  return lines.join('\n');
}

/* ═══════════════ module ═══════════════ */
module.exports = {
  data: new SlashCommandBuilder()
    .setName('embed')
    .setDescription('create and manage embeds (mod only)')

    .addSubcommand(s => s.setName('builder').setDescription('interactive embed builder with live preview'))

    .addSubcommand(s => s.setName('quick').setDescription('send an embed in one command')
      .addStringOption(o => o.setName('title').setDescription('title'))
      .addStringOption(o => o.setName('description').setDescription('description'))
      .addStringOption(o => o.setName('color').setDescription('color name or hex'))
      .addStringOption(o => o.setName('image').setDescription('image url'))
      .addStringOption(o => o.setName('thumbnail').setDescription('thumbnail url'))
      .addStringOption(o => o.setName('footer').setDescription('footer'))
      .addStringOption(o => o.setName('author').setDescription('author'))
      .addChannelOption(o => o.setName('channel').setDescription('channel to send in').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
    )

    .addSubcommand(s => s.setName('template').setDescription('use a pre-made template')
      .addStringOption(o => o.setName('type').setDescription('template type').setRequired(true)
        .addChoices(
          { name: 'welcome', value: 'welcome' },
          { name: 'goodbye', value: 'goodbye' },
          { name: 'announcement', value: 'announcement' },
          { name: 'giveaway', value: 'giveaway' },
          { name: 'event', value: 'event' },
          { name: 'update', value: 'update' },
        ))
      .addStringOption(o => o.setName('title').setDescription('title').setRequired(true))
      .addStringOption(o => o.setName('description').setDescription('description').setRequired(true))
      .addStringOption(o => o.setName('color').setDescription('color name or hex'))
      .addChannelOption(o => o.setName('channel').setDescription('channel to send in').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
    )

    .addSubcommand(s => s.setName('advanced').setDescription('send custom embed via key:value lines')
      .addStringOption(o => o.setName('code').setDescription('paste key:value lines').setRequired(true))
      .addChannelOption(o => o.setName('channel').setDescription('channel to send in').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
    )

    .addSubcommand(s => s.setName('advanced-paste').setDescription('get copyable template'))

    .addSubcommand(s => s.setName('system').setDescription('use pre-made system embeds')
      .addStringOption(o => o.setName('type').setDescription('choose system embed').setRequired(true)
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
          { name: 'milestone', value: 'milestone' },
          { name: 'server boost', value: 'boost' },
        ))
      .addChannelOption(o => o.setName('channel').setDescription('channel to send in').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
    )

    .addSubcommand(s => s.setName('save').setDescription('save a custom embed by name')
      .addStringOption(o => o.setName('name').setDescription('name for this embed').setRequired(true))
      .addStringOption(o => o.setName('code').setDescription('paste key:value lines').setRequired(true))
    )

    .addSubcommand(s => s.setName('view').setDescription('view your saved embeds'))

    .addSubcommand(s => s.setName('send').setDescription('send a saved embed')
      .addChannelOption(o => o.setName('channel').setDescription('channel to send in').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
    )

    .addSubcommand(s => s.setName('preview').setDescription('preview a saved embed without sending'))

    .addSubcommand(s => s.setName('edit').setDescription('edit a saved embed in the builder'))

    .addSubcommand(s => s.setName('duplicate').setDescription('duplicate a saved embed')
      .addStringOption(o => o.setName('query').setDescription('embed name or id').setRequired(true))
      .addStringOption(o => o.setName('new_name').setDescription('new name for the copy').setRequired(true))
    )

    .addSubcommand(s => s.setName('rename').setDescription('rename a saved embed')
      .addStringOption(o => o.setName('query').setDescription('embed name or id').setRequired(true))
      .addStringOption(o => o.setName('new_name').setDescription('new name').setRequired(true))
    )

    .addSubcommand(s => s.setName('export').setDescription('export a saved embed as key:value code')
      .addStringOption(o => o.setName('query').setDescription('embed name or id').setRequired(true))
    )

    .addSubcommand(s => s.setName('delete').setDescription('delete a saved embed')
      .addStringOption(o => o.setName('query').setDescription('embed name or id').setRequired(true))
    )

    .addSubcommand(s => s.setName('clear').setDescription('delete ALL your saved embeds')),

  async execute(interaction, client) {
    /* ───────── permission gate ───────── */
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
    const getSaved = () => client.memory.get(storageKey) || {};
    const setSaved = (obj) => client.memory.set(storageKey, obj);

    const errBox = (msg) => new ContainerBuilder()
      .setAccentColor(COLORS.red)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.error} ${msg}`));

    const okBox = (msg) => new ContainerBuilder()
      .setAccentColor(COLORS.green)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.success} ${msg}`));

    const findSaved = (query) => {
      const saved = getSaved();
      return Object.values(saved).find(e =>
        e.id === query.toUpperCase() || e.name.toLowerCase() === query.toLowerCase()
      );
    };

    /* ═══════════════ builder / edit ═══════════════ */
    if (sub === 'builder' || sub === 'edit') {
      await interaction.deferReply({ flags: V2_E });

      let initialState = defaultState();
      let editingId = null;
      let hint = 'use buttons below to build';

      if (sub === 'edit') {
        const saved = getSaved();
        const list = Object.values(saved);
        if (list.length === 0) {
          return interaction.editReply({ components: [errBox('no saved embeds to edit.')], flags: V2_E });
        }
        const options = list.slice(0, 25).map(e =>
          new StringSelectMenuOptionBuilder().setLabel(e.name.slice(0, 100)).setValue(e.id).setDescription(`id: ${e.id}`)
        );
        const menu = new StringSelectMenuBuilder().setCustomId('eb_edit_pick').setPlaceholder('select an embed to edit').addOptions(options);
        const pickContainer = new ContainerBuilder()
          .setAccentColor(COLORS.default)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.rename} pick embed to edit`))
          .addActionRowComponents(new ActionRowBuilder().addComponents(menu));

        await interaction.editReply({ components: [pickContainer], flags: V2_E });
        const pickMsg = await interaction.fetchReply();
        const pick = await pickMsg.awaitMessageComponent({ time: 60000, filter: i => i.user.id === userId }).catch(() => null);
        if (!pick) return;
        await pick.deferUpdate().catch(() => {});

        const chosen = saved[pick.values[0]];
        if (!chosen) {
          return interaction.editReply({ components: [errBox('embed not found.')], flags: V2_E });
        }
        initialState = JSON.parse(JSON.stringify(chosen.state));
        editingId = chosen.id;
        hint = `editing **${chosen.name}** · id \`${chosen.id}\``;
      }

      let state = initialState;
      let undoStack = [];
      const pushUndo = () => {
        undoStack.push(JSON.parse(JSON.stringify(state)));
        if (undoStack.length > 12) undoStack.shift();
      };

      const wrapContainer = () => {
        const c = buildStatusContainer(state, hint);
        const rows = buildBuilderRows(state);
        for (const r of rows) c.addActionRowComponents(r);
        return c;
      };

      await interaction.editReply({ components: [wrapContainer()], flags: V2_E });
      const builderMsg = await interaction.fetchReply();
      const collector = builderMsg.createMessageComponentCollector({ time: 600000 });

      collector.on('collect', async btn => {
        if (btn.user.id !== userId) {
          return btn.reply({
            components: [new ContainerBuilder().setAccentColor(COLORS.red)
              .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.error} not your builder.`))],
            flags: V2_E,
          }).catch(() => {});
        }

        /* ──── quick toggle / simple buttons ──── */
        if (btn.customId === 'eb_timestamp') {
          pushUndo();
          await btn.deferUpdate().catch(() => {});
          state.timestamp = !state.timestamp;
          return builderMsg.edit({ components: [wrapContainer()] }).catch(() => {});
        }

        if (btn.customId === 'eb_random_color') {
          pushUndo();
          await btn.deferUpdate().catch(() => {});
          const names = NAMED_COLORS.filter(n => n !== 'default');
          const pick = names[Math.floor(Math.random() * names.length)];
          state.color = COLORS[pick];
          state.colorName = pick;
          return builderMsg.edit({ components: [wrapContainer()] }).catch(() => {});
        }

        if (btn.customId === 'eb_undo') {
          await btn.deferUpdate().catch(() => {});
          if (!undoStack.length) {
            return btn.followUp({
              components: [new ContainerBuilder().setAccentColor(COLORS.red)
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.error} nothing to undo.`))],
              flags: V2_E,
            }).catch(() => {});
          }
          state = undoStack.pop();
          return builderMsg.edit({ components: [wrapContainer()] }).catch(() => {});
        }

        if (btn.customId === 'eb_clear') {
          pushUndo();
          await btn.deferUpdate().catch(() => {});
          state = defaultState();
          return builderMsg.edit({ components: [wrapContainer()] }).catch(() => {});
        }

        if (btn.customId === 'eb_preview') {
          await btn.deferUpdate().catch(() => {});
          return btn.followUp({ components: [buildDisplayContainer(state)], flags: V2_E }).catch(() => {});
        }

        /* ──── save without sending ──── */
        if (btn.customId === 'eb_save') {
          const modal = new ModalBuilder().setCustomId('eb_save_modal').setTitle('save embed');
          const nameInput = new TextInputBuilder().setCustomId('name').setLabel('name').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(50);
          modal.addComponents(new ActionRowBuilder().addComponents(nameInput));
          await btn.showModal(modal).catch(() => {});

          const sub2 = await btn.awaitModalSubmit({ time: 60000, filter: m => m.customId === 'eb_save_modal' && m.user.id === userId }).catch(() => null);
          if (!sub2) return;
          const name = sub2.fields.getTextInputValue('name');

          const saved = getSaved();
          const existing = Object.values(saved).find(e => e.name.toLowerCase() === name.toLowerCase() && e.id !== editingId);
          if (existing && !editingId) {
            return sub2.reply({ components: [errBox(`an embed named **${name}** already exists.`)], flags: V2_E }).catch(() => {});
          }

          const finalId = editingId || generateEmbedId();
          saved[finalId] = { id: finalId, name, state: JSON.parse(JSON.stringify(state)), createdAt: Date.now() };
          setSaved(saved);

          if (editingId) {
            editingId = finalId;
            hint = `editing **${name}** · id \`${finalId}\``;
          }

          await sub2.reply({ components: [okBox(`saved as **${name}** · id \`${finalId}\``)], flags: V2_E }).catch(() => {});
          return builderMsg.edit({ components: [wrapContainer()] }).catch(() => {});
        }

        /* ──── send ──── */
        if (btn.customId === 'eb_send') {
          await btn.deferUpdate().catch(() => {});
          try {
            await interaction.channel.send({ components: [buildDisplayContainer(state)], flags: V2 });

            const newId = editingId || generateEmbedId();
            const saveRow = new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId('eb_save_after').setLabel('save').setStyle(ButtonStyle.Primary),
              new ButtonBuilder().setCustomId('eb_no_save').setLabel('no thanks').setStyle(ButtonStyle.Secondary),
            );
            const promptC = new ContainerBuilder()
              .setAccentColor(COLORS.green)
              .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.success} embed sent · id \`${newId}\`\n-# wanna save this for later?`))
              .addActionRowComponents(saveRow);

            const reply = await btn.followUp({ components: [promptC], flags: V2_E }).catch(() => null);
            if (!reply) return;

            const pick = await reply.awaitMessageComponent({ time: 60000, filter: i => i.user.id === userId }).catch(() => null);
            if (!pick) return;

            if (pick.customId === 'eb_no_save') {
              await pick.deferUpdate().catch(() => {});
              return;
            }

            const modal = new ModalBuilder().setCustomId('eb_save_modal2').setTitle('save embed');
            const nameInput = new TextInputBuilder().setCustomId('name').setLabel('name').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(50);
            modal.addComponents(new ActionRowBuilder().addComponents(nameInput));
            await pick.showModal(modal).catch(() => {});

            const modalSub = await pick.awaitModalSubmit({ time: 60000, filter: m => m.customId === 'eb_save_modal2' && m.user.id === userId }).catch(() => null);
            if (!modalSub) return;
            const name = modalSub.fields.getTextInputValue('name');
            const saved = getSaved();
            saved[newId] = { id: newId, name, state: JSON.parse(JSON.stringify(state)), createdAt: Date.now() };
            setSaved(saved);
            await modalSub.reply({ components: [okBox(`saved as **${name}** · id \`${newId}\``)], flags: V2_E }).catch(() => {});
          } catch (err) {
            await btn.followUp({ components: [errBox(`failed to send: ${String(err.message).slice(0, 100)}`)], flags: V2_E }).catch(() => {});
          }
          return;
        }

        /* ──── manage fields ──── */
        if (btn.customId === 'eb_manage_fields') {
          await btn.deferUpdate().catch(() => {});

          if (state.fields.length === 0) {
            return btn.followUp({ components: [errBox('no fields yet. use "add field" first.')], flags: V2_E }).catch(() => {});
          }

          const options = state.fields.slice(0, 24).map((f, i) =>
            new StringSelectMenuOptionBuilder()
              .setLabel(f.name.slice(0, 100))
              .setValue(`edit_${i}`)
              .setDescription(f.value.slice(0, 100))
          );
          options.push(new StringSelectMenuOptionBuilder().setLabel('clear all fields').setValue('clear_all'));

          const menu = new StringSelectMenuBuilder().setCustomId('eb_field_pick').setPlaceholder('select a field to edit').addOptions(options);
          const menuC = new ContainerBuilder()
            .setAccentColor(state.color || COLORS.default)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.folder} manage fields\n-# pick a field to edit or remove`))
            .addActionRowComponents(new ActionRowBuilder().addComponents(menu));

          const msg = await btn.followUp({ components: [menuC], flags: V2_E }).catch(() => null);
          if (!msg) return;

          const sel = await msg.awaitMessageComponent({ time: 60000, filter: i => i.user.id === userId }).catch(() => null);
          if (!sel) return;

          if (sel.values[0] === 'clear_all') {
            pushUndo();
            await sel.deferUpdate().catch(() => {});
            state.fields = [];
            await msg.delete().catch(() => {});
            return builderMsg.edit({ components: [wrapContainer()] }).catch(() => {});
          }

          const idx = parseInt(sel.values[0].split('_')[1], 10);
          const field = state.fields[idx];
          if (!field) { await sel.deferUpdate().catch(() => {}); return; }

          const modal = new ModalBuilder().setCustomId('ebm_field_edit').setTitle('edit field');
          const nameInput = new TextInputBuilder().setCustomId('fname').setLabel('field name').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(256).setValue(field.name);
          const valueInput = new TextInputBuilder().setCustomId('fvalue').setLabel('field value').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1024).setValue(field.value);
          modal.addComponents(new ActionRowBuilder().addComponents(nameInput), new ActionRowBuilder().addComponents(valueInput));

          await sel.showModal(modal).catch(() => {});
          const modalSub = await sel.awaitModalSubmit({ time: 60000, filter: m => m.customId === 'ebm_field_edit' && m.user.id === userId }).catch(() => null);
          if (!modalSub) return;

          pushUndo();
          await modalSub.deferUpdate().catch(() => {});
          state.fields[idx] = {
            name: modalSub.fields.getTextInputValue('fname'),
            value: modalSub.fields.getTextInputValue('fvalue'),
          };
          await msg.delete().catch(() => {});
          return builderMsg.edit({ components: [wrapContainer()] }).catch(() => {});
        }

        /* ──── add link button ──── */
        if (btn.customId === 'eb_add_button') {
          if (state.buttons.length >= 5) {
            return btn.reply({ components: [errBox('max 5 buttons.')], flags: V2_E }).catch(() => {});
          }
          const modal = new ModalBuilder().setCustomId('ebm_add_button').setTitle('add link button');
          const labelInput = new TextInputBuilder().setCustomId('blabel').setLabel('button label').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(80);
          const urlInput = new TextInputBuilder().setCustomId('burl').setLabel('button url (https)').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(500);
          modal.addComponents(new ActionRowBuilder().addComponents(labelInput), new ActionRowBuilder().addComponents(urlInput));
          await btn.showModal(modal).catch(() => {});

          const modalSub = await btn.awaitModalSubmit({ time: 60000, filter: m => m.customId === 'ebm_add_button' && m.user.id === userId }).catch(() => null);
          if (!modalSub) return;

          const label = modalSub.fields.getTextInputValue('blabel');
          const url = modalSub.fields.getTextInputValue('burl');
          if (!url.startsWith('http')) {
            return modalSub.reply({ components: [errBox('url must start with http.')], flags: V2_E }).catch(() => {});
          }

          pushUndo();
          await modalSub.deferUpdate().catch(() => {});
          state.buttons.push({ label, url });
          return builderMsg.edit({ components: [wrapContainer()] }).catch(() => {});
        }

        /* ──── manage buttons ──── */
        if (btn.customId === 'eb_manage_buttons') {
          await btn.deferUpdate().catch(() => {});

          if (state.buttons.length === 0) {
            return btn.followUp({ components: [errBox('no buttons yet. use "add button" first.')], flags: V2_E }).catch(() => {});
          }

          const options = state.buttons.slice(0, 24).map((b, i) =>
            new StringSelectMenuOptionBuilder()
              .setLabel(b.label.slice(0, 100))
              .setValue(`edit_${i}`)
              .setDescription(b.url.slice(0, 100))
          );
          options.push(new StringSelectMenuOptionBuilder().setLabel('clear all buttons').setValue('clear_all'));

          const menu = new StringSelectMenuBuilder().setCustomId('eb_button_pick').setPlaceholder('select a button to edit').addOptions(options);
          const menuC = new ContainerBuilder()
            .setAccentColor(state.color || COLORS.default)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.link} manage buttons\n-# pick a button to edit or remove`))
            .addActionRowComponents(new ActionRowBuilder().addComponents(menu));

          const msg = await btn.followUp({ components: [menuC], flags: V2_E }).catch(() => null);
          if (!msg) return;

          const sel = await msg.awaitMessageComponent({ time: 60000, filter: i => i.user.id === userId }).catch(() => null);
          if (!sel) return;

          if (sel.values[0] === 'clear_all') {
            pushUndo();
            await sel.deferUpdate().catch(() => {});
            state.buttons = [];
            await msg.delete().catch(() => {});
            return builderMsg.edit({ components: [wrapContainer()] }).catch(() => {});
          }

          const idx = parseInt(sel.values[0].split('_')[1], 10);
          const b = state.buttons[idx];
          if (!b) { await sel.deferUpdate().catch(() => {}); return; }

          const modal = new ModalBuilder().setCustomId('ebm_edit_button').setTitle('edit button');
          const labelInput = new TextInputBuilder().setCustomId('blabel').setLabel('button label').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(80).setValue(b.label);
          const urlInput = new TextInputBuilder().setCustomId('burl').setLabel('button url').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(500).setValue(b.url);
          modal.addComponents(new ActionRowBuilder().addComponents(labelInput), new ActionRowBuilder().addComponents(urlInput));

          await sel.showModal(modal).catch(() => {});
          const modalSub = await sel.awaitModalSubmit({ time: 60000, filter: m => m.customId === 'ebm_edit_button' && m.user.id === userId }).catch(() => null);
          if (!modalSub) return;

          pushUndo();
          await modalSub.deferUpdate().catch(() => {});
          state.buttons[idx] = {
            label: modalSub.fields.getTextInputValue('blabel'),
            url: modalSub.fields.getTextInputValue('burl'),
          };
          await msg.delete().catch(() => {});
          return builderMsg.edit({ components: [wrapContainer()] }).catch(() => {});
        }

        /* ──── standard modals ──── */
        const modalMap = {
          eb_title: {
            id: 'ebm_title', title: 'set title',
            fields: [{ id: 'val', label: 'title', style: TextInputStyle.Short, max: 256 }],
            apply: v => { state.title = v; },
          },
          eb_desc: {
            id: 'ebm_desc', title: 'set description',
            fields: [{ id: 'val', label: 'description', style: TextInputStyle.Paragraph, max: 4096 }],
            apply: v => { state.description = v; },
          },
          eb_color: {
            id: 'ebm_color', title: 'set color',
            fields: [{ id: 'val', label: 'color name or hex', style: TextInputStyle.Short, max: 20, placeholder: 'blue, red, gold, or #5b7fd4' }],
            apply: v => {
              const parsed = parseColor(v);
              if (parsed === null) return false;
              state.color = parsed;
              state.colorName = v;
            },
          },
          eb_author: {
            id: 'ebm_author', title: 'set author',
            fields: [{ id: 'val', label: 'author name', style: TextInputStyle.Short, max: 256 }],
            apply: v => { state.author = v; },
          },
          eb_footer: {
            id: 'ebm_footer', title: 'set footer',
            fields: [{ id: 'val', label: 'footer text', style: TextInputStyle.Short, max: 2048 }],
            apply: v => { state.footer = v; },
          },
          eb_author_icon: {
            id: 'ebm_author_icon', title: 'set author icon',
            fields: [{ id: 'val', label: 'icon url (https)', style: TextInputStyle.Short, max: 500 }],
            apply: v => { state.authorIcon = v.startsWith('http') ? v : null; },
          },
          eb_footer_icon: {
            id: 'ebm_footer_icon', title: 'set footer icon',
            fields: [{ id: 'val', label: 'icon url (https)', style: TextInputStyle.Short, max: 500 }],
            apply: v => { state.footerIcon = v.startsWith('http') ? v : null; },
          },
          eb_image: {
            id: 'ebm_image', title: 'set image',
            fields: [{ id: 'val', label: 'image url (https)', style: TextInputStyle.Short, max: 500 }],
            apply: v => { state.image = v.startsWith('http') ? v : null; },
          },
          eb_thumbnail: {
            id: 'ebm_thumbnail', title: 'set thumbnail',
            fields: [{ id: 'val', label: 'thumbnail url (https)', style: TextInputStyle.Short, max: 500 }],
            apply: v => { state.thumbnail = v.startsWith('http') ? v : null; },
          },
          eb_field: {
            id: 'ebm_field', title: 'add field',
            fields: [
              { id: 'fname', label: 'field name', style: TextInputStyle.Short, max: 256 },
              { id: 'fvalue', label: 'field value', style: TextInputStyle.Paragraph, max: 1024 },
            ],
            apply: (_, sub) => {
              if (state.fields.length >= 25) return false;
              state.fields.push({
                name: sub.fields.getTextInputValue('fname'),
                value: sub.fields.getTextInputValue('fvalue'),
              });
            },
            multi: true,
          },
        };

        const def = modalMap[btn.customId];
        if (!def) return;

        const modal = new ModalBuilder().setCustomId(def.id).setTitle(def.title);
        modal.addComponents(def.fields.map(f => {
          const input = new TextInputBuilder().setCustomId(f.id).setLabel(f.label).setStyle(f.style).setRequired(true).setMaxLength(f.max);
          if (f.placeholder) input.setPlaceholder(f.placeholder);
          return new ActionRowBuilder().addComponents(input);
        }));

        await btn.showModal(modal).catch(() => {});
        const modalSubmit = await btn.awaitModalSubmit({ time: 120000, filter: m => m.customId === def.id && m.user.id === userId }).catch(() => null);
        if (!modalSubmit) return;

        pushUndo();
        await modalSubmit.deferUpdate().catch(() => {});
        if (def.multi) def.apply(null, modalSubmit);
        else def.apply(modalSubmit.fields.getTextInputValue('val'));

        return builderMsg.edit({ components: [wrapContainer()] }).catch(() => {});
      });

      collector.on('end', () => {
        builderMsg.edit({ components: [] }).catch(() => {});
      });
      return;
    }

    /* ═══════════════ quick ═══════════════ */
    if (sub === 'quick') {
      await interaction.deferReply({ flags: V2_E });
      const state = defaultState();
      state.title = interaction.options.getString('title');
      state.description = interaction.options.getString('description');
      const colorVal = interaction.options.getString('color');
      if (colorVal) {
        const parsed = parseColor(colorVal);
        if (parsed !== null) { state.color = parsed; state.colorName = colorVal; }
      }
      state.image = interaction.options.getString('image');
      state.thumbnail = interaction.options.getString('thumbnail');
      state.footer = interaction.options.getString('footer');
      state.author = interaction.options.getString('author');

      if (!state.title && !state.description && !state.image && !state.thumbnail) {
        return interaction.editReply({ components: [errBox('give me at least a title, description, image, or thumbnail.')], flags: V2_E });
      }

      const channel = interaction.options.getChannel('channel') || interaction.channel;
      try {
        await channel.send({ components: [buildDisplayContainer(state)], flags: V2 });
        return interaction.editReply({ components: [okBox(`embed sent to ${channel}.`)], flags: V2_E });
      } catch (err) {
        return interaction.editReply({ components: [errBox(`failed: ${String(err.message).slice(0, 100)}`)], flags: V2_E });
      }
    }

    /* ═══════════════ template ═══════════════ */
    if (sub === 'template') {
      await interaction.deferReply({ flags: V2_E });
      const type = interaction.options.getString('type');
      const title = interaction.options.getString('title');
      const desc = interaction.options.getString('description');
      const colorVal = interaction.options.getString('color') || 'default';
      const parsedColor = parseColor(colorVal);
      const color = parsedColor === null ? COLORS.default : parsedColor;
      const embedId = generateEmbedId();

      const authorMap = {
        welcome: 'welcome!',
        goodbye: 'goodbye :(',
        announcement: 'announcement',
        giveaway: 'giveaway',
        event: 'event',
        update: 'update',
      };

      const state = {
        ...defaultState(),
        title,
        description: desc,
        color,
        colorName: colorVal,
        footer: 'chromed',
        timestamp: true,
        author: authorMap[type] || type,
      };

      const channel = interaction.options.getChannel('channel') || interaction.channel;
      await channel.send({ components: [buildDisplayContainer(state)], flags: V2 });

      const saved = getSaved();
      saved[embedId] = { id: embedId, name: `${type}-${embedId}`, state, createdAt: Date.now() };
      setSaved(saved);

      const saveRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`eb_save_${embedId}`).setLabel('keep saved').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`eb_nosave_${embedId}`).setLabel('drop it').setStyle(ButtonStyle.Secondary),
      );
      const confirmC = new ContainerBuilder()
        .setAccentColor(COLORS.green)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.success} template sent to ${channel} · id \`${embedId}\`\n-# keep it saved in your library?`))
        .addActionRowComponents(saveRow);

      await interaction.editReply({ components: [confirmC], flags: V2_E });

      const msg = await interaction.fetchReply();
      const pick = await msg.awaitMessageComponent({ time: 60000, filter: i => i.user.id === userId }).catch(() => null);
      if (!pick) return;
      await pick.deferUpdate().catch(() => {});

      if (pick.customId === `eb_nosave_${embedId}`) {
        const s = getSaved();
        delete s[embedId];
        setSaved(s);
        await interaction.editReply({ components: [okBox(`template sent · id \`${embedId}\``)], flags: V2_E }).catch(() => {});
      } else {
        await interaction.editReply({ components: [okBox(`saved as **${type}-${embedId}** · id \`${embedId}\``)], flags: V2_E }).catch(() => {});
      }
      return;
    }

    /* ═══════════════ advanced ═══════════════ */
    if (sub === 'advanced') {
      await interaction.deferReply({ flags: V2_E });
      const code = interaction.options.getString('code');
      const state = { ...defaultState(), ...parseKeyValue(code) };
      const channel = interaction.options.getChannel('channel') || interaction.channel;

      try {
        await channel.send({ components: [buildDisplayContainer(state)], flags: V2 });
        const embedId = generateEmbedId();
        const saved = getSaved();
        saved[embedId] = { id: embedId, name: `advanced-${embedId}`, state, createdAt: Date.now() };
        setSaved(saved);
        return interaction.editReply({ components: [okBox(`advanced embed sent to ${channel} · id \`${embedId}\``)], flags: V2_E });
      } catch (err) {
        return interaction.editReply({ components: [errBox(`failed: ${String(err.message).slice(0, 100)}`)], flags: V2_E });
      }
    }

    /* ═══════════════ advanced-paste ═══════════════ */
    if (sub === 'advanced-paste') {
      await interaction.deferReply({ flags: V2_E });
      const template = [
        '# chromed embed code — every field optional',
        'title: welcome!',
        'desc: hey everyone! glad you\'re here.',
        'color: #5b7fd4',
        'author: server name',
        'author_icon: https://example.com/icon.png',
        'footer: chromed',
        'footer_icon: https://example.com/icon.png',
        'image: https://example.com/banner.png',
        'thumbnail: https://example.com/thumb.png',
        'timestamp: true',
        '',
        '# fields: use "field: name | value" per line',
        'field: rules | read #rules before chatting',
        'field: roles | grab roles in #roles',
        '',
        '# buttons: use "button: label | url" per line (max 5)',
        'button: discord | https://discord.gg/rTrJyPyayg',
        'button: site | https://chromed.bot',
      ].join('\n');

      return interaction.editReply({
        components: [new ContainerBuilder()
          .setAccentColor(COLORS.default)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.file} embed code template`))
          .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`\`\`\`\n${template}\n\`\`\``))],
        flags: V2_E,
      });
    }

    /* ═══════════════ system ═══════════════ */
    if (sub === 'system') {
      await interaction.deferReply({ flags: V2_E });
      const type = interaction.options.getString('type');
      const embedId = generateEmbedId();

      const systems = {
        'welcome':     { color: 0x57f287, title: 'welcome!', description: 'welcome to the server! please read the rules and enjoy your stay.' },
        'goodbye':     { color: 0xff3b3b, title: 'goodbye!', description: "a member has left the server. we'll miss you!" },
        'log-join':    { color: 0x57f287, title: 'member joined', description: 'a new member has joined the server.' },
        'log-leave':   { color: 0xff3b3b, title: 'member left', description: 'a member has left the server.' },
        'announcement':{ color: 0xf1c40f, title: 'announcement', description: 'important announcement from the staff team.' },
        'rule':        { color: 0x7289da, title: 'rule reminder', description: 'please remember to follow the server rules at all times.' },
        'event':       { color: 0xe67e22, title: 'event announcement', description: 'an exciting event is coming up! stay tuned for more details.' },
        'mod-alert':   { color: 0xff3b3b, title: 'mod alert', description: 'attention moderators — please check the mod channel.' },
        'status':      { color: 0x9b59b6, title: 'status update', description: 'here is a status update from the team.' },
        'fun':         { color: 0xff69b4, title: 'fun time!', description: "let's have some fun! check out what's going on." },
        'milestone':   { color: 0xf1c40f, title: 'milestone reached!', description: 'a big milestone has been hit. thanks to everyone who contributed.' },
        'boost':       { color: 0xff69b4, title: 'server boosted!', description: 'thank you for boosting the server. your support keeps us running.' },
      };

      const sys = systems[type];
      if (!sys) return interaction.editReply({ components: [errBox('unknown system embed type.')], flags: V2_E });

      const state = { ...defaultState(), ...sys, colorName: 'system', timestamp: true };
      const channel = interaction.options.getChannel('channel') || interaction.channel;

      await channel.send({ components: [buildDisplayContainer(state)], flags: V2 });
      return interaction.editReply({ components: [okBox(`system embed sent to ${channel} · id \`${embedId}\``)], flags: V2_E });
    }

    /* ═══════════════ save ═══════════════ */
    if (sub === 'save') {
      await interaction.deferReply({ flags: V2_E });
      const name = interaction.options.getString('name');
      const code = interaction.options.getString('code');
      const state = { ...defaultState(), ...parseKeyValue(code) };
      const embedId = generateEmbedId();

      const saved = getSaved();
      saved[embedId] = { id: embedId, name, state, createdAt: Date.now() };
      setSaved(saved);

      return interaction.editReply({
        components: [okBox(`embed **${name}** saved · id \`${embedId}\`\n-# use \`/embed send\` to send it.`)],
        flags: V2_E,
      });
    }

    /* ═══════════════ view ═══════════════ */
    if (sub === 'view') {
      await interaction.deferReply({ flags: V2_E });
      const saved = getSaved();
      const list = Object.values(saved).sort((a, b) => b.createdAt - a.createdAt);

      if (list.length === 0) {
        return interaction.editReply({
          components: [new ContainerBuilder()
            .setAccentColor(COLORS.default)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.folder} no saved embeds yet. use \`/embed save\` or \`/embed builder\` to create some!`))],
          flags: V2_E,
        });
      }

      const shown = list.slice(0, 20);
      const lines = shown.map(e => `${E.file} **${e.name}** · id \`${e.id}\` · *${new Date(e.createdAt).toLocaleDateString()}*`);

      return interaction.editReply({
        components: [new ContainerBuilder()
          .setAccentColor(COLORS.default)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.folder} your saved embeds (${list.length})`))
          .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')))
          .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# use \`/embed send\` · \`/embed edit\` · \`/embed export\` · \`/embed delete\``))],
        flags: V2_E,
      });
    }

    /* ═══════════════ send ═══════════════ */
    if (sub === 'send') {
      await interaction.deferReply({ flags: V2_E });
      const saved = getSaved();
      const list = Object.values(saved);

      if (list.length === 0) {
        return interaction.editReply({ components: [errBox('no saved embeds. use `/embed builder` or `/embed save` first.')], flags: V2_E });
      }

      const options = list.slice(0, 25).map(e =>
        new StringSelectMenuOptionBuilder().setLabel(e.name.slice(0, 100)).setValue(e.id).setDescription(`id: ${e.id}`)
      );
      const menu = new StringSelectMenuBuilder().setCustomId('eb_send_select').setPlaceholder('choose an embed to send').addOptions(options);
      const c = new ContainerBuilder()
        .setAccentColor(COLORS.default)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.compass} select an embed`))
        .addActionRowComponents(new ActionRowBuilder().addComponents(menu));

      await interaction.editReply({ components: [c], flags: V2_E });
      const msg = await interaction.fetchReply();
      const pick = await msg.awaitMessageComponent({ time: 60000, filter: i => i.user.id === userId }).catch(() => null);
      if (!pick) return;
      await pick.deferUpdate().catch(() => {});

      const chosen = saved[pick.values[0]];
      if (!chosen) return interaction.editReply({ components: [errBox('embed not found.')], flags: V2_E });

      const channel = interaction.options.getChannel('channel') || interaction.channel;
      await channel.send({ components: [buildDisplayContainer(chosen.state)], flags: V2 });
      return interaction.editReply({ components: [okBox(`embed **${chosen.name}** sent to ${channel} · id \`${chosen.id}\``)], flags: V2_E });
    }

    /* ═══════════════ preview ═══════════════ */
    if (sub === 'preview') {
      await interaction.deferReply({ flags: V2_E });
      const saved = getSaved();
      const list = Object.values(saved);

      if (list.length === 0) {
        return interaction.editReply({ components: [errBox('no saved embeds to preview.')], flags: V2_E });
      }

      const options = list.slice(0, 25).map(e =>
        new StringSelectMenuOptionBuilder().setLabel(e.name.slice(0, 100)).setValue(e.id).setDescription(`id: ${e.id}`)
      );
      const menu = new StringSelectMenuBuilder().setCustomId('eb_preview_select').setPlaceholder('choose an embed to preview').addOptions(options);
      const c = new ContainerBuilder()
        .setAccentColor(COLORS.default)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.show} pick an embed to preview`))
        .addActionRowComponents(new ActionRowBuilder().addComponents(menu));

      await interaction.editReply({ components: [c], flags: V2_E });
      const msg = await interaction.fetchReply();
      const pick = await msg.awaitMessageComponent({ time: 60000, filter: i => i.user.id === userId }).catch(() => null);
      if (!pick) return;
      await pick.deferUpdate().catch(() => {});

      const chosen = saved[pick.values[0]];
      if (!chosen) return interaction.editReply({ components: [errBox('embed not found.')], flags: V2_E });

      return interaction.editReply({
        components: [
          new ContainerBuilder()
            .setAccentColor(COLORS.default)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.show} preview — **${chosen.name}**\n-# id \`${chosen.id}\``)),
          buildDisplayContainer(chosen.state),
        ],
        flags: V2_E,
      });
    }

    /* ═══════════════ duplicate ═══════════════ */
    if (sub === 'duplicate') {
      await interaction.deferReply({ flags: V2_E });
      const query = interaction.options.getString('query');
      const newName = interaction.options.getString('new_name');
      const found = findSaved(query);

      if (!found) return interaction.editReply({ components: [errBox(`no embed found with name or id **${query}**.`)], flags: V2_E });

      const saved = getSaved();
      if (Object.values(saved).some(e => e.name.toLowerCase() === newName.toLowerCase())) {
        return interaction.editReply({ components: [errBox(`an embed named **${newName}** already exists.`)], flags: V2_E });
      }

      const newId = generateEmbedId();
      saved[newId] = { id: newId, name: newName, state: JSON.parse(JSON.stringify(found.state)), createdAt: Date.now() };
      setSaved(saved);

      return interaction.editReply({
        components: [okBox(`duplicated **${found.name}** → **${newName}** · id \`${newId}\``)],
        flags: V2_E,
      });
    }

    /* ═══════════════ rename ═══════════════ */
    if (sub === 'rename') {
      await interaction.deferReply({ flags: V2_E });
      const query = interaction.options.getString('query');
      const newName = interaction.options.getString('new_name');
      const found = findSaved(query);

      if (!found) return interaction.editReply({ components: [errBox(`no embed found with name or id **${query}**.`)], flags: V2_E });

      const saved = getSaved();
      const oldName = found.name;
      saved[found.id].name = newName;
      setSaved(saved);

      return interaction.editReply({
        components: [okBox(`renamed **${oldName}** → **${newName}** · id \`${found.id}\``)],
        flags: V2_E,
      });
    }

    /* ═══════════════ export ═══════════════ */
    if (sub === 'export') {
      await interaction.deferReply({ flags: V2_E });
      const query = interaction.options.getString('query');
      const found = findSaved(query);

      if (!found) return interaction.editReply({ components: [errBox(`no embed found with name or id **${query}**.`)], flags: V2_E });

      const code = stateToKeyValue(found.state);
      return interaction.editReply({
        components: [new ContainerBuilder()
          .setAccentColor(COLORS.default)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.file} export — **${found.name}**\n-# id \`${found.id}\``))
          .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`\`\`\`\n${code || '(empty)'}\n\`\`\``))],
        flags: V2_E,
      });
    }

    /* ═══════════════ delete ═══════════════ */
    if (sub === 'delete') {
      await interaction.deferReply({ flags: V2_E });
      const query = interaction.options.getString('query');
      const found = findSaved(query);

      if (!found) return interaction.editReply({ components: [errBox(`no embed found with name or id **${query}**.`)], flags: V2_E });

      const saved = getSaved();
      const deletedName = found.name;
      const deletedId = found.id;
      delete saved[found.id];
      setSaved(saved);

      return interaction.editReply({ components: [okBox(`deleted **${deletedName}** · id \`${deletedId}\``)], flags: V2_E });
    }

    /* ═══════════════ clear ═══════════════ */
    if (sub === 'clear') {
      await interaction.deferReply({ flags: V2_E });
      const saved = getSaved();
      const count = Object.keys(saved).length;

      if (count === 0) {
        return interaction.editReply({ components: [errBox('you have no saved embeds.')], flags: V2_E });
      }

      const confirmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('eb_clear_yes').setLabel('yes, delete all').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('eb_clear_no').setLabel('cancel').setStyle(ButtonStyle.Secondary),
      );
      const confirmC = new ContainerBuilder()
        .setAccentColor(COLORS.red)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.angry} delete all **${count}** saved embeds?\n-# this cannot be undone.`))
        .addActionRowComponents(confirmRow);

      await interaction.editReply({ components: [confirmC], flags: V2_E });
      const msg = await interaction.fetchReply();
      const pick = await msg.awaitMessageComponent({ time: 60000, filter: i => i.user.id === userId }).catch(() => null);
      if (!pick) return;
      await pick.deferUpdate().catch(() => {});

      if (pick.customId === 'eb_clear_yes') {
        setSaved({});
        return interaction.editReply({ components: [okBox(`deleted all **${count}** saved embeds.`)], flags: V2_E });
      } else {
        return interaction.editReply({ components: [new ContainerBuilder()
          .setAccentColor(COLORS.default)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.success} cancelled.`))], flags: V2_E });
      }
    }
  },
};
