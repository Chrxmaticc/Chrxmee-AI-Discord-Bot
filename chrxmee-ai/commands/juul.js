const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const JUUL_EMOJI = "<:juul:1540827931574800394>";
const EXPLOSION_EMOJI = "<:explosionreal:1540872000002723942>";

const E = {
  success: "<:Verified_Icon:1527194184841167010>",
  error: "<:no:1530373946795364362>",
  ai: "<:Chrxmaticc_AI:1480094799292928132>",
  settings: "<:Settings:1525601248278216725>",
  admin: "<:Admin_Badge:1527194281234665622>",
  angry: "<:angry_cry:1526029511882440744>",
  agree: "<:agreed:1525639597135237131>",
  hammer: "<:hammer:1530375976381448303>",
  lock: "<:lock:1530377198324945056>",
  unlock: "<:unlock:1530377714995826831>",
  crown: "<:Holographic_owner_crown:1527401510487461969>",
};

const BATTERY_EMOJIS = {
  100: "<:battery100:1540828136131010651>",
  90: "<:battery80:1540829952964960388>",
  80: "<:battery80:1540829952964960388>",
  70: "<:battery70:1540830036255580272>",
  60: "<:battery60:1540830113334296638>",
  50: "<:battery60:1540830113334296638>",
  40: "<:battery40:1540830184645722232>",
  30: "<:battery40:1540830184645722232>",
  20: "<:battery20:1540830252065103923>",
  10: "<:battery10:1540830317986979912>",
  0: "<:BatteryDead:1540833694737109132>",
};

const FLAVORS = ["classic", "mango", "mint", "blueberry", "watermelon"];

function getBatteryEmoji(battery) {
  const levels = Object.keys(BATTERY_EMOJIS).map(Number).sort((a, b) => b - a);
  const closest = levels.find((l) => battery >= l);
  return BATTERY_EMOJIS[closest ?? 0];
}

