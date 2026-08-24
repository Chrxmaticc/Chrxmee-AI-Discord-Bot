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
  sneaky: "<:sneaky:1527401423690792970>",
  money_cry: "<:Money_Cry_Son:1526538340264841257>",
  currency: "<:Hits:1541423037205979197>",
};

const BATTERY_EMOJIS = {
  100: "<:battery100:1540828136131010651>",
  80: "<:battery80:1540829952964960388>",
  60: "<:battery60:1540830113334296638>",
  40: "<:battery40:1540830184645722232>",
  20: "<:battery20:1540830252065103923>",
  10: "<:battery10:1540830317986979912>",
  0: "<:BatteryDead:1540833694737109132>",
};

function getBatteryEmoji(battery) {
  const levels = Object.keys(BATTERY_EMOJIS).map(Number).sort((a, b) => b - a);
  const closest = levels.find((l) => battery >= l);
  return BATTERY_EMOJIS[closest ?? 0];
}

const FLAVORS = {
  classic: { label: "Classic", cost: 0, description: "balanced, no effect" },
  mango: { label: "Mango", cost: 100, description: "+10% Hits per puff" },
  mint: { label: "Mint", cost: 150, description: "battery drains 8% instead of 10%" },
  blueberry: { label: "Blueberry", cost: 200, description: "steal cooldown -2s" },
  watermelon: { label: "Watermelon", cost: 250, description: "20% chance for double Hits" },
  icedcoffee: { label: "Iced Coffee", cost: 300, description: "charge cooldown -5s" },
  batteryacid: { label: "Battery Acid", cost: 450, description: "high risk: melts throat after 3 acid hits" },
  dragonsbreath: { label: "Dragon's Breath", cost: 500, description: "10% instant throat melt, +15% Hits" },
  goldenmango: { label: "Golden Mango", cost: 800, description: "+25% Hits, battery drains 10%" },
};

const SHOP_ITEMS = {
  heal_hands: { label: "Heal Hands", cost: 250, description: "fix exploded hands" },
  heal_throat: { label: "Heal Throat", cost: 100, description: "fix melted throat" },
  copper_charger: { label: "Copper Charger", cost: 500, description: "40 charges before explosion" },
  gold_charger: { label: "Gold Charger", cost: 1500, description: "100 charges before explosion" },
  diamond_charger: { label: "Diamond Charger", cost: 5000, description: "250 charges before explosion" },
  solar_charger: { label: "Solar Charger", cost: 10000, description: "infinite charges, +30s charge cooldown" },
};

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
      respawn_seconds INTEGER DEFAULT 1500,
      break_hits INTEGER DEFAULT 10,
      hit_cd_seconds INTEGER DEFAULT 3,
      steal_cd_seconds INTEGER DEFAULT 12,
      charge_cd_regular INTEGER DEFAULT 15,
      charge_cd_special INTEGER DEFAULT 40,
      charge_boost_over50 INTEGER DEFAULT 30,
      charge_boost_under50 INTEGER DEFAULT 40,
      instant_break_chance REAL DEFAULT 0.5,
      hostage_seconds INTEGER DEFAULT 5,
      hostage_max_hits INTEGER DEFAULT 3,
      allowed_channel_id TEXT DEFAULT NULL,
      gremlin_enabled BOOLEAN DEFAULT TRUE,
      gremlin_frequency INTEGER DEFAULT 10,
      medical_hand_cost INTEGER DEFAULT 250,
      medical_throat_cost INTEGER DEFAULT 100
    )
  `);

  await pool.query(`ALTER TABLE juul_config ADD COLUMN IF NOT EXISTS allowed_channel_id TEXT DEFAULT NULL`);
  await pool.query(`ALTER TABLE juul_config ADD COLUMN IF NOT EXISTS gremlin_enabled BOOLEAN DEFAULT TRUE`);
  await pool.query(`ALTER TABLE juul_config ADD COLUMN IF NOT EXISTS gremlin_frequency INTEGER DEFAULT 10`);
  await pool.query(`ALTER TABLE juul_config ADD COLUMN IF NOT EXISTS medical_hand_cost INTEGER DEFAULT 250`);
  await pool.query(`ALTER TABLE juul_config ADD COLUMN IF NOT EXISTS medical_throat_cost INTEGER DEFAULT 100`);
  await pool.query(`ALTER TABLE juul_config ADD COLUMN IF NOT EXISTS hostage_seconds INTEGER DEFAULT 5`);
  await pool.query(`ALTER TABLE juul_config ADD COLUMN IF NOT EXISTS hostage_max_hits INTEGER DEFAULT 3`);

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
      hostage_until BIGINT DEFAULT 0,
      hostage_hits_used INTEGER DEFAULT 0,
      last_action_at BIGINT DEFAULT 0
    )
  `);

  await pool.query(`ALTER TABLE juul_state ADD COLUMN IF NOT EXISTS hostage_until BIGINT DEFAULT 0`);
  await pool.query(`ALTER TABLE juul_state ADD COLUMN IF NOT EXISTS hostage_hits_used INTEGER DEFAULT 0`);

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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS juul_users (
      guild_id TEXT,
      user_id TEXT,
      hits_balance INTEGER DEFAULT 0,
      charges_used INTEGER DEFAULT 0,
      charger_tier INTEGER DEFAULT 0,
      owned_flavors TEXT[] DEFAULT '{}',
      hands_broken BOOLEAN DEFAULT FALSE,
      throat_melted BOOLEAN DEFAULT FALSE,
      acid_hits INTEGER DEFAULT 0,
      PRIMARY KEY (guild_id, user_id)
    )
  `);

  await pool.query(`ALTER TABLE juul_users ADD COLUMN IF NOT EXISTS hits_balance INTEGER DEFAULT 0`);
  await pool.query(`ALTER TABLE juul_users ADD COLUMN IF NOT EXISTS charges_used INTEGER DEFAULT 0`);
  await pool.query(`ALTER TABLE juul_users ADD COLUMN IF NOT EXISTS charger_tier INTEGER DEFAULT 0`);
  await pool.query(`ALTER TABLE juul_users ADD COLUMN IF NOT EXISTS owned_flavors TEXT[] DEFAULT '{}'`);
  await pool.query(`ALTER TABLE juul_users ADD COLUMN IF NOT EXISTS hands_broken BOOLEAN DEFAULT FALSE`);
  await pool.query(`ALTER TABLE juul_users ADD COLUMN IF NOT EXISTS throat_melted BOOLEAN DEFAULT FALSE`);
  await pool.query(`ALTER TABLE juul_users ADD COLUMN IF NOT EXISTS acid_hits INTEGER DEFAULT 0`);
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

async function getJuulUser(pool, guildId, userId) {
  const res = await pool.query(`SELECT * FROM juul_users WHERE guild_id = $1 AND user_id = $2`, [guildId, userId]);
  if (!res.rows[0]) {
    await pool.query(`INSERT INTO juul_users (guild_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [guildId, userId]);
    const fresh = await pool.query(`SELECT * FROM juul_users WHERE guild_id = $1 AND user_id = $2`, [guildId, userId]);
    return fresh.rows[0];
  }
  return res.rows[0];
}

