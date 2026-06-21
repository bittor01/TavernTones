// Performance and security update
const fs = require('fs').promises;
const path = require('path');
/**
 * Maps category names to their expected 5eTools JSON structure.
 * type: 'directory' implies multiple JSON files in a folder, 'file' is a single JSON.
 * key: The property name in the JSON that contains the array of items.
 */
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

/**
 * Handles parsing and searching of D&D 5e JSON data files (5eTools format).
 */
class FiveEToolsParser {
    /**
     * Initializes the parser with local data paths.
     * @param {function} logToRenderer - Callback for UI logging.
     * @param {object} app - Electron app object.
     * @param {object} config - Configuration object containing data paths.
     */
    constructor(logToRenderer, app, config) {
        this.logToRenderer = logToRenderer;

        // Ensure essential data paths are provided
        if (!config || !config.bestiaryPath || !config.randomTablesPath) {
            this.logToRenderer('[5eParser] ERROR: Configuration paths missing.');
            this.bestiaryPath = '';
            this.randomTablesPath = '';
            this.cache = new Map();
            return;
        }
        this.bestiaryPath = config.bestiaryPath;
        // Construct path for original random table data
        this.randomTablesPath = path.join(config.randomTablesPath, 'origin');
        // Memory cache to prevent repeated disk reads
        this.cache = new Map();
    }

    /**
     * Internal method to load and cache JSON data for a specific category.
     * @param {string} category - Category to load (e.g. 'bestiary').
     * @returns {Promise<Array>} Array of data objects.
     * @private
     */
    async _loadCategoryData(category) {
        // Fast-path: return cached data to avoid expensive disk I/O and JSON parsing.
        if (this.cache.has(category)) {
            return this.cache.get(category);
        }

        const sourceInfo = categorySources[category];
        if (!sourceInfo) {
            this.logToRenderer(`[5eParser] Unknown category: ${category}`);
            return [];
        }

        // Currently, only the 'bestiary' is optimized for combatant importing.
        // Other categories are parsed on-demand or filtered through search.
        if (category !== 'bestiary') {
            this.logToRenderer(`[5eParser] Category ${category} unsupported in this version.`);
            return [];
        }

        // Use a Map for de-duplication. Some 5eTools releases repeat monsters across different source files.
        const itemMap = new Map();

        /**
         * Parses a JSON object and extracts relevant data based on the category's keys.
         */
        const processJsonData = (jsonData) => {
            const dataKeys = Array.isArray(sourceInfo.key) ? sourceInfo.key : [sourceInfo.key];
            for (const dataKey of dataKeys) {
                if (jsonData[dataKey] && Array.isArray(jsonData[dataKey])) {
                    for (const item of jsonData[dataKey]) {
                        // Unique identity in 5eTools is established by Name + Source.
                        if (item.name && item.source) {
                            const uniqueKey = `${item.name}__${item.source}`;
                            itemMap.set(uniqueKey, item);
                        }
                    }
                }
            }
        };
        try {
            // Bestiary data is typically split across many files in a directory
            if (sourceInfo.type === 'directory') {
                const files = await fs.readdir(this.bestiaryPath);
                for (const file of files) {
                    // Only process JSON files
                    if (path.extname(file) === '.json') {
                        const filePath = path.join(this.bestiaryPath, file);
                        const fileContent = await fs.readFile(filePath, 'utf8');
                        // Parse and extract monsters
                        processJsonData(JSON.parse(fileContent));
                    }
                }
            }

            // Convert map to array and cache the result
            const allItems = Array.from(itemMap.values());
            this.cache.set(category, allItems);
            this.logToRenderer(`[5eParser] Loaded ${allItems.length} items for: ${category}`);
            return allItems;
        } catch (error) {
            this.logToRenderer(`[5eParser] Error loading category ${category}: ${error.message}`);
            return [];
        }
    }

