const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
} = require('discord.js');

// { [guildId]: { active: boolean, saved: { [channelId]: serializedOverwrite|null } } }
const state = new Map();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Save an existing @everyone overwrite as plain JSON, or null if none existed */
function serialize(overwrite) {
  if (!overwrite) return null;
  return {
    id: overwrite.id,
    type: overwrite.type,
    allow: overwrite.allow.bitfield.toString(),
    deny: overwrite.deny.bitfield.toString(),
  };
}

/** Which perms we force-deny on each channel type */
function lockPayload(channel) {
  const payload = { ViewChannel: false };

  switch (channel.type) {
    case ChannelType.GuildText:
    case ChannelType.GuildAnnouncement:
    case ChannelType.GuildForum:
      payload.SendMessages = false;
      payload.SendMessagesInThreads = false;
      payload.CreatePublicThreads = false;
      payload.CreatePrivateThreads = false;
      payload.AddReactions = false;
      break;

    case ChannelType.GuildVoice:
    case ChannelType.GuildStageVoice:
      payload.Connect = false;
      payload.Speak = false;
      payload.Stream = false;
      break;

    case ChannelType.GuildCategory:
      // categories only carry ViewChannel
      break;

    default:
      break;
  }

  return payload;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('maintenance')
    .setDescription('Hide and lock every channel from @everyone')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addStringOption((o) =>
      o
        .setName('state')
        .setDescription('on = hide + lock · off = restore')
        .setRequired(true)
        .addChoices(
          { name: 'on', value: 'on' },
          { name: 'off', value: 'off' }
        )
    ),

  async execute(interaction) {
    const { guild, member } = interaction;

    if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: 'admins only.', ephemeral: true });
    }

    const me = guild.members.me;
    if (!me.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({
        content: 'i need **Manage Channels** to do this.',
        ephemeral: true,
      });
    }

    const mode = interaction.options.getString('state', true);
    const everyone = guild.roles.everyone;

    // ─────────── ON ───────────
    if (mode === 'on') {
      if (state.get(guild.id)?.active) {
        return interaction.reply({
          content: '🔧 maintenance is already on.',
          ephemeral: true,
        });
      }

      await interaction.deferReply();

      const saved = {};
      let done = 0;
      let skipped = 0;

      for (const channel of guild.channels.cache.values()) {
        if (
          channel.type === ChannelType.PublicThread ||
          channel.type === ChannelType.PrivateThread ||
          channel.type === ChannelType.AnnouncementThread
        ) continue;

        // snapshot the pre-maintenance overwrite
        const current = channel.permissionOverwrites.cache.get(everyone.id);
        saved[channel.id] = serialize(current);

        try {
          await channel.permissionOverwrites.edit(
            everyone.id,
            lockPayload(channel),
            { reason: 'maintenance: ON' }
          );
          done++;
          await sleep(350);
        } catch (err) {
          skipped++;
          console.warn(`[maintenance] skipped #${channel.name}: ${err.message}`);
        }
      }

      state.set(guild.id, { active: true, saved });

      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x7590dc)
            .setTitle('🔧 Maintenance Mode: ON')
            .setDescription(
              `**${done}** channels hidden + locked from @everyone.` +
                (skipped ? `\n**${skipped}** skipped (missing perms).` : '')
            )
            .setFooter({ text: 'run /maintenance off to restore' }),
        ],
      });
    }

    // ─────────── OFF ───────────
    const entry = state.get(guild.id);
    if (!entry?.active) {
      return interaction.reply({
        content: 'maintenance isn’t on right now.',
        ephemeral: true,
      });
    }

    await interaction.deferReply();

    const { saved } = entry;
    let done = 0;
    let skipped = 0;

    for (const channel of guild.channels.cache.values()) {
      if (
        channel.type === ChannelType.PublicThread ||
        channel.type === ChannelType.PrivateThread ||
        channel.type === ChannelType.AnnouncementThread
      ) continue;

      const prev = saved[channel.id];

      try {
        if (prev) {
          // keep every other role's overwrite, restore @everyone's exactly
          const others = channel.permissionOverwrites.cache
            .filter((o) => o.id !== everyone.id)
            .map((o) => ({
              id: o.id,
              allow: o.allow.bitfield,
              deny: o.deny.bitfield,
            }));

          await channel.permissionOverwrites.set(
            [
              ...others,
              {
                id: prev.id,
                type: prev.type,
                allow: BigInt(prev.allow),
                deny: BigInt(prev.deny),
              },
            ],
            'maintenance: OFF'
          );
        } else {
          // no overwrite existed before → remove the one we added
          await channel.permissionOverwrites.delete(
            everyone.id,
            'maintenance: OFF'
          );
        }
        done++;
        await sleep(350);
      } catch (err) {
        skipped++;
        console.warn(`[maintenance] restore failed on #${channel.name}: ${err.message}`);
      }
    }

    state.delete(guild.id);

    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xd092c6)
          .setTitle('✅ Maintenance Mode: OFF')
          .setDescription(
            `**${done}** channels restored.` +
              (skipped ? `\n**${skipped}** skipped (missing perms).` : '')
          ),
      ],
    });
  },
};
