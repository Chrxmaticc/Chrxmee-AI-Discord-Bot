const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const { REST } = require("@discordjs/rest");

const E = {
  success: "<:Verified_Icon:1527194184841167010>",
  error: "<:no:1530373946795364362>",
  ai: "<:Chrxmaticc_AI:1480094799292928132>",
  settings: "<:Settings:1525601248278216725>",
  crown: "<:Holographic_owner_crown:1527401510487461969>",
};

const FONT_IDS = {
  1: "Default",
  2: "Serif",
  3: "Script",
  4: "Monospace",
  5: "Double",
  6: "Small Caps",
  7: "Bubble",
  8: "Square",
  9: "Upside Down",
  10: "Sinistre",
  11: "Leet",
  12: "Fancy",
};

const EFFECT_IDS = {
  1: "None",
  2: "Glow",
  3: "Neon",
  4: "Shadow",
  5: "Gradient",
  6: "Rainbow",
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("namestyle")
    .setDescription("set chromed's name style in this server")
    .addSubcommand(sub => sub.setName("set").setDescription("set font, effect, and colors")
      .addIntegerOption(opt => opt.setName("font").setDescription("font id (1-12)").setRequired(true).setMinValue(1).setMaxValue(12))
      .addIntegerOption(opt => opt.setName("effect").setDescription("effect id (1-6)").setRequired(true).setMinValue(1).setMaxValue(6))
      .addStringOption(opt => opt.setName("color1").setDescription("first color hex (#ffffff)").setRequired(true))
      .addStringOption(opt => opt.setName("color2").setDescription("second color hex (optional, for gradient)").setRequired(false))
    )
    .addSubcommand(sub => sub.setName("reset").setDescription("clear name style")),
  
  async execute(interaction) {
    const isButtonSim = interaction.isButton && interaction.isButton();
    if (!isButtonSim) {
      try { await interaction.deferReply({ ephemeral: true }); } catch { try { await interaction.deferReply(); } catch {} }
    }

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const member = interaction.member;

    if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle(`${E.error} admin only`)
        .setDescription(`${E.angry} you need administrator permission to set name style.`);
      return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
    }

    const rest = new REST({ version: "10" }).setToken(process.env.BOT_TOKEN);
    const endpoint = `/guilds/${guildId}/members/@me`;

    try {
      if (sub === "set") {
        const font = interaction.options.getInteger("font");
        const effect = interaction.options.getInteger("effect");
        const color1Hex = interaction.options.getString("color1").replace("#", "");
        const color2Hex = interaction.options.getString("color2")?.replace("#", "") || null;

        const color1Int = parseInt(color1Hex, 16);
        if (isNaN(color1Int)) {
          return interaction.editReply({ content: `${E.error} invalid hex color.` }).catch(() => interaction.followUp(`${E.error} invalid hex color.`));
        }
        const colors = [color1Int];
        if (color2Hex) {
          const color2Int = parseInt(color2Hex, 16);
          if (isNaN(color2Int)) {
            return interaction.editReply({ content: `${E.error} invalid second hex color.` }).catch(() => interaction.followUp(`${E.error} invalid second hex color.`));
          }
          colors.push(color2Int);
        }

        await rest.patch(endpoint, {
          body: {
            display_name_font_id: font,
            display_name_effect_id: effect,
            display_name_colors: colors,
          },
        });

        const fontLabel = FONT_IDS[font] || font.toString();
        const effectLabel = EFFECT_IDS[effect] || effect.toString();
        const colorDesc = colors.length === 1 ? `#${color1Hex}` : `#${color1Hex} → #${color2Hex}`;

        const embed = new EmbedBuilder()
          .setColor(0x7c7ce0)
          .setTitle(`${E.crown} name style set`)
          .setDescription(`${E.success} font: **${fontLabel}**\neffect: **${effectLabel}**\ncolors: **${colorDesc}**`)
          .setFooter({ text: "applied to this server only" });

        return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
      }

      if (sub === "reset") {
        await rest.patch(endpoint, {
          body: {
            display_name_font_id: null,
            display_name_effect_id: null,
            display_name_colors: null,
          },
        });

        const embed = new EmbedBuilder()
          .setColor(0x7c7ce0)
          .setTitle(`${E.success} name style reset`)
          .setDescription(`${E.agree} chromed's name style is back to default.`);

        return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
      }
    } catch (err) {
      console.error("namestyle error:", err);
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle(`${E.error} error`)
        .setDescription(`${E.angry} ${err.message}`);
      return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
    }
  },
};
