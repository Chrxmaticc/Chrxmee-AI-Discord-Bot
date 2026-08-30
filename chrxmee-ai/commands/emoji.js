const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require("discord.js");

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
    .setName("emoji")
    .setDescription("manage emojis like a boss, or maybe?")
    .addSubcommand(sub =>
      sub.setName("add")
        .setDescription("add an emoji to this server")
        .addStringOption(opt => opt.setName("emoji").setDescription("emoji to add (custom or unicode)").setRequired(true))
        .addStringOption(opt => opt.setName("name").setDescription("new emoji name (custom only)").setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName("remove")
        .setDescription("remove an emoji from this server")
        .addStringOption(opt => opt.setName("emoji").setDescription("emoji to remove").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("steal")
        .setDescription("steal an emoji from another server or message")
        .addStringOption(opt => opt.setName("emoji").setDescription("emoji to steal (or reply to a message)").setRequired(false))
        .addStringOption(opt => opt.setName("name").setDescription("new emoji name").setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName("rename")
        .setDescription("rename an existing emoji")
        .addStringOption(opt => opt.setName("emoji").setDescription("emoji to rename").setRequired(true))
        .addStringOption(opt => opt.setName("name").setDescription("new name").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("list")
        .setDescription("list all emojis in this server")
    )
    .addSubcommand(sub =>
      sub.setName("info")
        .setDescription("get info about an emoji")
        .addStringOption(opt => opt.setName("emoji").setDescription("emoji to inspect").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("enlarge")
        .setDescription("get a larger version of an emoji")
        .addStringOption(opt => opt.setName("emoji").setDescription("emoji to enlarge").setRequired(true))
    ),

  async execute(interaction) {
    const isButtonSim = interaction.isButton && interaction.isButton();
    if (!isButtonSim) {
      try { await interaction.deferReply(); } catch {}
    }

    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;

    const sendEmbed = async (title, description, color = 0x7c7ce0, ephemeral = false) => {
      const embed = new EmbedBuilder().setColor(color).setTitle(title).setDescription(description);
      return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
    };

    // permission check for modifying emojis
    const needsManage = ["add", "remove", "steal", "rename"];
    if (needsManage.includes(sub) && !interaction.member.permissions.has(PermissionFlagsBits.ManageEmojisAndStickers)) {
      return sendEmbed(`${E.error} permission denied`, `${E.angry} you need **manage emojis** permission.`, 0xff0000, true);
    }

    try {
      if (sub === "add") {
        const emojiInput = interaction.options.getString("emoji");
        const name = interaction.options.getString("name") || null;
        const emoji = parseEmoji(emojiInput);

        if (!emoji) {
          // maybe it's a unicode emoji; cannot add unicode, only custom
          return sendEmbed(`${E.error} invalid emoji`, `${E.angry} you can only add custom emojis.`, 0xff0000);
        }

        if (!emoji.id) {
          return sendEmbed(`${E.error} unicode emoji`, `${E.angry} you can't add unicode emojis. use a custom emoji from another server.`, 0xff0000);
        }

        const emojiName = name || emoji.name;
        const emojiURL = `https://cdn.discordapp.com/emojis/${emoji.id}.${emoji.animated ? "gif" : "png"}`;
        const created = await guild.emojis.create({ name: emojiName, attachment: emojiURL });
        return sendEmbed(`${E.success} emoji added`, `added **${created}** as \`:${created.name}:\``);
      }

      if (sub === "remove") {
        const emojiInput = interaction.options.getString("emoji");
        const emoji = parseEmoji(emojiInput);
        if (!emoji || !emoji.id) return sendEmbed(`${E.error} invalid emoji`, `${E.angry} that's not a custom emoji.`, 0xff0000);

        const existing = guild.emojis.cache.get(emoji.id);
        if (!existing) return sendEmbed(`${E.error} not found`, `${E.angry} that emoji isn't in this server.`, 0xff0000);

        await existing.delete();
        return sendEmbed(`${E.success} emoji removed`, `removed **:${existing.name}:**`);
      }

      if (sub === "steal") {
        let emojiInput = interaction.options.getString("emoji");
        const customName = interaction.options.getString("name") || null;

        // if no emoji input, check replied message
        if (!emojiInput) {
          const replied = await interaction.channel.messages.fetch({ limit: 1, around: interaction.id }).catch(() => null);
          // This won't work; need interaction.reference. Let's handle differently:
          if (interaction.reference) {
            const msg = await interaction.channel.messages.fetch(interaction.reference.messageId).catch(() => null);
            if (msg) {
              const found = msg.content.match(/<(a?):[^:]+:(\d+)>/);
              if (found) emojiInput = found[0];
            }
          }
          if (!emojiInput) return sendEmbed(`${E.error} no emoji`, `${E.angry} provide an emoji or reply to a message containing one.`, 0xff0000);
        }

        const emoji = parseEmoji(emojiInput);
        if (!emoji || !emoji.id) return sendEmbed(`${E.error} invalid emoji`, `${E.angry} that's not a custom emoji.`, 0xff0000);

        const emojiName = customName || emoji.name;
        const emojiURL = `https://cdn.discordapp.com/emojis/${emoji.id}.${emoji.animated ? "gif" : "png"}`;
        const created = await guild.emojis.create({ name: emojiName, attachment: emojiURL });
        return sendEmbed(`${E.sneaky} emoji stolen`, `stole **${created}** and added it as \`:${created.name}:\``);
      }

      if (sub === "rename") {
        const emojiInput = interaction.options.getString("emoji");
        const newName = interaction.options.getString("name");
        const emoji = parseEmoji(emojiInput);
        if (!emoji || !emoji.id) return sendEmbed(`${E.error} invalid emoji`, `${E.angry} that's not a custom emoji.`, 0xff0000);

        const existing = guild.emojis.cache.get(emoji.id);
        if (!existing) return sendEmbed(`${E.error} not found`, `${E.angry} that emoji isn't in this server.`, 0xff0000);

        await existing.edit({ name: newName });
        return sendEmbed(`${E.success} emoji renamed`, `renamed to **${newName}**`);
      }

      if (sub === "list") {
        const emojis = guild.emojis.cache;
        if (!emojis.size) return sendEmbed(`${E.ai} no emojis`, "this server has no custom emojis.");
        const chunks = [];
        const entries = [...emojis.values()];
        for (let i = 0; i < entries.length; i += 20) {
          chunks.push(entries.slice(i, i + 20));
        }
        const embed = new EmbedBuilder()
          .setColor(0x7c7ce0)
          .setTitle(`${E.ai} server emojis (${emojis.size})`)
          .setDescription(chunks[0].map(e => `${e} \`:${e.name}:\``).join("\n") || "none");
        if (chunks.length > 1) embed.setFooter({ text: `page 1 of ${chunks.length}` });
        return interaction.editReply({ embeds: [embed] });
      }

      if (sub === "info") {
        const emojiInput = interaction.options.getString("emoji");
        const emoji = parseEmoji(emojiInput);
        if (!emoji || !emoji.id) return sendEmbed(`${E.error} invalid emoji`, `${E.angry} that's not a custom emoji.`, 0xff0000);

        const embed = new EmbedBuilder()
          .setColor(0x7c7ce0)
          .setTitle(`${E.ai} emoji info`)
          .addFields(
            { name: "name", value: `:${emoji.name}:`, inline: true },
            { name: "id", value: emoji.id, inline: true },
            { name: "animated", value: emoji.animated ? "yes" : "no", inline: true },
            { name: "url", value: `[link](https://cdn.discordapp.com/emojis/${emoji.id}.${emoji.animated ? "gif" : "png"})`, inline: false }
          )
          .setThumbnail(`https://cdn.discordapp.com/emojis/${emoji.id}.${emoji.animated ? "gif" : "png"}`);
        return interaction.editReply({ embeds: [embed] });
      }

      if (sub === "enlarge") {
        const emojiInput = interaction.options.getString("emoji");
        const emoji = parseEmoji(emojiInput);
        if (!emoji || !emoji.id) return sendEmbed(`${E.error} invalid emoji`, `${E.angry} that's not a custom emoji.`, 0xff0000);

        const url = `https://cdn.discordapp.com/emojis/${emoji.id}.${emoji.animated ? "gif" : "png"}`;
        const embed = new EmbedBuilder()
          .setColor(0x7c7ce0)
          .setTitle(`${E.ai} enlarged emoji`)
          .setImage(url);
        return interaction.editReply({ embeds: [embed] });
      }

      return sendEmbed(`${E.error} unknown`, "unknown subcommand.");
    } catch (err) {
      console.error("emoji cmd error:", err);
      return sendEmbed(`${E.error} error`, `${E.angry} something went wrong: ${err.message}`, 0xff0000);
    }
  },
};

function parseEmoji(text) {
  const match = text.match(/<(a?):([^:]+):(\d+)>/);
  if (match) {
    return { animated: match[1] === "a", name: match[2], id: match[3] };
  }
  return null;
}
