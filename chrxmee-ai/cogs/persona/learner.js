// cogs/persona/learner.js
// ingests messages → extracts style profiles → saves.
// direct Groq/Navy (no kilo), serial queue, lazy extract, batched prune.

const { DEFAULTS, confidenceFromSamples } = require("./constants");
const store   = require("./store");
const blocked = require("./blocked");

/* ═══════════════════════════════════════════════════════════════
   LOGGING
   ═══════════════════════════════════════════════════════════════ */
const DEBUG = true;
const log  = (...a) => { if (DEBUG) console.log("[persona/learner]", ...a); };
const warn = (...a) => console.warn("[persona/learner]", ...a);
const err  = (...a) => console.error("[persona/learner]", ...a);

/* ═══════════════════════════════════════════════════════════════
   TUNABLES
   ═══════════════════════════════════════════════════════════════ */
const FLUSH_INTERVAL_MS    = 60_000;
const MIN_EXTRACT_GAP_MS   = 60_000;
const MIN_NEW_MESSAGES     = 100;
const PRUNE_EVERY          = 50;
const SAMPLE_SIZE          = 100;
const EXTRACT_TIMEOUT_MS   = 12_000;
const EXTRACT_MAX_TOKENS   = 1000;

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
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  cleaned = cleaned.slice(start, end + 1).replace(/,\s*([}\]])/g, "$1");
  try { return JSON.parse(cleaned); } catch { return null; }
}

/* ═══════════════════════════════════════════════════════════════
   EXTRACTION QUEUE — one at a time
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

  const guildId = message.guildId;
  const userId  = message.author.id;
  const pool    = client.pool;

  let chk;
  try { chk = await blocked.shouldSkipLearning(pool, guildId, message.content); }
  catch { return; }
  if (chk.skip) return;

  /* ── SERVER ── */
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

  /* ── USER ── */
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
   SERVER REFRESH
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
  log(`server ${guildId}: SAVED — confidence=${clean.confidence}%`);

  try { require("./speaker").invalidateProfile(guildId); } catch {}

  return clean;
}

/* ═══════════════════════════════════════════════════════════════
   USER REFRESH
   ═══════════════════════════════════════════════════════════════ */
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
   LLM PROVIDERS (direct — no kilo)
   ═══════════════════════════════════════════════════════════════ */
const EXTRACT_PROVIDERS = [
  { name: "groq-fast", id: "openai/gpt-oss-20b",
    url: "https://api.groq.com/openai/v1/chat/completions", keyEnv: "GROQ_API_KEY" },
  { name: "groq-big", id: "openai/gpt-oss-120b",
    url: "https://api.groq.com/openai/v1/chat/completions", keyEnv: "GROQ_API_KEY" },
  { name: "navy", id: "gpt-4.1-mini",
    url: "https://api.navy/v1/chat/completions", keyEnv: "NAVY_API_KEY" },
];

async function callExtractLLM(prompt) {
  for (const p of EXTRACT_PROVIDERS) {
    const key = process.env[p.keyEnv];
    if (!key) continue;
    try {
      const res = await withTimeout(
        fetch(p.url, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify({
            model: p.id,
            messages: [{ role: "user", content: prompt }],
            temperature: 0.4,
            max_tokens: EXTRACT_MAX_TOKENS,
          }),
        }),
        EXTRACT_TIMEOUT_MS,
        `extract/${p.name}`
      );
      if (!res.ok) { warn(`extract: ${p.name} HTTP ${res.status}`); continue; }
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (content && content.length > 10) {
        log(`extract: ${p.name} ok`);
        return content;
      }
    } catch (e) {
      warn(`extract: ${p.name} — ${e.message}`);
    }
  }
  return null;
}

async function extractStyle(messages, meta) {
  const sampleBlock = messages.map((m, i) => `${i + 1}. ${m}`).join("\n");
  const scopeHint = meta.scope === "user"
    ? "This is ONE user's messages. Learn THEIR individual voice."
    : "This is a collection of messages from MANY users in one Discord server. Learn the collective voice.";

  const prompt = `Linguistics analyst task. Study these Discord messages.

${scopeHint}

MESSAGES:
${sampleBlock}

Return ONLY valid JSON:
{
  "tone": "short vibe description",
  "avg_length": <number, avg words>,
  "phrases": ["recurring phrases, max 12"],
  "punctuation": "punctuation habits",
  "emoji_style": "emoji habits",
  "topics": ["common topics, max 8"],
  "avoid": ["things they never do"],
  "sample_messages": ["3-5 new lines in this exact voice"]
}

Rules:
- Never include slurs or harmful content.
- Sample messages MUST sound like the source but be new text.
- Output valid JSON only. No prose. No markdown.`;

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

  return {
    tone:            String(parsed.tone || "").slice(0, 200),
    avg_length:      Number(parsed.avg_length || 0),
    phrases:         asArray(parsed.phrases).slice(0, 12).map((p) => String(p).slice(0, 80)),
    punctuation:     String(parsed.punctuation || "").slice(0, 200),
    emoji_style:     String(parsed.emoji_style || "").slice(0, 200),
    topics:          asArray(parsed.topics).slice(0, 8).map((t) => String(t).slice(0, 60)),
    avoid:           asArray(parsed.avoid).slice(0, 8).map((a) => String(a).slice(0, 80)),
    sample_messages: asArray(parsed.sample_messages).slice(0, 5).map((s) => String(s).slice(0, 200)),
  };
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
        if (gram.length < 4) continue;
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

    const msgs = [...batch.values()].filter((m) => !m.author.bot && m.content?.length >= 2);
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
  _internal: { safeParseJson, asArray, PENDING_SERVER, PENDING_USER },
};
