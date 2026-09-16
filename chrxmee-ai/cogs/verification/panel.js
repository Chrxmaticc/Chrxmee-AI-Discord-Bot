/* cogs/verification/panel.js — panel post/edit/delete/preview */

const {
  ContainerBuilder,
  TextDisplayBuilder,
  SectionBuilder,
  ThumbnailBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require('discord.js');

const config = require('./config');
const store = require('./store');

function buildPanel(cfg, guild) {
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

  /* status line */
  const methods = (cfg.methods || []).map(m => `\`${m}\``).join(' · ');
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# methods: ${methods || 'none'}`));

  /* verify button */
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('verify_start')
      .setLabel(cfg.panelButtonLabel || 'verify')
      .setStyle(ButtonStyle.Primary)
  );
  c.addActionRowComponents(row);

  return c;
}

async function post(client, guildId, channelId) {
  const cfg = config.get(guildId);
  const ch = client.channels.cache.get(channelId);
  if (!ch) return null;

  const container = buildPanel(cfg, ch.guild);
  const msg = await ch.send({ components: [container], flags: MessageFlags.IsComponentsV2 });

  config.set(guildId, { panelChannel: channelId, panelMessage: msg.id });
  return msg;
}

async function edit(client, guildId) {
  const cfg = config.get(guildId);
  if (!cfg.panelChannel || !cfg.panelMessage) return false;
  const ch = client.channels.cache.get(cfg.panelChannel);
  if (!ch) return false;
  const msg = await ch.messages.fetch(cfg.panelMessage).catch(() => null);
  if (!msg) return false;
  const container = buildPanel(cfg, ch.guild);
  await msg.edit({ components: [container], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
  return true;
}

async function remove(client, guildId) {
  const cfg = config.get(guildId);
  if (!cfg.panelChannel || !cfg.panelMessage) return false;
  const ch = client.channels.cache.get(cfg.panelChannel);
  if (!ch) return false;
  const msg = await ch.messages.fetch(cfg.panelMessage).catch(() => null);
  if (msg) await msg.delete().catch(() => {});
  config.set(guildId, { panelChannel: null, panelMessage: null });
  return true;
}

function buildPreview(cfg) {
  return buildPanel(cfg);
}

module.exports = { post, edit, remove, buildPreview, buildPanel };
