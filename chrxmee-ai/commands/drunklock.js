const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const { Pool } = require("pg");

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
};

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const DRUNK_ROLE_NAME = "drunklock-manage";

pool.query(`
  CREATE TABLE IF NOT EXISTS drunklock_active (
    guild_id TEXT,
    user_id TEXT,
    channel_id TEXT,
    started_by TEXT,
    started_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (guild_id, user_id, channel_id)
  )
`);

pool.query(`
  CREATE TABLE IF NOT EXISTS drunklock_protected (
    guild_id TEXT,
    user_id TEXT,
    protected_by TEXT,
    protected_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (guild_id, user_id)
  )
`);

module.exports = {
  data: new SlashCommandBuilder()
    .setName("drunklock")
    .setDescription("make a user talk like they're drunk")
    .addSubcommand(sub => sub.setName("setup").setDescription("create the drunklock-manage role"))
    .addSubcommand(sub =>
      sub.setName("apply")
        .setDescription("apply drunklock to a user")
        .addUserOption(opt => opt.setName("target").setDescription("who to drunklock").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("remove")
        .setDescription("remove drunklock from a user")
        .addUserOption(opt => opt.setName("target").setDescription("who to unlock").setRequired(true))
    )
    .addSubcommand(sub => sub.setName("list").setDescription("list all drunklocked users"))
    .addSubcommand(sub =>
      sub.setName("protect-add")
        .setDescription("protect a user from being drunklocked")
        .addUserOption(opt => opt.setName("target").setDescription("who to protect").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("protect-remove")
        .setDescription("remove protection from a user")
        .addUserOption(opt => opt.setName("target").setDescription("who to unprotect").setRequired(true))
    )
    .addSubcommand(sub => sub.setName("protect-list").setDescription("list protected users")),

  async execute(interaction) {
    const isButtonSim = interaction.isButton && interaction.isButton();
    if (!isButtonSim) {
      try { await interaction.deferReply({ ephemeral: true }); } catch { try { await interaction.deferReply(); } catch {} }
    }

    const sub = interaction.options.getSubcommand();

    if (sub === "setup") {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle(`${E.error} permission denied`)
          .setDescription(`${E.angry} you need administrator permission.`);
        return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
      }

      const existing = interaction.guild.roles.cache.find(r => r.name === DRUNK_ROLE_NAME);
      if (existing) {
        return interaction.editReply(`${E.success} **${DRUNK_ROLE_NAME}** already exists. give it to trusted users.`).catch(() => interaction.followUp(`${E.success} **${DRUNK_ROLE_NAME}** already exists.`));
      }

      try {
        const role = await interaction.guild.roles.create({
          name: DRUNK_ROLE_NAME,
          color: 0x7c7ce0,
          reason: "drunklock command management",
          permissions: [],
          mentionable: false,
        });
        return interaction.editReply(`${E.success} created **${DRUNK_ROLE_NAME}** role. give it to trusted users.`).catch(() => interaction.followUp(`${E.success} created **${DRUNK_ROLE_NAME}** role.`));
      } catch (err) {
        console.error("drunklock setup error:", err);
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle(`${E.error} setup failed`)
          .setDescription(`${E.angry} failed to create role.`);
        return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
      }
    }

    const manageRole = interaction.guild.roles.cache.find(r => r.name === DRUNK_ROLE_NAME);
    if (!manageRole) {
      return interaction.editReply(`${E.error} no **${DRUNK_ROLE_NAME}** role. run /drunklock setup first.`).catch(() => interaction.followUp(`${E.error} no **${DRUNK_ROLE_NAME}** role.`));
    }
    if (!interaction.member.roles.cache.has(manageRole.id)) {
      return interaction.editReply(`${E.error} you need the **${DRUNK_ROLE_NAME}** role to use drunklock.`).catch(() => interaction.followUp(`${E.error} you need the **${DRUNK_ROLE_NAME}** role.`));
    }

    switch (sub) {
      case "apply": return handleApply(interaction, isButtonSim);
      case "remove": return handleRemove(interaction, isButtonSim);
      case "list": return handleList(interaction, isButtonSim);
      case "protect-add": return handleProtectAdd(interaction, isButtonSim);
      case "protect-remove": return handleProtectRemove(interaction, isButtonSim);
      case "protect-list": return handleProtectList(interaction, isButtonSim);
    }
  },
};

async function sendReply(interaction, isButtonSim, content, ephemeral = false) {
  if (isButtonSim) {
    return interaction.followUp({ content, ephemeral });
  } else {
    return interaction.editReply({ content, ephemeral });
  }
}

async function handleApply(interaction, isButtonSim) {
  const target = interaction.options.getUser("target");

  const protected = await pool.query(
    "SELECT 1 FROM drunklock_protected WHERE guild_id = $1 AND user_id = $2",
    [interaction.guild.id, target.id]
  );
  if (protected.rows.length > 0) {
    return sendReply(interaction, isButtonSim, `${E.sneaky} **${target.displayName}** is protected.`, true);
  }

  const existing = await pool.query(
    "SELECT * FROM drunklock_active WHERE guild_id = $1 AND user_id = $2 AND channel_id = $3",
    [interaction.guild.id, target.id, interaction.channel.id]
  );
  if (existing.rows.length > 0) {
    return sendReply(interaction, isButtonSim, `${E.error} **${target.displayName}** is already drunklocked.`, true);
  }

  await pool.query(
    "INSERT INTO drunklock_active (guild_id, user_id, channel_id, started_by) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING",
    [interaction.guild.id, target.id, interaction.channel.id, interaction.user.id]
  );

  return sendReply(interaction, isButtonSim, `${E.success} **${target.displayName}** is now drunklocked. their messages will be slurred.`);
}

async function handleRemove(interaction, isButtonSim) {
  const target = interaction.options.getUser("target");
  const result = await pool.query(
    "DELETE FROM drunklock_active WHERE guild_id = $1 AND user_id = $2 AND channel_id = $3 RETURNING *",
    [interaction.guild.id, target.id, interaction.channel.id]
  );
  if (result.rows.length === 0) {
    return sendReply(interaction, isButtonSim, `${E.error} **${target.displayName}** isn't drunklocked.`, true);
  }
  return sendReply(interaction, isButtonSim, `${E.success} **${target.displayName}** can talk normally again.`);
}

async function handleList(interaction, isButtonSim) {
  const result = await pool.query("SELECT * FROM drunklock_active WHERE guild_id = $1", [interaction.guild.id]);
  if (result.rows.length === 0) {
    return sendReply(interaction, isButtonSim, `${E.error} no one is drunklocked.`, true);
  }

  const list = result.rows.map(row => {
    const user = interaction.guild.members.cache.get(row.user_id);
    const channel = interaction.guild.channels.cache.get(row.channel_id);
    return `• **${user?.displayName || row.user_id}** in #${channel?.name || row.channel_id}`;
  }).join("\n");

  return sendReply(interaction, isButtonSim, `${E.sneaky} **drunklocked users:**\n${list}`, true);
}

async function handleProtectAdd(interaction, isButtonSim) {
  const target = interaction.options.getUser("target");

  const existing = await pool.query(
    "SELECT 1 FROM drunklock_protected WHERE guild_id = $1 AND user_id = $2",
    [interaction.guild.id, target.id]
  );
  if (existing.rows.length > 0) {
    return sendReply(interaction, isButtonSim, `${E.sneaky} **${target.displayName}** is already protected.`, true);
  }

  await pool.query(
    "INSERT INTO drunklock_protected (guild_id, user_id, protected_by) VALUES ($1,$2,$3)",
    [interaction.guild.id, target.id, interaction.user.id]
  );

  await pool.query(
    "DELETE FROM drunklock_active WHERE guild_id = $1 AND user_id = $2",
    [interaction.guild.id, target.id]
  );

  return sendReply(interaction, isButtonSim, `${E.success} **${target.displayName}** is now protected.`);
}

async function handleProtectRemove(interaction, isButtonSim) {
  const target = interaction.options.getUser("target");
  const result = await pool.query(
    "DELETE FROM drunklock_protected WHERE guild_id = $1 AND user_id = $2 RETURNING *",
    [interaction.guild.id, target.id]
  );
  if (result.rows.length === 0) {
    return sendReply(interaction, isButtonSim, `${E.error} **${target.displayName}** isn't protected.`, true);
  }
  return sendReply(interaction, isButtonSim, `${E.success} **${target.displayName}** is no longer protected.`);
}

async function handleProtectList(interaction, isButtonSim) {
  const result = await pool.query("SELECT * FROM drunklock_protected WHERE guild_id = $1", [interaction.guild.id]);
  if (result.rows.length === 0) {
    return sendReply(interaction, isButtonSim, `${E.error} no protected users.`, true);
  }

  const list = result.rows.map(row => {
    const user = interaction.guild.members.cache.get(row.user_id);
    return `• **${user?.displayName || row.user_id}**`;
  }).join("\n");

  return sendReply(interaction, isButtonSim, `${E.agree} **protected users:**\n${list}`, true);
}
