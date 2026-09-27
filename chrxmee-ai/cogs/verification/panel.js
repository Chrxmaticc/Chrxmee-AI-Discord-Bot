/* cogs/verification/panel.js */

const {
  ContainerBuilder, TextDisplayBuilder, SectionBuilder, ThumbnailBuilder,
  MediaGalleryBuilder, MediaGalleryItemBuilder, SeparatorBuilder, SeparatorSpacingSize,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags,
} = require('discord.js');

const config = require('./config');
const store = require('./store');

/* buildPreview + buildPanel are pure — take cfg as arg, no async needed */
function buildPanel(cfg) {
  const c = new ContainerBuilder().setAccentColor(cfg.panelButtonColor || 0x5b7fd4);

  if (cfg.panelTitle) {
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${cfg.panelTitle}`));
  }

  if (cfg.panelImage && cfg.panelDescription) {
    c.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(cfg.panelDescription))
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(cfg.panelImage))
    );
  } else if (cfg.panelDescription) {
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(cfg.panelDescription));
  } else if (cfg.panelImage) {
    c.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(cfg.panelImage))
    );
  }

  c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));

  const methods = (cfg.methods || []).map(m => `\`${m}\``).join(' · ');
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# methods: ${methods || 'none'}`));

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('verify_start')
      .setLabel(cfg.panelButtonLabel || 'verify')
      .setStyle(ButtonStyle.Primary)
  );
  c.addActionRowComponents(row);

  return c;
}

function buildPreview(cfg) {
  return buildPanel(cfg);
}

async function post(client, guildId, channelId) {
  const cfg = await config.get(guildId);
  const ch = client.channels.cache.get(channelId);
  if (!ch) return null;

  const container = buildPanel(cfg);
  const msg = await ch.send({ components: [container], flags: MessageFlags.IsComponentsV2 });
  await config.set(guildId, { panelChannel: channelId, panelMessage: msg.id });
  return msg;
}

async function edit(client, guildId) {
  const cfg = await config.get(guildId);
  if (!cfg.panelChannel || !cfg.panelMessage) return false;
  const ch = client.channels.cache.get(cfg.panelChannel);
  if (!ch) return false;
  const msg = await ch.messages.fetch(cfg.panelMessage).catch(() => null);
  if (!msg) return false;
  const container = buildPanel(cfg);
  await msg.edit({ components: [container], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
  return true;
}

async function remove(client, guildId) {
  const cfg = await config.get(guildId);
  if (!cfg.panelChannel || !cfg.panelMessage) return false;
  const ch = client.channels.cache.get(cfg.panelChannel);
  if (!ch) return false;
  const msg = await ch.messages.fetch(cfg.panelMessage).catch(() => null);
  if (msg) await msg.delete().catch(() => {});
  await config.set(guildId, { panelChannel: null, panelMessage: null });
  return true;
}

module.exports = { post, edit, remove, buildPreview, buildPanel };
