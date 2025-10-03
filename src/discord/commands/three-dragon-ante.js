const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('play-tda')
        .setDescription('Starts a new game of Three-Dragon Ante.'),
    async execute(interaction) {
        // The manager is attached to the client in main.js
        const tdaManager = interaction.client.tdaManager;
        if (tdaManager) {
            await tdaManager.handleCommand(interaction);
        } else {
            console.error('TDA Manager not found on client object.');
            await interaction.reply({ content: 'There was a critical error starting the game. Please contact the bot administrator.', ephemeral: true });
        }
    },
};