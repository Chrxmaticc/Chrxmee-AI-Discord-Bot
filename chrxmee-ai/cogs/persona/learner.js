// cogs/persona/learner.js
// ingests messages → extracts style profiles via LLM → saves.

const { DEFAULTS, emptyProfile, confidenceFromSamples } = require("./constants");
const store = require("./store");
const blocked = require("./blocked");

// queue for batched re-extraction — guild → Set of scopes that need refresh
const PENDING_SERVER = new Set();       // guildIds
const PENDING_USER   = new Map();       // `${userId}:${guildId}` → { userId, guildId }

const FLUSH_INTERVAL_MS = 30_000;
let flushTimer = null;
let clientRef = null;

/* ═══════════════════════════════════════════════════════════════
   INGEST — called from messageCreate handler
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
  const chk = await blocked.shouldSkipLearning(pool, guildId, message.content);
  if (chk.skip) return;

  // ── SERVER PERSONA ──
  const serverCfg = await store.getServerSettings(pool, guildId);
  if (serverCfg.enabled && serverCfg.channels.includes(message.channelId)) {
    if (!(serverCfg.ignoreBots && message.author.bot)) {
      await store.addServerMessage(pool, {
        guildId,
        channelId: message.channelId,
        authorId: userId,
        content: message.content,
      });
      PENDING_SERVER.add(guildId);
      await store.serverCorpusPrune(pool, guildId, DEFAULTS.corpusMaxPerChannel);
    }
  }

  // ── USER PERSONA ──
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
  }
}

/* ═══════════════════════════════════════════════════════════════
   FLUSH — periodically re-extract profiles
   ═══════════════════════════════════════════════════════════════ */
function startFlushLoop(client) {
  clientRef = client;
  flushTimer = setInterval(() => flushAll().catch(() => {}), FLUSH_INTERVAL_MS);
  flushTimer.unref?.();
}

async function flushAll() {
  if (!clientRef) return;
  const pool = clientRef.pool;

  // SERVER
  const guilds = [...PENDING_SERVER];
  PENDING_SERVER.clear();
  for (const guildId of guilds) {
    try { await refreshServerProfile(pool, guildId); }
    catch (err) { console.error(`[persona] server refresh ${guildId}:`, err.message); }
  }

  // USER
  const users = [...PENDING_USER.values()];
  PENDING_USER.clear();
  for (const { userId, guildId } of users) {
    try { await refreshUserProfile(pool, userId, guildId); }
    catch (err) { console.error(`[persona] user refresh ${userId}:`, err.message); }
  }
}

/* ═══════════════════════════════════════════════════════════════
   SERVER PROFILE EXTRACTION
   ═══════════════════════════════════════════════════════════════ */
async function refreshServerProfile(pool, guildId) {
  const sample = await store.serverCorpusSample(pool, guildId, 200);
  if (sample.length < 20) return;

  const total = await store.serverCorpusCount(pool, guildId);
  const profile = await extractStyle(clientRef, sample, {
    scope: "server",
    guildId,
    sampleCount: total,
  });
  if (!profile) return;

  // sanitize + save
  const clean = await blocked.sanitizeProfile(pool, guildId, profile);
  clean.sample_count = total;
  clean.confidence = confidenceFromSamples(total);

  await store.saveServerProfile(pool, guildId, clean);
}

/* ═══════════════════════════════════════════════════════════════
   USER PROFILE EXTRACTION
   ═══════════════════════════════════════════════════════════════ */
async function refreshUserProfile(pool, userId, guildId) {
  const sample = await store.userCorpusSample(pool, userId, guildId, 200);
  if (sample.length < 15) return;

  const total = await store.userCorpusCount(pool, userId, guildId);
  const profile = await extractStyle(clientRef, sample, {
    scope: "user",
    userId,
    guildId,
    sampleCount: total,
  });
  if (!profile) return;

  const clean = await blocked.sanitizeProfile(pool, guildId, profile);
  clean.sample_count = total;
  clean.confidence = confidenceFromSamples(total);

  await store.saveUserProfile(pool, userId, guildId, clean);
}

/* ═══════════════════════════════════════════════════════════════
   LLM STYLE EXTRACTION
   ═══════════════════════════════════════════════════════════════ */
