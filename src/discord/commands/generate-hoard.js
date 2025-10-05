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
};