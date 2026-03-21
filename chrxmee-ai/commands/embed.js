const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} = require('discord.js');

const COLORS = {
  blue: 0x7289da, red: 0xff0000, green: 0x00ff00,
  purple: 0x9b59b6, gold: 0xf1c40f, default: 0x2f3136,
  orange: 0xe67e22, pink: 0xff69b4, cyan: 0x00ffff,
  white: 0xffffff, black: 0x000000, yellow: 0xffff00
};

function generateEmbedId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = 'EM-';
  for (let i = 0; i < 4; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

function parseColor(val) {
  const lower = val.toLowerCase().trim();
  if (COLORS[lower]) return COLORS[lower];
  const hex = lower.replace('#', '');
  const parsed = parseInt(hex, 16);
  return isNaN(parsed) ? COLORS.default : parsed;
}

function buildLiveEmbed(state) {
  const embed = new EmbedBuilder().setColor(state.color || COLORS.default);
  if (state.title) embed.setTitle(state.title);
  if (state.description) embed.setDescription(state.description);
  if (state.footer) embed.setFooter({ text: state.footer });
  if (state.image) { try { embed.setImage(state.image); } catch {} }
  if (state.thumbnail) { try { embed.setThumbnail(state.thumbnail); } catch {} }
  if (state.author) embed.setAuthor({ name: state.author });
  if (state.timestamp) embed.setTimestamp();
  if (state.fields && state.fields.length > 0) {
    embed.addFields(state.fields.slice(0, 25));
  }
  return embed;
}

function buildStatusText(state) {
  const lines = [
    `**✏️ Title:** ${state.title || '*not set*'}`,
    `**📝 Description:** ${state.description ? state.description.slice(0, 50) + (state.description.length > 50 ? '...' : '') : '*not set*'}`,
    `**🎨 Color:** ${state.colorName || 'default'}`,
    `**👤 Author:** ${state.author || '*not set*'}`,
    `**🖼️ Image:** ${state.image ? '✅ set' : '*not set*'}`,
    `**🖼️ Thumbnail:** ${state.thumbnail ? '✅ set' : '*not set*'}`,
    `**📋 Footer:** ${state.footer || '*not set*'}`,
    `**🕐 Timestamp:** ${state.timestamp ? '✅ on' : '❌ off'}`,
    `**➕ Fields:** ${state.fields ? state.fields.length : 0}`,
  ];
  return lines.join('\n');
}

function buildBuilderRows(state) {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('eb_title').setLabel('✏️ Title').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('eb_desc').setLabel('📝 Description').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('eb_color').setLabel('🎨 Color').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('eb_author').setLabel('👤 Author').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('eb_footer').setLabel('📋 Footer').setStyle(ButtonStyle.Secondary)
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('eb_image').setLabel('🖼️ Image').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('eb_thumbnail').setLabel('🖼️ Thumb').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('eb_field').setLabel('➕ Add Field').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('eb_timestamp').setLabel(`🕐 Timestamp: ${state.timestamp ? 'ON' : 'OFF'}`).setStyle(state.timestamp ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('eb_clear').setLabel('🗑️ Clear All').setStyle(ButtonStyle.Danger)
  );
  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('eb_preview').setLabel('👁️ Preview').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('eb_send').setLabel('📤 Send').setStyle(ButtonStyle.Success)
  );
  return [row1, row2, row3];
}

