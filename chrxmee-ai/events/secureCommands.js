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
      originalExecute.set(name, command.execute);

      command.execute = async function (interaction, ...rest) {
        // Always allow owner-only commands
        if (name === "blacklist" || name === "whitelist") {
          return originalExecute.get(name).call(this, interaction, ...rest);
        }

        const userId = interaction.user.id;
        const guildId = interaction.guildId;

        try {
          // ─── CHECK WHITELIST FIRST ───
          const userWl = await pool.query(`SELECT 1 FROM user_whitelist WHERE user_id = $1`, [userId]);
          const isUserWhitelisted = userWl.rows.length > 0;

          let isServerWhitelisted = false;
          if (guildId) {
            const serverWl = await pool.query(`SELECT 1 FROM server_whitelist WHERE guild_id = $1`, [guildId]);
            isServerWhitelisted = serverWl.rows.length > 0;
          }

          // If both user and server are whitelisted, allow without any blacklist check
          if (isUserWhitelisted && (guildId ? isServerWhitelisted : true)) {
            return originalExecute.get(name).call(this, interaction, ...rest);
          }

          // ─── USER BLACKLIST (unless user whitelisted) ───
          if (!isUserWhitelisted) {
            const userBl = await pool.query(`SELECT reason FROM user_blacklist WHERE user_id = $1`, [userId]);
            if (userBl.rows[0]) {
              const reason = userBl.rows[0].reason || "no reason provided";
              await interaction.reply({ content: `${E.error} yeah you can’t access this command, WELL FOLLOW THE RULES BUDDY. heres the reason, appeal in ${APPEAL_LINK} if you think this is false. reason: ${reason}`, ephemeral: true });
              return;
            }
          }

          // ─── SERVER BLACKLIST (unless server whitelisted) ───
          if (guildId && !isServerWhitelisted) {
            const serverBl = await pool.query(`SELECT reason FROM server_blacklist WHERE guild_id = $1`, [guildId]);
            if (serverBl.rows[0]) {
              const reason = serverBl.rows[0].reason || "no reason provided";
              await interaction.reply({ content: `${E.error} this server is blacklisted. reason: ${reason}. appeal at ${APPEAL_LINK}`, ephemeral: true });
              return;
            }
          }

          // If no blacklist or whitelist bypass, proceed normally
          return originalExecute.get(name).call(this, interaction, ...rest);
        } catch (err) {
          console.error(`Blacklist gate error for ${name}:`, err.message);
          return originalExecute.get(name).call(this, interaction, ...rest);
        }
      };
    }

    console.log("Slash commands wrapped with blacklist/whitelist checks.");
  },
};
