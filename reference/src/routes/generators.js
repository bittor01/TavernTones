/**
 * @file Defines Express routes for all content generation endpoints.
 * This includes generators for encounters, traps, characters, loot, and more.
 * @author jules
 */

const express = require('express');
const { dataStore } = require('../utils/dataLoader');
const { getOrCreateSession, deleteSession } = require('../utils/sessionManager');
const { LootGenerator } = require('../utils/lootGenerator');
const { NpcGenerator } = require('../utils/npcGenerator');
const { removeFullText } = require('../utils/dataUtils');

const router = express.Router();

// --- Constants used by various generators ---
const crToXp = { "0": 10, "1/8": 25, "1/4": 50, "1/2": 100, "1": 200, "2": 450, "3": 700, "4": 1100, "5": 1800, "6": 2300, "7": 2900, "8": 3900, "9": 5000, "10": 5900, "11": 7200, "12": 8400, "13": 10000, "14": 11500, "15": 13000, "16": 15000, "17": 18000, "18": 20000, "19": 22000, "20": 25000, "21": 33000, "22": 41000, "23": 50000, "24": 62000, "25": 75000, "26": 90000, "27": 105000, "28": 120000, "29": 135000, "30": 155000 };
const xpThresholds = { 1: { low: 50, moderate: 75, high: 100 }, 2: { low: 100, moderate: 150, high: 200 }, 3: { low: 150, moderate: 225, high: 400 }, 4: { low: 250, moderate: 375, high: 500 }, 5: { low: 500, moderate: 750, high: 1100 }, 6: { low: 600, moderate: 1000, high: 1400 }, 7: { low: 750, moderate: 1300, high: 1700 }, 8: { low: 1000, moderate: 1700, high: 2100 }, 9: { low: 1300, moderate: 2000, high: 2600 }, 10: { low: 1600, moderate: 2300, high: 3100 }, 11: { low: 1900, moderate: 2900, high: 4100 }, 12: { low: 2200, moderate: 3700, high: 4700 }, 13: { low: 2600, moderate: 4200, high: 5400 }, 14: { low: 2900, moderate: 4900, high: 6200 }, 15: { low: 3300, moderate: 5400, high: 7800 }, 16: { low: 3800, moderate: 6100, high: 9800 }, 17: { low: 4500, moderate: 7200, high: 11700 }, 18: { low: 5000, moderate: 8700, high: 14200 }, 19: { low: 5500, moderate: 10700, high: 17200 }, 20: { low: 6400, moderate: 13200, high: 22000 } };
const sizeModifiers = { "Huge": { probability: 1.2, price: 0.8 }, "Large": { probability: 1.1, price: 0.9 }, "Average": { probability: 1.0, price: 1.0 }, "Small": { probability: 0.9, price: 1.1 }, "Tiny": { probability: 0.8, price: 1.2 } };


// --- Vehicle Encounter Generator ---

/**
 * Filters and retrieves vehicles from the data store based on a terrain tag.
 * @param {string} tag - The terrain tag (e.g., 'water', 'land', 'random').
 * @returns {Promise<object[]>} A promise that resolves to an array of vehicle objects.
 */
async function getVehiclesByTag(tag) {
    const vehicles = dataStore.get('vehicles') || [];
    if (tag === 'random') {
        return vehicles;
    }

    const lowerCaseTag = tag.toLowerCase();
    const tagMap = { water: ['water', 'sea'], sea: ['sea', 'water'], space: ['space', 'air'], astral: ['space', 'air'], land: ['land'], air: ['air'] };
    const searchTags = tagMap[lowerCaseTag] || [lowerCaseTag];

    return vehicles.filter(v => {
        if (lowerCaseTag === 'burrow' && v.speed?.burrow) return true;
        if (v.terrain && Array.isArray(v.terrain) && v.terrain.some(vt => searchTags.includes(vt.toLowerCase()))) return true;
        if (v.movement && Array.isArray(v.movement) && v.movement.some(m => m.speed?.some(s => searchTags.includes(s.mode)))) return true;
        if (v.speed) {
            if ((searchTags.includes('sea') || searchTags.includes('water')) && v.speed.swim) return true;
            if (searchTags.includes('land') && v.speed.walk) return true;
            if (searchTags.includes('air') && v.speed.fly) return true;
        }
        return false;
    });
}

/**
 * Generates a "flagship" style encounter, featuring one large vehicle and smaller escorts.
 * @param {object[]} allVehicles - A pool of vehicles to choose from.
 * @param {number} totalHp - The total HP budget for the encounter.
 * @param {number} numVehicles - The desired number of vehicles.
 * @returns {object} The generated encounter object or an error.
 */
