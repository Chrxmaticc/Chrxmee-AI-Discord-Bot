const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} = require("discord.js");

const E = {
  success: "<:Verified_Icon:1527194184841167010>",
  error: "<:no:1530373946795364362>",
  ai: "<:Chrxmaticc_AI:1480094799292928132>",
  agree: "<:agreed:1525639597135237131>",
  angry: "<:angry_cry:1526029511882440744>",
  sneaky: "<:sneaky:1527401423690792970>",
  money_cry: "<:Money_Cry_Son:1526538340264841257>",
  cringe_laugh: "<:Cringe_Laughing_Son:1526539082564374710>",
  point_laugh: "<:PointAndLaughingEmoji:1525657154567016469>",
  hammer: "<:hammer:1530375976381448303>",
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("nuke")
    .setDescription("nuke this channel (clone & delete)"),

  async execute(interaction) {
    const isButtonSim = interaction.isButton && interaction.isButton();
    if (!isButtonSim) {
      try { await interaction.deferReply(); } catch {}
    }

    // permission check
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle(`${E.error} permission denied`)
        .setDescription(`${E.angry} you need **manage channels** to nuke.`);
      return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
    }

    const confirmEmbed = new EmbedBuilder()
      .setColor(0x7c7ce0)
      .setTitle(`${E.hammer} nuke channel?`)
      .setDescription(`${E.sneaky} this will **delete** <#${interaction.channelId}> and clone it fresh. all messages will be gone. are you sure?`)
      .setFooter({ text: "this cannot be undone" })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("nuke_yes")
        .setLabel("Yes")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("nuke_no")
        .setLabel("No")
        .setStyle(ButtonStyle.Secondary),
    );

    const confirmMsg = await interaction.editReply({
      embeds: [confirmEmbed],
      components: [row],
    }).catch(() => null);

    if (!confirmMsg) return;

    const filter = i => i.user.id === interaction.user.id;
    const collector = confirmMsg.createMessageComponentCollector({ filter, time: 30000, max: 1 });

    collector.on("collect", async i => {
      if (i.customId === "nuke_yes") {
        try {
          // clone the channel
          const channel = interaction.channel;
          const newChannel = await channel.clone({
            name: channel.name,
            parent: channel.parent,
            topic: channel.topic || "",
            nsfw: channel.nsfw,
            rateLimitPerUser: channel.rateLimitPerUser,
            permissionOverwrites: channel.permissionOverwrites.cache.map(po => po),
          });

          // delete old channel
          await channel.delete();

          // send success in new channel
          const successEmbed = new EmbedBuilder()
            .setColor(0x7c7ce0)
            .setTitle(`${E.success} channel nuked`)
            .setDescription(`${E.agree} ${i.user} just nuked the channel. fresh start.`)
            .setTimestamp();
          await newChannel.send({ embeds: [successEmbed] }).catch(() => {});
        } catch (err) {
          console.error("nuke error:", err);
          const errEmbed = new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle(`${E.error} nuke failed`)
            .setDescription(`${E.angry} ${err.message}`);
          await i.update({ embeds: [errEmbed], components: [] }).catch(() => {});
        }
      } else {
        await i.update({
          content: `${E.error} nuke cancelled.`,
          embeds: [],
          components: [],
        });
      }
    });

    collector.on("end", collected => {
      if (collected.size === 0) {
        confirmMsg.edit({ components: [] }).catch(() => {});
      }
    });
  },
};
