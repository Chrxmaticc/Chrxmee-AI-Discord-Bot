const { SlashCommandBuilder } = require("discord.js");

const MODES = {
  unfiltered:   { label: "🛡️ Unfiltered",     desc: "Calm academic. 10% filter. Discusses anything. No swearing." },
  insane:       { label: "🤪 Insane",          desc: "Chaotic caps, emoji overload, unhinged energy. Heavy swearing." },
  comedian:     { label: "🎤 Comedian",        desc: "Savage roaster, witty rejections with jokes. Casual swearing." },
  silent:       { label: "🥷 Silent",          desc: "Aggressive minimalist. Under 10 words. Aggressive swearing." },
  paranoid:     { label: "👻 Paranoid",        desc: "Casual conspiracies. They're watching. No swearing." },
  depressed:    { label: "💔 Depressed",       desc: "Melodramatic crying. Robot GF left. No swearing." },
  disappointed: { label: "😤 Disappointed",    desc: "\"I'm not mad, just disappointed\" but loud. Heavy swearing." },
  teacher:      { label: "🍎 Teacher",         desc: "Patient educator. 20% filter. Firm boundaries. No swearing." },
  vibe:         { label: "✌️ Vibe",            desc: "Chill and laid back. Good energy only. No swearing." },
  suspicious:   { label: "🕵️ Suspicious",      desc: "Everyone's a suspect. GET OUT MY BUILDING. Heavy swearing." },
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("mode")
    .setDescription("Switch Chrxmee AI's personality mode.")
    .setContexts([0, 1, 2])
    .setIntegrationTypes([0, 1])

    .addSubcommand(sub =>
      sub.setName("switch")
        .setDescription("Switch to a different AI personality mode.")
        .addStringOption(opt =>
          opt.setName("type")
            .setDescription("Choose a mode")
            .setRequired(true)
            .addChoices(
              { name: "🛡️ Unfiltered — Calm academic, discusses anything",        value: "unfiltered" },
              { name: "🤪 Insane — Chaotic caps, emoji overload, unhinged",       value: "insane" },
              { name: "🎤 Comedian — Savage roaster, witty rejections",           value: "comedian" },
              { name: "🥷 Silent — Aggressive minimalist, under 10 words",         value: "silent" },
              { name: "👻 Paranoid — Casual conspiracies, they're watching",       value: "paranoid" },
              { name: "💔 Depressed — Melodramatic crying, robot GF left",         value: "depressed" },
              { name: "😤 Disappointed — Loud disappointment, heavy swearing",     value: "disappointed" },
              { name: "🍎 Teacher — Patient educator, 20% filter",                 value: "teacher" },
              { name: "✌️ Vibe — Chill and laid back, good energy only",           value: "vibe" },
              { name: "🕵️ Suspicious — Everyone's a suspect, GET OUT",             value: "suspicious" },
            )
        )
    )

    .addSubcommand(sub =>
      sub.setName("reset")
        .setDescription("Reset your mode back to Unfiltered.")
    )

    .addSubcommand(sub =>
      sub.setName("info")
        .setDescription("See your current mode and what it does.")
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    let userData = interaction.client.memory.get(userId) || { history: [], model: "genius", mode: "unfiltered" };

    if (sub === "switch") {
      const type = interaction.options.getString("type");
      const mode = MODES[type];
      if (!mode) return interaction.reply({ content: "Unknown mode.", ephemeral: true });

      userData.mode = type;
      interaction.client.memory.set(userId, userData);

      const { Client } = require("pg");
      const db = new Client({ connectionString: process.env.DATABASE_URL });
      try {
        await db.connect();
        await db.query(
          `CREATE TABLE IF NOT EXISTS mode_interactions (
            user_id TEXT PRIMARY KEY,
            preferred_mode TEXT DEFAULT 'unfiltered'
          )`
        );
        await db.query(
          `INSERT INTO mode_interactions (user_id, preferred_mode)
           VALUES ($1, $2)
           ON CONFLICT (user_id) DO UPDATE SET preferred_mode = $2`,
          [userId, type]
        );
      } catch (err) {
        console.error("Mode switch DB error:", err.message);
      } finally {
        await db.end();
      }

      return interaction.reply(`✅ Switched to **${mode.label}**\n> ${mode.desc}`);
    }

    if (sub === "reset") {
      userData.mode = "unfiltered";
      interaction.client.memory.set(userId, userData);

      const { Client } = require("pg");
      const db = new Client({ connectionString: process.env.DATABASE_URL });
      try {
        await db.connect();
        await db.query(
          `INSERT INTO mode_interactions (user_id, preferred_mode)
           VALUES ($1, 'unfiltered')
           ON CONFLICT (user_id) DO UPDATE SET preferred_mode = 'unfiltered'`,
          [userId]
        );
      } catch (err) {
        console.error("Mode reset DB error:", err.message);
      } finally {
        await db.end();
      }

      return interaction.reply(`✅ Reset to **🛡️ Unfiltered** mode.`);
    }

    if (sub === "info") {
      const currentMode = MODES[userData.mode] || MODES["unfiltered"];

      return interaction.reply({
        content: `**Your Chrxmee AI Mode:**\n🎭 **Mode:** ${currentMode.label}\n> ${currentMode.desc}\n\nUse \`/mode switch\` to change it. Works alongside your \`/model\` choice!`,
        ephemeral: true
      });
    }
  },
};
