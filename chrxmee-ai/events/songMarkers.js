/**
 * utils/songMarkers.js
 * Per-track start/end marker system — lavalink-client v2 compatible.
 *
 * Markers are stored in memory. They persist as long as the bot is running
 * but reset on restart. Swap the Map for Postgres if you want them permanent.
 */

// Key: track URI (or title fallback) → { start?: ms, end?: ms, loop?: bool }
const markers = new Map();

// Active end-marker watcher per guild: guildId → intervalId
const endIntervals = new Map();

// ── Time utilities ────────────────────────────────────────────────────────

/**
 * Parse "mm:ss" or "hh:mm:ss" into milliseconds.
 * Returns null if the format is invalid.
 */
function parseTime(timeStr) {
  const parts = timeStr.trim().split(":").map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 2) return (parts[0] * 60 + parts[1]) * 1000;
  if (parts.length === 3) return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
  return null;
}

/**
 * Format milliseconds into a readable "m:ss" string.
 */
function formatTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ── Key resolution ────────────────────────────────────────────────────────

/**
 * Get a stable unique key for a track.
 * lavalink-client v2 stores info under track.info.*
 */
function getKey(track) {
  return track?.info?.uri || track?.info?.title || track?.uri || track?.title || null;
}

// ── Marker CRUD ───────────────────────────────────────────────────────────

/**
 * Set a start or end marker on a track.
 * @param {object} track
 * @param {"start"|"end"} type
 * @param {number} ms
 * @param {boolean} [loop=false]  Only relevant for end markers
 */
function setMarker(track, type, ms, loop = false) {
  const key = getKey(track);
  if (!key) return;
  const existing = markers.get(key) || {};
  markers.set(key, {
    ...existing,
    [type]: ms,
    ...(type === "end" ? { loop } : {}),
  });
}

/**
 * Get the markers object for a track ({ start?, end?, loop? }) or null.
 */
function getMarkers(track) {
  const key = getKey(track);
  if (!key) return null;
  return markers.get(key) || null;
}

/**
 * Clear a start, end, or both markers from a track.
 * @param {object} track
 * @param {"start"|"end"|"both"} type
 */
function clearMarker(track, type) {
  const key = getKey(track);
  if (!key) return;
  const existing = markers.get(key);
  if (!existing) return;

  if (type === "both") {
    markers.delete(key);
    return;
  }

  delete existing[type];
  if (type === "end") delete existing.loop;

  if (existing.start == null && existing.end == null) {
    markers.delete(key);
  } else {
    markers.set(key, existing);
  }
}

// ── Marker application ────────────────────────────────────────────────────

/**
 * Seek to the start marker when a track begins.
 * Called inside the trackStart event.
 *
 * lavalink-client v2: player.seek(ms) accepts a number.
 */
async function applyStartMarker(player, track) {
  const m = getMarkers(track);
  if (!m?.start) return;

  // Brief delay so Lavalink has buffered enough to accept a seek
  await sleep(350);

  try {
    await player.seek(m.start);
  } catch (err) {
    console.error("[SongMarkers] applyStartMarker failed:", err.message);
  }
}

/**
 * Start a 500ms polling interval that enforces the end marker.
 * When position >= end marker:
 *   - If loop is true  → seek back to start marker (or 0)
 *   - If loop is false → skip to the next track
 *
 * @param {object} player
 * @param {object} track
 * @param {boolean} [loop=false]
 */
function startEndMarkerWatcher(player, track, loop = false) {
  stopEndMarkerWatcher(player.guildId); // always clear before starting fresh

  const m = getMarkers(track);
  if (!m?.end) return;

  const intervalId = setInterval(async () => {
    try {
      // If the player moved on to a different track, stop watching
      const current = player.queue?.current;
      if (!current || getKey(current) !== getKey(track)) {
        stopEndMarkerWatcher(player.guildId);
        return;
      }

      // lavalink-client v2: player.position is a number in ms
      if (player.position >= m.end) {
        if (loop) {
          const seekTo = m.start ?? 0;
          await player.seek(seekTo);
        } else {
          // Skip to next track (or stop if queue is empty)
          await player.skip().catch(() => player.stopTrack());
          stopEndMarkerWatcher(player.guildId);
        }
      }
    } catch (err) {
      console.error("[SongMarkers] endMarkerWatcher tick failed:", err.message);
    }
  }, 500);

  endIntervals.set(player.guildId, intervalId);
}

/**
 * Stop the end marker watcher for a guild.
 */
function stopEndMarkerWatcher(guildId) {
  if (endIntervals.has(guildId)) {
    clearInterval(endIntervals.get(guildId));
    endIntervals.delete(guildId);
  }
}

// ── Internal ──────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

module.exports = {
  parseTime,
  formatTime,
  getKey,
  setMarker,
  getMarkers,
  clearMarker,
  applyStartMarker,
  startEndMarkerWatcher,
  stopEndMarkerWatcher,
};
