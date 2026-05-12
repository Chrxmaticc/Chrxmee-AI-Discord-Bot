const { SlashCommandBuilder, WebhookClient, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { Pool } = require('pg');

// PostgreSQL connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Initialize table
pool.query(`
    CREATE TABLE IF NOT EXISTS uwuify_active (
        guild_id TEXT,
        user_id TEXT,
        mode TEXT,
        webhook_id TEXT,
        webhook_token TEXT,
        channel_id TEXT,
        started_by TEXT,
        started_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (guild_id, user_id, channel_id)
    )
`);

// Webhook cache
const webhookCache = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('uwuify')
        .setDescription('Persistent UwU system - uwuifies all messages until removed')
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
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('Stop uwuifying a user')
                .addUserOption(opt =>
                    opt.setName('target')
                        .setDescription('Who to remove UwU from?')
                        .setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('List all currently uwuified users in this server')),

    async execute(interaction) {
        // ─── PERMISSION CHECKS ───────────────────
        
        // Check if user has Manage Messages
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return interaction.reply({
                content: '❌ You need **Manage Messages** permission to use this command.',
                ephemeral: true
            });
        }

        // Check if bot has Manage Webhooks
        if (!interaction.channel.permissionsFor(interaction.guild.members.me).has('ManageWebhooks')) {
            return interaction.reply({
                content: '❌ I need **Manage Webhooks** permission for this command to work.',
                ephemeral: true
            });
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'apply') {
            await handleApply(interaction);
        } else if (subcommand === 'remove') {
            await handleRemove(interaction);
        } else if (subcommand === 'list') {
            await handleList(interaction);
        }
    }
};

// ─── APPLY UWUIFY ──────────────────────────────
async function handleApply(interaction) {
    const target = interaction.options.getUser('target');
    const mode = interaction.options.getString('mode');

    // Check if already uwuified in this channel
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

    await interaction.reply({
        content: `✨ **${target.displayName}** is now uwuified! (${mode} mode)\nAll their messages will be uwuified until removed with \`/uwuify remove\`.`,
    });

    // Store in database
    await pool.query(
        'INSERT INTO uwuify_active (guild_id, user_id, mode, channel_id, started_by) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (guild_id, user_id, channel_id) DO UPDATE SET mode = $3',
        [interaction.guild.id, target.id, mode, interaction.channel.id, interaction.user.id]
    );
}

// ─── REMOVE UWUIFY ─────────────────────────────
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

    // Clean up webhook cache
    const key = `${interaction.channel.id}-${target.id}`;
    webhookCache.delete(key);

    await interaction.reply({
        content: `🔧 **${target.displayName}** is no longer uwuified. Their messages will return to normal.`,
    });
}

// ─── LIST UWUIFIED USERS ───────────────────────
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
        const startedBy = interaction.guild.members.cache.get(row.started_by);
        return `• **${user?.displayName || row.user_id}** in #${channel?.name || row.channel_id} (${row.mode}) — uwuified by ${startedBy?.displayName || row.started_by}`;
    }).join('\n');

    await interaction.reply({
        embeds: [{
            color: 0xFFAACC,
            title: '🌸 Currently Uwuified Users',
            description: list,
            footer: { text: `Total: ${result.rows.length} user(s)` }
        }],
        ephemeral: true
    });
}

// ─── MESSAGE HANDLER (export for messageCreate event) ───
async function handleMessage(message) {
    // Ignore bots and DMs
    if (message.author.bot || !message.guild) return;
    if (!message.content || message.content.length === 0) return;

    // Check if this user is uwuified in this channel
    const result = await pool.query(
        'SELECT * FROM uwuify_active WHERE guild_id = $1 AND user_id = $2 AND channel_id = $3',
        [message.guild.id, message.author.id, message.channel.id]
    );

    if (result.rows.length === 0) return;

    const uwuData = result.rows[0];

    try {
        // Delete original message
        await message.delete().catch(() => {});

        // Uwuify the text
        const uwuified = uwuData.mode === 'strong' ? strongUwu(message.content) : lightUwu(message.content);

        // Get or create webhook
        const webhook = await getOrCreateWebhook(message.channel);

        // Get member for name/avatar
        const member = message.member;
        const displayName = member?.nickname || message.author.displayName;
        const avatar = message.author.displayAvatarURL({ dynamic: true, size: 1024 });

        // Send uwuified message
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
    if (webhookCache.has(channel.id)) {
        return webhookCache.get(channel.id);
    }

    const webhooks = await channel.fetchWebhooks();
    let webhook = webhooks.find(wh => wh.owner?.id === channel.client.user.id);

    if (!webhook) {
        webhook = await channel.createWebhook({
            name: 'UwUifying Magic',
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
        const prefixes = ['widdle ', 'wuvwy ', 'sweet ', 'pwecious ', 'wittle ', 'kawaii ', ''];
        const suffixes = ['-chwan', '-nyan', '-bby', '-tan', '-pew', '-wuv', '-kwn', ''];
        const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
        const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
        return `${prefix}${name.replace(/[rl]/gi, 'w')}${suffix}`;
    }
    const lightSuffixes = [' ✿', ' ♡', '-chwan', ' UwU', '-wuv', ''];
    return name + lightSuffixes[Math.floor(Math.random() * lightSuffixes.length)];
}

// ─── LIGHT UWU ─────────────────────────────────
function lightUwu(text) {
    let result = text;

    const replacements = {
        'the': 'da', 'you': 'u', 'your': 'ur', 'have': 'haz',
        'love': 'wuv', 'like': 'wike', 'little': 'widdle',
        'this': 'dis', 'that': 'dat', 'there': 'dere', 'think': 'dink',
        'thanks': 'danks', 'thank': 'dank', 'really': 'weally',
        'sorry': 'sowwy', 'hello': 'hewwo', 'hi': 'hwi', 'hey': 'hewy',
        'please': 'pwease', 'cute': 'kawaii', 'good': 'gud',
        'with': 'wif', 'are': 'aw', 'just': 'jusht',
    };

    for (const [key, val] of Object.entries(replacements)) {
        const regex = new RegExp(`\\b${key}\\b`, 'gi');
        result = result.replace(regex, match =>
            match[0] === match[0].toUpperCase() ? val.charAt(0).toUpperCase() + val.slice(1) : val
        );
    }

    result = result.replace(/\b(\w)(\w*)/g, (_, first, rest) => {
        return first + rest.replace(/[rl]/g, 'w').replace(/[RL]/g, 'W');
    });

    if (Math.random() < 0.15) {
        result += [' ~', ' ✿', ' ♡', ' >w<', ''][Math.floor(Math.random() * 5)];
    }

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
                ? stretched.charAt(0).toUpperCase() + stretched.slice(1)
                : stretched;
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
        const actions = [
            ' *blushes*', ' *wags tail*', ' *nuzzles*', ' *squeaks*',
            ' *purrs*', ' *bounces*', ' *giggles*',
        ];
        result += actions[Math.floor(Math.random() * actions.length)];
    }

    if (Math.random() < 0.5) result += '~'.repeat(Math.floor(Math.random() * 3) + 1);

    result = result.replace(/!/g, () => ['!!', '!!!', '! >w<'][Math.floor(Math.random() * 3)]);
    result = result.replace(/\?/g, () => ['??', '???', '? owo'][Math.floor(Math.random() * 3)]);

    return result;
}

// Export the message handler
module.exports.handleMessage = handleMessage;
