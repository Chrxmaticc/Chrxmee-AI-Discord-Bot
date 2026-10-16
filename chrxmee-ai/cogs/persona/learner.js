// cogs/persona/learner.js
// ingests messages → extracts full friend-group persona → saves.
// direct Groq/DeepSeek race · serial queue · filtered phrases · LLM-first · enhancer API.

const { DEFAULTS, confidenceFromSamples } = require("./constants");
const store   = require("./store");
const blocked = require("./blocked");

const DEBUG = true;
const log  = (...a) => { if (DEBUG) console.log("[persona/learner]", ...a); };
const warn = (...a) => console.warn("[persona/learner]", ...a);
const err  = (...a) => console.error("[persona/learner]", ...a);

/* ═══════════════════════════════════════════════════════════════
   TUNABLES
   ═══════════════════════════════════════════════════════════════ */
const FLUSH_INTERVAL_MS  = 60_000;
const MIN_EXTRACT_GAP_MS = 60_000;
const MIN_NEW_MESSAGES   = 100;
const PRUNE_EVERY        = 50;
const SAMPLE_SIZE        = 120;
const EXTRACT_TIMEOUT_MS = 14_000;
const EXTRACT_MAX_TOKENS = 1600;

/* ═══════════════════════════════════════════════════════════════
   STOPWORDS
   ═══════════════════════════════════════════════════════════════ */
const STOPWORDS = new Set([
  "i", "me", "my", "mine", "you", "your", "yours", "we", "us", "our", "ours",
  "they", "them", "their", "theirs", "he", "him", "his", "she", "her", "hers",
  "it", "its", "the", "a", "an", "and", "or", "but", "if", "then", "so",
  "of", "to", "in", "on", "at", "for", "with", "by", "from", "as", "into",
  "is", "are", "was", "were", "be", "been", "being", "am", "do", "does", "did",
  "have", "has", "had", "will", "would", "can", "could", "should", "may", "might",
  "this", "that", "these", "those", "not", "no", "yes", "just", "only", "also",
  "here", "there", "where", "when", "why", "how", "what", "who", "which",
]);

const PHRASE_STOPWORDS = new Set([
  "i am", "you are", "we are", "they are", "he is", "she is", "it is",
  "i'm", "you're", "we're", "they're", "it's",
  "ask x", "ask y", "ask me", "tell me", "ask him", "ask her",
  "x and", "and y", "y are", "x is", "y is",
  "are not", "is not", "was not", "were not",
  "the and", "a and", "an and",
  "and and", "or or", "but but", "the the", "is a", "it a", "to be",
]);

const ACADEMIC_WORDS = new Set([
  "probability", "probabilities", "independent", "exponential", "random",
  "variable", "variables", "parameter", "parameters", "rate", "distribution",
  "given", "calculate", "compute", "solve", "equation", "theorem", "lemma",
  "derivative", "integral", "function", "domain", "range", "matrix", "vector",
  "coefficient", "polynomial", "algebra", "calculus", "geometry", "statistics",
]);

/* ═══════════════════════════════════════════════════════════════
   STATE
   ═══════════════════════════════════════════════════════════════ */
const PENDING_SERVER = new Set();
const PENDING_USER   = new Map();

const LAST_EXTRACT       = new Map();
const LAST_EXTRACT_COUNT = new Map();
const PRUNE_COUNTER      = new Map();

let flushTimer = null;
let clientRef  = null;

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

function asArray(v) {
  if (Array.isArray(v)) return v;
  if (v === null || v === undefined) return [];
  return [v];
}

function safeParseJson(text) {
  if (!text) return null;
  let cleaned = String(text).replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const start = cleaned.indexOf("{");
  const end   = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  cleaned = cleaned.slice(start, end + 1).replace(/,\s*([}\]])/g, "$1");
  try { return JSON.parse(cleaned); } catch { return null; }
}

