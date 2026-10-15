// cogs/persona/learner.js
// ingests messages → extracts style profiles (LLM or heuristic) → saves.

const { DEFAULTS, emptyProfile, confidenceFromSamples } = require("./constants");
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
   STATE
   ═══════════════════════════════════════════════════════════════ */
const PENDING_SERVER = new Set();
const PENDING_USER   = new Map();

const FLUSH_INTERVAL_MS = 30_000;
let flushTimer = null;
let clientRef  = null;

// skip re-extracting the same profile back-to-back
const LAST_EXTRACT = new Map(); // key → timestamp
const MIN_EXTRACT_GAP_MS = 60_000;

/* ═══════════════════════════════════════════════════════════════
   INGEST
   ═══════════════════════════════════════════════════════════════ */
async function ingestMessage(client, message) {
  log(`ingest: ch=${message.channelId} author=${message.author.id} len=${message.content?.length || 0} bot=${message.author.bot} inGuild=${!!message.guild}`);

  if (!message.guild)                                 { log("bail: no guild"); return; }
  if (message.author.bot)                             { log("bail: bot"); return; }
  if (!message.content || message.content.length < 2) { log("bail: too short"); return; }
  if (message.content.length > 2000)                  { log("bail: too long"); return; }

  const guildId = message.guildId;
  const userId  = message.author.id;
  const pool    = client.pool;

  let chk;
  try {
    chk = await blocked.shouldSkipLearning(pool, guildId, message.content);
  } catch (e) {
    warn(`shouldSkipLearning threw: ${e.message}`);
    return;
  }
  if (chk.skip) { log(`bail: blocked (${chk.reason})`); return; }

  /* ── SERVER ── */
  try {
    const cfg = await store.getServerSettings(pool, guildId);
    const whitelisted = cfg.channels.includes(message.channelId);
    log(`server: enabled=${cfg.enabled} whitelisted=${whitelisted}`);
    if (cfg.enabled && whitelisted) {
      await store.addServerMessage(pool, {
        guildId, channelId: message.channelId, authorId: userId, content: message.content,
      });
      PENDING_SERVER.add(guildId);
      await store.serverCorpusPrune(pool, guildId, DEFAULTS.corpusMaxPerChannel);
      log(`+1 server msg → queued (${PENDING_SERVER.size} pending)`);
    }
  } catch (e) {
    err(`server ingest failed: ${e.message}`);
  }

  /* ── USER ── */
  try {
    const opt = await store.userIsOptedIn(pool, userId, guildId);
    if (opt.optedIn) {
      await store.addUserMessage(pool, {
        userId, guildId, channelId: message.channelId, content: message.content,
      });
      PENDING_USER.set(`${userId}:${guildId}`, { userId, guildId });
      await store.userCorpusPrune(pool, userId, guildId, DEFAULTS.userMaxCorpus);
      log(`+1 user msg → queued (${PENDING_USER.size} pending)`);
    }
  } catch (e) {
    err(`user ingest failed: ${e.message}`);
  }
}

/* ═══════════════════════════════════════════════════════════════
   FLUSH LOOP
   ═══════════════════════════════════════════════════════════════ */
function startFlushLoop(client) {
  clientRef = client;
  log("flush loop started (30s)");
  flushTimer = setInterval(() => {
    flushAll().catch((e) => err(`flushAll threw: ${e.message}`));
  }, FLUSH_INTERVAL_MS);
  flushTimer.unref?.();
  setTimeout(() => flushAll().catch(() => {}), 5_000);
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
    try { await refreshServerProfile(pool, guildId); }
    catch (e) { err(`server refresh ${guildId}: ${e.message}`); }
  }
  for (const { userId, guildId } of users) {
    try { await refreshUserProfile(pool, userId, guildId); }
    catch (e) { err(`user refresh ${userId}: ${e.message}`); }
  }
}

/* ═══════════════════════════════════════════════════════════════
   SERVER REFRESH
   ═══════════════════════════════════════════════════════════════ */