function generateFlagshipEncounter(allVehicles, totalHp, numVehicles) {
    let remainingHp = totalHp;
    if (numVehicles <= 0) return { error: "Number of vehicles must be positive." };

    if (numVehicles === 1) {
        const possibleFlagships = allVehicles.filter(v => (v.hp?.average || v.hp?.hp) <= totalHp).sort((a, b) => (b.hp?.average || b.hp?.hp) - (a.hp?.average || a.hp?.hp));
        if (possibleFlagships.length === 0) return { error: 'No vehicle found within the HP budget.' };
        const flagship = { ...possibleFlagships[0], hp: possibleFlagships[0].hp?.average || possibleFlagships[0].hp?.hp };
        return { encounter: [flagship], totalValue: flagship.hp, budget: totalHp };
    }

    const encounter = [];
    const sortedVehicles = [...allVehicles].sort((a, b) => (b.hp?.average || b.hp?.hp) - (a.hp?.average || a.hp?.hp));

    const flagship = sortedVehicles.find(v => (v.hp?.average || v.hp?.hp) <= remainingHp);
    if (flagship) {
        const flagshipHp = flagship.hp?.average || flagship.hp?.hp;
        encounter.push({ ...flagship, hp: flagshipHp });
        remainingHp -= flagshipHp;
    } else {
        return { error: 'Could not find any vehicle within the HP budget.' };
    }

    const escorts = sortedVehicles.filter(v => v.name !== flagship.name);
    while (encounter.length < numVehicles) {
        const bestEscort = escorts.find(e => (e.hp?.average || e.hp?.hp) <= remainingHp);
        if (bestEscort) {
            const escortHp = bestEscort.hp?.average || bestEscort.hp?.hp;
            encounter.push({ ...bestEscort, hp: escortHp });
            remainingHp -= escortHp;
        } else {
            break;
        }
    }

    const totalValue = encounter.reduce((sum, v) => sum + v.hp, 0);
    return { encounter, totalValue, budget: totalHp };
}

/**
 * Generates a "balanced" style encounter, with vehicles of roughly equal power.
 * @param {object[]} allVehicles - A pool of vehicles to choose from.
 * @param {number} totalHp - The total HP budget for the encounter.
 * @param {number} numVehicles - The desired number of vehicles.
 * @returns {object} The generated encounter object or an error.
 */
function generateBalancedEncounter(allVehicles, totalHp, numVehicles) {
    if (numVehicles <= 0) return { error: 'Number of vehicles must be positive.' };

    const targetHp = totalHp / numVehicles;
    const candidates = [...allVehicles].sort((a, b) => {
        const hpA = a.hp?.average || a.hp?.hp;
        const hpB = b.hp?.average || b.hp?.hp;
        return Math.abs(hpA - targetHp) - Math.abs(hpB - targetHp);
    });

    if (candidates.length === 0) return { error: `Could not find any vehicles to build a balanced encounter.` };

    const encounter = [];
    for (let i = 0; i < numVehicles; i++) {
        const vehicle = candidates[Math.floor(Math.random() * Math.min(candidates.length, 5))];
        encounter.push({ ...vehicle, hp: vehicle.hp?.average || vehicle.hp?.hp });
    }

    const totalValue = encounter.reduce((sum, v) => sum + v.hp, 0);
    return { encounter, totalValue, budget: totalHp };
}

/**
 * @route POST /api/oracle/vehicle-encounter
 * @description Generates a vehicle encounter based on terrain, style, HP budget, and number of vehicles.
 * @body {{tag: string, style: string, totalHp: number, numVehicles: number}}
 */
router.post('/vehicle-encounter', async (req, res) => {
    const { tag, style, totalHp, numVehicles } = req.body;
    if (!tag || !style || totalHp === undefined || numVehicles === undefined) return res.status(400).json({ error: 'Missing required parameters: tag, style, totalHp, numVehicles.' });

    const allVehicles = await getVehiclesByTag(tag);
    if (!allVehicles || allVehicles.length === 0) return res.status(404).json({ error: `No vehicles found for the "${tag}" tag.` });

    let result;
    if (style === 'flagship') result = generateFlagshipEncounter(allVehicles, totalHp, numVehicles);
    else if (style === 'balanced') result = generateBalancedEncounter(allVehicles, totalHp, numVehicles);
    else return res.status(400).json({ error: 'Invalid style specified. Must be "flagship" or "balanced".' });

    if (result.error) return res.status(400).json(result);
    if (result.encounter) result.encounter = removeFullText(result.encounter);
    res.json(result);
});


// --- Trap & Hazard Generators (Multi-step) ---

const trapTierOptions = [ { name: "Tier 1 (Levels 1-4)", value: 1 }, { name: "Tier 2 (Levels 5-10)", value: 2 }, { name: "Tier 3 (Levels 11-16)", value: 3 }, { name: "Tier 4 (Levels 17-20)", value: 4 } ];
const trapTypeOptions = ["TRAP", "HAZARD"];
const trapThreatOptions = ["Setback", "Moderate", "Dangerous", "Deadly"];

/**
 * @route POST /api/oracle/generate-trap
 * @description Guides a user through a multi-step process to generate a random trap.
 * @body {{sessionId: string, choice?: number, step?: string}}
 */
