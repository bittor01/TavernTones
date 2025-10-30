const fs = require('fs').promises;
const path = require('path');

const categorySources = {
    'spells': { type: 'directory', path: 'spells', key: 'spell' },
    'items': { type: 'file', path: 'items.json', key: 'item' },
    'classes': { type: 'directory', path: 'class', key: ['class', 'subclass'] },
    'bestiary': { type: 'directory', path: 'bestiary', key: 'monster' },
    'feats': { type: 'file', path: 'feats.json', key: 'feat' },
    'backgrounds': { type: 'file', path: 'backgrounds.json', key: 'background' },
    'races': { type: 'file', path: 'races.json', key: ['race', 'subrace'] },
    'traps': { type: 'file', path: 'trapshazards.json', key: 'trap' },
    'vehicles': { type: 'file', path: 'vehicles.json', key: 'vehicle' },
};
const searchableCategories = Object.keys(categorySources);

class FiveEToolsParser {
    constructor(logToRenderer, app, config) {
        this.logToRenderer = logToRenderer;

        if (!config || !config.resourcesPath || !config.randomTablesPath) {
            this.logToRenderer('[5eParser] ERROR: Configuration with folder paths not provided. Parser will not function.');
            this.dataPath = '';
            this.randomTablesPath = '';
            this.cache = new Map();
            return;
        }

        this.dataPath = path.join(config.resourcesPath, '5etoolsdata');
        this.randomTablesPath = path.join(config.randomTablesPath, 'origin');
        this.cache = new Map(); // Simple cache to store loaded data
    }

    /**
     * Loads all JSON data from a category source (file or directory).
     * Caches the data and de-duplicates to avoid re-reading from disk.
     * @param {string} category The category to load (e.g., 'spells', 'items').
     * @returns {Promise<Array>} A promise that resolves to an array of all items in that category.
     */
    async _loadCategoryData(category) {
        if (this.cache.has(category)) {
            return this.cache.get(category);
        }

        const sourceInfo = categorySources[category];
        if (!sourceInfo) {
            this.logToRenderer(`[5eParser] Unknown category: ${category}`);
            return [];
        }

        const itemMap = new Map();

        const processJsonData = (jsonData) => {
            const dataKeys = Array.isArray(sourceInfo.key) ? sourceInfo.key : [sourceInfo.key];
            for (const dataKey of dataKeys) {
                if (jsonData[dataKey] && Array.isArray(jsonData[dataKey])) {
                    for (const item of jsonData[dataKey]) {
                        if (item.name && item.source) {
                            const uniqueKey = `${item.name}__${item.source}`;
                            itemMap.set(uniqueKey, item);
                        }
                    }
                }
            }
        };

        try {
            if (sourceInfo.type === 'directory') {
                const categoryPath = path.join(this.dataPath, sourceInfo.path);
                const files = await fs.readdir(categoryPath);
                for (const file of files) {
                    if (path.extname(file) === '.json') {
                        const filePath = path.join(categoryPath, file);
                        const fileContent = await fs.readFile(filePath, 'utf8');
                        processJsonData(JSON.parse(fileContent));
                    }
                }
            } else { // type === 'file'
                const filePath = path.join(this.dataPath, sourceInfo.path);
                const fileContent = await fs.readFile(filePath, 'utf8');
                processJsonData(JSON.parse(fileContent));
            }

            const allItems = Array.from(itemMap.values());
            this.cache.set(category, allItems);
            this.logToRenderer(`[5eParser] Loaded and cached ${allItems.length} de-duplicated items for category: ${category}`);
            return allItems;
        } catch (error) {
            this.logToRenderer(`[5eParser] Error loading data for category ${category}: ${error.message}`);
            return []; // Return empty array on error
        }
    }

    async searchByName(category, query) {
        if (!searchableCategories.includes(category)) {
            this.logToRenderer(`[5eParser] Attempted to search non-searchable category: ${category}`);
            return [];
        }

        const items = await this._loadCategoryData(category);
        const lowerCaseQuery = query.toLowerCase();

        const results = items.filter(item => item.name && item.name.toLowerCase().includes(lowerCaseQuery));

        return results.map(item => ({ ...item, category: category }));
    }

    async searchAllByName(query) {
        let allResults = [];
        for (const category of searchableCategories) {
            const results = await this.searchByName(category, query);
            allResults = allResults.concat(results);
        }
        return allResults;
    }

    /**
     * Recursively converts the 'entries' property of a 5etools item to a flat string.
     * @param {Array|Object|string} entries The entries to process.
     * @returns {string} A single string containing all text from the entries.
     */
    _flattenEntries(entries) {
        if (typeof entries === 'string') {
            return entries;
        }
        if (Array.isArray(entries)) {
            return entries.map(e => this._flattenEntries(e)).join(' ');
        }
        if (typeof entries === 'object' && entries !== null) {
            let content = '';
            if (entries.name) content += entries.name + ' ';
            if (entries.entries) content += this._flattenEntries(entries.entries);
            if (entries.items) content += this._flattenEntries(entries.items);
            // Add other potential text-holding properties if needed
            return content;
        }
        return '';
    }

