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

        let statblockSuggestions = null;
        if (finalOptions.mode === 'npc' && finalOptions.partyLevel) {
            statblockSuggestions = await this._getNpcStatblock(finalOptions.partyLevel, finalOptions.partySize);
        }

        const name = await this._generateName(finalOptions);

        let traits = { trait: ['N/A'], ideal: ['N/A'], bond: ['N/A'], flaw: ['N/A'] };
        if (finalOptions.background) {
            traits = await this.fiveEToolsParser.getBackgroundTraits(finalOptions.background.name, finalOptions.background.source);
        }

        return {
            ...finalOptions,
            statblockSuggestions,
            name,
            trait: traits.trait,
            ideal: traits.ideal,
            bond: traits.bond,
            flaw: traits.flaw
        };
    }

    async _finalizeSelections(options) {
        let finalSpecies, finalClass, finalBackground, finalLineage, finalSubclass;

        const allSpecies = await this.fiveEToolsParser.getSpecies();
        const allRaces = await this.fiveEToolsParser._loadCategoryData('races'); // Includes subraces
        const allBackgrounds = await this.fiveEToolsParser._loadCategoryData('backgrounds');
        const all_classes = await this.fiveEToolsParser.getClasses();
        const allSubclasses = await this.fiveEToolsParser._loadCategoryData('classes'); // Includes subclasses

        if (!allRaces.length || !allBackgrounds.length || !all_classes.length) {
            return { error: 'Could not load necessary data for generation.' };
        }

        // --- Species and Lineage ---
        if (!options.species || options.species === 'random') {
            finalSpecies = allSpecies[Math.floor(Math.random() * allSpecies.length)];
            finalLineage = {}; // No lineage if species is random
        } else {
            const [, name, source] = options.species.split('|');
            finalSpecies = allSpecies.find(s => s.name === name && s.source === source);
            if (!options.lineage || options.lineage === 'random') {
                 finalLineage = {}; // Randomly select a lineage later if needed, or none
            } else {
                const [, lineageName, lineageSource] = options.lineage.split('|');
                finalLineage = allRaces.find(l => l.name === lineageName && l.source === lineageSource) || {};
            }
        }

        // --- Class and Subclass ---
        if (!options.class || options.class === 'random') {
            finalClass = all_classes[Math.floor(Math.random() * all_classes.length)];
            finalSubclass = {}; // No subclass if class is random
        } else {
            const [, name, source] = options.class.split('|');
            finalClass = all_classes.find(c => c.name === name && c.source === source);
            if (!options.subclass || options.subclass === 'random') {
                finalSubclass = {}; // Randomly select a subclass later if needed, or none
            } else {
                const [, subclassName, subclassSource] = options.subclass.split('|');
                finalSubclass = allSubclasses.find(sc => sc.name === subclassName && sc.source === subclassSource) || {};
            }
        }

        // --- Background ---
        if (!options.background || options.background === 'random') {
            finalBackground = allBackgrounds[Math.floor(Math.random() * allBackgrounds.length)];
        } else {
            const [, name, source] = options.background.split('|');
            finalBackground = allBackgrounds.find(b => b.name === name && b.source === source);
        }

        return {
            mode: options.mode || 'idea',
            species: finalSpecies,
            lineage: finalLineage,
            class: finalClass,
            subclass: finalSubclass,
            background: finalBackground,
            partyLevel: options.partyLevel
        };
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

    async _getNpcStatblock(partyLevel, partySize = 4) {
        if (!partyLevel || !xpThresholds[partyLevel]) return null;

        const singleCharThresholds = xpThresholds[partyLevel];
        const partyXpThresholds = {
            easy: singleCharThresholds.easy * partySize,
            medium: singleCharThresholds.medium * partySize,
            hard: singleCharThresholds.hard * partySize,
        };

        const easyCr = this._getCrForXp(partyXpThresholds.easy);
        const mediumCr = this._getCrForXp(partyXpThresholds.medium);
        const hardCr = this._getCrForXp(partyXpThresholds.hard);

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
            const characterDescription = `a ${options.lineage.name || options.species.name} ${options.subclass.name || options.class.name}`;

            const prompt1 = `Please provide only a numbered list of 10 fantasy names suitable for ${characterDescription}, with no introduction, conclusion, or other conversational text.`;
            const nameListResponse = await this.askLlm(prompt1, 're', false);

            // Clean up the response to get just the list
            let nameList = nameListResponse.split('\n').filter(line => /^\d+\.\s/.test(line.trim())).join('\n');

            if (!nameList) {
                 console.log("LLM did not return a valid numbered list for names.");
                 // Fallback: use the raw response and hope for the best
                 nameList = nameListResponse;
            }

            const prompt2 = `From the following list, choose the single most fitting name for ${characterDescription} who was a ${options.background.name}. Return only the name itself, with no other text or numbering.\n\nList:\n${nameList}`;
            const finalNameResponse = await this.askLlm(prompt2, 're', false);

            // Clean up the final response to remove any lingering list numbers or fluff
            return finalNameResponse.split('\n')[0].replace(/^\d+\.\s*/, '').replace(/[^a-zA-Z\s'-]/g, '').trim();
        } catch (error) {
            console.log("LLM Name generation failed.", error);
            return "Name Generation Failed";
        }
    }
}

module.exports = NpcGenerator;
