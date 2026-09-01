const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

const E = {
  success: "<:Verified_Icon:1527194184841167010>",
  error: "<:no:1530373946795364362>",
  ai: "<:Chrxmaticc_AI:1480094799292928132>",
  angry: "<:angry_cry:1526029511882440744>",
  crown: "<:Holographic_owner_crown:1527401510487461969>",
  sneaky: "<:sneaky:1527401423690792970>",
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("leave")
    .setDescription("make chromed leave a server (owner only)")
    .addStringOption(opt =>
      opt.setName("guild_id")
        .setDescription("server id to leave")
        .setRequired(true)
    ),

  async execute(interaction) {
    const isButtonSim = interaction.isButton && interaction.isButton();
    if (!isButtonSim) {
      try { await interaction.deferReply(); } catch {}
    }

    // owner check
    const ownerIds = [process.env.OWNER_ID, process.env.OWNER_ID2].filter(Boolean);
    if (!ownerIds.includes(interaction.user.id)) {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle(`${E.error} owner only`)
        .setDescription(`${E.angry} you can't use this command.`);
      return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
    }

    const guildId = interaction.options.getString("guild_id");
    const guild = interaction.client.guilds.cache.get(guildId);

    if (!guild) {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle(`${E.error} not found`)
        .setDescription(`${E.angry} chromed isn't in a server with that id.`);
      return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
    }

    try {
      const guildName = guild.name;
      await guild.leave();

      const embed = new EmbedBuilder()
        .setColor(0x7c7ce0)
        .setTitle(`${E.success} left server`)
        .setDescription(`${E.sneaky} chromed has left **${guildName}** (${guildId}).`)
        .setFooter({ text: "goodbye" })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
    } catch (err) {
      console.error("leave command error:", err);
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle(`${E.error} failed to leave`)
        .setDescription(`${E.angry} ${err.message}`);
      return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
    }
  },
};
