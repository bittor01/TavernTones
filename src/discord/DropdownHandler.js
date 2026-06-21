// Process: const  StringSelectMenuBuilder, ActionRowBuilder, ButtonB...
const { StringSelectMenuBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

/**
 * Manages paginated dropdown menus in Discord.
 * Supports pinned items at the top and bottom of the list.
 */
class DropdownHandler {
    /**
     * Initializes the dropdown handler with options and pinning logic.
     * @param {object} params - Configuration parameters.
     * @param {string} params.customId - The unique identifier for this select menu.
     * @param {object[]} params.options - The full list of select menu options.
     * @param {string} [params.placeholder] - Text to display when nothing is selected.
     * @param {object[]} [params.topPinned] - Options to always show at the top of every page.
     * @param {object[]} [params.bottomPinned] - Options to always show at the bottom of every page.
     */
    // Process: constructor( customId, options, placeholder = 'Select an ...
    constructor({ customId, options, placeholder = 'Select an option', topPinned = [], bottomPinned = [] }) {
        // Store the interaction ID for the menu
        this.customId = customId;
        // The complete pool of options to paginate
        // Process: this.options = options
        this.options = options; // Expected format: [{ label, value, description?, emoji? }]
        // Set the UI placeholder text
        this.placeholder = placeholder;
        // Store items that should always appear at the top
        // Process: this.topPinned = topPinned
        this.topPinned = topPinned;
        // Store items that should always appear at the bottom
        this.bottomPinned = bottomPinned;

        // Calculate how many slots are taken by pinned items
        // Process: let reservedSlots = this.topPinned.length + this.bottomPi...
        let reservedSlots = this.topPinned.length + this.bottomPinned.length;
        // If we have more options than can fit in one page (25 slots)
        if (this.options.length > (25 - reservedSlots)) {
            // Reserve two additional slots for 'Next' and 'Previous' navigation buttons
            // Process: reservedSlots += 2
            reservedSlots += 2;
        }
        // Determine the number of variable options that can fit on each page
        // Process: this.pageSize = 25 - reservedSlots
        this.pageSize = 25 - reservedSlots;
        // Ensure page size is at least 1 to avoid division by zero or errors
        if (this.pageSize < 1) this.pageSize = 1;

        // Calculate the total number of pages needed
        // Process: this.totalPages = this.options.length > 0 ? Math.ceil(thi...
        this.totalPages = this.options.length > 0 ? Math.ceil(this.options.length / this.pageSize) : 1;
        // Track the currently selected value
        this.selected = null;
    // Process:
    }

    /**
     * Sets the default selected value for the menu.
     * @param {string} selectedValue - The value that should be marked as default.
     */
    setDefault(selectedValue) {
        // Update the internal tracker for the selected item
        // Process: this.selected = selectedValue
        this.selected = selectedValue;
    }

    /**
     * Generates a Discord ActionRow containing the select menu for a specific page.
     * @param {number} [page=1] - The page number to generate.
     * @returns {ActionRowBuilder} The constructed action row.
     */
    // Process: createActionRow(page = 1)
    createActionRow(page = 1) {
        // Clamp the page number within valid bounds
        if (page < 1) page = 1;
        // Process: if (page > this.totalPages) page = this.totalPages
        if (page > this.totalPages) page = this.totalPages;

        // Create a new string select menu builder
        const selectMenu = new StringSelectMenuBuilder()
            // Embed the page number in the custom ID for callback handling
            // Process: .setCustomId(`$this.customId|$page`)
            .setCustomId(`${this.customId}|${page}`)
            // Set the instruction text
            .setPlaceholder(this.placeholder);

        // Retrieve the options for the requested page
        // Process: const currentPageOptions = this._getPageOptions(page)
        const currentPageOptions = this._getPageOptions(page);
        // If options exist, add them to the menu
        if (currentPageOptions.length > 0) {
            // Process: selectMenu.addOptions(currentPageOptions)
            selectMenu.addOptions(currentPageOptions);
        } else {
            // If no options, add a single disabled entry to keep the UI valid
            // Process: selectMenu.addOptions([ label: 'No options available', va...
            selectMenu.addOptions([{ label: 'No options available', value: 'no_options', default: false }]).setDisabled(true);
        }

        // Wrap the select menu in an ActionRow and return it
        // Process: const row = new ActionRowBuilder().addComponents(selectMenu)
        const row = new ActionRowBuilder().addComponents(selectMenu);
        return row;
    // Process:
    }

    /**
     * Compiles the list of options for a specific page, including pins and navigation.
     * @param {number} page - The page index.
     * @returns {object[]} Array of Discord option objects.
     * @private
     */
    _getPageOptions(page) {
        // Initialize the array for this page's options
        // Process: const optionsOnPage = []
        const optionsOnPage = [];

        // 1. Process top-pinned options
        this.topPinned.forEach(opt => {
            // Visual indicator: show a pin on page 1, or an up-arrow to indicate it's from page 1 elsewhere
            // Process: const label = (page === 1) ? `📌 $opt.label` : `⬆️ $opt.la...
            const label = (page === 1) ? `📌 ${opt.label}` : `⬆️ ${opt.label}`;
            // Add the pinned option with its selection status
            optionsOnPage.push({ ...opt, label, default: this.selected === opt.value });
        // Process: )
        });

        // 2. Calculate the slice of variable options for this page
        const startIndex = (page - 1) * this.pageSize;
        // Process: const endIndex = startIndex + this.pageSize
        const endIndex = startIndex + this.pageSize;
        // Extract the chunk of options corresponding to the current page
        const paginatedOptions = this.options.slice(startIndex, endIndex);

        // Add each variable option to the page list
        // Process: paginatedOptions.forEach(opt =>
        paginatedOptions.forEach(opt => {
            optionsOnPage.push({ ...opt, default: this.selected === opt.value });
        // Process: )
        });

        // 3. Process bottom-pinned options
        this.bottomPinned.forEach(opt => {
            // Add items that belong at the end of the list
            // Process: optionsOnPage.push( ...opt, default: this.selected === op...
            optionsOnPage.push({ ...opt, default: this.selected === opt.value });
        });

        // 4. Inject navigation controls if pagination is active
        // Process: const needsPagination = this.totalPages > 1
        const needsPagination = this.totalPages > 1;
        if (needsPagination) {
            // If not on the first page, add a "Previous" option
            // Process: if (page > 1)
            if (page > 1) {
                optionsOnPage.unshift({
                    // Process: label: `⬅️ Previous Page ($page - 1/$this.totalPages)`,
                    label: `⬅️ Previous Page (${page - 1}/${this.totalPages})`,
                    value: `!prevPage|${page - 1}`
                // Process: )
                });
            }
            // If not on the last page, add a "Next" option
            // Process: if (page < this.totalPages)
            if (page < this.totalPages) {
                optionsOnPage.push({
                    // Process: label: `➡️ Next Page ($page + 1/$this.totalPages)`,
                    label: `➡️ Next Page (${page + 1}/${this.totalPages})`,
                    value: `!nextPage|${page + 1}`
                // Process: )
                });
            }
        // Process:
        }

        // Ensure we never return more than the 25 options allowed by Discord API
        return optionsOnPage.slice(0, 25);
    // Process:
    }
}

// Process: module.exports = DropdownHandler
module.exports = DropdownHandler;
