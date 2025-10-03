/**
 * @file Defines the `/generate-hoard` slash command, which generates a random treasure hoard.
 * @author jules
 */

const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const axios = require('axios');
const { EMBED_COLORS } = require('../utils/embedColors');

const API_BASE_URL = 'http://localhost:3000/api/oracle';

/**
 * The choices for the 'size' option of the command.
 * @type {Array<{name: string, value: string}>}
 */
const sizeOptions = [
    { name: 'Huge', value: 'Huge' },
    { name: 'Large', value: 'Large' },
    { name: 'Average', value: 'Average' },
    { name: 'Small', value: 'Small' },
    { name: 'Tiny', value: 'Tiny' },
];

module.exports = {
    /**
     * The data for the slash command, used by Discord to register it.
     * It defines the command name, description, and required options.
     */
    data: new SlashCommandBuilder()
        .setName('generate-hoard')
        .setDescription('Generates a hoard of treasure.')
        .addStringOption(option =>
            option.setName('size')
                .setDescription('The size of the hoard, affecting item probability.')
                .setRequired(true)
                .addChoices(...sizeOptions))
        .addStringOption(option =>
            option.setName('num-items')
                .setDescription('Number of items to generate (e.g., 5 or 1d6).')
                .setRequired(false))
        .addNumberOption(option =>
            option.setName('loot-multiplier')
                .setDescription('A multiplier to adjust the amount of loot generated.')
                .setRequired(false)),

    /**
     * The function that executes the command.
     * It gathers user options, calls the backend API to generate the hoard,
     * and replies with a formatted embed or an error message.
     * @param {import('discord.js').Interaction} interaction - The interaction object.
     */
    async execute(interaction) {
        await interaction.deferReply();

        const size = interaction.options.getString('size');
        const numItems = interaction.options.getString('num-items') || '1d6';
        const lootMultiplier = interaction.options.getNumber('loot-multiplier') || 1.0;

        try {
            const response = await axios.post(`${API_BASE_URL}/generate-hoard`, {
                size,
                numItems,
                lootMultiplier,
            });

            const hoard = response.data;
            const embed = {
                color: EMBED_COLORS.LOOT,
                title: `Generated ${size} Treasure Hoard`,
                description: hoard.items.map(item => `• ${item.name}`).join('\n') || 'No items were generated.',
                footer: { text: `Total Value: ${hoard.totalValue || 'N/A'} gp` },
            };

            await interaction.editReply({ embeds: [embed] });

        } catch (err) {
            console.error(err);
            const errorMessage = err.response?.data?.error || 'An error occurred while generating the hoard.';
            await interaction.editReply({
                content: errorMessage,
                flags: [MessageFlags.Ephemeral],
            });
        }
    },
};