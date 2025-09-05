const { DiceRoller } = require('@dice-roller/rpg-dice-roller');
const fs = require('fs');
const path = require('path');
const { itemTypes, probabilities, prices, sizeModifiers } = require('./MagicItemData.js');

class MagicItemGenerator {
    constructor(options) {
        this.mode = options.mode;
        this.size = options.size;
        this.numRolls = options.numRolls;
        this.partyLevel = options.partyLevel;
        this.nickname = options.nickname;
        this.roller = new DiceRoller();
        this.hits = [];
        this.generatedItems = [];
    }

    calculateHits() {
        const sizeModifier = sizeModifiers[this.size].probability;
        for (const itemType of itemTypes) {
            for (let level = 0; level < 10; level++) {
                const baseProb = probabilities[itemType][level];
                if (baseProb === undefined) continue;

                const modifiedProb = baseProb * sizeModifier;
                const roll = this.roller.roll('1d100').total;
                if (roll <= modifiedProb) {
                    this.hits.push({ itemType, level });
                }
            }
        }
    }

    generateItems() {
        if (this.hits.length === 0) return;

        const weightedHitPool = this.hits.flatMap(hit => {
            const weight = probabilities[hit.itemType][hit.level];
            return Array(weight).fill(hit);
        });

        if (weightedHitPool.length === 0) return;

        const partySpellCap = Math.min(9, Math.floor(this.partyLevel / 2) + 1);

        for (let i = 0; i < this.numRolls; i++) {
            const randomHit = weightedHitPool[Math.floor(Math.random() * weightedHitPool.length)];
            const { itemType, level } = randomHit;

            const spellFilePath = path.join(__dirname, `randomtables/spells/lvl${level}.json`);
            if (!fs.existsSync(spellFilePath)) continue;

            const spells = JSON.parse(fs.readFileSync(spellFilePath, 'utf8'));
            if (spells.length === 0) continue;

            const weightedSpells = spells.flatMap(spell => {
                return level > partySpellCap ? [spell] : [spell, spell];
            });

            const selectedSpell = weightedSpells[Math.floor(Math.random() * weightedSpells.length)];

            let price = null;
            if (this.mode === 'shop') {
                const basePrice = prices[itemType][level];
                const sizeModifier = sizeModifiers[this.size].price;
                if (basePrice !== undefined) {
                    price = Math.round(basePrice * sizeModifier);
                } else {
                    price = 'Price not found';
                }
            }

            this.generatedItems.push({
                itemType: itemType,
                level: level,
                spellName: selectedSpell.text,
                price: price
            });
        }
    }

    getResults() {
        this.generatedItems.sort((a, b) => {
            if (a.itemType < b.itemType) return -1;
            if (a.itemType > b.itemType) return 1;
            if (a.level < b.level) return -1;
            if (a.level > b.level) return 1;
            return 0;
        });

        return { hits: this.hits, items: this.generatedItems };
    }

    generate() {
        // Resolve dice notation for number of rolls first
        try {
            this.numRolls = this.roller.roll(this.numRolls.toString()).total;
        } catch (e) {
            // If it's not valid dice notation, try to parse it as an integer
            const parsedNum = parseInt(this.numRolls, 10);
            if (isNaN(parsedNum)) {
                throw new Error("Invalid number of rolls. Please provide a number or dice notation (e.g., '1d4+1').");
            }
            this.numRolls = parsedNum;
        }

        this.calculateHits();
        this.generateItems();
        return this.getResults();
    }
}

module.exports = MagicItemGenerator;
