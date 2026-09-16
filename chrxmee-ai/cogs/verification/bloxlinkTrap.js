/* cogs/verification/bloxlinkTrap.js — detects bloxlink role adds, forces chromed verify */

const { PermissionFlagsBits } = require('discord.js');
const config = require('./config');
const store = require('./store');
const log = require('./log');

/* throttle: `${guildId}:${userId}` -> { lastStrippedAt, stripCount } */
const throttle = new Map();
const STRIP_WINDOW_MS = 5000;
const MAX_STRIPS = 3;

async function detect(member, addedRole) {
  const guildId = member.guild.id;
  const cfg = config.get(guildId);
  if (!cfg.enabled || !cfg.bloxlinkTrap || !cfg.roleBloxlink) return;
  if (addedRole.id !== cfg.roleBloxlink) return;

  const userId = member.id;
  const user = store.getUser(guildId, userId);

  /* don't re-trap users who already passed chromed verify and remembered */
  if (store.isVerifiedRemembered(guildId, userId)) return;

  user.bloxlinkDetected = true;

  /* post-verify strip takes priority */
  if (user.status === 'verified' && cfg.bloxlinkStripOnVerify) {
    await member.roles.remove(cfg.roleBloxlink).catch(() => {});
    return;
  }

  /* ensure unverified overlay */
  if (cfg.roleUnverified && !member.roles.cache.has(cfg.roleUnverified)) {
    await member.roles.add(cfg.roleUnverified).catch(() => {});
  }

  /* optional strip-on-detect with throttle */
  if (cfg.bloxlinkStripOnDetect) {
    const key = `${guildId}:${userId}`;
    const t = throttle.get(key) || { lastStrippedAt: 0, stripCount: 0 };
    if (Date.now() - t.lastStrippedAt < STRIP_WINDOW_MS) {
      t.stripCount++;
      if (t.stripCount >= MAX_STRIPS) {
        throttle.delete(key);
        await log.log(member.client, guildId, {
          icon: "<:no:1530373946795364362>",
          color: 0xffa500,
          title: 'bloxlink loop detected',
          body: `<@${userId}> — chromed stopped stripping bloxlink role after ${MAX_STRIPS} attempts. manual review recommended.`,
        });
        return;
      }
    } else {
      t.stripCount = 1;
    }
    t.lastStrippedAt = Date.now();
    throttle.set(key, t);

    const canManage = member.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles);
    if (canManage) {
      await member.roles.remove(cfg.roleBloxlink).catch(() => {});
    }
  }

  /* autodm */
  if (cfg.bloxlinkAutoDm) {
    const msg = (cfg.dmBloxlinkDetected || 'finish verification with chromed')
      .replace(/\{server\}/g, member.guild.name)
      .replace(/\{channel\}/g, cfg.panelChannel ? `<#${cfg.panelChannel}>` : '');
    await member.send({ content: msg }).catch(() => {});
  }

  await log.log(member.client, guildId, {
    icon: "<:agreed:1525639597135237131>",
    color: 0xf5c34a,
    title: 'bloxlink detected',
    body: `<@${userId}> has bloxlink role → forced through chromed verification`,
    footer: `strip-on-detect: ${cfg.bloxlinkStripOnDetect ? 'on' : 'off'}`,
  });
}

module.exports = { detect };
