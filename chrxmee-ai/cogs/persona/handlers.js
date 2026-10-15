// cogs/persona/handlers.js
// messageCreate hook → ingest + speak. Fire-and-forget, never blocks.

const schema  = require("./schema");
const learner = require("./learner");
const speaker = require("./speaker");

const DEBUG = true;
const log  = (...a) => { if (DEBUG) console.log("[persona/handler]", ...a); };
const warn = (...a) => console.warn("[persona/handler]", ...a);

const SPEAKING = new Set();
const SPEAK_TIMEOUT_MS = 30_000;   // hard cap — force-release the lock

async function onMessageCreate(message, client) {
  if (!message.guild) return;
  if (message.author.bot) return;
  if (!message.content) return;

  // 1. ingest — always fire, never blocks anything
  learner.ingestMessage(client, message).catch((e) =>
    warn(`ingest threw: ${e.message}`)
  );

  // 2. speak — one at a time per channel
  if (SPEAKING.has(message.channelId)) {
    log(`speak locked ch=${message.channelId}`);
    return;
  }
  SPEAKING.add(message.channelId);

  // safety: force-release the lock if something hangs
  const lockTimer = setTimeout(() => {
    warn(`speak lock timeout ch=${message.channelId}, releasing`);
    SPEAKING.delete(message.channelId);
  }, SPEAK_TIMEOUT_MS);
  lockTimer.unref?.();

  // fire-and-forget — do NOT await, let handler return immediately
  (async () => {
    try {
      const reply = await speaker.considerServerSpeak(client, message);
      if (!reply) return;

      log(`speak: sending reply`);
      const sendOpts = { content: reply.text };
      if (reply.replyTo && !reply.mentioned) {
        sendOpts.reply = { messageReference: reply.replyTo, failIfNotExists: false };
      }
      await message.channel.send(sendOpts).catch((e) => warn(`send failed: ${e.message}`));
    } catch (e) {
      warn(`speak threw: ${e.message}`);
    } finally {
      clearTimeout(lockTimer);
      SPEAKING.delete(message.channelId);
    }
  })();
}

function install(client) {
  log("install() called");
  schema.ensureTables(client.pool).catch((e) =>
    console.error("[persona/handler] schema init failed:", e.message)
  );

  learner.startFlushLoop(client);

  client.on("messageCreate", (message) => {
    onMessageCreate(message, client).catch((e) =>
      console.error("[persona/handler] top-level:", e.message)
    );
  });

  log("handlers installed ✅");
}

module.exports = { install, onMessageCreate };
