// cogs/persona/speaker.js
// decides whether to speak, builds the prompt, generates a reply.
// cached + timeout-protected + fast-model-first.

const { DEFAULTS, CONTEXT_WINDOW, emptyProfile } = require("./constants");
const store = require("./store");
const blocked = require("./blocked");

const DEBUG = true;
const log  = (...a) => { if (DEBUG) console.log("[persona/speaker]", ...a); };
const warn = (...a) => console.warn("[persona/speaker]", ...a);

/* ═══════════════════════════════════════════════════════════════
   CACHES — avoid 4 DB queries on every message
   ═══════════════════════════════════════════════════════════════ */
const SETTINGS_CACHE = new Map();
const PROFILE_CACHE  = new Map();
const COUNT_CACHE    = new Map();

const SETTINGS_TTL = 30_000;
const PROFILE_TTL  = 60_000;
const COUNT_TTL    = 15_000;

async function getCachedSettings(pool, guildId) {
  const c = SETTINGS_CACHE.get(guildId);
  if (c && Date.now() - c.t < SETTINGS_TTL) return c.cfg;
  const cfg = await store.getServerSettings(pool, guildId);
  SETTINGS_CACHE.set(guildId, { t: Date.now(), cfg });
  return cfg;
}

async function getCachedProfile(pool, guildId) {
  const c = PROFILE_CACHE.get(guildId);
  if (c && Date.now() - c.t < PROFILE_TTL) return c.prof;
  const prof = await store.getServerProfile(pool, guildId);
  PROFILE_CACHE.set(guildId, { t: Date.now(), prof });
  return prof;
}

async function getCachedCount(pool, guildId) {
  const c = COUNT_CACHE.get(guildId);
  if (c && Date.now() - c.t < COUNT_TTL) return c.n;
  const n = await store.serverCorpusCount(pool, guildId);
  COUNT_CACHE.set(guildId, { t: Date.now(), n });
  return n;
}

function invalidate(guildId) {
  SETTINGS_CACHE.delete(guildId);
  PROFILE_CACHE.delete(guildId);
  COUNT_CACHE.delete(guildId);
}
function invalidateSettings(guildId) { SETTINGS_CACHE.delete(guildId); }
function invalidateProfile(guildId)  { PROFILE_CACHE.delete(guildId); }
function invalidateCount(guildId)    { COUNT_CACHE.delete(guildId); }

/* ═══════════════════════════════════════════════════════════════
   TIMEOUT HELPER
   ═══════════════════════════════════════════════════════════════ */