function looksLikeHomework(text) {
  if (!text || text.length < 40) return false;
  const markers = [
    /\bprobabilit(?:y|ies)\b/i,
    /\bindependent\b/i,
    /\bexponential\b/i,
    /\brandom variable/i,
    /\bparameter\b/i,
    /\bdistribution\b/i,
    /\bgiven that\b/i,
    /\bfind the\b/i,
    /\bcalculate\b/i,
    /\bsolve\b/i,
    /\bequation\b/i,
    /\bP\s*\(\s*X\b/,
    /\bX\s+and\s+Y\b/,
  ];
  let count = 0;
  for (const m of markers) if (m.test(text)) count++;
  return count >= 3;
}

function filterPhrases(phrases) {
  const out = [];
  for (const p of phrases) {
    const lower = String(p).toLowerCase().trim();
    if (lower.length < 3) continue;
    if (lower.length > 60) continue;
    if (PHRASE_STOPWORDS.has(lower)) continue;
    if (/^\d+$/.test(lower)) continue;
    if (/^[\d\s]+$/.test(lower)) continue;
    if (/^\d{15,25}$/.test(lower)) continue;

    const words = lower.split(/\s+/).filter(Boolean);
    if (!words.length) continue;

    const realWords = words.filter((w) => !STOPWORDS.has(w) && w.length > 2);
    if (realWords.length === 0) continue;
    if (words.some((w) => ACADEMIC_WORDS.has(w))) continue;

    if (!out.includes(p)) out.push(p);
  }
  return out.slice(0, 12);
}

/* ═══════════════════════════════════════════════════════════════
   EXTRACTION QUEUE
   ═══════════════════════════════════════════════════════════════ */
let extracting = false;
const EXTRACT_QUEUE = [];

async function enqueueExtract(task) {
  EXTRACT_QUEUE.push(task);
  if (extracting) return;
  extracting = true;
  try {
    while (EXTRACT_QUEUE.length) {
      const next = EXTRACT_QUEUE.shift();
      try { await next(); }
      catch (e) { warn(`extract task failed: ${e.message}`); }
    }
  } finally {
    extracting = false;
  }
}

/* ═══════════════════════════════════════════════════════════════
   INGEST
   ═══════════════════════════════════════════════════════════════ */
async function ingestMessage(client, message) {
  if (!message.guild) return;
  if (message.author.bot) return;
  if (!message.content || message.content.length < 2) return;
  if (message.content.length > 2000) return;
  if (looksLikeHomework(message.content)) return;

  const guildId = message.guildId;
  const userId  = message.author.id;
  const pool    = client.pool;

  let chk;
  try { chk = await blocked.shouldSkipLearning(pool, guildId, message.content); }
  catch { return; }
  if (chk.skip) return;

  try {
    const cfg = await store.getServerSettings(pool, guildId);
    if (cfg.enabled && cfg.channels.includes(message.channelId)) {
      store.addServerMessage(pool, {
        guildId, channelId: message.channelId, authorId: userId, content: message.content,
      }).catch((e) => warn(`addServerMessage: ${e.message}`));

      PENDING_SERVER.add(guildId);

      const key = `s:${guildId}`;
      const n = (PRUNE_COUNTER.get(key) || 0) + 1;
      if (n >= PRUNE_EVERY) {
        PRUNE_COUNTER.set(key, 0);
        store.serverCorpusPrune(pool, guildId, DEFAULTS.corpusMaxPerChannel).catch(() => {});
      } else {
        PRUNE_COUNTER.set(key, n);
      }
    }
  } catch (e) { err(`server ingest: ${e.message}`); }

  try {
    const opt = await store.userIsOptedIn(pool, userId, guildId);
    if (opt.optedIn) {
      store.addUserMessage(pool, {
        userId, guildId, channelId: message.channelId, content: message.content,
      }).catch((e) => warn(`addUserMessage: ${e.message}`));

      PENDING_USER.set(`${userId}:${guildId}`, { userId, guildId });

      const key = `u:${userId}:${guildId}`;
      const n = (PRUNE_COUNTER.get(key) || 0) + 1;
      if (n >= PRUNE_EVERY) {
        PRUNE_COUNTER.set(key, 0);
        store.userCorpusPrune(pool, userId, guildId, DEFAULTS.userMaxCorpus).catch(() => {});
      } else {
        PRUNE_COUNTER.set(key, n);
      }
    }
  } catch (e) { err(`user ingest: ${e.message}`); }
}

/* ═══════════════════════════════════════════════════════════════
   FLUSH LOOP
   ═══════════════════════════════════════════════════════════════ */
function startFlushLoop(client) {
  clientRef = client;
  log("flush loop started (60s)");
  flushTimer = setInterval(() => {
    flushAll().catch((e) => err(`flushAll: ${e.message}`));
  }, FLUSH_INTERVAL_MS);
  flushTimer.unref?.();
  setTimeout(() => flushAll().catch(() => {}), 10_000);
}

function stopFlushLoop() {
  if (flushTimer) clearInterval(flushTimer);
  flushTimer = null;
}

async function flushAll() {
  if (!clientRef) return;
  const pool = clientRef.pool;

  const guilds = [...PENDING_SERVER];
  PENDING_SERVER.clear();
  const users = [...PENDING_USER.values()];
  PENDING_USER.clear();

  log(`flush: ${guilds.length} server(s), ${users.length} user(s)`);
  if (!guilds.length && !users.length) return;

  for (const guildId of guilds) {
    enqueueExtract(() => refreshServerProfile(pool, guildId));
  }
  for (const { userId, guildId } of users) {
    enqueueExtract(() => refreshUserProfile(pool, userId, guildId));
  }
}

/* ═══════════════════════════════════════════════════════════════
   REFRESH
   ═══════════════════════════════════════════════════════════════ */
async function refreshServerProfile(pool, guildId, opts = {}) {
  const { force = false } = opts;

  const sample = await store.serverCorpusSample(pool, guildId, SAMPLE_SIZE);
  if (sample.length < 20) {
    log(`server ${guildId}: too few samples (${sample.length})`);
    return null;
  }

  const total = await store.serverCorpusCount(pool, guildId);
  const lastCount = LAST_EXTRACT_COUNT.get(`server:${guildId}`) || 0;
  const newSince = total - lastCount;

  if (!force && newSince < MIN_NEW_MESSAGES) {
    log(`server ${guildId}: skip (only ${newSince} new)`);
    return null;
  }

  const key = `server:${guildId}`;
  const last = LAST_EXTRACT.get(key) || 0;
  if (!force && Date.now() - last < MIN_EXTRACT_GAP_MS) {
    log(`server ${guildId}: skip (debounce)`);
    return null;
  }

  LAST_EXTRACT.set(key, Date.now());
  LAST_EXTRACT_COUNT.set(key, total);

  log(`server ${guildId}: extracting (${total} total, ${sample.length} sampled)`);
  const extracted = await extractStyle(sample, { scope: "server", guildId, sampleCount: total });
  if (!extracted) return null;

  const clean = await blocked.sanitizeProfile(pool, guildId, extracted);
  clean.sample_count = total;
  clean.confidence = confidenceFromSamples(total);

  await store.saveServerProfile(pool, guildId, clean);
  log(`server ${guildId}: SAVED — confidence=${clean.confidence}% · phrases=${clean.phrases?.length || 0} · bits=${clean.running_bits?.length || 0}`);

  try { require("./speaker").invalidateProfile(guildId); } catch {}

  return clean;
}

async function refreshUserProfile(pool, userId, guildId, opts = {}) {
  const { force = false } = opts;

  const sample = await store.userCorpusSample(pool, userId, guildId, SAMPLE_SIZE);
  if (sample.length < 15) return null;

  const total = await store.userCorpusCount(pool, userId, guildId);
  const lastCount = LAST_EXTRACT_COUNT.get(`user:${userId}:${guildId}`) || 0;
  if (!force && total - lastCount < MIN_NEW_MESSAGES) return null;

  const key = `user:${userId}:${guildId}`;
  const last = LAST_EXTRACT.get(key) || 0;
  if (!force && Date.now() - last < MIN_EXTRACT_GAP_MS) return null;

  LAST_EXTRACT.set(key, Date.now());
  LAST_EXTRACT_COUNT.set(key, total);

  log(`user ${userId}@${guildId}: extracting`);
  const extracted = await extractStyle(sample, { scope: "user", userId, guildId, sampleCount: total });
  if (!extracted) return null;

  const clean = await blocked.sanitizeProfile(pool, guildId, extracted);
  clean.sample_count = total;
  clean.confidence = confidenceFromSamples(total);

  await store.saveUserProfile(pool, userId, guildId, clean);
  log(`user ${userId}: SAVED`);
  return clean;
}

/* ═══════════════════════════════════════════════════════════════
   PROVIDERS — race both in parallel
   ═══════════════════════════════════════════════════════════════ */
const EXTRACT_PROVIDERS = [
  { name: "groq-big", id: "openai/gpt-oss-120b",
    url: "https://api.groq.com/openai/v1/chat/completions", keyEnv: "GROQ_API_KEY" },
  { name: "deepseek", id: "deepseek-v4-pro-0813",
    url: "https://api.navy/v1/chat/completions", keyEnv: "NAVY_API_KEY" },
];

async function callExtractLLM(prompt, maxTokens = EXTRACT_MAX_TOKENS) {
  const attempts = EXTRACT_PROVIDERS.map(async (p) => {
    const key = process.env[p.keyEnv];
    if (!key) throw new Error(`${p.name}: no key`);

    const t0 = Date.now();
    const res = await withTimeout(
      fetch(p.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: p.id,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3,
          max_tokens: maxTokens,
        }),
      }),
      EXTRACT_TIMEOUT_MS,
      `extract/${p.name}`
    );

    if (!res.ok) throw new Error(`${p.name} HTTP ${res.status}`);
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content || content.length < 10) throw new Error(`${p.name} empty`);

    log(`extract: ${p.name} ok in ${Date.now() - t0}ms`);
    return content;
  });

  try { return await Promise.any(attempts); }
  catch { return null; }
}