async function refreshServerProfile(pool, guildId, opts = {}) {
  const { force = false } = opts;

  // skip if we just extracted
  const key = `server:${guildId}`;
  const last = LAST_EXTRACT.get(key) || 0;
  if (!force && Date.now() - last < MIN_EXTRACT_GAP_MS) {
    log(`refresh server ${guildId}: skipped (extracted ${Date.now() - last}ms ago)`);
    return null;
  }
  LAST_EXTRACT.set(key, Date.now());

  log(`refresh server ${guildId}: start`);
  const sample = await store.serverCorpusSample(pool, guildId, 200);
  log(`refresh server ${guildId}: sampled ${sample.length}`);
  if (sample.length < 20) {
    log(`refresh server ${guildId}: only ${sample.length} samples, need 20+`);
    return null;
  }

  const total = await store.serverCorpusCount(pool, guildId);
  log(`refresh server ${guildId}: total=${total}, extracting…`);

  const extracted = await extractStyle(sample, { scope: "server", guildId, sampleCount: total });
  if (!extracted) { warn(`refresh server ${guildId}: extraction returned null`); return null; }

  log(`refresh server ${guildId}: got profile — tone="${extracted.tone}" source=${extracted._fallback ? "heuristic" : "llm"}`);

  const clean = await blocked.sanitizeProfile(pool, guildId, extracted);
  clean.sample_count = total;
  clean.confidence = confidenceFromSamples(total);

  await store.saveServerProfile(pool, guildId, clean);
  log(`refresh server ${guildId}: SAVED — confidence=${clean.confidence}%`);
  return clean;
}

/* ═══════════════════════════════════════════════════════════════
   USER REFRESH
   ═══════════════════════════════════════════════════════════════ */
async function refreshUserProfile(pool, userId, guildId, opts = {}) {
  const { force = false } = opts;

  const key = `user:${userId}:${guildId}`;
  const last = LAST_EXTRACT.get(key) || 0;
  if (!force && Date.now() - last < MIN_EXTRACT_GAP_MS) {
    log(`refresh user ${userId}: skipped (recent)`);
    return null;
  }
  LAST_EXTRACT.set(key, Date.now());

  log(`refresh user ${userId}@${guildId}: start`);
  const sample = await store.userCorpusSample(pool, userId, guildId, 200);
  log(`refresh user ${userId}: sampled ${sample.length}`);
  if (sample.length < 15) {
    log(`refresh user ${userId}: only ${sample.length} samples, need 15+`);
    return null;
  }

  const total = await store.userCorpusCount(pool, userId, guildId);
  log(`refresh user ${userId}: total=${total}, extracting…`);

  const extracted = await extractStyle(sample, { scope: "user", userId, guildId, sampleCount: total });
  if (!extracted) { warn(`refresh user ${userId}: extraction returned null`); return null; }

  log(`refresh user ${userId}: got profile — tone="${extracted.tone}"`);

  const clean = await blocked.sanitizeProfile(pool, guildId, extracted);
  clean.sample_count = total;
  clean.confidence = confidenceFromSamples(total);

  await store.saveUserProfile(pool, userId, guildId, clean);
  log(`refresh user ${userId}: SAVED`);
  return clean;
}

/* ═══════════════════════════════════════════════════════════════
   EXTRACTION — LLM chain, then JS fallback
   ═══════════════════════════════════════════════════════════════ */
async function extractStyle(messages, meta) {
  // try LLM first
  const llm = await tryExtractWithLLM(messages, meta);
  if (llm) return llm;

  // fall back to JS heuristic
  log(`extractStyle: LLM failed, using JS heuristic`);
  return jsFallbackProfile(messages, meta);
}

