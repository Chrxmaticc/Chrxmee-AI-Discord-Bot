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
      .setDescription("I am your smart AI friend, available everywhere in Discord! Here is what i can do! Please know this is Update 1.25, the Personalization & Security Update!")
      .addFields(
        { name: "🤖 /ask [question]", value: "Chat with me! I have a 'brain' and remember our conversation history. You can also set personal info about yourself with `/setpersonal`." },
        { name: "💬 /chat", value: "Start a continuous conversation session. No /commands needed!" },
        { name: "⚙️ /custom-interactions", value: "Set a permanent custom personality for me! E.g., 'act sarcastic and natural'. I will remember this across all commands!" },
        { name: "📡 /auto-respond", value: "Enable auto-replies in a channel, or let a moderator create a dedicated AI chat room!" },
        { name: "💻 /code-generate [prompt]", value: "Generate professional code snippets in any language." },
        { name: "🎭 /model [type]", value: "Change my personality: **Smart**, **Fast**, or **Thinker**." },
        { name: "🔄 /translate [text] [language]", value: "Translate any text into your desired language instantly." },
        { name: "📝 /summarize [text]", value: "Get a concise summary of long paragraphs or articles." },
        { name: "📊 /status", value: "Check my current state, your active model, and memory usage." },
        { name: "🧠 /clear-brain", value: "Wipe my memory of our current conversation to start fresh." },
        { name: "🛡️ /guild-settings", value: "Server owners can set how I wake up (pings, commands, or off)." }
      ) 
      .setFooter({ text: "Installed as a User App - use me in DMs, Groups, and any Server!" })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};