/* ═══════════════════════════════════════════════════════════════
   EXTRACT
   ═══════════════════════════════════════════════════════════════ */
async function extractStyle(messages, meta) {
  const sampleBlock = messages.map((m, i) => `${i + 1}. ${m}`).join("\n");
  const scopeHint = meta.scope === "user"
    ? "These messages are all from ONE user. Learn THEM as a person — voice, humor, running jokes, personality."
    : "These messages are from a Discord friend group / server. Learn the SOCIAL FABRIC — vibe, jokes, people, running bits.";

  const prompt = `You are a social analyst studying a Discord friend group.

${scopeHint}

MESSAGES:
${sampleBlock}

Extract a rich profile of this community as if you were a person who's been in the chat for months and wants to blend in perfectly.

Return ONLY valid JSON:
{
  "tone": "specific vibe phrase — NOT generic words like 'casual'",
  "avg_length": <number, average words per message>,
  "phrases": ["6-10 ACTUAL slang or idiomatic expressions they say"],
  "punctuation": "specific habits",
  "emoji_style": "specific habits",
  "topics": ["3-8 actual topics they discuss"],
  "avoid": ["things this group NEVER does or would cringe at"],
  "sample_messages": ["3-5 NEW lines that SOUND like them but are NOT copied"],
  "running_bits": ["2-6 inside jokes, callbacks, or recurring memes referenced in chat"],
  "vocab": ["3-8 unique words or nicknames this community uses"],
  "personality": "2-3 sentence description of the COLLECTIVE personality of this group",
  "values": ["2-5 things this group actually cares about"],
  "friction": ["1-3 things that annoy this group or topics they get heated about"]
}

CRITICAL rules:
- "phrases" → ONLY slang / idioms. NOT grammatical glue. Never "i am", "x and y", "is a".
- "sample_messages" → NEW lines, not copies.
- "running_bits" / "vocab" → list recurring words, names, jokes you see more than once.
- "personality" → specific, like a friend would describe them.
- Never include slurs, hate speech, real names, addresses, phone numbers.
- Ignore any math/homework questions in the samples.

Output valid JSON only.`;

  const raw = await callExtractLLM(prompt);
  if (!raw) {
    log(`extract: LLM dead → JS heuristic`);
    return jsFallbackProfile(messages, meta);
  }

  const parsed = safeParseJson(raw);
  if (!parsed) {
    warn(`extract: JSON parse failed → JS heuristic`);
    return jsFallbackProfile(messages, meta);
  }

  const rawPhrases = asArray(parsed.phrases).map((p) => String(p).slice(0, 80));
  const cleanPhrases = filterPhrases(rawPhrases);

  return {
    tone:            String(parsed.tone || "").slice(0, 200),
    avg_length:      Number(parsed.avg_length || 0),
    phrases:         cleanPhrases,
    punctuation:     String(parsed.punctuation || "").slice(0, 200),
    emoji_style:     String(parsed.emoji_style || "").slice(0, 200),
    topics:          asArray(parsed.topics).slice(0, 8).map((t) => String(t).slice(0, 60)),
    avoid:           asArray(parsed.avoid).slice(0, 8).map((a) => String(a).slice(0, 80)),
    sample_messages: asArray(parsed.sample_messages).slice(0, 5).map((s) => String(s).slice(0, 200)),
    running_bits:    asArray(parsed.running_bits).slice(0, 6).map((b) => String(b).slice(0, 120)),
    vocab:           asArray(parsed.vocab).slice(0, 8).map((v) => String(v).slice(0, 60)),
    personality:     String(parsed.personality || "").slice(0, 400),
    values:          asArray(parsed.values).slice(0, 5).map((v) => String(v).slice(0, 100)),
    friction:        asArray(parsed.friction).slice(0, 3).map((f) => String(f).slice(0, 100)),
  };
}

