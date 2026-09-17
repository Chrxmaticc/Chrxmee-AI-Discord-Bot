/* cogs/automation/engine.js */
const store = require('./store');

const recentFires = new Map();
const guildRate = new Map();
const GUILD_RATE_PER_MIN = 200;
const MAX_CHAIN_DEPTH = 3;
const MAX_ACTIONS = 12;
const MAX_WAIT_TOTAL = 60000;

function resolveVars(str, ctx) {
  if (!str) return '';
  return String(str).replace(/\{([^}]+)\}/g, (_, raw) => {
    const k = raw.trim().toLowerCase();
    if (k === 'user')         return ctx.user ? `<@${ctx.user.id}>` : '';
    if (k === 'user.name')    return ctx.user?.username ?? '';
    if (k === 'user.id')      return ctx.user?.id ?? '';
    if (k === 'user.tag')     return ctx.user?.tag ?? '';
    if (k === 'server')       return ctx.guild?.name ?? '';
    if (k === 'server.count') return String(ctx.guild?.memberCount ?? '');
    if (k === 'channel')      return ctx.channel ? `<#${ctx.channel.id}>` : '';
    if (k === 'channel.name') return ctx.channel?.name ?? '';
    if (k === 'message')      return ctx.message?.content ?? '';
    if (k === 'now')          return new Date().toISOString();
    if (k === 'emoji')        return ctx.reaction?.emoji?.toString() ?? '';
    if (k === 'role')         return ctx.role ? `<@&${ctx.role.id}>` : '';
    const rnd = k.match(/^random\.(\d+)-(\d+)$/);
    if (rnd) return String(Math.floor(Math.random() * (parseInt(rnd[2], 10) - parseInt(rnd[1], 10) + 1)) + parseInt(rnd[1], 10));
    return raw;
  });
}

function checkGuildRate(guildId) {
  const now = Date.now();
  let bucket = guildRate.get(guildId);
  if (!bucket || now > bucket.resetAt) { bucket = { count: 0, resetAt: now + 60000 }; guildRate.set(guildId, bucket); }
  if (bucket.count >= GUILD_RATE_PER_MIN) return false;
  bucket.count++;
  return true;
}

function matchesTrigger(trigger, ctx) {
  if (!trigger?.type) return false;
  const t = trigger.type;
  if (t === 'message') {
    if (!ctx.message) return false;
    const content = (ctx.message.content || '').toLowerCase();
    const kw = (trigger.keyword || '').toLowerCase();
    if (!kw) return false;
    switch (trigger.matchMode) {
      case 'exact':  return content === kw;
      case 'starts': return content.startsWith(kw);
      case 'ends':   return content.endsWith(kw);
      case 'regex':  try { return new RegExp(trigger.keyword, 'i').test(ctx.message.content || ''); } catch { return false; }
      default:       return content.includes(kw);
    }
  }
  if (t === 'member_join')     return ctx.eventType === 'member_join';
  if (t === 'member_leave')    return ctx.eventType === 'member_leave';
  if (t === 'voice_join')      return ctx.eventType === 'voice_join';
  if (t === 'voice_leave')     return ctx.eventType === 'voice_leave';
  if (t === 'button_click')    return ctx.eventType === 'button_click' && (!trigger.customId || trigger.customId === ctx.customId);
  if (t === 'role_added')      return ctx.eventType === 'role_added'   && (!trigger.roleId || trigger.roleId === ctx.role?.id);
  if (t === 'role_removed')    return ctx.eventType === 'role_removed' && (!trigger.roleId || trigger.roleId === ctx.role?.id);
  if (t === 'reaction_add' || t === 'reaction_remove') {
    if (ctx.eventType !== t) return false;
    const want = trigger.emoji || '';
    const got = ctx.reaction?.emoji?.toString() || '';
    return !want || want === got;
  }
  return false;
}

