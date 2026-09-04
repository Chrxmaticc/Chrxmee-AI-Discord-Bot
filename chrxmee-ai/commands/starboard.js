const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
} = require("discord.js");

const E = {
  success: "<:Verified_Icon:1527194184841167010>",
  error: "<:no:1530373946795364362>",
  ai: "<:Chrxmaticc_AI:1480094799292928132>",
  agree: "<:agreed:1525639597135237131>",
  angry: "<:angry_cry:1526029511882440744>",
  star: "<:Star:1545563186017607732>",
  channel: "<:Channel:1531901854361849929>",
  forum: "<:Forum:1531902590315397190>",
  threads: "<:Threads:1531902029113327678>",
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("starboard")
    .setDescription("link starboard channels to sources")
    .addSubcommand(sub => sub.setName("setup").setDescription("set the starboard channel and settings")
      .addChannelOption(opt => opt.setName("channel").setDescription("starboard channel (text)").setRequired(true))
      .addStringOption(opt => opt.setName("emoji").setDescription("star emoji").setRequired(false))
      .addIntegerOption(opt => opt.setName("threshold").setDescription("reactions needed (default 3)").setRequired(false).setMinValue(1))
    )
    .addSubcommand(sub => sub.setName("apply").setDescription("link a source channel, forum, or thread to a starboard")
      .addChannelOption(opt => opt.setName("source").setDescription("source channel/forum/thread").setRequired(true))
      .addChannelOption(opt => opt.setName("starboard").setDescription("starboard channel (optional, uses default if not set)").setRequired(false))
    )
    .addSubcommand(sub => sub.setName("remove").setDescription("remove a starboard link")
      .addChannelOption(opt => opt.setName("source").setDescription("source channel/forum/thread").setRequired(true))
    )
    .addSubcommand(sub => sub.setName("list").setDescription("list all starboard links and default settings")
    ),

  async execute(interaction) {
    const isButtonSim = interaction.isButton && interaction.isButton();
    if (!isButtonSim) {
      try { await interaction.deferReply(); } catch {}
    }

    const pool = interaction.client.pool;
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    const sendEmbed = async (title, description, color = 0x7c7ce0) => {
      const embed = new EmbedBuilder().setColor(color).setTitle(title).setDescription(description);
      return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
    };

    // permission check
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return sendEmbed(`${E.error} permission denied`, `${E.angry} you need **manage channels** permission.`, 0xff0000);
    }

    try {
      // Setup default starboard
      if (sub === "setup") {
        const channel = interaction.options.getChannel("channel");
        const emoji = interaction.options.getString("emoji") || "<:Star:1545563186017607732>";
        const threshold = interaction.options.getInteger("threshold") || 3;

        if (channel.type !== ChannelType.GuildText) {
          return sendEmbed(`${E.error} invalid channel`, `${E.angry} starboard must be a text channel.`, 0xff0000);
        }

        await pool.query(`
          INSERT INTO starboard_settings (guild_id, starboard_channel_id, emoji, threshold)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (guild_id) DO UPDATE SET
            starboard_channel_id = $2,
            emoji = $3,
            threshold = $4
        `, [guildId, channel.id, emoji, threshold]);

        return sendEmbed(`${E.star} starboard setup`, `${E.success} default starboard set to <#${channel.id}> with emoji ${emoji} and threshold ${threshold}.`);
      }

      // Apply link
      if (sub === "apply") {
        const source = interaction.options.getChannel("source");
        const starboardChannel = interaction.options.getChannel("starboard") || null;

        // If no starboard specified, use default from settings
        if (!starboardChannel) {
          const settings = await pool.query(
            `SELECT starboard_channel_id FROM starboard_settings WHERE guild_id = $1`,
            [guildId]
          );
          if (!settings.rows[0]?.starboard_channel_id) {
            return sendEmbed(`${E.error} no default`, `${E.angry} set a default starboard first with /starboard setup.`, 0xff0000);
          }
          const defaultChannelId = settings.rows[0].starboard_channel_id;
          await pool.query(
            `INSERT INTO starboard_links (guild_id, source_id, starboard_channel_id)
             VALUES ($1, $2, $3)
             ON CONFLICT (guild_id, source_id) DO UPDATE SET starboard_channel_id = $3`,
            [guildId, source.id, defaultChannelId]
          );
          return sendEmbed(`${E.star} starboard linked`, `${E.success} linked <#${source.id}> to default starboard <#${defaultChannelId}>.`);
        }

        if (starboardChannel.type !== ChannelType.GuildText) {
          return sendEmbed(`${E.error} invalid starboard`, `${E.angry} starboard must be a text channel.`, 0xff0000);
        }

        await pool.query(
          `INSERT INTO starboard_links (guild_id, source_id, starboard_channel_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (guild_id, source_id) DO UPDATE SET starboard_channel_id = $3`,
          [guildId, source.id, starboardChannel.id]
        );

        return sendEmbed(`${E.star} starboard linked`, `${E.success} linked <#${source.id}> to starboard <#${starboardChannel.id}>.`);
      }

      // Remove link
      if (sub === "remove") {
        const source = interaction.options.getChannel("source");
        const result = await pool.query(
          `DELETE FROM starboard_links WHERE guild_id = $1 AND source_id = $2 RETURNING *`,
          [guildId, source.id]
        );
        if (result.rows.length === 0) {
          return sendEmbed(`${E.error} not linked`, `${E.angry} that source isn't linked to any starboard.`, 0xff0000);
        }
        return sendEmbed(`${E.star} starboard removed`, `${E.success} removed starboard link for <#${source.id}>.`);
      }

      // List
      if (sub === "list") {
        const [settings, links] = await Promise.all([
          pool.query(`SELECT * FROM starboard_settings WHERE guild_id = $1`, [guildId]),
          pool.query(`SELECT * FROM starboard_links WHERE guild_id = $1`, [guildId]),
        ]);

        const embed = new EmbedBuilder()
          .setColor(0x7c7ce0)
          .setTitle(`${E.star} starboard config`)
          .addFields(
            { name: "default starboard", value: settings.rows[0]?.starboard_channel_id ? `<#${settings.rows[0].starboard_channel_id}>` : "not set", inline: true },
            { name: "emoji", value: settings.rows[0]?.emoji || "<:Star:1545563186017607732>", inline: true },
            { name: "threshold", value: settings.rows[0]?.threshold || 3, inline: true },
            { name: "linked sources", value: links.rows.length ? links.rows.map(r => `<#${r.source_id}> → <#${r.starboard_channel_id}>`).join("\n") : "none", inline: false }
          );
        return interaction.editReply({ embeds: [embed] });
      }

      return sendEmbed(`${E.error} unknown`, "unknown subcommand.");
    } catch (err) {
      console.error("starboard command error:", err);
      return sendEmbed(`${E.error} error`, `${E.angry} ${err.message}`, 0xff0000);
    }
  },
};
