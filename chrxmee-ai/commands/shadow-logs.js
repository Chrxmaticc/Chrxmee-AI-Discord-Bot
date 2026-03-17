const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

function generateId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = 'SL-';
  for (let i = 0; i < 4; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

async function ensureTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS shadow_logs (
      id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      target_id TEXT NOT NULL,
      target_username TEXT,
      mod_id TEXT NOT NULL,
      mod_username TEXT,
      note TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (id, guild_id)
    )
  `);
}

function isMod(interaction) {
  return interaction.member &&
    (interaction.member.permissions.has('KickMembers') ||
     interaction.member.permissions.has('BanMembers') ||
     interaction.member.permissions.has('Administrator'));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('shadow-logs')
    .setDescription('Secret moderation note system')
    .addSubcommand(sub =>
      sub.setName('note')
        .setDescription('Add a shadow note about a user')
        .addUserOption(opt => opt.setName('user').setDescription('User to note').setRequired(true))
        .addStringOption(opt => opt.setName('message').setDescription('The note content').setRequired(true))
        .addStringOption(opt => opt.setName('id').setDescription('Custom note ID (optional, auto-generated if blank)').setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName('view')
        .setDescription('View shadow notes')
        .addUserOption(opt => opt.setName('user').setDescription('View all notes about this user (mod only)').setRequired(false))
        .addStringOption(opt => opt.setName('id').setDescription('View a specific note by ID').setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('(Mod only) List all users who have shadow notes')
    )
    .addSubcommand(sub =>
      sub.setName('delete')
        .setDescription('(Mod only) Delete a specific note by ID')
        .addStringOption(opt => opt.setName('id').setDescription('Note ID to delete').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('clear')
        .setDescription('(Mod only) Clear all notes for a user')
        .addUserOption(opt => opt.setName('user').setDescription('User to clear notes for').setRequired(true))
    ),

  async execute(interaction, client) {
    try { await interaction.deferReply({ ephemeral: true }); }
    catch (err) { return interaction.reply({ content: 'Failed.', ephemeral: true }).catch(() => {}); }

    const userId = interaction.user.id;
    const guildId = interaction.guild.id;
    const username = interaction.user.username;
    const pool = client.pool;

    if (!pool) return interaction.editReply('❌ Database not available.');

    const sub = interaction.options.getSubcommand();

    // ── NOTE ───────────────────────────────────────────────
    if (sub === 'note') {
      if (!isMod(interaction)) return interaction.editReply('❌ Moderators only.');
      await ensureTable(pool);

      const target = interaction.options.getUser('user');
      const message = interaction.options.getString('message');
      let noteId = interaction.options.getString('id') || generateId();
      noteId = noteId.toUpperCase().replace(/[^A-Z0-9\-]/g, '').slice(0, 20);
      if (!noteId) noteId = generateId();

      // Check if ID already exists
      const existing = await pool.query(`SELECT id FROM shadow_logs WHERE id = $1 AND guild_id = $2`, [noteId, guildId]);
      if (existing.rows.length > 0) {
        return interaction.editReply(`❌ Note ID **${noteId}** already exists! Use a different ID or leave it blank for auto-generation.`);
      }

      await pool.query(`
        INSERT INTO shadow_logs (id, guild_id, target_id, target_username, mod_id, mod_username, note)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [noteId, guildId, target.id, target.username, userId, username, message]);

      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor('#2f3136')
          .setTitle('📋 Shadow Note Added')
          .addFields(
            { name: '🆔 Note ID',   value: `\`${noteId}\``,      inline: true },
            { name: '👤 About',     value: `${target.username}`, inline: true },
            { name: '🛡️ Logged by', value: username,             inline: true },
            { name: '📝 Note',      value: message,              inline: false },
            { name: '🕐 Time',      value: new Date().toUTCString(), inline: false }
          )
          .setFooter({ text: `Share ID ${noteId} to let the user view their note` })]
      });
    }

    // ── VIEW ───────────────────────────────────────────────
    if (sub === 'view') {
      await ensureTable(pool);
      const target = interaction.options.getUser('user');
      const noteId = interaction.options.getString('id');

      // View by ID — anyone can do this
      if (noteId && !target) {
        const result = await pool.query(
          `SELECT * FROM shadow_logs WHERE id = $1 AND guild_id = $2`,
          [noteId.toUpperCase(), guildId]
        );
        if (result.rows.length === 0) return interaction.editReply(`❌ No note found with ID **${noteId.toUpperCase()}**.`);
        const note = result.rows[0];
        return interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor('#2f3136')
            .setTitle(`📋 Shadow Note — ${noteId.toUpperCase()}`)
            .addFields(
              { name: '👤 About',     value: note.target_username, inline: true },
              { name: '🛡️ Logged by', value: note.mod_username,    inline: true },
              { name: '📝 Note',      value: note.note,            inline: false },
              { name: '🕐 Date',      value: new Date(note.created_at).toUTCString(), inline: false }
            )]
        });
      }

      // View by user — mods only
      if (target) {
        if (!isMod(interaction)) return interaction.editReply('❌ Viewing all notes about a user requires moderator permissions.');
        const result = await pool.query(
          `SELECT * FROM shadow_logs WHERE target_id = $1 AND guild_id = $2 ORDER BY created_at DESC`,
          [target.id, guildId]
        );
        if (result.rows.length === 0) return interaction.editReply(`📋 No shadow notes found for **${target.username}**.`);

        const lines = result.rows.map(n =>
          `**[${n.id}]** ${n.note}\n*by ${n.mod_username} — ${new Date(n.created_at).toLocaleDateString()}*`
        ).join('\n\n');

        return interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor('#2f3136')
            .setTitle(`📋 Shadow Notes — ${target.username} (${result.rows.length})`)
            .setDescription(lines.slice(0, 4096))]
        });
      }

      return interaction.editReply('❌ Please provide either a user or a note ID.');
    }

    // ── LIST ───────────────────────────────────────────────
    if (sub === 'list') {
      if (!isMod(interaction)) return interaction.editReply('❌ Moderators only.');
      await ensureTable(pool);

      const result = await pool.query(
        `SELECT target_id, target_username, COUNT(*) as note_count FROM shadow_logs WHERE guild_id = $1 GROUP BY target_id, target_username ORDER BY note_count DESC`,
        [guildId]
      );

      if (result.rows.length === 0) return interaction.editReply('📋 No shadow notes in this server yet.');

      const lines = result.rows.map(r => `**${r.target_username}** (<@${r.target_id}>) — **${r.note_count}** note(s)`).join('\n');

      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor('#2f3136')
          .setTitle(`📋 Shadow Log Users (${result.rows.length})`)
          .setDescription(lines)]
      });
    }

    // ── DELETE ─────────────────────────────────────────────
    if (sub === 'delete') {
      if (!isMod(interaction)) return interaction.editReply('❌ Moderators only.');
      await ensureTable(pool);

      const noteId = interaction.options.getString('id').toUpperCase();
      const result = await pool.query(
        `DELETE FROM shadow_logs WHERE id = $1 AND guild_id = $2 RETURNING *`,
        [noteId, guildId]
      );

      if (result.rows.length === 0) return interaction.editReply(`❌ No note found with ID **${noteId}**.`);
      return interaction.editReply(`✅ Note **${noteId}** deleted.`);
    }

    // ── CLEAR ──────────────────────────────────────────────
    if (sub === 'clear') {
      if (!isMod(interaction)) return interaction.editReply('❌ Moderators only.');
      await ensureTable(pool);

      const target = interaction.options.getUser('user');
      const result = await pool.query(
        `DELETE FROM shadow_logs WHERE target_id = $1 AND guild_id = $2`,
        [target.id, guildId]
      );

      return interaction.editReply(`✅ Cleared **${result.rowCount}** note(s) for **${target.username}**.`);
    }
  }
};
