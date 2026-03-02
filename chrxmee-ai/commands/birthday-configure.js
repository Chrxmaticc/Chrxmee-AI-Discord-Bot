const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('birthday-configure')
    .setDescription('Mod-only birthday setup')
    .addStringOption(option =>
      option.setName('action')
        .setDescription('What to configure')
        .setRequired(true)
        .addChoices(
          { name: 'Add birthday role', value: 'add-role' },
          { name: 'Remove birthday role', value: 'remove-role' },
          { name: 'Set ping role', value: 'set-ping' },
          { name: 'Remove ping role', value: 'remove-ping' }
        ))
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user')
        .setRequired(true))
    .addRoleOption(option =>
      option.setName('role')
        .setDescription('The role to add/ping')
        .setRequired(true)),

  async execute(interaction, client) {
    await interaction.deferReply({ ephemeral: true });

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
      return interaction.editReply('Only mods can mess with birthday configs besto ❄️');
    }

    const action = interaction.options.getString('action');
    const user = interaction.options.getUser('user');
    const role = interaction.options.getRole('role');
    const userId = user.id;

    try {
      if (action === 'add-role') {
        await client.pool.query(
          'UPDATE user_birthdays SET birthday_role_id = $2 WHERE user_id = $1',
          [userId, role.id]
        );
        return interaction.editReply(`Added birthday role ${role.name} for ${user.tag}. Glow-up incoming ❄️`);
      }

      if (action === 'remove-role') {
        await client.pool.query(
          'UPDATE user_birthdays SET birthday_role_id = NULL WHERE user_id = $1',
          [userId]
        );
        return interaction.editReply(`Birthday role config gone for ${user.tag}. No more auto-glow ❄️`);
      }

      if (action === 'set-ping') {
        await client.pool.query(
          'UPDATE user_birthdays SET ping_role_id = $2 WHERE user_id = $1',
          [userId, role.id]
        );
        return interaction.editReply(`Birthday ping role set to ${role.name} for ${user.tag}. Server alert ready ❄️`);
      }

      if (action === 'remove-ping') {
        await client.pool.query(
          'UPDATE user_birthdays SET ping_role_id = NULL WHERE user_id = $1',
          [userId]
        );
        return interaction.editReply(`Birthday ping gone for ${user.tag}. Quiet celebration mode ❄️`);
      }
    } catch (err) {
      console.error('Birthday configure failed:', err);
      return interaction.editReply('DB said no... weird. Try again? ❄️');
    }
  }
};
