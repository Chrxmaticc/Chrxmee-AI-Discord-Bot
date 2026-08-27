const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require("discord.js");

const E = {
  success: "<:Verified_Icon:1527194184841167010>",
  error: "<:no:1530373946795364362>",
  ai: "<:Chrxmaticc_AI:1480094799292928132>",
  angry: "<:angry_cry:1526029511882440744>",
  sneaky: "<:sneaky:1527401423690792970>",
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("quietlock")
    .setDescription("lock a user into silence (they just say ...)")
    .addUserOption(opt =>
      opt.setName("user")
        .setDescription("who to silence")
        .setRequired(true)
    )
    .addIntegerOption(opt =>
      opt.setName("minutes")
        .setDescription("how long (default 5)")
        .setRequired(false)
    ),

  async execute(interaction) {
    const isButtonSim = interaction.isButton && interaction.isButton();
    if (!isButtonSim) {
      try { await interaction.deferReply(); } catch {}
    }

    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return interaction.editReply(`${E.error} you need manage messages to quietlock someone.`);
    }

    const target = interaction.options.getUser("user");
    const minutes = interaction.options.getInteger("minutes") || 5;
    const userId = target.id;
    const guildId = interaction.guildId;

    // store in memory
    if (!interaction.client.quietLocks) interaction.client.quietLocks = new Map();
    const until = Date.now() + minutes * 60000;
    interaction.client.quietLocks.set(`${guildId}-${userId}`, {
      until,
      username: target.username,
      avatar: target.displayAvatarURL({ extension: "png", size: 128 }),
    });

    const embed = new EmbedBuilder()
      .setColor(0x7c7ce0)
      .setTitle(`${E.sneaky} quietlock activated`)
      .setDescription(`${E.success} **${target.username}** is now quietlocked for **${minutes} minutes**. they can only say "..."`)
      .setFooter({ text: "silence is golden" })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
  },
};
