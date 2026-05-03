/**
 * ./songMarkers.js
 * Per-track start/end marker system — ChrxmeeStream v2 compatible.
 *
 * Since ChrxmeeStream doesn't expose player.position for polling,
 * end markers use setTimeout based on track duration.
 * Markers are stored in memory. Reset on restart.
 */

// Key: track URI (or title fallback) → { start?: seconds, end?: seconds, loop?: bool }
const markers = new Map();

// Active end-marker timeout per guild: guildId → timeoutId
const endTimeouts = new Map();

// ==================== TIME UTILITIES ====================

/**
 * Parse "mm:ss", "hh:mm:ss", or raw seconds into seconds (number).
 * Returns null if invalid.
 */
function parseTime(timeStr) {
  if (typeof timeStr === "number") return timeStr;
  if (!timeStr || typeof timeStr !== "string") return null;

  const trimmed = timeStr.trim();

  // Raw number string like "90"
  if (/^\d+$/.test(trimmed)) return parseInt(trimmed);

  // Colon format
  const parts = trimmed.split(":").map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

/**
 * Format seconds into "m:ss" or "h:mm:ss".
 */
function formatTime(seconds) {
  if (seconds == null || isNaN(seconds)) return "0:00";
  const totalSec = Math.floor(seconds);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ==================== KEY RESOLUTION ====================

/**
 * Get a stable unique key for a track.
 * Uses the source URL or title as identifier.
 */
function getKey(track) {
  if (!track) return null;
  return track.uri || track.title || track.source || null;
}

// ==================== MARKER CRUD ====================

/**
 * Set a start or end marker on a track.
 * @param {object|string} track - Track object or source string
 * @param {"start"|"end"} type
 * @param {number} seconds
 * @param {boolean} [loop=false]
 */
function setMarker(track, type, seconds, loop = false) {
  const key = getKey(track) || (typeof track === "string" ? track : null);
  if (!key) return false;

  const existing = markers.get(key) || {};
  markers.set(key, {
    ...existing,
    [type]: seconds,
    ...(type === "end" ? { loop: loop ?? existing.loop ?? false } : {}),
  });

  console.log(`[SongMarkers] ${type} marker set for "${key.slice(0, 50)}..." at ${formatTime(seconds)}`);
  return true;
}

/**
 * Get the markers for a track: { start?, end?, loop? } or null.
 */
function getMarkers(track) {
  const key = getKey(track) || (typeof track === "string" ? track : null);
  if (!key) return null;
  return markers.get(key) || null;
}

/**
 * Clear markers from a track.
 * @param {object|string} track
 * @param {"start"|"end"|"both"} type
 */
function clearMarker(track, type) {
  const key = getKey(track) || (typeof track === "string" ? track : null);
  if (!key) return false;

  if (type === "both") {
    markers.delete(key);
    console.log(`[SongMarkers] All markers cleared for "${key.slice(0, 50)}..."`);
    return true;
  }

  const existing = markers.get(key);
  if (!existing) return false;

  delete existing[type];
  if (type === "end") delete existing.loop;

  if (existing.start == null && existing.end == null) {
    markers.delete(key);
  } else {
    markers.set(key, existing);
  }

  console.log(`[SongMarkers] ${type} marker cleared for "${key.slice(0, 50)}..."`);
  return true;
}

// ==================== MARKER APPLICATION (ChrxmeeStream) ====================

/**
 * Schedule start and end markers via ChrxmeeStream ops.
 * Called by music.js after sending the play op.
 *
 * @param {string} guildId
 * @param {object} markers - { start?, end?, loop? }
 * @param {string} source - The track source (for re-playing on loop)
 */
function scheduleMarkers(guildId, markerData, source) {
  if (!markerData) return;

  const { start, end, loop } = markerData;

  // ── Start marker: seek after a short delay ───────────
  if (start != null && start > 0) {
    setTimeout(() => {
      if (typeof global.sendToChrxmee === "function") {
        global.sendToChrxmee(guildId, { op: "seek", value: start });
        console.log(`[SongMarkers] ⏩ Start marker: seeked to ${formatTime(start)}`);
      }
    }, 400); // Brief delay for track to buffer
  }

  // ── End marker: schedule stop at exact time ──────────
  if (end != null && end > 0) {
    // Calculate duration from start to end
    const effectiveStart = start ?? 0;
    const duration = end - effectiveStart;

    if (duration <= 0) {
      console.warn(`[SongMarkers] ⚠️ End marker (${formatTime(end)}) is before or equal to start (${formatTime(effectiveStart)}). Ignoring.`);
      return;
    }

    // Clear any existing timeout for this guild
    stopEndMarkerWatcher(guildId);

    const timeoutId = setTimeout(() => {
      if (loop) {
        // Re-play the track (seek back to start)
        if (typeof global.sendToChrxmee === "function") {
          global.sendToChrxmee(guildId, { op: "seek", value: effectiveStart });
          console.log(`[SongMarkers] 🔁 Loop: re-seeking to ${formatTime(effectiveStart)}`);

          // Re-schedule the end marker
          scheduleMarkers(guildId, markerData, source);
        }
      } else {
        // Stop or skip
        if (typeof global.sendToChrxmee === "function") {
          global.sendToChrxmee(guildId, { op: "stop" });
          console.log(`[SongMarkers] ⏹️ End marker reached at ${formatTime(end)}`);
        }
      }
    }, duration * 1000);

    endTimeouts.set(guildId, timeoutId);
    console.log(`[SongMarkers] ⏹️ End marker scheduled at ${formatTime(end)} (${duration}s from start)`);
  }
}

/**
 * Stop the end marker timeout for a guild.
 * Call this when a track is manually stopped, skipped, or the bot leaves.
 */
function stopEndMarkerWatcher(guildId) {
  if (endTimeouts.has(guildId)) {
    clearTimeout(endTimeouts.get(guildId));
    endTimeouts.delete(guildId);
    console.log(`[SongMarkers] 🛑 End marker watcher stopped for guild ${guildId}`);
  }
}

/**
 * Clear all timeouts (call on bot shutdown).
 */
function stopAllWatchers() {
  for (const [guildId, timeoutId] of endTimeouts) {
    clearTimeout(timeoutId);
  }
  endTimeouts.clear();
  console.log("[SongMarkers] All watchers stopped.");
}

// ==================== EXPORTS ====================

module.exports = {
  // Time utilities
  parseTime,
  formatTime,

  // Key resolution
  getKey,

  // Marker CRUD
  setMarker,
  getMarkers,
  clearMarker,

  // ChrxmeeStream integration
  scheduleMarkers,
  stopEndMarkerWatcher,
  stopAllWatchers,
};
