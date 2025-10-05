/**
 * @file Defines the `/generate-shop` slash command, which generates a random shop inventory with prices.
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
     * It defines the command name, description, and available options.
     */
    data: new SlashCommandBuilder()
        .setName('generate-shop')
        .setDescription('Generates a shop with a random inventory.')
        .addStringOption(option =>
            option.setName('size')
                .setDescription('The size of the city, affecting item availability and prices.')
                .setRequired(true)
                .addChoices(...sizeOptions))
        .addStringOption(option =>
            option.setName('num-items')
                .setDescription('Number of items to generate (e.g., 10 or 2d8).')
                .setRequired(false))
        .addNumberOption(option =>
            option.setName('price-multiplier')
                .setDescription('A multiplier to adjust item prices (e.g., 1.2 for +20%).')
                .setRequired(false)),

    /**
     * The function that executes the command.
     * It gathers user options, calls the backend API to generate the shop inventory,
     * and replies with a formatted embed or an error message.
     * @param {import('discord.js').Interaction} interaction - The interaction object.
     */
    async execute(interaction) {
        await interaction.deferReply();

        const payload = {
            size: interaction.options.getString('size'),
            numItems: interaction.options.getString('num-items') || '10',
            priceMultiplier: interaction.options.getNumber('price-multiplier'), // API handles null
        };

        try {
            const response = await axios.post(`${API_BASE_URL}/generate-shop`, payload);

            const shop = response.data;
            const embed = {
                color: EMBED_COLORS.LOOT,
                title: `Generated ${payload.size} City Shop Inventory`,
                description: shop.items.map(item => `• ${item.name} (${item.rarity}) - **${item.price}**`).join('\n') || 'The shop is empty.',
            };

            await interaction.editReply({ embeds: [embed] });

        } catch (err) {
            console.error(err);
            const errorMessage = err.response?.data?.error || 'An error occurred while generating the shop.';
            await interaction.editReply({
                content: errorMessage,
                flags: [MessageFlags.Ephemeral],
            });
        }
    },
};