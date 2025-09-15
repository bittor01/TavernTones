const crToXp = { "0": 10, "1/8": 25, "1/4": 50, "1/2": 100, "1": 200, "2": 450, "3": 700, "4": 1100, "5": 1800, "6": 2300, "7": 2900, "8": 3900, "9": 5000, "10": 5900, "11": 7200, "12": 8400, "13": 10000, "14": 11500, "15": 13000, "16": 15000, "17": 18000, "18": 20000, "19": 22000, "20": 25000, "21": 33000, "22": 41000, "23": 50000, "24": 62000, "25": 75000, "26": 90000, "27": 105000, "28": 120000, "29": 135000, "30": 155000 };
const xpThresholds = { 1: { easy: 25, medium: 50, hard: 75, deadly: 100 }, 2: { easy: 50, medium: 100, hard: 150, deadly: 200 }, 3: { easy: 75, medium: 150, hard: 225, deadly: 400 }, 4: { easy: 125, medium: 250, hard: 375, deadly: 500 }, 5: { easy: 250, medium: 500, hard: 750, deadly: 1100 }, 6: { easy: 300, medium: 600, hard: 900, deadly: 1400 }, 7: { easy: 375, medium: 750, hard: 1100, deadly: 1700 }, 8: { easy: 500, medium: 1000, hard: 1500, deadly: 2200 }, 9: { easy: 600, medium: 1200, hard: 1900, deadly: 2800 }, 10: { easy: 750, medium: 1500, hard: 2300, deadly: 3400 }, 11: { easy: 900, medium: 1800, hard: 2700, deadly: 4100 }, 12: { easy: 1100, medium: 2200, hard: 3400, deadly: 5100 }, 13: { easy: 1250, medium: 2500, hard: 3800, deadly: 5700 }, 14: { easy: 1500, medium: 3000, hard: 4500, deadly: 6800 }, 15: { easy: 1800, medium: 3600, hard: 5400, deadly: 8100 }, 16: { easy: 2100, medium: 4200, hard: 6300, deadly: 9500 }, 17: { easy: 2500, medium: 5000, hard: 7500, deadly: 11500 }, 18: { easy: 2800, medium: 5600, hard: 8500, deadly: 12700 }, 19: { easy: 3200, medium: 6400, hard: 9600, deadly: 14400 }, 20: { easy: 3800, medium: 7600, hard: 11400, deadly: 17100 } };

class NpcGenerator {
    constructor(fiveEToolsParser, llmQueryFunction) {
        this.fiveEToolsParser = fiveEToolsParser;
        this.askLlm = llmQueryFunction;
    }

    async generateCharacter(options) {
        const finalOptions = await this._finalizeSelections(options);
        if (finalOptions.error) return finalOptions;

        const personality = this._getPersonalityTraits(finalOptions.background);

        let statblockSuggestions = null;
        if (finalOptions.mode === 'npc' && finalOptions.partyLevel) {
            statblockSuggestions = await this._getNpcStatblock(finalOptions.partyLevel);
        }

        const name = await this._generateName(finalOptions);

        return {
            ...finalOptions,
            ...personality,
            statblockSuggestions,
            name
        };
    }

    async _finalizeSelections(options) {
        let finalRace, finalClass, finalBackground;

        const races = await this.fiveEToolsParser._loadCategoryData('races');
        const backgrounds = await this.fiveEToolsParser._loadCategoryData('backgrounds');
        const classes = (await this.fiveEToolsParser._loadCategoryData('classes'))
            .filter(c => !c.name.includes('Sidekick')); // Filter out sidekick classes

        if (!races.length || !backgrounds.length || !classes.length) {
            return { error: 'Could not load necessary data for generation.' };
        }

        finalRace = options.race === 'random' || !options.race
            ? races[Math.floor(Math.random() * races.length)]
            : races.find(r => r.name === options.race);

        finalClass = options.class === 'random' || !options.class
            ? classes[Math.floor(Math.random() * classes.length)]
            : classes.find(c => c.name === options.class);

        finalBackground = options.background === 'random' || !options.background
            ? backgrounds[Math.floor(Math.random() * backgrounds.length)]
            : backgrounds.find(b => b.name === options.background);

        return {
            mode: options.mode || 'idea',
            race: finalRace,
            class: finalClass,
            background: finalBackground,
            partyLevel: options.partyLevel
        };
    }

