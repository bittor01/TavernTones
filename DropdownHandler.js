const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

const MAX_OPTIONS_PER_PAGE = 25;

class DropdownHandler {
    /**
     * Creates an instance of DropdownHandler.
     * @param {object} config - The configuration for the dropdown.
     * @param {string} config.customId - The base custom ID for the select menu. Page and other data will be appended.
     * @param {Array<object>} config.options - The array of options to display. Each object must have 'label' and 'value' properties.
     * @param {string} [config.placeholder='Select an option'] - The placeholder text for the dropdown.
     * @param {Array<object>} [config.topPinned=[]] - Options to always show at the top.
     * @param {Array<object>} [config.bottomPinned=[]] - Options to always show at the bottom.
     */
    constructor({ customId, options, placeholder = 'Select an option', topPinned = [], bottomPinned = [] }) {
        this.customId = customId;
        this.options = options;
        this.placeholder = placeholder;
        this.topPinned = topPinned;
        this.bottomPinned = bottomPinned;
    }

    /**
     * Creates a Discord Action Row with a StringSelectMenu for a specific page.
     * @param {number} [currentPage=1] - The page number to display.
     * @returns {ActionRowBuilder} A Discord ActionRowBuilder containing the configured select menu.
     */
    createActionRow(currentPage = 1) {
        const finalOptions = [];
        const dynamicOptions = [...this.options];

        // Add top-pinned options
        finalOptions.push(...this.topPinned);

        // Determine how many slots are available for dynamic options and navigation
        const dynamicSlots = MAX_OPTIONS_PER_PAGE - finalOptions.length - this.bottomPinned.length;

        let pageOptions = [];
        let totalPages = 1;

        if (dynamicOptions.length > 0) {
            // If there's only one page worth of options or less
            if (dynamicOptions.length <= dynamicSlots) {
                pageOptions = dynamicOptions;
                totalPages = 1;
                currentPage = 1;
            } else {
                // Calculate total pages based on a more complex pagination model
                // Page 1 has 1 extra slot (no "Prev" button)
                const slotsOnPage1 = dynamicSlots - 1;
                // Subsequent pages have 2 fewer slots (Prev and Next)
                const slotsOnMidPages = dynamicSlots - 2;

                if (dynamicOptions.length <= slotsOnPage1) {
                    totalPages = 1;
                } else {
                    totalPages = 1 + Math.ceil((dynamicOptions.length - slotsOnPage1) / slotsOnMidPages);
                }

                if (currentPage < 1) currentPage = 1;
                if (currentPage > totalPages) currentPage = totalPages;

                let startIndex = 0;
                let slotsForThisPage = 0;

                if (currentPage > 1) {
                    startIndex += slotsOnPage1 + (currentPage - 2) * slotsOnMidPages;
                }

                if (currentPage === 1) {
                    slotsForThisPage = dynamicSlots - (totalPages > 1 ? 1 : 0);
                } else if (currentPage < totalPages) {
                    slotsForThisPage = dynamicSlots - 2;
                } else { // Last page
                    slotsForThisPage = dynamicSlots - 1;
                }

                pageOptions = dynamicOptions.slice(startIndex, startIndex + slotsForThisPage);
            }
        }

        // Add "Previous Page" option
        if (totalPages > 1 && currentPage > 1) {
            finalOptions.push({
                label: `⬅️ Previous Page (${currentPage - 1}/${totalPages})`,
                value: `!page_${currentPage - 1}`,
            });
        }

        // Add the options for the current page
        finalOptions.push(...pageOptions);

        // Add "Next Page" option
        if (totalPages > 1 && currentPage < totalPages) {
            finalOptions.push({
                label: `➡️ Next Page (${currentPage + 1}/${totalPages})`,
                value: `!page_${currentPage + 1}`,
            });
        }

        // Add bottom-pinned options
        finalOptions.push(...this.bottomPinned);

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`${this.customId}|page${currentPage}`)
            .setPlaceholder(this.placeholder)
            .addOptions(finalOptions.slice(0, MAX_OPTIONS_PER_PAGE)); // Final safeguard

        return new ActionRowBuilder().addComponents(selectMenu);
    }
}

module.exports = DropdownHandler;