router.post('/generate-trap', async (req, res) => {
    const { sessionId, choice, step } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'A "sessionId" is required.' });

    const session = getOrCreateSession(sessionId);

    if (session.data.step && step !== session.data.step) {
        // Resend current question if client is out of sync.
    } else if (choice !== undefined) {
        const choiceIndex = parseInt(choice, 10) - 1;
        if (session.data.step === 'awaiting_tier') {
            if (choiceIndex < 0 || choiceIndex >= trapTierOptions.length) return res.status(400).json({ error: 'Invalid tier choice.' });
            session.data.tier = trapTierOptions[choiceIndex].value;
            session.data.step = 'awaiting_type';
        } else if (session.data.step === 'awaiting_type') {
            if (choiceIndex < 0 || choiceIndex >= trapTypeOptions.length) return res.status(400).json({ error: 'Invalid type choice.' });
            session.data.type = trapTypeOptions[choiceIndex];
            session.data.step = 'awaiting_threat';
        } else if (session.data.step === 'awaiting_threat') {
            if (choiceIndex < 0 || choiceIndex >= trapThreatOptions.length) return res.status(400).json({ error: 'Invalid threat choice.' });
            session.data.threat = trapThreatOptions[choiceIndex].toLowerCase();
            session.data.step = 'generate';
        }
    }

    if (!session.data.step) session.data.step = 'awaiting_tier';

    if (session.data.step === 'awaiting_tier') {
        const summary = trapTierOptions.map((opt, i) => `${i + 1}. ${opt.name}`);
        return res.json({ step: 'awaiting_tier', message: "Please choose a tier for the trap:", results: summary.join('\n') });
    }
    if (session.data.step === 'awaiting_type') {
        const summary = trapTypeOptions.map((opt, i) => `${i + 1}. ${opt}`);
        return res.json({ step: 'awaiting_type', message: "Please choose a type:", results: summary.join('\n') });
    }
    if (session.data.step === 'awaiting_threat') {
        const summary = trapThreatOptions.map((opt, i) => `${i + 1}. ${opt}`);
        return res.json({ step: 'awaiting_threat', message: "Please choose a threat level:", results: summary.join('\n') });
    }
    if (session.data.step === 'generate') {
        let traps = dataStore.get('traps') || [];
        traps = traps.filter(t => t._type === session.data.type && t.rating?.some(r => r.tier === session.data.tier && r.threat.toLowerCase() === session.data.threat));
        if (traps.length === 0) {
            deleteSession(sessionId);
            return res.status(404).json({ error: 'No traps found matching your criteria. Please try again.' });
        }
        const selectedTrap = traps[Math.floor(Math.random() * traps.length)];
        deleteSession(sessionId);
        return res.json(removeFullText(selectedTrap));
    }
});


// --- Encounter Generator ---

/**
 * Converts a CR string (e.g., "1/2") to its numerical value.
 * @param {string|number} cr The CR to convert.
 * @returns {number} The numerical value.
 */
function getCrValue(cr) {
    if (typeof cr !== 'string') return parseFloat(cr);
    if (cr.includes('/')) {
        const parts = cr.split('/');
        return parseFloat(parts[0]) / parseFloat(parts[1]);
    }
    return parseFloat(cr);
}

/**
 * Scores a potential monster based on its thematic similarity to the main creature.
 * @param {object} monster The monster to score.
 * @param {object} mainCreature The primary creature of the encounter.
 * @returns {number} A score from 0 to 3 indicating similarity.
 */
function getCreatureScore(monster, mainCreature) {
    let score = 0;
    const sameHabitat = monster.environment && mainCreature.environment && monster.environment.some(e => mainCreature.environment.includes(e));
    const sameType = monster.type && mainCreature.type && monster.type === mainCreature.type;
    if (sameHabitat && sameType) score = 3;
    else if (sameHabitat) score = 2;
    else if (sameType) score = 1;
    return score;
}

/**
 * The core logic for generating a monster encounter based on a main creature and party details.
 * @param {object} options The options for generation.
 * @returns {object} The generated encounter object or an error.
 */
