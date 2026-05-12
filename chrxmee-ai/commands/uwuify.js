const { SlashCommandBuilder, WebhookClient, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { Pool } = require('pg');

// PostgreSQL connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Initialize tables
pool.query(`
    CREATE TABLE IF NOT EXISTS uwuify_active (
        guild_id TEXT,
        user_id TEXT,
        mode TEXT,
        channel_id TEXT,
        started_by TEXT,
        started_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (guild_id, user_id, channel_id)
    )
`);

pool.query(`
    CREATE TABLE IF NOT EXISTS uwuify_protected (
        guild_id TEXT,
        user_id TEXT,
        protected_by TEXT,
        protected_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (guild_id, user_id)
    )
`);

// Webhook cache
const webhookCache = new Map();

// Role name constant
const UWUIFY_ROLE_NAME = 'uwuify-manage';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('uwuify')
        .setDescription('Persistent UwU system - uwuifies all messages until removed')

        // ─── SETUP ──────────────────────────
        .addSubcommand(sub =>
            sub.setName('setup')
                .setDescription('Create the uwuify-manage role for this server'))

        // ─── APPLY ──────────────────────────
        .addSubcommand(sub =>
            sub.setName('apply')
                .setDescription('Start uwuifying a user')
                .addUserOption(opt =>
                    opt.setName('target')
                        .setDescription('Who to uwuify?')
                        .setRequired(true))
                .addStringOption(opt =>
                    opt.setName('mode')
                        .setDescription('How intense?')
                        .setRequired(true)
                        .addChoices(
                            { name: '🌸 Light & Cute', value: 'light' },
                            { name: '💥 Strong & Chaotic', value: 'strong' },
                        )))

        // ─── REMOVE ─────────────────────────
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('Stop uwuifying a user')
                .addUserOption(opt =>
                    opt.setName('target')
                        .setDescription('Who to remove UwU from?')
                        .setRequired(true)))

        // ─── LIST ───────────────────────────
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('List all currently uwuified users in this server'))

        // ─── PROTECT ADD ────────────────────
        .addSubcommand(sub =>
            sub.setName('protect-add')
                .setDescription('Protect a user from being uwuified')
                .addUserOption(opt =>
                    opt.setName('target')
                        .setDescription('Who to protect?')
                        .setRequired(true)))

        // ─── PROTECT REMOVE ─────────────────
        .addSubcommand(sub =>
            sub.setName('protect-remove')
                .setDescription('Remove protection from a user')
                .addUserOption(opt =>
                    opt.setName('target')
                        .setDescription('Who to unprotect?')
                        .setRequired(true)))

        // ─── PROTECT LIST ───────────────────
        .addSubcommand(sub =>
            sub.setName('protect-list')
                .setDescription('List all protected users in this server')),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        // ─── SETUP DOESN'T NEED ROLE CHECK ────────
        if (subcommand === 'setup') {
            return handleSetup(interaction);
        }

        // ─── PERMISSION CHECKS ────────────────────
        
        // Check bot permissions first
        if (!interaction.channel.permissionsFor(interaction.guild.members.me).has('ManageWebhooks')) {
            return interaction.reply({
                content: '❌ I need **Manage Webhooks** permission for uwuify to work.',
                ephemeral: true
            });
        }

        // Check if uwuify-manage role exists
        const manageRole = interaction.guild.roles.cache.find(r => r.name === UWUIFY_ROLE_NAME);
        if (!manageRole) {
            return interaction.reply({
                content: `❌ No **${UWUIFY_ROLE_NAME}** role found in this server.\nAn admin must run \`/uwuify setup\` first.`,
                ephemeral: true
            });
        }

        // Check if user has the role
        if (!interaction.member.roles.cache.has(manageRole.id)) {
            return interaction.reply({
                content: `❌ You need the **${UWUIFY_ROLE_NAME}** role to use uwuify commands.`,
                ephemeral: true
            });
        }

        // Route subcommands
        switch (subcommand) {
            case 'apply': return handleApply(interaction);
            case 'remove': return handleRemove(interaction);
            case 'list': return handleList(interaction);
            case 'protect-add': return handleProtectAdd(interaction);
            case 'protect-remove': return handleProtectRemove(interaction);
            case 'protect-list': return handleProtectList(interaction);
        }
    }
};

