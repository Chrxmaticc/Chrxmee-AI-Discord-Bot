// cogs/persona/handlers.js
// messageCreate hook → ingest for learning + maybe speak as server persona.

const schema  = require("./schema");
const learner = require("./learner");
const speaker = require("./speaker");
const store   = require("./store");

const DEBUG = true;
const log  = (...a) => { if (DEBUG) console.log("[persona/handler]", ...a); };
const warn = (...a) => console.warn("[persona/handler]", ...a);

// per-channel lock so we don't double-speak
const SPEAKING = new Set();

async function onMessageCreate(message, client) {
  log(`saw msg ch=${message.channelId} author=${message.author.id} bot=${message.author.bot} content="${(message.content || "").slice(0, 40)}"`);

  if (!message.guild) { log("bail: dm"); return; }
  if (message.author.bot) { log("bail: bot"); return; }
  if (!message.content) { log("bail: empty content"); return; }

  // 1. ingest (fire and forget)
  learner.ingestMessage(client, message).catch((e) =>
    warn(`ingest threw: ${e.message}`)
  );

  // 2. maybe speak
  if (SPEAKING.has(message.channelId)) { log("bail: already speaking"); return; }
  SPEAKING.add(message.channelId);
  try {
    log(`considering speak for ch=${message.channelId}`);
    const reply = await speaker.considerServerSpeak(client, message);
    if (!reply) { log("speak: no reply"); return; }

    log(`speak: replying — "${reply.text.slice(0, 60)}"`);
    const sendOpts = { content: reply.text };
    if (reply.replyTo && !reply.mentioned) {
      sendOpts.reply = { messageReference: reply.replyTo, failIfNotExists: false };
    }
    await message.channel.send(sendOpts).catch((e) => warn(`send failed: ${e.message}`));
  } catch (e) {
    warn(`speak threw: ${e.message}`);
  } finally {
    SPEAKING.delete(message.channelId);
  }
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