function runEncounterGeneration({ mainCreature, partyLevel, partySize, difficulty, multiplier = 1.0 }) {
    const monsters = dataStore.get('bestiary') || [];
    const xpPerCharacter = xpThresholds[partyLevel]?.[difficulty.toLowerCase()];
    if (xpPerCharacter === undefined) return { error: `Invalid party level or difficulty.` };

    const totalXpBudget = xpPerCharacter * partySize * multiplier;
    const maxMonsters = partySize * 2;
    let encounter = [];
    let remainingXp = totalXpBudget;
    let currentMonsterCount = 0;
    const addedCreatureNames = new Set();

    const mainCreatureXp = mainCreature.xp || crToXp[mainCreature.cr] || 0;
    encounter.push({ ...mainCreature, count: 1, xp_per_creature: mainCreatureXp });
    remainingXp -= mainCreatureXp;
    currentMonsterCount++;
    addedCreatureNames.add(mainCreature.name);

    const primaryCrValue = getCrValue(mainCreature.cr);
    const candidates = monsters.filter(m => {
        const xp = m.xp || crToXp[m.cr] || 0;
        return m.name !== mainCreature.name && getCrValue(m.cr) <= primaryCrValue && xp > 0;
    });

    let combatantUnitPool = [];
    for (const candidate of candidates) {
        const xp = candidate.xp || crToXp[candidate.cr] || 0;
        combatantUnitPool.push({ base: candidate, count: 1, xp: xp, body: 1, isMob: false });
        combatantUnitPool.push({ base: candidate, count: 2, xp: xp * 2, body: 2, isMob: false });
        for (let size = 5; size <= 10; size++) {
            combatantUnitPool.push({ base: candidate, count: size, xp: xp * size, body: 1, isMob: true });
        }
    }

    combatantUnitPool.sort((a, b) => {
        const scoreA = getCreatureScore(a.base, mainCreature);
        const scoreB = getCreatureScore(b.base, mainCreature);
        if (scoreB !== scoreA) return scoreB - scoreA;
        return b.xp - a.xp;
    });

    const singletons = combatantUnitPool.filter(u => u.body === 1 && !u.isMob);
    for (const unit of singletons) {
        if (currentMonsterCount >= partySize || remainingXp <= 0 || currentMonsterCount >= maxMonsters) break;
        if (addedCreatureNames.has(unit.base.name)) continue;
        if (unit.xp <= remainingXp) {
            const xp = unit.base.xp || crToXp[unit.base.cr] || 0;
            encounter.push({ ...unit.base, count: unit.count, isMob: unit.isMob, xp_per_creature: xp });
            remainingXp -= unit.xp;
            currentMonsterCount += unit.body;
            addedCreatureNames.add(unit.base.name);
        }
    }

    for (const unit of combatantUnitPool) {
        if (remainingXp <= 0 || currentMonsterCount >= maxMonsters) break;
        if (addedCreatureNames.has(unit.base.name)) continue;
        if (unit.xp <= remainingXp && (currentMonsterCount + unit.body) <= maxMonsters) {
            const xp = unit.base.xp || crToXp[unit.base.cr] || 0;
            encounter.push({ ...unit.base, count: unit.count, isMob: unit.isMob, xp_per_creature: xp });
            remainingXp -= unit.xp;
            currentMonsterCount += unit.body;
            addedCreatureNames.add(unit.base.name);
        }
    }

    const totalXp = encounter.reduce((sum, m) => sum + (m.xp_per_creature * m.count), 0);
    return { encounter, totalXp, xpBudget: totalXpBudget };
}

/**
 * @route POST /api/oracle/encounter/multistep
 * @description A multi-step version of the encounter generator that handles cases where the initial creature query returns multiple results.
 * @body {{sessionId: string, creatureName?: string, partyLevel?: number, partySize?: number, difficulty?: string, choice?: number, step?: string}}
 */
router.post('/encounter/multistep', async (req, res) => {
    const { sessionId, creatureName, partyLevel, partySize, difficulty, choice, step } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'A "sessionId" is required.' });

    const session = getOrCreateSession(sessionId);

    if (session.data.step === 'awaiting_creature_choice') {
        if (step !== 'awaiting_creature_choice') {
            // Resend question if out of sync
        } else if (choice !== undefined) {
            const choiceIndex = parseInt(choice, 10) - 1;
            if (isNaN(choiceIndex) || choiceIndex < 0 || choiceIndex >= session.data.creatureChoices.length) return res.status(400).json({ error: 'Invalid creature choice.' });
            const mainCreature = session.data.creatureChoices[choiceIndex];
            const result = runEncounterGeneration({ mainCreature, partyLevel: session.data.partyLevel, partySize: session.data.partySize, difficulty: session.data.difficulty });
            deleteSession(sessionId);
            if (result.encounter) result.encounter = removeFullText(result.encounter);
            return res.json(result);
        }
    } else if (creatureName && partyLevel !== undefined && partySize !== undefined && difficulty) {
        const monsters = dataStore.get('bestiary') || [];
        const results = monsters.filter(m => m.name.toLowerCase().includes(creatureName.toLowerCase()));
        if (results.length === 0) return res.status(404).json({ error: `No creature found with the name "${creatureName}".` });

        if (results.length > 1) {
            session.data = { step: 'awaiting_creature_choice', creatureChoices: results, partyLevel, partySize, difficulty };
        } else {
            const result = runEncounterGeneration({ mainCreature: results[0], partyLevel, partySize, difficulty });
            deleteSession(sessionId);
            if (result.encounter) result.encounter = removeFullText(result.encounter);
            return res.json(result);
        }
    } else {
        return res.status(400).json({ error: 'Missing required parameters for encounter generation.' });
    }

    if (session.data.step === 'awaiting_creature_choice') {
        const summary = session.data.creatureChoices.map((r, i) => `${i + 1}. ${r.name} (CR ${r.cr})`);
        return res.json({ step: 'awaiting_creature_choice', message: `Found multiple creatures. Please choose one:`, results: summary.join('\n') });
    }

    return res.status(500).json({ error: 'An unexpected error occurred in the encounter generator.' });
});

/**
 * @route POST /api/oracle/encounter
 * @description A single-step encounter generator. If multiple creatures match the query, it picks the first one.
 * @body {{creatureName: string, partyLevel: number, partySize: number, difficulty: string}}
 */
