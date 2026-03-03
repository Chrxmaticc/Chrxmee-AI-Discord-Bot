const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const questions = [
  "Would you rather fight 100 duck-sized horses or 1 horse-sized duck?",
  "Would you rather have unlimited battery life on your phone or unlimited storage?",
  "Would you rather know the date of your death or the cause of your death?",
  "Would you rather be able to talk to animals or speak every human language fluently?",
  "Would you rather have fingers as long as your legs or legs as long as your fingers?",
  "Would you rather live in a world where everyone can read minds or everyone can fly?",
  "Would you rather have a rewind button for your life or a pause button?",
  "Would you rather be able to see 10 minutes into the future or 150 years into the future?",
  "Would you rather be the best player on a losing team or the worst player on a winning team?",
  "Would you rather have to wear a clown costume every day or have to sing everything you say?",
  "Would you rather be able to time travel but only to the past or only to the future?",
  "Would you rather have unlimited money but only spend it on other people or have no money but everything you need?",
  "Would you rather be stuck in a room with a tarantula or a room full of clowns?",
  "Would you rather have a permanent clown nose or permanent clown shoes?",
  "Would you rather be able to teleport anywhere but only once a day or be able to fly but only 10 feet off the ground?",
  "Would you rather have to eat only spicy food for the rest of your life or only bland food?",
  "Would you rather know every language or be able to play every instrument?",
  "Would you rather have to wear wet socks forever or have to wear shoes two sizes too small forever?",
  "Would you rather be able to stop time for 10 seconds a day or rewind time by 10 seconds once a day?",
  "Would you rather have a personal theme song play every time you enter a room or have a laugh track follow you everywhere?"
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('wouldyourather')
    .setDescription('Get a random Would You Rather question'),

  async execute(interaction) {
    // No defer needed here — instant reply, no heavy work
    const question = questions[Math.floor(Math.random() * questions.length)];

    const embed = new EmbedBuilder()
      .setColor('#7289da')
      .setTitle('Would You Rather...?')
      .setDescription(question)
      .setFooter({ text: 'Choose wisely... or don’t. Up to you.' });

    await interaction.reply({ embeds: [embed] });
  }
};
