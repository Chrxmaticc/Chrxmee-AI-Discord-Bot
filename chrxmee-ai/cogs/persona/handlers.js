// cogs/persona/handlers.js
// messageCreate hook → ingest for learning + maybe speak as server persona.

const schema  = require("./schema");
const learner = require("./learner");
const speaker = require("./speaker");
const store   = require("./store");

// per-channel reply-in-progress lock to prevent double-speaking
const SPEAKING = new Set();

async function onMessageCreate(message, client) {
  if (!message.guild) return;
  if (message.author.bot) return;
  if (!message.content) return;

  // 1. ingest for learning (fire and forget)
  learner.ingestMessage(client, message).catch((err) =>
    console.error("[persona/ingest] failed:", err.message)
  );

  // 2. maybe speak (only one speaker at a time per channel)
  if (SPEAKING.has(message.channelId)) return;
  SPEAKING.add(message.channelId);
  try {
    const reply = await speaker.considerServerSpeak(client, message);
    if (!reply) return;

    // send
    const sendOpts = { content: reply.text };
    if (reply.replyTo && !reply.mentioned) {
      sendOpts.reply = { messageReference: reply.replyTo, failIfNotExists: false };
    }
    await message.channel.send(sendOpts).catch(() => {});
  } catch (err) {
    console.error("[persona/speak] failed:", err.message);
  } finally {
    SPEAKING.delete(message.channelId);
  }
}

function install(client) {
  schema.ensureTables(client.pool).catch((err) =>
    console.error("[persona] schema init failed:", err.message)
  );

  learner.startFlushLoop(client);

  client.on("messageCreate", (message) => {
    onMessageCreate(message, client).catch((err) =>
      console.error("[persona/handler] failed:", err.message)
    );
  });

  console.log("[persona] handlers installed");
}

module.exports = { install };
