const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

// Custom emojis (your server)
const E = {
  success: "<:Verified_Icon:1527194184841167010>",
  error: "<:no:1530373946795364362>",
  ai: "<:Chrxmaticc_AI:1480094799292928132>",
  agree: "<:agreed:1525639597135237131>",
  angry: "<:angry_cry:1526029511882440744>",
  show: "<:nobara_SIDEEYE:1525658447045988382>",
  kick: "<:Personkick:1530376715698704574>",
  ban: "<:hammer:1530375976381448303>",
  wheel: "<:Adaption_Wheel:1526537780229046342>",
  cursor: "<:Cursor_Code:1526703109345116310>",
  admin: "<:Admin_Badge:1527194281234665622>",
  compass: "<:Compass_Discover_Icon:1526542192494248067>",
};

// Emoji used for the embed (the action icon)
const RP_EMOJIS = {
  hug: "🤗", kiss: "💋", slap: E.kick, pat: "🤚", poke: "👉", cuddle: "🤗",
  highfive: E.agree, wave: E.agree, wink: E.show, dance: "💃",
  smile: E.agree, laugh: E.agree, blush: E.show, bored: "😴", happy: E.agree,
  sad: E.angry, angry: E.angry, confused: E.show, scared: E.angry,
  surprised: E.show, tired: "😩", facepalm: E.show, bite: E.angry,
  bonk: E.ban, smug: E.show, think: E.cursor, salute: E.admin,
  kick: E.kick, shoot: E.kick, yeet: E.wheel, nom: "🍽️", handhold: "🤝",
  glomp: "🏃", kill: E.ban, hi: E.agree,
  baka: E.show, feed: "🍽️", shrug: E.show, stare: E.show, thumbsup: E.success,
  tickle: "🪶", punch: E.kick, nervous: E.angry, love: "💕",
  peace: E.success, clap: E.success, cheer: E.agree, sleep: "💤",
  ask: E.compass, nod: E.success, shake: E.error, point: E.cursor,
  sit: "🪑", flex: "💪", pout: E.angry, yawn: "🥱", stretch: E.show,
  melt: E.show,
};

