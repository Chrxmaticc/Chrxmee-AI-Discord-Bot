const {
    SlashCommandBuilder,
    PermissionFlagsBits
} = require('discord.js');

const OWNER_ID = '902685494247325776';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('say')
        .setDescription('Make the bot say something.')
        .addStringOption(option =>
            option
                .setName('message')
                .setDescription('What the bot should say')
                .setRequired(true)
        ),

    async execute(interaction) {

        // Owner check
        if (interaction.user.id !== OWNER_ID) {
            return interaction.reply({
                content: 'You are NOT the owner brotato.',
                ephemeral: true
            });
        }

        const message = interaction.options.getString('message');

        // Ephemeral confirmation
        await interaction.reply({
            content: 'Saying...',
            ephemeral: true
        });

        // Send actual message
        await interaction.channel.send(message);
    }
};