// ─── SETUP ──────────────────────────────────────
async function handleSetup(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({
            content: '❌ You need **Administrator** permission to run setup.',
            ephemeral: true
        });
    }

    const existingRole = interaction.guild.roles.cache.find(r => r.name === UWUIFY_ROLE_NAME);

    if (existingRole) {
        return interaction.reply({
            content: `✅ **${UWUIFY_ROLE_NAME}** role already exists!\n\nGive this role to anyone who should use \`/uwuify\`.\n\n**Role:** ${existingRole}`,
            ephemeral: true
        });
    }

    try {
        const role = await interaction.guild.roles.create({
            name: UWUIFY_ROLE_NAME,
            color: 0xFFAACC,
            reason: 'Uwuify command management',
            permissions: [],
            mentionable: false,
        });

        return interaction.reply({
            content: `✅ **${UWUIFY_ROLE_NAME}** role created!\n\nGive this role to anyone who should use \`/uwuify\`.\n\n**Role:** ${role}\n\nRun \`/uwuify setup\` again to confirm.`,
            ephemeral: true
        });
    } catch (err) {
        console.error('Setup error:', err);
        return interaction.reply({
            content: '❌ Failed to create role. Make sure I have **Manage Roles** permission.',
            ephemeral: true
        });
    }
}

// ─── APPLY ──────────────────────────────────────
async function handleApply(interaction) {
    const target = interaction.options.getUser('target');
    const mode = interaction.options.getString('mode');

    // Check if protected
    const protected = await pool.query(
        'SELECT 1 FROM uwuify_protected WHERE guild_id = $1 AND user_id = $2',
        [interaction.guild.id, target.id]
    );
    if (protected.rows.length > 0) {
        return interaction.reply({
            content: `🛡️ **${target.displayName}** is protected and cannot be uwuified.`,
            ephemeral: true
        });
    }

    // Check if already uwuified
    const existing = await pool.query(
        'SELECT * FROM uwuify_active WHERE guild_id = $1 AND user_id = $2 AND channel_id = $3',
        [interaction.guild.id, target.id, interaction.channel.id]
    );
    if (existing.rows.length > 0) {
        return interaction.reply({
            content: `❌ **${target.displayName}** is already uwuified in this channel! Use \`/uwuify remove\` first.`,
            ephemeral: true
        });
    }

    await pool.query(
        'INSERT INTO uwuify_active (guild_id, user_id, mode, channel_id, started_by) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (guild_id, user_id, channel_id) DO UPDATE SET mode = $3',
        [interaction.guild.id, target.id, mode, interaction.channel.id, interaction.user.id]
    );

    return interaction.reply({
        content: `✨ **${target.displayName}** is now uwuified! (${mode} mode)\nAll their messages will be uwuified until removed with \`/uwuify remove\`.`,
    });
}

// ─── REMOVE ─────────────────────────────────────
async function handleRemove(interaction) {
    const target = interaction.options.getUser('target');

    const result = await pool.query(
        'DELETE FROM uwuify_active WHERE guild_id = $1 AND user_id = $2 AND channel_id = $3 RETURNING *',
        [interaction.guild.id, target.id, interaction.channel.id]
    );

    if (result.rows.length === 0) {
        return interaction.reply({
            content: `❌ **${target.displayName}** isn't uwuified in this channel.`,
            ephemeral: true
        });
    }

    webhookCache.delete(`${interaction.channel.id}-${target.id}`);

    return interaction.reply({
        content: `🔧 **${target.displayName}** is no longer uwuified.`,
    });
}

