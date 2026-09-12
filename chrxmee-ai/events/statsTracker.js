// events/statsTracker.js — batched stats counters
module.exports = {
  name: "ready",
  once: true,
  execute(client) {
    // buffers
    if (!client.statsBuffer) {
      client.statsBuffer = {
        userMessages: new Map(), // `${guildId}-${userId}` -> count
        guildMessages: new Map(), // guildId -> count
        userVc: new Map(),       // `${guildId}-${userId}` -> seconds
        guildVc: new Map(),      // guildId -> seconds
        userCommands: new Map(),
        guildCommands: new Map(),
        voiceJoinTimes: new Map(), // `${guildId}-${userId}` -> timestamp
      };
    }

    const pool = client.pool;

    // ── VC join/leave tracking ──
    client.on("voiceStateUpdate", async (oldState, newState) => {
      const guildId = newState.guild.id;
      const userId = newState.id;
      const key = `${guildId}-${userId}`;
      const wasInVc = !!oldState.channelId;
      const isInVc = !!newState.channelId;

      // joined
      if (!wasInVc && isInVc) {
        client.statsBuffer.voiceJoinTimes.set(key, Date.now());
        return;
      }

      // left
      if (wasInVc && !isInVc) {
        const start = client.statsBuffer.voiceJoinTimes.get(key);
        if (start) {
          const seconds = Math.floor((Date.now() - start) / 1000);
          if (seconds > 0 && seconds < 86400) {
            const prev = client.statsBuffer.userVc.get(key) || 0;
            client.statsBuffer.userVc.set(key, prev + seconds);
            const gPrev = client.statsBuffer.guildVc.get(guildId) || 0;
            client.statsBuffer.guildVc.set(guildId, gPrev + seconds);
          }
          client.statsBuffer.voiceJoinTimes.delete(key);
        }
        return;
      }

      // switched channels, no change needed
    });

    // ── Flush loop ──
    setInterval(async () => {
      const buf = client.statsBuffer;
      if (!buf) return;

      try {
        // messages
        const userMsgs = [...buf.userMessages.entries()];
        buf.userMessages.clear();
        const guildMsgs = [...buf.guildMessages.entries()];
        buf.guildMessages.clear();

        for (const [key, count] of userMsgs) {
          const [guildId, userId] = key.split("-");
          await pool.query(`
            INSERT INTO user_stats (user_id, guild_id, messages_sent, last_seen)
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT (user_id, guild_id) DO UPDATE
            SET messages_sent = user_stats.messages_sent + $3,
                last_seen = NOW()
          `, [userId, guildId, count]);
        }

        for (const [guildId, count] of guildMsgs) {
          await pool.query(`
            INSERT INTO guild_stats (guild_id, total_messages, last_updated)
            VALUES ($1, $2, NOW())
            ON CONFLICT (guild_id) DO UPDATE
            SET total_messages = guild_stats.total_messages + $2,
                last_updated = NOW()
          `, [guildId, count]);
        }

        // vc seconds
        const userVc = [...buf.userVc.entries()];
        buf.userVc.clear();
        const guildVc = [...buf.guildVc.entries()];
        buf.guildVc.clear();

        for (const [key, seconds] of userVc) {
          const [guildId, userId] = key.split("-");
          await pool.query(`
            INSERT INTO user_stats (user_id, guild_id, vc_seconds, voice_sessions)
            VALUES ($1, $2, $3, 1)
            ON CONFLICT (user_id, guild_id) DO UPDATE
            SET vc_seconds = user_stats.vc_seconds + $3,
                voice_sessions = user_stats.voice_sessions + 1
          `, [userId, guildId, seconds]);
        }

        for (const [guildId, seconds] of guildVc) {
          await pool.query(`
            INSERT INTO guild_stats (guild_id, total_vc_seconds, last_updated)
            VALUES ($1, $2, NOW())
            ON CONFLICT (guild_id) DO UPDATE
            SET total_vc_seconds = guild_stats.total_vc_seconds + $2,
                last_updated = NOW()
          `, [guildId, seconds]);
        }

        // commands
        const userCmds = [...buf.userCommands.entries()];
        buf.userCommands.clear();
        const guildCmds = [...buf.guildCommands.entries()];
        buf.guildCommands.clear();

        for (const [key, count] of userCmds) {
          const [guildId, userId] = key.split("-");
          await pool.query(`
            INSERT INTO user_stats (user_id, guild_id, commands_used)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id, guild_id) DO UPDATE
            SET commands_used = user_stats.commands_used + $3
          `, [userId, guildId, count]);
        }

        for (const [guildId, count] of guildCmds) {
          await pool.query(`
            INSERT INTO guild_stats (guild_id, total_commands, last_updated)
            VALUES ($1, $2, NOW())
            ON CONFLICT (guild_id) DO UPDATE
            SET total_commands = guild_stats.total_commands + $2,
                last_updated = NOW()
          `, [guildId, count]);
        }
      } catch (err) {
        console.error("stats flush error:", err.message);
      }
    }, 30000);

    // ── Message counter hook ──
    client.on("messageCreate", (message) => {
      if (!message.guild || message.author.bot) return;
      const key = `${message.guild.id}-${message.author.id}`;
      client.statsBuffer.userMessages.set(key, (client.statsBuffer.userMessages.get(key) || 0) + 1);
      client.statsBuffer.guildMessages.set(
        message.guild.id,
        (client.statsBuffer.guildMessages.get(message.guild.id) || 0) + 1
      );
    });

    // ── Command counter hook ──
    client.on("interactionCreate", (interaction) => {
      if (!interaction.isChatInputCommand()) return;
      if (!interaction.guildId) return;
      const key = `${interaction.guildId}-${interaction.user.id}`;
      client.statsBuffer.userCommands.set(key, (client.statsBuffer.userCommands.get(key) || 0) + 1);
      client.statsBuffer.guildCommands.set(
        interaction.guildId,
        (client.statsBuffer.guildCommands.get(interaction.guildId) || 0) + 1
      );
    });

    // ── Member join/leave counters ──
    client.on("guildMemberAdd", async (member) => {
      if (member.user.bot) return;
      try {
        await pool.query(`
          INSERT INTO guild_stats (guild_id, total_joins, total_members, last_updated)
          VALUES ($1, 1, $2, NOW())
          ON CONFLICT (guild_id) DO UPDATE
          SET total_joins = guild_stats.total_joins + 1,
              total_members = $2,
              last_updated = NOW()
        `, [member.guild.id, member.guild.memberCount]);
      } catch (err) {
        console.error("stats join error:", err.message);
      }
    });

    client.on("guildMemberRemove", async (member) => {
      if (member.user.bot) return;
      try {
        await pool.query(`
          INSERT INTO guild_stats (guild_id, total_leaves, total_members, last_updated)
          VALUES ($1, 1, $2, NOW())
          ON CONFLICT (guild_id) DO UPDATE
          SET total_leaves = guild_stats.total_leaves + 1,
              total_members = $2,
              last_updated = NOW()
        `, [member.guild.id, member.guild.memberCount]);
      } catch (err) {
        console.error("stats leave error:", err.message);
      }
    });

    // ── Flush on shutdown ──
    process.on("SIGTERM", async () => {
      try {
        const buf = client.statsBuffer;
        if (!buf) return;
        // simple final flush: just run through pending messages
        for (const [key, count] of buf.userMessages) {
          const [guildId, userId] = key.split("-");
          await pool.query(`
            INSERT INTO user_stats (user_id, guild_id, messages_sent) VALUES ($1,$2,$3)
            ON CONFLICT (user_id, guild_id) DO UPDATE SET messages_sent = user_stats.messages_sent + $3
          `, [userId, guildId, count]);
        }
      } catch {}
      process.exit(0);
    });

    console.log("✅ stats tracker ready");
  },
};
