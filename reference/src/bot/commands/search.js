/**
 * @file Defines the `/search` slash command, the primary search utility for the bot.
 * This command performs a broad search across all 5e content categories by name.
 * It's aliased by `/5e` and `/search-name`.
 * @author jules
 */

const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } = require('discord.js');
const axios = require('axios');
const { formatDetailResult } = require('../utils/embedFormatter');

const API_BASE_URL = 'http://localhost:3000/api/oracle';

/**
 * Formats a category name for display in the UI.
 * e.g., 'bestiary' -> 'Monster', 'spells' -> 'Spell'
 * @param {string} category The raw category name.
 * @returns {string} The formatted category name.
 */
function formatCategoryLabel(category) {
    if (category === 'bestiary') return 'Monster';
    const singular = category.endsWith('s') ? category.slice(0, -1) : category;
    return singular.charAt(0).toUpperCase() + singular.slice(1);
}

module.exports = {
    /**
     * The data for the slash command, used by Discord to register it.
     */
    data: new SlashCommandBuilder()
        .setName('search')
        .setDescription('Searches all 5e content by name.')
        .addStringOption(option =>
            option.setName('query')
                .setDescription('The name of the content to search for.')
                .setRequired(true)),
    /**
     * The function that executes the command.
     * @param {import('discord.js').Interaction} interaction - The interaction object.
     */
    async execute(interaction) {
        const query = interaction.options.getString('query');
        const sessionId = interaction.user.id;

        try {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

            const searchResponse = await axios.post(`${API_BASE_URL}/5e`, { query });
            const results = searchResponse.data.results;

            if (!results || results.length === 0) {
                await interaction.editReply({ content: `I couldn't find anything matching "${query}".` });
                return;
            }

            const options = results.map((item, index) => ({
                label: `${item.name} [${formatCategoryLabel(item.category)}]`.substring(0, 100),
                description: `Source: ${item.source}`.substring(0, 50),
                value: `${index}`,
            }));

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(`select-5e:${sessionId}`)
                .setPlaceholder('Select an item to view details')
                .addOptions(options.slice(0, 25));

            const row = new ActionRowBuilder().addComponents(selectMenu);

            const reply = await interaction.editReply({
                content: `I found ${results.length} results for "${query}". Please select one:`,
                components: [row],
            });

            const collector = reply.createMessageComponentCollector({
                filter: i => i.customId === `select-5e:${sessionId}` && i.user.id === interaction.user.id,
                time: 60000,
            });

            collector.on('collect', async i => {
                try {
                    await i.deferUpdate();
                    const selectedIndex = parseInt(i.values[0], 10);
                    const selectedItem = results[selectedIndex];

                    const detailResponse = await axios.post(`${API_BASE_URL}/details`, {
                        category: selectedItem.category,
                        name: selectedItem.name,
                        source: selectedItem.source,
                    });

                    const embed = formatDetailResult({ ...detailResponse.data, category: selectedItem.category });
                    const description = embed.data.description || '';

                    if (description.length > 4000) {
                        const originalDescription = embed.data.description;
                        embed.setDescription('This response is too long to display. See the thread below for full details.');

                        const replyMessage = await interaction.followUp({ embeds: [embed], fetchReply: true });
                        const thread = await replyMessage.startThread({ name: `Details for ${selectedItem.name}`, autoArchiveDuration: 60 });
                        const parts = originalDescription.match(/[\s\S]{1,1950}/g) || [];
                        for (const part of parts) {
                            await thread.send(part);
                        }
                    } else {
                        await interaction.followUp({ embeds: [embed] });
                    }

                    await interaction.deleteReply();
                    collector.stop();
                } catch (error) {
                    console.error('Error processing selection:', error);
                    await i.followUp({ content: 'There was an error processing your selection.', flags: [MessageFlags.Ephemeral] });
                }
            });

            collector.on('end', (collected, reason) => {
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