async function sendSavePrompt(interaction, embedData, embedId) {
  const saveRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`eb_save_${embedId}`).setLabel('Save Embed').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`eb_nosave_${embedId}`).setLabel('No thanks').setStyle(ButtonStyle.Secondary)
  );
  await interaction.followUp({
    content: `Embed sent! **ID: \`${embedId}\`**\nWanna save this embed for later?`,
    components: [saveRow],
    ephemeral: true
  }).catch(() => {});
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Create and manage embeds (mod only)')
    .addSubcommand(sub => sub.setName('builder').setDescription('Interactive embed builder with live preview'))
    .addSubcommand(sub =>
      sub.setName('template')
        .setDescription('Use a pre-made template')
        .addStringOption(opt => opt.setName('type').setDescription('Template type').setRequired(true)
          .addChoices(
            { name: 'Welcome', value: 'welcome' },
            { name: 'Goodbye', value: 'goodbye' },
            { name: 'Announcement', value: 'announcement' }
          ))
        .addStringOption(opt => opt.setName('title').setDescription('Title').setRequired(true))
        .addStringOption(opt => opt.setName('description').setDescription('Description').setRequired(true))
        .addStringOption(opt => opt.setName('color').setDescription('Color name or hex').setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName('advanced')
        .setDescription('Send custom embed via key:value lines')
        .addStringOption(opt => opt.setName('code').setDescription('Paste key:value lines').setRequired(true))
    )
    .addSubcommand(sub => sub.setName('advanced-paste').setDescription('Get copyable template'))
    .addSubcommand(sub =>
      sub.setName('system')
        .setDescription('Use pre-made system embeds')
        .addStringOption(opt => opt.setName('type').setDescription('Choose system embed').setRequired(true)
          .addChoices(
            { name: 'Welcome Message', value: 'welcome' },
            { name: 'Goodbye Message', value: 'goodbye' },
            { name: 'Log Join', value: 'log-join' },
            { name: 'Log Leave', value: 'log-leave' },
            { name: 'Announcement', value: 'announcement' },
            { name: 'Rule Reminder', value: 'rule' },
            { name: 'Event Announcement', value: 'event' },
            { name: 'Mod Alert', value: 'mod-alert' },
            { name: 'Status Update', value: 'status' },
            { name: 'Fun Message', value: 'fun' }
          ))
    )
    .addSubcommand(sub =>
      sub.setName('save')
        .setDescription('Save a custom embed by name')
        .addStringOption(opt => opt.setName('name').setDescription('Name for this embed').setRequired(true))
        .addStringOption(opt => opt.setName('code').setDescription('Paste key:value lines').setRequired(true))
    )
    .addSubcommand(sub => sub.setName('view').setDescription('View your saved embeds'))
    .addSubcommand(sub => sub.setName('send').setDescription('Send a saved embed'))
    .addSubcommand(sub =>
      sub.setName('delete')
        .setDescription('Delete a saved embed by name or ID')
        .addStringOption(opt => opt.setName('query').setDescription('Embed name or ID (e.g. EM-AB12)').setRequired(true))
    ),

  async execute(interaction, client) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return interaction.reply({ content: '❌ Mods only.', ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    const guildId = interaction.guild.id;
    const storageKey = `embeds_${guildId}_${userId}`;
    let savedEmbeds = client.memory.get(storageKey) || {};

    // ── BUILDER ────────────────────────────────────────────
    if (sub === 'builder') {
      await interaction.deferReply({ ephemeral: true });

      let state = {
        title: null, description: null, color: COLORS.default,
        colorName: 'default', footer: null, image: null,
        thumbnail: null, author: null, timestamp: false, fields: []
      };

      const controlEmbed = new EmbedBuilder()
        .setColor(0x2f3136)
        .setTitle('🛠️ Embed Builder')
        .setDescription(buildStatusText(state))
        .setFooter({ text: 'Use the buttons below to build your embed' });

      await interaction.editReply({ embeds: [controlEmbed], components: buildBuilderRows(state) });
      const builderMsg = await interaction.fetchReply();

      const collector = builderMsg.createMessageComponentCollector({ time: 300000 });

      collector.on('collect', async btn => {
        if (btn.user.id !== userId) return btn.reply({ content: '❌ Not your builder!', ephemeral: true }).catch(() => {});

        // ── TIMESTAMP TOGGLE ──────────────────────────────
        if (btn.customId === 'eb_timestamp') {
          try { await btn.deferUpdate(); } catch (e) { return; }
          state.timestamp = !state.timestamp;
          const updated = new EmbedBuilder().setColor(0x2f3136).setTitle('🛠️ Embed Builder').setDescription(buildStatusText(state)).setFooter({ text: 'Use the buttons below to build your embed' });
          await builderMsg.edit({ embeds: [updated], components: buildBuilderRows(state) }).catch(() => {});
          return;
        }

        // ── CLEAR ─────────────────────────────────────────
        if (btn.customId === 'eb_clear') {
          try { await btn.deferUpdate(); } catch (e) { return; }
          state = { title: null, description: null, color: COLORS.default, colorName: 'default', footer: null, image: null, thumbnail: null, author: null, timestamp: false, fields: [] };
          const updated = new EmbedBuilder().setColor(0x2f3136).setTitle('🛠️ Embed Builder').setDescription(buildStatusText(state)).setFooter({ text: 'Cleared! Start fresh.' });
          await builderMsg.edit({ embeds: [updated], components: buildBuilderRows(state) }).catch(() => {});
          return;
        }

        // ── PREVIEW ───────────────────────────────────────
        if (btn.customId === 'eb_preview') {
          try { await btn.deferUpdate(); } catch (e) { return; }
          const preview = buildLiveEmbed(state);
          await btn.followUp({ content: '👁️ **Preview** (only you can see this):', embeds: [preview], ephemeral: true }).catch(() => {});
          return;
        }

        // ── SEND ──────────────────────────────────────────
        if (btn.customId === 'eb_send') {
          try { await btn.deferUpdate(); } catch (e) { return; }
          const finalEmbed = buildLiveEmbed(state);
          const embedId = generateEmbedId();
          try {
            await interaction.channel.send({ embeds: [finalEmbed] });
            await sendSavePrompt(btn, { state, embedId }, embedId);

            // Handle save button
            const saveCollector = builderMsg.createMessageComponentCollector({ time: 60000, max: 1, filter: b => b.customId.startsWith(`eb_save_${embedId}`) || b.customId === `eb_nosave_${embedId}` });
            saveCollector.on('collect', async savBtn => {
              try { await savBtn.deferUpdate(); } catch (e) { return; }
              if (savBtn.customId === `eb_save_${embedId}`) {
                const nameModal = new ModalBuilder().setCustomId(`eb_savename_${embedId}`).setTitle('Save Embed');
                const nameInput = new TextInputBuilder().setCustomId('embed_save_name').setLabel('Name for this embed').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(50);
                nameModal.addComponents(new ActionRowBuilder().addComponents(nameInput));
                await savBtn.showModal(nameModal).catch(() => {});

                const modalCollector = interaction.channel.createMessageComponentCollector({ time: 30000 });
                interaction.awaitModalSubmit({ filter: m => m.customId === `eb_savename_${embedId}` && m.user.id === userId, time: 30000 })
                  .then(async modal => {
                    await modal.deferReply({ ephemeral: true });
                    const name = modal.fields.getTextInputValue('embed_save_name');
                    savedEmbeds = client.memory.get(storageKey) || {};
                    savedEmbeds[embedId] = { id: embedId, name, state, createdAt: Date.now() };
                    client.memory.set(storageKey, savedEmbeds);
                    await modal.editReply({ content: `✅ Embed saved as **${name}** (ID: \`${embedId}\`)!`, ephemeral: true });
                  }).catch(() => {});
              }
            });
          } catch (err) {
            await btn.followUp({ content: `❌ Failed to send: ${err.message.slice(0, 100)}`, ephemeral: true }).catch(() => {});
          }
          return;
        }

        // ── MODALS ────────────────────────────────────────
        const modalMap = {
          eb_title: {
            id: 'ebm_title', title: 'Set Title',
            fields: [{ id: 'val', label: 'Title', style: TextInputStyle.Short, max: 256 }]
          },
          eb_desc: {
            id: 'ebm_desc', title: 'Set Description',
            fields: [{ id: 'val', label: 'Description', style: TextInputStyle.Paragraph, max: 4096 }]
          },
          eb_color: {
            id: 'ebm_color', title: 'Set Color',
            fields: [{ id: 'val', label: 'Color (name or hex like #7289da)', style: TextInputStyle.Short, max: 20, placeholder: 'blue, red, green, purple, gold, or #hex' }]
          },
          eb_author: {
            id: 'ebm_author', title: 'Set Author',
            fields: [{ id: 'val', label: 'Author Name', style: TextInputStyle.Short, max: 256 }]
          },
          eb_footer: {
            id: 'ebm_footer', title: 'Set Footer',
            fields: [{ id: 'val', label: 'Footer Text', style: TextInputStyle.Short, max: 2048 }]
          },
          eb_image: {
            id: 'ebm_image', title: 'Set Image URL',
            fields: [{ id: 'val', label: 'Image URL (must start with https)', style: TextInputStyle.Short, max: 500 }]
          },
          eb_thumbnail: {
            id: 'ebm_thumbnail', title: 'Set Thumbnail URL',
            fields: [{ id: 'val', label: 'Thumbnail URL (must start with https)', style: TextInputStyle.Short, max: 500 }]
          },
          eb_field: {
            id: 'ebm_field', title: 'Add Field',
            fields: [
              { id: 'fname', label: 'Field Name', style: TextInputStyle.Short, max: 256 },
              { id: 'fvalue', label: 'Field Value', style: TextInputStyle.Paragraph, max: 1024 }
            ]
          },
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

        const updated = new EmbedBuilder().setColor(state.color || COLORS.default).setTitle('🛠️ Embed Builder').setDescription(buildStatusText(state)).setFooter({ text: 'Use the buttons below to build your embed' });
        await builderMsg.edit({ embeds: [updated], components: buildBuilderRows(state) }).catch(() => {});
      });

      collector.on('end', () => { builderMsg.edit({ components: [] }).catch(() => {}); });
      return;
    }

    // ── TEMPLATE ───────────────────────────────────────────
    if (sub === 'template') {
      await interaction.deferReply({ ephemeral: true });
      const type = interaction.options.getString('type');
      const title = interaction.options.getString('title');
      const desc = interaction.options.getString('description');
      const colorVal = interaction.options.getString('color') || 'default';
      const color = parseColor(colorVal);
      const embedId = generateEmbedId();

      const embed = new EmbedBuilder().setColor(color).setTitle(title).setDescription(desc).setFooter({ text: 'Chrxmee AI' }).setTimestamp();
      if (type === 'welcome') embed.setAuthor({ name: 'Welcome!', iconURL: interaction.guild?.iconURL() || interaction.client.user.displayAvatarURL() });
      if (type === 'goodbye') embed.setAuthor({ name: 'Goodbye :(', iconURL: interaction.guild?.iconURL() || interaction.client.user.displayAvatarURL() });
      if (type === 'announcement') embed.setAuthor({ name: 'Announcement!', iconURL: interaction.client.user.displayAvatarURL() });

      await interaction.channel.send({ embeds: [embed] });

      const state = { title, description: desc, color, colorName: colorVal, footer: 'Chrxmee AI', timestamp: true, author: type, fields: [] };
      savedEmbeds[embedId] = { id: embedId, name: `${type}-${embedId}`, state, createdAt: Date.now() };
      client.memory.set(storageKey, savedEmbeds);

      const saveRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`eb_save_${embedId}`).setLabel('💾 Save Embed').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`eb_nosave_${embedId}`).setLabel('No thanks').setStyle(ButtonStyle.Secondary)
      );
      await interaction.editReply({ content: `✅ Template sent! **ID: \`${embedId}\`**\nWant to save this embed?`, components: [saveRow] });

      const msg = await interaction.fetchReply();
      const saveCollector = msg.createMessageComponentCollector({ time: 30000, max: 1 });
      saveCollector.on('collect', async btn => {
        try { await btn.deferUpdate(); } catch (e) { return; }
        if (btn.customId === `eb_save_${embedId}`) {
          await interaction.editReply({ content: `✅ Embed saved! Name: **${type}-${embedId}** | ID: \`${embedId}\`\nUse \`/embed send\` to use it later.`, components: [] });
        } else {
          delete savedEmbeds[embedId];
          client.memory.set(storageKey, savedEmbeds);
          await interaction.editReply({ content: `✅ Template sent! ID: \`${embedId}\``, components: [] });
        }
      });
      saveCollector.on('end', () => { interaction.editReply({ components: [] }).catch(() => {}); });
      return;
    }

    // ── ADVANCED ───────────────────────────────────────────
    if (sub === 'advanced') {
      await interaction.deferReply({ ephemeral: true });
      const code = interaction.options.getString('code').trim();
      const embedId = generateEmbedId();
      const embed = new EmbedBuilder();
      const state = { fields: [], timestamp: false };

      const lines = code.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('//'));
      for (const line of lines) {
        if (!line.includes(':')) continue;
        const [keyRaw, ...valueParts] = line.split(':');
        const key = keyRaw.trim().toLowerCase();
        const value = valueParts.join(':').trim();
        if (key === 'title') { embed.setTitle(value); state.title = value; }
        if (key === 'desc' || key === 'description') { embed.setDescription(value); state.description = value; }
        if (key === 'color') { const c = parseColor(value); embed.setColor(c); state.color = c; state.colorName = value; }
        if (key === 'footer') { embed.setFooter({ text: value }); state.footer = value; }
        if (key === 'image' && value.startsWith('http')) { embed.setImage(value); state.image = value; }
        if (key === 'thumbnail' && value.startsWith('http')) { embed.setThumbnail(value); state.thumbnail = value; }
        if (key === 'author') { embed.setAuthor({ name: value }); state.author = value; }
      }

      try {
        await interaction.channel.send({ embeds: [embed] });
        savedEmbeds[embedId] = { id: embedId, name: `advanced-${embedId}`, state, createdAt: Date.now() };
        client.memory.set(storageKey, savedEmbeds);

        const saveRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`eb_save_${embedId}`).setLabel('💾 Save Embed').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId(`eb_nosave_${embedId}`).setLabel('No thanks').setStyle(ButtonStyle.Secondary)
        );
        await interaction.editReply({ content: `✅ Advanced embed sent! **ID: \`${embedId}\`**\nWant to save it?`, components: [saveRow] });

        const msg = await interaction.fetchReply();
        const saveCollector = msg.createMessageComponentCollector({ time: 30000, max: 1 });
        saveCollector.on('collect', async btn => {
          try { await btn.deferUpdate(); } catch (e) { return; }
          if (btn.customId === `eb_nosave_${embedId}`) {
            delete savedEmbeds[embedId];
            client.memory.set(storageKey, savedEmbeds);
            await interaction.editReply({ content: `✅ Embed sent! ID: \`${embedId}\``, components: [] });
          } else {
            await interaction.editReply({ content: `✅ Saved as **advanced-${embedId}** | ID: \`${embedId}\``, components: [] });
          }
        });
        saveCollector.on('end', () => { interaction.editReply({ components: [] }).catch(() => {}); });
      } catch (err) {
        await interaction.editReply({ content: `❌ Send failed: ${err.message.slice(0, 100)}` });
      }
      return;
    }

    // ── ADVANCED-PASTE ─────────────────────────────────────
    if (sub === 'advanced-paste') {
      await interaction.deferReply({ ephemeral: true });
      const template = `title: Welcome!\ndesc: Hey everyone! Glad you're here.\ncolor: #7289da\nfooter: Chrxmee AI\nauthor: Server Name\nimage: https://example.com/image.png\nthumbnail: https://example.com/thumb.png\n// Paste into /embed advanced code:\n// Remove lines you don't need`.trim();
      return interaction.editReply({ content: `\`\`\`\n${template}\n\`\`\``, ephemeral: true });
    }

    // ── SYSTEM ─────────────────────────────────────────────
    if (sub === 'system') {
      await interaction.deferReply({ ephemeral: true });
      const type = interaction.options.getString('type');
      const embedId = generateEmbedId();
      const systems = {
        'welcome': new EmbedBuilder().setColor(0x00ff00).setTitle('👋 Welcome!').setDescription('Welcome to the server! Please read the rules and enjoy your stay.').setTimestamp(),
        'goodbye': new EmbedBuilder().setColor(0xff0000).setTitle('👋 Goodbye!').setDescription('A member has left the server. We\'ll miss you!').setTimestamp(),
        'log-join': new EmbedBuilder().setColor(0x00ff00).setTitle('📥 Member Joined').setDescription('A new member has joined the server.').setTimestamp(),
        'log-leave': new EmbedBuilder().setColor(0xff0000).setTitle('📤 Member Left').setDescription('A member has left the server.').setTimestamp(),
        'announcement': new EmbedBuilder().setColor(0xf1c40f).setTitle('📢 Announcement').setDescription('Important announcement from the staff team.').setTimestamp(),
        'rule': new EmbedBuilder().setColor(0x7289da).setTitle('📋 Rule Reminder').setDescription('Please remember to follow the server rules at all times.').setTimestamp(),
        'event': new EmbedBuilder().setColor(0xe67e22).setTitle('🎉 Event Announcement').setDescription('An exciting event is coming up! Stay tuned for more details.').setTimestamp(),
        'mod-alert': new EmbedBuilder().setColor(0xff0000).setTitle('🚨 Mod Alert').setDescription('Attention moderators — please check the mod channel.').setTimestamp(),
        'status': new EmbedBuilder().setColor(0x9b59b6).setTitle('📊 Status Update').setDescription('Here is a status update from the team.').setTimestamp(),
        'fun': new EmbedBuilder().setColor(0xff69b4).setTitle('🎊 Fun Time!').setDescription('Let\'s have some fun! Check out what\'s going on.').setTimestamp(),
      };
      const embed = systems[type];
      if (!embed) return interaction.editReply({ content: '❌ Unknown system embed type.' });
      await interaction.channel.send({ embeds: [embed] });
      return interaction.editReply({ content: `✅ System embed sent! **ID: \`${embedId}\`**` });
    }

    // ── SAVE ───────────────────────────────────────────────
    if (sub === 'save') {
      await interaction.deferReply({ ephemeral: true });
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
      return interaction.editReply({ content: `✅ Embed **${name}** saved! ID: \`${embedId}\`\nUse \`/embed send\` to send it.` });
    }

    // ── VIEW ───────────────────────────────────────────────
    if (sub === 'view') {
      await interaction.deferReply({ ephemeral: true });
      const embeds = Object.values(savedEmbeds);
      if (embeds.length === 0) return interaction.editReply({ content: '📋 No saved embeds. Use `/embed save` or `/embed builder` to create some!' });
      const lines = embeds.map(e => `**${e.name}** — ID: \`${e.id}\` — *saved ${new Date(e.createdAt).toLocaleDateString()}*`);
      return interaction.editReply({ content: `📋 **Your Saved Embeds (${embeds.length}):**\n${lines.join('\n')}\n\nUse \`/embed send\` to send one, or \`/embed delete\` to remove one.` });
    }

    // ── SEND ───────────────────────────────────────────────
    if (sub === 'send') {
      await interaction.deferReply({ ephemeral: true });
      const embeds = Object.values(savedEmbeds);
      if (embeds.length === 0) return interaction.editReply({ content: 'No saved embeds! Use `/embed builder` or `/embed save` first.' });

      const options = embeds.slice(0, 25).map(e =>
        new StringSelectMenuOptionBuilder().setLabel(e.name).setValue(e.id).setDescription(`ID: ${e.id}`)
      );
      const menu = new StringSelectMenuBuilder().setCustomId('eb_send_select').setPlaceholder('Choose an embed to send...').addOptions(options);
      const row = new ActionRowBuilder().addComponents(menu);

      await interaction.editReply({ content: 'Select an embed to send:', components: [row] });
      const msg = await interaction.fetchReply();
      const collector = msg.createMessageComponentCollector({ time: 30000, max: 1 });

      collector.on('collect', async sel => {
        try { await sel.deferUpdate(); } catch (e) { return; }
        const chosen = savedEmbeds[sel.values[0]];
        if (!chosen) return sel.followUp({ content: '❌ Embed not found!', ephemeral: true }).catch(() => {});
        const embed = buildLiveEmbed(chosen.state);
        await interaction.channel.send({ embeds: [embed] });
        await interaction.editReply({ content: `✅ Embed **${chosen.name}** sent! ID: \`${chosen.id}\``, components: [] });
      });

      collector.on('end', () => { interaction.editReply({ components: [] }).catch(() => {}); });
      return;
    }

    // ── DELETE ─────────────────────────────────────────────
    if (sub === 'delete') {
      await interaction.deferReply({ ephemeral: true });
      const query = interaction.options.getString('query').trim();
      const found = Object.values(savedEmbeds).find(e => e.id === query.toUpperCase() || e.name.toLowerCase() === query.toLowerCase());
      if (!found) return interaction.editReply({ content: `❌ No embed found with name or ID **${query}**.` });
      delete savedEmbeds[found.id];
      client.memory.set(storageKey, savedEmbeds);
      return interaction.editReply({ content: `✅ Embed **${found.name}** (ID: \`${found.id}\`) deleted!` });
    }
  }
};