function withTimeout(promise, ms, name) {
  return Promise.race([
    promise,
    new Promise((_, rej) =>
      setTimeout(() => rej(new Error(`${name} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

/* ═══════════════════════════════════════════════════════════════
   SERVER SPEAK — chance roll FIRST, then DB
   ═══════════════════════════════════════════════════════════════ */
async function considerServerSpeak(client, message) {
  const t0 = Date.now();
  const pool = client.pool;

  if (!message.guild) return null;
  if (message.author.bot) return null;

  // 1. cached settings (usually in-memory, no DB hit)
  const cfg = await getCachedSettings(pool, message.guildId);
  if (!cfg.enabled) return null;
  if (!cfg.channels.includes(message.channelId)) return null;

  // 2. chance roll BEFORE any expensive check
  const mentioned = cfg.mentions && message.mentions.has(client.user);
  if (!mentioned) {
    const roll = Math.random() * 100;
    if (roll > cfg.replyChance) {
      log(`bail: chance ${roll.toFixed(1)} > ${cfg.replyChance} in ${Date.now() - t0}ms`);
      return null;
    }
  }

  // 3. cooldown + profile + count in parallel
  const [lastSpoke, prof, total] = await Promise.all([
    store.cooldownGet(pool, message.channelId),
    getCachedProfile(pool, message.guildId),
    getCachedCount(pool, message.guildId),
  ]);

  if (Date.now() - lastSpoke < cfg.cooldownMs) {
    log(`bail: cooldown in ${Date.now() - t0}ms`);
    return null;
  }
  if (total < cfg.minMessages) {
    log(`bail: below min (${total}/${cfg.minMessages})`);
    return null;
  }
  if (!prof.profile || total < 20) {
    log(`bail: no profile`);
    return null;
  }

  log(`passed checks in ${Date.now() - t0}ms (mentioned=${mentioned})`);
  return await generateServerReply(client, message, cfg, prof, { mentioned });
}

/* ═══════════════════════════════════════════════════════════════
   SERVER REPLY
   ═══════════════════════════════════════════════════════════════ */
async function generateServerReply(client, message, cfg, prof, { mentioned }) {
  const pool  = client.pool;
  const guild = message.guild;

  // perceived speed
  await message.channel.sendTyping().catch(() => {});

  const context = await fetchContext(message.channel, message.id, CONTEXT_WINDOW);

  const reply = await generate(client, {
    scope: "server",
    guild,
    message,
    context,
    profile: prof.profile,
    manualEdit: prof.manualEdit,
    gifsAllowed: cfg.gifs,
    mentioned,
    extras: { authorName: message.member?.displayName || message.author.username },
  });

  if (!reply) return null;

  const filtered = await blocked.filterOutput(pool, message.guildId, reply);
  await store.cooldownBump(pool, message.channelId);

  return {
    text: filtered.text,
    blocked: filtered.blocked,
    replyTo: message.id,
    mentioned,
  };
}

/* ═══════════════════════════════════════════════════════════════
   USER SPEAK
   ═══════════════════════════════════════════════════════════════ */
async function generateUserSpeak(client, userId, guildId, topic) {
  const pool = client.pool;
  const opt = await store.userIsOptedIn(pool, userId, guildId);
  if (!opt.optedIn) return { ok: false, reason: "user not opted in" };

  const total = await store.userCorpusCount(pool, userId, guildId);
  if (total < opt.minMessages) return { ok: false, reason: `needs ${opt.minMessages}, has ${total}` };

  const prof = await store.getUserProfile(pool, userId, guildId);
  if (!prof.profile) return { ok: false, reason: "no profile yet" };

  const guild = client.guilds.cache.get(guildId);
  if (!guild) return { ok: false, reason: "guild not found" };
  const member = await guild.members.fetch(userId).catch(() => null);
  const username = member?.displayName || "user";

  const reply = await generate(client, {
    scope: "user",
    targetName: username,
    guild,
    topic,
    profile: prof.profile,
    manualEdit: prof.manualEdit,
    gifsAllowed: true,
    extras: { referencedUserId: userId },
  });

  if (!reply) return { ok: false, reason: "generation failed" };
  const filtered = await blocked.filterOutput(pool, guildId, reply);
  return { ok: true, text: filtered.text, blocked: filtered.blocked };
}

/* ═══════════════════════════════════════════════════════════════
   CORE GENERATE — timeout-protected, fast model first
   ═══════════════════════════════════════════════════════════════ */
async function generate(client, opts) {
  const {
    scope, guild, message, context, topic,
    profile, manualEdit, gifsAllowed, mentioned, extras = {},
  } = opts;

  let callAI;
  try {
    const tools = require("../../tools");
    if (!tools?.callAI) throw new Error("tools.callAI missing");
    callAI = tools.callAI;
  } catch (e) {
    warn(`cannot load tools: ${e.message}`);
    return null;
  }

  const profileBlock = buildProfileBlock(profile);
  const manualBlock  = manualEdit ? buildManualBlock(manualEdit) : "";
  const ctxBlock     = context?.length
    ? context.map((m) => `${m.author}: ${m.content}`).join("\n")
    : "";
  const mentionHint  = mentioned ? "You were @mentioned — reply directly." : "";
  const gifHint      = gifsAllowed
    ? "If a custom emoji or GIF fits naturally, include ONE. Otherwise skip."
    : "No GIFs or URLs. Custom emojis OK.";

  const prompt = scope === "user"
    ? buildUserPrompt({ profileBlock, manualBlock, topic, targetName: extras.targetName })
    : buildServerPrompt({ profileBlock, manualBlock, ctxBlock, message, extras, mentionHint, gifHint });

  // fast model first, then bigger ones
  const chain = ["speedster", "genius", "thinker"];
  const t0 = Date.now();

  for (const modelKey of chain) {
    try {
      log(`generate: trying ${modelKey}`);
      const raw = await withTimeout(
        callAI(modelKey, [{ role: "user", content: prompt }], 0.85, 250),
        12_000,
        `generate/${modelKey}`
      );
      const out = cleanOutput(raw);
      if (out) {
        log(`generate: ${modelKey} ok in ${Date.now() - t0}ms`);
        return out;
      }
      warn(`generate: ${modelKey} empty`);
    } catch (e) {
      warn(`generate: ${modelKey} failed — ${e.message}`);
    }
  }

  warn(`generate: all models failed (${Date.now() - t0}ms)`);
  return null;
}

function cleanOutput(raw) {
  if (!raw || typeof raw !== "string") return null;
  let out = raw.trim();
  out = out.replace(/^(assistant|chromed|bot)\s*:\s*/i, "").trim();
  out = out.replace(/^["'`]+|["'`]+$/g, "").trim();
  if (!out || out.length < 2) return null;
  if (out.length > 1900) out = out.slice(0, 1900) + "…";
  return out;
}

/* ═══════════════════════════════════════════════════════════════
   PROMPT BLOCKS — trimmed for speed
   ═══════════════════════════════════════════════════════════════ */
function buildProfileBlock(profile) {
  if (!profile) return "";
  const lines = [];
  if (profile.tone)        lines.push(`tone: ${profile.tone}`);
  if (profile.avg_length)  lines.push(`target length: ~${profile.avg_length} words`);
  if (profile.punctuation) lines.push(`punctuation: ${profile.punctuation}`);
  if (profile.emoji_style) lines.push(`emoji style: ${profile.emoji_style}`);
  if (profile.phrases?.length)  lines.push(`phrases: ${profile.phrases.slice(0, 6).map((p) => `"${p}"`).join(", ")}`);
  if (profile.topics?.length)   lines.push(`topics: ${profile.topics.join(", ")}`);
  if (profile.avoid?.length)    lines.push(`never: ${profile.avoid.join(", ")}`);
  // only 2 samples — keeps prompt small
  if (profile.sample_messages?.length) {
    lines.push(`examples:\n${profile.sample_messages.slice(0, 2).map((s) => `  • ${s}`).join("\n")}`);
  }
  return lines.join("\n");
}

function buildManualBlock(manual) {
  if (!manual) return "";
  const lines = [];
  if (manual.tone) lines.push(`override tone: ${manual.tone}`);
  if (manual.phrases?.length) lines.push(`prefer: ${manual.phrases.join(", ")}`);
  if (manual.avoid?.length)   lines.push(`never: ${manual.avoid.join(", ")}`);
  if (manual.extra)           lines.push(`extra: ${manual.extra}`);
  return lines.length ? lines.join("\n") : "";
}

function buildServerPrompt({ profileBlock, manualBlock, ctxBlock, message, extras, mentionHint, gifHint }) {
  return `Speak as the general voice of a Discord server, matching the community style.

# STYLE
${profileBlock}
${manualBlock ? `\n# OVERRIDES\n${manualBlock}` : ""}

# RECENT CHAT
${ctxBlock || "(none)"}

# REPLY TO
${extras.authorName || "user"}: ${message.content}

${mentionHint}

# RULES
- Match the style exactly.
- Never mention being a bot or AI.
- Do NOT copy context lines — write something NEW.
- 1-2 sentences max.
- ${gifHint}
- Never output slurs or harmful content.
- Output ONLY the reply. No quotes, no prefixes.`;
}

function buildUserPrompt({ profileBlock, manualBlock, topic, targetName }) {
  return `Write a Discord message as ${targetName || "this user"} in their voice.

# THEIR STYLE
${profileBlock}
${manualBlock ? `\n# OVERRIDES\n${manualBlock}` : ""}

# TOPIC
${topic}

# RULES
- Sound exactly like the style.
- Do NOT copy sample lines verbatim.
- Never mention being a bot.
- Keep it short.
- No slurs, no harmful content.
- Output ONLY the message. No quotes, no prefixes.`;
}

/* ═══════════════════════════════════════════════════════════════
   CHANCE (kept for API compat)
   ═══════════════════════════════════════════════════════════════ */
function computeChance(cfg, prof, message) {
  let chance = cfg.replyChance;
  if (/\?\s*$/.test(message.content || "")) chance += DEFAULTS.questionBoost;
  const topics = prof.profile?.topics || [];
  if (topics.length) {
    const lower = (message.content || "").toLowerCase();
    if (topics.some((t) => t && lower.includes(String(t).toLowerCase()))) {
      chance *= DEFAULTS.topicMatchMultiplier;
    }
  }
  return Math.max(0, Math.min(100, chance));
}

/* ═══════════════════════════════════════════════════════════════
   CONTEXT
   ═══════════════════════════════════════════════════════════════ */
async function fetchContext(channel, beforeMessageId, limit = 8) {
  try {
    const msgs = await channel.messages.fetch({ limit, before: beforeMessageId });
    return [...msgs.values()]
      .reverse()
      .filter((m) => m.content && m.content.length < 400)
      .map((m) => ({
        author: m.member?.displayName || m.author.username,
        content: m.content.slice(0, 250),
      }));
  } catch { return []; }
}

module.exports = {
  considerServerSpeak,
  generateUserSpeak,
  generate,
  computeChance,
  fetchContext,
  buildProfileBlock,
  invalidate,
  invalidateSettings,
  invalidateProfile,
  invalidateCount,
};
