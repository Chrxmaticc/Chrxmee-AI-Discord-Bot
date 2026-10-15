// cogs/persona/speaker.js
// decides whether to speak, builds the prompt, generates a reply.

const { DEFAULTS, CONTEXT_WINDOW, emptyProfile } = require("./constants");
const store = require("./store");
const blocked = require("./blocked");

/* ═══════════════════════════════════════════════════════════════
   SERVER SPEAK — called on every message in a learning channel
   ═══════════════════════════════════════════════════════════════ */
async function considerServerSpeak(client, message) {
  if (!message.guild) return null;
  if (message.author.bot) return null;

  const pool = client.pool;
  const cfg = await store.getServerSettings(pool, message.guildId);
  if (!cfg.enabled) return null;
  if (!cfg.channels.includes(message.channelId)) return null;

  // cooldown
  const lastSpoke = await store.cooldownGet(pool, message.channelId);
  if (Date.now() - lastSpoke < cfg.cooldownMs) return null;

  // profile must exist and have enough samples
  const prof = await store.getServerProfile(pool, message.guildId);
  const total = await store.serverCorpusCount(pool, message.guildId);
  if (total < cfg.minMessages) return null;
  if (!prof.profile || total < 20) return null;

  // mention bypasses chance
  const mentioned = cfg.mentions && message.mentions.has(client.user);
  if (mentioned) {
    return await generateServerReply(client, message, cfg, prof, { mentioned: true });
  }

  // chance
  const chance = computeChance(cfg, prof, message);
  if (Math.random() * 100 > chance) return null;

  return await generateServerReply(client, message, cfg, prof, { mentioned: false });
}

/* ═══════════════════════════════════════════════════════════════
   USER SPEAK — called on demand (/persona user speak)
   ═══════════════════════════════════════════════════════════════ */
async function generateUserSpeak(client, userId, guildId, topic, opts = {}) {
  const pool = client.pool;

  const opt = await store.userIsOptedIn(pool, userId, guildId);
  if (!opt.optedIn) return { ok: false, reason: "user not opted in" };

  const total = await store.userCorpusCount(pool, userId, guildId);
  if (total < opt.minMessages) {
    return { ok: false, reason: `needs ${opt.minMessages} messages, has ${total}` };
  }

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
    message: null,
    topic,
    profile: prof.profile,
    manualEdit: prof.manualEdit,
    gifsAllowed: true,
    extras: { referencedUserId: userId },
  });

  if (!reply) return { ok: false, reason: "generation failed" };

  // filter output
  const filtered = await blocked.filterOutput(pool, guildId, reply);
  return { ok: true, text: filtered.text, blocked: filtered.blocked };
}

/* ═══════════════════════════════════════════════════════════════
   GENERATE — server reply
   ═══════════════════════════════════════════════════════════════ */
