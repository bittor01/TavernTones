/**
 * @file Defines the `/generate-npc` slash command, which uses a sophisticated,
 * form-based approach with dropdowns and buttons to create a detailed NPC.
 * @author jules
 */

const { SlashCommandBuilder } = require('discord.js');
const { NpcFormHandler } = require('../utils/npcFormHandler');

module.exports = {
    /**
     * The data for the slash command, used by Discord to register it.
     */
    data: new SlashCommandBuilder()
        .setName('generate-npc')
        .setDescription('Generates a non-player character using a form-based creator.'),
    /**
     * The function that executes the command.
     * This command defers to the NpcFormHandler class to manage the complex, stateful interaction.
     * It also listens for a potential modal submission for the Challenge Rating.
     * @param {import('discord.js').Interaction} interaction - The interaction object.
     */
    async execute(interaction) {
        // Defer the reply to give the form time to load and process.
        await interaction.deferReply({ ephemeral: true });

        // The NpcFormHandler class encapsulates all logic for the form.
        const handler = new NpcFormHandler(interaction);
        await handler.start();

        // The handler's component collector will listen for button/select interactions.
        // This separate listener is specifically for the modal that appears if the user
        // selects 'Full NPC Statblock' mode and clicks 'Generate'.
        const filter = (i) => i.customId === `cr-modal-${interaction.id}`;
        try {
            const modalInteraction = await interaction.awaitModalSubmit({ filter, time: 60000 });
            const cr = modalInteraction.fields.getTextInputValue('cr-input');
            // Pass the modal interaction and the CR value to the form handler for final submission.
            await handler.submitForm(modalInteraction, cr);
        } catch (e) {
            // The NpcFormHandler's main component collector will handle the timeout message.
            // This catch block simply prevents an unhandled promise rejection if the user
            // opens the modal but doesn't submit it in time.
            console.log('CR modal timed out, or the interaction was handled by the main collector.');
        }
    },
};