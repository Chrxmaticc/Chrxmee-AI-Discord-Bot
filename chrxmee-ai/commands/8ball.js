const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('8ball')
    .setDescription('Ask the magic 8-ball a question (9 layers of chaos)')
    .addStringOption(option =>
      option.setName('question')
        .setDescription('Your question for the 8-ball')
        .setRequired(true)
    ),
  async execute(interaction) {
    await interaction.deferReply();

    const question = interaction.options.getString('question');

    // 9 arrays - each layer adds its own flavor of randomness
    const array1 = ["Yes, definitely", "No way", "Absolutely", "Not in a million years", "Maybe..."];
    const array2 = ["...but only if you", "...unless you", "...if you dare", "...when hell freezes over", "...in your wildest dreams"];
    const array3 = ["sacrifice your left sock", "dance in the snow naked", "roast me first", "feed me your secrets", "survive the next hour"];
    const array4 = ["while screaming", "at 3 AM", "with a straight face", "in reverse", "under the moonlight"];
    const array5 = ["or the universe explodes", "and the snow melts", "but Chrxmee AI judges you", "while the void watches", "and nobody claps"];
    const array6 = ["...probably", "...definitely not", "...ask again later", "...better not tell you now", "...without a doubt"];
    const array7 = ["(trust me)", "(don't trust me)", "(I'm lying)", "(I'm always right)", "(Chrxmee knows all)"];
    const array8 = ["❄️", "🚀", "💀", "🔥", "😭"];
    const array9 = ["Chrxmee AI has spoken.", "The snow has decided.", "Chrxmee approves... maybe.", "The void is laughing.", "Good luck lol."];

    // Pick one random item from each array
    const pickRandom = arr => arr[Math.floor(Math.random() * arr.length)];

    const response = [
      pickRandom(array1),
      pickRandom(array2),
      pickRandom(array3),
      pickRandom(array4),
      pickRandom(array5),
      pickRandom(array6),
      pickRandom(array7),
      pickRandom(array8),
      pickRandom(array9)
    ].join(' ');

    const embed = {
      color: 0xFF69B4, // Hot pink for chaos
      title: '🎱 The Magic 8-Ball Speaks...',
      description: `**Question:** ${question}\n\n**Answer:** ${response}`,
      footer: { text: 'Chrxmee AI - Chaos Level 9000 ❄️' }
    };

    await interaction.editReply({ embeds: [embed] });
  },
};