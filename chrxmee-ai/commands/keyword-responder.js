const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

function isMod(interaction) {
  return interaction.member && (
    interaction.member.permissions.has(PermissionFlagsBits.ManageMessages) ||
    interaction.member.permissions.has(PermissionFlagsBits.Administrator)
  );
}

function getKeywords(client, guildId) {
  return client.memory.get(`keywords_${guildId}`) || {};
}

function saveKeywords(client, guildId, keywords) {
  client.memory.set(`keywords_${guildId}`, keywords);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('keyword-responder')
    .setDescription('Manage keyword auto-responses')
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Add a keyword response')
        .addStringOption(opt => opt.setName('keyword').setDescription('The keyword to listen for').setRequired(true))
        .addStringOption(opt => opt.setName('message').setDescription('What the bot should say').setRequired(true))
        .addStringOption(opt => opt.setName('match').setDescription('Match type').setRequired(false)
          .addChoices(
            { name: '🔍 Contains (anywhere in message)', value: 'contains' },
            { name: '🎯 Exact match only', value: 'exact' }
          ))
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove a keyword response')
        .addStringOption(opt => opt.setName('keyword').setDescription('Keyword to remove').setRequired(true))
    )
    .addSubcommand(sub => sub.setName('list').setDescription('List all keyword responses'))
    .addSubcommand(sub => sub.setName('clear').setDescription('Clear ALL keyword responses for this server')),

  async execute(interaction, client) {
    if (!isMod(interaction)) return interaction.reply({ content: '❌ You need **Manage Messages** or **Administrator** permission.', ephemeral: true });

    await interaction.deferReply({ ephemeral: true });

    const guildId = interaction.guild.id;
    const sub = interaction.options.getSubcommand();
    const keywords = getKeywords(client, guildId);

    if (sub === 'add') {
      const keyword = interaction.options.getString('keyword').toLowerCase().trim();
      const message = interaction.options.getString('message');
      const match = interaction.options.getString('match') || 'contains';
      keywords[keyword] = { message, match };
      saveKeywords(client, guildId, keywords);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#00ff00').setTitle('✅ Keyword Added!')
        .addFields(
          { name: '🔑 Keyword', value: `\`${keyword}\``, inline: true },
          { name: '🎯 Match Type', value: match === 'exact' ? '🎯 Exact' : '🔍 Contains', inline: true },
          { name: '💬 Response', value: message, inline: false }
        )] });
    }

    if (sub === 'remove') {
      const keyword = interaction.options.getString('keyword').toLowerCase().trim();
      if (!keywords[keyword]) return interaction.editReply(`❌ No keyword **${keyword}** found!`);
      delete keywords[keyword];
      saveKeywords(client, guildId, keywords);
      return interaction.editReply(`✅ Keyword **${keyword}** removed!`);
    }

    if (sub === 'list') {
      const entries = Object.entries(keywords);
      if (entries.length === 0) return interaction.editReply('📋 No keywords set! Use `/keyword-responder add` to add one.');
      const lines = entries.map(([kw, val]) => `\`${kw}\` — ${val.match === 'exact' ? '🎯 Exact' : '🔍 Contains'} → ${val.message.slice(0, 50)}${val.message.length > 50 ? '...' : ''}`).join('\n');
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#2f3136').setTitle(`📋 Keyword Responses (${entries.length})`).setDescription(lines)] });
    }

    if (sub === 'clear') {
      saveKeywords(client, guildId, {});
      return interaction.editReply('✅ All keyword responses cleared!');
    }
  },

  // ── ADDING THIS NEXT ─────────────────────────────────
  // Message fires in MessageCreate.js. Which yeah. (Note by Chrxmee_Midnightt)
  // const { handleKeywords } = require('./commands/keyword-responder');
  // client.on('messageCreate', msg => handleKeywords(msg, client));

  handleKeywords: async function(msg, client) {
    if (msg.author.bot || !msg.guild) return;
    const keywords = getKeywords(client, msg.guild.id);
    if (Object.keys(keywords).length === 0) return;

    const content = msg.content.toLowerCase();

    for (const [keyword, val] of Object.entries(keywords)) {
      let matched = false;
      if (val.match === 'exact') {
        matched = content === keyword;
      } else {
        matched = content.includes(keyword);
      }
      if (matched) {
        await msg.reply(val.message).catch(() => {});
        break; // only fire first match.
      }
    }
  }
};
