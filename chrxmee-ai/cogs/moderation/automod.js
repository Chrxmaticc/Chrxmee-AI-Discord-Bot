/* cogs/moderation/automod.js — message filters */

const store = require('./store');

const spamBucket = new Map();  // `${guildId}:${userId}` -> [{ content, at }]

function checkCaps(content, minLength, percent) {
  if (content.length < minLength) return false;
  const letters = content.replace(/[^a-zA-Z]/g, '');
  if (letters.length < minLength) return false;
  const caps = letters.replace(/[^A-Z]/g, '').length;
  return (caps / letters.length) * 100 >= percent;
}

function checkMentions(message, cap) {
  const total = message.mentions.users.size + message.mentions.roles.size;
  return total >= cap;
}

function checkInvite(content) {
  return /(discord\.(gg|io|me|li)|discordapp\.com\/invite)\/[a-zA-Z0-9]+/i.test(content);
}

function checkLinks(content, whitelist) {
  const urls = content.match(/https?:\/\/[^\s]+/gi) || [];
  if (!urls.length) return null;
  for (const url of urls) {
    try {
      const host = new URL(url).hostname.replace(/^www\./, '');
      if (!whitelist.some(w => host === w || host.endsWith('.' + w))) return url;
    } catch {}
  }
  return null;
}

function checkZalgo(content) {
  const combining = content.match(/[\u0300-\u036f\u1ab0-\u1aff\u1dc0-\u1dff\u20d0-\u20ff\ufe20-\ufe2f]/g);
  return combining && combining.length > 10;
}

function checkEmojiSpam(content) {
  const emojis = content.match(/<a?:[a-zA-Z0-9_]+:\d+>/g) || [];
  return emojis.length > 8;
}

function checkSpam(guildId, userId, content, count, windowSec) {
  const key = `${guildId}:${userId}`;
  const now = Date.now();
  const arr = (spamBucket.get(key) || []).filter(e => now - e.at < windowSec * 1000);
  arr.push({ content, at: now });
  spamBucket.set(key, arr);
  if (arr.length < count) return false;
  /* check for duplicates */
  const last = arr.slice(-count);
  return last.every(e => e.content === content);
}

async function process(message) {
  const config = store.getConfig(message.guild.id);
  if (!config.automodEnabled) return null;
  if (!message.guild || !message.member) return null;
  if (message.author.bot) return null;

  /* immunity */
  if (config.automodIgnoreRoles.some(r => message.member.roles.cache.has(r))) return null;
  if (config.automodIgnoreChannels.includes(message.channel.id)) return null;

  const rules = new Set(config.automodRules || []);
  const content = message.content || '';
  const reason = [];

  if (rules.has('mention_cap') && checkMentions(message, config.automodMentionCap)) reason.push('mass mentions');
  if (rules.has('caps') && checkCaps(content, config.automodCapsMinLength, config.automodCapsPercent)) reason.push('excessive caps');
  if (rules.has('spam') && checkSpam(message.guild.id, message.author.id, content, config.automodSpamCount, config.automodSpamWindow)) reason.push('spam');
  if (rules.has('invite') && checkInvite(content)) reason.push('invite link');
  if (rules.has('links')) {
    const bad = checkLinks(content, config.automodWhitelistDomains);
    if (bad) reason.push(`external link \`${bad.slice(0, 60)}\``);
  }
  if (rules.has('zalgo') && checkZalgo(content)) reason.push('zalgo');
  if (rules.has('emoji_spam') && checkEmojiSpam(content)) reason.push('emoji spam');

  if (!reason.length) return null;
  return { reasons: reason };
}

module.exports = { process };
