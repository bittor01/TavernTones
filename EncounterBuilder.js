const crToXp = {
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

const xpThresholds = {
    1: { low: 50, moderate: 75, high: 100 },
    2: { low: 100, moderate: 150, high: 200 },
    3: { low: 150, moderate: 225, high: 400 },
    4: { low: 250, moderate: 375, high: 500 },
    5: { low: 500, moderate: 750, high: 1100 },
    6: { low: 600, moderate: 1000, high: 1400 },
    7: { low: 750, moderate: 1300, high: 1700 },
    8: { low: 1000, moderate: 1700, high: 2100 },
    9: { low: 1300, moderate: 2000, high: 2600 },
    10: { low: 1600, moderate: 2300, high: 3100 },
    11: { low: 1900, moderate: 2900, high: 4100 },
    12: { low: 2200, moderate: 3700, high: 4700 },
    13: { low: 2600, moderate: 4200, high: 5400 },
    14: { low: 2900, moderate: 4900, high: 6200 },
    15: { low: 3300, moderate: 5400, high: 7800 },
    16: { low: 3800, moderate: 6100, high: 9800 },
    17: { low: 4500, moderate: 7200, high: 11700 },
    18: { low: 5000, moderate: 8700, high: 14200 },
    19: { low: 5500, moderate: 10700, high: 17200 },
    20: { low: 6400, moderate: 13200, high: 22000 }
};

class EncounterBuilder {
    constructor(fiveEToolsParser) {
        this.fiveEToolsParser = fiveEToolsParser;
        this.monsters = [];
        this.crToXp = crToXp;
    }

    async initialize() {
        if (this.monsters.length > 0) return; // Already initialized
        const rawMonsters = await this.fiveEToolsParser._loadCategoryData('bestiary');
        // Add xp and normalize type for each monster
        this.monsters = rawMonsters.map(monster => ({
            ...monster,
            xp: crToXp[monster.cr] || 0,
            type: typeof monster.type === 'object' ? monster.type.type : monster.type
        }));
        console.log(`Initialized EncounterBuilder with ${this.monsters.length} monsters.`);
    }

    getCrValue(cr) {
        if (typeof cr !== 'string') return parseFloat(cr);
        if (cr.includes('/')) {
            const parts = cr.split('/');
            return parseFloat(parts[0]) / parseFloat(parts[1]);
        }
        return parseFloat(cr);
    }

    getCreatureScore(monster, mainCreature) {
        let score = 0;
        const sameHabitat = monster.environment && mainCreature.environment && monster.environment.some(e => mainCreature.environment.includes(e));
        const sameType = monster.type && mainCreature.type && monster.type === mainCreature.type;

        if (sameHabitat && sameType) score = 3;
        else if (sameHabitat) score = 2;
        else if (sameType) score = 1;

        return score;
    }

    generateEncounter({ mainCreature, partyLevel, partySize, difficulty, multiplier = 1.0 }) {
        // 1. Calculate XP Budget
        const xpPerCharacter = xpThresholds[partyLevel]?.[difficulty.toLowerCase()];
        if (xpPerCharacter === undefined) {
            return { error: `Invalid party level or difficulty. Level: ${partyLevel}, Difficulty: ${difficulty}` };
        }
        const totalXpBudget = xpPerCharacter * partySize * multiplier;

        let encounter = [{ ...mainCreature, count: 1 }];
        let remainingXp = totalXpBudget - (mainCreature.xp || 0);
        let currentMonsterCount = 1;

        if (remainingXp < 0) {
            // Main creature is already over budget, just return it.
            return { encounter, totalXp: mainCreature.xp, xpBudget: totalXpBudget };
        }

        // 2. Filter and Sort Monsters
        const primaryCrValue = this.getCrValue(mainCreature.cr);
        const candidates = this.monsters.filter(m => {
            return m.name !== mainCreature.name && this.getCrValue(m.cr) <= primaryCrValue && m.xp > 0;
        });

        candidates.sort((a, b) => {
            const scoreA = this.getCreatureScore(a, mainCreature);
            const scoreB = this.getCreatureScore(b, mainCreature);
            if (scoreB !== scoreA) {
                return scoreB - scoreA;
            }
            return b.xp - a.xp; // Then by XP descending
        });

        // 3. Build Encounter
        const maxMonsters = partySize * 2;

        for (const candidate of candidates) {
            if (currentMonsterCount >= maxMonsters) break;

            let numToAdd = 1;
            // Add two if it's less than a third of the remaining budget
            if (candidate.xp < (remainingXp / 3) && (currentMonsterCount + 1) < maxMonsters) {
                numToAdd = 2;
            }

            if (remainingXp >= candidate.xp * numToAdd) {
                const existing = encounter.find(e => e.name === candidate.name && e.source === candidate.source);
                if (existing) {
                    existing.count += numToAdd;
                } else {
                    encounter.push({ ...candidate, count: numToAdd });
                }
                remainingXp -= candidate.xp * numToAdd;
                currentMonsterCount += numToAdd;
            }
        }

        // 4. Add CR 0 monsters if needed to meet the minimum count
        if (currentMonsterCount < partySize) {
            const cr0Candidates = this.monsters
                .filter(m => this.getCrValue(m.cr) === 0 && m.name !== mainCreature.name)
                .sort((a, b) => {
                    const scoreA = this.getCreatureScore(a, mainCreature);
                    const scoreB = this.getCreatureScore(b, mainCreature);
                    if (scoreB !== scoreA) {
                        return scoreB - scoreA;
                    }
                    return b.xp - a.xp;
                });

            while (currentMonsterCount < partySize && cr0Candidates.length > 0) {
                // Find a candidate that we can afford
                const candidateIndex = cr0Candidates.findIndex(c => remainingXp >= (c.xp || 0));
                if (candidateIndex === -1) {
                    break; // Can't afford any more CR 0 creatures
                }
                const candidate = cr0Candidates[candidateIndex];

                const existing = encounter.find(e => e.name === candidate.name && e.source === candidate.source);
                if (existing) {
                    existing.count++;
                } else {
                    encounter.push({ ...candidate, count: 1 });
                }
                remainingXp -= (candidate.xp || 0);
                currentMonsterCount++;

                // Remove the used candidate so we don't pick it again unless intended
                cr0Candidates.splice(candidateIndex, 1);
            }
        }

        const totalXp = encounter.reduce((sum, m) => sum + (m.xp * m.count), 0);
        return { encounter, totalXp, xpBudget: totalXpBudget };
    }
}

module.exports = EncounterBuilder;
