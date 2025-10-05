/**
 * @file Contains the LootGenerator class for creating random item hoards and shop inventories.
 * @author jules
 */

const { DiceRoller } = require('@dice-roller/rpg-dice-roller');
const { dataStore } = require('./dataLoader');
const spellItemData = require('./spellItemData');
const classicItemData = require('./classicItemData');

/**
 * Converts various price formats into a consistent, sortable numeric value in gold pieces (GP).
 * Handles numbers, strings with currency units (gp, sp, cp), "priceless", and invalid formats.
 * @param {number|string} price The price to parse (e.g., 1000, "5,000 gp", "10 sp", "Priceless").
 * @returns {number} The numeric value of the price in GP. Returns Infinity for "Priceless" and -1 for unparseable formats.
 */
function getPriceValue(price) {
    if (typeof price === 'number') {
        return price;
    }
    if (typeof price === 'string') {
        const lowerPrice = price.toLowerCase();
        if (lowerPrice === 'priceless') {
            return Infinity;
        }
        if (lowerPrice === 'price not found') {
            return -1;
        }
        // Handle cases like "5,000 gp" or "100 sp"
        const cleanPrice = lowerPrice.replace(/,/g, '').trim();
        // Regex to capture the numeric value and the currency unit
        const match = cleanPrice.match(/^(\d+(\.\d+)?)\s*(gp|sp|cp|ep|pp)?/);
        if (match) {
            let value = parseFloat(match[1]);
            const unit = match[3] || 'gp'; // Default to gp if no unit is specified

            // Convert all currencies to a common unit (gold pieces) for sorting
            switch (unit) {
                case 'cp':
                    value *= 0.01;
                    break;
                case 'sp':
                    value *= 0.1;
                    break;
                case 'ep':
                    value *= 0.5;
                    break;
                case 'pp':
                    value *= 10;
                    break;
                // 'gp' is the base, no conversion needed
            }
            return value;
        }
    }
    return -1; // Default for un-parseable strings, undefined, or null
}

/**
 * A class for generating random loot or shop inventories based on configurable parameters.
 */
class LootGenerator {
    /**
     * Creates an instance of the LootGenerator.
     * @param {object} options - Configuration options for the generator.
     * @param {number} [options.lootMultiplier=1.0] - A multiplier for the probability of finding magic items.
     * @param {string|number} options.numItems - The number of items to generate, can be a number or dice notation (e.g., "2d6").
     * @param {boolean} [options.isShop=false] - If true, generates prices for items.
     * @param {number} [options.priceMultiplier=1.0] - A multiplier for item prices if `isShop` is true.
     * @param {boolean} [options.mundaneOnly=false] - If true, only generates non-magical items.
     */
    constructor(options) {
        this.lootMultiplier = options.lootMultiplier || 1.0;
        this.numItems = options.numItems;
        this.isShop = options.isShop || false;
        this.priceMultiplier = options.priceMultiplier || 1.0;
        this.mundaneOnly = options.mundaneOnly || false;
        this.roller = new DiceRoller();
        this.hits = [];
        this.generatedItems = [];
    }

