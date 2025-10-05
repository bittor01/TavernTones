/**
 * @file Defines a standardized set of colors for use in Discord embeds.
 * This ensures a consistent look and feel for all bot responses.
 * @author jules
 */

/**
 * A collection of hexadecimal color codes represented as integers for use in Discord.js embeds.
 * Using a standardized palette helps maintain visual consistency across different commands.
 * @type {Object.<string, number>}
 */
const EMBED_COLORS = {
    // --- General Purpose Colors ---
    DEFAULT: 0x5865F2, // Discord Blurple
    SUCCESS: 0x57F287, // Discord Green
    ERROR: 0xED4245,   // Discord Red
    WARNING: 0xFEE75C, // Discord Yellow
    INFO: 0x3498DB,    // A nice, clear blue

    // --- Generator Specific Colors ---
    CHARACTER: 0x9B59B6, // Purple for characters/feats/races
    ENCOUNTER: 0xE67E22, // Orange for encounters
    LOOT: 0xF1C40F,      // Gold for loot/shops
    TRAP: 0xE74C3C,      // A darker red for traps/hazards
    VEHICLE: 0x1ABC9C,   // Teal for vehicles

    // --- Search Result Specific Colors ---
    SPELL: 0x8888FF,     // A mystical blue for spells
    ITEM: 0xF1C40F,      // Same as LOOT
    MONSTER: 0xE67E22,   // Same as ENCOUNTER
};

module.exports = { EMBED_COLORS };