/**
 * @file Defines the `/generate-character` slash command, which initiates a
 * multi-step conversational process to create a player character.
 * @author jules
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { handleMultiStepCommand } = require('../utils/multiStepHandler');
const { EMBED_COLORS } = require('../utils/embedColors');

/**
 * Builds a Discord embed to display the details of a generated character.
 * @param {object} data - The character data object from the API response.
 * @returns {EmbedBuilder} An embed containing the formatted character details.
 */
function buildCharacterEmbed(data) {
    const character = data.character; // The actual character data is nested
    return new EmbedBuilder()
        .setColor(EMBED_COLORS.CHARACTER)
        .setTitle(character.name || 'Character Generated!')
        .addFields(
            { name: 'Name', value: character.name || 'N/A', inline: true },
            { name: 'Species', value: character.species?.name || 'N/A', inline: true },
            { name: 'Class', value: character.class?.name || 'N/A', inline: true },
            { name: 'Background', value: character.background?.name || 'N/A', inline: true },
            { name: 'Alignment', value: character.alignment || 'N/A', inline: true },
            { name: 'Subclass', value: character.subclass?.name || 'N/A', inline: true },
            { name: 'Ideal', value: character.ideal || 'N/A', inline: false },
            { name: 'Bond', value: character.bond || 'N/A', inline: false },
            { name: 'Flaw', value: character.flaw || 'N/A', inline: false }
        );
}

module.exports = {
    /**
     * The data for the slash command, used by Discord to register it.
     */
    data: new SlashCommandBuilder()
        .setName('generate-character')
        .setDescription('Starts a guided process to generate a player character.'),
    /**
     * The function that executes the command.
     * @param {import('discord.js').Interaction} interaction - The interaction object.
     */
    async execute(interaction) {
        // This command uses a generic handler for multi-step conversational commands.
        // We provide it with the necessary context, including the API endpoint to call
        // and a function to format the final result into an embed.
        await handleMultiStepCommand({
            interaction,
            commandName: 'generate-character',
            apiEndpoint: '/generate-character',
            buildEmbed: buildCharacterEmbed,
        });
    },
};