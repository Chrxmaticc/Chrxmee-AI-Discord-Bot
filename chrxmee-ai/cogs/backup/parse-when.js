// cogs/backup/parse-when.js
// natural-language time parser: "in 2h", "5 minutes", "at 3pm", "tomorrow 9am"

const UNIT_MS = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 };

function parseWhen(input, now = Date.now()) {
  if (!input) return null;
  const s = String(input).trim().toLowerCase();

  // relative: "in 5m", "5 minutes", "2h", "1 week"
  const rel = s.match(
    /^(?:in\s+)?(\d+(?:\.\d+)?)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days|w|week|weeks)\b/i
  );
  if (rel) {
    const n = parseFloat(rel[1]);
    const unit = rel[2][0].toLowerCase();
    const ms = UNIT_MS[unit];
    if (ms) return now + Math.round(n * ms);
  }

  // "at 3pm", "3:30", "tomorrow 9am"
  const atTime = s.match(/(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  const isTomorrow = /\btomorrow\b/.test(s);

  if (atTime && (atTime[3] || atTime[2])) {
    let hour = parseInt(atTime[1], 10);
    const min = parseInt(atTime[2] || "0", 10);
    const ampm = atTime[3];
    if (ampm === "pm" && hour < 12) hour += 12;
    if (ampm === "am" && hour === 12) hour = 0;
    if (hour > 23 || min > 59) return null;

    const d = new Date(now);
    if (isTomorrow) d.setDate(d.getDate() + 1);
    d.setHours(hour, min, 0, 0);
    if (d.getTime() <= now) d.setDate(d.getDate() + 1);
    return d.getTime();
  }

  // absolute date fallback: "2026-12-25 15:00"
  const parsed = new Date(input);
  if (!isNaN(parsed.getTime()) && parsed.getTime() > now) return parsed.getTime();

  return null;
}

module.exports = { parseWhen };
