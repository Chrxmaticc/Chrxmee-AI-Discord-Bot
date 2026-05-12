const { SlashCommandBuilder } = require(‘discord.js’);
const { Pool } = require(‘pg’);

const UWUIFY_ROLE_ID = ‘1503853457013084241’;

const pool = new Pool({
connectionString: process.env.DATABASE_URL,
ssl: { rejectUnauthorized: false }
});

pool.query(`CREATE TABLE IF NOT EXISTS uwuify_protected ( guild_id TEXT, user_id TEXT, protected_by TEXT, protected_at TIMESTAMP DEFAULT NOW(), PRIMARY KEY (guild_id, user_id) )`);

module.exports = {
data: new SlashCommandBuilder()
.setName(‘uwuify-protect’)
.setDescription(‘Protect or unprotect users from the uwuify command’)
.addSubcommand(sub =>
sub.setName(‘add’)
.setDescription(‘Protect a user from being uwuified’)
.addUserOption(opt =>
opt.setName(‘target’)
.setDescription(‘Who to protect?’)
.setRequired(true)))
.addSubcommand(sub =>
sub.setName(‘remove’)
.setDescription(‘Remove protection from a user’)
.addUserOption(opt =>
opt.setName(‘target’)
.setDescription(‘Who to unprotect?’)
.setRequired(true)))
.addSubcommand(sub =>
sub.setName(‘list’)
.setDescription(‘List all protected users in this server’)),

```
async execute(interaction) {
    // Only the uwuify role can use this
    if (!interaction.member.roles.cache.has(UWUIFY_ROLE_ID)) {
        return interaction.reply({
            content: '❌ You don\'t have permission to use this command.',
            ephemeral: true
        });
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'add') {
        const target = interaction.options.getUser('target');

        const existing = await pool.query(
            'SELECT 1 FROM uwuify_protected WHERE guild_id = $1 AND user_id = $2',
            [interaction.guild.id, target.id]
        );

        if (existing.rows.length > 0) {
            return interaction.reply({
                content: `🛡️ **${target.displayName}** is already protected.`,
                ephemeral: true
            });
        }

        await pool.query(
            'INSERT INTO uwuify_protected (guild_id, user_id, protected_by) VALUES ($1, $2, $3)',
            [interaction.guild.id, target.id, interaction.user.id]
        );

        return interaction.reply({
            content: `🛡️ **${target.displayName}** is now protected. Nobody can uwuify them.`,
        });
    }

    if (sub === 'remove') {
        const target = interaction.options.getUser('target');

        const result = await pool.query(
            'DELETE FROM uwuify_protected WHERE guild_id = $1 AND user_id = $2 RETURNING *',
            [interaction.guild.id, target.id]
        );

        if (result.rows.length === 0) {
            return interaction.reply({
                content: `❌ **${target.displayName}** isn't protected.`,
                ephemeral: true
            });
        }

        return interaction.reply({
            content: `🔓 **${target.displayName}** is no longer protected.`,
        });
    }

    if (sub === 'list') {
        const result = await pool.query(
            'SELECT * FROM uwuify_protected WHERE guild_id = $1',
            [interaction.guild.id]
        );

        if (result.rows.length === 0) {
            return interaction.reply({
                content: 'No users are currently protected in this server.',
                ephemeral: true
            });
        }

        const list = result.rows.map(row => {
            const user = interaction.guild.members.cache.get(row.user_id);
            const protector = interaction.guild.members.cache.get(row.protected_by);
            return `• **${user?.displayName || row.user_id}** (by ${protector?.displayName || row.protected_by})`;
        }).join('\n');

        return interaction.reply({
            embeds: [{
                color: 0x57F287,
                title: '🛡️ Protected Users',
                description: list,
                footer: { text: `Total: ${result.rows.length} user(s)` }
            }],
            ephemeral: true
        });
    }
}
```

};