// ─── LIST ───────────────────────────────────────
async function handleList(interaction) {
    const result = await pool.query(
        'SELECT * FROM uwuify_active WHERE guild_id = $1',
        [interaction.guild.id]
    );

    if (result.rows.length === 0) {
        return interaction.reply({
            content: 'No one is currently uwuified in this server! ✿',
            ephemeral: true
        });
    }

    const list = result.rows.map(row => {
        const user = interaction.guild.members.cache.get(row.user_id);
        const channel = interaction.guild.channels.cache.get(row.channel_id);
        return `• **${user?.displayName || row.user_id}** in #${channel?.name || row.channel_id} (${row.mode})`;
    }).join('\n');

    return interaction.reply({
        embeds: [{
            color: 0xFFAACC,
            title: '🌸 Currently Uwuified Users',
            description: list,
            footer: { text: `Total: ${result.rows.length} user(s)` }
        }],
        ephemeral: true
    });
}

// ─── PROTECT ADD ────────────────────────────────
async function handleProtectAdd(interaction) {
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

    // Also remove from active uwuify if they were uwuified
    await pool.query(
        'DELETE FROM uwuify_active WHERE guild_id = $1 AND user_id = $2',
        [interaction.guild.id, target.id]
    );

    return interaction.reply({
        content: `🛡️ **${target.displayName}** is now protected from uwuify.`,
    });
}

