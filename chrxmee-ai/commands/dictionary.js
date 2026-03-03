const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dictionary')
    .setDescription('Look up a word on Urban Dictionary')
    .addStringOption(option =>
      option.setName('word')
        .setDescription('The word or phrase to define')
        .setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false }); // First line — no expired

    const word = interaction.options.getString('word').trim();

    try {
      const res = await fetch(`http://api.urbandictionary.com/v0/define?term=${encodeURIComponent(word)}`);
      const data = await res.json();

      if (!data.list || data.list.length === 0) {
        return interaction.editReply(`No definition found for "${word}"... maybe it's too underground even for Urban.`);
      }

      const def = data.list[0]; // Top result
      const embed = new EmbedBuilder()
        .setColor('#1e90ff')
        .setTitle(`Urban Dictionary: ${def.word}`)
        .setDescription(def.definition.replace(/\[|\]/g, '')) // Clean brackets
        .addFields(
          { name: 'Example', value: def.example ? def.example.replace(/\[|\]/g, '') : 'No example given', inline: false },
          { name: '👍 / 👎', value: `${def.thumbs_up} / ${def.thumbs_down}`, inline: true },
          { name: 'By', value: def.author || 'Anonymous', inline: true }
        )
        .setFooter({ text: 'Urban Dictionary — definitions from the streets' });

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('Urban fetch error:', err);
      return interaction.editReply('Urban Dictionary is down or WiFi betrayed me... try again?');
    }
  }
};
