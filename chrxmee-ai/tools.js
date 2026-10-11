// ═════════════════════════════════════════════════════════════════
// tools.js — chromed universal toolbox
// models · web (SSRF-safe) · site recognition · kilo · video→audio
// ═════════════════════════════════════════════════════════════════

const { Pool } = require("pg");
const net = require("node:net");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const dnsPromises = require("node:dns").promises;

let ffmpeg = null;
let ffmpegStaticPath = null;
try {
  ffmpeg = require("fluent-ffmpeg");
  ffmpegStaticPath = require("ffmpeg-static");
  if (ffmpegStaticPath) ffmpeg.setFfmpegPath(ffmpegStaticPath);
} catch (e) {
  console.warn("fluent-ffmpeg / ffmpeg-static not installed — video_to_audio will be disabled");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

/* ═══════════════════════════════════════════════════════════════
   0 · MODEL OUTPUT CLEANER
   Strips safety headers + leaked special tokens from free routes
   ═══════════════════════════════════════════════════════════════ */
function stripSafety(text) {
  if (!text || typeof text !== "string") return "";
  let out = text;
  for (let i = 0; i < 5; i++) {
    const before = out;
    out = out
      .replace(/^\s*(?:user|response|assistant|content|request|input|output)\s*(?:safety|moderation|eval|guard|filter|rating|classification)\s*[:=]\s*\S+\s*$/gim, "")
      .replace(/^\s*(?:safety|moderation|classification|rating|guard)\s*[:=]\s*\S+\s*$/gim, "")
      .replace(/^\s*(?:unsafe|safe)\s*$/gim, "");
    if (out === before) break;
  }
  return out.trim();
}

function stripSpecialTokens(text) {
  if (!text || typeof text !== "string") return "";
  let out = text;

  // 1. <|...|> style tokens (Llama, Qwen, DeepSeek, Mistral)
  out = out.replace(/<\|[^|>]*\|>/g, "");

  // 2. Tool call section blocks
  out = out.replace(/<\|tool_calls_section_begin\|>[\s\S]*?<\|tool_calls_section_end\|>/g, "");
  out = out.replace(/<\|tool_call_begin\|>[\s\S]*?<\|tool_call_end\|>/g, "");
  out = out.replace(/<\|tool_call_start\|>[\s\S]*?<\|tool_call_end\|>/g, "");

  // 3. Leftover bracketed tool calls: [url_fetch(url='...')], [browse({...})]
  out = out.replace(/\[\s*(?:functions\.)?\w+\s*\([^)]*\)\s*\]/g, "");

  // 4. "assistant" prefix bleeding at line start
  out = out.replace(/^\s*assistant\s*$/gim, "");

  // 5. JSON tool-call shape that leaked as text
  out = out.replace(/\{\s*"?(?:tool|function|name)"?\s*:\s*"[^"]+"\s*,\s*"?(?:arguments|parameters)"?\s*:[\s\S]*?\}/g, "");

  // 6. Clean up
  out = out.replace(/^\s*\n+/, "").replace(/\n{3,}/g, "\n\n").trim();
  return out;
}

function cleanModelOutput(text) {
  return stripSpecialTokens(stripSafety(text || ""));
}

/* ═══════════════════════════════════════════════════════════════
   1 · MODELS + AI CALL (Kilo primary → Groq → Navy fallback)
   ═══════════════════════════════════════════════════════════════ */
const MODELS = {
  genius:    { label: "Genius",    providers: [
    { name: "groq", id: "openai/gpt-oss-120b", url: "https://api.groq.com/openai/v1/chat/completions", keyEnv: "GROQ_API_KEY" },
    { name: "navy", id: "gpt-4.1",            url: "https://api.navy/v1/chat/completions",            keyEnv: "NAVY_API_KEY" },
  ]},
  speedster: { label: "Speedster", providers: [
    { name: "groq", id: "openai/gpt-oss-20b", url: "https://api.groq.com/openai/v1/chat/completions", keyEnv: "GROQ_API_KEY" },
    { name: "navy", id: "gpt-4.1-mini",       url: "https://api.navy/v1/chat/completions",            keyEnv: "NAVY_API_KEY" },
  ]},
  thinker:   { label: "Thinker",   providers: [
    { name: "groq", id: "openai/gpt-oss-120b", url: "https://api.groq.com/openai/v1/chat/completions", keyEnv: "GROQ_API_KEY" },
    { name: "navy", id: "gpt-4.1",            url: "https://api.navy/v1/chat/completions",            keyEnv: "NAVY_API_KEY" },
  ]},
  creative:  { label: "Creative",  providers: [
    { name: "groq", id: "qwen/qwen3.6-27b",   url: "https://api.groq.com/openai/v1/chat/completions", keyEnv: "GROQ_API_KEY" },
    { name: "navy", id: "gpt-4.1",            url: "https://api.navy/v1/chat/completions",            keyEnv: "NAVY_API_KEY" },
  ]},
  efficient: { label: "Efficient", providers: [
    { name: "groq", id: "openai/gpt-oss-20b", url: "https://api.groq.com/openai/v1/chat/completions", keyEnv: "GROQ_API_KEY" },
    { name: "navy", id: "gpt-4.1-mini",       url: "https://api.navy/v1/chat/completions",            keyEnv: "NAVY_API_KEY" },
  ]},
  vision:    { label: "Vision",    providers: [
    { name: "groq", id: "qwen/qwen3.6-27b",   url: "https://api.groq.com/openai/v1/chat/completions", keyEnv: "GROQ_API_KEY" },
    { name: "navy", id: "gpt-4.1",            url: "https://api.navy/v1/chat/completions",            keyEnv: "NAVY_API_KEY" },
  ]},
  agent:     { label: "Agent",     providers: [
    { name: "groq", id: "openai/gpt-oss-120b", url: "https://api.groq.com/openai/v1/chat/completions", keyEnv: "GROQ_API_KEY" },
    { name: "navy", id: "gpt-4.1",             url: "https://api.navy/v1/chat/completions",            keyEnv: "NAVY_API_KEY" },
  ]},
};
const DEFAULT_MODEL = "genius";

async function callAI(modelKey, messages, temperature, maxTokens = 1024) {
  const model = MODELS[modelKey] || MODELS[DEFAULT_MODEL];
  let lastError;

  // 1. Kilo primary
  try {
    const content = await kiloChat(messages, { temperature, maxTokens });
    if (content?.content && content.content.length > 2) return content.content;
  } catch (err) {
    console.error(`kilo (primary) failed: ${err.message}`);
    lastError = err;
  }

  // 2. Groq / Navy fallback
  for (const provider of model.providers) {
    const apiKey = process.env[provider.keyEnv];
    if (!apiKey) continue;
    try {
      const response = await fetch(provider.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: provider.id,
          messages,
          temperature,
          max_tokens: Math.max(512, maxTokens),
        }),
      });
      if (!response.ok) {
        const err = await response.text();
        throw new Error(`${provider.name} ${response.status}: ${err.slice(0, 200)}`);
      }
      const data = await response.json();
      const content = cleanModelOutput(data.choices?.[0]?.message?.content);
      if (content && content.length > 2) return content;
      throw new Error(`no usable content from ${provider.name}`);
    } catch (err) {
      console.error(`${provider.name} (fallback) failed: ${err.message}`);
      lastError = err;
    }
  }
  throw new Error(`all providers failed — ${lastError?.message || "unknown"}`);
}

