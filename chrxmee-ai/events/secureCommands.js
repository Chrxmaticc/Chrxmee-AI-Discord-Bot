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
      if (originalExecute.has(name)) continue; // avoid double wrapping

      const original = command.execute;
      originalExecute.set(name, original);

      command.execute = async function (interaction, ...rest) {
        // Owner-only commands bypass everything
        if (name === "blacklist" || name === "whitelist" || name === "cmdaccess") {
          return original.call(this, interaction, ...rest);
        }

        const userId = interaction.user.id;
        const guildId = interaction.guildId;

        try {
          // ─── BLACKLIST CHECK (user, then server) ───
          const userBl = await pool.query(`SELECT reason FROM user_blacklist WHERE user_id = $1`, [userId]);
          if (userBl.rows[0]) {
            const reason = userBl.rows[0].reason || "no reason provided";
            await interaction.reply({ content: `${E.error} yeah you can’t access this command, WELL FOLLOW THE RULES BUDDY. heres the reason, appeal in ${APPEAL_LINK} if you think this is false. reason: ${reason}`, ephemeral: true });
            return;
          }

          if (guildId) {
            const serverBl = await pool.query(`SELECT reason FROM server_blacklist WHERE guild_id = $1`, [guildId]);
            if (serverBl.rows[0]) {
              const reason = serverBl.rows[0].reason || "no reason provided";
              await interaction.reply({ content: `${E.error} this server is blacklisted. reason: ${reason}. appeal at ${APPEAL_LINK}`, ephemeral: true });
              return;
            }
          }

          // ─── COMMAND ACCESS CHECK ───
          if (guildId) {
            // Get default mode
            const defRes = await pool.query(`SELECT cmd_default_mode FROM guild_settings WHERE guild_id = $1`, [guildId]);
            const defaultMode = defRes.rows[0]?.cmd_default_mode || "allow_all";

            // Get all rules for this command (including 'all')
            const commandName = name; // the command's name
            const rules = await pool.query(
              `SELECT target_type, target_id, access FROM cmd_access
               WHERE guild_id = $1 AND (command_name = $2 OR command_name = 'all')`,
              [guildId, commandName]
            );

            let allowed = defaultMode === "allow_all"; // if allow_all, default allow; if deny_all, default deny

            for (const rule of rules.rows) {
              const isMatch = rule.target_type === "user" 
                ? rule.target_id === userId 
                : interaction.member.roles.cache.has(rule.target_id);
              if (!isMatch) continue;

              if (rule.access === "deny") {
                allowed = false;
                break; // deny overrides
              } else if (rule.access === "allow") {
                allowed = true;
              }
            }

            if (!allowed) {
              await interaction.reply({ content: `${E.error} you don't have permission to use this command in this server.`, ephemeral: true });
              return;
            }
          }

          // All checks passed, execute original
          return original.call(this, interaction, ...rest);
        } catch (err) {
          console.error(`Command gate error for ${name}:`, err.message);
          // If gate fails, still try to execute original to avoid breaking
          return original.call(this, interaction, ...rest);
        }
      };
    }

    console.log(" Slash commands wrapped with blacklist + command access checks.");
  },
};
