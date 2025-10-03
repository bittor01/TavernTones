/**
 * @file Defines the `/generate-vehicle-encounter` slash command, which uses a modal form
 * to collect parameters for generating a vehicle encounter.
 * @author jules
 */

const { SlashCommandBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags } = require('discord.js');
const axios = require('axios');
const { EMBED_COLORS } = require('../utils/embedColors');

const API_BASE_URL = 'http://localhost:3000/api/oracle';

module.exports = {
    /**
     * The data for the slash command, used by Discord to register it.
     */
    data: new SlashCommandBuilder()
        .setName('generate-vehicle-encounter')
        .setDescription('Generates a vehicle encounter.'),
    /**
     * The function that executes the command.
     * It displays a modal form to the user, awaits their submission, and then calls
     * the backend API to generate the vehicle encounter.
     * @param {import('discord.js').Interaction} interaction - The interaction object.
     */
    async execute(interaction) {
        const sessionId = interaction.user.id;

        const modal = new ModalBuilder()
            .setCustomId(`vehicle-encounter-modal:${sessionId}`)
            .setTitle('Vehicle Encounter Generation');

        const tagInput = new TextInputBuilder().setCustomId('tag').setLabel("Vehicle Tag (e.g., water, land, air)").setStyle(TextInputStyle.Short).setValue('water').setRequired(true);
        const styleInput = new TextInputBuilder().setCustomId('style').setLabel("Encounter Style (e.g., balanced, flagship)").setStyle(TextInputStyle.Short).setValue('balanced').setRequired(true);
        const totalHpInput = new TextInputBuilder().setCustomId('totalHp').setLabel("Total HP for the encounter").setStyle(TextInputStyle.Short).setValue('500').setRequired(true);
        const numVehiclesInput = new TextInputBuilder().setCustomId('numVehicles').setLabel("Number of vehicles").setStyle(TextInputStyle.Short).setValue('3').setRequired(true);

        modal.addComponents(
            new ActionRowBuilder().addComponents(tagInput),
            new ActionRowBuilder().addComponents(styleInput),
            new ActionRowBuilder().addComponents(totalHpInput),
            new ActionRowBuilder().addComponents(numVehiclesInput)
        );

        await interaction.showModal(modal);

        const filter = (i) => i.customId === `vehicle-encounter-modal:${sessionId}` && i.user.id === interaction.user.id;

        try {
            const modalInteraction = await interaction.awaitModalSubmit({ filter, time: 60000 });
            await modalInteraction.deferReply();

            const payload = {
                tag: modalInteraction.fields.getTextInputValue('tag'),
                style: modalInteraction.fields.getTextInputValue('style'),
                totalHp: parseInt(modalInteraction.fields.getTextInputValue('totalHp')),
                numVehicles: parseInt(modalInteraction.fields.getTextInputValue('numVehicles')),
            };

            const response = await axios.post(`${API_BASE_URL}/vehicle-encounter`, payload);
            const data = response.data;

            const embed = {
                color: EMBED_COLORS.VEHICLE,
                title: `Generated ${payload.style} Vehicle Encounter`,
                description: data.encounter.map(v => `• **${v.name}** (HP: ${v.hp || 'N/A'})`).join('\n') || 'No vehicles were generated.',
                footer: { text: `Total HP: ${data.totalValue} / Budget: ${data.budget}` },
            };

            await modalInteraction.editReply({ embeds: [embed] });

        } catch (err) {
            console.error(err);
            // Check if the error is due to the modal timing out.
            if (err.code === 'InteractionCollectorError') {
                // The interaction is already expired, so we can't reply. This is expected.
            } else {
                // For other errors, try to send a follow-up.
                const errorMessage = err.response?.data?.error || 'An error occurred while generating the encounter.';
                await interaction.followUp({ content: errorMessage, flags: [MessageFlags.Ephemeral] }).catch(() => {});
            }
        }
    },
};