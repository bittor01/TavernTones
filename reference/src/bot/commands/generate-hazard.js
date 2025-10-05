/**
 * @file Defines the `/generate-hazard` slash command, which initiates a
 * multi-step conversational process to create a random environmental hazard.
 * @author jules
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { handleMultiStepCommand } = require('../utils/multiStepHandler');
const { EMBED_COLORS } = require('../utils/embedColors');

/**
 * Builds a Discord embed to display the details of a generated hazard.
 * @param {object} hazard - The hazard data object from the API response.
 * @returns {EmbedBuilder} An embed containing the formatted hazard details.
 */
function buildHazardEmbed(hazard) {
    return new EmbedBuilder()
        .setColor(EMBED_COLORS.TRAP) // Reusing the TRAP color for hazards
        .setTitle(hazard.name || 'Hazard Generated')
        .setDescription(hazard.description || 'A dangerous environmental hazard.')
        .addFields(
            { name: 'Tier', value: hazard.tier ? `Tier ${hazard.tier}` : 'N/A', inline: true },
            { name: 'Threat', value: hazard.threat || 'N/A', inline: true },
            { name: 'Trigger', value: hazard.trigger || 'N/A', inline: false },
            { name: 'Effect', value: hazard.effect || 'N/A', inline: false },
            { name: 'Countermeasures', value: hazard.countermeasures || 'N/A', inline: false }
        );
}

module.exports = {
    /**
     * The data for the slash command, used by Discord to register it.
     */
    data: new SlashCommandBuilder()
        .setName('generate-hazard')
        .setDescription('Starts a guided process to generate an environmental hazard.'),
    /**
     * The function that executes the command.
     * @param {import('discord.js').Interaction} interaction - The interaction object.
     */
    async execute(interaction) {
        // This command uses the generic multi-step handler to guide the user
        // through the hazard creation process (tier, threat).
        await handleMultiStepCommand({
            interaction,
            commandName: 'generate-hazard',
            apiEndpoint: '/generate-hazard',
            buildEmbed: buildHazardEmbed,
        });
    },
};