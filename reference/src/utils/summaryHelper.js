/**
 * @file Helper functions for creating summarized versions of 5etools data objects.
 * This is essential for search results and list views where only key information is needed.
 * @author jules
 */

const { resolveCopy } = require('./dataProcessor');

/**
 * Creates a summarized version of a single data object based on its category.
 * It extracts key fields relevant to that category (e.g., CR for monsters, level for spells)
 * to create a lightweight summary object. It also resolves any `_copy` properties first.
 * @param {string} category The category of the data (e.g., 'bestiary', 'spells').
 * @param {object} item The data object to summarize.
 * @param {Map<string, Array<object>>} dataStore The complete data store, used by `resolveCopy`.
 * @returns {object} A new summary object containing key fields like `name`, `source`, and category-specific data.
 */
function createSummary(category, item, dataStore) {
    // First, resolve the item to ensure we have the complete data object, including inherited properties.
    const resolvedItem = resolveCopy(item, category, dataStore);

    const summary = {
        name: resolvedItem.name,
        source: resolvedItem.source,
        category: category,
    };

    // Add category-specific fields to the summary.
    switch (category) {
        case 'bestiary':
            summary.cr = resolvedItem.cr;
            summary.environment = resolvedItem.environment;
            break;
        case 'spells':
            summary.level = resolvedItem.level;
            summary.school = resolvedItem.school;
            break;
        case 'items':
            summary.rarity = resolvedItem.rarity;
            break;
        case 'vehicles':
            summary.hp = resolvedItem.hp;
            break;
        default:
            // No extra fields for other categories.
            break;
    }

    return summary;
}

/**
 * Processes an array of data objects and returns an array of their summaries.
 * If the input is not an array, it processes it as a single item.
 * @param {string} category The category of the data.
 * @param {Array<object>|object} data An array of data objects or a single data object.
 * @param {Map<string, Array<object>>} dataStore The complete data store for lookups.
 * @returns {Array<object>|object} An array of summary objects or a single summary object.
 */
function summarize(category, data, dataStore) {
    if (!Array.isArray(data)) {
        return createSummary(category, data, dataStore);
    }
    return data.map(item => createSummary(category, item, dataStore));
}

module.exports = {
    summarize,
};