    _getPersonalityTraits(background) {
        const personality = { traits: [], ideal: '', bond: '', flaw: '' };
        if (!background || !background.entries) return personality;

        const findTable = (name) => background.entries.find(e => e.type === 'table' && e.name.toLowerCase().includes(name));

        const traitsTable = findTable('personality traits');
        if (traitsTable && traitsTable.rows?.length) {
            personality.traits.push(traitsTable.rows[Math.floor(Math.random() * traitsTable.rows.length)][1]);
            personality.traits.push(traitsTable.rows[Math.floor(Math.random() * traitsTable.rows.length)][1]);
        }

        const idealTable = findTable('ideals');
        if (idealTable && idealTable.rows?.length) {
            personality.ideal = idealTable.rows[Math.floor(Math.random() * idealTable.rows.length)][1].entry;
        }

        const bondTable = findTable('bonds');
        if (bondTable && bondTable.rows?.length) {
            personality.bond = bondTable.rows[Math.floor(Math.random() * bondTable.rows.length)][1];
        }

        const flawTable = findTable('flaws');
        if (flawTable && flawTable.rows?.length) {
            personality.flaw = flawTable.rows[Math.floor(Math.random() * flawTable.rows.length)][1];
        }

        return personality;
    }

    _getCrForXp(xp) {
        let closestCr = "0";
        let smallestDiff = Infinity;
        for (const [cr, crXp] of Object.entries(crToXp)) {
            const diff = Math.abs(xp - crXp);
            if (diff < smallestDiff) {
                smallestDiff = diff;
                closestCr = cr;
            }
        }
        return closestCr;
    }

    async _getNpcStatblock(partyLevel) {
        if (!partyLevel || !xpThresholds[partyLevel]) return null;

        const thresholds = xpThresholds[partyLevel];
        const easyCr = this._getCrForXp(thresholds.easy);
        const mediumCr = this._getCrForXp(thresholds.medium);
        const hardCr = this._getCrForXp(thresholds.hard);

        const bestiary = await this.fiveEToolsParser._loadCategoryData('bestiary');
        const humanoids = bestiary.filter(m => m.type && (m.type === 'humanoid' || (typeof m.type === 'object' && m.type.type === 'humanoid')));

        const findStatblock = (cr) => humanoids.filter(m => m.cr === cr);

        const easyPool = findStatblock(easyCr);
        const mediumPool = findStatblock(mediumCr);
        const hardPool = findStatblock(hardCr);

        return {
            easy: easyPool.length > 0 ? easyPool[Math.floor(Math.random() * easyPool.length)] : { name: `No CR ${easyCr} Humanoid Found`, cr: easyCr },
            medium: mediumPool.length > 0 ? mediumPool[Math.floor(Math.random() * mediumPool.length)] : { name: `No CR ${mediumCr} Humanoid Found`, cr: mediumCr },
            hard: hardPool.length > 0 ? hardPool[Math.floor(Math.random() * hardPool.length)] : { name: `No CR ${hardCr} Humanoid Found`, cr: hardCr },
        };
    }

    async _generateName(options) {
        try {
            const prompt1 = `Generate a list of 10 fantasy names suitable for a ${options.race.name} ${options.class.name}.`;
            const nameListResponse = await this.askLlm(prompt1, 'll');

            const prompt2 = `From the following list of names, which one is the most fitting for a ${options.race.name} ${options.class.name} who was a ${options.background.name}?\n\nList:\n${nameListResponse}`;
            const finalNameResponse = await this.askLlm(prompt2, 're');

            return finalNameResponse.split('\n')[0].replace(/[^a-zA-Z\s'-]/g, '').trim();
        } catch (error) {
            console.log("LLM Name generation failed.", error);
            return "Name Generation Failed";
        }
    }
}

module.exports = NpcGenerator;
