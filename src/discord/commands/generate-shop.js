const { SlashCommandBuilder } = require('discord.js');

const sizeOptions = [
    { name: 'Huge', value: 'Huge' },
    { name: 'Large', value: 'Large' },
    { name: 'Average', value: 'Average' },
    { name: 'Small', value: 'Small' },
    { name: 'Tiny', value: 'Tiny' },
];

module.exports = {
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
};