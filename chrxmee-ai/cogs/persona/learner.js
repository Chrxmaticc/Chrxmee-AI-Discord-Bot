// cogs/persona/learner.js
// ingests messages → extracts style profiles via LLM → saves.

const { DEFAULTS, emptyProfile, confidenceFromSamples } = require("./constants");
const store   = require("./store");
const blocked = require("./blocked");

/* ═══════════════════════════════════════════════════════════════
   DEBUG TOGGLE
   ═══════════════════════════════════════════════════════════════ */
const DEBUG = true;
const log = (...a) => { if (DEBUG) console.log("[persona/learner]", ...a); };
const warn = (...a) => console.warn("[persona/learner]", ...a);
const err  = (...a) => console.error("[persona/learner]", ...a);

/* ═══════════════════════════════════════════════════════════════
   STATE
   ═══════════════════════════════════════════════════════════════ */
const PENDING_SERVER = new Set();
const PENDING_USER   = new Map();

const FLUSH_INTERVAL_MS = 30_000;
let flushTimer = null;
let clientRef = null;

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

  // skip blocked content
  let chk;
  try {
    chk = await blocked.shouldSkipLearning(pool, guildId, message.content);
  } catch (e) {
    warn(`shouldSkipLearning threw: ${e.message}`);
    return;
  }
  if (chk.skip) {
    log(`skip (${chk.reason}) guild=${guildId}`);
    return;
  }

  // ── SERVER ──
  try {
    const cfg = await store.getServerSettings(pool, guildId);
    if (cfg.enabled && cfg.channels.includes(message.channelId)) {
      await store.addServerMessage(pool, {
        guildId,
        channelId: message.channelId,
        authorId: userId,
        content: message.content,
      });
      PENDING_SERVER.add(guildId);
      await store.serverCorpusPrune(pool, guildId, DEFAULTS.corpusMaxPerChannel);
      log(`+1 server msg guild=${guildId} ch=${message.channelId}`);
    }
  } catch (e) {
    err(`server ingest failed: ${e.message}`);
  }

  // ── USER ──
  try {
    const opt = await store.userIsOptedIn(pool, userId, guildId);
    if (opt.optedIn) {
      await store.addUserMessage(pool, {
        userId,
        guildId,
        channelId: message.channelId,
        content: message.content,
      });
      PENDING_USER.set(`${userId}:${guildId}`, { userId, guildId });
      await store.userCorpusPrune(pool, userId, guildId, DEFAULTS.userMaxCorpus);
      log(`+1 user msg ${userId} in ${guildId}`);
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
  log("flush loop started (30s interval)");
  flushTimer = setInterval(() => {
    flushAll().catch((e) => err(`flushAll threw: ${e.message}`));
  }, FLUSH_INTERVAL_MS);
  flushTimer.unref?.();

  // run once shortly after boot to catch anything queued
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
  log(`flush: ${guilds.length} server(s), ${PENDING_USER.size} user(s)`);

  for (const guildId of guilds) {
    try {
      await refreshServerProfile(pool, guildId);
    } catch (e) {
      err(`server refresh ${guildId}: ${e.message}`);
    }
  }

  const users = [...PENDING_USER.values()];
  PENDING_USER.clear();
  for (const { userId, guildId } of users) {
    try {
      await refreshUserProfile(pool, userId, guildId);
    } catch (e) {
      err(`user refresh ${userId}@${guildId}: ${e.message}`);
    }
  }
}

/* ═══════════════════════════════════════════════════════════════
   SERVER REFRESH
   ═══════════════════════════════════════════════════════════════ */
async function refreshServerProfile(pool, guildId) {
  const sample = await store.serverCorpusSample(pool, guildId, 200);
  log(`server ${guildId}: sampled ${sample.length} msgs`);

  if (sample.length < 20) {
    log(`server ${guildId}: too few samples (${sample.length}), skipping`);
    return null;
  }

  const total = await store.serverCorpusCount(pool, guildId);
  log(`server ${guildId}: total corpus = ${total}, calling LLM…`);

  const extracted = await extractStyle(clientRef, sample, {
    scope: "server",
    guildId,
    sampleCount: total,
  });

  if (!extracted) {
    warn(`server ${guildId}: extractStyle returned null`);
    return null;
  }

  log(`server ${guildId}: LLM returned tone="${extracted.tone}" phrases=${extracted.phrases.length}`);

  const clean = await blocked.sanitizeProfile(pool, guildId, extracted);
  clean.sample_count = total;
  clean.confidence = confidenceFromSamples(total);

  await store.saveServerProfile(pool, guildId, clean);
  log(`server ${guildId}: profile SAVED — confidence=${clean.confidence}%`);
  return clean;
}

/* ═══════════════════════════════════════════════════════════════
   USER REFRESH
   ═══════════════════════════════════════════════════════════════ */
async function refreshUserProfile(pool, userId, guildId) {
  const sample = await store.userCorpusSample(pool, userId, guildId, 200);
  log(`user ${userId}@${guildId}: sampled ${sample.length} msgs`);

  if (sample.length < 15) {
    log(`user ${userId}: too few samples (${sample.length}), skipping`);
    return null;
  }

  const total = await store.userCorpusCount(pool, userId, guildId);
  log(`user ${userId}: total = ${total}, calling LLM…`);

  const extracted = await extractStyle(clientRef, sample, {
    scope: "user",
    userId,
    guildId,
    sampleCount: total,
  });

  if (!extracted) {
    warn(`user ${userId}: extractStyle returned null`);
    return null;
  }

  log(`user ${userId}: LLM returned tone="${extracted.tone}"`);

  const clean = await blocked.sanitizeProfile(pool, guildId, extracted);
  clean.sample_count = total;
  clean.confidence = confidenceFromSamples(total);

  await store.saveUserProfile(pool, userId, guildId, clean);
  log(`user ${userId}: profile SAVED — confidence=${clean.confidence}%`);
  return clean;
}

/* ═══════════════════════════════════════════════════════════════
   LLM EXTRACTION — the fixed version
   ═══════════════════════════════════════════════════════════════ */
async function extractStyle(client, messages, meta) {
  // ── resolve the AI caller ──
  let callAI;
  try {
    const tools = require("../../tools");
    if (!tools?.callAI) throw new Error("tools.callAI is missing — check exports");
    callAI = tools.callAI;
  } catch (e) {
    err(`cannot load tools.callAI: ${e.message}`);
    return null;
  }

  // ── build prompt ──
  const sampleBlock = messages
    .map((m, i) => `${i + 1}. ${m}`)
    .join("\n");

  const scopeHint = meta.scope === "user"
    ? "This is ONE user's messages. Learn THEIR individual voice."
    : "This is a collection of messages from MANY users in one Discord server. Learn the collective server voice/style.";

  const prompt = `You are a linguistics analyst. Study these Discord messages and extract a style profile.

${scopeHint}

MESSAGES:
${sampleBlock}

Return ONLY valid JSON matching this exact shape:
{
  "tone": "short description of the overall vibe",
  "avg_length": <number, average word count per message>,
  "phrases": ["recurring phrases, max 12"],
  "punctuation": "how they use punctuation",
  "emoji_style": "how they use emojis",
  "topics": ["common topics, max 8"],
  "avoid": ["things they never do"],
  "sample_messages": ["3-5 short example lines in this exact voice"]
}

Rules:
- Never include slurs, hate speech, or anything harmful.
- Sample messages MUST sound like the original voice but be new text.
- Return valid JSON only, no prose, no markdown fences.`;

  // ── call the LLM ──
  log(`calling LLM (${messages.length} samples, scope=${meta.scope})…`);
  const t0 = Date.now();
  let raw;
  try {
    raw = await callAI(
      "thinker",
      [{ role: "user", content: prompt }],
      0.4,
      1200
    );
  } catch (e) {
    err(`LLM call threw: ${e.message}`);
    return null;
  }
  const dt = Date.now() - t0;
  log(`LLM returned in ${dt}ms · length ${raw?.length || 0}`);

  if (!raw || typeof raw !== "string") {
    warn(`LLM returned non-string: ${typeof raw}`);
    return null;
  }

  // ── parse JSON robustly ──
  let parsed = safeParseJson(raw);
  if (!parsed) {
    warn(`JSON parse failed. Raw preview: ${raw.slice(0, 300)}`);
    return null;
  }

  log(`parsed OK: tone="${parsed.tone}" avg_length=${parsed.avg_length}`);

  // ── normalize shape ──
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
   JSON PARSER — handles fences, extra prose, trailing commas
   ═══════════════════════════════════════════════════════════════ */
function safeParseJson(text) {
  if (!text) return null;

  // strip markdown fences
  let cleaned = String(text)
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  // find first { and last }
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  cleaned = cleaned.slice(start, end + 1);

  // strip trailing commas before } or ]
  cleaned = cleaned.replace(/,\s*([}\]])/g, "$1");

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    warn(`JSON.parse error: ${e.message}`);
    return null;
  }
}

