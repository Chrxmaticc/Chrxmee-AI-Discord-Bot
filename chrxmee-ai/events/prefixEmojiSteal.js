const { PermissionsBitField, EmbedBuilder } = require("discord.js");

const E = {
  success: "<:Verified_Icon:1527194184841167010>",
  error: "<:no:1530373946795364362>",
  ai: "<:Chrxmaticc_AI:1480094799292928132>",
  sneaky: "<:sneaky:1527401423690792970>",
  angry: "<:angry_cry:1526029511882440744>",
};

module.exports = {
  name: "messageCreate",
  async execute(message) {
    if (message.author.bot || !message.guild) return;

    const client = message.client;
    const pool = client.pool;
    if (!pool) return;

    // get server prefix
    let prefix = "!";
    try {
      const res = await pool.query(`SELECT prefix FROM guild_settings WHERE guild_id = $1`, [message.guildId]);
      if (res.rows[0]?.prefix) prefix = res.rows[0].prefix;
    } catch {}

    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift()?.toLowerCase();
    if (command !== "emoji") return;

    const sub = args[0]?.toLowerCase();
    if (sub !== "steal") return;

    // permission check
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageEmojisAndStickers)) {
      return message.reply(`${E.error} you need **manage emojis** permission.`).catch(() => {});
    }

    // look for emoji in two places: direct argument or replied message
    let emojiInput = args[1] || null;
    let customName = null;

    // check if name option provided: !emoji steal <emoji> name:something
    const nameIndex = args.findIndex(a => a.startsWith("name:"));
    if (nameIndex !== -1) {
      customName = args[nameIndex].slice(5); // remove "name:"
      if (!emojiInput && args.length > 2 && nameIndex !== 1) {
        // if emoji not given but name is, still no emoji? likely invalid
      }
      // remove name option from args
      args.splice(nameIndex, 1);
    }

    // if no direct emoji, try replied message
    if (!emojiInput && message.reference) {
      try {
        const replied = await message.channel.messages.fetch(message.reference.messageId);
        const match = replied.content.match(/<(a?):[^:]+:(\d+)>/);
        if (match) {
          emojiInput = match[0];
        } else {
          return message.reply(`${E.error} replied message has no custom emoji.`).catch(() => {});
        }
      } catch {
        return message.reply(`${E.error} couldn't fetch replied message.`).catch(() => {});
      }
    }

    // parse emoji
    if (!emojiInput) {
      return message.reply(`${E.error} provide a custom emoji or reply to a message containing one.`).catch(() => {});
    }

    const emojiMatch = emojiInput.match(/<(a?):([^:]+):(\d+)>/);
    if (!emojiMatch) {
      return message.reply(`${E.error} that's not a custom emoji. only custom emojis can be stolen.`).catch(() => {});
    }

    const animated = emojiMatch[1] === "a";
    const emojiName = emojiMatch[2];
    const emojiId = emojiMatch[3];
    const finalName = customName || emojiName;
    const emojiURL = `https://cdn.discordapp.com/emojis/${emojiId}.${animated ? "gif" : "png"}`;

    try {
      const created = await message.guild.emojis.create({
        name: finalName,
        attachment: emojiURL,
      });

      const embed = new EmbedBuilder()
        .setColor(0x7c7ce0)
        .setTitle(`${E.sneaky} emoji stolen`)
        .setDescription(`${E.success} added **${created}** as \`:${created.name}:\``)
        .setThumbnail(emojiURL)
        .setFooter({ text: "stolen by chromed" })
        .setTimestamp();

      return message.reply({ embeds: [embed] }).catch(() => {});
    } catch (err) {
      console.error("prefix emoji steal error:", err);
      return message.reply(`${E.error} failed to steal emoji: ${err.message}`).catch(() => {});
    }
  },
};
