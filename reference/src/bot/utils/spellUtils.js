/**
 * @file Contains utility functions related to formatting and handling spell data.
 * @author jules
 */

/**
 * A mapping of 5etools spell school abbreviations to their full names.
 * @type {Object.<string, string>}
 */
const SCHOOL_MAP = {
    'A': 'Abjuration',
    'C': 'Conjuration',
    'D': 'Divination',
    'E': 'Enchantment',
    'V': 'Evocation',
    'I': 'Illusion',
    'N': 'Necromancy',
    'T': 'Transmutation',
};

/**
 * Converts a spell school abbreviation (e.g., 'A') to its full name (e.g., 'Abjuration').
 * @param {string} abbreviation The single-letter abbreviation for the spell school.
 * @returns {string} The full name of the spell school, or 'Unknown' if not found.
 */
function getSchoolName(abbreviation) {
    return SCHOOL_MAP[abbreviation.toUpperCase()] || 'Unknown';
}

module.exports = {
    getSchoolName,
};