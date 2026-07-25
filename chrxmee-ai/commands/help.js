const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

const MODULES = {
  ai: {
    label: "AI & Chat",
    emoji: "<:Chrxmaticc_AI:1480094799292928132>",
    commands: ["ask", "chat", "mode", "model", "custom-interactions", "brain-dump", "clear-brain", "history", "summarize", "translate", "dream", "debate", "debate-topic", "oracle", "quote", "vibe-check", "code-generate"],
    color: 0x9146ff
  },
  fun: {
    label: "Fun & Games",
    emoji: "<:Steam_Happy:1522345549032853515>",
    commands: ["8ball", "coinflip", "dice", "roast", "ship", "wouldyourather", "trivia", "news", "binary", "qr", "poll", "weather", "profile-spin", "profile-melt", "profile-toast", "profile-pixelate", "profile-globe", "profile-killcam", "profile-delete"],
    color: 0xf1c40f
  },
  economy: {
    label: "Economy & RPG",
    emoji: "<:agreed:1525639597135237131>",
    commands: ["merits", "duel", "dungeon", "dungeon-prestige", "mining", "farm", "gamble", "pet", "trade"],
    color: 0x00ff00
  },
  customization: {
    label: "Customization",
    emoji: "<:Settings:1525601248278216725>",
    commands: ["customize", "force-customize", "embed", "customcmd"],
    color: 0xff69b4
  },
  moderation: {
    label: "Moderation",
    emoji: "<:Admin_Badge:1527194281234665622>",
    commands: ["antinuke", "shadow-logs", "givelogs", "keyword-responder", "uwuify", "say", "snipe"],
    color: 0xff0000
  },
  utility: {
    label: "Utility",
    emoji: "<:Developer:1525492198035161192>",
    commands: ["help", "ping", "status", "feedback", "remind-me", "birthday", "birthday-configure", "setpersonal", "mypersonal", "forgetpersonal", "guild-settings", "auto-respond", "skill-learn", "server-persence-generate", "avatar", "search", "skip", "vote-skip"],
    color: 0x7289da
  },
  xp: {
    label: "XP & Levels",
    emoji: "<:Discord_EarlySupporter:1222721329296310354>",
    commands: ["xp", "rank", "leaderboard"],
    color: 0xe67e22
  },
  j2c: {
    label: "Join to Create",
    emoji: "<:Link:1525603398341103806>",
    commands: ["j2c"],
    color: 0x00ffff
  }
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Show all commands with sections"),

  async execute(interaction, client) {
    const embed = new EmbedBuilder()
      .setColor(0x9146ff)
      .setTitle("<:Chrxmaticc_AI:1480094799292928132> Chrxmaticc AI · 炫克人工智能")
      .setDescription(
        `⚠️ **(required)** means you must fill in that option.\n` +
        `➕ **[optional]** means you can skip it — it's not required.\n\n` +
        `use the dropdown below to browse commands by category, or click the button to join the support server.`
      )
      .addFields({
        name: "🔗 Quick Links",
        value: `> <:Discord_Announcements:1526028541270167593> **[support server](https://discord.gg/chrxmaticc)** — get help, suggest features and report bugs.\n` +
               `> <:Link:1525603398341103806> **[invite me twin](https://discord.com/oauth2/authorize?client_id=1458944258454065377)** — Add Chrxmaticc AI to your server.`
      })
      .setThumbnail(client.user.displayAvatarURL())
      .setFooter({ text: "Chrxmaticc AI · 炫克人工智能 · 42+ servers" })
      .setTimestamp();

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("help_module")
      .setPlaceholder("select module(s).")
      .addOptions(
        Object.entries(MODULES).map(([id, mod]) => ({
          label: mod.label,
          value: id,
          emoji: mod.emoji,
          description: `${mod.commands.length} commands`
        }))
      );

    const supportButton = new ButtonBuilder()
      .setLabel("support server")
      .setStyle(ButtonStyle.Link)
      .setURL("https://discord.gg/chrxmaticc")
      .setEmoji("<:Discord_Announcements:1526028541270167593>");

    const row1 = new ActionRowBuilder().addComponents(selectMenu);
    const row2 = new ActionRowBuilder().addComponents(supportButton);

    const reply = await interaction.reply({ embeds: [embed], components: [row1, row2], fetchReply: true });

    const collector = reply.createMessageComponentCollector({ time: 300000 });

    collector.on("collect", async (menu) => {
      if (menu.customId !== "help_module") return;
      if (menu.user.id !== interaction.user.id) {
        return menu.reply({ content: "This isn't your help menu.", ephemeral: true });
      }

      const module = MODULES[menu.values[0]];
      if (!module) return;

      const cmdList = module.commands.map(cmd => `\`/${cmd}\``).join(" ");
      const moduleEmbed = new EmbedBuilder()
        .setColor(module.color)
        .setTitle(`${module.label}`)
        .setDescription(cmdList || "No commands in this module.")
        .setFooter({ text: "Chrxmaticc AI · 炫克人工智能" });

      await menu.reply({ embeds: [moduleEmbed], ephemeral: true });
    });

    collector.on("end", () => {
      interaction.editReply({ components: [] }).catch(() => {});
    });
  },
};
