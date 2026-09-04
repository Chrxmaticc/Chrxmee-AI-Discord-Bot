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
  angry: "<:angry_cry:1526029511882440744>",
  stage_off: "<:Stage_Channel_Off:1531901200344027158>",
  stage_on: "<:Stage_Channel_On:1531901527843668098>",
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("stage")
    .setDescription("manage stage channels and join as speaker")
    .addSubcommand(sub => sub.setName("create").setDescription("(admin) create a stage channel")
      .addStringOption(opt => opt.setName("name").setDescription("stage name").setRequired(true))
      .addChannelOption(opt => opt.setName("parent").setDescription("parent category").setRequired(false))
    )
    .addSubcommand(sub => sub.setName("delete").setDescription("(admin) delete a stage channel")
      .addChannelOption(opt => opt.setName("channel").setDescription("stage channel").setRequired(true))
    )
    .addSubcommand(sub => sub.setName("join").setDescription("join a stage channel as speaker")
      .addChannelOption(opt => opt.setName("channel").setDescription("stage channel to join").setRequired(true))
    )
    .addSubcommand(sub => sub.setName("leave").setDescription("leave current stage channel")),

  async execute(interaction) {
    const isButtonSim = interaction.isButton && interaction.isButton();
    if (!isButtonSim) {
      try { await interaction.deferReply({ ephemeral: true }); } catch { try { await interaction.deferReply(); } catch {} }
    }

    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;
    const member = interaction.member;

    const sendEmbed = async (title, description, color = 0x7c7ce0) => {
      const embed = new EmbedBuilder().setColor(color).setTitle(title).setDescription(description);
      return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
    };

    // Admin-only create/delete
    if (sub === "create" || sub === "delete") {
      if (!member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return sendEmbed(`${E.error} permission denied`, `${E.angry} you need manage channels.`, 0xff0000);
      }

      if (sub === "create") {
        const name = interaction.options.getString("name");
        const parent = interaction.options.getChannel("parent") || null;
        const stage = await guild.channels.create({
          name,
          type: ChannelType.GuildStageVoice,
          parent: parent ? parent.id : null,
          reason: "chromed stage create",
        });
        return sendEmbed(`${E.stage_on} stage created`, `${E.success} created stage **${stage.name}**.`);
      }

      if (sub === "delete") {
        const channel = interaction.options.getChannel("channel");
        if (channel.type !== ChannelType.GuildStageVoice) {
          return sendEmbed(`${E.error} not stage`, `${E.angry} that's not a stage channel.`, 0xff0000);
        }
        await channel.delete("chromed stage delete");
        return sendEmbed(`${E.stage_off} stage deleted`, `${E.success} stage deleted.`);
      }
    }

    if (sub === "join") {
      const channel = interaction.options.getChannel("channel");
      if (channel.type !== ChannelType.GuildStageVoice) {
        return sendEmbed(`${E.error} not stage`, `${E.angry} that's not a stage channel.`, 0xff0000);
      }
      try {
        await member.voice.setChannel(channel, "chromed stage join");
        return sendEmbed(`${E.stage_on} joined stage`, `${E.success} you are now in **${channel.name}**.`);
      } catch (err) {
        return sendEmbed(`${E.error} failed`, `${E.angry} ${err.message}`, 0xff0000);
      }
    }

    if (sub === "leave") {
      if (!member.voice?.channelId) {
        return sendEmbed(`${E.error} not in voice`, `${E.angry} you're not in a voice channel.`, 0xff0000);
      }
      await member.voice.disconnect("chromed stage leave");
      return sendEmbed(`${E.stage_off} left stage`, `${E.success} you left the stage.`);
    }
  },
};