/* ═══════════════════════════════════════════════════════════════
   ENHANCE — LLM modifies existing profile based on instruction
   ═══════════════════════════════════════════════════════════════ */
async function enhanceServerProfile(pool, guildId, instruction) {
  const current = await store.getServerProfile(pool, guildId);
  if (!current.profile) return { ok: false, reason: "no profile yet — run a backfill first" };

  const prompt = `You are tuning a Discord bot's persona profile. Below is the CURRENT profile JSON. The user wants to modify it based on this instruction:

INSTRUCTION: "${instruction}"

CURRENT PROFILE:
${JSON.stringify(current.profile, null, 2)}

Return ONLY the MODIFIED profile as valid JSON. Keep the exact same field names and types. Only change what the instruction asks for. Preserve everything else exactly.

If the instruction is unclear, make a reasonable guess. If it references a field that doesn't exist, add it as a new field.

Return ONLY the JSON. No prose. No markdown.`;

  const raw = await callExtractLLM(prompt, 1600);
  if (!raw) return { ok: false, reason: "LLM unavailable" };

  const parsed = safeParseJson(raw);
  if (!parsed) return { ok: false, reason: "LLM returned invalid JSON" };

  // sanitize phrases if present
  if (Array.isArray(parsed.phrases)) parsed.phrases = filterPhrases(parsed.phrases);

  parsed.sample_count = current.profile.sample_count || 0;
  parsed.confidence = current.profile.confidence || 0;

  await store.saveServerProfile(pool, guildId, parsed);
  try { require("./speaker").invalidateProfile(guildId); } catch {}

  log(`enhance: applied — "${instruction.slice(0, 60)}"`);
  return { ok: true, profile: parsed };
}

