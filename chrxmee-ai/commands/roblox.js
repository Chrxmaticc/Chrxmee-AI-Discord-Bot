const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

const E = {
  success: "<:Verified_Icon:1527194184841167010>",
  error: "<:no:1530373946795364362>",
  ai: "<:Chrxmaticc_AI:1480094799292928132>",
  angry: "<:angry_cry:1526029511882440744>",
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("roblox")
    .setDescription("look up roblox users, avatars, outfits, and ids")
    .addSubcommand(sub =>
      sub.setName("profile")
        .setDescription("get roblox user profile")
        .addStringOption(opt => opt.setName("username").setDescription("roblox username").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("avatar")
        .setDescription("get roblox user avatar")
        .addStringOption(opt => opt.setName("username").setDescription("roblox username").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("outfit")
        .setDescription("get roblox user outfit")
        .addStringOption(opt => opt.setName("username").setDescription("roblox username").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("id")
        .setDescription("convert username to id")
        .addStringOption(opt => opt.setName("username").setDescription("roblox username").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("username")
        .setDescription("convert id to username")
        .addStringOption(opt => opt.setName("userid").setDescription("roblox user id").setRequired(true))
    ),

  async execute(interaction) {
    const isButtonSim = interaction.isButton && interaction.isButton();
    if (!isButtonSim) { try { await interaction.deferReply(); } catch {} }

    const sub = interaction.options.getSubcommand();

    try {
      // helper: resolve username to id
      async function resolveUsernameToId(username) {
        const res = await fetch("https://users.roblox.com/v1/usernames/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ usernames: [username], excludeBannedUsers: true }),
        });
        const data = await res.json();
        if (data.data && data.data.length > 0) return data.data[0].id;
        throw new Error(`couldn't find user ${username}`);
      }

      if (sub === "id") {
        const username = interaction.options.getString("username");
        const userId = await resolveUsernameToId(username);
        const embed = new EmbedBuilder()
          .setColor(0x7c7ce0)
          .setTitle(`${E.ai} username → id`)
          .setDescription(`${E.success} **${username}** is **${userId}**`)
          .setFooter({ text: "data from roblox users api" })
          .setTimestamp();
        return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
      }

      if (sub === "username") {
        const userId = interaction.options.getString("userid");
        const res = await fetch(`https://users.roblox.com/v1/users/${userId}`);
        if (!res.ok) throw new Error("user not found");
        const data = await res.json();
        const embed = new EmbedBuilder()
          .setColor(0x7c7ce0)
          .setTitle(`${E.ai} id → username`)
          .setDescription(`${E.success} **${userId}** is **${data.name}**`)
          .setFooter({ text: "data from roblox users api" })
          .setTimestamp();
        return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
      }

      if (sub === "profile" || sub === "avatar" || sub === "outfit") {
        const username = interaction.options.getString("username");
        const userId = await resolveUsernameToId(username);

        // get basic profile info
        const profileRes = await fetch(`https://users.roblox.com/v1/users/${userId}`);
        const profileData = await profileRes.json();

        // get avatar headshot / full body depending on sub
        let imageUrl = null;
        if (sub === "avatar") {
          const avatarRes = await fetch(`https://thumbnails.roblox.com/v1/users/avatar?userIds=${userId}&size=720x720&format=Png`);
          const avatarData = await avatarRes.json();
          imageUrl = avatarData.data?.[0]?.imageUrl || null;
        } else if (sub === "outfit") {
          // get current outfit thumbnail (full body)
          const outfitRes = await fetch(`https://thumbnails.roblox.com/v1/users/outfit?userIds=${userId}&size=720x720&format=Png`);
          const outfitData = await outfitRes.json();
          imageUrl = outfitData.data?.[0]?.imageUrl || null;
        } else {
          // profile: use headshot
          const headshotRes = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=256x256&format=Png`);
          const headshotData = await headshotRes.json();
          imageUrl = headshotData.data?.[0]?.imageUrl || null;
        }

        const embed = new EmbedBuilder()
          .setColor(0x7c7ce0)
          .setTitle(`${E.ai} roblox ${sub}`)
          .setDescription(`**${profileData.name}**`)
          .addFields(
            { name: "user id", value: userId, inline: true },
            { name: "display name", value: profileData.displayName || "none", inline: true },
            { name: "created", value: new Date(profileData.created).toLocaleDateString(), inline: true }
          )
          .setImage(imageUrl)
          .setFooter({ text: "data from roblox api" })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
      }
    } catch (err) {
      console.error("roblox error:", err);
      const errorEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle(`${E.error} roblox lookup failed`)
        .setDescription(`${E.angry} ${err.message}`);
      return interaction.editReply({ embeds: [errorEmbed] }).catch(() => interaction.followUp({ embeds: [errorEmbed] }));
    }
  },
};
