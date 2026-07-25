const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

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
  wave2: E.agree, melt: E.show,
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
        .setDescription("what to do (start typing to see suggestions)")
        .setRequired(true)
        .setAutocomplete(true))  // autocomplete instead of choices
    .addUserOption(opt =>
      opt.setName("user")
        .setDescription("who to do it to")
        .setRequired(false)),

  // ─── AUTOCOMPLETE HANDLER ──────────────────────
  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused().toLowerCase();
    const filtered = ALL_ACTIONS.filter(action => action.startsWith(focusedValue));
    await interaction.respond(
      filtered.map(action => ({ name: action, value: action }))
    );
  },

  async execute(interaction) {
    const action = interaction.options.getString("action");
    const target = interaction.options.getUser("user");
    const self = interaction.user;

    // Validate action exists in our list
    if (!ALL_ACTIONS.includes(action)) {
      return interaction.reply({ content: `${E.error} unknown action. try one from the suggestions.`, ephemeral: true });
    }

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
