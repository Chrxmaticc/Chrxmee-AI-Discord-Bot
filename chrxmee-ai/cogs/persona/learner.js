// cogs/persona/learner.js
// ingests messages → extracts style profiles via LLM → saves.

const { DEFAULTS, emptyProfile, confidenceFromSamples } = require("./constants");
const store   = require("./store");
const blocked = require("./blocked");

/* ═══════════════════════════════════════════════════════════════
   DEBUG TOGGLE — set false once it works
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

/* ═══════════════════════════════════════════════════════════════
   INGEST
   ═══════════════════════════════════════════════════════════════ */
async function ingestMessage(client, message) {
  log(`ingest: ch=${message.channelId} author=${message.author.id} len=${message.content?.length || 0} bot=${message.author.bot} inGuild=${!!message.guild}`);

  if (!message.guild)                                  { log("bail: no guild"); return; }
  if (message.author.bot)                              { log("bail: bot author"); return; }
  if (!message.content || message.content.length < 2)  { log("bail: too short"); return; }
  if (message.content.length > 2000)                   { log("bail: too long"); return; }

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
    log(`server: enabled=${cfg.enabled} whitelisted=${cfg.channels.includes(message.channelId)} channels=[${cfg.channels.join(",")}]`);
    if (cfg.enabled && cfg.channels.includes(message.channelId)) {
      await store.addServerMessage(pool, {
        guildId, channelId: message.channelId, authorId: userId, content: message.content,
      });
      PENDING_SERVER.add(guildId);
      await store.serverCorpusPrune(pool, guildId, DEFAULTS.corpusMaxPerChannel);
      log(`+1 server msg → queued (pending servers: ${PENDING_SERVER.size})`);
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
      log(`+1 user msg → queued (pending users: ${PENDING_USER.size})`);
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
async function refreshServerProfile(pool, guildId) {
  log(`refresh server ${guildId}: start`);
  const sample = await store.serverCorpusSample(pool, guildId, 200);
  log(`refresh server ${guildId}: sampled ${sample.length}`);
  if (sample.length < 20) { log(`refresh server ${guildId}: too few samples, skip`); return null; }

  const total = await store.serverCorpusCount(pool, guildId);
  log(`refresh server ${guildId}: total=${total}, calling LLM`);

  const extracted = await extractStyle(clientRef, sample, { scope: "server", guildId, sampleCount: total });
  if (!extracted) { warn(`refresh server ${guildId}: extractStyle returned null`); return null; }

  log(`refresh server ${guildId}: LLM ok — tone="${extracted.tone}" phrases=${extracted.phrases.length}`);

  const clean = await blocked.sanitizeProfile(pool, guildId, extracted);
  clean.sample_count = total;
  clean.confidence = confidenceFromSamples(total);

  await store.saveServerProfile(pool, guildId, clean);
  log(`refresh server ${guildId}: SAVED (confidence=${clean.confidence}%)`);
  return clean;
}

/* ═══════════════════════════════════════════════════════════════
   USER REFRESH
   ═══════════════════════════════════════════════════════════════ */
async function refreshUserProfile(pool, userId, guildId) {
  log(`refresh user ${userId}@${guildId}: start`);
  const sample = await store.userCorpusSample(pool, userId, guildId, 200);
  log(`refresh user ${userId}: sampled ${sample.length}`);
  if (sample.length < 15) { log(`refresh user ${userId}: too few samples, skip`); return null; }

  const total = await store.userCorpusCount(pool, userId, guildId);
  log(`refresh user ${userId}: total=${total}, calling LLM`);

  const extracted = await extractStyle(clientRef, sample, { scope: "user", userId, guildId, sampleCount: total });
  if (!extracted) { warn(`refresh user ${userId}: extractStyle returned null`); return null; }

  log(`refresh user ${userId}: LLM ok — tone="${extracted.tone}"`);

  const clean = await blocked.sanitizeProfile(pool, guildId, extracted);
  clean.sample_count = total;
  clean.confidence = confidenceFromSamples(total);

  await store.saveUserProfile(pool, userId, guildId, clean);
  log(`refresh user ${userId}: SAVED`);
  return clean;
}

/* ═══════════════════════════════════════════════════════════════
   LLM EXTRACTION
   ═══════════════════════════════════════════════════════════════ */
async function extractStyle(client, messages, meta) {
  /* ── resolve tools.callAI ── */
  let callAI;
  try {
    const tools = require("../../tools");
    if (!tools?.callAI) throw new Error("tools.callAI missing from exports");
    callAI = tools.callAI;
    log(`extractStyle: tools loaded (scope=${meta.scope}, samples=${messages.length})`);
  } catch (e) {
    err(`extractStyle: cannot load tools.callAI — ${e.message}`);
    return null;
  }

  /* ── build prompt ── */
  const sampleBlock = messages.map((m, i) => `${i + 1}. ${m}`).join("\n");
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

  /* ── call LLM ── */
  log(`extractStyle: calling LLM…`);
  const t0 = Date.now();
  let raw;
  try {
    raw = await callAI("thinker", [{ role: "user", content: prompt }], 0.4, 1200);
  } catch (e) {
    err(`extractStyle: LLM call threw — ${e.message}`);
    return null;
  }
  log(`extractStyle: LLM returned in ${Date.now() - t0}ms · len=${raw?.length || 0}`);

  if (!raw || typeof raw !== "string") {
    warn(`extractStyle: non-string response (${typeof raw})`);
    return null;
  }

  /* ── parse ── */
  const parsed = safeParseJson(raw);
  if (!parsed) {
    warn(`extractStyle: JSON parse failed. Preview: ${raw.slice(0, 400)}`);
    return null;
  }

  log(`extractStyle: parsed ok — tone="${parsed.tone}" avg=${parsed.avg_length}`);

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
  catch (e) { warn(`JSON.parse error: ${e.message}`); return null; }
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
  if (!guild) { warn(`backfill: guild ${guildId} not in cache`); return { added: 0, reason: "guild not found" }; }

  const channel = await guild.channels.fetch(channelId).catch((e) => {
    warn(`backfill: fetch channel failed — ${e.message}`);
    return null;
  });
  if (!channel?.isTextBased?.()) { warn(`backfill: ch ${channelId} not text`); return { added: 0, reason: "not text" }; }

  const pool = client.pool;
  const cap = Math.min(limit, DEFAULTS.backfillMax);
  let lastId = null;
  let added = 0;
  let skipped = 0;
  let batches = 0;

  log(`backfill START ch=${channelId} cap=${cap}`);
  const t0 = Date.now();

  while (added < cap) {
    const fetchLimit = Math.min(100, cap - added);
    const opts = { limit: fetchLimit };
    if (lastId) opts.before = lastId;

    const batch = await channel.messages.fetch(opts).catch((e) => {
      warn(`backfill: fetch batch failed — ${e.message}`);
      return null;
    });
    if (!batch || batch.size === 0) { log(`backfill: no more messages`); break; }

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

  // ── IMPORTANT: force immediate profile extraction ──
  try {
    log(`backfill: forcing profile refresh…`);
    const prof = await forceRefreshServer(client, guildId);
    log(`backfill: refresh returned ${prof ? "PROFILE" : "null"}`);
  } catch (e) {
    err(`backfill force refresh threw: ${e.message}`);
  }

  return { added, skipped };
}

/* ═══════════════════════════════════════════════════════════════
   MANUAL TRIGGER — for debugging / forcing extraction
   ═══════════════════════════════════════════════════════════════ */
async function forceExtractNow(client, guildId) {
  log(`forceExtractNow ${guildId}`);
  return refreshServerProfile(client.pool, guildId);
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
  _internal: { safeParseJson, asArray, PENDING_SERVER, PENDING_USER },
};