async function generateServerReply(client, message, cfg, prof, { mentioned }) {
  const pool = client.pool;
  const guild = message.guild;

  // fetch recent context
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
    extras: {
      authorName: message.member?.displayName || message.author.username,
    },
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
   CORE GENERATION — talks to the LLM
   ═══════════════════════════════════════════════════════════════ */
async function generate(client, opts) {
  const {
    scope, guild, message, context, topic,
    profile, manualEdit, gifsAllowed, mentioned, extras = {},
  } = opts;

  try {
    const tools = require("../../tools");
    if (!tools?.callAI) throw new Error("callAI unavailable");

    const profileBlock = buildProfileBlock(profile);
    const manualBlock = manualEdit ? buildManualBlock(manualEdit) : "";
    const ctxBlock = context?.length
      ? context.map((m) => `${m.author}: ${m.content}`).join("\n")
      : "";

    const mentionHint = mentioned ? "The bot WAS @mentioned. You MUST reply directly to them." : "";

    const gifHint = gifsAllowed
      ? `If a GIF or custom emoji fits naturally, include ONE. Use custom server emojis like <:name:id> or a single GIF URL. Don't overuse.`
      : `Do NOT include GIFs or URLs. Custom server emojis are OK.`;

    const prompt = scope === "user"
      ? buildUserPrompt({ profileBlock, manualBlock, topic, targetName: extras.targetName, extras })
      : buildServerPrompt({ profileBlock, manualBlock, ctxBlock, message, extras, mentionHint, gifHint });

    const raw = await tools.callAI(
      "creative",
      [{ role: "user", content: prompt }],
      0.85,
      400
    );

    let out = String(raw || "").trim();

    // strip any accidental "assistant:" or quotes
    out = out.replace(/^(assistant|chromed|bot)\s*:\s*/i, "").trim();
    out = out.replace(/^["'`]+|["'`]+$/g, "").trim();

    if (!out || out.length < 2) return null;
    if (out.length > 1900) out = out.slice(0, 1900) + "…";

    return out;
  } catch (err) {
    console.error("[persona/speaker] generate failed:", err.message);
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════════
   PROMPT BUILDERS
   ═══════════════════════════════════════════════════════════════ */
function buildProfileBlock(profile) {
  if (!profile) return "";
  const lines = [];
  if (profile.tone)          lines.push(`tone: ${profile.tone}`);
  if (profile.avg_length)    lines.push(`avg message length: ~${profile.avg_length} words`);
  if (profile.punctuation)   lines.push(`punctuation: ${profile.punctuation}`);
  if (profile.emoji_style)   lines.push(`emoji style: ${profile.emoji_style}`);
  if (profile.phrases?.length)  lines.push(`recurring phrases: ${profile.phrases.map((p) => `"${p}"`).join(", ")}`);
  if (profile.topics?.length)   lines.push(`common topics: ${profile.topics.join(", ")}`);
  if (profile.avoid?.length)    lines.push(`never do: ${profile.avoid.join(", ")}`);
  if (profile.sample_messages?.length) {
    lines.push(`example lines in this voice:\n${profile.sample_messages.map((s) => `  • ${s}`).join("\n")}`);
  }
  return lines.join("\n");
}

function buildManualBlock(manual) {
  if (!manual) return "";
  const lines = [];
  if (manual.tone)     lines.push(`override tone: ${manual.tone}`);
  if (manual.phrases?.length)  lines.push(`prefer phrases: ${manual.phrases.join(", ")}`);
  if (manual.avoid?.length)    lines.push(`never say: ${manual.avoid.join(", ")}`);
  if (manual.extra)    lines.push(`extra instructions: ${manual.extra}`);
  return lines.length ? lines.join("\n") : "";
}

function buildServerPrompt({ profileBlock, manualBlock, ctxBlock, message, extras, mentionHint, gifHint }) {
  return `You are about to speak as the general voice of a Discord server, matching the community style.

# LEARNED STYLE PROFILE
${profileBlock}
${manualBlock ? `\n# MANUAL OVERRIDES (highest priority)\n${manualBlock}` : ""}

# RECENT CHAT CONTEXT
${ctxBlock || "(no recent messages)"}

# THE MESSAGE YOU'RE REPLYING TO
${extras.authorName || "user"}: ${message.content}

${mentionHint}

# RULES
- Match the style profile exactly — same tone, same length, same vibe.
- Do NOT mention that you're a bot or AI.
- Do NOT copy any line from the context; write something NEW that fits.
- Keep it natural and short — 1-2 sentences max unless the profile says otherwise.
- ${gifHint}
- Never output slurs, hate speech, or anything harmful.
- Output ONLY the reply text. No quotes, no labels, no "assistant:" prefix.`;
}

function buildUserPrompt({ profileBlock, manualBlock, topic, targetName, extras }) {
  return `You are mimicking ONE specific user's writing voice on Discord.

# THEIR LEARNED STYLE PROFILE
${profileBlock}
${manualBlock ? `\n# MANUAL OVERRIDES (highest priority)\n${manualBlock}` : ""}

# YOUR TASK
Write a short Discord message as ${targetName || "this user"}, in their exact voice, about the topic below.

TOPIC: ${topic}

# RULES
- Sound EXACTLY like the style profile — same tone, length, punctuation habits, phrases.
- It should read like something this user would actually type.
- Do NOT include the user's name or any label.
- Do NOT mention that you're a bot or an AI.
- Do NOT copy directly from the samples — write something new in that voice.
- Keep it short and natural.
- Never output slurs, hate speech, or anything harmful.
- Output ONLY the message text. No quotes, no "assistant:" prefix.`;
}

/* ═══════════════════════════════════════════════════════════════
   CHANCE COMPUTATION
   ═══════════════════════════════════════════════════════════════ */
function computeChance(cfg, prof, message) {
  let chance = cfg.replyChance;

  // mentioned is handled separately (bypasses this), so no boost here
  // question boost
  if (/\?\s*$/.test(message.content || "")) chance += DEFAULTS.questionBoost;

  // topic match multiplier
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
   FETCH RECENT CONTEXT
   ═══════════════════════════════════════════════════════════════ */
async function fetchContext(channel, beforeMessageId, limit = 15) {
  try {
    const msgs = await channel.messages.fetch({ limit, before: beforeMessageId });
    return [...msgs.values()]
      .reverse()
      .filter((m) => m.content && m.content.length < 500)
      .map((m) => ({
        author: m.member?.displayName || m.author.username,
        content: m.content.slice(0, 300),
      }));
  } catch {
    return [];
  }
}

module.exports = {
  considerServerSpeak,
  generateUserSpeak,
  generate,
  computeChance,
  fetchContext,
  buildProfileBlock,
};
