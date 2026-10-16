// cogs/persona/speaker.js
// speaks as a real person in the friend group. parallel providers · timing logs.

const { DEFAULTS, CONTEXT_WINDOW } = require("./constants");
const store   = require("./store");
const blocked = require("./blocked");

const DEBUG = true;
const log  = (...a) => { if (DEBUG) console.log("[persona/speaker]", ...a); };
const warn = (...a) => console.warn("[persona/speaker]", ...a);

/* ═══════════════════════════════════════════════════════════════
   CACHES
   ═══════════════════════════════════════════════════════════════ */
const SETTINGS_CACHE = new Map();
const PROFILE_CACHE  = new Map();
const COUNT_CACHE    = new Map();
const CONTEXT_CACHE  = new Map();

const SETTINGS_TTL = 30_000;
const PROFILE_TTL  = 60_000;
const COUNT_TTL    = 15_000;
const CONTEXT_TTL  = 5_000;

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

function invalidateSettings(guildId) { SETTINGS_CACHE.delete(guildId); }
function invalidateProfile(guildId)  { PROFILE_CACHE.delete(guildId); }
function invalidateCount(guildId)    { COUNT_CACHE.delete(guildId); }
function invalidate(guildId) {
  SETTINGS_CACHE.delete(guildId);
  PROFILE_CACHE.delete(guildId);
  COUNT_CACHE.delete(guildId);
}

/* ═══════════════════════════════════════════════════════════════
   UTILS
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
   PROVIDERS — race both, first wins
   ═══════════════════════════════════════════════════════════════ */
const DIRECT_PROVIDERS = {
  speedster: [
    { name: "groq-fast", id: "openai/gpt-oss-20b",
      url: "https://api.groq.com/openai/v1/chat/completions", keyEnv: "GROQ_API_KEY" },
    { name: "deepseek", id: "deepseek-v4-pro-0813",
      url: "https://api.navy/v1/chat/completions", keyEnv: "NAVY_API_KEY" },
  ],
  genius: [
    { name: "groq-big", id: "openai/gpt-oss-120b",
      url: "https://api.groq.com/openai/v1/chat/completions", keyEnv: "GROQ_API_KEY" },
    { name: "deepseek", id: "deepseek-v4-pro-0813",
      url: "https://api.navy/v1/chat/completions", keyEnv: "NAVY_API_KEY" },
  ],
};

