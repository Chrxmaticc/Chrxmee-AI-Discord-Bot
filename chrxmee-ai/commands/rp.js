const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

// ─── CUSTOM EMOJIS ──────────────────────────────
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

// ─── ACTION → DISPLAY EMOJI ────────────────────
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

// All supported actions
const ALL_ACTIONS = Object.keys(RP_EMOJIS);

// ─── 5‑FALLBACK GIF FETCHER (no API key) ──────
async function fetchGifFromApis(action) {
  // 1. Waifu.pics
  try {
    const res = await fetch(`https://api.waifu.pics/sfw/${action}`);
    const data = await res.json();
    if (data.url) return data.url;
  } catch {}

  // 2. Nekos.best
  try {
    const res = await fetch(`https://nekos.best/api/v2/${action}`);
    const data = await res.json();
    if (data.results?.[0]?.url) return data.results[0].url;
  } catch {}

  // 3. PurrBot
  try {
    const res = await fetch(`https://purrbot.site/api/img/sfw/${action}/gif`);
    const data = await res.json();
    if (data.link) return data.link;
  } catch {}

  // 4. Nekos.best "hug" as generic fallback
  try {
    const res = await fetch(`https://nekos.best/api/v2/hug`);
    const data = await res.json();
    if (data.results?.[0]?.url) return data.results[0].url;
  } catch {}

  // 5. Nekos.moe random (last resort)
  try {
    const res = await fetch(`https://nekos.moe/api/v1/random/image`);
    const data = await res.json();
    if (data.id) return `https://nekos.moe/image/${data.id}`;
  } catch {}

  // 6. Hardcoded fallback (in case even Nekos.moe is down)
  return "https://i.giphy.com/media/eZH6Q7_lEzQAAAAC/giphy.gif";
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("rp")
    .setDescription("roleplay actions with animated gifs")
    .addStringOption(opt =>
      opt.setName("action")
        .setDescription("what to do (start typing to see suggestions)")
        .setRequired(true)
        .setAutocomplete(true))
    .addUserOption(opt =>
      opt.setName("user")
        .setDescription("who to do it to")
        .setRequired(false)),

  // ─── AUTOCOMPLETE ─────────────────────────────
  async autocomplete(interaction) {
    const focused = interaction.options.getFocused().toLowerCase();
    const filtered = ALL_ACTIONS.filter(a => a.startsWith(focused));
    await interaction.respond(
      filtered.map(a => ({ name: a, value: a }))
    );
  },

  // ─── EXECUTE ──────────────────────────────────
  async execute(interaction) {
    const action = interaction.options.getString("action");
    const target = interaction.options.getUser("user");
    const self = interaction.user;

    if (!ALL_ACTIONS.includes(action)) {
      return interaction.reply({ content: `${E.error} unknown action. try one from the suggestions.`, ephemeral: true });
    }

    await interaction.deferReply();

    const gifUrl = await fetchGifFromApis(action);
    const emoji = RP_EMOJIS[action] || E.agree;

    const embed = new EmbedBuilder()
      .setColor(0x7c7ce0)                      // periwinkle
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