router.post('/encounter', async (req, res) => {
    const { creatureName, partyLevel, partySize, difficulty } = req.body;
    if (!creatureName || !partyLevel || !partySize || !difficulty) return res.status(400).json({ error: 'Missing required parameters: creatureName, partyLevel, partySize, difficulty.' });

    const monsters = dataStore.get('bestiary') || [];
    const lowerCaseQuery = creatureName.toLowerCase();
    let results = monsters.filter(m => m.name.toLowerCase() === lowerCaseQuery);
    if (results.length === 0) results = monsters.filter(m => m.name.toLowerCase().includes(lowerCaseQuery));
    if (results.length === 0) return res.status(404).json({ error: `No creature found matching "${creatureName}".` });

    const result = runEncounterGeneration({ mainCreature: results[0], partyLevel, partySize, difficulty });
    if (result.error) return res.status(400).json(result);
    if (result.encounter) result.encounter = removeFullText(result.encounter);
    return res.json(result);
});


// --- Character & NPC Data Helpers ---

/** Gets all base species (races without a `raceName`). */
function getSpecies() {
    return (dataStore.get('races') || []).filter(r => !r.raceName);
}

/** Gets all lineages (subraces) for a given species name, consolidating across sources. */
function getLineages(speciesName) {
    const allRaces = dataStore.get('races') || [];
    const lowerCaseSpeciesName = speciesName.toLowerCase();
    const lineages = new Map();
    allRaces.forEach(r => {
        if (r.raceName && r.raceName.toLowerCase() === lowerCaseSpeciesName) {
            const key = `${r.name}|${r.source}`;
            if (!lineages.has(key)) lineages.set(key, { name: r.name, source: r.source });
        }
    });
    return Array.from(lineages.values());
}

/** Gets all base classes (classes without a `className`). */
function getClasses() {
    return (dataStore.get('classes') || []).filter(c => !c.className);
}

/** Gets all subclasses for a given class name. */
function getSubclasses(className) {
    return (dataStore.get('classes') || []).filter(sc => sc.className === className);
}

/** Gets all backgrounds. */
function getBackgrounds() {
    return dataStore.get('backgrounds') || [];
}

/**
 * @route POST /api/oracle/generate-character
 * @description (Legacy) A multi-step generator for creating a player character.
 * @body {{sessionId: string, choice?: number, step?: string}}
 */
router.post('/generate-character', async (req, res) => {
    const { sessionId, choice, step } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'A "sessionId" is required.' });

    const session = getOrCreateSession(sessionId);

    if (session.data.step && step !== session.data.step) {
        // Resend if out of sync
    } else if (choice !== undefined) {
        const choiceIndex = parseInt(choice, 10) - 1;
        if (session.data.step === 'awaiting_species') {
            const speciesOptions = getSpecies();
            if (choiceIndex < 0 || choiceIndex >= speciesOptions.length) return res.status(400).json({ error: 'Invalid species choice.' });
            session.data.species = speciesOptions[choiceIndex];
            session.data.step = getLineages(session.data.species.name).length > 0 ? 'awaiting_lineage' : 'awaiting_class';
        } else if (session.data.step === 'awaiting_lineage') {
            const lineageOptions = getLineages(session.data.species.name);
            if (choiceIndex < 0 || choiceIndex >= lineageOptions.length) return res.status(400).json({ error: 'Invalid lineage choice.' });
            session.data.lineage = lineageOptions[choiceIndex];
            session.data.step = 'awaiting_class';
        } else if (session.data.step === 'awaiting_class') {
            const classOptions = getClasses();
            if (choiceIndex < 0 || choiceIndex >= classOptions.length) return res.status(400).json({ error: 'Invalid class choice.' });
            session.data.class = classOptions[choiceIndex];
            session.data.step = getSubclasses(session.data.class.name).length > 0 ? 'awaiting_subclass' : 'awaiting_background';
        } else if (session.data.step === 'awaiting_subclass') {
            const subclassOptions = getSubclasses(session.data.class.name);
            if (choiceIndex < 0 || choiceIndex >= subclassOptions.length) return res.status(400).json({ error: 'Invalid subclass choice.' });
            session.data.subclass = subclassOptions[choiceIndex];
            session.data.step = 'awaiting_background';
        } else if (session.data.step === 'awaiting_background') {
            const backgroundOptions = getBackgrounds();
            if (choiceIndex < 0 || choiceIndex >= backgroundOptions.length) return res.status(400).json({ error: 'Invalid background choice.' });
            session.data.background = backgroundOptions[choiceIndex];
            session.data.step = 'generate';
        }
    }

    if (!session.data.step) session.data.step = 'awaiting_species';

    if (session.data.step === 'awaiting_species') {
        const summary = getSpecies().map((s, i) => `${i + 1}. ${s.name} [${s.source}]`);
        return res.json({ step: 'awaiting_species', message: "Let's create a character. First, choose a species:", results: summary.join('\n') });
    }
    if (session.data.step === 'awaiting_lineage') {
        const summary = getLineages(session.data.species.name).map((l, i) => `${i + 1}. ${l.name} [${l.source}]`);
        return res.json({ step: 'awaiting_lineage', message: `Species: ${session.data.species.name}. Now, choose a lineage:`, results: summary.join('\n') });
    }
    if (session.data.step === 'awaiting_class') {
        const summary = getClasses().map((c, i) => `${i + 1}. ${c.name} [${c.source}]`);
        return res.json({ step: 'awaiting_class', message: "Now, choose a class:", results: summary.join('\n') });
    }
    if (session.data.step === 'awaiting_subclass') {
        const summary = getSubclasses(session.data.class.name).map((sc, i) => `${i + 1}. ${sc.name} [${sc.source}]`);
        return res.json({ step: 'awaiting_subclass', message: `Class: ${session.data.class.name}. Now, choose a subclass:`, results: summary.join('\n') });
    }
    if (session.data.step === 'awaiting_background') {
        const summary = getBackgrounds().map((b, i) => `${i + 1}. ${b.name} [${b.source}]`);
        return res.json({ step: 'awaiting_background', message: "Finally, choose a background:", results: summary.join('\n') });
    }
    if (session.data.step === 'generate') {
        const finalCharacter = { name: "Placeholder Name", species: session.data.species, lineage: session.data.lineage || {}, class: session.data.class, subclass: session.data.subclass || {}, background: session.data.background };
        deleteSession(sessionId);
        return res.json({ message: "Character generation complete!", character: removeFullText(finalCharacter) });
    }
});