/* ═══════════════════════════════════════════════════════════════
   2 · DB HELPERS
   ═══════════════════════════════════════════════════════════════ */
async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_chat_history (
      user_id TEXT, guild_id TEXT,
      history JSONB DEFAULT '[]', summary TEXT,
      updated_at TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (user_id, guild_id)
    )`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_notes (
      user_id TEXT, note TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )`);
}

async function loadMemory(userId, guildId) {
  const res = await pool.query(
    "SELECT history, summary FROM user_chat_history WHERE user_id = $1 AND guild_id = $2",
    [userId, guildId]
  );
  return res.rows[0] || { history: [], summary: null };
}

async function saveMemory(userId, guildId, history, summary) {
  await pool.query(
    `INSERT INTO user_chat_history (user_id, guild_id, history, summary)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (user_id, guild_id)
     DO UPDATE SET history = $3, summary = $4, updated_at = NOW()`,
    [userId, guildId, JSON.stringify(history), summary]
  );
}

/* ═══════════════════════════════════════════════════════════════
   3 · SSRF-SAFE WEB FOUNDATION
   ═══════════════════════════════════════════════════════════════ */
const WEB_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36";
const MAX_PAGE_BYTES = 1_500_000;
const MAX_REDIRECTS = 4;
const BLOCKED_SUFFIXES = [".local", ".localhost", ".internal", ".lan", ".home", ".corp"];

class WebError extends Error {}

function ipv4ToInt(ip) {
  const p = ip.split(".").map(Number);
  return ((p[0] << 24) | (p[1] << 16) | (p[2] << 8) | p[3]) >>> 0;
}

function isPublicIPv4(ip) {
  const n = ipv4ToInt(ip);
  if ((n & 0xff000000) === 0x00000000) return false;
  if ((n & 0xff000000) === 0x0a000000) return false;
  if ((n & 0xffc00000) === 0x64400000) return false;
  if ((n & 0xff000000) === 0x7f000000) return false;
  if ((n & 0xffff0000) === 0xa9fe0000) return false;
  if ((n & 0xfff00000) === 0xac100000) return false;
  if ((n & 0xffffff00) === 0xc0000000) return false;
  if ((n & 0xffffff00) === 0xc0000200) return false;
  if ((n & 0xffff0000) === 0xc0a80000) return false;
  if ((n & 0xfffe0000) === 0xc6120000) return false;
  if ((n & 0xffffff00) === 0xc6336400) return false;
  if ((n & 0xffffff00) === 0xcb007100) return false;
  if ((n & 0xf0000000) === 0xe0000000) return false;
  if ((n & 0xf0000000) === 0xf0000000) return false;
  return true;
}

function isPublicIPv6(ip) {
  const l = ip.toLowerCase();
  if (l === "::" || l === "::1") return false;
  if (l.startsWith("::ffff:")) {
    const v4 = l.slice(7);
    if (/^\d+\.\d+\.\d+\.\d+$/.test(v4)) return isPublicIPv4(v4);
  }
  if (l.startsWith("fc") || l.startsWith("fd")) return false;
  if (/^fe[89ab]/.test(l)) return false;
  if (l.startsWith("ff")) return false;
  return true;
}

function isPublicIP(ip) {
  const fam = net.isIP(ip);
  if (fam === 4) return isPublicIPv4(ip);
  if (fam === 6) return isPublicIPv6(ip);
  return false;
}

function validateUrl(raw) {
  let parsed;
  try { parsed = new URL(String(raw).trim()); }
  catch { throw new WebError("only full http(s) urls allowed."); }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new WebError("only http(s) urls allowed.");
  if (parsed.username || parsed.password) throw new WebError("urls with credentials are not allowed.");
  const port = parsed.port ? parseInt(parsed.port, 10) : (parsed.protocol === "https:" ? 443 : 80);
  if (port !== 80 && port !== 443) throw new WebError("only ports 80 and 443 allowed.");
  const host = parsed.hostname.toLowerCase().replace(/\.$/, "");
  if (host === "localhost" || BLOCKED_SUFFIXES.some(s => host.endsWith(s))) throw new WebError("that host is not allowed.");
  if (net.isIP(host) && !isPublicIP(host)) throw new WebError("that address is not allowed.");
  return parsed.href;
}

async function assertPublicHost(host) {
  if (net.isIP(host)) return;
  let addrs;
  try { addrs = await dnsPromises.lookup(host, { all: true }); }
  catch { throw new WebError("could not resolve that host."); }
  if (!addrs.length) throw new WebError("could not resolve that host.");
  for (const a of addrs) if (!isPublicIP(a.address)) throw new WebError("that host resolves to a private address.");
}

function decodeHtml(s) {
  return String(s)
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function stripTags(v) {
  return decodeHtml(String(v).replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
}

function htmlToText(raw) {
  const tMatch = raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = tMatch ? decodeHtml(tMatch[1]).trim() : "";
  let text = raw.replace(/<(script|style|noscript|svg|head)\b[^>]*>[\s\S]*?<\/\1>/gi, " ");
  text = text.replace(/<br\s*\/?>|<\/(p|div|li|h[1-6]|tr)>/gi, "\n");
  text = text.replace(/<[^>]+>/g, " ");
  text = decodeHtml(text);
  text = text.replace(/[ \t\r\f\v]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
  return title ? `Title: ${title}\n\n${text}` : text;
}

async function safeFetch(url, { maxBytes = MAX_PAGE_BYTES, timeout = 15000, headers = {} } = {}) {
  let current = url;
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    current = validateUrl(current);
    await assertPublicHost(new URL(current).hostname);
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeout);
    let res;
    try {
      res = await fetch(current, {
        redirect: "manual",
        signal: controller.signal,
        headers: { "User-Agent": WEB_UA, ...headers },
      });
    } catch (err) {
      clearTimeout(t);
      throw new WebError(`request failed: ${err.name || "error"}`);
    }
    clearTimeout(t);
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const loc = res.headers.get("location");
      if (!loc) throw new WebError("redirect without location.");
      current = new URL(loc, current).href;
      continue;
    }
    if (res.status >= 400) throw new WebError(`http ${res.status}`);
    const reader = res.body?.getReader();
    if (!reader) {
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > maxBytes) throw new WebError("response too large.");
      return { body: buf, contentType: res.headers.get("content-type") || "", status: res.status, finalUrl: current };
    }
    const chunks = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) { try { await reader.cancel(); } catch {} throw new WebError("response too large."); }
      chunks.push(Buffer.from(value));
    }
    return { body: Buffer.concat(chunks), contentType: res.headers.get("content-type") || "", status: res.status, finalUrl: current };
  }
  throw new WebError("too many redirects.");
}

