const { EmbedBuilder } = require("discord.js");

const E = {
  success: "<:Verified_Icon:1527194184841167010>",
  error: "<:no:1530373946795364362>",
  boostHand: "<:Boost_Hand:1545565123949760676>",
  serverBooster: "<:ServerBooster:1545566211704885320>",
};

module.exports = {
  name: "guildMemberUpdate",
  async execute(oldMember, newMember) {
    const client = newMember.client;
    const pool = client.pool;
    const guild = newMember.guild;

    try {
      const settingsRes = await pool.query(
        `SELECT * FROM boost_settings WHERE guild_id = $1`,
        [guild.id]
      );
      if (!settingsRes.rows[0] || !settingsRes.rows[0].enabled) return;

      const settings = settingsRes.rows[0];

      if (!oldMember.premiumSince && newMember.premiumSince) {
        console.log(`[BOOST] ${newMember.user.tag} boosted ${guild.name}`);

        const existingRole = await pool.query(
          `SELECT role_id FROM boost_roles WHERE guild_id = $1 AND user_id = $2`,
          [guild.id, newMember.id]
        );
        if (existingRole.rows.length > 0) {
          const role = guild.roles.cache.get(existingRole.rows[0].role_id);
          if (role && !newMember.roles.cache.has(role.id)) {
            await newMember.roles.add(role, "boost reward").catch(() => {});
          }
          return;
        }

        const roleName = (settings.role_name_template || '{user} ★').replace('{user}', newMember.user.username).slice(0, 100);
        const roleColor = settings.default_role_color || '#d2b48c';

        const boostRole = await guild.roles.create({
          name: roleName,
          color: roleColor,
          reason: `boost reward for ${newMember.user.tag}`,
          permissions: [],
          mentionable: false,
        }).catch(err => {
          console.error(`[BOOST] Failed to create role for ${newMember.user.tag}:`, err);
          return null;
        });

        if (!boostRole) return;

        await pool.query(
          `INSERT INTO boost_roles (guild_id, user_id, role_id) VALUES ($1, $2, $3)`,
          [guild.id, newMember.id, boostRole.id]
        );

        await newMember.roles.add(boostRole, "boost reward").catch(() => {});

        if (settings.rewards_enabled) {
          const rewardsRes = await pool.query(
            `SELECT * FROM boost_rewards WHERE guild_id = $1`,
            [guild.id]
          );
          for (const reward of rewardsRes.rows) {
            if (reward.reward_type === 'message') {
              const channel = guild.channels.cache.get(reward.reward_value);
              if (channel) {
                await channel.send(`${E.serverBooster} **${newMember.user.username}** just boosted the server! Enjoy your custom role, ${boostRole}!`).catch(() => {});
              }
            } else if (reward.reward_type === 'role') {
              const extraRole = guild.roles.cache.get(reward.reward_value);
              if (extraRole && !newMember.roles.cache.has(extraRole.id)) {
                await newMember.roles.add(extraRole, "boost reward").catch(() => {});
              }
            }
          }
        }

        console.log(`[BOOST] Created role ${boostRole.name} for ${newMember.user.tag}`);
      }

      if (oldMember.premiumSince && !newMember.premiumSince) {
        console.log(`[BOOST] ${newMember.user.tag} unboosted ${guild.name}`);

        const existingRole = await pool.query(
          `SELECT role_id FROM boost_roles WHERE guild_id = $1 AND user_id = $2`,
          [guild.id, newMember.id]
        );
        if (existingRole.rows.length > 0) {
          const role = guild.roles.cache.get(existingRole.rows[0].role_id);
          if (role) {
            await role.delete("user unboosted").catch(() => {});
          }
          await pool.query(
            `DELETE FROM boost_roles WHERE guild_id = $1 AND user_id = $2`,
            [guild.id, newMember.id]
          );
        }
      }
    } catch (err) {
      console.error("[BOOST] Error handling member update:", err);
    }
  },
};