    /**
     * Calculates potential items ("hits") by rolling against the probability of each item type.
     * It checks both spell-based items and standard items, applying the loot multiplier.
     * The results are stored in `this.hits`.
     */
    calculateHits() {
        // --- 1. Calculate hits for "Spell Items" ---
        for (const itemType of spellItemData.itemTypes) {
            for (let level = 0; level < 10; level++) {
                const baseProb = spellItemData.probabilities[itemType][level];
                if (baseProb === undefined) continue;

                const modifiedProb = Math.min(100, baseProb * this.lootMultiplier);
                const roll = this.roller.roll('1d100').total;

                if (roll <= modifiedProb) {
                    this.hits.push({
                        type: 'spell',
                        itemType: itemType,
                        level: level,
                        weight: baseProb // Use original probability as weight for selection
                    });
                }
            }
        }

        // --- 2. Calculate hits for "Standard Items" ---
        const items = dataStore.get('items') || [];
        const standardItems = items.filter(i => i.rarity && i.rarity.toLowerCase() !== 'none');

        const probabilityKeys = Object.keys(classicItemData.standardItemProbabilities);

        for (const item of standardItems) {
            let itemRarity = item.rarity;
            if (item.rarity.toLowerCase() === 'unknown') {
                itemRarity = 'Artifact';
            }
            const rarityKey = probabilityKeys.find(k => k.toLowerCase() === itemRarity.toLowerCase());

            if (!rarityKey) continue;

            let itemType = 'Wondrous Item';
            const weaponTypes = ['M', 'R'];
            const armorTypes = ['LA', 'MA', 'HA', 'S', 'A'];

            if (weaponTypes.includes(item.type)) {
                itemType = 'Weapon';
            } else if (armorTypes.includes(item.type)) {
                itemType = 'Armor';
            }

            const baseProb = classicItemData.standardItemProbabilities[rarityKey]?.[itemType];
            if (baseProb === undefined) continue;

            const modifiedProb = Math.min(100, baseProb * this.lootMultiplier);
            const roll = this.roller.roll('1d100').total;

            if (roll <= modifiedProb) {
                this.hits.push({
                    type: 'standard',
                    item: item,
                    weight: baseProb // Use original probability as weight
                });
            }
        }
    }

    /**
     * Selects items from the calculated "hits" pool and generates the final item list.
     * It uses a weighted random selection based on the original item probabilities.
     */
    generateItems() {
        if (this.hits.length === 0) return;

        const spellHits = this.hits.filter(h => h.type === 'spell');
        const standardHits = this.hits.filter(h => h.type === 'standard');

        const weightedSpellPool = spellHits.flatMap(hit => {
            const weight = Math.ceil(hit.weight);
            return Array(weight).fill(hit);
        });

        const weightedStandardPool = standardHits.flatMap(hit => {
            const weight = Math.ceil(hit.weight);
            return Array(weight).fill(hit);
        });

        if (weightedSpellPool.length === 0 && weightedStandardPool.length === 0) return;

        for (let i = 0; i < this.numItems; i++) {
            let randomHit;
            const standardPoolExists = weightedStandardPool.length > 0;
            const spellPoolExists = weightedSpellPool.length > 0;

            let drawFromStandard = false;
            if (standardPoolExists && !spellPoolExists) {
                drawFromStandard = true;
            } else if (standardPoolExists && spellPoolExists) {
                if (Math.random() < 0.5) { // 50% chance to draw from either pool
                    drawFromStandard = true;
                }
            }

            if (drawFromStandard) {
                randomHit = weightedStandardPool[Math.floor(Math.random() * weightedStandardPool.length)];
            } else {
                if (spellPoolExists) {
                    randomHit = weightedSpellPool[Math.floor(Math.random() * weightedSpellPool.length)];
                } else {
                    continue; // Should not happen if pools are checked
                }
            }

            if (!randomHit) continue;

            if (randomHit.type === 'spell') {
                this.generateSpellItem(randomHit);
            } else if (randomHit.type === 'standard') {
                this.generateStandardItem(randomHit);
            }
        }
    }

    /**
     * Generates a specific spell-based item (e.g., "Scroll of Fireball").
     * @param {object} hit - The hit object containing item type and spell level.
     */
    generateSpellItem(hit) {
        const { itemType, level } = hit;
        const spells = dataStore.get(`spells-lvl${level}`);
        if (!spells || spells.length === 0) {
            this.generatedItems.push({
                name: `No spells found for level ${level}`,
                rarity: itemType,
                level: level,
                price: this.isShop ? 'N/A' : undefined
            });
            return;
        }

        const itemTypeShortcode = spellItemData.itemTypeShortcodeMap[itemType];
        const compatibleSpells = spells.filter(spell =>
            spell.itemtypes && spell.itemtypes.includes(itemTypeShortcode)
        );

        let selectedSpell;
        if (compatibleSpells.length === 0) {
            selectedSpell = { text: "No compatible spell found" };
        } else {
            selectedSpell = compatibleSpells[Math.floor(Math.random() * compatibleSpells.length)];
        }

        let price = undefined;
        if (this.isShop) {
            const basePrice = spellItemData.prices[itemType][level];
            if (basePrice !== undefined) {
                price = Math.round(basePrice * this.priceMultiplier);
            } else {
                price = 'Price not found';
            }
        }

        const itemName = `${itemType} of ${selectedSpell.text}`;

        this.generatedItems.push({
            name: itemName,
            rarity: itemType,
            level: level,
            price: price
        });
    }

