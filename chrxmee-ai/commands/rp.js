const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

const E = {
  success: "<:Verified_Icon:1527194184841167010>",
  error: "<:no:1530373946795364362>",
  ai: "<:Chrxmaticc_AI:1480094799292928132>",
  settings: "<:Settings:1525601248278216725>",
  dev: "<:Developer:1525492198035161192>",
  bot: "<:Bot:1525492838727548999>",
  js: "<:JavaScript:1526535186391633950>",
  python: "<:PythonIcon:1525493663604408350>",
  link: "<:Link:1525603398341103806>",
  agree: "<:agreed:1525639597135237131>",
  angry: "<:angry_cry:1526029511882440744>",
  announce: "<:Discord_Announcements:1526028541270167593>",
  owner: "<:Owner:1525494515169759253>",
  early: "<:Discord_EarlySupporter:1222721329296310354>",
  crown: "<:Holographic_owner_crown:1527401510487461969>",
  grok: "<:Grok:1527797491985027256>",
  chatgpt: "<:ChatGPT:1527796258184626418>",
  file: "<:File_Icon:1526542046213570681>",
  folder: "<:Folder_Icon:1526542112806539274>",
  cursor: "<:Cursor_Code:1526703109345116310>",
  pc: "<:Computer_PC:1526541989376688318>",
  compass: "<:Compass_Discover_Icon:1526542192494248067>",
  wheel: "<:Adaption_Wheel:1526537780229046342>",
  admin: "<:Admin_Badge:1527194281234665622>",
  rename: "<:Pencil:1530377899251601408>",
  limit: "<:member:1530383558710005960>",
  lock: "<:lock:1530377198324945056>",
  unlock: "<:unlock:1530377714995826831>",
  hide: "<:hellokitty_hide:1530376139854577735>",
  show: "<:nobara_SIDEEYE:1525658447045988382>",
  kick: "<:Personkick:1530376715698704574>",
  ban: "<:hammer:1530375976381448303>",
};

// Action emoji map — custom first, Unicode fallback
const RP_EMOJIS = {
  // Violence — use hammer/kick
  slap: E.kick, punch: E.kick, kick: E.kick, shoot: E.kick, kill: E.ban,
  bonk: E.ban, bite: E.angry, yeet: E.wheel,

  // Love/Cute — use agree for now, Unicode fallback
  hug: "🤗", kiss: "💋", cuddle: "🤗", pat: "🤚", poke: "👉",
  handhold: "🤝", glomp: "🏃", love: "💕", nom: "🍽️", feed: "🍽️",
  tickle: "🪶",

  // Happy/Positive — use agree/success
  laugh: E.agree, smile: E.agree, happy: E.agree, cheer: E.agree,
  dance: "💃", clap: E.success, thumbsup: E.success, peace: E.success,
  nod: E.success, wave: E.agree, highfive: E.agree, hi: E.agree,
  wink: E.show, flex: "💪",

  // Sad/Negative — use angry/error
  cry: E.angry, sad: E.angry, nervous: E.angry, scared: E.angry,
  angry: E.angry, pout: E.angry, tired: "😩", sleep: "💤",
  yawn: "🥱", bored: "😴",

  // Silly/Reaction — use nobara/show
  blush: E.show, smug: E.show, confused: E.show, surprised: E.show,
  facepalm: E.show, shrug: E.show, stare: E.show, baka: E.show,
  think: E.cursor, melt: E.show, stretch: E.show,

  // Misc
  salute: E.admin, ask: E.compass, point: E.cursor, sit: "🪑",
  shake: E.error, thumbsdown: E.error,
};

const WAIFU_ACTIONS = [
  "hug", "kiss", "slap", "pat", "poke", "cuddle", "highfive", "wave", "wink",
  "dance", "smile", "cry", "laugh", "blush", "bored", "happy", "sad", "angry",
  "confused", "scared", "surprised", "tired", "facepalm", "bite", "bonk",
  "smug", "think", "salute", "kick", "shoot", "yeet", "nom", "handhold", "glomp", "kill", "hi"
];

const NEKOS_ACTIONS = [
  "baka", "feed", "shrug", "stare", "thumbsup", "tickle", "punch", "nervous",
  "love", "peace", "clap", "cheer", "sleep", "ask", "nod", "shake", "point",
  "sit", "flex", "pout", "yawn", "stretch", "wave", "facepalm", "melt", "think"
];

const ALL_ACTIONS = [...new Set([...WAIFU_ACTIONS, ...NEKOS_ACTIONS])].sort();

module.exports = {
  data: new SlashCommandBuilder()
    .setName("rp")
    .setDescription("roleplay actions with gifs")
    .addStringOption(opt =>
      opt.setName("action")
        .setDescription("what to do")
        .setRequired(true)
        .addChoices(...ALL_ACTIONS.map(a => ({ name: a, value: a }))))
    .addUserOption(opt =>
      opt.setName("user")
        .setDescription("who to do it to")
        .setRequired(false)),

  async execute(interaction) {
    const action = interaction.options.getString("action");
    const target = interaction.options.getUser("user");
    const self = interaction.user;

    await interaction.deferReply();

    let gifUrl = null;

    if (WAIFU_ACTIONS.includes(action)) {
      try {
        const res = await fetch(`https://api.waifu.pics/sfw/${action}`);
        const data = await res.json();
        if (data.url) gifUrl = data.url;
      } catch {}
    }

    if (!gifUrl && NEKOS_ACTIONS.includes(action)) {
      try {
        const res = await fetch(`https://nekos.best/api/v2/${action}`);
        const data = await res.json();
        if (data.results?.[0]?.url) gifUrl = data.results[0].url;
      } catch {}
    }

    if (!gifUrl) {
      try {
        const res = await fetch(`https://nekos.best/api/v2/hug`);
        const data = await res.json();
        if (data.results?.[0]?.url) gifUrl = data.results[0].url;
      } catch {}
    }

    if (!gifUrl) {
      return interaction.editReply({ content: `${E.error} couldn't fetch a gif. try again.` });
    }

    const emoji = RP_EMOJIS[action] || E.agree;

    const embed = new EmbedBuilder()
      .setColor(0x7c7ce0)
      .setImage(gifUrl)
      .setFooter({ text: "Chrxmaticc AI · 炫克人工智能" })
      .setTimestamp();

    if (target) {
      if (target.id === self.id) {
        embed.setDescription(`${emoji} **${self.username}** ${action}s themselves... weird but ok`);
      } else {
        embed.setDescription(`${emoji} **${self.username}** ${action}s **${target.username}**`);
      }
    } else {
      embed.setDescription(`${emoji} **${self.username}** ${action}s`);
    }

    await interaction.editReply({ embeds: [embed] });
  },
};
