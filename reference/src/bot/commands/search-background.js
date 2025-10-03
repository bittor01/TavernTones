/**
 * @file Defines the `/search-background` slash command.
 * This command allows users to search for a D&D background by name. If multiple
 * results are found, it presents them in a dropdown for the user to select from.
 * @author jules
 */

const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } = require('discord.js');
const axios = require('axios');
const { formatDetailResult } = require('../utils/embedFormatter');

const API_BASE_URL = 'http://localhost:3000/api/oracle';

module.exports = {
    /**
     * The data for the slash command, used by Discord to register it.
     */
    data: new SlashCommandBuilder()
        .setName('search-background')
        .setDescription('Searches for a background by name.')
        .addStringOption(option =>
            option.setName('query')
                .setDescription('The name of the background to search for.')
                .setRequired(true)),
    /**
     * The function that executes the command.
     * @param {import('discord.js').Interaction} interaction - The interaction object.
     */
    async execute(interaction) {
        const query = interaction.options.getString('query');
        const sessionId = interaction.user.id; // Use user ID for session tracking

        try {
            // Defer the reply to give the API time to respond.
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

            // Call the backend API to search for the background.
            const searchResponse = await axios.post(`${API_BASE_URL}/background`, { query });
            const results = searchResponse.data.results;

            if (!results || results.length === 0) {
                await interaction.editReply({ content: `I couldn't find any backgrounds matching "${query}".` });
                return;
            }

            // Create a dropdown menu with the search results.
            const options = results.map((item, index) => ({
                label: item.name.substring(0, 100),
                description: `Source: ${item.source}`.substring(0, 50),
                value: `${index}`, // Use the index as the value for easy lookup
            }));

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(`select-background:${sessionId}`)
                .setPlaceholder('Select a background to view details')
                .addOptions(options.slice(0, 25)); // Max 25 options per select menu

            const row = new ActionRowBuilder().addComponents(selectMenu);

            const reply = await interaction.editReply({
                content: `I found ${results.length} backgrounds matching "${query}". Please select one:`,
                components: [row],
            });

            // Create a collector to listen for the user's selection.
            const collector = reply.createMessageComponentCollector({
                filter: i => i.customId === `select-background:${sessionId}` && i.user.id === interaction.user.id,
                time: 60000, // 1 minute timeout
            });

            collector.on('collect', async i => {
                try {
                    await i.deferUpdate();
                    const selectedIndex = parseInt(i.values[0], 10);
                    const selectedBackground = results[selectedIndex];

                    // Fetch the full details for the selected item.
                    const detailResponse = await axios.post(`${API_BASE_URL}/details`, {
                        category: 'backgrounds',
                        name: selectedBackground.name,
                        source: selectedBackground.source,
                    });

                    const embed = formatDetailResult({ ...detailResponse.data, category: 'backgrounds' });

                    // Send the final result as a new, public message.
                    await interaction.followUp({ embeds: [embed] });
                    // Clean up the initial ephemeral message with the dropdown.
                    await interaction.deleteReply();
                    collector.stop();
                } catch (error) {
                    console.error('Error processing selection:', error);
                    await i.followUp({ content: 'There was an error processing your selection.', flags: [MessageFlags.Ephemeral] });
                }
            });

            collector.on('end', (collected, reason) => {
                // If the collector times out, edit the original message.
                if (reason === 'time') {
                    interaction.editReply({ content: 'You did not make a selection in time.', components: [] });
                }
            });

        } catch (error) {
            console.error(error);
            const errorMessage = error.response?.data?.error || 'An error occurred while communicating with The Oracle.';
            await interaction.editReply({ content: errorMessage, components: [] });
        }
    },
};