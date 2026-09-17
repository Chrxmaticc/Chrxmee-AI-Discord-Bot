/* cogs/verification/log.js — verification logging */

const { ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const config = require('./config');
const store = require('./store');

const E = {
  success:  "<:Verified_Icon:1527194184841167010>",
  error:    "<:no:1530373946795364362>",
  on:       "<:on:1545571641684135946>",
  off:      "<:off:1545571608897265726>",
};

async function log(client, guildId, payload) {
  const cfg = config.get(guildId);
  if (!cfg.logChannel) return;
  const ch = client.channels.cache.get(cfg.logChannel);
  if (!ch) return;

  const c = new ContainerBuilder();
  c.setAccentColor(payload.color ?? 0x5b7fd4);
  c.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`${payload.icon || E.on} **${payload.title}**`)
  );
  if (payload.body) {
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(payload.body));
  }
  if (payload.footer) {
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${payload.footer}`));
  }

  await ch.send({ components: [c], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
}

async function logAttempt(client, guildId, userId, method, result, reason) {
  const cfg = config.get(guildId);
  if (!cfg.logAttempts) return;
  store.recordAttempt(guildId, userId, method, result, reason);

  const icon = result === 'success' ? E.success : E.error;
  const color = result === 'success' ? 0x57f287 : 0xff3b3b;
  await log(client, guildId, {
    icon,
    color,
    title: `verify · ${result}`,
    body: `<@${userId}> · method \`${method}\`${reason ? ` · \`${reason}\`` : ''}`,
    footer: new Date().toUTCString(),
  });
}

module.exports = { log, logAttempt };
