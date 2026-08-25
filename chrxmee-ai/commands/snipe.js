const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

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
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("snipe")
    .setDescription("snitch on what got deleted or changed")
    .addSubcommand(sub =>
      sub.setName("deleted")
        .setDescription("get the last deleted message")
    )
    .addSubcommand(sub =>
      sub.setName("edited")
        .setDescription("get the last edited message")
    )
    .addSubcommand(sub =>
      sub.setName("reaction")
        .setDescription("get the last removed reaction")
    ),

  async execute(interaction) {
    const isButtonSim = interaction.isButton && interaction.isButton();
    if (!isButtonSim) {
      try { await interaction.deferReply(); } catch {}
    }

    const sub = interaction.options.getSubcommand();
    const client = interaction.client;
    const channelId = interaction.channelId;

    try {
      let embed;

      if (sub === "deleted") {
        const snipes = client.snipes?.get(channelId) || [];
        if (!snipes.length) {
          embed = new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle(`${E.error} nothing to snipe`)
            .setDescription(`${E.angry} no deleted messages in this channel.`);
        } else {
          const s = snipes[0];
          embed = new EmbedBuilder()
            .setColor(0x7c7ce0)
            .setTitle(`${E.sneaky} deleted message`)
            .setDescription(s.content)
            .addFields(
              { name: "author", value: s.author, inline: true },
              { name: "channel", value: `<#${s.channelId}>`, inline: true },
              { name: "time", value: `<t:${Math.floor(s.timestamp / 1000)}:R>`, inline: true }
            )
            .setFooter({ text: "sniped by chromed" })
            .setTimestamp();

          if (s.attachments?.length) {
            const att = s.attachments[0];
            embed.setImage(att.url);
            embed.addFields({ name: "attachment", value: `[${att.name}](${att.url})`, inline: false });
          }
        }
      } else if (sub === "edited") {
        const edits = client.editSnipes?.get(channelId) || [];
        if (!edits.length) {
          embed = new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle(`${E.error} nothing to snipe`)
            .setDescription(`${E.angry} no edited messages in this channel.`);
        } else {
          const e = edits[0];
          embed = new EmbedBuilder()
            .setColor(0x7c7ce0)
            .setTitle(`${E.sneaky} edited message`)
            .addFields(
              { name: "before", value: e.oldContent || "*(empty)*", inline: false },
              { name: "after", value: e.newContent || "*(empty)*", inline: false },
              { name: "author", value: e.author, inline: true },
              { name: "time", value: `<t:${Math.floor(e.timestamp / 1000)}:R>`, inline: true }
            )
            .setFooter({ text: "no edit goes unnoticed" })
            .setTimestamp();
        }
      } else if (sub === "reaction") {
        const reactions = client.reactionSnipes?.get(channelId) || [];
        if (!reactions.length) {
          embed = new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle(`${E.error} nothing to snipe`)
            .setDescription(`${E.angry} no removed reactions in this channel.`);
        } else {
          const r = reactions[0];
          embed = new EmbedBuilder()
            .setColor(0x7c7ce0)
            .setTitle(`${E.sneaky} removed reaction`)
            .addFields(
              { name: "reaction", value: r.emoji, inline: true },
              { name: "user", value: r.userTag, inline: true },
              { name: "message", value: r.messageContent, inline: false },
              { name: "time", value: `<t:${Math.floor(r.timestamp / 1000)}:R>`, inline: true }
            )
            .setFooter({ text: "even reactions get caught" })
            .setTimestamp();
        }
      }

      return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));

    } catch (err) {
      console.error("snipe error:", err);
      const errorEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle(`${E.error} snipe failed`)
        .setDescription(`${E.angry} something went wrong: ${err.message}`);
      return interaction.editReply({ embeds: [errorEmbed] }).catch(() => interaction.followUp({ embeds: [errorEmbed] }));
    }
  },
};