async function fetch_url(url) {
  const { body, contentType } = await safeFetch(url, { maxBytes: MAX_PAGE_BYTES });
  const lower = (contentType || "").toLowerCase();
  const isText = ["text/", "json", "xml"].some(t => lower.includes(t));
  if (!isText) throw new WebError(`unsupported content type: ${contentType || "unknown"}`);
  const raw = body.toString("utf8");
  if (lower.includes("html") || raw.trimStart().startsWith("<")) return htmlToText(raw);
  return raw.trim();
}

/* ═══════════════════════════════════════════════════════════════
   4 · SITE RECOGNITION + EXTRACTORS
   ═══════════════════════════════════════════════════════════════ */
const SITE_PROFILES = {
  youtube:   { match: /(?:youtube\.com|youtu\.be|m\.youtube\.com)/i,  name: "YouTube",        emoji: "▶️" },
  twitter:   { match: /(?:twitter\.com|x\.com)/i,                     name: "Twitter / X",    emoji: "🐦" },
  reddit:    { match: /reddit\.com/i,                                 name: "Reddit",         emoji: "👽" },
  github:    { match: /github\.com/i,                                 name: "GitHub",         emoji: "🐙" },
  wikipedia: { match: /wikipedia\.org/i,                              name: "Wikipedia",      emoji: "📖" },
  spotify:   { match: /spotify\.com/i,                                name: "Spotify",        emoji: "🎵" },
  soundcloud:{ match: /soundcloud\.com/i,                             name: "SoundCloud",     emoji: "☁️" },
  instagram: { match: /instagram\.com/i,                              name: "Instagram",      emoji: "📷" },
  tiktok:    { match: /tiktok\.com/i,                                 name: "TikTok",         emoji: "🎬" },
  twitch:    { match: /twitch\.tv/i,                                  name: "Twitch",         emoji: "🎮" },
  medium:    { match: /medium\.com/i,                                 name: "Medium",         emoji: "✍️" },
  devto:     { match: /dev\.to/i,                                     name: "dev.to",         emoji: "💻" },
  npm:       { match: /npmjs\.com/i,                                  name: "npm",            emoji: "📦" },
  pypi:      { match: /pypi\.org/i,                                   name: "PyPI",           emoji: "🐍" },
  archive:   { match: /archive\.org/i,                                name: "Archive.org",    emoji: "📚" },
  imdb:      { match: /imdb\.com/i,                                   name: "IMDb",           emoji: "🎬" },
  steam:     { match: /store\.steampowered\.com|steamcommunity\.com/i,name: "Steam",          emoji: "🎮" },
  roblox:    { match: /roblox\.com/i,                                 name: "Roblox",         emoji: "🟥" },
};

function identifySite(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    for (const [key, profile] of Object.entries(SITE_PROFILES)) {
      if (profile.match.test(host)) return { key, ...profile };
    }
    return { key: "generic", name: host.replace(/^www\./, ""), emoji: "🌐" };
  } catch {
    return { key: "generic", name: "unknown", emoji: "🌐" };
  }
}