function evaluate(cond, ctx) {
  if (!cond?.type) return true;
  const is = cond.op !== 'is not';
  switch (cond.type) {
    case 'channel':          return is ? ctx.channel?.id === cond.value : ctx.channel?.id !== cond.value;
    case 'category':         return is ? ctx.channel?.parentId === cond.value : ctx.channel?.parentId !== cond.value;
    case 'has_role':         { const h = ctx.member?.roles?.cache?.has(cond.value) === true; return is ? h : !h; }
    case 'has_any_role':     { const l = Array.isArray(cond.value) ? cond.value : [cond.value]; const h = l.some(id => ctx.member?.roles?.cache?.has(id)); return is ? h : !h; }
    case 'message_contains': { const c = (ctx.message?.content || '').toLowerCase(); const n = String(cond.value || '').toLowerCase(); return is ? c.includes(n) : !c.includes(n); }
    case 'message_length':   { const len = (ctx.message?.content || '').length; const t = Number(cond.value) || 0; return is ? len >= t : len < t; }
    case 'username_contains':{ const c = (ctx.user?.username || '').toLowerCase(); const n = String(cond.value || '').toLowerCase(); return is ? c.includes(n) : !c.includes(n); }
    case 'nickname_contains':{ const c = (ctx.member?.nickname || '').toLowerCase(); const n = String(cond.value || '').toLowerCase(); return is ? c.includes(n) : !c.includes(n); }
    case 'is_bot':           { const b = ctx.user?.bot === true; return is ? b : !b; }
    case 'is_booster':       { const b = ctx.member?.premiumSinceTimestamp != null; return is ? b : !b; }
    case 'has_attachment':   { const h = (ctx.message?.attachments?.size || 0) > 0; return is ? h : !h; }
    case 'account_age':      { const d = Math.floor((Date.now() - (ctx.user?.createdTimestamp || 0)) / 86400000); const t = Number(cond.value) || 0; return is ? d >= t : d < t; }
    case 'member_count':     { const n = ctx.guild?.memberCount || 0; const t = Number(cond.value) || 0; return is ? n >= t : n < t; }
    case 'user_id':          return is ? ctx.user?.id === cond.value : ctx.user?.id !== cond.value;
    case 'time_of_day':      { const [a, b] = String(cond.value || '').split('-').map(x => parseInt(x, 10)); if (!Number.isFinite(a) || !Number.isFinite(b)) return true; const h = new Date().getHours(); const bt = h >= a && h < b; return is ? bt : !bt; }
    case 'day_of_week':      { const days = Array.isArray(cond.value) ? cond.value : [cond.value]; const today = new Date().getDay(); const m = days.some(d => Number(d) === today); return is ? m : !m; }
    default: return true;
  }
}

function passes(flow, ctx) {
  const conds = flow.conditions || [];
  if (!conds.length) return true;
  const results = conds.map(c => evaluate(c, ctx));
  return flow.conditionMode === 'any' ? results.some(Boolean) : results.every(Boolean);
}

