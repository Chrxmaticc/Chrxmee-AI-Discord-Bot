const { engine } = require('../cogs/automation');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    if (!interaction.isButton()) return;
    if (!interaction.guild || !interaction.member) return;

    engine.run('button_click', {
      eventType: 'button_click', client: interaction.client,
      interaction, customId: interaction.customId,
      member: interaction.member, user: interaction.user,
      guild: interaction.guild, channel: interaction.channel,
    }).catch(() => {});
  },
};
