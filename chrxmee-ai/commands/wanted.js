const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require("discord.js");

const E = {
  success: "<:Verified_Icon:1527194184841167010>",
  error: "<:no:1530373946795364362>",
  ai: "<:Chrxmaticc_AI:1480094799292928132>",
  agree: "<:agreed:1525639597135237131>",
  angry: "<:angry_cry:1526029511882440744>",
  sneaky: "<:sneaky:1527401423690792970>",
  money_cry: "<:Money_Cry_Son:1526538340264841257>",
  cringe_laugh: "<:Cringe_Laughing_Son:1526539082564374710>",
  point_laugh: "<:PointAndLaughingEmoji:1525657154567016469>",
  crown: "<:Holographic_owner_crown:1527401510487461969>",
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("wanted")
    .setDescription("wanted system based on chaotic behavior")
    .addSubcommand(sub =>
      sub.setName("view")
        .setDescription("check someone's wanted level")
        .addUserOption(opt => opt.setName("user").setDescription("who to check").setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName("top")
        .setDescription("most wanted users in this server")
    )
    .addSubcommand(sub =>
      sub.setName("add")
        .setDescription("(admin) add wanted points to a user")
        .addUserOption(opt => opt.setName("user").setDescription("target").setRequired(true))
        .addIntegerOption(opt => opt.setName("points").setDescription("points to add").setRequired(true).setMinValue(1))
    )
    .addSubcommand(sub =>
      sub.setName("remove")
        .setDescription("(admin) remove wanted points from a user")
        .addUserOption(opt => opt.setName("user").setDescription("target").setRequired(true))
        .addIntegerOption(opt => opt.setName("points").setDescription("points to remove").setRequired(true).setMinValue(1))
    )
    .addSubcommand(sub =>
      sub.setName("reset")
        .setDescription("(admin) reset a user's wanted points to 0")
        .addUserOption(opt => opt.setName("user").setDescription("target").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("toggle")
        .setDescription("(owner) toggle AI insane scanning")
    ),

  async execute(interaction) {
    const isButtonSim = interaction.isButton && interaction.isButton();
    if (!isButtonSim) {
      try { await interaction.deferReply(); } catch {}
    }

    const client = interaction.client;
    const pool = client.pool;
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    // ensure tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS wanted_levels (
        guild_id TEXT,
        user_id TEXT,
        points INTEGER DEFAULT 0,
        updated_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (guild_id, user_id)
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS wanted_settings (
        guild_id TEXT PRIMARY KEY,
        ai_scan_enabled BOOLEAN DEFAULT FALSE,
        scan_cooldown_seconds INTEGER DEFAULT 300,
        insane_threshold INTEGER DEFAULT 3,
        points_per_star INTEGER DEFAULT 1
      )
    `);

    const getWanted = async (targetId) => {
      const res = await pool.query(
        "SELECT points FROM wanted_levels WHERE guild_id = $1 AND user_id = $2",
        [guildId, targetId]
      );
      return res.rows[0]?.points || 0;
    };

    const setWanted = async (targetId, points) => {
      await pool.query(
        "INSERT INTO wanted_levels (guild_id, user_id, points) VALUES ($1,$2,$3) ON CONFLICT (guild_id,user_id) DO UPDATE SET points = $3",
        [guildId, targetId, points]
      );
    };

    const levelFromPoints = (points) => {
      if (points >= 20) return 5;
      if (points >= 12) return 4;
      if (points >= 6) return 3;
      if (points >= 2) return 2;
      if (points >= 1) return 1;
      return 0;
    };

    if (sub === "view") {
      const target = interaction.options.getUser("user") || interaction.user;
      const points = await getWanted(target.id);
      const level = levelFromPoints(points);
      const embed = new EmbedBuilder()
        .setColor(0x7c7ce0)
        .setTitle(`${E.ai} wanted status`)
        .setDescription(`${target} — **wanted level ${level}** (${points} pts)`)
        .setFooter({ text: "chaos is tracked" })
        .setTimestamp();
      return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
    }

    if (sub === "top") {
      const res = await pool.query(
        "SELECT user_id, points FROM wanted_levels WHERE guild_id = $1 ORDER BY points DESC LIMIT 10",
        [guildId]
      );
      if (!res.rows.length) {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x7c7ce0).setTitle(`${E.error} no wanted users`).setDescription("nobody is wanted yet.")] });
      }
      const list = res.rows.map((r, i) => {
        const member = interaction.guild.members.cache.get(r.user_id);
        const name = member ? member.displayName : r.user_id;
        return `${i + 1}. **${name}** — ${r.points} pts (lvl ${levelFromPoints(r.points)})`;
      }).join("\n");
      const embed = new EmbedBuilder()
        .setColor(0x7c7ce0)
        .setTitle(`${E.crown} most wanted`)
        .setDescription(list);
      return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
    }

    // admin commands
    const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    if (!isAdmin) {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle(`${E.error} permission denied`)
        .setDescription(`${E.angry} you need administrator permission.`);
      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === "add") {
      const target = interaction.options.getUser("user");
      const points = interaction.options.getInteger("points");
      const current = await getWanted(target.id);
      await setWanted(target.id, current + points);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x7c7ce0).setTitle(`${E.success} wanted points added`).setDescription(`${target} now has **${current + points}** pts.`)] });
    }

    if (sub === "remove") {
      const target = interaction.options.getUser("user");
      const points = interaction.options.getInteger("points");
      const current = await getWanted(target.id);
      const newPoints = Math.max(0, current - points);
      await setWanted(target.id, newPoints);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x7c7ce0).setTitle(`${E.success} wanted points removed`).setDescription(`${target} now has **${newPoints}** pts.`)] });
    }

    if (sub === "reset") {
      const target = interaction.options.getUser("user");
      await setWanted(target.id, 0);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x7c7ce0).setTitle(`${E.success} wanted reset`).setDescription(`${target} is clean now.`)] });
    }

    if (sub === "toggle") {
      // owner only
      const ownerIds = [process.env.OWNER_ID, process.env.OWNER_ID2].filter(Boolean);
      if (!ownerIds.includes(userId)) {
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(0xff0000).setTitle(`${E.error} owner only`).setDescription(`${E.angry} only the bot owner can toggle AI scanning.`)] });
      }
      const current = await pool.query("SELECT ai_scan_enabled FROM wanted_settings WHERE guild_id = $1", [guildId]);
      const enabled = current.rows[0]?.ai_scan_enabled ?? false;
      const newEnabled = !enabled;
      await pool.query(
        "INSERT INTO wanted_settings (guild_id, ai_scan_enabled) VALUES ($1,$2) ON CONFLICT (guild_id) DO UPDATE SET ai_scan_enabled = $2",
        [guildId, newEnabled]
      );
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x7c7ce0).setTitle(`${E.sneaky} AI scanner ${newEnabled ? "enabled" : "disabled"}`).setDescription(`AI will now scan messages for insane behavior.`)] });
    }

    return interaction.editReply({ embeds: [new EmbedBuilder().setColor(0xff0000).setDescription(`${E.error} unknown subcommand.`)] });
  },
};
