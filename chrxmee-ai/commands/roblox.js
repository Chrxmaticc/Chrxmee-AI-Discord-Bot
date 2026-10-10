const {
  SlashCommandBuilder,
  ApplicationIntegrationType,
  InteractionContextType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  TextDisplayBuilder,
  SectionBuilder,
  ThumbnailBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
} = require('discord.js');

const E = {
  success:  "<:Verified_Icon:1527194184841167010>",
  error:    "<:no:1530373946795364362>",
  ai:       "<:Chrxmaticc_AI:1480094799292928132>",
  settings: "<:Settings:1525601248278216725>",
  angry:    "<:angry_cry:1526029511882440744>",
  member:   "<:member:1530383558710005960>",
  crown:    "<:Holographic_owner_crown:1527401510487461969>",
  money:    "<:Money_Cry_Son:1526538340264841257>",
  file:     "<:File_Icon:1526542046213570681>",
  gold:     "<:GoldDiscord:1531896474529431668>",
  link:     "<:Link:1525603398341103806>",
  happy:    "<:happy_cry:1526029243333611530>",
  son:      "<:Son:1526536930693484575>",
  sneaky:   "<:sneaky:1527401423690792970>",
  laugh:    "<:Cringe_Laughing_Son:1526539082564374710>",
  compass:  "<:Compass_Discover_Icon:1526542192494248067>",
};

const COLORS = {
  blue: 0x7289da, red: 0xff3b3b, green: 0x57f287,
  purple: 0x9b59b6, gold: 0xf1c40f, default: 0x5b7fd4,
  orange: 0xe67e22, pink: 0xff69b4, blurple: 0x5865f2,
  roblox: 0xd63a2f,        // roblox red
  robloxBlue: 0x00a2ff,    // roblox dark blue
};

const V2 = MessageFlags.IsComponentsV2;
const V2_E = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;

/* ═══════════════ ROBLOX API HELPERS ═══════════════ */
async function getUserId(username) {
  try {
    const res = await fetch('https://users.roblox.com/v1/usernames/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernames: [username], excludeBannedUsers: false }),
    });
    const data = await res.json();
    return data?.data?.[0] || null;
  } catch {
    return null;
  }
}

async function getUserInfo(userId) {
  try {
    const res = await fetch(`https://users.roblox.com/v1/users/${userId}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function getUserCounts(userId) {
  try {
    const [friends, followers, followings] = await Promise.all([
      fetch(`https://friends.roblox.com/v1/users/${userId}/friends/count`).then(r => r.json()).catch(() => ({ count: 0 })),
      fetch(`https://friends.roblox.com/v1/users/${userId}/followers/count`).then(r => r.json()).catch(() => ({ count: 0 })),
      fetch(`https://friends.roblox.com/v1/users/${userId}/followings/count`).then(r => r.json()).catch(() => ({ count: 0 })),
    ]);
    return {
      friends: friends?.count || 0,
      followers: followers?.count || 0,
      following: followings?.count || 0,
    };
  } catch {
    return { friends: 0, followers: 0, following: 0 };
  }
}

async function getAvatarUrl(userId, size = '420x420') {
  try {
    const res = await fetch(
      `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=${size}&format=Png&isCircular=false`
    );
    const data = await res.json();
    return data?.data?.[0]?.imageUrl || null;
  } catch {
    return null;
  }
}

async function getFullAvatarUrl(userId) {
  try {
    const res = await fetch(
      `https://thumbnails.roblox.com/v1/users/avatar?userIds=${userId}&size=720x720&format=Png&isCircular=false`
    );
    const data = await res.json();
    return data?.data?.[0]?.imageUrl || null;
  } catch {
    return null;
  }
}

async function placeToUniverse(placeId) {
  try {
    const res = await fetch(`https://apis.roblox.com/universes/v1/places/${placeId}/universe`);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.universeId || null;
  } catch {
    return null;
  }
}

async function getGameInfo(universeId) {
  try {
    const [info, votes, favorites] = await Promise.all([
      fetch(`https://games.roblox.com/v1/games?universeIds=${universeId}`).then(r => r.json()).catch(() => null),
      fetch(`https://games.roblox.com/v1/games/votes?universeIds=${universeId}`).then(r => r.json()).catch(() => null),
      fetch(`https://games.roblox.com/v1/games/${universeId}/favorites/count`).then(r => r.json()).catch(() => null),
    ]);
    const game = info?.data?.[0];
    if (!game) return null;
    const vote = votes?.data?.[0] || {};
    return {
      ...game,
      likes: vote.likes || 0,
      dislikes: vote.dislikes || 0,
      favorites: favorites?.favoritesCount || 0,
    };
  } catch {
    return null;
  }
}

async function searchGames(keyword) {
  try {
    const res = await fetch(
      `https://games.roblox.com/v1/games/list?model.keyword=${encodeURIComponent(keyword)}&model.maxRows=10`
    );
    const data = await res.json();
    return data?.games || [];
  } catch {
    return [];
  }
}

