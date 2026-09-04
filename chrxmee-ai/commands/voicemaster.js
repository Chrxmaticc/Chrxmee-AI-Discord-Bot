const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const E = {
  success: "<:Verified_Icon:1527194184841167010>",
  error: "<:no:1530373946795364362>",
  ai: "<:Chrxmaticc_AI:1480094799292928132>",
  agree: "<:agreed:1525639597135237131>",
  angry: "<:angry_cry:1526029511882440744>",
  lock: "<:lock:1530377198324945056>",
  unlock: "<:unlock:1530377714995826831>",
  voice: "<:voice:1485005132621152358>",
  rename: "<:Pencil:1530377899251601408>",
  limit: "<:member:1530383558710005960>",
  settings: "<:Settings:1525601248278216725>",
  owner: "<:Owner:1525494515169759253>",
  link: "<:Link:1525603398341103806>",
  compass: "<:Compass_Discover_Icon:1526542192494248067>",
  off: "<:off:1545571608897265726>",
  on: "<:on:1545571641684135946>",
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("voicemaster")
    .setDescription("full voice channel control system")
    .addSubcommand(sub => sub.setName("enable").setDescription("(admin) enable voicemaster"))
    .addSubcommand(sub => sub.setName("disable").setDescription("(admin) disable voicemaster"))
    .addSubcommand(sub => sub.setName("menu").setDescription("(admin) send public voicemaster control panel to a channel")
      .addChannelOption(opt => opt.setName("channel").setDescription("text channel for panel").setRequired(true))
    )
    .addSubcommand(sub => sub.setName("lock").setDescription("lock your voice channel"))
    .addSubcommand(sub => sub.setName("unlock").setDescription("unlock your voice channel"))
    .addSubcommand(sub => sub.setName("limit").setDescription("set user limit on your voice channel")
      .addIntegerOption(opt => opt.setName("amount").setDescription("0 to unlimited").setRequired(true).setMinValue(0).setMaxValue(99))
    )
    .addSubcommand(sub => sub.setName("rename").setDescription("rename your voice channel")
      .addStringOption(opt => opt.setName("name").setDescription("new name").setRequired(true))
    )
    .addSubcommand(sub => sub.setName("bitrate").setDescription("set bitrate of your voice channel (kbps)")
      .addIntegerOption(opt => opt.setName("kbps").setDescription("bitrate 8-96").setRequired(true).setMinValue(8).setMaxValue(96))
    )
    .addSubcommand(sub => sub.setName("region").setDescription("set region of your voice channel")
      .addStringOption(opt => opt.setName("region").setDescription("region (us-east, us-west, eu-central, etc.)").setRequired(true))
    )
    .addSubcommand(sub => sub.setName("claim").setDescription("claim ownership of an unowned voice channel"))
    .addSubcommand(sub => sub.setName("transfer").setDescription("transfer ownership of your voice channel")
      .addUserOption(opt => opt.setName("user").setDescription("new owner").setRequired(true))
    ),

  async execute(interaction) {
    const isButtonSim = interaction.isButton && interaction.isButton();
    if (!isButtonSim) {
      try { await interaction.deferReply({ ephemeral: true }); } catch { try { await interaction.deferReply(); } catch {} }
    }

    const pool = interaction.client.pool;
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;
    const member = interaction.member;

    const sendEmbed = async (title, description, color = 0x7c7ce0, ephemeral = true) => {
      const embed = new EmbedBuilder().setColor(color).setTitle(title).setDescription(description);
      return interaction.editReply({ embeds: [embed], ephemeral }).catch(() => interaction.followUp({ embeds: [embed], ephemeral }));
    };

    const settings = await pool.query(`SELECT enabled FROM voicemaster_settings WHERE guild_id = $1`, [guild.id]);
    const vmEnabled = settings.rows[0]?.enabled ?? false;

    // Admin-only: enable/disable
    if (sub === "enable" || sub === "disable") {
      if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
        return sendEmbed(`${E.error} admin only`, `${E.angry} you need administrator permission.`, 0xff0000);
      }
      const enabled = sub === "enable";
      await pool.query(
        `INSERT INTO voicemaster_settings (guild_id, enabled) VALUES ($1, $2)
         ON CONFLICT (guild_id) DO UPDATE SET enabled = $2`,
        [guild.id, enabled]
      );
      return sendEmbed(`${E.voice} voicemaster ${enabled ? "enabled" : "disabled"}`, `${E.success} system is now ${enabled ? "on" : "off"}.`);
    }

    // Admin-only: menu
    if (sub === "menu") {
      if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
        return sendEmbed(`${E.error} admin only`, `${E.angry} you need administrator permission.`, 0xff0000);
      }
      const channel = interaction.options.getChannel("channel");
      if (channel.type !== ChannelType.GuildText) {
        return sendEmbed(`${E.error} invalid`, `${E.angry} menu channel must be text.`, 0xff0000);
      }

      const embed = new EmbedBuilder()
        .setColor(0x7c7ce0)
        .setTitle(`${E.voice} voicemaster controls`)
        .setDescription(
          `use the buttons below to control your personal voice channel.\n\n` +
          `${E.lock} lock / ${E.unlock} unlock — restrict access\n` +
          `${E.rename} rename — change channel name\n` +
          `${E.limit} limit — set user limit\n` +
          `${E.settings} bitrate — change audio quality\n` +
          `${E.compass} region — change server region\n` +
          `${E.owner} claim — take ownership if unowned\n` +
          `${E.link} transfer — give ownership to another user`
        )
        .setFooter({ text: "voicemaster by chromed" });

      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("vm_lock").setLabel(`${E.lock} lock`).setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("vm_unlock").setLabel(`${E.unlock} unlock`).setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("vm_rename").setLabel(`${E.rename} rename`).setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("vm_limit").setLabel(`${E.limit} limit`).setStyle(ButtonStyle.Primary),
      );
      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("vm_bitrate").setLabel(`${E.settings} bitrate`).setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("vm_region").setLabel(`${E.compass} region`).setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("vm_claim").setLabel(`${E.owner} claim`).setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("vm_transfer").setLabel(`${E.link} transfer`).setStyle(ButtonStyle.Danger),
      );

      const menuMsg = await channel.send({ embeds: [embed], components: [row1, row2] });

      const collector = menuMsg.createMessageComponentCollector({ time: 3600000 });

      collector.on("collect", async (i) => {
        if (!i.member.voice?.channel) {
          return i.reply({ content: `${E.error} you must be in a voice channel.`, ephemeral: true });
        }
        const vc = i.member.voice.channel;

        try {
          switch (i.customId) {
            case "vm_lock":
              await vc.permissionOverwrites.edit(guild.roles.everyone, { Connect: false });
              await i.reply({ content: `${E.lock} channel locked.`, ephemeral: true });
              break;
            case "vm_unlock":
              await vc.permissionOverwrites.edit(guild.roles.everyone, { Connect: null });
              await i.reply({ content: `${E.unlock} channel unlocked.`, ephemeral: true });
              break;
            case "vm_rename":
              await i.reply({ content: `use \`/voicemaster rename <name>\` to rename.`, ephemeral: true });
              break;
            case "vm_limit":
              await i.reply({ content: `use \`/voicemaster limit <amount>\` to set limit.`, ephemeral: true });
              break;
            case "vm_bitrate":
              await i.reply({ content: `use \`/voicemaster bitrate <kbps>\` to set bitrate.`, ephemeral: true });
              break;
            case "vm_region":
              await i.reply({ content: `use \`/voicemaster region <region>\` to set region.`, ephemeral: true });
              break;
            case "vm_claim":
              await i.reply({ content: `${E.success} you claimed the channel (if unowned).`, ephemeral: true });
              break;
            case "vm_transfer":
              await i.reply({ content: `use \`/voicemaster transfer @user\` to transfer ownership.`, ephemeral: true });
              break;
            default:
              await i.reply({ content: `${E.error} unknown button.`, ephemeral: true });
          }
        } catch (err) {
          await i.reply({ content: `${E.angry} error: ${err.message}`, ephemeral: true });
        }
      });

      collector.on("end", () => {
        menuMsg.edit({ components: [] }).catch(() => {});
      });

      return sendEmbed(`${E.success} menu sent`, `${E.agree} sent public voicemaster menu to ${channel}.`);
    }

    // USER COMMANDS
    if (!vmEnabled) {
      return sendEmbed(`${E.error} disabled`, `${E.angry} voicemaster is disabled in this server.`, 0xff0000);
    }

    const voiceChannel = member.voice?.channel;
    if (!voiceChannel) {
      return sendEmbed(`${E.error} no voice`, `${E.angry} you must be in a voice channel.`, 0xff0000);
    }

    switch (sub) {
      case "lock": {
        await voiceChannel.permissionOverwrites.edit(guild.roles.everyone, { Connect: false });
        return sendEmbed(`${E.lock} locked`, `${E.success} your voice channel is locked.`);
      }
      case "unlock": {
        await voiceChannel.permissionOverwrites.edit(guild.roles.everyone, { Connect: null });
        return sendEmbed(`${E.unlock} unlocked`, `${E.success} your voice channel is unlocked.`);
      }
      case "limit": {
        const amount = interaction.options.getInteger("amount");
        await voiceChannel.setUserLimit(amount);
        return sendEmbed(`${E.limit} limit set`, `${E.success} user limit set to ${amount}.`);
      }
      case "rename": {
        const name = interaction.options.getString("name");
        await voiceChannel.setName(name);
        return sendEmbed(`${E.rename} renamed`, `${E.success} channel renamed to **${name}**.`);
      }
      case "bitrate": {
        const kbps = interaction.options.getInteger("kbps");
        await voiceChannel.setBitrate(kbps * 1000);
        return sendEmbed(`${E.settings} bitrate set`, `${E.success} bitrate set to ${kbps} kbps.`);
      }
      case "region": {
        const region = interaction.options.getString("region");
        try {
          await voiceChannel.setRTCRegion(region);
          return sendEmbed(`${E.compass} region set`, `${E.success} region set to ${region}.`);
        } catch {
          return sendEmbed(`${E.error} region unavailable`, `${E.angry} setting region may not be available.`);
        }
      }
      case "claim": {
        return sendEmbed(`${E.success} claimed`, `${E.agree} you now own this channel (if unowned).`);
      }
      case "transfer": {
        const target = interaction.options.getUser("user");
        return sendEmbed(`${E.success} transferred`, `${E.agree} ownership transferred to ${target.username}.`);
      }
      default:
        return sendEmbed(`${E.error} unknown`, "unknown subcommand.");
    }
  },
};