// --- Loot and Shop Generators ---

/**
 * A factory function that creates a request handler for both loot hoards and shop inventories.
 * @param {boolean} isShop - True if generating a shop (with prices), false for a loot hoard.
 * @returns {function} An Express request handler.
 */
const lootAndShopHandler = (isShop) => (req, res) => {
    const { size, numItems, lootMultiplier: customLootMultiplier, priceMultiplier: customPriceMultiplier, mundaneOnly = false } = req.body;
    if (!numItems || !size) return res.status(400).json({ error: 'Missing required parameters: numItems and size.' });

    const sizeModifier = sizeModifiers[size];
    if (!sizeModifier) return res.status(400).json({ error: `Invalid size parameter: ${size}` });

    const finalLootMultiplier = (customLootMultiplier || 1.0) * sizeModifier.probability;
    const finalPriceMultiplier = (customPriceMultiplier || 1.0) * sizeModifier.price;

    try {
        const generator = new LootGenerator({ numItems, lootMultiplier: finalLootMultiplier, isShop, priceMultiplier: finalPriceMultiplier, mundaneOnly });
        const result = generator.generate();
        res.json(removeFullText(result));
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

/**
 * @route POST /api/oracle/generate-hoard
 * @description Generates a random treasure hoard.
 * @body {{size: string, numItems: string, lootMultiplier?: number}}
 */
router.post('/generate-hoard', lootAndShopHandler(false));

/**
 * @route POST /api/oracle/generate-shop
 * @description Generates a random shop inventory with prices.
 * @body {{size: string, numItems: string, priceMultiplier?: number, mundaneOnly?: boolean}}
 */
router.post('/generate-shop', lootAndShopHandler(true));

// --- V2 NPC Generator (for form-based UI) ---

const v2Router = express.Router();

/**
 * @route GET /api/oracle/v2/generate-npc/options
 * @description Gets all the necessary data to populate a form for the V2 NPC generator.
 */
v2Router.get('/options', (req, res) => {
    try {
        const species = getSpecies().map(s => ({ name: s.name, source: s.source, hasLineages: getLineages(s.name).length > 0 }));
        const classes = getClasses().map(c => ({ name: c.name, source: c.source, hasSubclasses: getSubclasses(c.name).length > 0 }));
        const backgrounds = getBackgrounds().map(b => ({ name: b.name, source: b.source }));
        const crs = Object.keys(crToXp);
        res.json({ species, classes, backgrounds, crs, lineages: {}, subclasses: {} });
    } catch (error) {
        res.status(500).json({ error: "Failed to load NPC generation options." });
    }
});

/**
 * @route GET /api/oracle/v2/generate-npc/lineages/:speciesName
 * @description Gets all available lineages for a given species.
 */
v2Router.get('/lineages/:speciesName', (req, res) => {
    try {
        const { speciesName } = req.params;
        const lineages = getLineages(speciesName).map(l => ({ name: l.name, source: l.source }));
        res.json(lineages);
    } catch (error) {
        res.status(500).json({ error: "Failed to load lineages." });
    }
});

/**
 * @route GET /api/oracle/v2/generate-npc/subclasses/:className
 * @description Gets all available subclasses for a given class.
 */
v2Router.get('/subclasses/:className', (req, res) => {
    try {
        const { className } = req.params;
        const subclasses = getSubclasses(className).map(sc => ({ name: sc.name, source: sc.source }));
        res.json(subclasses);
    } catch (error) {
        res.status(500).json({ error: "Failed to load subclasses." });
    }
});

/**
 * @route POST /api/oracle/v2/generate-npc/generate-npc-statblock
 * @description Generates easy, medium, and hard statblock suggestions for a given CR.
 * @body {{cr: string}}
 */
v2Router.post('/generate-npc-statblock', (req, res) => {
    const { cr } = req.body;
    if (cr === undefined) return res.status(400).json({ error: 'CR is required.' });

    const bestiary = dataStore.get('bestiary') || [];
    const targetCrValue = getCrValue(cr);
    const fallbackTypes = ['humanoid', 'fey', 'fiend', 'celestial'];

    const findStatblockByCr = (crValue, types) => {
        const clampedCr = Math.max(0, Math.min(30, crValue));
        let pool = [];
        if (types) {
            for (const type of types) {
                pool = bestiary.filter(m => getCrValue(m.cr) === clampedCr && m.type && (m.type === type || (typeof m.type === 'object' && m.type.type === type)));
                if (pool.length > 0) return pool[Math.floor(Math.random() * pool.length)];
            }
        }
        pool = bestiary.filter(m => getCrValue(m.cr) === clampedCr);
        return pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : null;
    };

    const medium = findStatblockByCr(targetCrValue, fallbackTypes);
    const easy = findStatblockByCr(targetCrValue - 2, fallbackTypes) || findStatblockByCr(targetCrValue - 1, fallbackTypes);
    const hard = findStatblockByCr(targetCrValue + 2, fallbackTypes) || findStatblockByCr(targetCrValue + 1, fallbackTypes);

    res.json({
        easy: easy ? { name: easy.name, cr: easy.cr } : { name: 'N/A', cr: 'N/A' },
        medium: medium ? { name: medium.name, cr: medium.cr } : { name: `No Monster Found`, cr: cr },
        hard: hard ? { name: hard.name, cr: hard.cr } : { name: 'N/A', cr: 'N/A' },
    });
});

/**
 * @route POST /api/oracle/v2/generate-npc/create
 * @description Creates the final NPC based on form selections. Any omitted fields are randomized.
 * @body {{mode: string, species?: string, lineage?: string, class?: string, subclass?: string, background?: string, cr?: string}}
 */
v2Router.post('/create', async (req, res) => {
    try {
        const { mode, species, lineage, class: charClass, subclass, background, cr } = req.body;
        const parseSelection = (selection) => selection && selection !== 'random' ? { name: selection.split('|')[0], source: selection.split('|')[1] } : null;
        const generatorOptions = { mode, species: parseSelection(species), lineage: parseSelection(lineage), class: parseSelection(charClass), subclass: parseSelection(subclass), background: parseSelection(background), cr };
        const generator = new NpcGenerator(generatorOptions);
        const finalNpc = await generator.generate();
        res.json({ message: "NPC generation complete!", npc: removeFullText(finalNpc) });
    } catch (error) {
        res.status(500).json({ error: "Failed to create NPC." });
    }
});

router.use('/v2/generate-npc', v2Router);


// --- Legacy NPC Generator (Multi-step) ---

const npcModeOptions = [ { name: "Just an idea", value: "idea", description: "A character concept with name, species, class, and background." }, { name: "Full NPC statblock", value: "npc", description: "A full NPC with a suggested statblock for a party." } ];

/**
 * @route POST /api/oracle/generate-npc
 * @description (Legacy) A multi-step generator for creating an NPC. Superseded by the V2 endpoints.
 * @body {{sessionId: string, choice?: string, partyLevel?: number, step?: string}}
 */
router.post('/generate-npc', async (req, res) => {
    const { sessionId, choice, partyLevel, step } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'A "sessionId" is required.' });

    const session = getOrCreateSession(sessionId);
    const currentStep = step || session.data.step || 'awaiting_mode';

    if (choice) {
        const lastChoiceSet = session.data.lastChoiceSet || [];
        let selectedOption = choice.includes('|') ? lastChoiceSet.find(opt => opt.value === choice) : lastChoiceSet.find(opt => opt.value === choice);
        if (currentStep === 'awaiting_species') session.data.species = selectedOption;
        else if (currentStep === 'awaiting_lineage') session.data.lineage = selectedOption;
        else if (currentStep === 'awaiting_class') session.data.class = selectedOption;
        else if (currentStep === 'awaiting_subclass') session.data.subclass = selectedOption;
        else if (currentStep === 'awaiting_background') session.data.background = selectedOption;
        else if (currentStep === 'awaiting_mode') session.data.mode = selectedOption.value;
    }

    if (partyLevel) {
        const level = parseInt(partyLevel, 10);
        if (!isNaN(level) && level >= 1 && level <= 20) session.data.partyLevel = level;
        else return res.json({ step: 'awaiting_party_level', message: "Invalid level. Please provide the party's average level (1-20).", options: { requiresTextInput: true } });
    }

    let nextStep = currentStep;
    if (choice) {
        if (currentStep === 'awaiting_mode') nextStep = 'awaiting_species';
        else if (currentStep === 'awaiting_species') nextStep = getLineages(session.data.species.name).length > 0 ? 'awaiting_lineage' : 'awaiting_class';
        else if (currentStep === 'awaiting_lineage') nextStep = 'awaiting_class';
        else if (currentStep === 'awaiting_class') nextStep = getSubclasses(session.data.class.name).length > 0 ? 'awaiting_subclass' : 'awaiting_background';
        else if (currentStep === 'awaiting_subclass') nextStep = 'awaiting_background';
        else if (currentStep === 'awaiting_background') nextStep = session.data.mode === 'npc' ? 'awaiting_party_level' : 'generate';
    }
    if (session.data.partyLevel && currentStep === 'awaiting_party_level') nextStep = 'generate';
    session.data.step = nextStep;

    const createUniqueOptions = (items) => items.map(item => ({ ...item, label: item.name, value: `${item.name}|${item.source}`, description: `Source: ${item.source}` }));

    switch (nextStep) {
        case 'awaiting_mode': {
            const results = npcModeOptions.map(opt => ({ ...opt, label: opt.name, description: opt.description }));
            session.data.lastChoiceSet = results;
            return res.json({ step: 'awaiting_mode', message: "Let's build an NPC. What would you like to generate?", results });
        }
        case 'awaiting_species': {
            const results = createUniqueOptions(getSpecies());
            session.data.lastChoiceSet = results;
            return res.json({ step: 'awaiting_species', message: "First, choose a species:", results });
        }
        case 'awaiting_lineage': {
            const results = createUniqueOptions(getLineages(session.data.species.name));
            session.data.lastChoiceSet = results;
            return res.json({ step: 'awaiting_lineage', message: `Species: ${session.data.species.name}. Now, choose a lineage:`, results });
        }
        case 'awaiting_class': {
            const results = createUniqueOptions(getClasses());
            session.data.lastChoiceSet = results;
            return res.json({ step: 'awaiting_class', message: "Now, choose a class:", results });
        }
        case 'awaiting_subclass': {
            const results = createUniqueOptions(getSubclasses(session.data.class.name));
            session.data.lastChoiceSet = results;
            return res.json({ step: 'awaiting_subclass', message: `Class: ${session.data.class.name}. Now, choose a subclass:`, results });
        }
        case 'awaiting_background': {
            const results = createUniqueOptions(getBackgrounds());
            session.data.lastChoiceSet = results;
            return res.json({ step: 'awaiting_background', message: "Finally, choose a background:", results });
        }
        case 'awaiting_party_level': {
            return res.json({ step: 'awaiting_party_level', message: "Please provide the party's average level (1-20) to suggest a statblock.", options: { requiresTextInput: true } });
        }
        case 'generate': {
            const generator = new NpcGenerator(session.data);
            const finalNpc = generator.generate();
            deleteSession(sessionId);
            return res.json({ message: "NPC generation complete!", npc: removeFullText(finalNpc) });
        }
        default:
            deleteSession(sessionId);
            return res.status(500).json({ error: 'An unknown error occurred during NPC generation.' });
    }
});


