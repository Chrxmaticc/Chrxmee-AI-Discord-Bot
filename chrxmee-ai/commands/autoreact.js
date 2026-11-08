// commands/autoreact.js
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

// The complete master list of Chromed's custom emojis
const CUSTOM_EMOJIS = {
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
  geto_blank: "<:geto_blank:1525658200622239756>",
  money_cry: "<:Money_Cry_Son:1526538340264841257>",
  sneaky: "<:sneaky:1527401423690792970>",
  qsob: "<:qsob:1526706054396645487>",
  samsunghot: "<:samsunghot:1527401208862736615>",
  son: "<:Son:1526536930693484575>",
  son_3: "<:Son_3:1529441775461339196>",
  cringe_laugh: "<:Cringe_Laughing_Son:1526539082564374710>",
  happy_cry: "<:happy_cry:1526029243333611530>",
  larp: "<:larp:1527401314034651246>",
  manguns: "<:manguns:1526537075778654329>",
  point_laugh: "<:PointAndLaughingEmoji:1525657154567016469>",
  golden_verified: "<:Golden_Verified:1531893351920697484>",
  reply_continued: "<:Reply_Continued:1531902914824638584>",
  skulllmao: "<a:skulllmao:1544845693762535477>",
  emoji_52: "<a:emoji_52:1544845538329895032>",
  bugs: "<:Bugs_Blurple:1531909906129490091>",
  gold_discord: "<:GoldDiscord:1531896474529431668>",
  channel: "<:Channel:1531901854361849929>",
  forum: "<:Forum:1531902590315397190>",
  threads: "<:Threads:1531902029113327678>",
  off: "<:off:1545571608897265726>",
  on: "<:on:1545571641684135946>",
  trash: "<:sad_trashcan:1559006806825504779>",
  timer: "<:Timer:1559004828733018203>",
  warning: "<:lowwarning:1559014951975395351>",
  cloud: "<:cloud1:1559007926952132628>",
  download: "<:download_icon:1559007171914637332>",
  inbox: "<:inbox:1559008785702457445>",
  friends: "<:Friends:1550655356445659226>",
  brain: "<:Brain:1560402629014716558>",
  speak: "<:reply:1560405605686972516>",
  chance: "<:pixel_symbol_percent:1560405457045168238>",
  gif: "<:gif:1560405126705979394>",
  mention: "<:discord_mention:1560403284391497801>",
  filter: "<:Filter:1560402991985729662>",
  pencil: "<:pencil:1560405746904997929>",
  settings_alt: "<:settings:1560405283178684508>",
  deafened: "<:deafened:1560403980918464562>",
  erm_actually: "<:528326ermactually:1552750943555027065>",
  brown_angry: "<:brown_angry:1552750966753984666>",
  ngacry: "<:ngacry:1552750963327111210>",
  verylaugh: "<:verylaugh:1552750958402863225>",
  pleading: "<:pleading:1562375340301488188>",
  crying_angry: "<:crying_while_angry:1552750908977320028>",
  phone: "<:Phone:1568008806124757094>",
};

// In-memory cache so we don't spam the DB on every message
const reactCache = new Map();

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS autoreacts (
      guild_id TEXT NOT NULL,
      word TEXT NOT NULL,
      emoji TEXT NOT NULL,
      PRIMARY KEY(guild_id, word)
    );
  `);
}
ensureTable().catch(console.error);

module.exports = {
  data: new SlashCommandBuilder()
    .setName("autoreact")
    .setDescription("make chromed auto-react to specific words")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) =>
      s.setName("add").setDescription("add a new auto-reaction")
        .addStringOption((o) => o.setName("word").setDescription("the word to trigger on").setRequired(true))
        .addStringOption((o) => o.setName("emoji").setDescription("pick an emoji or type a custom one").setRequired(true).setAutocomplete(true))
    )
    .addSubcommand((s) =>
      s.setName("remove").setDescription("remove an auto-reaction")
        .addStringOption((o) => o.setName("word").setDescription("the word to remove").setRequired(true))
    )
    .addSubcommand((s) => s.setName("list").setDescription("see all auto-reactions in this server")),

  // ── AUTOCOMPLETE: Shows the emoji visually in the list ──
  async autocomplete(interaction) {
    const focused = interaction.options.getFocused().toLowerCase();
    
    const filtered = Object.entries(CUSTOM_EMOJIS)
      .filter(([name]) => name.includes(focused))
      .slice(0, 25)
      .map(([name, emoji]) => ({
        name: `${name} (${emoji})`, // Shows "skulllmao (<a:skulllmao:...>)" in the UI
        value: name                 // Sends "skulllmao" to the bot
      }));

    await interaction.respond(filtered).catch(() => {});
  },

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    await interaction.deferReply();

    if (sub === "add") {
      const word = interaction.options.getString("word").toLowerCase().trim();
      let emoji = interaction.options.getString("emoji").trim();

      // If they picked from the autocomplete list (e.g. "skulllmao"), convert to raw ID
      if (CUSTOM_EMOJIS[emoji]) {
        emoji = CUSTOM_EMOJIS[emoji];
      }

      // Validate emoji format (needs to be unicode or <:name:id>)
      const isCustom = /^<a?:\w+:\d+>$/.test(emoji);
      const isUnicode = emoji.length <= 8 && !emoji.startsWith("<");
      if (!isCustom && !isUnicode) {
        return interaction.editReply("<:deny:1569040642984910848> that's not a valid emoji. pick one from the list or use a standard emoji.");
      }

      await pool.query(
        `INSERT INTO autoreacts (guild_id, word, emoji) VALUES ($1, $2, $3)
         ON CONFLICT (guild_id, word) DO UPDATE SET emoji = $3`,
        [guildId, word, emoji]
      );

      reactCache.delete(guildId); // Clear cache so it updates instantly
      return interaction.editReply(`<:approve:1569040720189194410> now reacting to \`${word}\` with ${emoji}`);
    }

    if (sub === "remove") {
      const word = interaction.options.getString("word").toLowerCase().trim();
      const res = await pool.query(`DELETE FROM autoreacts WHERE guild_id = $1 AND word = $2`, [guildId, word]);
      
      if (res.rowCount === 0) return interaction.editReply(`<:deny:1569040642984910848> \`${word}\` isn't in the autoreact list.`);
      
      reactCache.delete(guildId);
      return interaction.editReply(`<:approve:1569040720189194410> removed reaction for \`${word}\`.`);
    }

    if (sub === "list") {
      const res = await pool.query(`SELECT word, emoji FROM autoreacts WHERE guild_id = $1`, [guildId]);
      if (!res.rows.length) return interaction.editReply("no autoreacts set up yet.");
      
      const list = res.rows.map(r => `\`${r.word}\` → ${r.emoji}`).join("\n");
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x7c7ce0).setTitle("Auto-Reactions").setDescription(list)] });
    }
  },
  
  // Export these so events/autoreact.js can access them
  _pool: pool,
  _cache: reactCache
};