    /**
     * Searches for items in a category where the name matches the query.
     * @param {string} category - Category name.
     * @param {string} query - Search term.
     * @returns {Promise<Array>} Matching items with category metadata.
     */
    async searchByName(category, query) {
        // Guard against invalid category requests.
        if (!searchableCategories.includes(category)) return [];

        // Load entire category into memory (cached) then filter.
        const items = await this._loadCategoryData(category);
        const lowerCaseQuery = query.toLowerCase();

        // Perform partial, case-insensitive match on the item name.
        const results = items.filter(item => item.name && item.name.toLowerCase().includes(lowerCaseQuery));

        // Attach category metadata so the UI knows how to format the result (e.g., Spell vs Monster).
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
     * Recursively flattens nested entry objects into a single searchable string.
     * @param {Array|Object|string} entries - Input entries.
     * @returns {string} Combined text.
     * @private
     */
    _flattenEntries(entries) {
        // Base case: string
        if (typeof entries === 'string') return entries;
        // Recursive case: array of entries
        if (Array.isArray(entries)) return entries.map(e => this._flattenEntries(e)).join(' ');
        // Recursive case: object with nested entries or items
        if (typeof entries === 'object' && entries !== null) {
            let content = entries.name ? entries.name + ' ' : '';
            if (entries.entries) content += this._flattenEntries(entries.entries);
            if (entries.items) content += this._flattenEntries(entries.items);
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

    /**
     * Wipes cached data for a category to force a reload from disk.
     */
    clearCache(category) {
        if (this.cache.has(category)) {
            this.cache.delete(category);
            this.logToRenderer(`[5eParser] Cache cleared for: ${category}`);
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

        /**
         * Recursively searches for characteristic tables, following copy and reprint tags.
         */
        const findTraitsRecursive = (bg) => {
            if (!bg) return null;

            // Handle 5eTools "_copy" tags which inherit properties from another entry.
            if (bg._copy && bg._copy.name && bg._copy.source) {
                const originalBg = backgrounds.find(b => b.name === bg._copy.name && b.source === bg._copy.source);
                if (originalBg) return findTraitsRecursive(originalBg);
            }

            // If characteristic tables aren't found here, search for the original version via reprint tags.
            if (!bg.entries || !bg.entries.some(e => e.name === "Suggested Characteristics")) {
                const originalBg = backgrounds.find(b => b.reprintedAs && b.reprintedAs.includes(`${bg.name}|${bg.source}`));
                if (originalBg) return findTraitsRecursive(originalBg);
            }
            if (!bg.entries) return null;

            // Look for the standard 5e characteristic block.
            let characteristicsEntry = bg.entries.find(e => e.name === "Suggested Characteristics" && e.type === "entries");

            // Specialized fallback for Van Richten's Guide to Ravenloft (VRGR) style sections.
            if (!characteristicsEntry) {
                characteristicsEntry = bg.entries.find(e => e.name === "Horror Characteristics" && e.type === "section");
            }
            if (!characteristicsEntry || !characteristicsEntry.entries) return null;

            const traits = { trait: [], ideal: [], bond: [], flaw: [] };
            const traitTypes = ["Personality Trait", "Ideal", "Bond", "Flaw"];

            for (const traitType of traitTypes) {
                // Map the human-readable UI type to the internal JSON key.
                const lookupKey = traitType === "Personality Trait" ? "trait" : traitType.toLowerCase();

                // Search the nested entries for a table matching this trait type.
                const table = characteristicsEntry.entries.find(e => {
                    if (e.type !== "table") return false;
                    const caption = e.caption || (e.colLabels && e.colLabels.length > 1 ? e.colLabels[1] : '');
                    return caption.toLowerCase().includes(lookupKey);
                });

                if (table && table.rows && table.rows.length > 0) {
                    /**
                     * Cleans raw 5eTools text by stripping inline tags and resolving object entries.
                     */
                    const getTraitText = (rawTrait) => {
                        let text = `No trait text found for ${traitType}.`;
                        if (typeof rawTrait === 'object' && rawTrait && rawTrait.entry) text = rawTrait.entry;
                        else if (typeof rawTrait === 'string') text = rawTrait;
                        else if (rawTrait) text = JSON.stringify(rawTrait);
                        return text.replace(/\{@.*?\|(.*?)\}/g, '$1').replace(/\{@.*? (.*?)\}/g, '$1');
                    };

                    // Randomly select two distinct traits from the table to provide variety.
                    const firstIndex = Math.floor(Math.random() * table.rows.length);
                    traits[lookupKey].push(getTraitText(table.rows[firstIndex][1]));

                    if (table.rows.length > 1) {
                        let secondIndex;
                        do {
                            secondIndex = Math.floor(Math.random() * table.rows.length);
                        } while (secondIndex === firstIndex);
                        traits[lookupKey].push(getTraitText(table.rows[secondIndex][1]));
                    } else {
                        traits[lookupKey].push(getTraitText(table.rows[firstIndex][1]));
                    }
                } else {
                    // Fail the recursive lookup if any trait table is missing.
                    return null;
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
