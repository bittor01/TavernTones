const crToXp = {
    "0": 10, "1/8": 25, "1/4": 50, "1/2": 100, "1": 200, "2": 450, "3": 700, "4": 1100, "5": 1800, "6": 2300, "7": 2900, "8": 3900, "9": 5000, "10": 5900, "11": 7200, "12": 8400, "13": 10000, "14": 11500, "15": 13000, "16": 15000, "17": 18000, "18": 20000, "19": 22000, "20": 25000, "21": 33000, "22": 41000, "23": 50000, "24": 62000, "25": 75000, "26": 90000, "27": 105000, "28": 120000, "29": 135000, "30": 155000
};

const xpThresholds = {
    1: { low: 50, moderate: 75, high: 100 }, 2: { low: 100, moderate: 150, high: 200 }, 3: { low: 150, moderate: 225, high: 400 }, 4: { low: 250, moderate: 375, high: 500 }, 5: { low: 500, moderate: 750, high: 1100 }, 6: { low: 600, moderate: 1000, high: 1400 }, 7: { low: 750, moderate: 1300, high: 1700 }, 8: { low: 1000, moderate: 1700, high: 2100 }, 9: { low: 1300, moderate: 2000, high: 2600 }, 10: { low: 1600, moderate: 2300, high: 3100 }, 11: { low: 1900, moderate: 2900, high: 4100 }, 12: { low: 2200, moderate: 3700, high: 4700 }, 13: { low: 2600, moderate: 4200, high: 5400 }, 14: { low: 2900, moderate: 4900, high: 6200 }, 15: { low: 3300, moderate: 5400, high: 7800 }, 16: { low: 3800, moderate: 6100, high: 9800 }, 17: { low: 4500, moderate: 7200, high: 11700 }, 18: { low: 5000, moderate: 8700, high: 14200 }, 19: { low: 5500, moderate: 10700, high: 17200 }, 20: { low: 6400, moderate: 13200, high: 22000 }
};

class EncounterBuilder {
    constructor(fiveEToolsParser) {
        this.fiveEToolsParser = fiveEToolsParser;
        this.monsters = [];
        this.crToXp = crToXp;
    }

    async initialize() {
        if (this.monsters.length > 0) return;
        const rawMonsters = await this.fiveEToolsParser._loadCategoryData('bestiary');
        this.monsters = rawMonsters.map(monster => ({
            ...monster,
            xp: this.crToXp[monster.cr] || 0,
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
        // 1. Initialization
        const xpPerCharacter = xpThresholds[partyLevel]?.[difficulty.toLowerCase()];
        if (xpPerCharacter === undefined) {
            return { error: `Invalid party level or difficulty.` };
        }
        const totalXpBudget = xpPerCharacter * partySize * multiplier;
        const maxMonsters = partySize * 2;
        let encounter = [];
        let remainingXp = totalXpBudget;
        let currentMonsterCount = 0;

        // 2. Add Main Creature
        encounter.push({ ...mainCreature, count: 1, xp_per_creature: mainCreature.xp });
        remainingXp -= mainCreature.xp;
        currentMonsterCount++;

        // 3. Build Combatant Unit Pool
        const primaryCrValue = this.getCrValue(mainCreature.cr);
        const candidates = this.monsters.filter(m =>
            m.name !== mainCreature.name && this.getCrValue(m.cr) <= primaryCrValue && m.xp > 0
        );

        let combatantUnitPool = [];
        for (const candidate of candidates) {
            // Add individual unit
            combatantUnitPool.push({ base: candidate, count: 1, xp: candidate.xp, body: 1, isMob: false });
            // Add pair unit
            combatantUnitPool.push({ base: candidate, count: 2, xp: candidate.xp * 2, body: 2, isMob: false });
            // Add mob units
            for (let size = 5; size <= 10; size++) {
                combatantUnitPool.push({ base: candidate, count: size, xp: candidate.xp * size, body: 1, isMob: true });
            }
        }

        // 4. Sort the Pool
        combatantUnitPool.sort((a, b) => {
            // We want to weigh thematic score higher than pure XP
            const scoreA = this.getCreatureScore(a.base, mainCreature);
            const scoreB = this.getCreatureScore(b.base, mainCreature);
            if (scoreB !== scoreA) return scoreB - scoreA;
            // Then sort by XP
            return b.xp - a.xp;
        });

        // 5. Greedy Selection
        const addedCreatureNames = new Set([mainCreature.name]);
        for (const unit of combatantUnitPool) {
            if (remainingXp <= 0 || currentMonsterCount >= maxMonsters) break;
            if (addedCreatureNames.has(unit.base.name)) continue;

            if (unit.xp <= remainingXp && (currentMonsterCount + unit.body) <= maxMonsters) {
                encounter.push({ ...unit.base, count: unit.count, isMob: unit.isMob, xp_per_creature: unit.base.xp });
                remainingXp -= unit.xp;
                currentMonsterCount += unit.body;
                addedCreatureNames.add(unit.base.name);
            }
        }

        // 6. "Top Off" Mobs
        for (const monster of encounter) {
            if (monster.isMob && monster.count < 10 && monster.xp_per_creature > 0) {
                const canAdd = Math.min(10 - monster.count, Math.floor(remainingXp / monster.xp_per_creature));
                if (canAdd > 0) {
                    monster.count += canAdd;
                    remainingXp -= canAdd * monster.xp_per_creature;
                }
            }
        }

        // 7. Final Padding
        if (currentMonsterCount < partySize) {
            const cr0Candidates = this.monsters.filter(m => this.getCrValue(m.cr) === 0 && !addedCreatureNames.has(m.name));
            while (currentMonsterCount < partySize && cr0Candidates.length > 0) {
                const candidate = cr0Candidates.shift();
                if (remainingXp >= candidate.xp) {
                    encounter.push({ ...candidate, count: 1, isMob: false, xp_per_creature: candidate.xp });
                    remainingXp -= candidate.xp;
                    currentMonsterCount++;
                }
            }
        }

        const totalXp = encounter.reduce((sum, m) => sum + (m.xp_per_creature * m.count), 0);
        return { encounter, totalXp, xpBudget: totalXpBudget };
    }
}

module.exports = EncounterBuilder;