module.exports = router;

/**
 * @route POST /api/oracle/generate-hazard
 * @description Guides a user through a multi-step process to generate a random hazard.
 * @body {{sessionId: string, choice?: number, step?: string}}
 */
router.post('/generate-hazard', async (req, res) => {
    const { sessionId, choice, step } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'A "sessionId" is required.' });

    const session = getOrCreateSession(sessionId);
    if (!session.data.type) session.data.type = 'HAZARD';

    if (session.data.step && step !== session.data.step) {
        // Resend if out of sync
    } else if (choice !== undefined) {
        const choiceIndex = parseInt(choice, 10) - 1;
        if (session.data.step === 'awaiting_tier') {
            if (choiceIndex < 0 || choiceIndex >= trapTierOptions.length) return res.status(400).json({ error: 'Invalid tier choice.' });
            session.data.tier = trapTierOptions[choiceIndex].value;
            session.data.step = 'awaiting_threat';
        } else if (session.data.step === 'awaiting_threat') {
            if (choiceIndex < 0 || choiceIndex >= trapThreatOptions.length) return res.status(400).json({ error: 'Invalid threat choice.' });
            session.data.threat = trapThreatOptions[choiceIndex].toLowerCase();
            session.data.step = 'generate';
        }
    }

    if (!session.data.step) session.data.step = 'awaiting_tier';

    if (session.data.step === 'awaiting_tier') {
        const summary = trapTierOptions.map((opt, i) => `${i + 1}. ${opt.name}`);
        return res.json({ step: 'awaiting_tier', message: "Please choose a tier for the hazard:", results: summary.join('\n') });
    }
    if (session.data.step === 'awaiting_threat') {
        const summary = trapThreatOptions.map((opt, i) => `${i + 1}. ${opt}`);
        return res.json({ step: 'awaiting_threat', message: "Please choose a threat level:", results: summary.join('\n') });
    }
    if (session.data.step === 'generate') {
        let traps = dataStore.get('traps') || [];
        traps = traps.filter(t => t._type === 'HAZARD' && t.rating?.some(r => r.tier === session.data.tier && r.threat.toLowerCase() === session.data.threat));
        if (traps.length === 0) {
            deleteSession(sessionId);
            return res.status(404).json({ error: 'No hazards found matching your criteria. Please try again.' });
        }
        const selectedTrap = traps[Math.floor(Math.random() * traps.length)];
        deleteSession(sessionId);
        return res.json(removeFullText(selectedTrap));
    }
});