    async searchByContent(query) {
        const lowerCaseQuery = query.toLowerCase();
        let allResults = [];

        for (const category of searchableCategories) {
            const items = await this._loadCategoryData(category);
            const results = items.filter(item => {
                if (!item.name) return false;

                // Check name first
                if (item.name.toLowerCase().includes(lowerCaseQuery)) {
                    return true;
                }

                // Then check content
                if (item.entries) {
                    const content = this._flattenEntries(item.entries).toLowerCase();
                    if (content.includes(lowerCaseQuery)) {
                        return true;
                    }
                }
                return false;
            });
            allResults = allResults.concat(results.map(item => ({ ...item, category: category })));
        }
        return allResults;
    }

    async getExact(category, name, source) {
        const items = await this._loadCategoryData(category);
        const item = items.find(i => i.name === name && i.source === source);
        if (item) {
            return { ...item, category: category };
        }
        return null;
    }

    async searchByType(type) {
        const items = await this._loadCategoryData('bestiary');
        const lowerCaseType = type.toLowerCase();

        const results = items.filter(item => {
            if (!item.type) return false;
            const itemType = typeof item.type === 'object' ? item.type.type : item.type;
            return itemType.toLowerCase() === lowerCaseType;
        });

        return results.map(item => ({ ...item, category: 'bestiary' }));
    }

    clearCache(category) {
        if (this.cache.has(category)) {
            this.cache.delete(category);
            this.logToRenderer(`[5eParser] Cleared cache for category: ${category}`);
        }
    }

    async generateTrap({ tier, threat, type, environment }) {
        let traps = await this._loadCategoryData('traps');

        if (tier && tier !== 'random') {
            traps = traps.filter(t => t.rating && t.rating.some(r => r.tier === parseInt(tier, 10)));
        }
        if (threat && threat !== 'random') {
            traps = traps.filter(t => t.rating && t.rating.some(r => r.threat.toLowerCase() === threat.toLowerCase()));
        }
        if (type && type !== 'random') {
            traps = traps.filter(t => t.trapHazType === type);
        }
        if (environment && environment !== 'random') {
            const environmentKeywords = {
                'dungeon': /dungeon|tomb|crypt|lair|hallway/i,
                'wilderness': /forest|jungle|swamp|mountain|wilderness|cave/i,
                'urban': /city|sewer|building|room/i,
                'planar': /planar|plane|feywild|shadowfell/i,
                'aquatic': /water|aquatic|ship/i
            };
            const regex = environmentKeywords[environment];
            if (regex) {
                traps = traps.filter(t => regex.test(JSON.stringify(t.entries)));
            }
        }

        if (traps.length === 0) {
            return null; // No trap found with the given criteria
        }

        return traps[Math.floor(Math.random() * traps.length)];
    }

    async getSpecies() {
        const raceData = await this._loadCategoryData('races');
        // A species is a race entry that does NOT have a `raceName` property, which would mark it as a subrace.
        return raceData.filter(r => !r.raceName);
    }

    async getLineages(speciesName, speciesSource) {
        const allRaces = await this._loadCategoryData('races');

        // Standard check for subraces/lineages defined as separate objects
        const standardLineages = allRaces.filter(r => r.raceName === speciesName);

        // Special handling for XPHB-style inline lineage tables
        const inlineLineages = [];
        const baseRace = allRaces.find(r => r.name === speciesName && r.source === speciesSource);

        if (baseRace && baseRace.entries) {
            const lineageEntry = baseRace.entries.find(e => e.name && e.name.includes("Lineage"));
            if (lineageEntry && lineageEntry.entries) {
                const lineageTable = lineageEntry.entries.find(e => e.type === "table" && e.caption && e.caption.includes("Lineages"));
                if (lineageTable && lineageTable.rows) {
                    for (const row of lineageTable.rows) {
                        const lineageName = row[0];
                        // Create a synthetic lineage object for the dropdown menu
                        inlineLineages.push({
                            name: lineageName,
                            source: speciesSource, // Use the parent's source
                            raceName: speciesName,
                            raceSource: speciesSource,
                        });
                    }
                }
            }
        }

        // Combine and return both types of lineages
        return [...standardLineages, ...inlineLineages];
    }

    async getClasses() {
        const classData = await this._loadCategoryData('classes');
        // A class is a class entry that does NOT have a `className` property.
        return classData.filter(c => !c.className);
    }

    async getSubclasses(className, classSource) {
        const classData = await this._loadCategoryData('classes');
        // A subclass is a class entry that DOES have a `className` property.
        return classData.filter(sc => sc.className === className);
    }

    async getBackgrounds() {
        return await this._loadCategoryData('backgrounds');
    }