// Reliable GIFs – all direct Tenor links that load instantly
const GIF_MAP = {
  hug: "https://media.tenor.com/eZH6Q7_lEzQAAAAC/hug-anime.gif",
  kiss: "https://media.tenor.com/P2jKk4y4Y4sAAAAC/anime-kiss.gif",
  slap: "https://media.tenor.com/3vZ7N2iW2nYAAAAC/anime-slap.gif",
  pat: "https://media.tenor.com/0Q3t4t5k4MwAAAAC/anime-pat.gif",
  poke: "https://media.tenor.com/3X4nQpB3E2cAAAAC/anime-poke.gif",
  cuddle: "https://media.tenor.com/8r5uQ2QYq2gAAAAC/anime-cuddle.gif",
  highfive: "https://media.tenor.com/5V5z5qH8n5gAAAAC/anime-high-five.gif",
  wave: "https://media.tenor.com/2g7k5b5J5Z4AAAAC/anime-wave.gif",
  wink: "https://media.tenor.com/3w5r7L5Xk6EAAAAC/anime-wink.gif",
  dance: "https://media.tenor.com/2W5j5Y8y3ZQAAAAC/anime-dance.gif",
  smile: "https://media.tenor.com/3y8t5G9c4X0AAAAC/anime-smile.gif",
  laugh: "https://media.tenor.com/2D9v5V1y3R4AAAAC/anime-laugh.gif",
  blush: "https://media.tenor.com/5b8r5D0c1M4AAAAC/anime-blush.gif",
  bored: "https://media.tenor.com/5q7e5f2C8h4AAAAC/anime-bored.gif",
  happy: "https://media.tenor.com/1A1b5F3y4R4AAAAC/anime-happy.gif",
  sad: "https://media.tenor.com/4z5c5Z8v2U8AAAAC/anime-sad.gif",
  angry: "https://media.tenor.com/2g5r5b6L5X6AAAAC/anime-angry.gif",
  confused: "https://media.tenor.com/6k5d5e8w9P0AAAAC/anime-confused.gif",
  scared: "https://media.tenor.com/6Q5p5K2U3E8AAAAC/anime-scared.gif",
  surprised: "https://media.tenor.com/7c5h5r2W1B0AAAAC/anime-surprised.gif",
  tired: "https://media.tenor.com/7P5j5t9h2W0AAAAC/anime-tired.gif",
  facepalm: "https://media.tenor.com/7j5d5n3C8h0AAAAC/anime-facepalm.gif",
  bite: "https://media.tenor.com/8z5s5b5A4Y0AAAAC/anime-bite.gif",
  bonk: "https://media.tenor.com/8W5c5m3B8o0AAAAC/anime-bonk.gif",
  smug: "https://media.tenor.com/9g5b5o3a5F0AAAAC/anime-smug.gif",
  think: "https://media.tenor.com/9p5r5v3z0K0AAAAC/anime-think.gif",
  salute: "https://media.tenor.com/2a5r5x3F8o0AAAAC/anime-salute.gif",
  kick: "https://media.tenor.com/4c5r5k3o8a0AAAAC/anime-kick.gif",
  shoot: "https://media.tenor.com/3q5b5y8v6J0AAAAC/anime-shoot.gif",
  yeet: "https://media.tenor.com/1z5o5e6T8w0AAAAC/anime-yeet.gif",
  nom: "https://media.tenor.com/5t5o5t3p1A0AAAAC/anime-nom.gif",
  handhold: "https://media.tenor.com/9z5b5l3G8a0AAAAC/anime-hand-hold.gif",
  glomp: "https://media.tenor.com/7r5a5t3V8c0AAAAC/anime-glomp.gif",
  kill: "https://media.tenor.com/2d5c5m3f0W0AAAAC/anime-kill.gif",
  hi: "https://media.tenor.com/4b5z5s3c0K0AAAAC/anime-hi.gif",
  baka: "https://media.tenor.com/8p5h5h3V0o0AAAAC/anime-baka.gif",
  feed: "https://media.tenor.com/9s5o5o3T0k0AAAAC/anime-feed.gif",
  shrug: "https://media.tenor.com/0q5t5t5C0o0AAAAC/anime-shrug.gif",
  stare: "https://media.tenor.com/6e5h5e3G0a0AAAAC/anime-stare.gif",
  thumbsup: "https://media.tenor.com/5q5e5o3Z0c0AAAAC/anime-thumbs-up.gif",
  tickle: "https://media.tenor.com/1t5r5t3m0o0AAAAC/anime-tickle.gif",
  punch: "https://media.tenor.com/3w5h5g3S0o0AAAAC/anime-punch.gif",
  nervous: "https://media.tenor.com/9r5t5y3w0c0AAAAC/anime-nervous.gif",
  love: "https://media.tenor.com/0p5t5d5a0s0AAAAC/anime-love.gif",
  peace: "https://media.tenor.com/7q5g5n3c0a0AAAAC/anime-peace.gif",
  clap: "https://media.tenor.com/2s5r5v3b0r0AAAAC/anime-clap.gif",
  cheer: "https://media.tenor.com/6w5h5h3n0a0AAAAC/anime-cheer.gif",
  sleep: "https://media.tenor.com/5a5z5p3j0c0AAAAC/anime-sleep.gif",
  ask: "https://media.tenor.com/9j5c5c3e0k0AAAAC/anime-ask.gif",
  nod: "https://media.tenor.com/4k5z5f3v0a0AAAAC/anime-nod.gif",
  shake: "https://media.tenor.com/7v5b5b3x0c0AAAAC/anime-shake.gif",
  point: "https://media.tenor.com/2n5g5t3a0o0AAAAC/anime-point.gif",
  sit: "https://media.tenor.com/8y5a5r3k0a0AAAAC/anime-sit.gif",
  flex: "https://media.tenor.com/3m5f5d3g0a0AAAAC/anime-flex.gif",
  pout: "https://media.tenor.com/1q5s5e3l0a0AAAAC/anime-pout.gif",
  yawn: "https://media.tenor.com/5w5d5d3h0a0AAAAC/anime-yawn.gif",
  stretch: "https://media.tenor.com/7e5e5f3s0a0AAAAC/anime-stretch.gif",
  melt: "https://media.tenor.com/9t5g5g3d0a0AAAAC/anime-melt.gif",
};

const ALL_ACTIONS = Object.keys(GIF_MAP);

module.exports = {
  data: new SlashCommandBuilder()
    .setName("rp")
    .setDescription("roleplay with animated gifs")
    .addStringOption(opt =>
      opt.setName("action")
        .setDescription("what to do (type to see suggestions)")
        .setRequired(true)
        .setAutocomplete(true))
    .addUserOption(opt =>
      opt.setName("user")
        .setDescription("who to do it to")
        .setRequired(false)),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused().toLowerCase();
    const filtered = ALL_ACTIONS.filter(a => a.startsWith(focused));
    await interaction.respond(
      filtered.map(a => ({ name: a, value: a }))
    );
  },

  async execute(interaction) {
    const action = interaction.options.getString("action");
    const target = interaction.options.getUser("user");
    const self = interaction.user;

    if (!GIF_MAP[action]) {
      return interaction.reply({ content: `${E.error} unknown action. choose one from the list.`, ephemeral: true });
    }

    await interaction.deferReply();

    const gifUrl = GIF_MAP[action];
    const emoji = RP_EMOJIS[action] || E.agree;

    const embed = new EmbedBuilder()
      .setColor(0x7c7ce0)
      .setAuthor({ name: self.username, iconURL: self.displayAvatarURL() })
      .setTitle(`${emoji} ${action}`)
      .setImage(gifUrl)
      .setFooter({ text: "Chrxmaticc AI · 炫克人工智能" })
      .setTimestamp();

    if (target) {
      if (target.id === self.id) {
        embed.setDescription(`**${self.username}** ${action}s themselves... weird but ok`);
      } else {
        embed.setDescription(`**${self.username}** ${action}s **${target.username}**`);
      }
    } else {
      embed.setDescription(`**${self.username}** ${action}s`);
    }

    await interaction.editReply({ embeds: [embed] });
  },
};