function msToTime(ms) {
  if (!ms || ms <= 0) return "0s";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

async function ensureSchema(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS juul_config (
      guild_id TEXT PRIMARY KEY,
      verified BOOLEAN DEFAULT FALSE,
      verified_by TEXT,
      verified_at TIMESTAMP,
      respawn_seconds INTEGER DEFAULT 120,
      break_hits INTEGER DEFAULT 10,
      hit_cd_seconds INTEGER DEFAULT 3,
      steal_cd_seconds INTEGER DEFAULT 12,
      charge_cd_regular INTEGER DEFAULT 15,
      charge_cd_special INTEGER DEFAULT 40,
      charge_boost_over50 INTEGER DEFAULT 30,
      charge_boost_under50 INTEGER DEFAULT 40,
      instant_break_chance REAL DEFAULT 0.5
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS juul_state (
      guild_id TEXT PRIMARY KEY,
      battery INTEGER DEFAULT 100,
      holder_id TEXT,
      current_flavor TEXT DEFAULT 'classic',
      dead_but_not_broken BOOLEAN DEFAULT FALSE,
      broken BOOLEAN DEFAULT FALSE,
      respawn_at BIGINT DEFAULT 0,
      last_break_by TEXT,
      consecutive_hits INTEGER DEFAULT 0,
      total_hits INTEGER DEFAULT 0,
      total_breaks INTEGER DEFAULT 0,
      total_steals INTEGER DEFAULT 0,
      total_passes INTEGER DEFAULT 0,
      last_action_at BIGINT DEFAULT 0
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS juul_leaderboard (
      guild_id TEXT,
      user_id TEXT,
      puffs INTEGER DEFAULT 0,
      steals INTEGER DEFAULT 0,
      breaks_caused INTEGER DEFAULT 0,
      charges INTEGER DEFAULT 0,
      passes INTEGER DEFAULT 0,
      PRIMARY KEY (guild_id, user_id)
    )
  `);
}

async function getJuulConfig(pool, guildId) {
  const res = await pool.query(`SELECT * FROM juul_config WHERE guild_id = $1`, [guildId]);
  if (!res.rows[0]) {
    await pool.query(`INSERT INTO juul_config (guild_id) VALUES ($1) ON CONFLICT DO NOTHING`, [guildId]);
    const fresh = await pool.query(`SELECT * FROM juul_config WHERE guild_id = $1`, [guildId]);
    return fresh.rows[0];
  }
  return res.rows[0];
}

async function saveJuulConfig(pool, guildId, updates) {
  const keys = Object.keys(updates);
  if (!keys.length) return;
  const set = keys.map((k, i) => `${k} = $${i + 2}`).join(", ");
  const values = [guildId, ...keys.map((k) => updates[k])];
  await pool.query(`UPDATE juul_config SET ${set} WHERE guild_id = $1`, values);
}

async function getJuulState(pool, guildId) {
  const res = await pool.query(`SELECT * FROM juul_state WHERE guild_id = $1`, [guildId]);
  if (!res.rows[0]) {
    await pool.query(`INSERT INTO juul_state (guild_id) VALUES ($1) ON CONFLICT DO NOTHING`, [guildId]);
    const fresh = await pool.query(`SELECT * FROM juul_state WHERE guild_id = $1`, [guildId]);
    return fresh.rows[0];
  }
  return res.rows[0];
}

async function saveJuulState(pool, guildId, updates) {
  const keys = Object.keys(updates);
  if (!keys.length) return;
  const set = keys.map((k, i) => `${k} = $${i + 2}`).join(", ");
  const values = [guildId, ...keys.map((k) => updates[k])];
  await pool.query(`UPDATE juul_state SET ${set} WHERE guild_id = $1`, values);
}

async function addLeaderboard(pool, guildId, userId, field, amount = 1) {
  await pool.query(`
    INSERT INTO juul_leaderboard (guild_id, user_id, ${field})
    VALUES ($1, $2, $3)
    ON CONFLICT (guild_id, user_id)
    DO UPDATE SET ${field} = juul_leaderboard.${field} + $3
  `, [guildId, userId, amount]);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("juul")
    .setDescription("chaos juul minigame")
    .addSubcommand((sub) => sub.setName("setup").setDescription("show verification instructions"))
    .addSubcommand((sub) => sub.setName("verify").setDescription("verify the juul minigame (manage messages)"))
    .addSubcommand((sub) => sub.setName("hit").setDescription("take a hit of the juul"))
    .addSubcommand((sub) => sub.setName("charge").setDescription("charge the juul (only if you're holding it)"))
    .addSubcommand((sub) => sub.setName("steal").setDescription("steal the juul from current holder"))
    .addSubcommand((sub) =>
      sub
        .setName("pass")
        .setDescription("pass the juul to someone")
        .addUserOption((opt) => opt.setName("user").setDescription("who to pass to").setRequired(true))
    )
    .addSubcommand((sub) => sub.setName("stats").setDescription("view current juul stats"))
    .addSubcommand((sub) => sub.setName("leaderboard").setDescription("view top juul users"))
    .addSubcommand((sub) =>
      sub
        .setName("flavor")
        .setDescription("change juul flavor")
        .addStringOption((opt) =>
          opt
            .setName("name")
            .setDescription("flavor")
            .setRequired(true)
            .addChoices(...FLAVORS.map((f) => ({ name: f, value: f })))
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("force")
        .setDescription("(admin) force juul to a member")
        .addUserOption((opt) => opt.setName("user").setDescription("target user").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("config")
        .setDescription("(admin) configure juul settings")
        .addIntegerOption((opt) => opt.setName("respawn_seconds").setDescription("respawn seconds").setRequired(false))
        .addIntegerOption((opt) => opt.setName("break_hits").setDescription("hits before betrayal break").setRequired(false))
        .addIntegerOption((opt) => opt.setName("hit_cd").setDescription("hit cooldown seconds").setRequired(false))
        .addIntegerOption((opt) => opt.setName("steal_cd").setDescription("steal cooldown seconds").setRequired(false))
    ),

  async execute(interaction) {
    const client = interaction.client;
    const pool = client.pool;
    const guild = interaction.guild;
    if (!guild) return;

    // fallback in case client.juulCooldowns wasn't initialized in main file
    if (!client.juulCooldowns) client.juulCooldowns = new Map();

    const isButtonSim = interaction.isButton && interaction.isButton();
    if (!isButtonSim) {
      try {
        await interaction.deferReply();
      } catch {}
    }

    const sub = interaction.options.getSubcommand();
    const guildId = guild.id;
    const userId = interaction.user.id;

    await ensureSchema(pool);
    const config = await getJuulConfig(pool, guildId);
    const state = await getJuulState(pool, guildId);

    // ─── AUTO RESPAWN / PASS IF HOLDER OFFLINE ───
    const now = Date.now();

    if (state.broken && state.respawn_at > 0 && now >= state.respawn_at) {
      const online = guild.members.cache.filter((m) => !m.user.bot && m.presence?.status !== "offline");
      const target = online.random() || guild.members.cache.random();
      if (target) {
        await saveJuulState(pool, guildId, {
          broken: false,
          dead_but_not_broken: false,
          battery: 100,
          holder_id: target.id,
          consecutive_hits: 0,
          last_break_by: null,
          respawn_at: 0,
          last_action_at: now,
        });
        state.broken = false;
        state.battery = 100;
        state.holder_id = target.id;
        state.consecutive_hits = 0;
        state.dead_but_not_broken = false;
        state.last_break_by = null;
        state.respawn_at = 0;
        try {
          await interaction.channel.send(`${E.success} juul respawned and landed on **${target.user.username}** ${JUUL_EMOJI}`);
        } catch {}
      }
    }

    if (!state.broken && state.holder_id) {
      const holder = await guild.members.fetch(state.holder_id).catch(() => null);
      if (!holder || holder.presence?.status === "offline") {
        const online = guild.members.cache.filter((m) => !m.user.bot && m.presence?.status !== "offline");
        const newHolder = online.random() || guild.members.cache.random();
        if (newHolder && newHolder.id !== state.holder_id) {
          await saveJuulState(pool, guildId, {
            holder_id: newHolder.id,
            consecutive_hits: 0,
            last_action_at: now,
          });
          state.holder_id = newHolder.id;
          state.consecutive_hits = 0;
          try {
            await interaction.channel.send(`${E.success} juul auto-passed to **${newHolder.user.username}** because the previous holder went offline ${JUUL_EMOJI}`);
          } catch {}
        }
      }
    }

    // ─── INITIAL SPAWN: if no holder and not broken, give to random online member ───
    if (!state.broken && !state.holder_id) {
      const online = guild.members.cache.filter((m) => !m.user.bot && m.presence?.status !== "offline");
      const target = online.random() || guild.members.cache.random();
      if (target) {
        await saveJuulState(pool, guildId, {
          holder_id: target.id,
          battery: 100,
          consecutive_hits: 0,
          last_action_at: now,
        });
        state.holder_id = target.id;
        state.battery = 100;
        state.consecutive_hits = 0;
        try {
          await interaction.channel.send(`${E.success} juul spawned and landed on **${target.user.username}** ${JUUL_EMOJI}`);
        } catch {}
      }
    }

    // ─── SETUP (text only) ───
    if (sub === "setup") {
      const embed = new EmbedBuilder()
        .setColor(0x7c7ce0)
        .setTitle(`${E.settings} juul minigame setup`)
        .setDescription(
          `hey, to setup this "juul" minigame, just realize this is fictional and not real life, we are not sponsoring with juul companies or other bs that uses nicotine.\n\n` +
          `type \`/juul verify\` (or \`!juul verify\` if using prefix) to verify and enable the minigame.\n` +
          `only people with **manage messages** can verify.`
        )
        .setFooter({ text: "this is a fictional minigame, not real vaping" });

      return interaction.editReply({ embeds: [embed] });
    }

    // ─── VERIFY (text confirmation) ───
    if (sub === "verify") {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        return interaction.editReply(`${E.error} you need manage messages to verify.`);
      }
      await saveJuulConfig(pool, guildId, { verified: true, verified_by: userId, verified_at: new Date() });

      // spawn on random member right away if no holder
      if (!state.holder_id && !state.broken) {
        const online = guild.members.cache.filter((m) => !m.user.bot && m.presence?.status !== "offline");
        const target = online.random() || guild.members.cache.random();
        if (target) {
          await saveJuulState(pool, guildId, {
            holder_id: target.id,
            battery: 100,
            consecutive_hits: 0,
            last_action_at: Date.now(),
          });
        }
      }

      return interaction.editReply(`${E.success} juul minigame verified and enabled.`);
    }

    // ─── CONFIG ───
    if (sub === "config") {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        return interaction.editReply(`${E.error} you need manage messages.`);
      }
      const updates = {};
      const respawn = interaction.options.getInteger("respawn_seconds");
      if (respawn !== null) updates.respawn_seconds = respawn;
      const breakHits = interaction.options.getInteger("break_hits");
      if (breakHits !== null) updates.break_hits = breakHits;
      const hitCd = interaction.options.getInteger("hit_cd");
      if (hitCd !== null) updates.hit_cd_seconds = hitCd;
      const stealCd = interaction.options.getInteger("steal_cd");
      if (stealCd !== null) updates.steal_cd_seconds = stealCd;

      await saveJuulConfig(pool, guildId, updates);
      const updated = await getJuulConfig(pool, guildId);
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x7c7ce0)
            .setTitle(`${E.settings} juul config updated`)
            .setDescription(`respawn: **${updated.respawn_seconds}s**\nbreak hits: **${updated.break_hits}**\nhit cd: **${updated.hit_cd_seconds}s**\nsteal cd: **${updated.steal_cd_seconds}s**`)
        ],
      });
    }

    // ─── FORCE ───
    if (sub === "force") {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        return interaction.editReply(`${E.error} you need manage messages.`);
      }
      const target = interaction.options.getUser("user");
      if (!target) return interaction.editReply(`${E.error} provide a user.`);
      await saveJuulState(pool, guildId, { holder_id: target.id, consecutive_hits: 0, last_action_at: now });
      return interaction.editReply(`${E.success} forced juul to **${target.username}** ${JUUL_EMOJI}`);
    }

    // ─── NON-SETUP / ADMIN COMMANDS REQUIRE VERIFIED ───
    if (!config.verified && sub !== "setup" && sub !== "verify") {
      return interaction.editReply(`${E.error} juul minigame is not verified. use /juul setup first.`);
    }

    // ─── HIT ───
    if (sub === "hit") {
      if (state.broken) {
        return interaction.editReply(`${EXPLOSION_EMOJI} kaboom bih! the juul is already broken. wait ${msToTime(state.respawn_at - now)} for respawn.`);
      }

      if (state.dead_but_not_broken) {
        await saveJuulState(pool, guildId, {
          broken: true,
          dead_but_not_broken: false,
          respawn_at: now + config.respawn_seconds * 1000,
          last_break_by: userId,
          consecutive_hits: 0,
          last_action_at: now,
        });
        await addLeaderboard(pool, guildId, userId, "breaks_caused", 1);
        return interaction.editReply(`${EXPLOSION_EMOJI} kaboom bih! just kidding but it exploded, ggs. wait ${msToTime(config.respawn_seconds * 1000)} for a juul to be fixed and respawn.`);
      }

      if (state.holder_id !== userId) {
        return interaction.editReply(`${E.error} you don't have the juul.`);
      }

      const hitCdKey = `hit-${guildId}-${userId}`;
      const lastHit = client.juulCooldowns.get(hitCdKey) || 0;
      if (now - lastHit < config.hit_cd_seconds * 1000) {
        const waitMs = Math.ceil((config.hit_cd_seconds * 1000 - (now - lastHit)) / 1000);
        return interaction.editReply(`${E.error} you hit the cooldown on the ${JUUL_EMOJI} **juul** hits. the cooldowns r 10 secs per hit, wait ${waitMs} seconds for your hit.`);
      }

      let newBattery = state.battery - 10;
      if (newBattery < 0) newBattery = 0;
      let brokenNow = false;
      let deadButNotBroken = false;

      if (newBattery === 0) {
        if (Math.random() < config.instant_break_chance) {
          brokenNow = true;
        } else {
          deadButNotBroken = true;
        }
      }

      const consecutive = state.consecutive_hits + 1;
      const betrayalBreak = !brokenNow && !deadButNotBroken && consecutive >= config.break_hits;

      if (betrayalBreak) {
        brokenNow = true;
      }

      // update total_hits
      const newTotalHits = state.total_hits + 1;
      const newTotalBreaks = state.total_breaks + (brokenNow ? 1 : 0);

      await saveJuulState(pool, guildId, {
        battery: newBattery,
        consecutive_hits: brokenNow || deadButNotBroken ? 0 : consecutive,
        dead_but_not_broken: deadButNotBroken,
        broken: brokenNow,
        respawn_at: brokenNow ? now + config.respawn_seconds * 1000 : state.respawn_at,
        last_break_by: brokenNow ? userId : state.last_break_by,
        last_action_at: now,
        total_hits: newTotalHits,
        total_breaks: newTotalBreaks,
      });

      await addLeaderboard(pool, guildId, userId, "puffs", 1);

      client.juulCooldowns.set(hitCdKey, now);

      if (brokenNow) {
        if (betrayalBreak) {
          client.juulCooldowns.set(`steal-${guildId}-${userId}`, now + 60000);
        }
        const breakMsg = betrayalBreak
          ? `${EXPLOSION_EMOJI} **betrayal break!** you took ${consecutive} hits in a row and the juul broke. you can't steal for 1 minute. wait ${msToTime(config.respawn_seconds * 1000)} for respawn.`
          : `${EXPLOSION_EMOJI} kaboom bih! the juul broke from battery drain. wait ${msToTime(config.respawn_seconds * 1000)} for respawn.`;
        return interaction.editReply(breakMsg);
      }

      if (deadButNotBroken) {
        return interaction.editReply(`${E.success} battery is dead, but it doesn't look broken... one more hit might kaboom. ${BATTERY_EMOJIS[0]}`);
      }

      const batteryEmoji = getBatteryEmoji(newBattery);
      return interaction.editReply(`${E.success} ight u took a hit of the ${JUUL_EMOJI} **juul**, don't forget to charge it. battery: ${batteryEmoji} (${newBattery}%)`);
    }

    // ─── CHARGE ───
    if (sub === "charge") {
      if (state.broken || state.dead_but_not_broken) {
        return interaction.editReply(`${E.error} juul is broken or dead. wait for respawn.`);
      }
      if (state.holder_id !== userId) {
        return interaction.editReply(`${E.error} you don't have the juul.`);
      }
      if (state.battery >= 100) {
        return interaction.editReply(`${E.error} battery already full.`);
      }

      const chargeCdKey = `charge-${guildId}-${userId}`;
      const lastCharge = client.juulCooldowns.get(chargeCdKey) || 0;
      const cdRemaining = lastCharge - now;
      if (cdRemaining > 0) {
        const waitSec = Math.ceil(cdRemaining / 1000);
        return interaction.editReply(`${E.error} you're on charge cooldown. wait ${waitSec} seconds.`);
      }

      let newBattery;
      let cooldownSeconds;
      if (state.battery === 0) {
        newBattery = 100;
        cooldownSeconds = config.charge_cd_special;
      } else {
        const boost = state.battery > 50 ? config.charge_boost_over50 : config.charge_boost_under50;
        newBattery = Math.min(state.battery + boost, 100);
        cooldownSeconds = config.charge_cd_regular;
      }

      await saveJuulState(pool, guildId, { battery: newBattery, last_action_at: now });
      await addLeaderboard(pool, guildId, userId, "charges", 1);

      client.juulCooldowns.set(chargeCdKey, now + cooldownSeconds * 1000);

      const batteryEmoji = getBatteryEmoji(newBattery);
      return interaction.editReply(`${E.success} charged to **${newBattery}%** ${batteryEmoji} (cd ${cooldownSeconds}s)`);
    }

    // ─── STEAL ───
    if (sub === "steal") {
      if (state.broken) {
        return interaction.editReply(`${E.error} juul is broken.`);
      }
      const stealCdKey = `steal-${guildId}-${userId}`;
      const lastSteal = client.juulCooldowns.get(stealCdKey) || 0;
      if (now < lastSteal) {
        const waitSec = Math.ceil((lastSteal - now) / 1000);
        return interaction.editReply(`${E.error} you're on steal cooldown. wait ${waitSec} seconds.`);
      }

      const holderId = state.holder_id;
      if (!holderId) {
        return interaction.editReply(`${E.error} nobody has the juul.`);
      }
      if (holderId === userId) {
        return interaction.editReply(`${E.error} you already have the juul.`);
      }

      await saveJuulState(pool, guildId, {
        holder_id: userId,
        consecutive_hits: 0,
        last_action_at: now,
        total_steals: state.total_steals + 1,
      });
      await addLeaderboard(pool, guildId, userId, "steals", 1);

      client.juulCooldowns.set(stealCdKey, now + config.steal_cd_seconds * 1000);

      const holder = await guild.members.fetch(holderId).catch(() => null);
      const holderName = holder ? holder.user.username : "unknown";
      return interaction.editReply(`${E.success} ${interaction.user.username} stole the ${JUUL_EMOJI} juul from **${holderName}**!`);
    }

    // ─── PASS ───
    if (sub === "pass") {
      if (state.holder_id !== userId) {
        return interaction.editReply(`${E.error} you don't have the juul.`);
      }
      const target = interaction.options.getUser("user");
      if (!target) return interaction.editReply(`${E.error} provide a user.`);
      await saveJuulState(pool, guildId, {
        holder_id: target.id,
        consecutive_hits: 0,
        last_action_at: now,
        total_passes: state.total_passes + 1,
      });
      await addLeaderboard(pool, guildId, userId, "passes", 1);
      return interaction.editReply(`${E.success} passed the ${JUUL_EMOJI} juul to **${target.username}**.`);
    }

    // ─── FLAVOR ───
    if (sub === "flavor") {
      if (state.holder_id !== userId) {
        return interaction.editReply(`${E.error} you don't have the juul.`);
      }
      const flavor = interaction.options.getString("name");
      await saveJuulState(pool, guildId, { current_flavor: flavor, last_action_at: now });
      return interaction.editReply(`${E.success} flavor changed to **${flavor}** ${JUUL_EMOJI}`);
    }

    // ─── STATS ───
    if (sub === "stats") {
      const holder = state.holder_id ? await guild.members.fetch(state.holder_id).catch(() => null) : null;
      const embed = new EmbedBuilder()
        .setColor(0x7c7ce0)
        .setTitle(`${JUUL_EMOJI} juul stats`)
        .addFields(
          { name: "holder", value: holder ? `${holder.user.username}` : "none", inline: true },
          { name: "battery", value: `${state.battery}% ${getBatteryEmoji(state.battery)}`, inline: true },
          { name: "flavor", value: state.current_flavor, inline: true },
          { name: "status", value: state.broken ? "broken" : state.dead_but_not_broken ? "dead (looks sus)" : "alive", inline: true },
          { name: "total hits", value: state.total_hits.toString(), inline: true },
          { name: "total steals", value: state.total_steals.toString(), inline: true },
          { name: "total passes", value: state.total_passes.toString(), inline: true }
        );
      if (state.broken && state.respawn_at > now) {
        embed.addFields({ name: "respawn in", value: msToTime(state.respawn_at - now), inline: true });
      }
      return interaction.editReply({ embeds: [embed] });
    }

    // ─── LEADERBOARD ───
    if (sub === "leaderboard") {
      const res = await pool.query(
        `SELECT user_id, puffs, steals, breaks_caused FROM juul_leaderboard WHERE guild_id = $1 ORDER BY puffs DESC LIMIT 10`,
        [guildId]
      );
      if (!res.rows.length) {
        return interaction.editReply(`${E.error} no juul stats yet.`);
      }
      const description = await Promise.all(
        res.rows.map(async (r, i) => {
          const user = await client.users.fetch(r.user_id).catch(() => null);
          return `${i + 1}. ${user ? user.username : "unknown"} — ${r.puffs} puffs, ${r.steals} steals, ${r.breaks_caused} breaks`;
        })
      );
      const embed = new EmbedBuilder()
        .setColor(0x7c7ce0)
        .setTitle(`${E.crown} juul leaderboard`)
        .setDescription(description.join("\n"));
      return interaction.editReply({ embeds: [embed] });
    }

    return interaction.editReply(`${E.error} unknown subcommand.`);
  },
};