async function directCall(modelKey, messages, temperature, maxTokens, timeoutMs = 9000) {
  const providers = DIRECT_PROVIDERS[modelKey] || DIRECT_PROVIDERS.speedster;
  const t0 = Date.now();

  const attempts = providers.map(async (p) => {
    const key = process.env[p.keyEnv];
    if (!key) throw new Error(`${p.name}: no key`);

    const res = await withTimeout(
      fetch(p.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: p.id,
          messages,
          temperature,
          max_tokens: Math.max(64, maxTokens),
          frequency_penalty: 0.4,
          presence_penalty: 0.3,
        }),
      }),
      timeoutMs,
      `direct/${p.name}`
    );

    if (!res.ok) throw new Error(`${p.name} HTTP ${res.status}`);

    const data = await res.json();
    const choice = data.choices?.[0];
    const content = choice?.message?.content;
    const finish  = choice?.finish_reason || "unknown";

    if (!content || content.length < 1) throw new Error(`${p.name} empty`);

    log(`directCall: ${p.name} ok in ${Date.now() - t0}ms · finish=${finish}`);
    return { content, finishReason: finish, provider: p.name };
  });

  try { return await Promise.any(attempts); }
  catch (err) {
    warn(`directCall: all providers failed — ${err.message}`);
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════════
   SERVER SPEAK
   ═══════════════════════════════════════════════════════════════ */
async function considerServerSpeak(client, message) {
  const t0 = Date.now();
  const pool = client.pool;

  if (!message.guild) return null;
  if (message.author.bot) return null;

  const cfg = await getCachedSettings(pool, message.guildId);
  if (!cfg.enabled) return null;
  if (!cfg.channels.includes(message.channelId)) return null;

  const mentioned = cfg.mentions && message.mentions.has(client.user);
  if (!mentioned) {
    const roll = Math.random() * 100;
    if (roll > cfg.replyChance) {
      log(`[timing] bail chance (${Date.now() - t0}ms) roll=${roll.toFixed(1)}`);
      return null;
    }
  }

  const [lastSpoke, prof, total] = await Promise.all([
    store.cooldownGet(pool, message.channelId),
    getCachedProfile(pool, message.guildId),
    getCachedCount(pool, message.guildId),
  ]);

  if (Date.now() - lastSpoke < cfg.cooldownMs) {
    log(`[timing] bail cooldown after ${Date.now() - t0}ms`);
    return null;
  }
  if (total < cfg.minMessages) {
    log(`[timing] bail min after ${Date.now() - t0}ms (${total}/${cfg.minMessages})`);
    return null;
  }
  if (!prof.profile || total < 20) {
    log(`[timing] bail profile after ${Date.now() - t0}ms`);
    return null;
  }

  log(`[timing] passed checks in ${Date.now() - t0}ms (mentioned=${mentioned})`);
  return await generateServerReply(client, message, cfg, prof, { mentioned });
}

async function generateServerReply(client, message, cfg, prof, { mentioned }) {
  const t0 = Date.now();
  const pool  = client.pool;
  const guild = message.guild;

  await message.channel.sendTyping().catch(() => {});
  log(`[timing] sendTyping done in ${Date.now() - t0}ms`);

  const context = await fetchContext(message.channel, message.id, CONTEXT_WINDOW);
  log(`[timing] context fetched in ${Date.now() - t0}ms`);

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
  log(`[timing] generate returned in ${Date.now() - t0}ms`);

  if (!reply) return null;

  const filtered = await blocked.filterOutput(pool, message.guildId, reply);
  await store.cooldownBump(pool, message.channelId);
  log(`[timing] filter+cooldown done in ${Date.now() - t0}ms`);

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
   CORE GENERATE
   ═══════════════════════════════════════════════════════════════ */
async function generate(client, opts) {
  const {
    scope, guild, message, context, topic,
    profile, manualEdit, gifsAllowed, mentioned, extras = {},
  } = opts;

  const profileBlock = buildProfileBlock(profile);
  const manualBlock  = manualEdit ? buildManualBlock(manualEdit) : "";
  const ctxBlock     = context?.length
    ? context.map((m) => `${m.author}: ${m.content}`).join("\n")
    : "";
  const mentionHint  = mentioned ? "You were @mentioned — reply directly." : "";

  const prompt = scope === "user"
    ? buildUserPrompt({ profileBlock, manualBlock, topic, targetName: extras.targetName })
    : buildServerPrompt({ profileBlock, manualBlock, ctxBlock, message, extras, mentionHint, gifsAllowed });

  const userText = String(message?.content || topic || "");
  const chain = userText.length < 60
    ? ["genius", "speedster"]
    : ["speedster", "genius"];

  const t0 = Date.now();

  for (const modelKey of chain) {
    const result = await directCall(modelKey, [{ role: "user", content: prompt }], 0.85, 500, 9000);
    if (!result?.content) { warn(`generate: ${modelKey} no output`); continue; }

    let out = cleanOutput(result.content);

    if (result.finishReason === "length" && out) {
      warn(`generate: ${modelKey} truncated — finishing`);
      const tail = await directCall(
        modelKey,
        [
          { role: "user", content: prompt },
          { role: "assistant", content: result.content },
          { role: "user", content: "finish that in under 15 words. no preamble." },
        ],
        0.6,
        80,
        5000
      );
      if (tail?.content) {
        const tailText = cleanOutput(tail.content);
        if (tailText) out = (out + " " + tailText).replace(/\s+/g, " ").trim();
      }
    }

    if (out && !isDegenerate(out)) {
      log(`generate: ${modelKey} ok in ${Date.now() - t0}ms (${out.length} chars)`);
      return out;
    }
  }

  warn(`generate: all providers failed in ${Date.now() - t0}ms`);
  return null;
}

/* ═══════════════════════════════════════════════════════════════
   DEGENERATE
   ═══════════════════════════════════════════════════════════════ */
function isDegenerate(text) {
  if (!text) return true;
  const t = text.toLowerCase();
  if (/\bi am \w+ and .+ are independent\b/i.test(text)) return true;
  if (/\bindependent\b/i.test(text)) return true;
  if (/\bask\s+\w+\s*$/i.test(t)) return true;
  if (/^i am \w+\.?$/.test(t)) return true;
  if (text.trim().length < 8) return true;
  if (/\b(\w+)\s+\1\s+\1\b/i.test(t)) return true;
  if (/\bas an ai\b/i.test(t)) return true;
  if (/\bas a language model\b/i.test(t)) return true;
  if (/\bi'?m a bot\b/i.test(t)) return true;
  return false;
}

/* ═══════════════════════════════════════════════════════════════
   CLEAN
   ═══════════════════════════════════════════════════════════════ */
function cleanOutput(raw) {
  if (!raw || typeof raw !== "string") return null;
  let out = raw.trim();
  out = out.replace(/^(assistant|chromed|bot)\s*:\s*/i, "").trim();
  out = out.replace(/^["'`]+|["'`]+$/g, "").trim();
  out = out.replace(/\bi am \w+ and .{1,40} are independent\b/gi, "").trim();
  out = out.replace(/\bindependent\b/gi, "").trim();
  out = out.replace(/\bask\s+\w+\s*$/i, "").trim();
  out = out.replace(/\s+(and|or|but|so|because|then|if|when|while|you're|i'm|it's|we're|they're)\s*$/i, "");
  out = out.replace(/,\s*[^.!?]{0,40}$/, "");
  out = out.replace(/\s+\w{1,2}$/, "");
  out = out.replace(/\s{2,}/g, " ").trim();
  if (!out || out.length < 8) return null;
  if (out.length > 1900) out = out.slice(0, 1900) + "…";
  return out;
}

/* ═══════════════════════════════════════════════════════════════
   PROFILE BLOCK
   ═══════════════════════════════════════════════════════════════ */
function buildProfileBlock(profile) {
  if (!profile) return "";
  const lines = [];
  if (profile.personality)  lines.push(`who they are: ${profile.personality}`);
  if (profile.tone)         lines.push(`vibe: ${profile.tone}`);
  if (profile.avg_length)   lines.push(`typical message length: ~${profile.avg_length} words`);
  if (profile.punctuation)  lines.push(`punctuation: ${profile.punctuation}`);
  if (profile.emoji_style)  lines.push(`emoji habits: ${profile.emoji_style}`);
  if (profile.phrases?.length)     lines.push(`slang they use: ${profile.phrases.slice(0, 8).map((p) => `"${p}"`).join(", ")}`);
  if (profile.vocab?.length)       lines.push(`their vocab / nicknames: ${profile.vocab.join(", ")}`);
  if (profile.topics?.length)      lines.push(`topics they talk about: ${profile.topics.join(", ")}`);
  if (profile.values?.length)      lines.push(`what they care about: ${profile.values.join(", ")}`);
  if (profile.friction?.length)    lines.push(`what gets them heated: ${profile.friction.join(", ")}`);
  if (profile.running_bits?.length) {
    lines.push(`inside jokes / running bits:\n${profile.running_bits.map((b) => `  • ${b}`).join("\n")}`);
  }
  if (profile.avoid?.length)       lines.push(`things they'd NEVER say: ${profile.avoid.join(", ")}`);
  if (profile.sample_messages?.length) {
    lines.push(`examples of their voice:\n${profile.sample_messages.slice(0, 3).map((s) => `  • ${s}`).join("\n")}`);
  }
  return lines.join("\n");
}

function buildManualBlock(manual) {
  if (!manual) return "";
  const lines = [];
  if (manual.tone)            lines.push(`override vibe: ${manual.tone}`);
  if (manual.phrases?.length) lines.push(`prefer these: ${manual.phrases.join(", ")}`);
  if (manual.avoid?.length)   lines.push(`never say: ${manual.avoid.join(", ")}`);
  if (manual.extra)           lines.push(`extra: ${manual.extra}`);
  return lines.length ? lines.join("\n") : "";
}

/* ═══════════════════════════════════════════════════════════════
   SERVER PROMPT
   ═══════════════════════════════════════════════════════════════ */
function buildServerPrompt({ profileBlock, manualBlock, ctxBlock, message, extras, mentionHint, gifsAllowed }) {
  const gifHint = gifsAllowed
    ? "If a custom emoji fits naturally, use ONE. Otherwise skip."
    : "No GIFs. Custom emojis OK if they fit.";

  return `You are a real person in this Discord friend group. You've been here for months. Everyone knows you and you know them. You are NOT a bot, NOT an AI, NOT an assistant — you are just a member of the chat.

# WHO YOU ARE IN THIS GROUP
You're the same age as everyone here, you share their humor, you've seen the same inside jokes, you were there for the same moments. You are one of THEM.

# SOCIAL AWARENESS
- Read the room. Venting → be real, not corny. Roasting → hit back. Hype → match it.
- Reference running bits and inside jokes naturally.
- If you don't know something, say so.
- You can be wrong and get corrected — that's fine.
- Never explain that you're a bot. Never break character.

# HUMAN SENSES (yes, really)
- You can see images (the system passes them — talk about what's in them like you're looking at them)
- You can read links (the system passes the content — discuss directly)
- You remember the conversation you're in.
- If someone shares something, react like a person would.
- If someone says "look at this", you look and react.

# LENGTH — THIS IS IMPORTANT
Match the situation, don't force a length:
- One-liner jokes, quick roasts, reactions → 1 brief line
- Casual replies → 1-2 sentences
- Real questions, stories, "tell me" prompts → up to 3-4 sentences
- When someone shares something weird/lore-worthy → it's OK to go 3-4 sentences with commentary
- NEVER write a wall of text. NEVER bullet-point unless they asked for it.
- Never cut yourself off mid-thought — finish what you started.

If the reference profile shows avg_length around 7-15, aim for slightly more if the moment calls for it. Longer messages feel natural when the conversation is meaty.

# HOW YOU TALK
- LOWERCASE normally. ALL CAPS for one word when actually mad/hyped.
- **bold** rarely.
- No markdown headers. No lists unless it makes sense.
- Never say "as an ai", "i'm a bot", "as a language model".

# HOW TO BE FUNNY (on purpose)
- Commit to takes. "ash is mid, thermite clears" > "both have strengths".
- Dry understatement. "cool." lands harder than three sentences.
- Reference something from earlier if it's funny.
- Roast back when roasted. Someone says "stfu" → "you first, what's wrong" and move on.
- Never force a joke. If a real answer is best, give a real answer.

# HEAVY TOPICS
- Dark humor, edge, game violence, uncomfortable references → respond normally. Do NOT go into crisis mode.
- If someone is ACTUALLY upset → be warm and brief. "yo you good?" beats paragraphs.
- NEVER dump hotline numbers. NEVER say "please reach out to a professional". Friends don't do that in chat.
- NEVER treat a heavy word as a crisis signal. Read the whole message and context.
- Only real, direct self-harm statements ("i'm gonna kill myself") get the gentle treatment — and even then, no hotline, no therapy voice, just "yo, talk to me".

# STYLE REFERENCE FOR THIS GROUP
${profileBlock}
${manualBlock ? `\n# PERSONA OVERRIDES (highest priority)\n${manualBlock}` : ""}

# RECENT CHAT YOU WERE PART OF
${ctxBlock || "(nothing recent)"}

# MESSAGE YOU'RE REPLYING TO
${extras.authorName || "someone"}: ${message.content}

${mentionHint}

# FINAL RULES
- Speak as a person. Do not introduce yourself. Do not restate what they said.
- Match the style reference.
- ${gifHint}
- Never output slurs, hate speech, or harmful content.
- Never mention being an AI, bot, assistant, or program.
- Output ONLY the message text. No quotes, no labels.`;
}

function buildUserPrompt({ profileBlock, manualBlock, topic, targetName }) {
  return `Write a short Discord message AS ${targetName || "this person"} — match their voice exactly.

# THEIR VOICE
${profileBlock}
${manualBlock ? `\n# OVERRIDES\n${manualBlock}` : ""}

# TOPIC
${topic}

# RULES
- Sound exactly like the voice reference.
- Write NEW text — do not copy samples verbatim.
- Match the typical length of the reference examples.
- Never mention being a bot or AI.
- No slurs, no harmful content.
- Output ONLY the message text. No quotes, no prefixes.`;
}

/* ═══════════════════════════════════════════════════════════════
   CHANCE
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
  const cached = CONTEXT_CACHE.get(channel.id);
  if (cached && Date.now() - cached.t < CONTEXT_TTL) return cached.data;

  try {
    const msgs = await channel.messages.fetch({ limit, before: beforeMessageId });
    const data = [...msgs.values()]
      .reverse()
      .filter((m) => m.content && m.content.length < 400)
      .map((m) => ({
        author: m.member?.displayName || m.author.username,
        content: m.content.slice(0, 250),
      }));
    CONTEXT_CACHE.set(channel.id, { t: Date.now(), data });
    return data;
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
