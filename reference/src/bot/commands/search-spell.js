/**
 * @file Defines the `/search-spell` slash command.
 * This command allows users to search for a D&D spell by name. If multiple
 * results are found, it presents them in a dropdown for the user to select from.
 * @author jules
 */

const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } = require('discord.js');
const axios = require('axios');
const { formatDetailResult } = require('../utils/embedFormatter');
const { getSchoolName } = require('../utils/spellUtils');

const API_BASE_URL = 'http://localhost:3000/api/oracle';

module.exports = {
    /**
     * The data for the slash command, used by Discord to register it.
     */
    data: new SlashCommandBuilder()
        .setName('search-spell')
        .setDescription('Searches for a spell by name.')
        .addStringOption(option =>
            option.setName('query')
                .setDescription('The name of the spell to search for.')
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

            const searchResponse = await axios.post(`${API_BASE_URL}/spell`, { query });
            const results = searchResponse.data.results;

            if (!results || results.length === 0) {
                await interaction.editReply({ content: `I couldn't find any spells matching "${query}".` });
                return;
            }

            const options = results.map((item, index) => {
                const school = getSchoolName(item.school) || 'N/A';
                const level = item.level !== undefined ? ` (Lvl ${item.level})` : '';
                return {
                    label: `${item.name}${level}`.substring(0, 100),
                    description: `School: ${school} | Source: ${item.source}`.substring(0, 50),
                    value: `${index}`,
                };
            });

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(`select-spell:${sessionId}`)
                .setPlaceholder('Select a spell to view details')
                .addOptions(options.slice(0, 25));

            const row = new ActionRowBuilder().addComponents(selectMenu);

            const reply = await interaction.editReply({
                content: `I found ${results.length} spells matching "${query}". Please select one:`,
                components: [row],
            });

            const collector = reply.createMessageComponentCollector({
                filter: i => i.customId === `select-spell:${sessionId}` && i.user.id === interaction.user.id,
                time: 60000,
            });

            collector.on('collect', async i => {
                try {
                    await i.deferUpdate();
                    const selectedIndex = parseInt(i.values[0], 10);
                    const selectedSpell = results[selectedIndex];

                    const detailResponse = await axios.post(`${API_BASE_URL}/details`, {
                        category: 'spells',
                        name: selectedSpell.name,
                        source: selectedSpell.source,
                    });

                    const embed = formatDetailResult({ ...detailResponse.data, category: 'spells' });

                    await interaction.followUp({ embeds: [embed] });
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