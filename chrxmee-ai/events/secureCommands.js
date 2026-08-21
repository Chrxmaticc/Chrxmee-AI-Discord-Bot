const E = {
  error: "<:no:1530373946795364362>",
};
const APPEAL_LINK = "https://discord.gg/rTrJyPyayg";

module.exports = {
  name: "ready",
  once: true,
  async execute(client) {
    const pool = client.pool;
    const originalExecute = new Map();

    for (const [name, command] of client.commands) {
      if (typeof command.execute !== "function") continue;
      if (originalExecute.has(name)) continue;

      const original = command.execute;
      originalExecute.set(name, original);

      command.execute = async function (interaction, ...rest) {
        if (name === "blacklist" || name === "whitelist" || name === "cmdaccess") {
          return original.call(this, interaction, ...rest);
        }

        const userId = interaction.user.id;
        const guildId = interaction.guildId;

        try {
          // ─── WHITELIST OVERRIDE CHECK ───
          const userWl = await pool.query(`SELECT 1 FROM user_whitelist WHERE user_id = $1`, [userId]);
          const isUserWhitelisted = userWl.rows.length > 0;

          let isServerWhitelisted = false;
          if (guildId) {
            const serverWl = await pool.query(`SELECT 1 FROM server_whitelist WHERE guild_id = $1`, [guildId]);
            isServerWhitelisted = serverWl.rows.length > 0;
          }

          // If both user and server whitelisted, allow
          if (isUserWhitelisted && (guildId ? isServerWhitelisted : true)) {
            return original.call(this, interaction, ...rest);
          }

          // ─── USER BLACKLIST ───
          if (!isUserWhitelisted) {
            const userBl = await pool.query(`SELECT reason FROM user_blacklist WHERE user_id = $1`, [userId]);
            if (userBl.rows[0]) {
              const reason = userBl.rows[0].reason || "no reason provided";
              await interaction.reply({ content: `${E.error} yeah you can’t access this command, WELL FOLLOW THE RULES BUDDY. heres the reason, appeal in ${APPEAL_LINK} if you think this is false. reason: ${reason}`, ephemeral: true });
              return;
            }
          }

          // ─── SERVER BLACKLIST ───
          if (guildId && !isServerWhitelisted) {
            const serverBl = await pool.query(`SELECT reason FROM server_blacklist WHERE guild_id = $1`, [guildId]);
            if (serverBl.rows[0]) {
              const reason = serverBl.rows[0].reason || "no reason provided";
              await interaction.reply({ content: `${E.error} this server is blacklisted. reason: ${reason}. appeal at ${APPEAL_LINK}`, ephemeral: true });
              return;
            }
          }

          // Command access check
          if (guildId) {
            const defRes = await pool.query(`SELECT cmd_default_mode FROM guild_settings WHERE guild_id = $1`, [guildId]);
            const defaultMode = defRes.rows[0]?.cmd_default_mode || "allow_all";

            const rules = await pool.query(
              `SELECT target_type, target_id, access, reason FROM cmd_access
               WHERE guild_id = $1 AND (command_name = $2 OR command_name = 'all')`,
              [guildId, name]
            );

            let allowed = defaultMode === "allow_all";
            let denialReason = null;

            for (const rule of rules.rows) {
              const isMatch = rule.target_type === "user"
                ? rule.target_id === userId
                : interaction.member.roles.cache.has(rule.target_id);
              if (!isMatch) continue;

              if (rule.access === "deny") {
                allowed = false;
                denialReason = rule.reason || null;
                break;
              } else if (rule.access === "allow") {
                allowed = true;
                denialReason = null;
              }
            }

            if (!allowed) {
              const errorMsg = denialReason
                ? `${E.error} ${denialReason}`
                : `${E.error} you don't have permission to use this command in this server.`;
              await interaction.reply({ content: errorMsg, ephemeral: true });
              return;
            }
          }

          return original.call(this, interaction, ...rest);
        } catch (err) {
          console.error(`Command gate error for ${name}:`, err.message);
          return original.call(this, interaction, ...rest);
        }
      };
    }

    console.log(" Slash commands wrapped with blacklist + whitelist override + command access.");
  },
};
