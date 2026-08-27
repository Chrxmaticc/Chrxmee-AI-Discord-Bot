const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
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

const QUIET_ROLE_NAME = "quietlock-manage";

pool.query(`
  CREATE TABLE IF NOT EXISTS quietlock_active (
    guild_id TEXT,
    user_id TEXT,
    channel_id TEXT,
    started_by TEXT,
    started_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (guild_id, user_id, channel_id)
  )
`);

pool.query(`
  CREATE TABLE IF NOT EXISTS quietlock_protected (
    guild_id TEXT,
    user_id TEXT,
    protected_by TEXT,
    protected_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (guild_id, user_id)
  )
`);

module.exports = {
  data: new SlashCommandBuilder()
    .setName("quietlock")
    .setDescription("silence a user using webhook cloning")
    .addSubcommand(sub =>
      sub.setName("setup")
        .setDescription("create the quietlock-manage role for this server")
    )
    .addSubcommand(sub =>
      sub.setName("apply")
        .setDescription("silence a user")
        .addUserOption(opt => opt.setName("target").setDescription("who to silence").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("remove")
        .setDescription("remove silence from a user")
        .addUserOption(opt => opt.setName("target").setDescription("who to unsilence").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("list")
        .setDescription("list all silenced users in this server")
    )
    .addSubcommand(sub =>
      sub.setName("protect-add")
        .setDescription("protect a user from being silenced")
        .addUserOption(opt => opt.setName("target").setDescription("who to protect").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("protect-remove")
        .setDescription("remove protection from a user")
        .addUserOption(opt => opt.setName("target").setDescription("who to unprotect").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("protect-list")
        .setDescription("list protected users")
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === "setup") {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: `${E.error} you need administrator permission.`, ephemeral: true });
      }

      const existing = interaction.guild.roles.cache.find(r => r.name === QUIET_ROLE_NAME);
      if (existing) {
        return interaction.reply({ content: `${E.success} **${QUIET_ROLE_NAME}** already exists. give it to people who can use quietlock.`, ephemeral: true });
      }

      try {
        const role = await interaction.guild.roles.create({
          name: QUIET_ROLE_NAME,
          color: 0x7c7ce0,
          reason: "quietlock command management",
          permissions: [],
          mentionable: false,
        });
        return interaction.reply({ content: `${E.success} created **${QUIET_ROLE_NAME}** role. give it to trusted users.`, ephemeral: true });
      } catch (err) {
        console.error("setup error:", err);
        return interaction.reply({ content: `${E.error} failed to create role. make sure i have manage roles permission.`, ephemeral: true });
      }
    }

    const manageRole = interaction.guild.roles.cache.find(r => r.name === QUIET_ROLE_NAME);
    if (!manageRole) {
      return interaction.reply({ content: `${E.error} no **${QUIET_ROLE_NAME}** role. run /quietlock setup first.`, ephemeral: true });
    }
    if (!interaction.member.roles.cache.has(manageRole.id)) {
      return interaction.reply({ content: `${E.error} you need the **${QUIET_ROLE_NAME}** role to use quietlock.`, ephemeral: true });
    }

    switch (sub) {
      case "apply": return handleApply(interaction);
      case "remove": return handleRemove(interaction);
      case "list": return handleList(interaction);
      case "protect-add": return handleProtectAdd(interaction);
      case "protect-remove": return handleProtectRemove(interaction);
      case "protect-list": return handleProtectList(interaction);
    }
  },
};

async function handleApply(interaction) {
  const target = interaction.options.getUser("target");

  const protected = await pool.query(
    "SELECT 1 FROM quietlock_protected WHERE guild_id = $1 AND user_id = $2",
    [interaction.guild.id, target.id]
  );
  if (protected.rows.length > 0) {
    return interaction.reply({ content: `${E.sneaky} **${target.displayName}** is protected.`, ephemeral: true });
  }

  const existing = await pool.query(
    "SELECT * FROM quietlock_active WHERE guild_id = $1 AND user_id = $2 AND channel_id = $3",
    [interaction.guild.id, target.id, interaction.channel.id]
  );
  if (existing.rows.length > 0) {
    return interaction.reply({ content: `${E.error} **${target.displayName}** is already silenced.`, ephemeral: true });
  }

  await pool.query(
    "INSERT INTO quietlock_active (guild_id, user_id, channel_id, started_by) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING",
    [interaction.guild.id, target.id, interaction.channel.id, interaction.user.id]
  );

  return interaction.reply({ content: `${E.success} **${target.displayName}** is now silenced. their messages become "..."` });
}

