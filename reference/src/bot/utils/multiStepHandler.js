/**
 * @file A generic handler for orchestrating multi-step, conversational commands.
 * This module abstracts the flow of a conversation with the user, handling API calls,
 * user input (both text and select menus), state management, and pagination.
 * @author jules
 */

const { ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } = require('discord.js');
const axios = require('axios');
const { getOrCreateSession, deleteSession } = require('./botSessionManager');

const API_BASE_URL = 'http://localhost:3000/api/oracle';
const PAGE_SIZE = 23; // Max 25 options in a select menu, leaving 2 for 'Next'/'Back' buttons.

/**
 * Handles the entire lifecycle of a multi-step command.
 * @param {object} params - The parameters for the handler.
 * @param {import('discord.js').Interaction} params.interaction - The initial command interaction.
 * @param {string} params.commandName - The name of the command, used for custom IDs.
 * @param {string} params.apiEndpoint - The API endpoint to call for this command (e.g., '/generate-trap').
 * @param {function} params.buildEmbed - A function that takes the final API response and returns a `EmbedBuilder`.
 * @param {object} [params.initialPayload={}] - An initial payload to send to the API on the first call.
 */
async function handleMultiStepCommand({ interaction, commandName, apiEndpoint, buildEmbed, initialPayload = {} }) {
    const sessionId = interaction.id;
    const userApiId = interaction.user.id; // Use a consistent ID for the API session.

    /**
     * Sends a POST request to the command's API endpoint.
     * @param {object} payload - The data to send in the request body.
     * @returns {Promise<import('axios').AxiosResponse>} The API response.
     */
    const postToApi = async (payload) => {
        const apiPayload = { sessionId: userApiId, ...payload };
        return axios.post(`${API_BASE_URL}${apiEndpoint}`, apiPayload);
    };

    /**
     * Renders the bot's response based on the data received from the API.
     * If the API returns a final object (no `step`), it builds and sends the final embed.
     * If it returns a `step`, it presents the user with the next question or set of options.
     * @param {import('discord.js').Interaction} interactionToUpdate - The interaction to reply to or edit.
     * @param {object} responseData - The data from the API response.
     * @returns {Promise<{shouldContinue: boolean, requiresTextInput?: boolean}>} An object indicating if the conversation should continue.
     */
    const renderResponse = async (interactionToUpdate, responseData) => {
        const session = getOrCreateSession(sessionId);
        const { step, message, results, options: apiOptions } = responseData;

        // If 'step' is missing, the conversation is over. Build the final embed.
        if (!step) {
            const embed = buildEmbed(responseData);
            await interaction.followUp({ embeds: [embed], ephemeral: false });
            await interaction.deleteReply().catch(() => {}); // Clean up the "Thinking..." message
            deleteSession(sessionId);
            return { shouldContinue: false };
        }

        session.currentStep = step;
        session.apiOptions = apiOptions || {};
        const requiresTextInput = session.apiOptions.requiresTextInput || false;

        if (requiresTextInput) {
            await interactionToUpdate.editReply({ content: message, components: [] });
        } else {
            session.currentPage = 0;
            session.currentOptions = Array.isArray(results) ? results : (results || '').split('\n').map(line => {
                const parts = line.split('. ');
                return { value: parts[0], label: parts.slice(1).join('. ') };
            });

            const pageOptions = getPageOptions(session);
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(`${commandName}-step:${sessionId}`)
                .setPlaceholder('Make your selection')
                .addOptions(pageOptions);
            const row = new ActionRowBuilder().addComponents(selectMenu);
            await interactionToUpdate.editReply({ content: message, components: [row] });
        }

        return { shouldContinue: true, requiresTextInput };
    };

    /**
     * Creates a message collector to wait for free-text input from the user.
     * @param {import('discord.js').Interaction} interactionForReply - The interaction whose reply should be updated.
     */
    const startMessageCollector = (interactionForReply) => {
        const session = getOrCreateSession(sessionId);
        const messageCollector = interaction.channel.createMessageCollector({
            filter: m => m.author.id === interaction.user.id,
            time: 120000, // 2 minutes
            max: 1,
        });

        messageCollector.on('collect', async msg => {
            await msg.delete().catch(() => {}); // Clean up user's message
            const payload = { choice: msg.content, step: session.currentStep, ...session.apiOptions };
            const response = await postToApi(payload);
            const renderResult = await renderResponse(interactionForReply, response.data);
            if (renderResult.shouldContinue && !renderResult.requiresTextInput) {
                startComponentCollector(interactionForReply);
            }
        });

        messageCollector.on('end', (collected, reason) => {
            if (reason === 'time') {
                interaction.editReply({ content: 'You did not provide the required information in time.', components: [] }).catch(() => {});
                deleteSession(sessionId);
            }
        });
    };

    /**
     * Creates a component collector to wait for a user to make a selection from a dropdown menu.
     * @param {import('discord.js').Message} interactionForReply - The message with the components to listen to.
     */
    const startComponentCollector = (interactionForReply) => {
        const collector = interactionForReply.createMessageComponentCollector({
            filter: i => i.customId === `${commandName}-step:${sessionId}` && i.user.id === interaction.user.id,
            time: 300000, // 5 minutes
        });

        collector.on('collect', async i => {
            try {
                await i.deferUpdate();
                const session = getOrCreateSession(sessionId);
                const selection = i.values[0];

                if (selection.startsWith('pagination_')) {
                    handlePagination(i, selection, session, commandName);
                    return;
                }

                const payload = { choice: selection, step: session.currentStep, ...session.apiOptions };
                const response = await postToApi(payload);
                const renderResult = await renderResponse(i, response.data);

                if (!renderResult.shouldContinue) {
                    collector.stop();
                } else if (renderResult.requiresTextInput) {
                    collector.stop('transition'); // Stop this collector to switch to a message collector.
                    startMessageCollector(i);
                }
            } catch (error) {
                console.error(`Error during ${commandName} step:`, error.response ? error.response.data : error.message);
                collector.stop();
            }
        });

        collector.on('end', (collected, reason) => {
            if (reason === 'time') {
                interaction.editReply({ content: 'This interaction has expired.', components: [] }).catch(() => {});
            }
            deleteSession(sessionId);
        });
    };

    // --- Main Execution Flow ---
    try {
        getOrCreateSession(sessionId).data = {}; // Reset data for a new command execution.
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
        const initialResponse = await postToApi(initialPayload);
        const reply = await interaction.editReply({ content: 'Starting process...', flags: [MessageFlags.Ephemeral] });
        const renderResult = await renderResponse(interaction, initialResponse.data);

        if (renderResult.shouldContinue) {
            if (renderResult.requiresTextInput) {
                startMessageCollector(interaction);
            } else {
                startComponentCollector(reply);
            }
        }
    } catch (error) {
        console.error(`Error starting ${commandName} process:`, error.response ? error.response.data : error.message);
        deleteSession(sessionId);
        await interaction.editReply({ content: `An error occurred while starting the ${commandName} process.`, components: [] }).catch(() => {});
    }
}