function asArray(v) {
  if (Array.isArray(v)) return v;
  if (v === null || v === undefined) return [];
  return [v];
}

/* ═══════════════════════════════════════════════════════════════
   FORCE REFRESH (backfill + manual)
   ═══════════════════════════════════════════════════════════════ */
async function forceRefreshServer(client, guildId) {
  return refreshServerProfile(client.pool, guildId);
}

async function forceRefreshUser(client, userId, guildId) {
  return refreshUserProfile(client.pool, userId, guildId);
}

/* ═══════════════════════════════════════════════════════════════
   BACKFILL
   ═══════════════════════════════════════════════════════════════ */
async function backfillChannel(client, guildId, channelId, limit = DEFAULTS.backfillMax) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return { added: 0, reason: "guild not found" };

  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased?.()) return { added: 0, reason: "not text channel" };

  const pool = client.pool;
  let lastId = null;
  let totalAdded = 0;
  let skipped = 0;
  const cap = Math.min(limit, DEFAULTS.backfillMax);

  log(`backfill: ch=${channelId} cap=${cap}`);
  const t0 = Date.now();

  while (totalAdded < cap) {
    const fetchLimit = Math.min(100, cap - totalAdded);
    const opts = { limit: fetchLimit };
    if (lastId) opts.before = lastId;

    const batch = await channel.messages.fetch(opts).catch((e) => {
      warn(`fetch failed: ${e.message}`);
      return null;
    });
    if (!batch || batch.size === 0) break;

    const msgs = [...batch.values()].filter((m) => !m.author.bot && m.content?.length >= 2);
    for (const m of msgs) {
      let chk;
      try {
        chk = await blocked.shouldSkipLearning(pool, guildId, m.content);
      } catch { skipped++; continue; }
      if (chk.skip) { skipped++; continue; }

      try {
        await store.addServerMessage(pool, {
          guildId,
          channelId,
          authorId: m.author.id,
          content: m.content,
        });
        totalAdded++;
      } catch (e) {
        warn(`insert failed: ${e.message}`);
      }
    }

    log(`  batch: got ${batch.size}, added total ${totalAdded}, skipped ${skipped}`);

    lastId = batch.last()?.id;
    if (!lastId || batch.size < fetchLimit) break;
    await new Promise((r) => setTimeout(r, 500));
  }

  await store.serverCorpusPrune(pool, guildId, DEFAULTS.corpusMaxPerChannel);
  await store.saveServerSettings(pool, guildId, { lastBackfill: new Date() });
  await store.logAudit(pool, {
    guildId,
    actorId: client.user.id,
    action: "backfill",
    detail: `ch ${channelId}: +${totalAdded}, skipped ${skipped}`,
  });

  log(`backfill done: +${totalAdded} in ${Date.now() - t0}ms (${skipped} skipped)`);

  // force profile refresh immediately
  await forceRefreshServer(client, guildId);

  return { added: totalAdded, skipped };
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
  backfillChannel,
  extractStyle,
  // expose internals for testing
  _internal: { safeParseJson, asArray },
};
