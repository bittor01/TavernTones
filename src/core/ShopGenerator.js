const { DiceRoller } = require('@dice-roller/rpg-dice-roller');

// Rarity weights for item generation based on settlement size.
const RARITY_WEIGHTS_BY_SIZE = {
    'Tiny':    { 'Common': 100, 'Uncommon': 5, 'Rare': 0, 'Very Rare': 0, 'Legendary': 0 },
    'Small':   { 'Common': 100, 'Uncommon': 25, 'Rare': 1, 'Very Rare': 0, 'Legendary': 0 },
    'Average': { 'Common': 100, 'Uncommon': 50, 'Rare': 10, 'Very Rare': 1, 'Legendary': 0 },
    'Large':   { 'Common': 100, 'Uncommon': 75, 'Rare': 25, 'Very Rare': 5, 'Legendary': 1 },
    'Huge':    { 'Common': 100, 'Uncommon': 100, 'Rare': 50, 'Very Rare': 10, 'Legendary': 5 },
};

// Price ranges based on rarity, loosely based on Xanathar's Guide to Everything.
// Used for items that do not have a specified value in the source data.
const PRICE_RANGES_BY_RARITY = {
    'Common':    { dice: '1d6*10' },    // avg 35gp
    'Uncommon':  { dice: '1d6*100' },   // avg 350gp
    'Rare':      { dice: '2d10*100' },  // avg 1100gp
    'Very Rare': { dice: '1d4*10000' }, // avg 25000gp
    'Legendary': { dice: '2d6*25000' }, // avg 175000gp
};


class ShopGenerator {
    /**
     * @param {object} fiveEToolsParser - An instance of the 5eToolsParser.
     */
    constructor(fiveEToolsParser) {
        this.fiveEToolsParser = fiveEToolsParser;
        this.roller = new DiceRoller();
    }

    /**
     * Formats a price in copper pieces into a string (e.g., "10 gp 5 sp").
     * @param {number} copper - The price in copper pieces.
     * @returns {string} The formatted price string.
     */
    _formatPrice(copper) {
        if (isNaN(copper) || copper === 0) return 'Price Varies';
        let gp = Math.floor(copper / 100);
        let sp = Math.floor((copper % 100) / 10);
        let cp = copper % 10;
        let parts = [];
        if (gp > 0) parts.push(`${gp} gp`);
        if (sp > 0) parts.push(`${sp} sp`);
        if (cp > 0) parts.push(`${cp} cp`);
        return parts.join(' ') || '0 cp';
    }

    /**
     * Generates a price for an item. Uses the item's value if available,
     * otherwise generates a price based on its rarity.
     * @param {object} item - The item object.
     * @returns {number} The price in copper pieces.
     */
    _generatePrice(item) {
        if (item.value) {
            return item.value;
        }

        const rarityInfo = PRICE_RANGES_BY_RARITY[item.rarity];
        if (!rarityInfo) {
            return 0; // Cannot determine price
        }

        const roll = this.roller.roll(rarityInfo.dice);
        return roll.total * 100; // Convert generated GP value to copper
    }

    /**
     * Selects a rarity category based on weighted probabilities for a given settlement size.
     * @param {string} size - The size of the settlement.
     * @returns {string} The selected rarity string.
     */
    _selectRarity(size) {
        const weights = RARITY_WEIGHTS_BY_SIZE[size];
        if (!weights) return 'Common';

        const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
        let random = Math.random() * totalWeight;

        for (const [rarity, weight] of Object.entries(weights)) {
            if (random < weight) {
                return rarity;
            }
            random -= weight;
        }
        return 'Common'; // Fallback
    }

    /**
     * Generates a shop inventory.
     * @param {object} options - The options for shop generation.
     * @param {string} [options.size='Average'] - The size of the settlement (e.g., 'Tiny', 'Small').
     * @param {string} [options.numItems='10'] - The number of items to generate (can be a dice roll string).
     * @param {number} [options.priceMultiplier=1.0] - A multiplier to adjust item prices.
     * @returns {Promise<object>} An object containing the shop size and the generated inventory.
     */
    async generateShop({ size = 'Average', numItems = '10', priceMultiplier = 1.0 }) {
        const allItems = await this.fiveEToolsParser._loadCategoryData('items');
        const magicItems = allItems.filter(item =>
            item.rarity && item.rarity !== 'None' && item.rarity !== 'Artifact' && item.rarity !== 'Unknown'
        );

        const roll = this.roller.roll(numItems);
        const count = roll.total;

        const shopInventory = [];
        for (let i = 0; i < count; i++) {
            const targetRarity = this._selectRarity(size);
            const potentialItems = magicItems.filter(item => item.rarity === targetRarity);

            if (potentialItems.length > 0) {
                const selectedItem = potentialItems[Math.floor(Math.random() * potentialItems.length)];

                if (shopInventory.find(invItem => invItem.name === selectedItem.name)) {
                    i--; // Decrement to try again, avoiding duplicates
                    continue;
                }

                const basePrice = this._generatePrice(selectedItem);
                const finalPrice = Math.round(basePrice * (priceMultiplier || 1.0));

                shopInventory.push({
                    name: selectedItem.name,
                    rarity: selectedItem.rarity,
                    price: this._formatPrice(finalPrice),
                    source: selectedItem.source
                });
            }
        }

        const rarityOrder = { 'Common': 1, 'Uncommon': 2, 'Rare': 3, 'Very Rare': 4, 'Legendary': 5 };
        shopInventory.sort((a, b) => {
            const rarityA = rarityOrder[a.rarity] || 0;
            const rarityB = rarityOrder[b.rarity] || 0;
            if (rarityA !== rarityB) return rarityA - rarityB;
            return a.name.localeCompare(b.name);
        });

        this.fiveEToolsParser.clearCache('items');

        return {
            size: size,
            items: shopInventory
        };
    }
}

module.exports = ShopGenerator;