/**
 * Handles pagination for select menus that have too many options to display at once.
 * @private
 * @param {import('discord.js').Interaction} i - The component interaction from the pagination button.
 * @param {string} selection - The custom ID of the selected option (e.g., 'pagination_next').
 * @param {object} session - The current command session.
 * @param {string} commandName - The name of the command.
 */
async function handlePagination(i, selection, session, commandName) {
    if (selection === 'pagination_next') session.currentPage++;
    if (selection === 'pagination_back') session.currentPage--;

    const newOptions = getPageOptions(session);
    const newMenu = new StringSelectMenuBuilder()
        .setCustomId(`${commandName}-step:${session.id}`)
        .setPlaceholder('Make your selection')
        .addOptions(newOptions);
    await i.editReply({ components: [new ActionRowBuilder().addComponents(newMenu)] });
}

/**
 * Slices the full list of options for a select menu into a single page and adds pagination buttons.
 * @private
 * @param {object} session - The current command session.
 * @returns {Array<object>} The options for the current page, formatted for a StringSelectMenu.
 */
function getPageOptions(session) {
    const { currentOptions, currentPage } = session;
    const options = [];
    const start = currentPage * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const pageItems = currentOptions.slice(start, end);

    options.push(...pageItems.map(opt => {
        const option = {
            label: (opt.label || opt.name).substring(0, 100),
            value: (opt.value || opt.name).substring(0, 100),
        };
        const description = opt.description || opt.source;
        if (description) {
            option.description = description.substring(0, 50);
        }
        return option;
    }));

    if (currentPage > 0) {
        options.unshift({ label: '⬅️ Previous Page', value: 'pagination_back' });
    }
    if (end < currentOptions.length) {
        options.push({ label: 'Next Page ➡️', value: 'pagination_next' });
    }

    return options.slice(0, 25);
}

module.exports = { handleMultiStepCommand };