// ─── PROTECT REMOVE ─────────────────────────────
async function handleProtectRemove(interaction) {
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

// ─── PROTECT LIST ───────────────────────────────
async function handleProtectList(interaction) {
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
        return `• **${user?.displayName || row.user_id}** (by ${protector?.displayName || row.protector})`;
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

// ─── MESSAGE HANDLER ────────────────────────────
async function handleMessage(message) {
    if (message.author.bot || !message.guild) return;
    if (!message.content || message.content.length === 0) return;

    // Check if protected
    const protected = await pool.query(
        'SELECT 1 FROM uwuify_protected WHERE guild_id = $1 AND user_id = $2',
        [message.guild.id, message.author.id]
    );
    if (protected.rows.length > 0) return;

    // Check if uwuified
    const result = await pool.query(
        'SELECT * FROM uwuify_active WHERE guild_id = $1 AND user_id = $2 AND channel_id = $3',
        [message.guild.id, message.author.id, message.channel.id]
    );
    if (result.rows.length === 0) return;

    const uwuData = result.rows[0];

    try {
        await message.delete().catch(() => {});

        const uwuified = uwuData.mode === 'strong' ? strongUwu(message.content) : lightUwu(message.content);
        const webhook = await getOrCreateWebhook(message.channel);
        const member = message.member;
        const displayName = member?.nickname || message.author.displayName;
        const avatar = message.author.displayAvatarURL({ dynamic: true, size: 1024 });

        await webhook.send({
            content: uwuified,
            username: uwuifyName(displayName, uwuData.mode),
            avatarURL: avatar,
            allowedMentions: { parse: [] },
        });
    } catch (error) {
        console.error('Uwuify handler error:', error);
        if (error.code === 10015) {
            await pool.query(
                'DELETE FROM uwuify_active WHERE guild_id = $1 AND user_id = $2 AND channel_id = $3',
                [message.guild.id, message.author.id, message.channel.id]
            );
        }
    }
}

// ─── WEBHOOK HELPER ────────────────────────────
async function getOrCreateWebhook(channel) {
    if (webhookCache.has(channel.id)) return webhookCache.get(channel.id);

    const webhooks = await channel.fetchWebhooks();
    let webhook = webhooks.find(wh => wh.owner?.id === channel.client.user.id);

    if (!webhook) {
        webhook = await channel.createWebhook({
            name: 'UwU Magic',
            avatar: channel.client.user.displayAvatarURL(),
        });
    }

    const client = new WebhookClient({ id: webhook.id, token: webhook.token });
    webhookCache.set(channel.id, client);
    return client;
}

// ─── NAME UWUIFIER ─────────────────────────────
function uwuifyName(name, mode) {
    if (mode === 'strong') {
        const prefixes = ['widdle ', 'wuvwy ', 'sweet ', 'pwecious ', ''];
        const suffixes = ['-chwan', '-nyan', '-bby', '-tan', '-wuv', ''];
        return `${prefixes[Math.floor(Math.random() * prefixes.length)]}${name.replace(/[rl]/gi, 'w')}${suffixes[Math.floor(Math.random() * suffixes.length)]}`;
    }
    const lightSuffixes = [' ✿', ' ♡', '-chwan', ' UwU', ''];
    return name + lightSuffixes[Math.floor(Math.random() * lightSuffixes.length)];
}

// ─── LIGHT UWU ─────────────────────────────────
function lightUwu(text) {
    let result = text;

    const replacements = {
        'the': 'da', 'you': 'u', 'your': 'ur', 'have': 'haz',
        'love': 'wuv', 'like': 'wike', 'little': 'widdle',
        'this': 'dis', 'that': 'dat', 'there': 'dere', 'think': 'dink',
        'thanks': 'danks', 'really': 'weally', 'sorry': 'sowwy',
        'hello': 'hewwo', 'hi': 'hwi', 'hey': 'hewy', 'please': 'pwease',
        'cute': 'kawaii', 'good': 'gud', 'with': 'wif', 'are': 'aw',
    };

    for (const [key, val] of Object.entries(replacements)) {
        const regex = new RegExp(`\\b${key}\\b`, 'gi');
        result = result.replace(regex, match =>
            match[0] === match[0].toUpperCase() ? val.charAt(0).toUpperCase() + val.slice(1) : val
        );
    }

    result = result.replace(/\b(\w)(\w*)/g, (_, first, rest) =>
        first + rest.replace(/[rl]/g, 'w').replace(/[RL]/g, 'W')
    );

    if (Math.random() < 0.15) result += [' ~', ' ✿', ' ♡', ' >w<', ''][Math.floor(Math.random() * 5)];

    return result;
}

// ─── STRONG UWU ────────────────────────────────
function strongUwu(text) {
    let result = lightUwu(text);

    result = result.replace(/[rl]/gi, 'w');

    result = result.replace(/[aeiou]+/gi, match => {
        if (Math.random() < 0.35) {
            const stretches = { 'a': 'aa', 'e': 'ee', 'i': 'ii', 'o': 'uwu', 'u': 'uwu' };
            const stretched = stretches[match[0].toLowerCase()] || match + match[0];
            return match[0] === match[0].toUpperCase()
                ? stretched.charAt(0).toUpperCase() + stretched.slice(1) : stretched;
        }
        return match;
    });

    result = result.replace(/n(?=[bcdfghjklmnpqrstvwxyz])/gi, () =>
        Math.random() < 0.6 ? 'ny' : 'n'
    );

    result = result.replace(/\b(\w)(\w{3,})/g, (match, first, rest) =>
        Math.random() < 0.2 ? `${first}-${first}${rest}` : match
    );

    result = result.replace(/s\b/g, () => Math.random() < 0.25 ? 'sh' : 's');

    if (Math.random() < 0.3) {
        const kaos = [
            ' (◕ᴗ◕✿)', ' (⁄ ⁄>⁄ ▽ ⁄<⁄ ⁄)', ' (｡♥‿♥｡)', ' (◡ ω ◡)',
            ' >w<', ' ;;w;;', ' uwu', ' owo', ' ฅ^•ﻌ•^ฅ',
        ];
        result += kaos[Math.floor(Math.random() * kaos.length)];
    }

    if (Math.random() < 0.2) {
        const actions = [' *blushes*', ' *wags tail*', ' *nuzzles*', ' *squeaks*', ' *purrs*', ' *bounces*', ' *giggles*'];
        result += actions[Math.floor(Math.random() * actions.length)];
    }

    if (Math.random() < 0.5) result += '~'.repeat(Math.floor(Math.random() * 3) + 1);

    result = result.replace(/!/g, () => ['!!', '!!!', '! >w<'][Math.floor(Math.random() * 3)]);
    result = result.replace(/\?/g, () => ['??', '???', '? owo'][Math.floor(Math.random() * 3)]);

    return result;
}

// Export the message handler
module.exports.handleMessage = handleMessage;
