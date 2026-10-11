const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { unfurl, fetch_url, looksLikeLarp, callAI } = require("../tools");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("debug-url")
    .setDescription("debug why url fetching fails")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o => o.setName("url").setDescription("url to test").setRequired(true)),

  async execute(interaction, client) {
    await interaction.deferReply();
    const url = interaction.options.getString("url");
    const report = [];

    // 1. unfurl()
    report.push("**1. unfurl()**");
    let unfurled = null;
    try {
      const t = Date.now();
      const result = await unfurl(url);
      unfurled = result;
      report.push(`✅ ${Date.now() - t}ms · site: \`${result.site.name}\` · kind: \`${result.data.kind}\``);
      report.push(`title: ${result.data.title || result.data.ogTitle || "none"}`);
      report.push(`desc: ${(result.data.description || "none").slice(0, 200)}`);
    } catch (err) {
      report.push(`❌ ${err.message}`);
    }

    // 2. fetch_url() fallback
    report.push("\n**2. fetch_url()**");
    try {
      const t = Date.now();
      const text = await fetch_url(url);
      report.push(`✅ ${Date.now() - t}ms · ${text.length} chars`);
      report.push(`preview: \`${text.slice(0, 150).replace(/\n/g, " ")}\``);
    } catch (err) {
      report.push(`❌ ${err.message}`);
    }

    // 3. what the AI would see
    if (unfurled) {
      report.push("\n**3. payload for AI**");
      report.push(`\`\`\`\n${JSON.stringify(unfurled.data).slice(0, 300)}\n\`\`\``);
    }

    // 4. will the AI LARP?
    report.push("\n**4. AI test**");
    try {
      const ctxData = unfurled
        ? JSON.stringify(unfurled.data).slice(0, 1200)
        : "[fetch failed]";
      const resp = await callAI("speedster", [
        { role: "system", content: "you have web access. describe what's in the context. NEVER say 'i can't visit sites' or 'text-based gremlin' or 'no browser powers'." },
        { role: "user", content: `here's what i found at ${url}:\n\n${ctxData}\n\ndescribe this site.` },
      ], 0.7, 300);
      report.push(`reply: ${resp.slice(0, 350)}`);
      report.push(`LARP detector: ${looksLikeLarp(resp) ? "❌ TRIGGERED" : "✅ clean"}`);
    } catch (err) {
      report.push(`❌ ai failed: ${err.message}`);
    }

    // 5. what the bot actually sends in normal chat
    report.push("\n**5. verdict**");
    if (!unfurled && !report.some(l => l.includes("✅"))) {
      report.push("→ fetch is broken. url tools never get data.");
    } else if (unfurled) {
      report.push("→ fetch WORKS. if normal chat still larps, the LARP-detector block isn't wired into messageCreate.js.");
    }

    await interaction.editReply({ content: report.join("\n").slice(0, 1900) });
  },
};