async function extractStyle(client, messages, meta) {
  try {
    const { callAI } = require("../index") && require("../../tools");
    // fallback: use tools.callAI (kilo/groq/navy chain)
    const tools = require("../../tools");
    if (!tools?.callAI) throw new Error("callAI unavailable");

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
  "punctuation": "how they use punctuation, periods, ellipsis, caps",
  "emoji_style": "how they use emojis (custom, unicode, none, sparingly, etc.)",
  "topics": ["common topics, max 8"],
  "avoid": ["things they never do — no caps, no punctuation, etc."],
  "sample_messages": ["3-5 short example lines in this exact voice"]
}

Rules:
- Never include slurs, hate speech, or anything harmful in phrases or samples.
- Sample messages MUST sound like the original voice but be new text, not copies.
- Keep phrases lowercase unless the source is consistently uppercase.
- Return valid JSON only, no prose, no markdown fences.`;

    const raw = await tools.callAI(
      "thinker",
      [{ role: "user", content: prompt }],
      0.4,
      1200
    );

    const cleaned = String(raw).replace(/```json\s*|```\s*/g, "").trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);

    return {
      tone:           String(parsed.tone || "").slice(0, 200),
      avg_length:     Number(parsed.avg_length || 0),
      phrases:        (parsed.phrases || []).slice(0, 12).map((p) => String(p).slice(0, 80)),
      punctuation:    String(parsed.punctuation || "").slice(0, 200),
      emoji_style:    String(parsed.emoji_style || "").slice(0, 200),
      topics:         (parsed.topics || []).slice(0, 8).map((t) => String(t).slice(0, 60)),
      avoid:          (parsed.avoid || []).slice(0, 8).map((a) => String(a).slice(0, 80)),
      sample_messages:(parsed.sample_messages || []).slice(0, 5).map((s) => String(s).slice(0, 200)),
    };
  } catch (err) {
    console.error("[persona/learner] extractStyle failed:", err.message);
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════════
   FORCE REFRESH (used by backfill)
   ═══════════════════════════════════════════════════════════════ */
async function forceRefreshServer(client, guildId) {
  await refreshServerProfile(client.pool, guildId);
}

async function forceRefreshUser(client, userId, guildId) {
  await refreshUserProfile(client.pool, userId, guildId);
}

/* ═══════════════════════════════════════════════════════════════
   BACKFILL — pull recent messages from a channel
   ═══════════════════════════════════════════════════════════════ */
async function backfillChannel(client, guildId, channelId, limit = DEFAULTS.backfillMax) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return { added: 0, reason: "guild not found" };
  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased?.()) return { added: 0, reason: "not text" };

  const pool = client.pool;
  let lastId = null;
  let totalAdded = 0;
  const cap = Math.min(limit, DEFAULTS.backfillMax);

  while (totalAdded < cap) {
    const fetchLimit = Math.min(100, cap - totalAdded);
    const opts = { limit: fetchLimit };
    if (lastId) opts.before = lastId;

    const batch = await channel.messages.fetch(opts).catch(() => null);
    if (!batch || batch.size === 0) break;

    const msgs = [...batch.values()].filter((m) => !m.author.bot && m.content?.length >= 2);
    for (const m of msgs) {
      const chk = await blocked.shouldSkipLearning(pool, guildId, m.content);
      if (chk.skip) continue;
      await store.addServerMessage(pool, {
        guildId,
        channelId,
        authorId: m.author.id,
        content: m.content,
      });
      totalAdded++;
    }

    lastId = batch.last()?.id;
    if (!lastId || batch.size < fetchLimit) break;

    // brief delay to avoid rate limits
    await new Promise((r) => setTimeout(r, 500));
  }

  await store.serverCorpusPrune(pool, guildId, DEFAULTS.corpusMaxPerChannel);
  await store.saveServerSettings(pool, guildId, { lastBackfill: new Date() });
  await store.logAudit(pool, {
    guildId, actorId: client.user.id, action: "backfill",
    detail: `channel ${channelId}: +${totalAdded}`,
  });
  await forceRefreshServer(client, guildId);
  return { added: totalAdded };
}

/* ═══════════════════════════════════════════════════════════════
   STOP
   ═══════════════════════════════════════════════════════════════ */
function stopFlushLoop() {
  if (flushTimer) clearInterval(flushTimer);
  flushTimer = null;
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
};
