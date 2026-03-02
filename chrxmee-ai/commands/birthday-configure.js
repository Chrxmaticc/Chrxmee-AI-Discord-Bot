const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('birthday-configure')
    .setDescription('Mod-only birthday config')
    .addSubcommand(subcommand =>
      subcommand
        .setName('add-role')
        .setDescription('Auto-assign role on birthday')
        .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true))
        .addRoleOption(opt => opt.setName('role').setDescription('Role to add').setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove-role')
        .setDescription('Remove birthday role config')
        .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('set-ping')
        .setDescription('Ping role on birthday')
        .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true))
        .addRoleOption(opt => opt.setName('role').setDescription('Ping role (@everyone, @here, custom)').setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove-ping')
        .setDescription('Remove birthday ping')
        .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true))),

  async execute(interaction, client) {
    await interaction.deferReply({ ephemeral: true });

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
      return interaction.editReply('Only mods can configure birthdays ❄️');
    }

    const sub = interaction.options.getSubcommand();
    const user = interaction.options.getUser('user');
    const role = interaction.options.getRole('role');
    const userId = user.id;

    try {
      if (sub === 'add-role') {
        await client.pool.query(
          'UPDATE user_birthdays SET birthday_role_id = $2 WHERE user_id = $1',
          [userId, role.id]
        );
        return interaction.editReply(`Birthday role set for ${user.tag} to ${role.name}. They’ll glow up on the day ❄️`);
      }

      if (sub === 'remove-role') {
        await client.pool.query(
          'UPDATE user_birthdays SET birthday_role_id = NULL WHERE user_id = $1',
          [userId]
        );
        return interaction.editReply(`Birthday role config removed for ${user.tag} ❄️`);
      }

      if (sub === 'set-ping') {
        await client.pool.query(
          'UPDATE user_birthdays SET ping_role_id = $2 WHERE user_id = $1',
          [userId, role.id]
        );
        return interaction.editReply(`Birthday ping set for ${user.tag} to ${role.name}. Server will know ❄️`);
      }

      if (sub === 'remove-ping') {
        await client.pool.query(
          'UPDATE user_birthdays SET ping_role_id = NULL WHERE user_id = $1',
          [userId]
        );
        return interaction.editReply(`Birthday ping removed for ${user.tag} ❄️`);
      }
    } catch (err) {
      console.error('Birthday configure error:', err);
      return interaction.editReply('Something broke. Try again? ❄️');
    }
  }
};