async function tryExtractWithLLM(messages, meta) {
  let callAI;
  try {
    const tools = require("../../tools");
    if (!tools?.callAI) throw new Error("tools.callAI missing");
    callAI = tools.callAI;
  } catch (e) {
    err(`extractStyle: cannot load tools — ${e.message}`);
    return null;
  }

  const sampleBlock = messages.map((m, i) => `${i + 1}. ${m}`).join("\n");
  const scopeHint = meta.scope === "user"
    ? "This is ONE user's messages. Learn THEIR individual voice."
    : "This is a collection of messages from MANY users in one Discord server. Learn the collective server voice.";

  const prompt = `You are a linguistics analyst. Study these Discord messages and extract a style profile.

${scopeHint}

MESSAGES:
${sampleBlock}

Return ONLY valid JSON matching this exact shape:
{
  "tone": "short description of the overall vibe",
  "avg_length": <number, average word count>,
  "phrases": ["recurring phrases, max 12"],
  "punctuation": "how they use punctuation",
  "emoji_style": "how they use emojis",
  "topics": ["common topics, max 8"],
  "avoid": ["things they never do"],
  "sample_messages": ["3-5 short example lines in this exact voice"]
}

Rules:
- Never include slurs or harmful content.
- Sample messages MUST sound like the source but be new text.
- Return valid JSON only. No prose, no markdown fences.`;

  // try each model key in order
  const chain = ["speedster", "genius", "thinker", "creative"];
  for (const modelKey of chain) {
    log(`extractStyle: trying model=${modelKey}`);
    const t0 = Date.now();
    try {
      const raw = await callAI(modelKey, [{ role: "user", content: prompt }], 0.4, 1200);
      log(`extractStyle: ${modelKey} returned in ${Date.now() - t0}ms · len=${raw?.length || 0}`);
      if (!raw || typeof raw !== "string" || raw.length < 10) continue;

      const parsed = safeParseJson(raw);
      if (!parsed) {
        warn(`extractStyle: ${modelKey} JSON parse failed, preview: ${raw.slice(0, 200)}`);
        continue;
      }

      log(`extractStyle: ${modelKey} parsed ok — tone="${parsed.tone}"`);
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
    } catch (e) {
      warn(`extractStyle: ${modelKey} threw — ${e.message}`);
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  return null;
}

/* ═══════════════════════════════════════════════════════════════
   JS HEURISTIC PROFILE — no LLM needed
   ═══════════════════════════════════════════════════════════════ */
function jsFallbackProfile(messages, meta) {
  if (!messages?.length) return null;
  const cleaned = messages.map((m) => String(m || "").trim()).filter(Boolean);
  if (!cleaned.length) return null;

  // avg length
  const wordCounts = cleaned.map((m) => m.split(/\s+/).length);
  const avgLength  = Math.round(wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length);

  // punctuation habits
  const enders = { ".": 0, "?": 0, "!": 0, "": 0 };
  let ellipsis = 0, comma = 0, lower = 0, upper = 0;
  for (const m of cleaned) {
    const last = m.slice(-1);
    if (last === ".") enders["."]++;
    else if (last === "?") enders["?"]++;
    else if (last === "!") enders["!"]++;
    else enders[""]++;
    if (/\.\.\./.test(m)) ellipsis++;
    if (/,/.test(m)) comma++;
    if (m === m.toLowerCase() && /[a-z]/.test(m)) lower++;
    if (m === m.toUpperCase() && /[A-Z]/.test(m)) upper++;
  }
  const total = cleaned.length;
  const pHabits = [];
  if (enders[""] / total > 0.5)  pHabits.push("no ending punctuation");
  if (enders["?"] / total > 0.15) pHabits.push("uses questions");
  if (enders["!"] / total > 0.15) pHabits.push("uses exclamations");
  if (ellipsis / total > 0.15)   pHabits.push("uses ellipsis");
  if (lower / total > 0.6)       pHabits.push("mostly lowercase");
  if (upper / total > 0.3)       pHabits.push("lots of CAPS");
  if (!pHabits.length)           pHabits.push("standard punctuation");

  // emoji style
  const custom  = cleaned.filter((m) => /<a?:\w+:\d+>/.test(m)).length;
  const unicode = cleaned.filter((m) => /[\u{1F600}-\u{1F6FF}\u{2600}-\u{27BF}]/u.test(m)).length;
  let emojiStyle = "no emojis";
  if (custom / total > 0.2)         emojiStyle = "heavy custom emoji use";
  else if (custom / total > 0.05)   emojiStyle = "some custom emojis";
  else if (unicode / total > 0.15)  emojiStyle = "uses unicode emojis";
  else if (unicode / total > 0.05)  emojiStyle = "occasional emojis";

  // recurring 2-3 gram phrases
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

  // tone guess
  const toneBits = [];
  if (avgLength <= 5)  toneBits.push("very short");
  else if (avgLength <= 12) toneBits.push("short");
  else if (avgLength >= 40) toneBits.push("long");
  if (upper / total > 0.2)      toneBits.push("loud");
  else if (lower / total > 0.6) toneBits.push("chill/lowercase");
  if (ellipsis / total > 0.2)   toneBits.push("trailing off");
  const tone = toneBits.length ? toneBits.join(", ") + " style" : "casual discord style";

  // real samples — 4 random picks
  const sample_messages = [...cleaned]
    .sort(() => Math.random() - 0.5)
    .slice(0, 4)
    .map((s) => s.length > 120 ? s.slice(0, 117) + "…" : s);

  log(`jsFallback: avg=${avgLength} phrases=${phrases.length} punc="${pHabits.join(",")}"`);

  return {
    tone,
    avg_length: avgLength,
    phrases,
    punctuation: pHabits.join(", "),
    emoji_style: emojiStyle,
    topics: [],
    avoid: [],
    sample_messages,
    _fallback: true,
  };
}

/* ═══════════════════════════════════════════════════════════════
   JSON PARSER
   ═══════════════════════════════════════════════════════════════ */
function safeParseJson(text) {
  if (!text) return null;
  let cleaned = String(text).replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  cleaned = cleaned.slice(start, end + 1);
  cleaned = cleaned.replace(/,\s*([}\]])/g, "$1");
  try { return JSON.parse(cleaned); }
  catch (e) { warn(`JSON.parse: ${e.message}`); return null; }
}