async function execAction(a, ctx, depth) {
  const guild = ctx.guild;
  switch (a.type) {
    case 'send_message': {
      const ch = guild.channels.cache.get(a.channelId);
      if (ch) await ch.send({ content: resolveVars(a.content, ctx) });
      return;
    }
    case 'reply_to_message': {
      if (ctx.message) await ctx.message.reply({ content: resolveVars(a.content, ctx) }).catch(() => {});
      return;
    }
    case 'send_dm': {
      if (ctx.user && ctx.user.id !== 'system') await ctx.user.send({ content: resolveVars(a.content, ctx) }).catch(() => {});
      return;
    }
    case 'dm_user': {
      const u = await guild.client.users.fetch(a.userId).catch(() => null);
      if (u) await u.send({ content: resolveVars(a.content, ctx) }).catch(() => {});
      return;
    }
    case 'dm_role_holders': {
      const role = guild.roles.cache.get(a.roleId);
      if (!role) return;
      let sent = 0;
      for (const [, m] of role.members) {
        if (m.user.bot) continue;
        if (sent >= 50) break;
        await m.send({ content: resolveVars(a.content, ctx) }).catch(() => {});
        sent++;
        await new Promise(r => setTimeout(r, 150));
      }
      return;
    }
    case 'add_role': {
      if (ctx.member && !ctx.member.roles.cache.has(a.roleId)) await ctx.member.roles.add(a.roleId).catch(() => {});
      return;
    }
    case 'remove_role': {
      if (ctx.member && ctx.member.roles.cache.has(a.roleId)) await ctx.member.roles.remove(a.roleId).catch(() => {});
      return;
    }
    case 'toggle_role': {
      if (!ctx.member) return;
      if (ctx.member.roles.cache.has(a.roleId)) await ctx.member.roles.remove(a.roleId).catch(() => {});
      else await ctx.member.roles.add(a.roleId).catch(() => {});
      return;
    }
    case 'delete_message': {
      if (ctx.message) await ctx.message.delete().catch(() => {});
      return;
    }
    case 'add_reaction': {
      if (ctx.message) await ctx.message.react(a.emoji || '⭐').catch(() => {});
      return;
    }
    case 'log_to_channel': {
      const ch = guild.channels.cache.get(a.channelId);
      if (ch) await ch.send({ content: resolveVars(a.content, ctx) });
      return;
    }
    case 'send_container': {
      const ch = guild.channels.cache.get(a.channelId);
      if (!ch) return;
      const { ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
      const c = new ContainerBuilder().setAccentColor(a.color || 0x5b7fd4);
      if (a.title) c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${resolveVars(a.title, ctx)}`));
      if (a.description) c.addTextDisplayComponents(new TextDisplayBuilder().setContent(resolveVars(a.description, ctx)));
      await ch.send({ components: [c], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
      return;
    }
    case 'send_embed': {
      const ch = guild.channels.cache.get(a.channelId);
      if (!ch) return;
      const { EmbedBuilder } = require('discord.js');
      const e = new EmbedBuilder().setColor(a.color || 0x5b7fd4);
      if (a.title) e.setTitle(resolveVars(a.title, ctx));
      if (a.description) e.setDescription(resolveVars(a.description, ctx));
      await ch.send({ embeds: [e] }).catch(() => {});
      return;
    }
    case 'webhook_post': {
      if (!a.url || !a.url.startsWith('https')) return;
      try {
        await fetch(a.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: resolveVars(a.content, ctx) }) });
      } catch {}
      return;
    }
    case 'timeout_user': {
      if (ctx.member && ctx.member.moderatable) await ctx.member.timeout((a.minutes || 10) * 60000, a.reason || 'automation').catch(() => {});
      return;
    }
    case 'kick_user': {
      if (ctx.member && ctx.member.kickable) await ctx.member.kick(a.reason || 'automation').catch(() => {});
      return;
    }
    case 'ban_user': {
      if (ctx.member && ctx.member.bannable) await ctx.member.ban({ reason: a.reason || 'automation' }).catch(() => {});
      return;
    }
    case 'pin_message': {
      if (ctx.message) await ctx.message.pin().catch(() => {});
      return;
    }
    case 'unpin_message': {
      if (ctx.message) await ctx.message.unpin().catch(() => {});
      return;
    }
    case 'set_nickname': {
      if (ctx.member && ctx.member.manageable) await ctx.member.setNickname(resolveVars(a.nickname || '', ctx).slice(0, 32)).catch(() => {});
      return;
    }
    case 'create_thread': {
      if (ctx.message) await ctx.message.startThread({ name: resolveVars(a.name || 'thread', ctx).slice(0, 90), autoArchiveDuration: 1440 }).catch(() => {});
      return;
    }
    case 'run_automation': {
      if (depth >= MAX_CHAIN_DEPTH) return;
      const all = await store.listForGuild(guild.id);
      const target = all.find(w => w.name.toLowerCase() === (a.name || '').toLowerCase() && w.enabled);
      if (!target) return;
      await runActions(target, ctx, depth + 1);
      return;
    }
    case 'wait': {
      const s = Math.max(1, Math.min(60, a.seconds || 3));
      await new Promise(r => setTimeout(r, s * 1000));
      return;
    }
  }
}

function onCooldown(flow, userId) {
  const key = `${flow.id}:${userId}`;
  const last = recentFires.get(key) || 0;
  if (Date.now() - last < (flow.cooldownSeconds ?? 5) * 1000) return true;
  recentFires.set(key, Date.now());
  return false;
}

async function run(triggerType, ctx) {
  if (!ctx.guild) return;
  if (!checkGuildRate(ctx.guild.id)) return;
  let flows;
  try { flows = await store.listEnabledFor(ctx.guild.id, triggerType); }
  catch (e) { console.error('[automation] store.listEnabledFor err:', e.message); return; }

  for (const flow of flows) {
    const userId = ctx.user?.id || 'system';
    try {
      if (!matchesTrigger(flow.trigger, ctx)) continue;
      if (!passes(flow, ctx)) continue;
      if (onCooldown(flow, userId)) continue;
      console.log(`[automation] firing #${flow.id} "${flow.name}" (${triggerType})`);
      await runActions(flow, ctx, 0);
      await store.recordFire(flow.id, { userId, ok: true });
    } catch (err) {
      console.error(`[automation] #${flow.id} errored:`, err.message);
      try { await store.bumpError(flow.id); } catch {}
      try { await store.recordFire(flow.id, { userId, ok: false, error: err.message }); } catch {}
    }
  }
}

async function runActions(flow, ctx, depth) {
  if (depth > MAX_CHAIN_DEPTH) return;
  const actions = (flow.actions || []).slice(0, MAX_ACTIONS);
  const start = Date.now();
  for (const a of actions) {
    if (Date.now() - start > MAX_WAIT_TOTAL) return;
    try { await execAction(a, ctx, depth); }
    catch (e) { console.error(`[automation] action ${a.type} err:`, e.message); }
  }
}

module.exports = { run, resolveVars, runActions };