    async getBackgroundTraits(backgroundName, backgroundSource) {
        const backgrounds = await this._loadCategoryData('backgrounds');

        const findTraitsRecursive = (bg) => {
            if (!bg) return null;

            if (bg._copy && bg._copy.name && bg._copy.source) {
                const originalBg = backgrounds.find(b => b.name === bg._copy.name && b.source === bg._copy.source);
                if (originalBg) return findTraitsRecursive(originalBg);
            }

            // If the current background doesn't have trait entries, check if it's a reprint.
            if (!bg.entries || !bg.entries.some(e => e.name === "Suggested Characteristics")) {
                const originalBg = backgrounds.find(b => b.reprintedAs && b.reprintedAs.includes(`${bg.name}|${bg.source}`));
                if (originalBg) return findTraitsRecursive(originalBg);
            }

            if (!bg.entries) return null;

            let characteristicsEntry = bg.entries.find(e => e.name === "Suggested Characteristics" && e.type === "entries");

            // Fallback for VRGR backgrounds that use "Horror Characteristics"
            if (!characteristicsEntry) {
                characteristicsEntry = bg.entries.find(e => e.name === "Horror Characteristics" && e.type === "section");
            }

            if (!characteristicsEntry || !characteristicsEntry.entries) return null;

            const traits = { trait: [], ideal: [], bond: [], flaw: [] };
            const traitTypes = ["Personality Trait", "Ideal", "Bond", "Flaw"];

            for (const traitType of traitTypes) {
                const lookupKey = traitType === "Personality Trait" ? "trait" : traitType.toLowerCase();
                const table = characteristicsEntry.entries.find(e => {
                    if (e.type !== "table") return false;
                    const caption = e.caption || (e.colLabels && e.colLabels.length > 1 ? e.colLabels[1] : '');
                    return caption.toLowerCase().includes(lookupKey);
                });

                if (table && table.rows && table.rows.length > 0) {
                    const getTraitText = (rawTrait) => {
                        let text = `No trait text found for ${traitType}.`;
                        if (typeof rawTrait === 'object' && rawTrait && rawTrait.entry) text = rawTrait.entry;
                        else if (typeof rawTrait === 'string') text = rawTrait;
                        else if (rawTrait) text = JSON.stringify(rawTrait);
                        return text.replace(/\{@.*?\|(.*?)\}/g, '$1').replace(/\{@.*? (.*?)\}/g, '$1');
                    };

                    const firstIndex = Math.floor(Math.random() * table.rows.length);
                    traits[lookupKey].push(getTraitText(table.rows[firstIndex][1]));

                    // Push a second, different trait for all categories
                    if (table.rows.length > 1) {
                        let secondIndex;
                        do {
                            secondIndex = Math.floor(Math.random() * table.rows.length);
                        } while (secondIndex === firstIndex);
                        traits[lookupKey].push(getTraitText(table.rows[secondIndex][1]));
                    } else {
                        // If only one option, it will be the same as the first. This is acceptable.
                        traits[lookupKey].push(getTraitText(table.rows[firstIndex][1]));
                    }
                } else {
                    return null; // Indicate that traits could not be found
                }
            }
            return traits;
        };

        const background = backgrounds.find(b => b.name === backgroundName && b.source === backgroundSource);
        let foundTraits = findTraitsRecursive(background);

        if (foundTraits) return foundTraits;

        // Fallback to random tables if no traits are found
        this.logToRenderer(`[5eParser] Could not find traits for background: ${backgroundName} [${backgroundSource}]. Using fallback tables.`);

        try {
            const traitData = JSON.parse(await fs.readFile(path.join(this.randomTablesPath, 'traits.json'), 'utf-8'));
            const idealData = JSON.parse(await fs.readFile(path.join(this.randomTablesPath, 'ideals.json'), 'utf-8'));
            const bondData = JSON.parse(await fs.readFile(path.join(this.randomTablesPath, 'bonds.json'), 'utf-8'));
            const flawData = JSON.parse(await fs.readFile(path.join(this.randomTablesPath, 'flaws.json'), 'utf-8'));

            const fallbackTraits = {
                trait: [],
                ideal: [],
                bond: [],
                flaw: []
            };

            const getRandomEntries = (data, count) => {
                const results = new Set();
                if (data.length <= count) return data;
                while(results.size < count) {
                    results.add(data[Math.floor(Math.random() * data.length)]);
                }
                return Array.from(results);
            }

            fallbackTraits.trait = getRandomEntries(traitData, 2);
            fallbackTraits.ideal = getRandomEntries(idealData, 2);
            fallbackTraits.bond = getRandomEntries(bondData, 2);
            fallbackTraits.flaw = getRandomEntries(flawData, 2);

            return fallbackTraits;
        } catch (error) {
            this.logToRenderer(`[5eParser] Error loading fallback trait data: ${error.message}`);
            return { trait: ['Error loading traits.'], ideal: ['Error loading ideals.'], bond: ['Error loading bonds.'], flaw: ['Error loading flaws.'] };
        }
    }
}

module.exports = FiveEToolsParser;