function asArray(v) {
  if (Array.isArray(v)) return v;
  if (v === null || v === undefined) return [];
  return [v];
}

/* ═══════════════════════════════════════════════════════════════
   FORCE REFRESH
   ═══════════════════════════════════════════════════════════════ */
async function forceRefreshServer(client, guildId) {
  log(`forceRefreshServer ${guildId}`);
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
  if (!guild) { warn(`backfill: guild not in cache`); return { added: 0, reason: "guild not found" }; }

  const channel = await guild.channels.fetch(channelId).catch((e) => {
    warn(`backfill: ch fetch failed — ${e.message}`);
    return null;
  });
  if (!channel?.isTextBased?.()) { warn(`backfill: not text`); return { added: 0, reason: "not text" }; }

  const pool = client.pool;
  const cap = Math.min(limit, DEFAULTS.backfillMax);
  let lastId = null, added = 0, skipped = 0, batches = 0;

  log(`backfill START ch=${channelId} cap=${cap}`);
  const t0 = Date.now();

  while (added < cap) {
    const fetchLimit = Math.min(100, cap - added);
    const opts = { limit: fetchLimit };
    if (lastId) opts.before = lastId;

    const batch = await channel.messages.fetch(opts).catch((e) => {
      warn(`backfill: batch fetch — ${e.message}`);
      return null;
    });
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
      } catch (e) { warn(`backfill insert: ${e.message}`); }
    }

    log(`backfill batch #${batches}: size=${batch.size} added=${added} skipped=${skipped}`);
    lastId = batch.last()?.id;
    if (!lastId || batch.size < fetchLimit) break;
    await new Promise((r) => setTimeout(r, 500));
  }

  await store.serverCorpusPrune(pool, guildId, DEFAULTS.corpusMaxPerChannel);
  await store.saveServerSettings(pool, guildId, { lastBackfill: new Date() });
  await store.logAudit(pool, {
    guildId, actorId: client.user.id, action: "backfill",
    detail: `ch ${channelId}: +${added}, ${skipped} skipped`,
  });

  log(`backfill DONE: +${added} in ${Date.now() - t0}ms (${skipped} skipped)`);

  // force profile extraction immediately
  try {
    log(`backfill: forcing profile refresh…`);
    const prof = await forceRefreshServer(client, guildId);
    log(`backfill: refresh returned ${prof ? "PROFILE ✅" : "null ❌"}`);
  } catch (e) {
    err(`backfill force refresh threw: ${e.message}`);
  }

  return { added, skipped };
}

/* ═══════════════════════════════════════════════════════════════
   EXPORTS
   ═══════════════════════════════════════════════════════════════ */
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
  tryExtractWithLLM,
  jsFallbackProfile,
  _internal: { safeParseJson, asArray, PENDING_SERVER, PENDING_USER, LAST_EXTRACT },
};
