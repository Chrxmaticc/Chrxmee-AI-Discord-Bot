const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("List all of Chrxmee AI's features and commands")
    .setContexts([0, 1, 2])
    .setIntegrationTypes([0, 1]),
  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle("Chrxmee AI - Help Menu")
      .setDescription("I am your smart AI friend, available everywhere in Discord! Update 1.30: Extended Brain & Polls Update!")
      .addFields(
        { name: "🤖 /ask [question]", value: "Chat with me! Now with 2.5x larger memory (25 messages)!" },
        { name: "💬 /chat", value: "Continuous conversation! Auto-responds now remember 30 messages!" },
        { name: "⚙️ /custom-interactions", value: "Set personality OR type 'reset' to go back to basic models." },
        { name: "📊 /poll", value: "Create quick react-polls in the channel! (Max 5 options)" },
        { name: "📡 /auto-respond", value: "Automatic replies with full personal info recall!" },
        { name: "💻 /code-generate", value: "Professional code snippets." },
        { name: "🔄 /translate", value: "Translate text while keeping your custom personality style!" },
        { name: "📝 /summarize", value: "Concise summaries of any text." },
        { name: "📊 /status", value: "View latency, history depth, and active personality." },
        { name: "🧠 /forgetpersonal", value: "Wipe your info from the bot and the database." }
      ) 
      .setFooter({ text: "Chrxmee AI - Smarter, Faster, More Personal. ❄️" })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};