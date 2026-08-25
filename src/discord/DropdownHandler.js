// Import necessary builders from discord.js to construct select menus and layout rows
const { StringSelectMenuBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

/**
 * The DropdownHandler class manages the creation and pagination logic for
 * Discord String Select Menus. It supports pinned items at the top and bottom
 * and handles multi-page navigation within the 25-option limit of Discord menus.
 */
class DropdownHandler {
    /**
     * Initializes the dropdown handler with options and pinning configuration.
     * @param {string} customId - Unique identifier for the select menu.
     * @param {object[]} options - List of selectable items: { label, value, description, emoji }.
     * @param {string} [placeholder='Select an option'] - Text displayed when no option is selected.
     * @param {object[]} [topPinned=[]] - Options to always show at the top of the menu.
     * @param {object[]} [bottomPinned=[]] - Options to always show at the bottom of the menu.
     */
    constructor({ customId, options, placeholder = 'Select an option', topPinned = [], bottomPinned = [] }) {
        // Store the base custom ID for the menu
        this.customId = customId;
        // The full list of dynamic options to be paginated
        this.options = options;
        // The placeholder text
        this.placeholder = placeholder;
        // Store pinned items
        this.topPinned = topPinned;
        this.bottomPinned = bottomPinned;

        // Discord has a hard limit of 25 options per select menu.
        // We calculate how many slots are left for the dynamic content.
        let reservedSlots = this.topPinned.length + this.bottomPinned.length;
        // If there's more than one page of content, we need 2 extra slots for navigation buttons.
        if (this.options.length > (25 - reservedSlots)) {
            reservedSlots += 2;
        }
        // Page size is the remaining space after accounting for pins and navigation.
        this.pageSize = 25 - reservedSlots;
        // Ensure page size is at least 1 to avoid division by zero or negative values.
        if (this.pageSize < 1) this.pageSize = 1;

        // Calculate the total number of pages needed to display all options.
        this.totalPages = this.options.length > 0 ? Math.ceil(this.options.length / this.pageSize) : 1;
        // Tracks the currently selected value to set the 'default' property in the UI.
        this.selected = null;
    }

    /**
     * Sets which value should be marked as currently selected in the menu.
     * @param {string} selectedValue - The value that matches an option's 'value' property.
     */
    setDefault(selectedValue) {
        this.selected = selectedValue;
    }

    /**
     * Generates a Discord ActionRow containing the select menu for a specific page.
     * @param {number} [page=1] - The page number to generate.
     * @returns {ActionRowBuilder} The constructed action row.
     */
    createActionRow(page = 1) {
        // Clamp the page number between 1 and the total pages.
        if (page < 1) page = 1;
        if (page > this.totalPages) page = this.totalPages;

        // Create the select menu and encode the page number into the custom ID.
        // This allows the interaction handler to know which page is being viewed.
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`${this.customId}|${page}`)
            .setPlaceholder(this.placeholder);

        // Fetch the specific set of options that should appear on this page.
        const currentPageOptions = this._getPageOptions(page);
        if (currentPageOptions.length > 0) {
            selectMenu.addOptions(currentPageOptions);
        } else {
            // If the list is empty, add a placeholder option and disable the menu.
            // Discord requires at least one option to render a select menu.
            selectMenu.addOptions([{ label: 'No options available', value: 'no_options', default: false }]).setDisabled(true);
        }

        // Wrap the menu in an ActionRow and return it.
        const row = new ActionRowBuilder().addComponents(selectMenu);
        return row;
    }

    /**
     * Internal helper to assemble the options array for a specific page,
     * including pins and navigation controls.
     * @param {number} page - The current page index.
     * @returns {object[]} The final array of up to 25 Discord options.
     */
    _getPageOptions(page) {
        const optionsOnPage = [];

        // 1. Add top-pinned options (e.g. "Global Reset" or "Back to Menu")
        this.topPinned.forEach(opt => {
            // Visual indicator: show a pin on page 1, and an up arrow on others to suggest it's fixed.
            const label = (page === 1) ? `📌 ${opt.label}` : `⬆️ ${opt.label}`;
            optionsOnPage.push({ ...opt, label, default: this.selected === opt.value });
        });

        // 2. Calculate the slice of dynamic options for the current page.
        const startIndex = (page - 1) * this.pageSize;
        const endIndex = startIndex + this.pageSize;
        const paginatedOptions = this.options.slice(startIndex, endIndex);

        // Add each paginated option to the result set.
        paginatedOptions.forEach(opt => {
            optionsOnPage.push({ ...opt, default: this.selected === opt.value });
        });

        // 3. Add bottom-pinned options.
        this.bottomPinned.forEach(opt => {
            optionsOnPage.push({ ...opt, default: this.selected === opt.value });
        });

        // 4. Add pagination navigation controls if we have more than one page.
        const needsPagination = this.totalPages > 1;
        if (needsPagination) {
            // Add a "Previous Page" option at the start if we aren't on the first page.
            if (page > 1) {
                optionsOnPage.unshift({
                    label: `⬅️ Previous Page (${page - 1}/${this.totalPages})`,
                    value: `!prevPage|${page - 1}`
                });
            }
            // Add a "Next Page" option at the end if we aren't on the last page.
            if (page < this.totalPages) {
                optionsOnPage.push({
                    label: `➡️ Next Page (${page + 1}/${this.totalPages})`,
                    value: `!nextPage|${page + 1}`
                });
            }
        }

        // Final safety check: ensure we never return more than the Discord-enforced 25 items.
        return optionsOnPage.slice(0, 25);
    }
}

// Export the class for use in interaction handlers.
module.exports = DropdownHandler;
