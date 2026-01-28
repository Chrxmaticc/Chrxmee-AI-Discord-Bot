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
      .setDescription("I am your smart AI friend, available everywhere in Discord! Here is what i can do! Please know this is Update 1.21, the personalization update!")
      .addFields(
        { name: "🤖 /ask [question]", value: "Chat with me! I have a 'brain' and remember our conversation history. also you can set personal info about yourself with /set. the owner does NOT get your information you send in this bot, you can do this to make the AI feel more personal to you." },
        { name: "💬 /chat", value: "Start a continuous conversation session. No /commands needed! Session times out after 3-5 minutes of inactivity." },
        { name: "💻 /code-generate [prompt]", value: "Generate professional code snippets in any language." },
        { name: "🎭 /model [type]", value: "Change my personality: **Smart**, **Fast**, or **Thinker**." },
        { name: "🔄 /translate [text] [language]", value: "Translate any text into your desired language instantly." },
        { name: "📝 /summarize [text]", value: "Get a concise summary of long paragraphs or articles." },
        { name: "📊 /status", value: "Check my current state, your active model, and memory usage." },
        { name: "🧠 /clear-brain", value: "Wipe my memory of our current conversation to start fresh. A seperate command to wipe personal info memory." },
        { name: "🛡️ Safety First", value: "If something is 'too wild', I'll ask to explain it in a different way! No inappropriate content allowed!" }
      ) 
      .setFooter({ text: "Installed as a User App - use me in DMs, Groups, and any Server!" })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};