async function extractMeta(url) {
  const { body, contentType, finalUrl } = await safeFetch(url, { maxBytes: MAX_PAGE_BYTES });
  const lower = (contentType || "").toLowerCase();
  if (!lower.includes("html") && !lower.includes("xml")) {
    return { url, finalUrl, title: null, description: null, image: null, siteName: null, favicon: null, themeColor: null, lang: null, canonical: null, words: 0, isText: false };
  }
  const html = body.toString("utf8");
  const get = (re) => { const m = html.match(re); return m ? m[1].trim() : null; };
  const title = get(/<title[^>]*>([^<]*)<\/title>/i);
  const description =
    get(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) ||
    get(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i) ||
    get(/<meta[^>]+name=["']twitter:description["'][^>]+content=["']([^"']*)["']/i);
  const ogTitle = get(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i);
  const image =
    get(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']*)["']/i) ||
    get(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']*)["']/i);
  const siteName = get(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']*)["']/i);
  const themeColor = get(/<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']*)["']/i);
  const lang = get(/<html[^>]+lang=["']([^"']*)["']/i);
  const canonical = get(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["']/i);
  const generator = get(/<meta[^>]+name=["']generator["'][^>]+content=["']([^"']*)["']/i);

  let favicon = null;
  const favMatch = html.match(/<link[^>]+rel=["'](?:icon|shortcut icon|apple-touch-icon)["'][^>]+href=["']([^"']*)["']/i);
  if (favMatch) { try { favicon = new URL(favMatch[1], url).href; } catch {} }

  const textOnly = html
    .replace(/<(script|style|noscript|svg|head)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = textOnly ? textOnly.split(" ").length : 0;

  return {
    url, finalUrl, title, ogTitle, description, image, siteName,
    favicon, themeColor, lang, canonical, generator, words,
    isText: true,
  };
}

async function extractYouTube(url) {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/))([A-Za-z0-9_-]{11})/);
  if (!m) throw new WebError("couldn't find a video id in that url.");
  const videoId = m[1];
  const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
  if (!res.ok) throw new WebError(`youtube oembed failed (${res.status})`);
  const data = await res.json();
  return {
    kind: "youtube", videoId,
    url: `https://youtube.com/watch?v=${videoId}`,
    title: data.title, author: data.author_name, authorUrl: data.author_url,
    thumbnail: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
  };
}

async function extractTwitter(url) {
  const res = await fetch(`https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}&omit_script=1`);
  if (!res.ok) throw new WebError(`twitter oembed failed (${res.status})`);
  const data = await res.json();
  const html = data.html || "";
  const textMatch = html.match(/<p[^>]*>([\s\S]*?)<\/p>/);
  const text = textMatch ? stripTags(textMatch[1].replace(/<br\s*\/?>/gi, "\n")) : "";
  return { kind: "twitter", url, author: data.author_name, authorUrl: data.author_url, text };
}

async function extractReddit(url) {
  const clean = url.split("?")[0].replace(/\/$/, "");
  const res = await fetch(`${clean}.json`, { headers: { "User-Agent": WEB_UA, "Accept": "application/json" } });
  if (!res.ok) throw new WebError(`reddit json failed (${res.status})`);
  const data = await res.json();
  const post = data[0]?.data?.children?.[0]?.data;
  if (!post) throw new WebError("no post data");
  return {
    kind: "reddit", url, subreddit: post.subreddit_name_prefixed,
    title: post.title, author: post.author, ups: post.ups,
    comments: post.num_comments, selftext: (post.selftext || "").slice(0, 800),
    thumbnail: post.thumbnail?.startsWith("http") ? post.thumbnail : null,
    isSelf: post.is_self,
  };
}

async function extractGitHub(url) {
  const m = url.match(/github\.com\/([^\/\s]+)(?:\/([^\/\s#?]+))?/);
  if (!m) throw new WebError("couldn't parse github url");
  const [, owner, repo] = m;
  const headers = { "User-Agent": "chromed-bot", "Accept": "application/vnd.github+json" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  if (repo) {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
    if (!res.ok) throw new WebError(`github api ${res.status}`);
    const d = await res.json();
    return {
      kind: "github-repo", url: d.html_url, fullName: d.full_name, description: d.description,
      stars: d.stargazers_count, forks: d.forks_count, watchers: d.watchers_count,
      issues: d.open_issues_count, language: d.language, license: d.license?.name || null,
      topics: d.topics || [], owner: d.owner?.login, ownerAvatar: d.owner?.avatar_url,
      createdAt: d.created_at, updatedAt: d.updated_at, archived: d.archived,
    };
  }

  const res = await fetch(`https://api.github.com/users/${owner}`, { headers });
  if (!res.ok) throw new WebError(`github api ${res.status}`);
  const d = await res.json();
  return {
    kind: "github-user", url: d.html_url, username: d.login, name: d.name, bio: d.bio,
    followers: d.followers, following: d.following, repos: d.public_repos,
    location: d.location, avatar: d.avatar_url, company: d.company, blog: d.blog, createdAt: d.created_at,
  };
}

async function extractWikipedia(url) {
  const m = url.match(/wikipedia\.org\/wiki\/([^#?]+)/);
  if (!m) throw new WebError("couldn't parse wikipedia url");
  const title = decodeURIComponent(m[1]).replace(/_/g, " ");
  const langMatch = url.match(/([a-z]+)\.wikipedia\.org/);
  const lang = langMatch ? langMatch[1] : "en";
  const res = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
  if (!res.ok) throw new WebError(`wikipedia api ${res.status}`);
  const d = await res.json();
  return {
    kind: "wikipedia", url: d.content_urls?.desktop?.page || url,
    title: d.title, description: d.description, extract: d.extract,
    thumbnail: d.thumbnail?.source, lang,
  };
}

async function extractSpotify(url) {
  const res = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`);
  if (!res.ok) throw new WebError(`spotify oembed failed (${res.status})`);
  const d = await res.json();
  return { kind: "spotify", url, title: d.title, thumbnail: d.thumbnail_url, provider: d.provider_name };
}

async function extractGeneric(url) {
  const meta = await extractMeta(url);
  return { kind: "generic", ...meta };
}

async function unfurl(url) {
  const site = identifySite(url);
  try {
    switch (site.key) {
      case "youtube":   return { site, data: await extractYouTube(url) };
      case "twitter":   return { site, data: await extractTwitter(url) };
      case "reddit":    return { site, data: await extractReddit(url) };
      case "github":    return { site, data: await extractGitHub(url) };
      case "wikipedia": return { site, data: await extractWikipedia(url) };
      case "spotify":   return { site, data: await extractSpotify(url) };
      default:          return { site, data: await extractGeneric(url) };
    }
  } catch (err) {
    try {
      const meta = await extractMeta(url);
      return { site, data: { kind: "generic", ...meta, fallbackFrom: err.message } };
    } catch (innerErr) {
      throw new WebError(`${site.name} extract failed: ${err.message} · fallback: ${innerErr.message}`);
    }
  }
}

/* ═══════════════════════════════════════════════════════════════
   5 · WEB SEARCH (Tavily → Brave → DDG-IA)
   ═══════════════════════════════════════════════════════════════ */
async function web_search(query) {
  query = String(query || "").slice(0, 200);
  if (!query) throw new WebError("empty query");

  try {
    const body = { query, search_depth: "basic", max_results: 5, include_answer: false };
    if (process.env.TAVILY_API_KEY) body.api_key = process.env.TAVILY_API_KEY;
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (res.ok) {
      const data = await res.json();
      const hits = (data.results || []).slice(0, 5);
      if (hits.length) return hits.map((r, i) => `${i + 1}. ${r.title}\n${r.url}\n${(r.content || "").slice(0, 300)}`).join("\n\n");
    }
  } catch (err) { console.error("[web_search] tavily failed:", err.message); }

  if (process.env.BRAVE_API_KEY) {
    try {
      const res = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`, {
        headers: { "Accept": "application/json", "X-Subscription-Token": process.env.BRAVE_API_KEY },
      });
      if (res.ok) {
        const data = await res.json();
        const hits = (data.web?.results || []).slice(0, 5);
        if (hits.length) return hits.map((r, i) => `${i + 1}. ${r.title}\n${r.url}\n${(r.description || "").slice(0, 300)}`).join("\n\n");
      }
    } catch (err) { console.error("[web_search] brave failed:", err.message); }
  }

  try {
    const res = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`);
    if (res.ok) {
      const data = await res.json();
      if (data.AbstractText) return data.AbstractText;
      if (data.RelatedTopics?.[0]?.Text) return data.RelatedTopics[0].Text;
    }
  } catch {}

  throw new WebError("no results found.");
}

/* ═══════════════════════════════════════════════════════════════
   6 · KILO GATEWAY
   ═══════════════════════════════════════════════════════════════ */
const KILO_URL = "https://api.kilo.ai/api/gateway/chat/completions";
const KILO_MODELS = [
  "meta-llama/llama-3.3-70b-instruct",
  "mistralai/mistral-nemo",
  "qwen/qwen-2.5-72b-instruct",
  "openrouter/free",
];
const KILO_HEADERS = {
  "accept": "application/json",
  "content-type": "application/json",
  "origin": "https://api.kilo.ai",
  "referer": "https://api.kilo.ai/",
  "user-agent": WEB_UA,
};

class KiloError extends Error {}

async function kiloChat(messages, { tools = null, temperature = 0.7, maxTokens = 1024 } = {}) {
  const attempts = [];
  const safeMax = Math.max(512, Math.min(maxTokens || 1024, 4096));

  for (const model of KILO_MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const payload = { model, messages, stream: false, temperature, max_tokens: safeMax };
      if (tools) payload.tools = tools;
      let res;
      try {
        res = await fetch(KILO_URL, { method: "POST", headers: KILO_HEADERS, body: JSON.stringify(payload) });
      } catch (err) { attempts.push(`${model}: network ${err.name}`); break; }
      if (res.status === 429) { attempts.push(`${model}: rate-limited`); break; }
      if (!res.ok) { attempts.push(`${model}: http ${res.status}`); break; }
      let data;
      try { data = await res.json(); } catch { attempts.push(`${model}: bad json`); break; }
      const choice = (data.choices || [{}])[0];
      const message = choice.message || {};
      const raw = typeof message.content === "string" ? message.content : "";
      const noThink = raw.replace(/<think>[\s\S]*?<\/think>/g, "");
      const content = cleanModelOutput(noThink);
      if (content && content.length > 2) return { content, tool_calls: message.tool_calls || [] };
      if (message.tool_calls?.length) break;
      attempts.push(`${model}: empty (finish=${choice.finish_reason})`);
      if (attempt === 0) await new Promise(r => setTimeout(r, 300));
    }
  }
  throw new KiloError(`kilo exhausted — ${attempts.join(" | ")}`);
}

const WEB_TOOLS_SCHEMA = [
  { type: "function", function: { name: "web_search", description: "Search the web.", parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } } },
  { type: "function", function: { name: "fetch_url",  description: "Fetch a URL.",   parameters: { type: "object", properties: { url:   { type: "string" } }, required: ["url"] } } },
];

/* ═══════════════════════════════════════════════════════════════
   7 · EXISTING TOOLS
   ═══════════════════════════════════════════════════════════════ */
async function image(prompt) {
  const seed = Math.floor(Math.random() * 1000000);
  return { type: "image", url: `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&seed=${seed}&nologo=true` };
}

async function calculator(expression) {
  const sanitized = expression.replace(/[^0-9+\-*/.()\s]/g, "");
  const result = new Function(`return (${sanitized})`)();
  return `🧮 ${expression} = ${result}`;
}

async function weather(city) {
  const res = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=%C+%t+%h+%w`);
  if (!res.ok) throw new Error("weather api failed");
  return `🌤️ ${city}: ${await res.text()}`;
}

async function time(city) {
  const res = await fetch(`http://worldtimeapi.org/api/timezone/${encodeURIComponent(city)}`);
  if (!res.ok) throw new Error("timezone not found");
  const data = await res.json();
  return `⏰ ${city}: ${new Date(data.datetime).toLocaleString()}`;
}

async function dictionary(word) {
  const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
  if (!res.ok) throw new Error("word not found");
  const data = await res.json();
  return `📚 ${data[0].word}: ${data[0].meanings[0].definitions[0].definition}`;
}

async function translate(text, target) {
  const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${target}`);
  const data = await res.json();
  return `🌐 ${text} → ${data.responseData.translatedText}`;
}

async function wikipedia(query) {
  const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error("page not found");
  const data = await res.json();
  return `📖 ${data.title}:\n${data.extract}`;
}

async function cryptoPrice(coin) {
  const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(coin.toLowerCase())}&vs_currencies=usd`);
  if (!res.ok) throw new Error("coin not found");
  const data = await res.json();
  const price = data[coin.toLowerCase()]?.usd;
  if (!price) throw new Error("coin not found");
  return `💎 ${coin} = $${price}`;
}

async function stockPrice(symbol) {
  const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d`);
  if (!res.ok) throw new Error("stock not found");
  const data = await res.json();
  const price = data.chart.result[0].meta.regularMarketPrice;
  return `📈 ${symbol.toUpperCase()} = $${price}`;
}

async function qr(text) {
  return { type: "image", url: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(text)}` };
}

async function shorten(url) {
  const res = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`);
  if (!res.ok) throw new Error("shorten failed");
  return `🔗 ${await res.text()}`;
}

async function serverinfo(message) {
  if (!message?.guild) return "you must be in a server.";
  const guild = message.guild;
  const owner = await guild.fetchOwner();
  return `🏠 **${guild.name}**\nid: ${guild.id}\nowner: ${owner.user.tag}\nmembers: ${guild.memberCount}\nchannels: ${guild.channels.cache.size}\ncreated: ${guild.createdAt.toLocaleDateString()}`;
}

async function userinfo(message, userId) {
  if (!message?.guild) return "user info only works in a server.";
  const member = await message.guild.members.fetch(userId).catch(() => null);
  if (!member) return "user not found.";
  return `👤 **${member.user.tag}**\nid: ${member.user.id}\njoined: ${member.joinedAt.toLocaleDateString()}\ncreated: ${member.user.createdAt.toLocaleDateString()}`;
}

async function reminder(message, args) {
  const { text, amount, unit } = args;
  const ms = { seconds: 1000, minutes: 60000, hours: 3600000, days: 86400000 }[unit];
  if (!ms) return "invalid time unit.";
  setTimeout(async () => {
    try { await message.author.send(`⏰ Reminder: ${text}`); } catch {}
  }, amount * ms);
  return `I'll remind you in ${amount} ${unit}: ${text}`;
}

async function note_save(userId, noteText) {
  await pool.query("INSERT INTO user_notes (user_id, note) VALUES ($1, $2)", [userId, noteText]);
  return "📝 Note saved.";
}

async function note_list(userId) {
  const res = await pool.query("SELECT note, created_at FROM user_notes WHERE user_id = $1 ORDER BY created_at DESC", [userId]);
  if (!res.rows.length) return "you have no notes.";
  return res.rows.map((r, i) => `${i + 1}. ${r.note} (${r.created_at.toLocaleDateString()})`).join("\n");
}

async function currency(amount, from, to) {
  const res = await fetch(`https://open.er-api.com/v6/latest/${from.toUpperCase()}`);
  if (!res.ok) throw new Error("currency api failed");
  const data = await res.json();
  const rate = data.rates[to.toUpperCase()];
  if (!rate) throw new Error("currency not found");
  return `💱 ${amount} ${from.toUpperCase()} = ${(amount * rate).toFixed(2)} ${to.toUpperCase()}`;
}

async function unit(value, from, to) {
  const conversions = {
    cm: { m: 0.01, km: 0.00001, in: 0.393701, ft: 0.0328084 },
    m: { cm: 100, km: 0.001, ft: 3.28084 },
    km: { m: 1000, mi: 0.621371 },
    in: { cm: 2.54, ft: 0.0833333 },
    ft: { in: 12, m: 0.3048, cm: 30.48 },
    mi: { km: 1.60934 },
    kg: { g: 1000, lb: 2.20462 },
    g: { kg: 0.001, lb: 0.00220462 },
    lb: { kg: 0.453592, g: 453.592 },
    oz: { g: 28.3495 },
  };
  const rate = conversions[from.toLowerCase()]?.[to.toLowerCase()];
  if (!rate) return "unsupported conversion.";
  return `📏 ${value} ${from} = ${(value * rate).toFixed(2)} ${to}`;
}

async function roast(message, targetId) {
  if (!message?.guild) return "roast can't be delivered.";
  const target = await message.guild.members.fetch(targetId).catch(() => null);
  if (!target) return "user not found.";
  const r = await callAI("creative", [
    { role: "user", content: `Roast ${target.user.username} in a funny, brutal but not harmful way. Use internet slang. Keep it short.` }
  ], 0.9, 256);
  return `${target.user.username}, ${r}`;
}

async function joke() {
  const res = await fetch("https://icanhazdadjoke.com/", { headers: { "Accept": "application/json" } });
  return (await res.json()).joke;
}

async function meme() {
  const res = await fetch("https://meme-api.com/gimme");
  return { type: "image", url: (await res.json()).url };
}

async function magic8ball() {
  const r = ["yes", "no", "maybe", "ask again later", "definitely", "not a chance"];
  return `🎱 ${r[Math.floor(Math.random() * r.length)]}`;
}

async function dice() { return `🎲 you rolled a ${Math.floor(Math.random() * 6) + 1}`; }
async function coinflip() { return `🪙 ${Math.random() < 0.5 ? "heads" : "tails"}`; }

/* ═══════════════════════════════════════════════════════════════
   8 · SITE-AWARE TOOLS
   ═══════════════════════════════════════════════════════════════ */
async function site_info(url) {
  const site = identifySite(url);
  const meta = await extractMeta(url);
  const lines = [
    `${site.emoji} **${meta.ogTitle || meta.title || site.name}**`,
    `host · \`${new URL(meta.finalUrl || url).hostname}\``,
  ];
  if (meta.siteName) lines.push(`site · ${meta.siteName}`);
  if (meta.description) lines.push(`desc · ${meta.description.slice(0, 300)}`);
  if (meta.lang) lines.push(`lang · \`${meta.lang}\``);
  if (meta.words) lines.push(`words · ${meta.words.toLocaleString()}`);
  if (meta.themeColor) lines.push(`theme · \`${meta.themeColor}\``);
  if (meta.generator) lines.push(`built with · \`${meta.generator}\``);
  if (meta.image) lines.push(`image · ${meta.image}`);
  lines.push(`url · ${meta.finalUrl || url}`);
  return lines.join("\n");
}

async function unfurl_url(url) {
  const { site, data } = await unfurl(url);
  switch (data.kind) {
    case "youtube":
      return `▶️ **${data.title}**\nby **${data.author}**\n${data.url}\n${data.thumbnail}`;
    case "twitter":
      return `🐦 **${data.author}**\n${data.text}`;
    case "reddit":
      return `👽 **${data.title}**\nby **u/${data.author}** in ${data.subreddit}\n⬆️ ${data.ups} · 💬 ${data.comments}` +
        (data.selftext ? `\n\n${data.selftext.slice(0, 500)}` : "");
    case "github-repo":
      return `🐙 **${data.fullName}**\n${data.description || "no description"}\n⭐ ${data.stars} · 🍴 ${data.forks} · 👀 ${data.watchers}\n${data.language ? `lang · ${data.language}\n` : ""}${data.url}`;
    case "github-user":
      return `🐙 **${data.name || data.username}** (@${data.username})\n${data.bio || "no bio"}\n👥 ${data.followers} followers · ${data.repos} repos\n${data.url}`;
    case "wikipedia":
      return `📖 **${data.title}**\n${data.extract}\n${data.url}`;
    case "spotify":
      return `🎵 **${data.title}**\n${data.url}`;
    default:
      return site_info(url);
  }
}

async function screenshot(url) {
  const u = validateUrl(url);
  const shot = `https://s0.wp.com/mshots/v1/${encodeURIComponent(u)}?w=1280&h=800`;
  for (let i = 0; i < 5; i++) {
    try {
      const res = await fetch(shot);
      if (!res.ok) { await new Promise(r => setTimeout(r, 3000)); continue; }
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > 12000) return { type: "image", url: shot };
      await new Promise(r => setTimeout(r, 3000));
    } catch { await new Promise(r => setTimeout(r, 3000)); }
  }
  return { type: "image", url: `https://image.thum.io/get/width/1280/crop/800/noanimate/${u}` };
}

async function rss(url) {
  const { body, contentType } = await safeFetch(url, { maxBytes: 500_000 });
  const text = body.toString("utf8");
  const isXML = text.trimStart().startsWith("<?xml") || (contentType || "").includes("xml");
  if (!isXML) throw new WebError("that url isn't an RSS/Atom feed.");

  const items = [];
  const itemRe = /<item\b[^>]*>([\s\S]*?)<\/item>|<entry\b[^>]*>([\s\S]*?)<\/entry>/gi;
  let m;
  while ((m = itemRe.exec(text)) !== null && items.length < 10) {
    const chunk = m[1] || m[2] || "";
    const title = (chunk.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1];
    const link = (chunk.match(/<link[^>]*href=["']([^"']+)["']/i) || chunk.match(/<link[^>]*>([\s\S]*?)<\/link>/i) || [])[1];
    items.push({
      title: title ? stripTags(title).slice(0, 120) : "untitled",
      link: link ? link.trim() : null,
    });
  }
  if (!items.length) throw new WebError("no feed items found.");
  return `📡 **feed** (${items.length} items)\n\n` +
    items.map((it, i) => `${i + 1}. ${it.title}${it.link ? `\n${it.link}` : ""}`).join("\n\n");
}

/* ═══════════════════════════════════════════════════════════════
   9 · VIDEO → AUDIO
   ═══════════════════════════════════════════════════════════════ */
const VIDEO_EXT_RE = /\.(mp4|webm|mov|mkv|avi|m4v|flv|wmv|mpeg|mpg)$/i;
const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
const MAX_AUDIO_BYTES = 8 * 1024 * 1024;

function isVideoAttachment(att) {
  if (!att) return false;
  const ct = (att.contentType || "").toLowerCase();
  const name = (att.name || "").toLowerCase();
  return ct.startsWith("video/") || VIDEO_EXT_RE.test(name);
}

async function findVideoInMessage(message) {
  if (message.attachments?.size) {
    for (const a of message.attachments.values()) {
      if (isVideoAttachment(a)) return { attachment: a, source: "message" };
    }
  }

  if (message.reference?.message_id) {
    try {
      const ref = message.reference.resolved
        || message.reference.cachedMessage
        || await message.channel.messages.fetch(message.reference.message_id);
      if (ref?.attachments?.size) {
        for (const a of ref.attachments.values()) {
          if (isVideoAttachment(a)) return { attachment: a, source: "reply" };
        }
      }
    } catch {}
  }

  const urlMatch = message.content.match(/https?:\/\/\S+\.(mp4|webm|mov|mkv|m4v)(\?\S*)?/i);
  if (urlMatch) return { url: urlMatch[0], source: "url" };

  return null;
}

async function video_to_audio(context) {
  const { message } = context;
  if (!message) throw new WebError("no message context.");

  if (!ffmpeg || !ffmpegStaticPath) {
    throw new WebError("video→audio isn't installed. run `npm i fluent-ffmpeg ffmpeg-static` on the host.");
  }

  const found = await findVideoInMessage(message);
  if (!found) {
    throw new WebError("couldn't find a video. attach one, or reply to a message with a video, or paste a direct video url.");
  }

  let videoBuf = null;
  let sourceName = "video";

  if (found.attachment) {
    if (found.attachment.size > MAX_VIDEO_BYTES) {
      throw new WebError(`video is too big (${(found.attachment.size / 1024 / 1024).toFixed(1)}MB, max 25MB).`);
    }
    const res = await fetch(found.attachment.url);
    if (!res.ok) throw new WebError(`couldn't download attachment (${res.status}).`);
    videoBuf = Buffer.from(await res.arrayBuffer());
    sourceName = (found.attachment.name || "video").replace(/\.[^.]+$/, "");
  } else if (found.url) {
    const safe = validateUrl(found.url);
    const res = await fetch(safe, { headers: { "User-Agent": WEB_UA } });
    if (!res.ok) throw new WebError(`couldn't download video (${res.status}).`);
    const len = parseInt(res.headers.get("content-length") || "0", 10);
    if (len && len > MAX_VIDEO_BYTES) throw new WebError(`video is too big (${(len / 1024 / 1024).toFixed(1)}MB, max 25MB).`);
    videoBuf = Buffer.from(await res.arrayBuffer());
    if (videoBuf.length > MAX_VIDEO_BYTES) throw new WebError("video is too big (max 25MB).");
    sourceName = (new URL(safe).pathname.split("/").pop() || "video").replace(/\.[^.]+$/, "");
  }

  if (!videoBuf || videoBuf.length === 0) throw new WebError("no video data to convert.");

  const inExt = found.attachment ? (VIDEO_EXT_RE.exec(found.attachment.name || "")?.[1] || "mp4") : "mp4";
  const inPath = path.join(os.tmpdir(), `chromed-in-${randomUUID()}.${inExt}`);
  const outPath = path.join(os.tmpdir(), `chromed-out-${randomUUID()}.mp3`);

  fs.writeFileSync(inPath, videoBuf);

  try {
    await new Promise((resolve, reject) => {
      ffmpeg(inPath)
        .noVideo()
        .audioCodec("libmp3lame")
        .audioBitrate("160k")
        .audioChannels(2)
        .format("mp3")
        .on("end", resolve)
        .on("error", (err) => reject(new Error(`ffmpeg failed: ${err.message}`)))
        .save(outPath);
    });
  } finally {
    try { fs.unlinkSync(inPath); } catch {}
  }

  const audioBuf = fs.readFileSync(outPath);
  try { fs.unlinkSync(outPath); } catch {}

  if (audioBuf.length === 0) throw new WebError("conversion produced empty audio.");
  if (audioBuf.length > MAX_AUDIO_BYTES) {
    throw new WebError(`audio is ${(audioBuf.length / 1024 / 1024).toFixed(1)}MB — too big to upload (max 8MB).`);
  }

  const safeName = sourceName.replace(/[^\w\-]+/g, "_").slice(0, 40) || "audio";

  return {
    type: "audio",
    buffer: audioBuf,
    name: `${safeName}.mp3`,
    duration_hint: `${(audioBuf.length / 1024 / 1024).toFixed(2)}MB`,
  };
}

/* ═══════════════════════════════════════════════════════════════
   10 · TOOL DETECTION
   ═══════════════════════════════════════════════════════════════
   URLs are NOT auto-detected — they flow through smartCtx so the AI
   responds conversationally. Explicit commands still fire.
   ═══════════════════════════════════════════════════════════════ */
function detectTool(content) {
  const text = content.trim().toLowerCase();

  // video → audio
  if (
    /(convert|turn|change)\s+(this|it|that|the\s+video)\s+(in)?to\s+audio/i.test(text) ||
    /(extract|get|grab|pull)\s+(the\s+)?audio\s+from\s+(this|it|that|the\s+video)/i.test(text) ||
    /^(to\s+audio|audio\s+please|make\s+it\s+audio|audio\s+from\s+this)\.?!?$/i.test(text.trim()) ||
    /(give|send)\s+me\s+(the\s+)?audio/i.test(text)
  ) {
    return { tool: "video_to_audio", args: null };
  }

  // image gen
  if (/(imagine|generate|create|make|draw)\s+(an?\s+)?(image|pic|picture|art|photo)\s+(of\s+)?(.+)/.test(text)) {
    return { tool: "image", args: text.match(/(imagine|generate|create|make|draw)\s+(an?\s+)?(image|pic|picture|art|photo)\s+(of\s+)?(.+)/)[5] };
  }
  if (/imagine\s+(.+)/.test(text)) return { tool: "image", args: text.match(/imagine\s+(.+)/)[1] };

  // math / weather / time / dictionary / translate
  if (/^(calc|calculate|math)\s+(.+)$/.test(text)) return { tool: "calculator", args: text.match(/^(?:calc|calculate|math)\s+(.+)$/)[1] };
  if (/weather(?:\s+in)?\s+(.+)/.test(text)) return { tool: "weather", args: text.match(/weather(?:\s+in)?\s+(.+)/)[1] };
  if (/time(?:\s+in)?\s+(.+)/.test(text)) return { tool: "time", args: text.match(/time(?:\s+in)?\s+(.+)/)[1] };
  if (/^(define|dict|urban)\s+(.+)/.test(text)) return { tool: "dictionary", args: text.match(/^(?:define|dict|urban)\s+(.+)/)[1] };
  if (/translate\s+(.+)\s+to\s+(.+)/.test(text)) {
    const m = text.match(/translate\s+(.+)\s+to\s+(.+)/);
    return { tool: "translate", args: { text: m[1], target: m[2] } };
  }

  // wiki / crypto / stock
  if (/^(wiki|wikipedia)\s+(.+)/.test(text)) return { tool: "wikipedia", args: text.match(/^(?:wiki|wikipedia)\s+(.+)/)[1] };
  if (/(crypto|price of)\s+(.+)/.test(text)) return { tool: "crypto", args: text.match(/(?:crypto|price of)\s+(.+)/)[1] };
  if (/^(stock|stocks)\s+(.+)/.test(text)) return { tool: "stock", args: text.match(/^(?:stock|stocks)\s+(.+)/)[1] };

  // utility
  if (/^qr\s+(.+)/.test(text)) return { tool: "qr", args: text.match(/^qr\s+(.+)/)[1] };
  if (/^shorten\s+(https?:\/\/\S+)/.test(text)) return { tool: "shorten", args: text.match(/^shorten\s+(https?:\/\/\S+)/)[1] };
  if (/server\s*(info|stats)/.test(text)) return { tool: "serverinfo", args: null };
  if (/user\s*info\s*<@!?(\d+)>/.test(text)) return { tool: "userinfo", args: text.match(/<@!?(\d+)>/)[1] };

  // reminders / notes
  if (/remind\s+me\s+to\s+(.+?)\s+in\s+(\d+)\s*(seconds|minutes|hours|days)/i.test(text)) {
    const m = text.match(/remind\s+me\s+to\s+(.+?)\s+in\s+(\d+)\s*(seconds|minutes|hours|days)/i);
    return { tool: "reminder", args: { text: m[1], amount: parseInt(m[2]), unit: m[3] } };
  }
  if (/note\s+(save|add)\s+(.+)/.test(text)) return { tool: "note_save", args: text.match(/note\s+(?:save|add)\s+(.+)/)[1] };
  if (/note\s+(list|get)\s*/.test(text)) return { tool: "note_list", args: null };

  // currency + unit
  if (/currency\s+convert\s+(\d+)\s+([a-z]{3})\s+to\s+([a-z]{3})/.test(text)) {
    const m = text.match(/currency\s+convert\s+(\d+)\s+([a-z]{3})\s+to\s+([a-z]{3})/);
    return { tool: "currency", args: { amount: m[1], from: m[2], to: m[3] } };
  }
  if (/unit\s*convert\s+(\d+)\s*(\w+)\s+to\s+(\w+)/.test(text)) {
    const m = text.match(/unit\s*convert\s+(\d+)\s*(\w+)\s+to\s+(\w+)/);
    return { tool: "unit", args: { value: m[1], from: m[2], to: m[3] } };
  }

  // fun
  if (/^(roast|insult)\s+<@!?(\d+)>/.test(text)) return { tool: "roast", args: text.match(/<@!?(\d+)>/)[1] };
  if (/^(joke|tell me a joke)/.test(text)) return { tool: "joke", args: null };
  if (/^(meme|show me a meme)/.test(text)) return { tool: "meme", args: null };
  if (/^(8ball|magic 8 ball)/.test(text)) return { tool: "magic8ball", args: null };
  if (/^(dice|roll a dice)/.test(text)) return { tool: "dice", args: null };
  if (/^(coinflip|flip a coin)/.test(text)) return { tool: "coinflip", args: null };

  // explicit site commands
  if (/^(site\s*info|url\s*info|check\s*url|check\s*site)\s+(https?:\/\/\S+)/.test(text)) {
    return { tool: "site_info", args: text.match(/^(?:site\s*info|url\s*info|check\s*url|check\s*site)\s+(https?:\/\/\S+)/)[1] };
  }
  if (/^(unfurl|preview|lookup)\s+(https?:\/\/\S+)/.test(text)) {
    return { tool: "unfurl_url", args: text.match(/^(?:unfurl|preview|lookup)\s+(https?:\/\/\S+)/)[1] };
  }
  if (/^(screenshot|ss|shot)\s+(https?:\/\/\S+)/.test(text)) {
    return { tool: "screenshot", args: text.match(/^(?:screenshot|ss|shot)\s+(https?:\/\/\S+)/)[1] };
  }
  if (/^(rss|feed)\s+(https?:\/\/\S+)/.test(text)) {
    return { tool: "rss", args: text.match(/^(?:rss|feed)\s+(https?:\/\/\S+)/)[1] };
  }
  if (/^(fetch|open|read|visit)\s+(https?:\/\/\S+)/.test(text)) {
    return { tool: "fetch_url", args: text.match(/^(?:fetch|open|read|visit)\s+(https?:\/\/\S+)/)[1].trim() };
  }

  // search
  if (/^(search|google)\s+(.+)/.test(text)) {
    return { tool: "web_search", args: text.match(/^(?:search|google)\s+(.+)/)[1].trim() };
  }

  return null;
}

/* ═══════════════════════════════════════════════════════════════
   11 · TOOL EXECUTION
   ═══════════════════════════════════════════════════════════════ */
async function executeTool(tool, args, context = {}) {
  const { message, client } = context;
  const userId = message?.author?.id;

  switch (tool) {
    case "image":          return image(args);
    case "calculator":     return calculator(args);
    case "weather":        return weather(args);
    case "time":           return time(args);
    case "dictionary":     return dictionary(args);
    case "translate":      return translate(args.text, args.target);
    case "wikipedia":      return wikipedia(args);
    case "crypto":         return cryptoPrice(args);
    case "stock":          return stockPrice(args);
    case "qr":             return qr(args);
    case "shorten":        return shorten(args);
    case "serverinfo":     return serverinfo(message);
    case "userinfo":       return userinfo(message, args);
    case "reminder":       return reminder(message, args);
    case "note_save":      return note_save(userId, args);
    case "note_list":      return note_list(userId);
    case "currency":       return currency(args.amount, args.from, args.to);
    case "unit":           return unit(args.value, args.from, args.to);
    case "roast":          return roast(message, args);
    case "joke":           return joke();
    case "meme":           return meme();
    case "magic8ball":     return magic8ball();
    case "dice":           return dice();
    case "coinflip":       return coinflip();
    case "web_search":     return web_search(args);
    case "fetch_url":      return fetch_url(args);
    case "site_info":      return site_info(args);
    case "unfurl_url":     return unfurl_url(args);
    case "screenshot":     return screenshot(args);
    case "rss":            return rss(args);
    case "video_to_audio": return video_to_audio(context);
    default:               throw new Error(`unknown tool: ${tool}`);
  }
}

/* ═══════════════════════════════════════════════════════════════
   12 · SUMMARIZATION + MOOD
   ═══════════════════════════════════════════════════════════════ */
async function summarizeHistory(messages) {
  const text = messages.map(m => `${m.role === "user" ? "User" : "AI"}: ${m.content}`).join("\n");
  const prompt = `Summarize the key points, topics, user preferences, and tone of this conversation in 3-5 sentences:\n\n${text}`;
  try { return await callAI("speedster", [{ role: "user", content: prompt }], 0.3, 256); }
  catch { return text.slice(-500); }
}

async function detectMood(text) {
  try {
    const mood = await callAI("speedster", [{ role: "user", content: `Classify the mood of this message as one of: happy, sad, angry, excited, calm, neutral. Respond with one word.\n\nMessage: "${text}"` }], 0.1, 20);
    return mood.trim().toLowerCase();
  } catch { return "neutral"; }
}

/* ═══════════════════════════════════════════════════════════════
   13 · EXPORTS
   ═══════════════════════════════════════════════════════════════ */
module.exports = {
  // connection + DB
  pool,
  ensureTables,
  loadMemory,
  saveMemory,

  // AI
  MODELS,
  DEFAULT_MODEL,
  callAI,
  stripSafety,
  stripSpecialTokens,
  cleanModelOutput,
  summarizeHistory,
  detectMood,

  // tools
  detectTool,
  executeTool,

  // individual tools
  image, calculator, weather, time, dictionary, translate, wikipedia,
  cryptoPrice, stockPrice, qr, shorten, serverinfo, userinfo, reminder,
  note_save, note_list, currency, unit, roast, joke, meme, magic8ball, dice, coinflip,

  // SSRF-safe web
  web_search,
  fetch_url,
  safeFetch,
  htmlToText,
  validateUrl,
  isPublicIP,
  WebError,

  // site recognition
  identifySite,
  extractMeta,
  extractYouTube,
  extractTwitter,
  extractReddit,
  extractGitHub,
  extractWikipedia,
  extractSpotify,
  extractGeneric,
  unfurl,
  site_info,
  unfurl_url,
  screenshot,
  rss,
  SITE_PROFILES,

  // video → audio
  video_to_audio,
  findVideoInMessage,
  isVideoAttachment,

  // kilo
  kiloChat,
  KiloError,
  KILO_MODELS,
  WEB_TOOLS_SCHEMA,
};
