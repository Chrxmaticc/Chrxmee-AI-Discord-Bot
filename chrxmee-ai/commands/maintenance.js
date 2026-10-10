const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');

// in-memory state — swap for your db if you persist across restarts
// { [guildId]: { active: boolean, saved: { [channelId]: overwriteJSON|null } } }
const state = new Map();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Turn overwrite object → plain object we can save, or null if it was "no overwrite" */
function serialize(overwrite) {
  if (!overwrite) return null;
  return {
    id: overwrite.id,
    type: overwrite.type,
    allow: overwrite.allow.bitfield.toString(),
    deny: overwrite.deny.bitfield.toString(),
  };
}

/** Plain object → @discordjs/builders-friendly overwrite */
function deserialize(obj) {
  if (!obj) return null;
  return {
    id: obj.id,
    type: obj.type,
    allow: BigInt(obj.allow),
    deny: BigInt(obj.deny),
  };
}

/** Apply the current @everyone overwrite to a channel, forcing view_channel=false */
async function hideFromEveryone(channel, everyoneId) {
  const current = channel.permissionOverwrites.cache.get(everyoneId);

  // copy existing allow/deny, then force view off
  let allow = current ? current.allow.bitfield : 0n;
  let deny  = current ? current.deny.bitfield  : 0n;

  // remove VIEW_CHANNEL from allow, add to deny
  allow &= ~PermissionFlagsBits.ViewChannel;
  deny  |= PermissionFlagsBits.ViewChannel;

  await channel.permissionOverwrites.edit(
    everyoneId,
    { ViewChannel: false, SendMessages: null, Connect: null },
    { reason: 'maintenance: ON' }
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('maintenance')
    .setDescription('Lock or unlock the whole server')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addStringOption((o) =>
      o
        .setName('state')
        .setDescription('on = hide all channels · off = restore')
        .setRequired(true)
        .addChoices(
          { name: 'on', value: 'on' },
          { name: 'off', value: 'off' }
        )
    ),

  async execute(interaction) {
    const { guild, member } = interaction;

    // hard admin check (belt + suspenders)
    if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        content: 'admins only.',
        ephemeral: true,
      });
    }

    const me = guild.members.me;
    if (!me.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({
        content: 'i need **Manage Channels** to do this.',
        ephemeral: true,
      });
    }

    const mode = interaction.options.getString('state', true);

    // ─── TURN ON ─────────────────────────────
    if (mode === 'on') {
      const existing = state.get(guild.id);
      if (existing?.active) {
        return interaction.reply({
          content: '🔧 maintenance is already on.',
          ephemeral: true,
        });
      }

      await interaction.deferReply();

      const everyone = guild.roles.everyone;
      const saved = {};
      let done = 0;
      let skipped = 0;

      for (const channel of guild.channels.cache.values()) {
        // skip threads — they inherit
        if (
          channel.type === ChannelType.PublicThread ||
          channel.type === ChannelType.PrivateThread ||
          channel.type === ChannelType.AnnouncementThread
        ) {
          continue;
        }

        // save current state
        const current = channel.permissionOverwrites.cache.get(everyone.id);
        saved[channel.id] = serialize(current);

        try {
          await channel.permissionOverwrites.edit(
            everyone.id,
            { ViewChannel: false },
            { reason: 'maintenance: ON' }
          );
          done++;
          await sleep(350); // be nice to the rate limiter
        } catch (err) {
          skipped++;
          console.warn(`[maintenance] skipped #${channel.name}:`, err.message);
        }
      }

      state.set(guild.id, { active: true, saved });

      const embed = new EmbedBuilder()
        .setColor(0x7590dc)
        .setTitle('🔧 Maintenance Mode: ON')
        .setDescription(
          `**${done}** channels hidden from @everyone.` +
            (skipped ? `\n**${skipped}** skipped (missing perms).` : '')
        )
        .setFooter({ text: 'run /maintenance off to restore' });

      return interaction.editReply({ embeds: [embed] });
    }

    // ─── TURN OFF ────────────────────────────
    const entry = state.get(guild.id);
    if (!entry?.active) {
      return interaction.reply({
        content: 'maintenance isn’t on right now.',
        ephemeral: true,
      });
    }

    await interaction.deferReply();

    const everyone = guild.roles.everyone;
    const { saved } = entry;
    let done = 0;
    let skipped = 0;

    for (const channel of guild.channels.cache.values()) {
      if (
        channel.type === ChannelType.PublicThread ||
        channel.type === ChannelType.PrivateThread ||
        channel.type === ChannelType.AnnouncementThread
      ) {
        continue;
      }

      const prev = deserialize(saved[channel.id]);

      try {
        if (prev) {
          // restore saved overwrite exactly
          await channel.permissionOverwrites.edit(
            everyone.id,
            {
              ViewChannel: null,
              ...Object.fromEntries(
                // apply prev allow/deny directly
                []
              ),
            },
            { reason: 'maintenance: OFF' }
          );

          // safer: set the raw overwrite object
          await channel.permissionOverwrites.set(
            [
              ...channel.permissionOverwrites.cache
                .filter((o) => o.id !== everyone.id)
                .map((o) => ({
                  id: o.id,
                  allow: o.allow.bitfield,
                  deny: o.deny.bitfield,
                })),
              prev,
            ],
            'maintenance: OFF'
          );
        } else {
          // no overwrite existed before — remove the @everyone one
          await channel.permissionOverwrites.delete(
            everyone.id,
            'maintenance: OFF'
          );
        }
        done++;
        await sleep(350);
      } catch (err) {
        skipped++;
        console.warn(`[maintenance] restore failed on #${channel.name}:`, err.message);
      }
    }

    state.delete(guild.id);

    const embed = new EmbedBuilder()
      .setColor(0xd092c6)
      .setTitle('✅ Maintenance Mode: OFF')
      .setDescription(
        `**${done}** channels restored.` +
          (skipped ? `\n**${skipped}** skipped (missing perms).` : '')
      );

    return interaction.editReply({ embeds: [embed] });
  },
};
