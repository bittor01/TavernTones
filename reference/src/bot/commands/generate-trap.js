/**
 * @file Defines the `/generate-trap` slash command, which initiates a
 * multi-step conversational process to create a random trap.
 * @author jules
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { handleMultiStepCommand } = require('../utils/multiStepHandler');
const { EMBED_COLORS } = require('../utils/embedColors');

/**
 * Builds a Discord embed to display the details of a generated trap.
 * @param {object} trap - The trap data object from the API response.
 * @returns {EmbedBuilder} An embed containing the formatted trap details.
 */
function buildTrapEmbed(trap) {
    return new EmbedBuilder()
        .setColor(EMBED_COLORS.TRAP)
        .setTitle(trap.name || 'Trap Generated')
        .setDescription(trap.description || 'A cunningly devised trap.')
        .addFields(
            { name: 'Tier', value: trap.tier ? `Tier ${trap.tier}` : 'N/A', inline: true },
            { name: 'Type', value: trap.type || 'N/A', inline: true },
            { name: 'Threat', value: trap.threat || 'N/A', inline: true },
            { name: 'Trigger', value: trap.trigger || 'N/A', inline: false },
            { name: 'Effect', value: trap.effect || 'N/A', inline: false },
            { name: 'Countermeasures', value: trap.countermeasures || 'N/A', inline: false }
        );
}

module.exports = {
    /**
     * The data for the slash command, used by Discord to register it.
     */
    data: new SlashCommandBuilder()
        .setName('generate-trap')
        .setDescription('Starts a guided process to generate a mechanical trap.'),
    /**
     * The function that executes the command.
     * @param {import('discord.js').Interaction} interaction - The interaction object.
     */
    async execute(interaction) {
        // This command uses the generic multi-step handler to guide the user
        // through the trap creation process (tier, type, threat).
        await handleMultiStepCommand({
            interaction,
            commandName: 'generate-trap',
            apiEndpoint: '/generate-trap',
            buildEmbed: buildTrapEmbed,
        });
    },
};