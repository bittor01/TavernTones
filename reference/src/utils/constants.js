/**
 * @file Defines constants used throughout the application, such as CR-to-XP mappings and embed colors.
 * @author jules
 */

/**
 * A mapping of Challenge Rating (CR) values to their corresponding experience point (XP) rewards.
 * This is used for encounter building and monster stat blocks.
 * @type {Object.<string, number>}
 */
const CR_TO_XP = {
    "0": 10,
    "1/8": 25,
    "1/4": 50,
    "1/2": 100,
    "1": 200,
    "2": 450,
    "3": 700,
    "4": 1100,
    "5": 1800,
    "6": 2300,
    "7": 2900,
    "8": 3900,
    "9": 5000,
    "10": 5900,
    "11": 7200,
    "12": 8400,
    "13": 10000,
    "14": 11500,
    "15": 13000,
    "16": 15000,
    "17": 18000,
    "18": 20000,
    "19": 22000,
    "20": 25000,
    "21": 33000,
    "22": 41000,
    "23": 50000,
    "24": 62000,
    "25": 75000,
    "26": 90000,
    "27": 105000,
    "28": 120000,
    "29": 135000,
    "30": 155000
};

/**
 * A collection of hexadecimal color codes used for Discord embeds to visually distinguish
 * between different types of content (e.g., monsters, items, spells).
 * @type {Object.<string, number>}
 */
const EMBED_COLORS = {
    DEFAULT: 0x95A5A6,
    MONSTER: 0xE74C3C,
    ITEM: 0xA0522D,
    TRAP: 0xFFA500,
    HAZARD: 0xFFA500,
    SPELL: 0x8A2BE2,
    FEAT: 0x5DADE2,
    RACE: 0x1ABC9C,
    BACKGROUND: 0xF1C40F,
};

module.exports = {
    CR_TO_XP,
    EMBED_COLORS,
};