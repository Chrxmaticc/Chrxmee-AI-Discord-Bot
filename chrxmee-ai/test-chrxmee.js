// ─────────────────────────────────────────────
//  ChrxmeeStream v2.0.0 — Integration test
//  Run this against your running server to
//  verify all ops work before wiring into
//  your main bot.
// ─────────────────────────────────────────────

const WebSocket = require("ws");
const CHRXMEE_URL  = process.env.CHRXMEE_URL  || "ws://localhost:2333";
const CHRXMEE_PASS = process.env.CHRXMEE_PASS || "chrxmee";
const TEST_GUILD   = "test-guild-123";

let ws;
let passed = 0;
let failed = 0;

function log(icon, msg) {
  console.log(`  ${icon} ${msg}`);
}

function pass(msg) { passed++; log("✅", msg); }
function fail(msg) { failed++; log("❌", msg); }

function send(op) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Timeout")), 5000);

    const handler = (data, isBinary) => {
      if (isBinary) return; // Skip audio chunks
      const event = JSON.parse(data.toString());
      clearTimeout(timeout);
      ws.removeListener("message", handler);
      resolve(event);
    };

    ws.on("message", handler);
    ws.send(JSON.stringify({ guildId: TEST_GUILD, ...op }));
  });
}

async function test(name, op, check) {
  try {
    const event = await send(op);
    if (check(event)) {
      pass(name);
    } else {
      fail(`${name} — unexpected response: ${JSON.stringify(event).slice(0, 80)}`);
    }
  } catch (err) {
    fail(`${name} — ${err.message}`);
  }
}

async function runTests() {
  console.log("\n🧪 ChrxmeeStream v2.0.0 Integration Test\n");
  console.log(`📍 Target: ${CHRXMEE_URL}\n`);

  // ── Connect ────────────────────────────────
  console.log("Connecting...");
  ws = new WebSocket(CHRXMEE_URL, {
    headers: { Authorization: CHRXMEE_PASS },
  });

  await new Promise((resolve, reject) => {
    ws.on("open", resolve);
    ws.on("error", reject);
    setTimeout(() => reject(new Error("Connection timeout")), 5000);
  });

  pass("WebSocket connected");

  // Wait for ready event
  await new Promise((resolve) => {
    ws.once("message", (data) => {
      const event = JSON.parse(data.toString());
      if (event.event === "ready") {
        pass(`Ready — Session: ${event.data.sessionId?.slice(0, 8)}... | Node: ${event.data.nodeId ?? "N/A"}`);
        resolve();
      }
    });
  });

  console.log("\n── Core Playback ──\n");

  await test("play", { op: "play", source: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
    (e) => e.event === "trackStart"
  );

  await test("pause", { op: "pause" },
    (e) => e.event === "paused"
  );

  await test("resume", { op: "resume" },
    (e) => e.event === "resumed"
  );

  await test("volume", { op: "volume", value: 80 },
    (e) => e.event === "volumeSet" && e.data?.volume === 80
  );

  await test("seek", { op: "seek", value: 30 },
    (e) => e.event === "seeked" && e.data?.position === 30
  );

  await test("filter", { op: "filter", filters: ["bassboost"] },
    (e) => e.event === "filterSet" && e.data?.filters?.[0] === "bassboost"
  );

  await test("filter clear", { op: "filter", filters: [] },
    (e) => e.event === "filterSet" && e.data?.filters?.length === 0
  );

  console.log("\n── Queue ──\n");

  await test("queue_add", { op: "queue_add", source: "https://soundcloud.com/test/track" },
    (e) => e.event === "queueUpdated"
  );

  await test("queue_list", { op: "queue_list" },
    (e) => e.event === "queueList"
  );

  await test("queue_shuffle", { op: "queue_shuffle" },
    (e) => e.event === "queueUpdated"
  );

  await test("queue_loop", { op: "queue_loop", value: "track" },
    (e) => e.event === "loopSet" && e.data?.mode === "track"
  );

  await test("queue_remove", { op: "queue_remove", position: 0 },
    (e) => e.event === "queueUpdated"
  );

  await test("queue_clear", { op: "queue_clear" },
    (e) => e.event === "queueCleared"
  );

  console.log("\n── Playlists ──\n");

  let playlistId;

  await test("playlist_create", { op: "playlist_create", playlistName: "Test Playlist" },
    (e) => {
      if (e.event === "playlistCreated" && e.data?.id) {
        playlistId = e.data.id;
        return true;
      }
      return false;
    }
  );

  if (playlistId) {
    await test("playlist_add", { op: "playlist_add", playlistId, source: "https://youtu.be/test" },
      (e) => e.event === "playlistUpdated"
    );

    await test("playlist_get", { op: "playlist_get", playlistId },
      (e) => e.event === "playlistTracks"
    );

    await test("playlist_list", { op: "playlist_list" },
      (e) => e.event === "playlistList"
    );

    await test("playlist_delete", { op: "playlist_delete", playlistId },
      (e) => e.event === "playlistDeleted"
    );
  } else {
    fail("playlist_create — no ID returned, skipping dependent tests");
  }

  console.log("\n── History ──\n");

  await test("history", { op: "history", limit: 5 },
    (e) => e.event === "historyList"
  );

  await test("history_search", { op: "history_search", query: "test" },
    (e) => e.event === "historySearch"
  );

  console.log("\n── Recording ──\n");

  await test("record_start", { op: "record_start" },
    (e) => e.event === "recordStarted"
  );

  await test("record_stop", { op: "record_stop" },
    (e) => e.event === "recordStopped"
  );

  console.log("\n── Auto DJ & Silence Guard ──\n");

  await test("autodj_enable", { op: "autodj_enable" },
    (e) => e.event === "autoDJEnabled"
  );

  await test("autodj_disable", { op: "autodj_disable" },
    (e) => e.event === "autoDJDisabled"
  );

  await test("silenceguard_enable", { op: "silenceguard_enable" },
    (e) => e.event === "silenceGuardEnabled"
  );

  await test("silenceguard_disable", { op: "silenceguard_disable" },
    (e) => e.event === "silenceGuardDisabled"
  );

  console.log("\n── System ──\n");

  await test("stats", { op: "stats" },
    (e) => e.event === "stats"
  );

  await test("cache_stats", { op: "cache_stats" },
    (e) => e.event === "cacheStats"
  );

  await test("diagnostics", { op: "diagnostics" },
    (e) => e.event === "diagnostics"
  );

  console.log("\n── Cleanup ──\n");

  await test("stop", { op: "stop" },
    (e) => e.event === "stopped"
  );

  await test("destroy", { op: "destroy" },
    (e) => e.event === "destroyed"
  );

  // ── Results ────────────────────────────────
  console.log("\n" + "═".repeat(50));
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed, ${passed + failed} total\n`);

  if (failed === 0) {
    console.log("🎉 All tests passed! ChrxmeeStream v2.0.0 is ready.\n");
  } else {
    console.log(`⚠️  ${failed} test(s) failed. Check the output above.\n`);
  }

  ws.close();
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error("\n💥 Test runner crashed:", err.message);
  process.exit(1);
});