async function getRandomGame() {
  try {
    const res = await fetch('https://games.roblox.com/v1/games/list?model.sortToken=&model.maxRows=50&model.startRows=0');
    const data = await res.json();
    const games = data?.games || [];
    if (!games.length) return null;
    return games[Math.floor(Math.random() * games.length)];
  } catch {
    return null;
  }
}

function num(n) {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

/* ═══════════════ MODULE ═══════════════ */
module.exports = {
  data: new SlashCommandBuilder()
    .setName('roblox')
    .setDescription('look up roblox users, games, and avatars')
    .setIntegrationTypes(
      ApplicationIntegrationType.GuildInstall,
      ApplicationIntegrationType.UserInstall,
    )
    .setContexts(
      InteractionContextType.Guild,
      InteractionContextType.BotDM,
      InteractionContextType.PrivateChannel,
    )

    .addSubcommand(s => s.setName('user').setDescription('look up a roblox user')
      .addStringOption(o => o.setName('username').setDescription('roblox username').setRequired(true))
    )

    .addSubcommand(s => s.setName('avatar').setDescription('view a roblox avatar full-size')
      .addStringOption(o => o.setName('username').setDescription('roblox username').setRequired(true))
    )

    .addSubcommand(s => s.setName('id').setDescription('get a user id from a username')
      .addStringOption(o => o.setName('username').setDescription('roblox username').setRequired(true))
    )

    .addSubcommand(s => s.setName('game').setDescription('look up a roblox game')
      .addStringOption(o => o.setName('query').setDescription('place id, game name, or game link').setRequired(true))
    )

    .addSubcommand(s => s.setName('random').setDescription('random popular roblox game'))
  ,

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();

    await interaction.deferReply({ flags: V2_E });

    const errBox = (msg) => new ContainerBuilder()
      .setAccentColor(COLORS.red)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.error} ${msg}`));

    /* ──── ID ──── */
    if (sub === 'id') {
      const username = interaction.options.getString('username');
      const user = await getUserId(username);

      if (!user) {
        return interaction.editReply({ components: [errBox(`no roblox user named **${username}**.`)], flags: V2_E });
      }

      const c = new ContainerBuilder()
        .setAccentColor(COLORS.roblox)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.compass} roblox lookup`))
        .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent([
          `**username** · \`${user.name}\``,
          `**display name** · ${user.displayName}`,
          `**id** · \`${user.id}\``,
          `**profile** · https://www.roblox.com/users/${user.id}/profile`,
        ].join('\n')));

      return interaction.editReply({ components: [c], flags: V2_E });
    }

    /* ──── USER ──── */
    if (sub === 'user') {
      const username = interaction.options.getString('username');
      const basic = await getUserId(username);

      if (!basic) {
        return interaction.editReply({ components: [errBox(`no roblox user named **${username}**.`)], flags: V2_E });
      }

      const [info, counts, avatar] = await Promise.all([
        getUserInfo(basic.id),
        getUserCounts(basic.id),
        getAvatarUrl(basic.id, '420x420'),
      ]);

      if (!info) {
        return interaction.editReply({ components: [errBox(`couldn't fetch user data.`)], flags: V2_E });
      }

      const created = new Date(info.created).getTime() / 1000;
      const bio = info.description?.trim() || '*no bio*';
      const displayName = info.displayName || info.name;

      const c = new ContainerBuilder().setAccentColor(COLORS.roblox);

      const headerText = [
        `## ${E.happy} ${displayName}`,
        `-# @${info.name} · \`${info.id}\``,
      ].join('\n');

      if (avatar) {
        c.addSectionComponents(
          new SectionBuilder()
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(headerText))
            .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatar))
        );
      } else {
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(headerText));
      }

      c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**bio**\n${bio.length > 500 ? bio.slice(0, 500) + '...' : bio}`));

      c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent([
        `**followers** · ${E.member} ${num(counts.followers)}`,
        `**following** · ${num(counts.following)}`,
        `**friends** · ${num(counts.friends)}`,
      ].join('\n')));

      c.addSeparatorComponents(new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small));
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent([
        `**joined** · <t:${Math.floor(created)}:R>`,
        info.isBanned ? `${E.angry} **account is banned**` : '',
      ].filter(Boolean).join('\n')));

      c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('profile')
          .setURL(`https://www.roblox.com/users/${info.id}/profile`)
          .setStyle(ButtonStyle.Link),
      );
      c.addActionRowComponents(row);

      return interaction.editReply({ components: [c], flags: V2_E });
    }

    /* ──── AVATAR ──── */
    if (sub === 'avatar') {
      const username = interaction.options.getString('username');
      const basic = await getUserId(username);

      if (!basic) {
        return interaction.editReply({ components: [errBox(`no roblox user named **${username}**.`)], flags: V2_E });
      }

      const avatar = await getFullAvatarUrl(basic.id);
      if (!avatar) {
        return interaction.editReply({ components: [errBox(`couldn't load avatar for **${username}**.`)], flags: V2_E });
      }

      const c = new ContainerBuilder()
        .setAccentColor(COLORS.robloxBlue)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.son} ${basic.displayName}'s avatar`))
        .addMediaGalleryComponents(
          new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(avatar))
        )
        .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# @${basic.name} · \`${basic.id}\``));

      return interaction.editReply({ components: [c], flags: V2_E });
    }

    /* ──── GAME ──── */
    if (sub === 'game') {
      const query = interaction.options.getString('query').trim();

      let universeId = null;
      let gameName = null;

      // try as a place id
      if (/^\d+$/.test(query)) {
        universeId = await placeToUniverse(query);
      }

      // try as a roblox link
      if (!universeId) {
        const m = query.match(/roblox\.com\/games\/(\d+)/);
        if (m) {
          universeId = await placeToUniverse(m[1]);
        }
      }

      // otherwise search by name
      if (!universeId) {
        const results = await searchGames(query);
        if (results.length) {
          const top = results[0];
          universeId = top.universeId;
          gameName = top.name;
        }
      }

      if (!universeId) {
        return interaction.editReply({ components: [errBox(`no game found for **${query}**.`)], flags: V2_E });
      }

      const game = await getGameInfo(universeId);
      if (!game) {
        return interaction.editReply({ components: [errBox(`couldn't fetch game details.`)], flags: V2_E });
      }

      // thumbnail
      let thumb = null;
      try {
        const res = await fetch(
          `https://thumbnails.roblox.com/v1/games/multiget/thumbnails?universeIds=${universeId}&size=768x432&format=Png&countPerUniverse=1`
        );
        const data = await res.json();
        thumb = data?.data?.[0]?.thumbnails?.[0]?.imageUrl || null;
      } catch {}

      const totalVotes = game.likes + game.dislikes;
      const ratio = totalVotes > 0 ? Math.round((game.likes / totalVotes) * 100) : 0;
      const players = game.playing || 0;
      const visits = game.visits || 0;
      const maxPlayers = game.maxPlayers || 0;
      const creator = game.creator?.name || 'unknown';
      const creatorType = game.creator?.type === 'Group' ? 'group' : 'user';

      const c = new ContainerBuilder().setAccentColor(COLORS.roblox);

      c.addTextDisplayComponents(new TextDisplayBuilder().setContent([
        `## ${E.laugh} ${game.name}`,
        `-# by ${creatorType} **${creator}**`,
      ].join('\n')));

      if (thumb) {
        c.addMediaGalleryComponents(
          new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(thumb))
        );
      }

      c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));

      c.addTextDisplayComponents(new TextDisplayBuilder().setContent([
        `**playing** · 🎮 ${num(players)} / ${maxPlayers}`,
        `**visits** · 👀 ${num(visits)}`,
        `**favorites** · ⭐ ${num(game.favorites)}`,
      ].join('\n')));

      c.addSeparatorComponents(new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small));

      c.addTextDisplayComponents(new TextDisplayBuilder().setContent([
        `**rating** · 👍 ${num(game.likes)} · 👎 ${num(game.dislikes)} · **${ratio}%** liked`,
        `**updated** · <t:${Math.floor(new Date(game.updated).getTime() / 1000)}:R>`,
        `**created** · <t:${Math.floor(new Date(game.created).getTime() / 1000)}:R>`,
      ].join('\n')));

      if (game.description && game.description.trim()) {
        c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
        const desc = game.description.length > 400 ? game.description.slice(0, 400) + '...' : game.description;
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(desc));
      }

      c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('play')
          .setURL(`https://www.roblox.com/games/${game.rootPlaceId || game.id}`)
          .setStyle(ButtonStyle.Link),
      );
      c.addActionRowComponents(row);

      return interaction.editReply({ components: [c], flags: V2_E });
    }

    /* ──── RANDOM ──── */
    if (sub === 'random') {
      const game = await getRandomGame();
      if (!game) {
        return interaction.editReply({ components: [errBox('failed to fetch a random game. try again.')], flags: V2_E });
      }

      const universeId = game.universeId;
      let thumb = null;
      try {
        const res = await fetch(
          `https://thumbnails.roblox.com/v1/games/multiget/thumbnails?universeIds=${universeId}&size=768x432&format=Png&countPerUniverse=1`
        );
        const data = await res.json();
        thumb = data?.data?.[0]?.thumbnails?.[0]?.imageUrl || null;
      } catch {}

      const c = new ContainerBuilder()
        .setAccentColor(COLORS.pink)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.sneaky} random game`));

      if (thumb) {
        c.addMediaGalleryComponents(
          new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(thumb))
        );
      }

      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${game.name}`));
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `-# 👀 ${num(game.playing || 0)} playing · by **${game.creatorName || 'unknown'}**`
      ));

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('play')
          .setURL(`https://www.roblox.com/games/${game.rootPlaceId || game.placeId}`)
          .setStyle(ButtonStyle.Link),
      );
      c.addActionRowComponents(row);

      return interaction.editReply({ components: [c], flags: V2_E });
    }
  },
};
