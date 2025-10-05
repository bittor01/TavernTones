/**
 * @file Contains data for classic D&D item generation, including probabilities and rarity values.
 * @author jules
 */

/**
 * Defines the probabilities for different item types (Wondrous Item, Weapon, Armor)
 * based on their rarity (Common, Uncommon, etc.). The values represent the chance
 * of an item of a certain type appearing.
 * @type {Object.<string, Object.<string, number>>}
 */
const standardItemProbabilities = {
    "Common": {
        "Wondrous Item": 80,
        "Weapon": 8,
        "Armor": 8
    },
    "Uncommon": {
        "Wondrous Item": 30,
        "Weapon": 3,
        "Armor": 3
    },
    "Rare": {
        "Wondrous Item": 10,
        "Weapon": 1,
        "Armor": 1
    },
    "Very Rare": {
        "Wondrous Item": 3,
        "Weapon": 0.3,
        "Armor": 0.3
    },
    "Legendary": {
        "Wondrous Item": 1,
        "Weapon": 0.1,
        "Armor": 0.1
    },
    "Artifact": {
        "Wondrous Item": 0.1,
        "Weapon": 0.01,
        "Armor": 0.01
    }
};

/**
 * Maps item rarities to their corresponding gold piece (GP) value. "Priceless" is
 * used for artifacts, which are considered to be beyond monetary value.
 * @type {Object.<string, number|string>}
 */
const rarityValue = {
    "Common": 100,
    "Uncommon": 400,
    "Rare": 4000,
    "Very Rare": 40000,
    "Legendary": 200000,
    "Artifact": "Priceless"
}

module.exports = {
    standardItemProbabilities,
    rarityValue
};