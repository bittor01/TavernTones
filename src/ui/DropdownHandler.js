const { StringSelectMenuBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

class DropdownHandler {
    constructor({ customId, options, placeholder = 'Select an option', topPinned = [], bottomPinned = [] }) {
        this.customId = customId;
        this.options = options; // Expected format: [{ label, value, description?, emoji? }]
        this.placeholder = placeholder;
        this.topPinned = topPinned;
        this.bottomPinned = bottomPinned;
        // Adjust page size for pinned items and potential pagination controls
        let reservedSlots = this.topPinned.length + this.bottomPinned.length;
        if (this.options.length > (25 - reservedSlots)) {
            reservedSlots += 2; // Reserve slots for 'Next'/'Previous' if pagination is needed
        }
        this.pageSize = 25 - reservedSlots;
        if (this.pageSize < 1) this.pageSize = 1;

        this.totalPages = this.options.length > 0 ? Math.ceil(this.options.length / this.pageSize) : 1;
        this.selected = null;
    }

    setDefault(selectedValue) {
        this.selected = selectedValue;
    }

    createActionRow(page = 1) {
        if (page < 1) page = 1;
        if (page > this.totalPages) page = this.totalPages;

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`${this.customId}|${page}`)
            .setPlaceholder(this.placeholder);

        const currentPageOptions = this._getPageOptions(page);
        if (currentPageOptions.length > 0) {
            selectMenu.addOptions(currentPageOptions);
        } else {
            // Add a disabled placeholder if no options are available
            selectMenu.addOptions([{ label: 'No options available', value: 'no_options', default: false }]).setDisabled(true);
        }

        const row = new ActionRowBuilder().addComponents(selectMenu);
        return row;
    }

    _getPageOptions(page) {
        const optionsOnPage = [];

        // Add top-pinned options
        this.topPinned.forEach(opt => {
            // On page 1, show a pin. On other pages, show an up arrow.
            const label = (page === 1) ? `📌 ${opt.label}` : `⬆️ ${opt.label}`;
            optionsOnPage.push({ ...opt, label, default: this.selected === opt.value });
        });

        // Calculate and add paginated options
        const startIndex = (page - 1) * this.pageSize;
        const endIndex = startIndex + this.pageSize;
        const paginatedOptions = this.options.slice(startIndex, endIndex);

        paginatedOptions.forEach(opt => {
            optionsOnPage.push({ ...opt, default: this.selected === opt.value });
        });

        // Add bottom-pinned options
        this.bottomPinned.forEach(opt => {
            optionsOnPage.push({ ...opt, default: this.selected === opt.value });
        });

        // Add pagination controls as needed, ensuring we don't exceed 25 total options
        const needsPagination = this.totalPages > 1;
        if (needsPagination) {
            if (page > 1) {
                optionsOnPage.unshift({
                    label: `⬅️ Previous Page (${page - 1}/${this.totalPages})`,
                    value: `!prevPage|${page - 1}`
                });
            }
            if (page < this.totalPages) {
                optionsOnPage.push({
                    label: `➡️ Next Page (${page + 1}/${this.totalPages})`,
                    value: `!nextPage|${page + 1}`
                });
            }
        }

        return optionsOnPage.slice(0, 25);
    }
}

module.exports = DropdownHandler;