    /**
     * Generates a standard item from the 5etools data.
     * @param {object} hit - The hit object containing the base item data.
     */
    generateStandardItem(hit) {
        const { item } = hit;
        let price = undefined;
        let rarity = item.rarity;

        // Normalize rarity values
        const rarityLower = rarity ? rarity.toLowerCase() : '';
        if (rarityLower === 'none' || rarityLower === '' || rarity === null) {
            rarity = 'Mundane';
        } else if (rarityLower === 'unknown') {
            rarity = 'Artifact';
        }

        const rarityKeys = Object.keys(classicItemData.rarityValue);
        const canonicalRarity = rarityKeys.find(k => k.toLowerCase() === (rarity ? rarity.toLowerCase() : ''));

        if (this.isShop) {
            if (canonicalRarity === 'Artifact') {
                price = 'Priceless';
            } else if (canonicalRarity) {
                const basePrice = classicItemData.rarityValue[canonicalRarity];
                if (basePrice) {
                    const variance = 1 + (Math.random() * 0.4 - 0.2); // +/- 20%
                    price = Math.round(basePrice * variance * this.priceMultiplier);
                } else {
                    price = 'Price not found';
                }
            } else if (rarity === 'Mundane') {
                price = item.value ? item.value : 'Price not found';
            }
             else {
                price = 'Price not found';
            }
        }

        this.generatedItems.push({
            name: item.name,
            rarity: canonicalRarity || rarity,
            price: price
        });
    }

    /**
     * Sorts the generated items by price (lowest to highest) and then by name, and returns the final result.
     * @returns {{items: object[]}} An object containing the sorted list of generated items.
     */
    getResults() {
        this.generatedItems.sort((a, b) => {
            const priceA = getPriceValue(a.price);
            const priceB = getPriceValue(b.price);
            if (priceA !== priceB) {
                return priceA - priceB;
            }
            return (a.name || '').localeCompare(b.name || '');
        });

        return { items: this.generatedItems };
    }

    /**
     * Generates a shop inventory consisting only of mundane (non-magical) items.
     * @returns {{items: object[]}} An object containing the sorted list of mundane items.
     */
    generateMundaneShop() {
        const items = dataStore.get('items') || [];
        const mundaneItems = items.filter(i => !i.rarity || i.rarity.toLowerCase() === 'none' || i.rarity === '');

        for (let i = 0; i < this.numItems; i++) {
            if (mundaneItems.length === 0) break;
            const randomIndex = Math.floor(Math.random() * mundaneItems.length);
            const selectedItem = mundaneItems[randomIndex];

            mundaneItems.splice(randomIndex, 1);

            let price;
            if (this.isShop) {
                price = selectedItem.value ? selectedItem.value : 'Price not found';
            }

            this.generatedItems.push({
                name: selectedItem.name,
                rarity: 'Mundane',
                price: price
            });
        }
        this.generatedItems.sort((a, b) => {
            const priceA = getPriceValue(a.price);
            const priceB = getPriceValue(b.price);
            if (priceA !== priceB) {
                return priceA - priceB;
            }
            return (a.name || '').localeCompare(b.name || '');
        });
        return { items: this.generatedItems };
    }

    /**
     * The main entry point for the generator. It rolls for the number of items,
     * calculates hits, generates the items, and returns the sorted results.
     * @returns {{items: object[]}} The final generated loot or shop inventory.
     */
    generate() {
        try {
            this.numItems = this.roller.roll(this.numItems.toString()).total;
        } catch (e) {
            const parsedNum = parseInt(this.numItems, 10);
            if (isNaN(parsedNum) || parsedNum <= 0) {
                throw new Error("Invalid number of items. Please provide a positive number or dice notation (e.g., '1d4+1').");
            }
            this.numItems = parsedNum;
        }

        if (this.mundaneOnly) {
            return this.generateMundaneShop();
        }

        this.calculateHits();
        this.generateItems();
        return this.getResults();
    }
}

module.exports = { LootGenerator };