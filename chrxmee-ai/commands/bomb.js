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
  son: "<:Son:1526536930693484575>",
};

// lobbies stored in memory: guildId -> lobby object
const lobbies = new Map();

const bombEmoji = "💣";
const packageEmoji = "📦";

function getLobby(guildId) {
  return lobbies.get(guildId);
}

function deleteLobby(guildId) {
  const lobby = lobbies.get(guildId);
  if (lobby) {
    if (lobby.gameTimeout) clearTimeout(lobby.gameTimeout);
    if (lobby.gameInterval) clearInterval(lobby.gameInterval);
  }
  lobbies.delete(guildId);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("bomb")
    .setDescription("pass the package bomb minigame")
    .addSubcommand(sub =>
      sub.setName("help").setDescription("show all package bomb commands")
    )
    .addSubcommand(sub =>
      sub.setName("lobby").setDescription("create a lobby")
    )
    .addSubcommand(sub =>
      sub.setName("cancel").setDescription("cancel your lobby")
    )
    .addSubcommand(sub =>
      sub.setName("check").setDescription("check how many players are in your lobby")
    )
    .addSubcommand(sub =>
      sub
        .setName("invite")
        .setDescription("invite a user to the lobby")
        .addUserOption(opt =>
          opt.setName("user").setDescription("who to invite").setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName("start").setDescription("start the game (needs 2+ players)")
    )
    .addSubcommand(sub =>
      sub.setName("pass").setDescription("pass the package before it explodes")
    ),

  async execute(interaction) {
    const isButtonSim = interaction.isButton && interaction.isButton();
    if (!isButtonSim) {
      try { await interaction.deferReply(); } catch {}
    }

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const member = interaction.member;
    const channel = interaction.channel;

    // help
    if (sub === "help") {
      const embed = new EmbedBuilder()
        .setColor(0x7c7ce0)
        .setTitle(`${E.ai} pass the package bomb`)
        .setDescription(
          `**all commands:**\n` +
          `\`/bomb lobby\` — create a lobby\n` +
          `\`/bomb cancel\` — delete your lobby\n` +
          `\`/bomb check\` — see how many players\n` +
          `\`/bomb start\` — start game (2+ players)\n` +
          `\`/bomb invite @user\` — invite someone\n` +
          `\`/bomb pass\` — pass the package (50% explode)`
        )
        .setFooter({ text: "don't hold it too long" })
        .setTimestamp();
      return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
    }

    // lobby create
    if (sub === "lobby") {
      if (lobbies.has(guildId)) {
        return interaction.editReply(`${E.error} a lobby already exists. use \`/b cancel\` to delete it.`);
      }

      lobbies.set(guildId, {
        hostId: userId,
        players: [userId],
        channelId: channel.id,
        active: false,
        currentHolder: null,
        gameTimeout: null,
        gameInterval: null,
      });

      return interaction.editReply(`${E.success} **pass the package bomb** lobby created! use \`/b invite @user\` to add players.`);
    }

    // cancel
    if (sub === "cancel") {
      const lobby = getLobby(guildId);
      if (!lobby) return interaction.editReply(`${E.error} you don't have an active lobby.`);
      if (lobby.hostId !== userId) return interaction.editReply(`${E.error} only the host can cancel the lobby.`);
      deleteLobby(guildId);
      return interaction.editReply(`${E.success} lobby cancelled.`);
    }

    // check
    if (sub === "check") {
      const lobby = getLobby(guildId);
      if (!lobby) return interaction.editReply(`${E.error} no lobby found. use \`/b lobby\` first.`);
      const count = lobby.players.length;
      return interaction.editReply(`${E.ai} there ${count === 1 ? "is" : "are"} **${count}** player${count === 1 ? "" : "s"} in the lobby.`);
    }

    // invite
    if (sub === "invite") {
      const lobby = getLobby(guildId);
      if (!lobby) return interaction.editReply(`${E.error} no lobby found. use \`/b lobby\` first.`);
      if (lobby.hostId !== userId) return interaction.editReply(`${E.error} only the host can invite.`);
      const target = interaction.options.getUser("user");
      if (!target) return interaction.editReply(`${E.error} please mention a user.`);
      if (target.bot) return interaction.editReply(`${E.error} you cannot invite a bot.`);
      if (lobby.players.includes(target.id)) return interaction.editReply(`${E.error} ${target} is already in the lobby.`);

      // create invite buttons
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("invite_yes")
          .setLabel("Yes")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("invite_no")
          .setLabel("No")
          .setStyle(ButtonStyle.Danger)
      );

      const inviteMsg = await interaction.editReply({
        content: `${E.ai} yo ${target}, ${interaction.user} invited you to play **pass the package bomb**. do you accept?`,
        components: [row],
      });

      // collector for button response
      const collector = inviteMsg.createMessageComponentCollector({
        filter: i => i.user.id === target.id,
        time: 60000,
        max: 1,
      });

      collector.on("collect", async i => {
        if (i.customId === "invite_yes") {
          lobby.players.push(target.id);
          await i.update({
            content: `${E.success} ${target} joined the lobby! now **${lobby.players.length}** players.`,
            components: [],
          });
        } else {
          await i.update({
            content: `${E.error} ${target} declined the invite. aura loss for you, ${interaction.user}.`,
            components: [],
          });
        }
      });

      collector.on("end", collected => {
        if (collected.size === 0) {
          inviteMsg.edit({ components: [] }).catch(() => {});
        }
      });

      return;
    }

    // start
    if (sub === "start") {
      const lobby = getLobby(guildId);
      if (!lobby) return interaction.editReply(`${E.error} no lobby found. use \`/b lobby\` first.`);
      if (lobby.hostId !== userId) return interaction.editReply(`${E.error} only the host can start.`);
      if (lobby.players.length < 2) return interaction.editReply(`${E.error} you need at least **2** players.`);
      if (lobby.active) return interaction.editReply(`${E.error} game already running.`);

      lobby.active = true;
      // shuffle players
      lobby.players = lobby.players.sort(() => Math.random() - 0.5);
      lobby.currentHolder = lobby.players[0];

      await interaction.editReply(`${E.agree} bet! let's start. ${interaction.user} begins.`);

      const startTurn = () => {
        const holder = lobby.currentHolder;
        const holderMember = interaction.guild.members.cache.get(holder);
        interaction.channel.send(`${packageEmoji} **${holderMember ? holderMember.displayName : "someone"}** has the package! use \`/b pass\` before it explodes! ⏰`).catch(() => {});

        // set timeout for 10 seconds
        lobby.gameTimeout = setTimeout(() => {
          const loser = lobby.currentHolder;
          const loserMember = interaction.guild.members.cache.get(loser);
          interaction.channel.send(`${bombEmoji} **BOOM!** the package exploded in **${loserMember ? loserMember.displayName : "someone"}**'s face! game over.`).catch(() => {});
          deleteLobby(guildId);
        }, 10000);
      };

      startTurn();
      return;
    }

    // pass
    if (sub === "pass") {
      const lobby = getLobby(guildId);
      if (!lobby) return interaction.editReply(`${E.error} no lobby found. use \`/b lobby\` first.`);
      if (!lobby.active) return interaction.editReply(`${E.error} no game running. start one with \`/b start\`.`);
      if (lobby.currentHolder !== userId) return interaction.editReply(`${E.error} you don't have the package! wait for it to be passed to you.`);

      // clear current timeout
      if (lobby.gameTimeout) clearTimeout(lobby.gameTimeout);

      // 50% chance explode
      if (Math.random() < 0.5) {
        await interaction.editReply(`${bombEmoji} **BOOM!** the package exploded in ${interaction.user}'s face! game over.`);
        deleteLobby(guildId);
        return;
      }

      // pass to random other player
      const otherPlayers = lobby.players.filter(p => p !== userId);
      if (!otherPlayers.length) {
        await interaction.editReply(`${E.error} no other players to pass to.`);
        deleteLobby(guildId);
        return;
      }

      const nextHolder = otherPlayers[Math.floor(Math.random() * otherPlayers.length)];
      lobby.currentHolder = nextHolder;
      const nextMember = interaction.guild.members.cache.get(nextHolder);
      await interaction.editReply(`${E.success} passed the package to **${nextMember ? nextMember.displayName : "someone"}**! use \`/b pass\` before it explodes!`);

      // reset timer
      lobby.gameTimeout = setTimeout(() => {
        const loser = lobby.currentHolder;
        const loserMember = interaction.guild.members.cache.get(loser);
        interaction.channel.send(`${bombEmoji} **BOOM!** the package exploded in **${loserMember ? loserMember.displayName : "someone"}**'s face! game over.`).catch(() => {});
        deleteLobby(guildId);
      }, 10000);

      return;
    }

    // fallback
    return interaction.editReply(`${E.error} invalid subcommand.`);
  },
};
