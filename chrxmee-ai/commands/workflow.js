const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

const E = {
  success: "<:Verified_Icon:1527194184841167010>",
  error: "<:no:1530373946795364362>",
  ai: "<:Chrxmaticc_AI:1480094799292928132>",
  agree: "<:agreed:1525639597135237131>",
  angry: "<:angry_cry:1526029511882440744>",
  off: "<:off:1545571608897265726>",
  on: "<:on:1545571641684135946>",
};

const WORKFLOWS = {
  chat: { label: "chat", emoji: "<:white_chat:1447495889148051496>" },
  code: { label: "code", emoji: "<:developer:1484984805979586752>" },
  vision: { label: "vision", emoji: "<:eYeS:1532942946561953873>" },
  think: { label: "think", emoji: "<:b_think:1285855208626192455>" },
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("workflow")
    .setDescription("set your ai workflow")
    .addStringOption(opt =>
      opt.setName("type")
        .setDescription("choose workflow")
        .setRequired(true)
        .addChoices(
          { name: "chat", value: "chat" },
          { name: "code", value: "code" },
          { name: "vision", value: "vision" },
          { name: "think", value: "think" }
        )
    ),

  async execute(interaction) {
    const isButtonSim = interaction.isButton && interaction.isButton();
    if (!isButtonSim) {
      try { await interaction.deferReply({ ephemeral: true }); } catch { try { await interaction.deferReply(); } catch {} }
    }

    const workflow = interaction.options.getString("type");
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const client = interaction.client;
    const pool = client.pool;

    try {
      // Save to PostgreSQL
      await pool.query(
        `INSERT INTO user_workflows (user_id, guild_id, workflow_type)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, guild_id)
         DO UPDATE SET workflow_type = $3, updated_at = NOW()`,
        [userId, guildId, workflow]
      );

      // Update memory for immediate use
      let userData = client.memory?.get(userId) || { history: [], model: "genius", mode: "unfiltered", workflow: "chat" };
      userData.workflow = workflow;
      client.memory?.set(userId, userData);

      const embed = new EmbedBuilder()
        .setColor(0x7c7ce0)
        .setTitle(`${E.ai} workflow updated`)
        .setDescription(`${E.success} your ai workflow is now **${WORKFLOWS[workflow].label}** ${WORKFLOWS[workflow].emoji}`)
        .setFooter({ text: "workflow affects how chromed responds" })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
    } catch (err) {
      console.error("workflow save error:", err);
      const errorEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle(`${E.error} error`)
        .setDescription(`${E.angry} ${err.message}`);
      return interaction.editReply({ embeds: [errorEmbed] }).catch(() => interaction.followUp({ embeds: [errorEmbed] }));
    }
  },
};
