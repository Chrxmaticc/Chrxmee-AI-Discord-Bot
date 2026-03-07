const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const LEVEL_IMAGES = {
  1: 'https://i.imgur.com/ivsMjnE.jpeg',   // Seed
  2: 'https://i.imgur.com/Yet1dIp.jpeg',   // Small branch
  3: 'https://i.imgur.com/Yet1dIp.jpeg',   // Young twigs
  4: 'https://i.imgur.com/As6ia5r.jpeg',   // Morning sun fuller
  5: 'https://i.imgur.com/mEmGhpu.jpeg',   // Mature trunks blue sky
  6: 'https://i.imgur.com/sr5qw7S.jpeg',   // Morning sunshine
  7: 'https://i.imgur.com/61nnoFM.jpeg'    // Mastery (full tree)
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('skill-learn')
    .setDescription('RPG skill tree – grow, master, learn')
    .addSubcommand(subcommand =>
      subcommand
        .setName('focus')
        .setDescription('Set your current skill focus')
        .addStringOption(opt => opt.setName('skill')
          .setDescription('e.g. Coding, Drawing, Fitness')
          .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('tell')
        .setDescription('Report what you learned')
        .addStringOption(opt => opt.setName('what')
          .setDescription('Describe what you learned today')
          .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('view')
        .setDescription('See your skill tree')),

  async execute(interaction, client) {
    await interaction.deferReply({ ephemeral: false });

    const userId = interaction.user.id;
    let userData = client.memory.get(`skilltree_${userId}`) || {
      focus: null,
      level: 1,
      xp: 0,
      learned: []
    };

    const sub = interaction.options.getSubcommand();

    if (sub === 'focus') {
      const skill = interaction.options.getString('skill').trim();
      userData.focus = skill;
      client.memory.set(`skilltree_${userId}`, userData);
      return interaction.editReply(`Focus set to **${skill}**. Start growing! 🌱`);
    }

    if (sub === 'tell') {
      if (!userData.focus) {
        return interaction.editReply('Set a focus skill first: `/skill-learn focus <skill>`');
      }

      const what = interaction.options.getString('what').trim();
      userData.learned.push({ date: new Date(), text: what });

      userData.xp = (userData.xp || 0) + 1;
      const newLevel = Math.min(7, Math.floor(userData.xp / 5) + 1);

      if (newLevel > userData.level) {
        userData.level = newLevel;
        interaction.channel.send(`<@${userId}> reached **Level ${newLevel}** in ${userData.focus}! Tree growing... 🌳`);
      }

      client.memory.set(`skilltree_${userId}`, userData);

      return interaction.editReply(`Logged: "${what}" for **${userData.focus}** (+1 XP)\n\nKeep going!`);
    }

    if (sub === 'view') {
      const level = userData.level || 1;
      const img = LEVEL_IMAGES[level] || LEVEL_IMAGES[1];

      const progressBar = '█'.repeat(level) + '░'.repeat(7 - level);

      const embed = new EmbedBuilder()
        .setColor('#2f3136') // Breed dark theme
        .setTitle(`${interaction.user.username}'s Skill Tree`)
        .setDescription(`**Focus:** ${userData.focus || 'None set yet'}\n\n**Level ${level}/7** – ${level === 7 ? 'Mastery Unlocked 🌟' : 'Keep growing!'}\nProgress: [${progressBar}] ${level}/7`)
        .setImage(img) // Main tree image (your Imgur links)
        .addFields(
          { name: 'Learned Entries', value: `${userData.learned?.length || 0}`, inline: true },
          { name: 'XP', value: `${userData.xp || 0}`, inline: true }
        )
        .setFooter({ text: 'Report progress: /skill-learn tell' });

      return interaction.editReply({ embeds: [embed] });
    }
  }
};