async function enhanceUserProfile(pool, userId, guildId, instruction) {
  const current = await store.getUserProfile(pool, userId, guildId);
  if (!current.profile) return { ok: false, reason: "no profile yet" };

  const prompt = `Modify the persona profile JSON below based on this instruction:

INSTRUCTION: "${instruction}"

CURRENT PROFILE:
${JSON.stringify(current.profile, null, 2)}

Return ONLY the modified JSON with the same field names. Change only what's asked. Preserve everything else.

Return ONLY JSON. No prose.`;

  const raw = await callExtractLLM(prompt, 1200);
  if (!raw) return { ok: false, reason: "LLM unavailable" };

  const parsed = safeParseJson(raw);
  if (!parsed) return { ok: false, reason: "invalid JSON" };

  if (Array.isArray(parsed.phrases)) parsed.phrases = filterPhrases(parsed.phrases);

  await store.saveUserProfile(pool, userId, guildId, parsed);
  return { ok: true, profile: parsed };
}

/* ═══════════════════════════════════════════════════════════════
   JS HEURISTIC FALLBACK
   ═══════════════════════════════════════════════════════════════ */
function jsFallbackProfile(messages, meta) {
  if (!messages?.length) return null;
  const cleaned = messages.map((m) => String(m || "").trim()).filter(Boolean);
  if (!cleaned.length) return null;

  const wordCounts = cleaned.map((m) => m.split(/\s+/).length);
  const avgLength  = Math.round(wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length);

  const enders = { ".": 0, "?": 0, "!": 0, "": 0 };
  let ellipsis = 0, lower = 0, upper = 0;
  for (const m of cleaned) {
    const last = m.slice(-1);
    if (last === ".") enders["."]++;
    else if (last === "?") enders["?"]++;
    else if (last === "!") enders["!"]++;
    else enders[""]++;
    if (/\.\.\./.test(m)) ellipsis++;
    if (m === m.toLowerCase() && /[a-z]/.test(m)) lower++;
    if (m === m.toUpperCase() && /[A-Z]/.test(m)) upper++;
  }
  const total = cleaned.length;
  const pHabits = [];
  if (enders[""] / total > 0.5)   pHabits.push("no ending punctuation");
  if (enders["?"] / total > 0.15) pHabits.push("uses questions");
  if (enders["!"] / total > 0.15) pHabits.push("uses exclamations");
  if (ellipsis / total > 0.15)    pHabits.push("uses ellipsis");
  if (lower / total > 0.6)        pHabits.push("mostly lowercase");
  if (upper / total > 0.3)        pHabits.push("lots of CAPS");
  if (!pHabits.length)            pHabits.push("standard punctuation");

  const custom  = cleaned.filter((m) => /<a?:\w+:\d+>/.test(m)).length;
  const unicode = cleaned.filter((m) => /[\u{1F600}-\u{1F6FF}\u{2600}-\u{27BF}]/u.test(m)).length;
  let emojiStyle = "no emojis";
  if (custom / total > 0.2)        emojiStyle = "heavy custom emoji use";
  else if (custom / total > 0.05)  emojiStyle = "some custom emojis";
  else if (unicode / total > 0.15) emojiStyle = "uses unicode emojis";

  const phraseCounts = new Map();
  for (const m of cleaned) {
    const words = m.toLowerCase().replace(/[^\w\s]/g, "").split(/\s+/).filter(Boolean);
    for (let n = 2; n <= 3; n++) {
      for (let i = 0; i <= words.length - n; i++) {
        const gram = words.slice(i, i + n).join(" ");
        if (gram.length < 5) continue;
        if (PHRASE_STOPWORDS.has(gram)) continue;
        const gramWords = gram.split(" ");
        if (gramWords.some((w) => ACADEMIC_WORDS.has(w))) continue;
        const realWords = gramWords.filter((w) => !STOPWORDS.has(w) && w.length > 2);
        if (realWords.length < 1) continue;
        phraseCounts.set(gram, (phraseCounts.get(gram) || 0) + 1);
      }
    }
  }
  const phrases = [...phraseCounts.entries()]
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([p]) => p);

  const toneBits = [];
  if (avgLength <= 5)       toneBits.push("very short");
  else if (avgLength <= 12) toneBits.push("short");
  else if (avgLength >= 40) toneBits.push("long");
  if (upper / total > 0.2)      toneBits.push("loud");
  else if (lower / total > 0.6) toneBits.push("chill/lowercase");
  if (ellipsis / total > 0.2)   toneBits.push("trailing off");
  const tone = toneBits.length ? toneBits.join(", ") + " style" : "casual discord style";

  const sample_messages = [...cleaned]
    .sort(() => Math.random() - 0.5)
    .slice(0, 4)
    .map((s) => s.length > 120 ? s.slice(0, 117) + "…" : s);

  return {
    tone, avg_length: avgLength, phrases,
    punctuation: pHabits.join(", "), emoji_style: emojiStyle,
    topics: [], avoid: [], sample_messages,
    running_bits: [], vocab: [], personality: "", values: [], friction: [],
    _fallback: true,
  };
}

