/**
 * @file Contains data for generating spell-based items, such as scrolls, potions, and poisons.
 * This includes item types, generation probabilities, prices, and shortcodes.
 * @author jules
 */

/**
 * An array of all available spell-based item types.
 * @type {string[]}
 */
const itemTypes = [
    "Reusable Item (Gizmo)",
    "Single-use Scroll/Tablet",
    "Glyph/Ward/Trap",
    "Enchanted Ammunition",
    "Potion",
    "Poison, Ingested",
    "Poison, Inhaled",
    "Poison, Contact",
    "Poison, Injury"
];

/**
 * A mapping of item types to their generation probabilities based on spell level (0-9).
 * The values are percentages (e.g., 80 means an 80% chance).
 * The array index corresponds to the spell level.
 * @type {Object.<string, number[]>}
 */
const probabilities = {
    "Reusable Item (Gizmo)":      [80, 70, 60, 50, 40, 30, 20, 15, 10, 3],
    "Single-use Scroll/Tablet": [90, 85, 75, 65, 55, 45, 35, 25, 15, 5],
    "Glyph/Ward/Trap":          [70, 60, 50, 40, 30, 25, 20, 15, 10, 5],
    "Enchanted Ammunition":     [75, 65, 55, 45, 35, 30, 25, 20, 15, 5],
    "Potion":                   [85, 75, 65, 55, 45, 35, 30, 20, 15, 5],
    "Poison, Ingested":         [50, 45, 40, 35, 30, 25, 20, 15, 10, 5],
    "Poison, Inhaled":          [45, 40, 35, 30, 25, 20, 15, 10, 7, 3],
    "Poison, Contact":          [40, 35, 30, 25, 20, 15, 10, 7, 5, 2],
    "Poison, Injury":           [35, 30, 25, 20, 15, 10, 7, 5, 3, 1]
};

/**
 * A mapping of item types to their base prices in Gold Pieces (GP) based on spell level (0-9).
 * The array index corresponds to the spell level.
 * @type {Object.<string, number[]>}
 */
const prices = {
    "Reusable Item (Gizmo)":      [1000, 3000, 10000, 20000, 50000, 100000, 200000, 400000, 750000, 1000000],
    "Single-use Scroll/Tablet": [10, 50, 150, 300, 750, 1500, 3000, 6000, 12500, 25000],
    "Glyph/Ward/Trap":          [50, 150, 300, 600, 1500, 3000, 6000, 12000, 25000, 50000],
    "Enchanted Ammunition":     [8, 35, 100, 240, 600, 1200, 2500, 5000, 10000, 20000],
    "Potion":                   [20, 80, 200, 400, 1000, 2500, 5000, 10000, 20000, 40000],
    "Poison, Ingested":         [30, 120, 250, 500, 1200, 3000, 6000, 12500, 25000, 50000],
    "Poison, Inhaled":          [35, 150, 300, 600, 1500, 3500, 7500, 15000, 30000, 60000],
    "Poison, Contact":          [40, 180, 350, 700, 1700, 4000, 8000, 16000, 32000, 65000],
    "Poison, Injury":           [50, 200, 400, 800, 2000, 5000, 10000, 20000, 40000, 80000]
};

/**
 * A mapping of full item type names to their corresponding shortcodes.
 * These shortcodes are used to link items to compatible spells in the 5etools data.
 * @type {Object.<string, string>}
 */
const itemTypeShortcodeMap = {
    "Reusable Item (Gizmo)": "Giz",
    "Single-use Scroll/Tablet": "Scr",
    "Glyph/Ward/Trap": "GWT",
    "Enchanted Ammunition": "Amm",
    "Potion": "Pot",
    "Poison, Ingested": "Ing",
    "Poison, Inhaled": "Inh",
    "Poison, Contact": "Con",
    "Poison, Injury": "Inj"
};

module.exports = {
    itemTypes,
    probabilities,
    prices,
    itemTypeShortcodeMap
};