/* cogs/verification/captcha/index.js — captcha wrapper */

const fonts = require('./fonts');
const text = require('./text');
const math = require('./math');

/* live token cache: token -> { answer, expiresAt, attempts, maxAttempts } */
const cache = new Map();

fonts.load();

function newToken() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

async function createCaptcha(style = 'text', opts = {}) {
  const gen = style === 'math' ? math : text;
  const result = await gen.generate(opts);
  const token = newToken();
  const expiryMs = (opts.expirySeconds || 300) * 1000;
  cache.set(token, {
    answer: result.answer,
    display: result.display,
    expiresAt: Date.now() + expiryMs,
    attempts: 0,
    maxAttempts: opts.maxAttempts || 3,
  });
  return { token, buffer: result.buffer };
}

function checkCaptcha(token, submitted) {
  const entry = cache.get(token);
  if (!entry) return { ok: false, reason: 'expired' };
  if (Date.now() > entry.expiresAt) {
    cache.delete(token);
    return { ok: false, reason: 'expired' };
  }
  entry.attempts++;
  const normalized = String(submitted).trim().toLowerCase();
  const expected = String(entry.answer).toLowerCase();
  if (normalized !== expected) {
    if (entry.attempts >= entry.maxAttempts) {
      cache.delete(token);
      return { ok: false, reason: 'max_attempts' };
    }
    return { ok: false, reason: 'wrong', attemptsLeft: entry.maxAttempts - entry.attempts };
  }
  cache.delete(token);
  return { ok: true };
}

function clearToken(token) {
  cache.delete(token);
}

/* sweep expired tokens every 5 min */
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of cache) if (v.expiresAt < now) cache.delete(k);
}, 5 * 60000);

module.exports = { createCaptcha, checkCaptcha, clearToken };