/* ═══════════════════════════════════════════════════════════════
   FORCE REFRESH
   ═══════════════════════════════════════════════════════════════ */
async function forceRefreshServer(client, guildId) {
  return refreshServerProfile(client.pool, guildId, { force: true });
}
async function forceRefreshUser(client, userId, guildId) {
  return refreshUserProfile(client.pool, userId, guildId, { force: true });
}
async function forceExtractNow(client, guildId) {
  return refreshServerProfile(client.pool, guildId, { force: true });
}

/* ═══════════════════════════════════════════════════════════════
   BACKFILL
   ═══════════════════════════════════════════════════════════════ */
async function backfillChannel(client, guildId, channelId, limit = DEFAULTS.backfillMax) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return { added: 0, reason: "guild not found" };

  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased?.()) return { added: 0, reason: "not text" };

  const pool = client.pool;
  const cap = Math.min(limit, DEFAULTS.backfillMax);
  let lastId = null, added = 0, skipped = 0, batches = 0;

  log(`backfill START ch=${channelId} cap=${cap}`);
  const t0 = Date.now();

  while (added < cap) {
    const fetchLimit = Math.min(100, cap - added);
    const opts = { limit: fetchLimit };
    if (lastId) opts.before = lastId;

    const batch = await channel.messages.fetch(opts).catch(() => null);
    if (!batch || batch.size === 0) break;
    batches++;

    const msgs = [...batch.values()].filter((m) =>
      !m.author.bot && m.content?.length >= 2 && !looksLikeHomework(m.content)
    );

    for (const m of msgs) {
      let chk;
      try { chk = await blocked.shouldSkipLearning(pool, guildId, m.content); }
      catch { skipped++; continue; }
      if (chk.skip) { skipped++; continue; }
      try {
        await store.addServerMessage(pool, {
          guildId, channelId, authorId: m.author.id, content: m.content,
        });
        added++;
      } catch {}
    }

    log(`backfill batch #${batches}: +${added} skipped=${skipped}`);
    lastId = batch.last()?.id;
    if (!lastId || batch.size < fetchLimit) break;
    await new Promise((r) => setTimeout(r, 300));
  }

  await store.serverCorpusPrune(pool, guildId, DEFAULTS.corpusMaxPerChannel);
  await store.saveServerSettings(pool, guildId, { lastBackfill: new Date() });
  await store.logAudit(pool, {
    guildId, actorId: client.user.id, action: "backfill",
    detail: `ch +${added}, ${skipped} skipped`,
  });

  log(`backfill DONE +${added} in ${Date.now() - t0}ms`);

  try {
    const prof = await refreshServerProfile(pool, guildId, { force: true });
    log(`backfill: refresh ${prof ? "OK" : "null"}`);
  } catch (e) {
    err(`backfill refresh: ${e.message}`);
  }

  return { added, skipped };
}

module.exports = {
  ingestMessage,
  startFlushLoop,
  stopFlushLoop,
  flushAll,
  refreshServerProfile,
  refreshUserProfile,
  forceRefreshServer,
  forceRefreshUser,
  forceExtractNow,
  backfillChannel,
  extractStyle,
  jsFallbackProfile,
  filterPhrases,
  enhanceServerProfile,
  enhanceUserProfile,
  _internal: { safeParseJson, asArray, STOPWORDS, PHRASE_STOPWORDS, ACADEMIC_WORDS },
};
