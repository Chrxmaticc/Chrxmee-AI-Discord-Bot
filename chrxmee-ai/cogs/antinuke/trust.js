// cogs/antinuke/trust.js
// cross-guild ban sharing network.

const { E, COLORS } = require("./constants");
const store = require("./store");

/* ═══════════════════════════════════════════════════════════════
   SHARE BAN TO TRUSTED GUILDS
   ═══════════════════════════════════════════════════════════════ */
async function shareBanToTrusted(client, originGuildId, userId, reason) {
  try {
    const receivers = await store.getTrustedReceivers(client.pool, originGuildId);
    if (!receivers?.length) return;

    // record in network_bans so it's queryable
    await store.recordNetworkBan(client.pool, { originGuild: originGuildId, userId, reason });

    for (const targetGuildId of receivers) {
      const guild = client.guilds.cache.get(targetGuildId);
      if (!guild) continue;

      // does the target accept bans from us?
      const sources = await store.getTrustedSources(client.pool, targetGuildId);
      if (!sources.includes(originGuildId)) continue;

      try {
        // check if already banned
        const existing = await guild.bans.fetch(userId).catch(() => null);
        if (existing) continue;

        await guild.bans.create(userId, {
          reason: `antinuke network: banned in ${originGuildId} — ${reason}`,
          deleteMessageSeconds: 60 * 60,
        });

        // notify target guild's log channel
        const targetCfg = await store.getSettings(client.pool, targetGuildId);
        if (targetCfg.settings.notify?.logChannel) {
          const ch = await client.channels.fetch(targetCfg.settings.notify.logChannel).catch(() => null);
          if (ch?.isTextBased?.()) {
            await ch.send({
              embeds: [{
                color: COLORS.antinuke,
                title: `${E.shield} network ban applied`,
                description:
                  `**user:** <@${userId}> (\`${userId}\`)\n` +
                  `**origin guild:** \`${originGuildId}\`\n` +
                  `**reason:** ${reason}`,
              }],
            }).catch(() => {});
          }
        }
      } catch (err) {
        console.warn(`[antinuke/trust] failed to ban ${userId} in ${targetGuildId}: ${err.message}`);
      }
    }
  } catch (err) {
    console.error("[antinuke/trust] shareBanToTrusted failed:", err.message);
  }
}

/* ═══════════════════════════════════════════════════════════════
   CHECK INCOMING MEMBER AGAINST NETWORK BANS
   ═══════════════════════════════════════════════════════════════ */
async function checkIncomingAgainstNetwork(client, member) {
  try {
    const guild = member.guild;
    const cfg = await store.getSettings(client.pool, guild.id);
    if (!cfg.enabled) return;
    if (!cfg.settings.trust?.enabled) return;
    if (!cfg.settings.trust?.acceptBans) return;
    if (cfg.mode === "dry-run") return;

    const sources = await store.getTrustedSources(client.pool, guild.id);
    if (!sources?.length) return;

    const hit = await store.isNetworkBanned(client.pool, member.id, sources);
    if (!hit) return;

    // verify against an audit reason
    await member.ban({
      reason: `antinuke network: banned in ${hit.origin_guild} — ${hit.reason || "no reason"}`,
      deleteMessageSeconds: 60 * 60,
    }).catch((err) => {
      console.warn(`[antinuke/trust] incoming ban failed: ${err.message}`);
    });

    const notify = cfg.settings.notify || {};
    if (notify.logChannel) {
      const ch = await client.channels.fetch(notify.logChannel).catch(() => null);
      if (ch?.isTextBased?.()) {
        await ch.send({
          embeds: [{
            color: COLORS.antinuke,
            title: `${E.ban} network-banned user joined & was banned`,
            description:
              `**user:** <@${member.id}> (\`${member.id}\`)\n` +
              `**from guild:** \`${hit.origin_guild}\`\n` +
              `**reason:** ${hit.reason || "—"}\n` +
              `**joined at:** <t:${Math.floor(Date.now() / 1000)}:R>`,
          }],
        }).catch(() => {});
      }
    }
  } catch (err) {
    console.error("[antinuke/trust] checkIncoming failed:", err.message);
  }
}

module.exports = {
  shareBanToTrusted,
  checkIncomingAgainstNetwork,
};
