const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');

const LEVEL_IMAGES = {
  1: 'https://i.imgur.com/seedling-row.jpg',       // Level 1 - tiny sprouts
  2: 'https://i.imgur.com/small-moss-sprout.jpg',  // Level 2 - small green sprout
  3: 'https://i.imgur.com/young-single-tree.jpg',  // Level 3 - young tree
  4: 'https://i.imgur.com/fig-tree-yard.jpg',      // Level 4 - small fig tree
  5: 'https://i.imgur.com/large-oak-sunset.jpg',   // Level 5 - large oak sunset
  6: 'https://i.imgur.com/big-oak-blue-sky.jpg',   // Level 6 - big oak in field
  7: 'https://i.imgur.com/massive-old-oak.jpg'     // Level 7 - massive old oak (mastery)
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
        return interaction.editReply({ content: 'Set a focus skill first: `/skill-learn focus <skill>`', ephemeral: true });
      }

      const what = interaction.options.getString('what').trim();
      userData.learned.push({ date: new Date(), text: what });

      // XP: +1 per report, level up every 5
      userData.xp = (userData.xp || 0) + 1;
      const newLevel = Math.min(7, Math.floor(userData.xp / 5) + 1);

      let levelUpMessage = null;
      if (newLevel > userData.level) {
        userData.level = newLevel;
        levelUpMessage = `<@${userId}> reached **Level ${newLevel}** in ${userData.focus}! Tree growing... 🌳`;
        interaction.channel.send(levelUpMessage);
      }

      client.memory.set(`skilltree_${userId}`, userData);

      return interaction.editReply({
        content: `Logged: "${what}" for **${userData.focus}** (+1 XP)\n\nKeep going!${levelUpMessage ? '\n' + levelUpMessage : ''}`,
        ephemeral: false
      });
    }

    if (sub === 'view') {
      const level = userData.level || 1;
      const img = LEVEL_IMAGES[level] || LEVEL_IMAGES[1];

      const progressBar = '█'.repeat(level) + '░'.repeat(7 - level);

      const embed = new EmbedBuilder()
        .setColor('#2f3136') // Breed dark
        .setTitle(`${interaction.user.username}'s Skill Tree`)
        .setDescription(`**Focus:** ${userData.focus || 'None set yet'}\n\n**Level ${level}/7** – ${level === 7 ? 'Mastered! 🌟' : 'Keep growing!'}\nProgress: [${progressBar}] ${level}/7`)
        .setImage(img) // Your image
        .addFields(
          { name: 'Learned Entries', value: `${userData.learned?.length || 0}`, inline: true },
          { name: 'XP', value: `${userData.xp || 0}`, inline: true }
        )
        .setFooter({ text: 'Report progress: /skill-learn tell' });

      return interaction.editReply({ embeds: [embed] });
    }
  }
};
