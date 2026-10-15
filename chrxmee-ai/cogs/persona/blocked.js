// cogs/persona/blocked.js
// blocked-word engine. hardcoded slurs + guild's swear_block table + manual additions.

const { HARD_BLOCKED, SOFT_BLOCKED_EXTRA } = require("./constants");
const store = require("./store");

// pre-compile regexes once
const HARD_REGEXES = HARD_BLOCKED.map((w) => ({
  word: w,
  re: new RegExp(`\\b${escapeRegex(w)}\\b`, "i"),
}));

const SOFT_REGEXES = SOFT_BLOCKED_EXTRA.map((w) => ({
  word: w,
  re: new RegExp(`\\b${escapeRegex(w)}\\b`, "i"),
}));

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* ═══════════════════════════════════════════════════════════════
   HARD CHECK — cannot be overridden
   ═══════════════════════════════════════════════════════════════ */
function containsHardBlocked(text) {
  if (!text) return null;
  for (const { word, re } of HARD_REGEXES) {
    if (re.test(text)) return word;
  }
  return null;
}

/* ═══════════════════════════════════════════════════════════════
   SOFT CHECK — slurs that can be toggled off
   ═══════════════════════════════════════════════════════════════ */
function containsSoftBlocked(text) {
  if (!text) return null;
  for (const { word, re } of SOFT_REGEXES) {
    if (re.test(text)) return word;
  }
  return null;
}

/* ═══════════════════════════════════════════════════════════════
   GUILD SWEAR BLOCK — reads from your existing swear_block table
   ═══════════════════════════════════════════════════════════════ */
async function getGuildSwearBlock(pool, guildId) {
  try {
    const globalRes = await pool.query(
      `SELECT words FROM swear_block WHERE guild_id = '0' AND enabled = TRUE`
    );
    const guildRes = guildId
      ? await pool.query(
          `SELECT words FROM swear_block WHERE guild_id = $1 AND enabled = TRUE`,
          [guildId]
        )
      : { rows: [] };

    const combined = new Set();
    for (const r of globalRes.rows) {
      for (const w of r.words || []) combined.add(w.toLowerCase());
    }
    for (const r of guildRes.rows) {
      for (const w of r.words || []) combined.add(w.toLowerCase());
    }
    return [...combined];
  } catch {
    return [];
  }
}

/* ═══════════════════════════════════════════════════════════════
   FULL CHECK — used during learning (skip bad messages)
   ═══════════════════════════════════════════════════════════════ */
async function shouldSkipLearning(pool, guildId, text) {
  if (!text || text.length < 2) return { skip: true, reason: "too short" };

  const hard = containsHardBlocked(text);
  if (hard) return { skip: true, reason: `hard-blocked: ${hard}` };

  const soft = containsSoftBlocked(text);
  if (soft) return { skip: true, reason: `soft-blocked: ${soft}` };

  // guild swear block
  const guildWords = await getGuildSwearBlock(pool, guildId);
  for (const w of guildWords) {
    if (new RegExp(`\\b${escapeRegex(w)}\\b`, "i").test(text)) {
      return { skip: true, reason: `guild swear block: ${w}` };
    }
  }

  // manual blocked words
  const manual = await store.blockedList(pool, guildId);
  for (const m of manual) {
    if (new RegExp(`\\b${escapeRegex(m.word)}\\b`, "i").test(text)) {
      return { skip: true, reason: `manual block: ${m.word}` };
    }
  }

  return { skip: false };
}

/* ═══════════════════════════════════════════════════════════════
   OUTPUT FILTER — used before speaking (strip blocked words)
   ═══════════════════════════════════════════════════════════════ */
async function filterOutput(pool, guildId, text) {
  if (!text) return { text: "", blocked: [] };
  let out = text;
  const found = [];

  // hard blocks
  for (const { word, re } of HARD_REGEXES) {
    if (re.test(out)) {
      out = out.replace(re, "***");
      found.push(word);
    }
  }

  // soft blocks
  for (const { word, re } of SOFT_REGEXES) {
    if (re.test(out)) {
      out = out.replace(re, "***");
      found.push(word);
    }
  }

  // guild swear
  const guildWords = await getGuildSwearBlock(pool, guildId);
  for (const w of guildWords) {
    const re = new RegExp(`\\b${escapeRegex(w)}\\b`, "gi");
    if (re.test(out)) {
      out = out.replace(re, "***");
      found.push(w);
    }
  }

  // manual blocked
  const manual = await store.blockedList(pool, guildId);
  for (const m of manual) {
    const re = new RegExp(`\\b${escapeRegex(m.word)}\\b`, "gi");
    if (re.test(out)) {
      out = out.replace(re, "***");
      found.push(m.word);
    }
  }

  return { text: out, blocked: [...new Set(found)] };
}

/* ═══════════════════════════════════════════════════════════════
   PURGE STYLE PROFILES — filter learned phrases / samples
   ═══════════════════════════════════════════════════════════════ */
async function sanitizeProfile(pool, guildId, profile) {
  if (!profile) return profile;
  const clean = { ...profile };

  const cleanArr = async (arr) => {
    const out = [];
    for (const item of arr || []) {
      const chk = await shouldSkipLearning(pool, guildId, String(item));
      if (!chk.skip) out.push(item);
    }
    return out;
  };

  clean.phrases         = await cleanArr(profile.phrases);
  clean.sample_messages = await cleanArr(profile.sample_messages);
  return clean;
}

module.exports = {
  containsHardBlocked,
  containsSoftBlocked,
  getGuildSwearBlock,
  shouldSkipLearning,
  filterOutput,
  sanitizeProfile,
  escapeRegex,
};