async function handleRemove(interaction) {
  const target = interaction.options.getUser("target");
  const result = await pool.query(
    "DELETE FROM quietlock_active WHERE guild_id = $1 AND user_id = $2 AND channel_id = $3 RETURNING *",
    [interaction.guild.id, target.id, interaction.channel.id]
  );
  if (result.rows.length === 0) {
    return interaction.reply({ content: `${E.error} **${target.displayName}** isn't silenced.`, ephemeral: true });
  }
  return interaction.reply({ content: `${E.success} **${target.displayName}** can talk again.` });
}

async function handleList(interaction) {
  const result = await pool.query("SELECT * FROM quietlock_active WHERE guild_id = $1", [interaction.guild.id]);
  if (result.rows.length === 0) {
    return interaction.reply({ content: `${E.error} no one is silenced.`, ephemeral: true });
  }

  const list = result.rows.map(row => {
    const user = interaction.guild.members.cache.get(row.user_id);
    const channel = interaction.guild.channels.cache.get(row.channel_id);
    return `• **${user?.displayName || row.user_id}** in #${channel?.name || row.channel_id}`;
  }).join("\n");

  return interaction.reply({
    embeds: [{
      color: 0x7c7ce0,
      title: `${E.sneaky} silenced users`,
      description: list,
      footer: { text: `total: ${result.rows.length}` }
    }],
    ephemeral: true,
  });
}

async function handleProtectAdd(interaction) {
  const target = interaction.options.getUser("target");

  const existing = await pool.query(
    "SELECT 1 FROM quietlock_protected WHERE guild_id = $1 AND user_id = $2",
    [interaction.guild.id, target.id]
  );
  if (existing.rows.length > 0) {
    return interaction.reply({ content: `${E.sneaky} **${target.displayName}** is already protected.`, ephemeral: true });
  }

  await pool.query(
    "INSERT INTO quietlock_protected (guild_id, user_id, protected_by) VALUES ($1,$2,$3)",
    [interaction.guild.id, target.id, interaction.user.id]
  );

  await pool.query(
    "DELETE FROM quietlock_active WHERE guild_id = $1 AND user_id = $2",
    [interaction.guild.id, target.id]
  );

  return interaction.reply({ content: `${E.success} **${target.displayName}** is now protected.` });
}

async function handleProtectRemove(interaction) {
  const target = interaction.options.getUser("target");
  const result = await pool.query(
    "DELETE FROM quietlock_protected WHERE guild_id = $1 AND user_id = $2 RETURNING *",
    [interaction.guild.id, target.id]
  );
  if (result.rows.length === 0) {
    return interaction.reply({ content: `${E.error} **${target.displayName}** isn't protected.`, ephemeral: true });
  }
  return interaction.reply({ content: `${E.success} **${target.displayName}** is no longer protected.` });
}

async function handleProtectList(interaction) {
  const result = await pool.query("SELECT * FROM quietlock_protected WHERE guild_id = $1", [interaction.guild.id]);
  if (result.rows.length === 0) {
    return interaction.reply({ content: `${E.error} no protected users.`, ephemeral: true });
  }

  const list = result.rows.map(row => {
    const user = interaction.guild.members.cache.get(row.user_id);
    return `• **${user?.displayName || row.user_id}**`;
  }).join("\n");

  return interaction.reply({
    embeds: [{
      color: 0x57F287,
      title: `${E.agree} protected users`,
      description: list,
      footer: { text: `total: ${result.rows.length}` }
    }],
    ephemeral: true,
  });
}