async function saveJuulUser(pool, guildId, userId, updates) {
  const keys = Object.keys(updates);
  if (!keys.length) return;
  const set = keys.map((k, i) => `${k} = $${i + 3}`).join(", ");
  const values = [guildId, userId, ...keys.map((k) => updates[k])];
  await pool.query(`UPDATE juul_users SET ${set} WHERE guild_id = $1 AND user_id = $2`, values);
}

function getChargerLimit(tier) {
  const limits = { 0: 20, 1: 40, 2: 100, 3: 250, 4: Infinity };
  return limits[tier] ?? 20;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("juul")
    .setDescription("chaos juul minigame and other bs")
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
            .addChoices(
              { name: "classic", value: "classic" },
              { name: "mango", value: "mango" },
              { name: "mint", value: "mint" },
              { name: "blueberry", value: "blueberry" },
              { name: "watermelon", value: "watermelon" },
              { name: "iced coffee", value: "icedcoffee" },
              { name: "battery acid", value: "batteryacid" },
              { name: "dragon's breath", value: "dragonsbreath" },
              { name: "golden mango", value: "goldenmango" }
            )
        )
    )
    .addSubcommand((sub) => sub.setName("hostage").setDescription("put the juul in hostage mode (blocks steals)"))
    .addSubcommand((sub) => sub.setName("shop").setDescription("view the juul shop"))
    .addSubcommand((sub) =>
      sub
        .setName("buy")
        .setDescription("buy an item from the juul shop")
        .addStringOption((opt) => opt.setName("item").setDescription("item name").setRequired(true))
    )
    .addSubcommand((sub) => sub.setName("balance").setDescription("check your Hits balance"))
    .addSubcommand((sub) => sub.setName("heal").setDescription("pay medical bills"))
    .addSubcommand((sub) =>
      sub
        .setName("force")
        .setDescription("(admin) force juul to a member")
        .addUserOption((opt) => opt.setName("user").setDescription("target user").setRequired(true))
    )
    .addSubcommand((sub) => sub.setName("respawn").setDescription("(admin) manually respawn the juul"))
    .addSubcommand((sub) =>
      sub
        .setName("restrict")
        .setDescription("(admin) restrict juul to one channel")
        .addChannelOption((opt) => opt.setName("channel").setDescription("channel").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("gremlin")
        .setDescription("(admin) toggle the juul gremlin")
        .addBooleanOption((opt) => opt.setName("enabled").setDescription("on or off").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("config")
        .setDescription("(admin) configure juul settings")
        .addIntegerOption((opt) => opt.setName("respawn_seconds").setDescription("respawn seconds").setRequired(false))
        .addIntegerOption((opt) => opt.setName("break_hits").setDescription("hits before betrayal break").setRequired(false))
        .addIntegerOption((opt) => opt.setName("hit_cd").setDescription("hit cooldown seconds").setRequired(false))
        .addIntegerOption((opt) => opt.setName("steal_cd").setDescription("steal cooldown seconds").setRequired(false))
        .addIntegerOption((opt) => opt.setName("charge_cd").setDescription("charge cooldown seconds").setRequired(false))
        .addIntegerOption((opt) => opt.setName("hostage_seconds").setDescription("hostage duration seconds").setRequired(false))
        .addIntegerOption((opt) => opt.setName("hostage_max_hits").setDescription("hostage hits before ending").setRequired(false))
        .addIntegerOption((opt) => opt.setName("gremlin_frequency").setDescription("gremlin frequency (hits)").setRequired(false))
        .addIntegerOption((opt) => opt.setName("medical_hand_cost").setDescription("hand medical bill").setRequired(false))
        .addIntegerOption((opt) => opt.setName("medical_throat_cost").setDescription("throat medical bill").setRequired(false))
    ),

  async execute(interaction) {
    const client = interaction.client;
    const pool = client.pool;
    const guild = interaction.guild;
    if (!guild) return;

    if (!client.juulCooldowns) client.juulCooldowns = new Map();

    const isButtonSim = interaction.isButton && interaction.isButton();
    if (!isButtonSim) {
      try { await interaction.deferReply(); } catch {}
    }

    const sub = interaction.options.getSubcommand();
    const guildId = guild.id;
    const userId = interaction.user.id;

    await ensureSchema(pool);
    const config = await getJuulConfig(pool, guildId);
    const state = await getJuulState(pool, guildId);
    const user = await getJuulUser(pool, guildId, userId);

    const now = Date.now();

    // channel restriction
    const restrictedSubs = ["hit", "charge", "steal", "pass", "flavor", "hostage", "shop", "buy", "balance", "heal"];
    if (config.allowed_channel_id && restrictedSubs.includes(sub)) {
      if (interaction.channelId !== config.allowed_channel_id) {
        return interaction.editReply(`${E.error} take that shit to <#${config.allowed_channel_id}>, not here lil bro.`);
      }
    }

    // auto respawn
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
          hostage_until: 0,
          hostage_hits_used: 0,
          last_action_at: now,
        });
        state.broken = false; state.battery = 100; state.holder_id = target.id;
        state.consecutive_hits = 0; state.dead_but_not_broken = false;
        state.last_break_by = null; state.respawn_at = 0;
        state.hostage_until = 0; state.hostage_hits_used = 0;
        try { await interaction.channel.send(`${E.success} juul respawned and landed on **${target.user.username}** ${JUUL_EMOJI}`); } catch {}
      }
    }

    // auto-pass if holder offline
    if (!state.broken && state.holder_id) {
      const holder = await guild.members.fetch(state.holder_id).catch(() => null);
      if (!holder || holder.presence?.status === "offline") {
        const online = guild.members.cache.filter((m) => !m.user.bot && m.presence?.status !== "offline");
        const newHolder = online.random() || guild.members.cache.random();
        if (newHolder && newHolder.id !== state.holder_id) {
          await saveJuulState(pool, guildId, {
            holder_id: newHolder.id,
            consecutive_hits: 0,
            hostage_until: 0,
            hostage_hits_used: 0,
            last_action_at: now,
          });
          state.holder_id = newHolder.id; state.consecutive_hits = 0;
          state.hostage_until = 0; state.hostage_hits_used = 0;
          try { await interaction.channel.send(`${E.success} juul auto-passed to **${newHolder.user.username}** because the previous holder went offline ${JUUL_EMOJI}`); } catch {}
        }
      }
    }

    // initial spawn if no holder
    if (!state.broken && !state.holder_id) {
      const online = guild.members.cache.filter((m) => !m.user.bot && m.presence?.status !== "offline");
      const target = online.random() || guild.members.cache.random();
      if (target) {
        await saveJuulState(pool, guildId, {
          holder_id: target.id, battery: 100, consecutive_hits: 0,
          hostage_until: 0, hostage_hits_used: 0, last_action_at: now,
        });
        state.holder_id = target.id; state.battery = 100; state.consecutive_hits = 0;
        state.hostage_until = 0; state.hostage_hits_used = 0;
        try { await interaction.channel.send(`${E.success} juul spawned and landed on **${target.user.username}** ${JUUL_EMOJI}`); } catch {}
      }
    }

    // setup
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

    // verify
    if (sub === "verify") {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        return interaction.editReply(`${E.error} you need manage messages to verify.`);
      }
      await saveJuulConfig(pool, guildId, { verified: true, verified_by: userId, verified_at: new Date() });
      if (!state.holder_id && !state.broken) {
        const online = guild.members.cache.filter((m) => !m.user.bot && m.presence?.status !== "offline");
        const target = online.random() || guild.members.cache.random();
        if (target) await saveJuulState(pool, guildId, { holder_id: target.id, battery: 100, consecutive_hits: 0, last_action_at: Date.now() });
      }
      return interaction.editReply(`${E.success} juul minigame verified and enabled.`);
    }

    // admin config
    if (sub === "config") {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) return interaction.editReply(`${E.error} you need manage messages.`);
      const updates = {};
      const map = {
        respawn_seconds: "respawn_seconds",
        break_hits: "break_hits",
        hit_cd: "hit_cd_seconds",
        steal_cd: "steal_cd_seconds",
        charge_cd: "charge_cd_regular",
        hostage_seconds: "hostage_seconds",
        hostage_max_hits: "hostage_max_hits",
        gremlin_frequency: "gremlin_frequency",
        medical_hand_cost: "medical_hand_cost",
        medical_throat_cost: "medical_throat_cost",
      };
      for (const [optName, dbField] of Object.entries(map)) {
        const val = interaction.options.getInteger(optName);
        if (val !== null && val !== undefined) updates[dbField] = val;
      }
      await saveJuulConfig(pool, guildId, updates);
      const updated = await getJuulConfig(pool, guildId);
      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(0x7c7ce0)
          .setTitle(`${E.settings} juul config updated`)
          .setDescription(`respawn: **${updated.respawn_seconds}s**\nbreak hits: **${updated.break_hits}**\nhit cd: **${updated.hit_cd_seconds}s**\nsteal cd: **${updated.steal_cd_seconds}s**\ncharge cd: **${updated.charge_cd_regular}s**\nhostage: **${updated.hostage_seconds}s / ${updated.hostage_max_hits} hits**\ngremlin freq: **${updated.gremlin_frequency} hits**\nmedical: **${updated.medical_hand_cost}** hand / **${updated.medical_throat_cost}** throat`)
        ]
      });
    }

    // restrict
    if (sub === "restrict") {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) return interaction.editReply(`${E.error} you need manage messages.`);
      const channel = interaction.options.getChannel("channel");
      await saveJuulConfig(pool, guildId, { allowed_channel_id: channel.id });
      return interaction.editReply(`${E.success} juul restricted to <#${channel.id}>.`);
    }

    // gremlin toggle
    if (sub === "gremlin") {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) return interaction.editReply(`${E.error} you need manage messages.`);
      const enabled = interaction.options.getBoolean("enabled");
      await saveJuulConfig(pool, guildId, { gremlin_enabled: enabled });
      return interaction.editReply(`${E.success} gremlin ${enabled ? "enabled" : "disabled"}.`);
    }

    // force
    if (sub === "force") {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) return interaction.editReply(`${E.error} you need manage messages.`);
      const target = interaction.options.getUser("user");
      if (!target) return interaction.editReply(`${E.error} provide a user.`);
      await saveJuulState(pool, guildId, { holder_id: target.id, consecutive_hits: 0, hostage_until: 0, hostage_hits_used: 0, last_action_at: now });
      return interaction.editReply(`${E.success} forced juul to **${target.username}** ${JUUL_EMOJI}`);
    }

    // respawn
    if (sub === "respawn") {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) return interaction.editReply(`${E.error} you need manage messages.`);
      const online = guild.members.cache.filter((m) => !m.user.bot && m.presence?.status !== "offline");
      const target = online.random() || guild.members.cache.random();
      if (!target) return interaction.editReply(`${E.error} no members to respawn to.`);
      await saveJuulState(pool, guildId, {
        broken: false, dead_but_not_broken: false, battery: 100,
        holder_id: target.id, consecutive_hits: 0, last_break_by: null,
        respawn_at: 0, hostage_until: 0, hostage_hits_used: 0, last_action_at: now,
      });
      return interaction.editReply(`${E.success} manually respawned the ${JUUL_EMOJI} juul and gave it to **${target.user.username}**.`);
    }

    // require verified
    if (!config.verified && sub !== "setup" && sub !== "verify") {
      return interaction.editReply(`${E.error} juul minigame is not verified. use /juul setup first.`);
    }

    // hostage
    if (sub === "hostage") {
      if (state.broken || state.dead_but_not_broken) return interaction.editReply(`${E.error} juul is broken or dead.`);
      if (state.holder_id !== userId) return interaction.editReply(`${E.error} you don't have the juul.`);
      if (state.hostage_until > now) {
        const remaining = Math.ceil((state.hostage_until - now) / 1000);
        return interaction.editReply(`${E.error} juul is already in hostage mode. ${remaining}s left.`);
      }
      const hostageSeconds = config.hostage_seconds || 5;
      await saveJuulState(pool, guildId, { hostage_until: now + hostageSeconds * 1000, hostage_hits_used: 0, last_action_at: now });
      return interaction.editReply(`${E.success} juul is now hostage for **${hostageSeconds} seconds**. ppl can't steal it, but hit too much and it ends early.`);
    }

    // hit
    if (sub === "hit") {
      if (state.broken) return interaction.editReply(`${EXPLOSION_EMOJI} kaboom bih! juul already broken. wait ${msToTime(state.respawn_at - now)}.`);
      if (state.dead_but_not_broken) {
        await saveJuulState(pool, guildId, { broken: true, dead_but_not_broken: false, respawn_at: now + config.respawn_seconds * 1000, last_break_by: userId, consecutive_hits: 0, hostage_until: 0, hostage_hits_used: 0, last_action_at: now });
        await addLeaderboard(pool, guildId, userId, "breaks_caused", 1);
        return interaction.editReply(`${EXPLOSION_EMOJI} kaboom bih! just kidding but it exploded, ggs. wait ${msToTime(config.respawn_seconds * 1000)}.`);
      }
      if (state.holder_id !== userId) return interaction.editReply(`${E.error} you don't have the juul.`);
      if (user.hands_broken || user.throat_melted) return interaction.editReply(`${E.error} you can't hit — ${user.hands_broken ? "your hands are exploded" : "your throat is melted"}. use /juul heal.`);

      const hitCdKey = `hit-${guildId}-${userId}`;
      const lastHit = client.juulCooldowns.get(hitCdKey) || 0;
      if (now - lastHit < config.hit_cd_seconds * 1000) {
        const waitSec = Math.ceil((config.hit_cd_seconds * 1000 - (now - lastHit)) / 1000);
        return interaction.editReply(`${E.error} hit cooldown. wait ${waitSec}s.`);
      }

      let drain = state.current_flavor === "mint" ? 8 : 10;
      let newBattery = state.battery - drain;
      if (newBattery < 0) newBattery = 0;
      let brokenNow = false, deadButNotBroken = false;

      if (newBattery === 0) {
        if (Math.random() < config.instant_break_chance) brokenNow = true;
        else deadButNotBroken = true;
      }

      const consecutive = state.consecutive_hits + 1;
      const betrayalBreak = !brokenNow && !deadButNotBroken && consecutive >= config.break_hits;
      if (betrayalBreak) brokenNow = true;

      // currency + flavor effects
      let hitsEarned = 10;
      if (state.current_flavor === "mango") hitsEarned = Math.floor(hitsEarned * 1.1);
      if (state.current_flavor === "watermelon" && Math.random() < 0.2) hitsEarned *= 2;
      if (state.current_flavor === "goldenmango") hitsEarned = Math.floor(hitsEarned * 1.25);
      if (state.current_flavor === "dragonsbreath") hitsEarned = Math.floor(hitsEarned * 1.15);

      let throatMelted = user.throat_melted;
      let handsBroken = user.hands_broken;
      let acidHits = user.acid_hits;
      let medicalEvent = "";

      if (state.current_flavor === "dragonsbreath" && Math.random() < 0.1) {
        throatMelted = true;
        medicalEvent = "throat";
      }
      if (state.current_flavor === "batteryacid") {
        acidHits += 1;
        if (acidHits >= 3 || Math.random() < 0.15) {
          throatMelted = true;
          medicalEvent = "throat";
        }
      }

      const newTotalHits = state.total_hits + 1;
      const newTotalBreaks = state.total_breaks + (brokenNow ? 1 : 0);
      let newHostageUntil = state.hostage_until;
      let newHostageHitsUsed = state.hostage_hits_used;
      if (state.hostage_until > now) {
        newHostageHitsUsed += 1;
        if (newHostageHitsUsed >= config.hostage_max_hits) {
          newHostageUntil = 0; newHostageHitsUsed = 0;
        }
      }
      if (brokenNow || deadButNotBroken) { newHostageUntil = 0; newHostageHitsUsed = 0; }

      await saveJuulState(pool, guildId, {
        battery: newBattery,
        consecutive_hits: brokenNow || deadButNotBroken ? 0 : consecutive,
        dead_but_not_broken: deadButNotBroken,
        broken: brokenNow,
        respawn_at: brokenNow ? now + config.respawn_seconds * 1000 : state.respawn_at,
        last_break_by: brokenNow ? userId : state.last_break_by,
        hostage_until: newHostageUntil,
        hostage_hits_used: newHostageHitsUsed,
        total_hits: newTotalHits,
        total_breaks: newTotalBreaks,
        last_action_at: now,
      });
      await addLeaderboard(pool, guildId, userId, "puffs", 1);
      await saveJuulUser(pool, guildId, userId, {
        hits_balance: user.hits_balance + hitsEarned,
        throat_melted: throatMelted,
        hands_broken: handsBroken,
        acid_hits: acidHits,
      });

      client.juulCooldowns.set(hitCdKey, now);

      let reply = `${E.success} ight u took a hit of the ${JUUL_EMOJI} **juul**. battery: ${getBatteryEmoji(newBattery)} (${newBattery}%). +${hitsEarned} Hits.`;
      if (medicalEvent === "throat") reply += `\n${E.angry} YOUR THROAT MELTED! medical bill: **${config.medical_throat_cost} Hits**. use /juul heal.`;
      if (brokenNow) {
        if (betrayalBreak) {
          client.juulCooldowns.set(`steal-${guildId}-${userId}`, now + 60000);
          reply = `${EXPLOSION_EMOJI} **betrayal break!** you took ${consecutive} hits and the juul broke. you can't steal for 1 minute. wait ${msToTime(config.respawn_seconds * 1000)}.`;
        } else {
          reply = `${EXPLOSION_EMOJI} kaboom bih! juul broke from battery drain. wait ${msToTime(config.respawn_seconds * 1000)}.`;
        }
      } else if (deadButNotBroken) {
        reply = `${E.success} battery is dead, but it doesn't look broken... one more hit might kaboom. ${BATTERY_EMOJIS[0]}`;
      }

      // gremlin event
      if (!brokenNow && !deadButNotBroken && config.gremlin_enabled && newTotalHits % config.gremlin_frequency === 0) {
        const online = guild.members.cache.filter((m) => !m.user.bot && m.presence?.status !== "offline" && m.id !== userId);
        const gremlinTarget = online.random() || guild.members.cache.filter((m) => !m.user.bot && m.id !== userId).random();
        if (gremlinTarget) {
          await saveJuulState(pool, guildId, { holder_id: gremlinTarget.id, consecutive_hits: 0, hostage_until: 0, hostage_hits_used: 0, last_action_at: now });
          state.holder_id = gremlinTarget.id; state.consecutive_hits = 0; state.hostage_until = 0; state.hostage_hits_used = 0;
          try { await interaction.channel.send(`${E.sneaky} a juul gremlin snatched the ${JUUL_EMOJI} and gave it to **${gremlinTarget.user.username}**!`); } catch {}
        }
      }

      return interaction.editReply(reply);
    }

    // charge
    if (sub === "charge") {
      if (state.broken || state.dead_but_not_broken) return interaction.editReply(`${E.error} juul is broken or dead.`);
      if (state.holder_id !== userId) return interaction.editReply(`${E.error} you don't have the juul.`);
      if (state.battery >= 100) return interaction.editReply(`${E.error} battery already full.`);
      if (user.hands_broken) return interaction.editReply(`${E.error} you can't charge — your hands are exploded. use /juul heal.`);

      const chargeCdKey = `charge-${guildId}-${userId}`;
      const lastCharge = client.juulCooldowns.get(chargeCdKey) || 0;
      let cdSeconds = config.charge_cd_regular || 15;
      if (state.current_flavor === "icedcoffee") cdSeconds -= 5;
      if (user.charger_tier === 4) cdSeconds += 30;
      if (state.battery === 0) cdSeconds = config.charge_cd_special || 40;
      if (now < lastCharge + cdSeconds * 1000) {
        const wait = Math.ceil((lastCharge + cdSeconds * 1000 - now) / 1000);
        return interaction.editReply(`${E.error} charge cooldown. wait ${wait}s.`);
      }

      let newBattery;
      if (state.battery === 0) newBattery = 100;
      else newBattery = Math.min(state.battery + (state.battery > 50 ? config.charge_boost_over50 : config.charge_boost_under50), 100);

      // charger explosion
      const newCharges = user.charges_used + 1;
      const limit = getChargerLimit(user.charger_tier);
      let chargerExploded = false;
      if (newCharges >= limit) {
        chargerExploded = true;
        await saveJuulUser(pool, guildId, userId, { charges_used: 0, hands_broken: true });
      } else {
        await saveJuulUser(pool, guildId, userId, { charges_used: newCharges });
      }

      await saveJuulState(pool, guildId, { battery: newBattery, last_action_at: now });
      await addLeaderboard(pool, guildId, userId, "charges", 1);
      client.juulCooldowns.set(chargeCdKey, now);

      let reply = `${E.success} charged to **${newBattery}%** ${getBatteryEmoji(newBattery)} (cd ${cdSeconds}s)`;
      if (chargerExploded) reply += `\n${EXPLOSION_EMOJI} YOUR CHARGER EXPLODED! your hands are gone. medical bill: **${config.medical_hand_cost} Hits**. use /juul heal.`;
      return interaction.editReply(reply);
    }

    // steal
    if (sub === "steal") {
      if (state.broken) return interaction.editReply(`${E.error} juul is broken.`);
      if (state.hostage_until > now) {
        const remaining = Math.ceil((state.hostage_until - now) / 1000);
        return interaction.editReply(`${E.error} juul is in hostage mode. no stealing for ${remaining}s.`);
      }
      const stealCdKey = `steal-${guildId}-${userId}`;
      let stealCd = config.steal_cd_seconds || 12;
      if (state.current_flavor === "blueberry") stealCd -= 2;
      const lastSteal = client.juulCooldowns.get(stealCdKey) || 0;
      if (now < lastSteal + stealCd * 1000) {
        const wait = Math.ceil((lastSteal + stealCd * 1000 - now) / 1000);
        return interaction.editReply(`${E.error} steal cooldown. wait ${wait}s.`);
      }
      if (!state.holder_id) return interaction.editReply(`${E.error} nobody has the juul.`);
      if (state.holder_id === userId) return interaction.editReply(`${E.error} you already have the juul.`);

      await saveJuulState(pool, guildId, { holder_id: userId, consecutive_hits: 0, hostage_until: 0, hostage_hits_used: 0, total_steals: state.total_steals + 1, last_action_at: now });
      await addLeaderboard(pool, guildId, userId, "steals", 1);
      await saveJuulUser(pool, guildId, userId, { hits_balance: user.hits_balance + 25 });
      client.juulCooldowns.set(stealCdKey, now);

      const holder = await guild.members.fetch(state.holder_id).catch(() => null);
      const holderName = holder ? holder.user.username : "unknown";
      return interaction.editReply(`${E.success} ${interaction.user.username} stole the ${JUUL_EMOJI} juul from **${holderName}**! +25 Hits.`);
    }

    // pass
    if (sub === "pass") {
      if (state.holder_id !== userId) return interaction.editReply(`${E.error} you don't have the juul.`);
      const target = interaction.options.getUser("user");
      if (!target) return interaction.editReply(`${E.error} provide a user.`);
      await saveJuulState(pool, guildId, { holder_id: target.id, consecutive_hits: 0, hostage_until: 0, hostage_hits_used: 0, total_passes: state.total_passes + 1, last_action_at: now });
      await addLeaderboard(pool, guildId, userId, "passes", 1);
      await saveJuulUser(pool, guildId, userId, { hits_balance: user.hits_balance + 15 });
      return interaction.editReply(`${E.success} passed the ${JUUL_EMOJI} juul to **${target.username}**. +15 Hits.`);
    }

    // flavor
    if (sub === "flavor") {
      if (state.holder_id !== userId) return interaction.editReply(`${E.error} you don't have the juul.`);
      const flavor = interaction.options.getString("name");
      if (!FLAVORS[flavor]) return interaction.editReply(`${E.error} invalid flavor.`);
      if (!user.owned_flavors.includes(flavor) && flavor !== "classic") {
        return interaction.editReply(`${E.error} you don't own that flavor. buy it from /juul shop.`);
      }
      await saveJuulState(pool, guildId, { current_flavor: flavor, last_action_at: now });
      return interaction.editReply(`${E.success} flavor changed to **${FLAVORS[flavor].label}** ${JUUL_EMOJI}`);
    }

    // shop
    if (sub === "shop") {
      const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle(`${E.settings} juul shop`)
        .setDescription(`currency: **Hits**${E.currency}\nyour balance: **${user.hits_balance}** Hits`)
        .addFields(
          { name: "heals", value: `heal_hands — ${SHOP_ITEMS.heal_hands.cost} Hits\nheal_throat — ${SHOP_ITEMS.heal_throat.cost} Hits`, inline: true },
          { name: "chargers", value: `copper_charger — ${SHOP_ITEMS.copper_charger.cost}\ngold_charger — ${SHOP_ITEMS.gold_charger.cost}\ndiamond_charger — ${SHOP_ITEMS.diamond_charger.cost}\nsolar_charger — ${SHOP_ITEMS.solar_charger.cost}`, inline: true },
          { name: "flavors", value: Object.entries(FLAVORS).map(([k, v]) => `${k} — ${v.cost} Hits`).join("\n"), inline: true }
        )
        .setFooter({ text: "use /juul buy <item>" });
      return interaction.editReply({ embeds: [embed] });
    }

    // buy
    if (sub === "buy") {
      const item = interaction.options.getString("item")?.toLowerCase();
      if (!item) return interaction.editReply(`${E.error} provide an item.`);
      if (SHOP_ITEMS[item]) {
        const shopItem = SHOP_ITEMS[item];
        if (user.hits_balance < shopItem.cost) return interaction.editReply(`${E.error} you need ${shopItem.cost} Hits, you have ${user.hits_balance}.`);
        if (item === "heal_hands") { await saveJuulUser(pool, guildId, userId, { hits_balance: user.hits_balance - shopItem.cost, hands_broken: false }); return interaction.editReply(`${E.success} hands healed.`); }
        if (item === "heal_throat") { await saveJuulUser(pool, guildId, userId, { hits_balance: user.hits_balance - shopItem.cost, throat_melted: false }); return interaction.editReply(`${E.success} throat healed.`); }
        if (item === "copper_charger") { await saveJuulUser(pool, guildId, userId, { hits_balance: user.hits_balance - shopItem.cost, charger_tier: 1, charges_used: 0 }); return interaction.editReply(`${E.success} bought copper charger.`); }
        if (item === "gold_charger") { await saveJuulUser(pool, guildId, userId, { hits_balance: user.hits_balance - shopItem.cost, charger_tier: 2, charges_used: 0 }); return interaction.editReply(`${E.success} bought gold charger.`); }
        if (item === "diamond_charger") { await saveJuulUser(pool, guildId, userId, { hits_balance: user.hits_balance - shopItem.cost, charger_tier: 3, charges_used: 0 }); return interaction.editReply(`${E.success} bought diamond charger.`); }
        if (item === "solar_charger") { await saveJuulUser(pool, guildId, userId, { hits_balance: user.hits_balance - shopItem.cost, charger_tier: 4, charges_used: 0 }); return interaction.editReply(`${E.success} bought solar charger.`); }
        return interaction.editReply(`${E.error} unknown item.`);
      }
      if (FLAVORS[item]) {
        const flavor = FLAVORS[item];
        if (flavor.cost === 0) return interaction.editReply(`${E.error} that flavor is free.`);
        if (user.hits_balance < flavor.cost) return interaction.editReply(`${E.error} you need ${flavor.cost} Hits.`);
        if (user.owned_flavors.includes(item)) return interaction.editReply(`${E.error} you already own that flavor.`);
        const newFlavors = [...user.owned_flavors, item];
        await saveJuulUser(pool, guildId, userId, { hits_balance: user.hits_balance - flavor.cost, owned_flavors: newFlavors });
        return interaction.editReply(`${E.success} bought **${flavor.label}** flavor.`);
      }
      return interaction.editReply(`${E.error} item not found.`);
    }

    // balance
    if (sub === "balance") {
      return interaction.editReply(`${E.ai} **${interaction.user.username}** — ${user.hits_balance} Hits.${E.currency} ${user.hands_broken ? "hands broken" : ""} ${user.throat_melted ? "throat melted" : ""}`);
    }

    // heal
    if (sub === "heal") {
      if (!user.hands_broken && !user.throat_melted) return interaction.editReply(`${E.error} you don't need healing.`);
      const handCost = user.hands_broken ? config.medical_hand_cost : 0;
      const throatCost = user.throat_melted ? config.medical_throat_cost : 0;
      const totalCost = handCost + throatCost;
      if (user.hits_balance < totalCost) return interaction.editReply(`${E.error} you need ${totalCost} Hits for full heal.`);
      await saveJuulUser(pool, guildId, userId, { hits_balance: user.hits_balance - totalCost, hands_broken: false, throat_melted: false });
      return interaction.editReply(`${E.success} you're healed. -${totalCost} Hits.`);
    }

    // stats
    if (sub === "stats") {
      const holder = state.holder_id ? await guild.members.fetch(state.holder_id).catch(() => null) : null;
      const embed = new EmbedBuilder()
        .setColor(0x7c7ce0)
        .setTitle(`${JUUL_EMOJI} juul stats`)
        .addFields(
          { name: "holder", value: holder ? holder.user.username : "none", inline: true },
          { name: "battery", value: `${state.battery}% ${getBatteryEmoji(state.battery)}`, inline: true },
          { name: "flavor", value: FLAVORS[state.current_flavor]?.label || state.current_flavor, inline: true },
          { name: "status", value: state.broken ? "broken" : state.dead_but_not_broken ? "dead (looks sus)" : "alive", inline: true },
          { name: "total hits", value: state.total_hits.toString(), inline: true },
          { name: "total steals", value: state.total_steals.toString(), inline: true },
          { name: "total passes", value: state.total_passes.toString(), inline: true }
        );
      if (state.broken && state.respawn_at > now) embed.addFields({ name: "respawn in", value: msToTime(state.respawn_at - now), inline: true });
      return interaction.editReply({ embeds: [embed] });
    }

    // leaderboard
    if (sub === "leaderboard") {
      const res = await pool.query(
        `SELECT user_id, puffs, steals, breaks_caused FROM juul_leaderboard WHERE guild_id = $1 ORDER BY puffs DESC LIMIT 10`,
        [guildId]
      );
      if (!res.rows.length) return interaction.editReply(`${E.error} no juul stats yet.`);
      const description = await Promise.all(res.rows.map(async (r, i) => {
        const user = await client.users.fetch(r.user_id).catch(() => null);
        return `${i + 1}. ${user ? user.username : "unknown"} — ${r.puffs} puffs, ${r.steals} steals, ${r.breaks_caused} breaks`;
      }));
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0x7c7ce0).setTitle(`${E.crown} juul leaderboard`).setDescription(description.join("\n"))]
      });
    }

    return interaction.editReply(`${E.error} unknown subcommand.`);
  },
};
