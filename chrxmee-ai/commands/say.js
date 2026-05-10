const { SlashCommandBuilder } = require('discord.js');

const OWNER_IDS = ['902685494247325776', '954709865698312213'];

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
        // Owner check (both IDs)
        if (!OWNER_IDS.includes(interaction.user.id)) {
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
