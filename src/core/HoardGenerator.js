const { DiceRoller } = require('@dice-roller/rpg-dice-roller');

// Treasure details based on hoard size, inspired by D&D treasure tables.
const HOARD_DETAILS_BY_SIZE = {
    'Tiny': {
        coins: { cp: '6d6*100', sp: '3d6*100', gp: '2d6*10' },
        gems: { chance: 25, roll: '1d6', value: 10 },
        art: { chance: 25, roll: '1d4', value: 25 },
        magicItems: { chance: 25, roll: '1d4', table: 'A' }
    },
    'Small': {
        coins: { cp: '2d6*1000', sp: '6d6*100', gp: '3d6*10' },
        gems: { chance: 50, roll: '2d6', value: 50 },
        art: { chance: 50, roll: '2d4', value: 50 },
        magicItems: { chance: 50, roll: '1d6', table: 'B' }
    },
    'Average': {
        coins: { cp: '0', sp: '0', gp: '4d6*100', pp: '1d6*10' },
        gems: { chance: 75, roll: '3d6', value: 100 },
        art: { chance: 75, roll: '2d6', value: 250 },
        magicItems: { chance: 75, roll: '1d4', table: 'C' }
    },
    'Large': {
        coins: { cp: '0', sp: '0', gp: '5d6*1000', pp: '2d6*100' },
        gems: { chance: 90, roll: '3d6', value: 500 },
        art: { chance: 90, roll: '2d8', value: 750 },
        magicItems: { chance: 90, roll: '1d6', table: 'D' }
    },
    'Huge': {
        coins: { cp: '0', sp: '0', gp: '8d6*1000', pp: '4d6*100' },
        gems: { chance: 100, roll: '3d6', value: 1000 },
        art: { chance: 100, roll: '3d6', value: 2500 },
        magicItems: { chance: 100, roll: '1d8', table: 'E' }
    }
};

class HoardGenerator {
    /**
     * @param {object} fiveEToolsParser - An instance of the 5eToolsParser.
     */
    constructor(fiveEToolsParser) {
        this.fiveEToolsParser = fiveEToolsParser;
        this.roller = new DiceRoller();
    }

    /**
     * Rolls dice for coins and calculates their total value in GP.
     * @param {object} coinRules - The coin rolling rules for the hoard size.
     * @param {number} multiplier - A multiplier to adjust the amount of coins.
     * @returns {object} An object containing the coin counts and their total value in GP.
     */
    _generateCoins(coinRules, multiplier) {
        const coins = {};
        let totalValueGP = 0;

        for (const [currency, dice] of Object.entries(coinRules)) {
            if (dice === '0') continue;
            const roll = this.roller.roll(dice);
            const amount = Math.floor(roll.total * multiplier);
            coins[currency] = amount;

            switch (currency) {
                case 'cp': totalValueGP += amount / 100; break;
                case 'sp': totalValueGP += amount / 10; break;
                case 'gp': totalValueGP += amount; break;
                case 'pp': totalValueGP += amount * 10; break;
            }
        }
        return { coins, totalValueGP };
    }

    /**
     * Fetches a random item from a given category (gems, art objects).
     * @param {string} category - The category of item to fetch.
     * @param {number} value - The value of the item to fetch.
     * @returns {Promise<object|null>} The fetched item or null.
     */
    async _getRandomValuable(category, value) {
        const items = await this.fiveEToolsParser.getValuables(category, value);
        if (items.length === 0) return null;
        return items[Math.floor(Math.random() * items.length)];
    }

    /**
     * Fetches a random magic item from a given magic item table.
     * @param {string} table - The magic item table to roll on (e.g., 'A', 'B').
     * @returns {Promise<object|null>} The fetched magic item or null.
     */
    async _getRandomMagicItem(table) {
        const items = await this.fiveEToolsParser.getMagicItemsByTable(table);
        if (items.length === 0) return null;
        return items[Math.floor(Math.random() * items.length)];
    }

    /**
     * Generates a treasure hoard.
     * @param {object} options - The options for hoard generation.
     * @param {string} [options.size='Average'] - The size of the hoard.
     * @param {number} [options.lootMultiplier=1.0] - Multiplier for coin amounts.
     * @returns {Promise<object>} An object containing the generated hoard details.
     */
    async generateHoard({ size = 'Average', lootMultiplier = 1.0 }) {
        const details = HOARD_DETAILS_BY_SIZE[size];
        if (!details) {
            throw new Error(`Invalid hoard size: ${size}`);
        }

        const { coins, totalValueGP: coinValue } = this._generateCoins(details.coins, lootMultiplier);
        let totalValue = coinValue;

        const items = [];

        // Generate Gems
        if (Math.random() * 100 < details.gems.chance) {
            const numGems = this.roller.roll(details.gems.roll).total;
            for (let i = 0; i < numGems; i++) {
                const gem = await this._getRandomValuable('gems', details.gems.value);
                if (gem) {
                    items.push(`💎 ${gem.name} (${gem.value} gp)`);
                    totalValue += gem.value;
                }
            }
        }

        // Generate Art Objects
        if (Math.random() * 100 < details.art.chance) {
            const numArt = this.roller.roll(details.art.roll).total;
            for (let i = 0; i < numArt; i++) {
                const art = await this._getRandomValuable('artobjects', details.art.value);
                if (art) {
                    items.push(`🎨 ${art.name} (${art.value} gp)`);
                    totalValue += art.value;
                }
            }
        }

        // Generate Magic Items
        if (Math.random() * 100 < details.magicItems.chance) {
            const numMagic = this.roller.roll(details.magicItems.roll).total;
            for (let i = 0; i < numMagic; i++) {
                const magicItem = await this._getRandomMagicItem(details.magicItems.table);
                if (magicItem) {
                    items.push(`✨ ${magicItem.name} (${magicItem.rarity})`);
                }
            }
        }

        return {
            size,
            coins,
            items,
            totalValue: Math.round(totalValue)
        };
    }
}

module.exports = HoardGenerator;