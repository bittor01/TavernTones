/**
 * @file Provides utility functions for manipulating data structures.
 * @author jules
 */

/**
 * Recursively removes specified keys from an object or an array of objects.
 * This function is primarily used to strip down bulky 5etools data objects into summarized
 * versions for list views by removing keys that contain large blocks of text.
 * @param {any} data The data to process (can be an object or an array).
 * @param {string[]} [keysToRemove=['entries', 'description', ...]] An array of keys to remove.
 * @returns {any} The processed data with the specified keys and their values removed.
 */
function removeFullText(data, keysToRemove = ['entries', 'description', 'text', 'flavorText', 'actionEntries', 'reaction', 'legendaryEntries', 'spellcasting', 'legendaryHeader', 'legendaryActions', 'mythicHeader', 'mythicEntries', 'variant', 'footer', 'note', 'condition', 'otherSources']) {
    if (!data) return data;

    // If it's an array, process each item
    if (Array.isArray(data)) {
        return data.map(item => removeFullText(item, keysToRemove));
    }

    // If it's not an object, return it as is
    if (typeof data !== 'object' || data === null) {
        return data;
    }

    // Create a new object to avoid mutating the original
    const newObj = {};
    for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
            if (keysToRemove.includes(key)) {
                continue; // Skip this key
            }
            // Recurse for nested objects and arrays
            newObj[key] = removeFullText(data[key], keysToRemove);
        }
    }

    return newObj;
}

module.exports = {
    removeFullText
};