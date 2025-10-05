/**
 * @file Defines the `/generate-encounter` slash command, which creates a themed monster
 * encounter based on a primary creature, party level, size, and difficulty.
 * @author jules
 */

const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const axios = require('axios');
const { EMBED_COLORS } = require('../utils/embedColors');

const API_BASE_URL = 'http://localhost:3000/api/oracle';

/**
 * Builds a Discord embed to display the details of a generated monster encounter.
 * @param {object} data The encounter data from the API.
 * @param {object[]} data.encounter An array of monster objects in the encounter.
 * @param {number} data.totalXp The total XP value of the generated encounter.
 * @param {number} data.xpBudget The XP budget for the encounter.
 * @param {string} data.difficulty The difficulty level of the encounter.
 * @returns {EmbedBuilder} An embed containing the formatted encounter details.
 */
function buildEncounterEmbed(data) {
    const { encounter, totalXp, xpBudget } = data;
    const embed = new EmbedBuilder()
        .setColor(EMBED_COLORS.ENCOUNTER)
        .setTitle('Encounter Generated!')
        .setDescription(`A **${data.difficulty}** encounter has been prepared for your party.`)
        .setFooter({ text: `Total XP: ${totalXp} / Budget: ${xpBudget}` });

    encounter.forEach((monster) => {
        const count = monster.count > 1 ? ` (x${monster.count})` : '';
        embed.addFields({
            name: `${monster.name}${count}`,
            value: `CR: ${monster.cr || 'N/A'}`,
            inline: true,
        });
    });

    return embed;
}

module.exports = {
    /**
     * The data for the slash command, used by Discord to register it.
     * It defines the command name, description, and required options.
     */
    data: new SlashCommandBuilder()
        .setName('generate-encounter')
        .setDescription('Generates a monster encounter based on party details.')
        .addStringOption(option =>
            option.setName('creature')
                .setDescription('The name of the main creature for the encounter.')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('level')
                .setDescription('The average party level.')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('size')
                .setDescription('The number of party members.')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('difficulty')
                .setDescription('The desired difficulty.')
                .setRequired(true)
                .addChoices(
                    { name: 'Low', value: 'low' },
                    { name: 'Moderate', value: 'moderate' },
                    { name: 'High', value: 'high' }
                )),
    /**
     * The function that executes the command.
     * It gathers user options, calls the backend API to generate the encounter,
     * and replies with a formatted embed or an error message.
     * @param {import('discord.js').Interaction} interaction - The interaction object.
     */
    async execute(interaction) {
        await interaction.deferReply();

        const payload = {
            creatureName: interaction.options.getString('creature'),
            partyLevel: interaction.options.getInteger('level'),
            partySize: interaction.options.getInteger('size'),
            difficulty: interaction.options.getString('difficulty'),
        };

        try {
            const response = await axios.post(`${API_BASE_URL}/encounter`, payload);
            const encounterData = { ...response.data, difficulty: payload.difficulty };

            if (!encounterData.encounter || encounterData.encounter.length === 0) {
                await interaction.editReply({ content: 'Could not generate a valid encounter with the given parameters.', flags: [MessageFlags.Ephemeral] });
                return;
            }

            const embed = buildEncounterEmbed(encounterData);
            await interaction.editReply({ embeds: [embed] });

        } catch (err) {
            console.error(err);
            const errorMessage = err.response?.data?.error || 'An error occurred while generating the encounter.';
            await interaction.editReply({
                content: errorMessage,
                flags: [MessageFlags.Ephemeral],
            });
        }
    },
};