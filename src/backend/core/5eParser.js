// Performance and security update
// Process: const fs = require('fs').promises
// Process: const fs = require('fs').promises
const fs = require('fs').promises;
const path = require('path');

// Process: const categorySources =
// Process: const categorySources =
const categorySources = {
    'spells': { type: 'directory', path: 'spells', key: 'spell' },
// Process: 'items':  type: 'file', path: 'items.json', key: 'item' ,
    // Process: 'items':  type: 'file', path: 'items.json', key: 'item' ,
    'items': { type: 'file', path: 'items.json', key: 'item' },
    'classes': { type: 'directory', path: 'class', key: ['class', 'subclass'] },
// Process: 'bestiary':  type: 'directory', path: 'bestiary', key: 'm...
    // Process: 'bestiary':  type: 'directory', path: 'bestiary', key: 'm...
    'bestiary': { type: 'directory', path: 'bestiary', key: 'monster' },
    'feats': { type: 'file', path: 'feats.json', key: 'feat' },
// Process: 'backgrounds':  type: 'file', path: 'backgrounds.json', k...
    // Process: 'backgrounds':  type: 'file', path: 'backgrounds.json', k...
    'backgrounds': { type: 'file', path: 'backgrounds.json', key: 'background' },
    'races': { type: 'file', path: 'races.json', key: ['race', 'subrace'] },
// Process: 'traps':  type: 'file', path: 'trapshazards.json', key: '...
    // Process: 'traps':  type: 'file', path: 'trapshazards.json', key: '...
    'traps': { type: 'file', path: 'trapshazards.json', key: 'trap' },
    'vehicles': { type: 'file', path: 'vehicles.json', key: 'vehicle' },
// Process:
// Process:
};
const searchableCategories = Object.keys(categorySources);

/**
 * Handles parsing and searching of D&D 5e JSON data files (5eTools format).
 */
/**
 * Auto-generated documentation
 */
// Process: class FiveEToolsParser
// Process: class FiveEToolsParser
class FiveEToolsParser {
    /**
     * Initializes the parser with local data paths.
     * @param {function} logToRenderer - Callback for UI logging.
     * @param {object} app - Electron app object.
     * @param {object} config - Configuration object containing data paths.
     */
    constructor(logToRenderer, app, config) {
// Process: this.logToRenderer = logToRenderer
        // Process: this.logToRenderer = logToRenderer
        this.logToRenderer = logToRenderer;

        // Ensure essential data paths are provided
        if (!config || !config.bestiaryPath || !config.randomTablesPath) {
// Process: this.logToRenderer('[5eParser] ERROR: Configuration paths...
            // Process: this.logToRenderer('[5eParser] ERROR: Configuration paths...
            this.logToRenderer('[5eParser] ERROR: Configuration paths missing.');
            this.bestiaryPath = '';
// Process: this.randomTablesPath = ''
            // Process: this.randomTablesPath = ''
            this.randomTablesPath = '';
            this.cache = new Map();
// Process: return
            // Process: return
            return;
        }

// Process: this.bestiaryPath = config.bestiaryPath
        // Process: this.bestiaryPath = config.bestiaryPath
        this.bestiaryPath = config.bestiaryPath;
        // Construct path for original random table data
        this.randomTablesPath = path.join(config.randomTablesPath, 'origin');
        // Memory cache to prevent repeated disk reads
// Process: this.cache = new Map()
        // Process: this.cache = new Map()
        this.cache = new Map();
    }

    /**
     * Internal method to load and cache JSON data for a specific category.
     * @param {string} category - Category to load (e.g. 'bestiary').
     * @returns {Promise<Array>} Array of data objects.
     * @private
     */
// Process: async _loadCategoryData(category)
    // Process: async _loadCategoryData(category)
    async _loadCategoryData(category) {
        // Return from cache if already loaded
        if (this.cache.has(category)) {
// Process: return this.cache.get(category)
            // Process: return this.cache.get(category)
            return this.cache.get(category);
        }

        // Validate category support
// Process: const sourceInfo = categorySources[category]
        // Process: const sourceInfo = categorySources[category]
        const sourceInfo = categorySources[category];
        if (!sourceInfo) {
// Process: this.logToRenderer(`[5eParser] Unknown category: $category`)
            // Process: this.logToRenderer(`[5eParser] Unknown category: $category`)
            this.logToRenderer(`[5eParser] Unknown category: ${category}`);
            return [];
// Process:
        // Process:
        }

        // TavernTones focuses primarily on the Bestiary for combat tracking
        if (category !== 'bestiary') {
// Process: this.logToRenderer(`[5eParser] Category $category unsuppo...
            // Process: this.logToRenderer(`[5eParser] Category $category unsuppo...
            this.logToRenderer(`[5eParser] Category ${category} unsupported in this version.`);
            return [];
// Process:
        // Process:
        }

        // Map to de-duplicate items across multiple JSON files
        const itemMap = new Map();

        /**
         * Helper to extract items from a parsed JSON object based on category keys.
         */
/**
 * Auto-generated documentation
 */
// Process: const processJsonData = (jsonData) =>
        // Process: const processJsonData = (jsonData) =>
        const processJsonData = (jsonData) => {
            const dataKeys = Array.isArray(sourceInfo.key) ? sourceInfo.key : [sourceInfo.key];
// Process: for (const dataKey of dataKeys)
            // Process: for (const dataKey of dataKeys)
            for (const dataKey of dataKeys) {
                if (jsonData[dataKey] && Array.isArray(jsonData[dataKey])) {
// Process: for (const item of jsonData[dataKey])
                    // Process: for (const item of jsonData[dataKey])
                    for (const item of jsonData[dataKey]) {
                        // Use name and source as a composite unique key
                        if (item.name && item.source) {
// Process: const uniqueKey = `$item.name__$item.source`
                            // Process: const uniqueKey = `$item.name__$item.source`
                            const uniqueKey = `${item.name}__${item.source}`;
                            itemMap.set(uniqueKey, item);
// Process:
                        // Process:
                        }
                    }
// Process:
                // Process:
                }
            }
// Process:
        // Process:
        };

        try {
            // Bestiary data is typically split across many files in a directory
// Process: if (sourceInfo.type === 'directory')
            // Process: if (sourceInfo.type === 'directory')
            if (sourceInfo.type === 'directory') {
                const files = await fs.readdir(this.bestiaryPath);
// Process: for (const file of files)
                // Process: for (const file of files)
                for (const file of files) {
                    // Only process JSON files
                    if (path.extname(file) === '.json') {
// Process: const filePath = path.join(this.bestiaryPath, file)
                        // Process: const filePath = path.join(this.bestiaryPath, file)
                        const filePath = path.join(this.bestiaryPath, file);
                        const fileContent = await fs.readFile(filePath, 'utf8');
                        // Parse and extract monsters
// Process: processJsonData(JSON.parse(fileContent))
                        // Process: processJsonData(JSON.parse(fileContent))
                        processJsonData(JSON.parse(fileContent));
                    }
// Process:
                // Process:
                }
            }

            // Convert map to array and cache the result
// Process: const allItems = Array.from(itemMap.values())
            // Process: const allItems = Array.from(itemMap.values())
            const allItems = Array.from(itemMap.values());
            this.cache.set(category, allItems);
// Process: this.logToRenderer(`[5eParser] Loaded $allItems.length it...
            // Process: this.logToRenderer(`[5eParser] Loaded $allItems.length it...
            this.logToRenderer(`[5eParser] Loaded ${allItems.length} items for: ${category}`);
            return allItems;
// Process: catch (error)
        // Process: catch (error)
        } catch (error) {
            this.logToRenderer(`[5eParser] Error loading category ${category}: ${error.message}`);
// Process: return []
            // Process: return []
            return [];
        }
// Process:
    // Process:
    }

    /**
     * Searches for items in a category where the name matches the query.
     * @param {string} category - Category name.
     * @param {string} query - Search term.
     * @returns {Promise<Array>} Matching items with category metadata.
     */
    async searchByName(category, query) {
// Process: if (!searchableCategories.includes(category)) return []
        // Process: if (!searchableCategories.includes(category)) return []
        if (!searchableCategories.includes(category)) return [];

        // Ensure category data is loaded
        const items = await this._loadCategoryData(category);
// Process: const lowerCaseQuery = query.toLowerCase()
        // Process: const lowerCaseQuery = query.toLowerCase()
        const lowerCaseQuery = query.toLowerCase();

        // Filter by partial name match
/**
 * Auto-generated documentation
 */
        const results = items.filter(item => item.name && item.name.toLowerCase().includes(lowerCaseQuery));

        // Inject category info into result objects
// Process: return results.map(item => ( ...item, category: category ))
        // Process: return results.map(item => ( ...item, category: category ))
        return results.map(item => ({ ...item, category: category }));
    }

// Process: async searchAllByName(query)
    // Process: async searchAllByName(query)
    async searchAllByName(query) {
        let allResults = [];
// Process: for (const category of searchableCategories)
        // Process: for (const category of searchableCategories)
        for (const category of searchableCategories) {
            const results = await this.searchByName(category, query);
// Process: allResults = allResults.concat(results)
            // Process: allResults = allResults.concat(results)
            allResults = allResults.concat(results);
        }
// Process: return allResults
        // Process: return allResults
        return allResults;
    }

    /**
     * Recursively flattens nested entry objects into a single searchable string.
     * @param {Array|Object|string} entries - Input entries.
     * @returns {string} Combined text.
     * @private
     */
// Process: _flattenEntries(entries)
    // Process: _flattenEntries(entries)
    _flattenEntries(entries) {
        // Base case: string
        if (typeof entries === 'string') return entries;
        // Recursive case: array of entries
// Process: if (Array.isArray(entries)) return entries.map(e => this....
        // Process: if (Array.isArray(entries)) return entries.map(e => this....
        if (Array.isArray(entries)) return entries.map(e => this._flattenEntries(e)).join(' ');
        // Recursive case: object with nested entries or items
        if (typeof entries === 'object' && entries !== null) {
// Process: let content = entries.name ? entries.name + ' ' : ''
            // Process: let content = entries.name ? entries.name + ' ' : ''
            let content = entries.name ? entries.name + ' ' : '';
            if (entries.entries) content += this._flattenEntries(entries.entries);
// Process: if (entries.items) content += this._flattenEntries(entrie...
            // Process: if (entries.items) content += this._flattenEntries(entrie...
            if (entries.items) content += this._flattenEntries(entries.items);
            return content;
// Process:
        // Process:
        }
        return '';
// Process:
    // Process:
    }

    async searchByContent(query) {
// Process: const lowerCaseQuery = query.toLowerCase()
        // Process: const lowerCaseQuery = query.toLowerCase()
        const lowerCaseQuery = query.toLowerCase();
        let allResults = [];

// Process: for (const category of searchableCategories)
        // Process: for (const category of searchableCategories)
        for (const category of searchableCategories) {
            const items = await this._loadCategoryData(category);
/**
 * Auto-generated documentation
 */
// Process: const results = items.filter(item =>
            // Process: const results = items.filter(item =>
            const results = items.filter(item => {
                if (!item.name) return false;

                // Check name first
// Process: if (item.name.toLowerCase().includes(lowerCaseQuery))
                // Process: if (item.name.toLowerCase().includes(lowerCaseQuery))
                if (item.name.toLowerCase().includes(lowerCaseQuery)) {
                    return true;
// Process:
                // Process:
                }

                // Then check content
                if (item.entries) {
// Process: const content = this._flattenEntries(item.entries).toLowe...
                    // Process: const content = this._flattenEntries(item.entries).toLowe...
                    const content = this._flattenEntries(item.entries).toLowerCase();
                    if (content.includes(lowerCaseQuery)) {
// Process: return true
                        // Process: return true
                        return true;
                    }
// Process:
                // Process:
                }
                return false;
// Process: )
            // Process: )
            });
            allResults = allResults.concat(results.map(item => ({ ...item, category: category })));
// Process:
        // Process:
        }
        return allResults;
// Process:
    // Process:
    }

    async getExact(category, name, source) {
// Process: const items = await this._loadCategoryData(category)
        // Process: const items = await this._loadCategoryData(category)
        const items = await this._loadCategoryData(category);
/**
 * Auto-generated documentation
 */
        const item = items.find(i => i.name === name && i.source === source);
// Process: if (item)
        // Process: if (item)
        if (item) {
            return { ...item, category: category };
// Process:
        // Process:
        }
        return null;
// Process:
    // Process:
    }

    async searchByType(type) {
// Process: const items = await this._loadCategoryData('bestiary')
        // Process: const items = await this._loadCategoryData('bestiary')
        const items = await this._loadCategoryData('bestiary');
        const lowerCaseType = type.toLowerCase();

/**
 * Auto-generated documentation
 */
// Process: const results = items.filter(item =>
        // Process: const results = items.filter(item =>
        const results = items.filter(item => {
            if (!item.type) return false;
// Process: const itemType = typeof item.type === 'object' ? item.typ...
            // Process: const itemType = typeof item.type === 'object' ? item.typ...
            const itemType = typeof item.type === 'object' ? item.type.type : item.type;
            return itemType.toLowerCase() === lowerCaseType;
// Process: )
        // Process: )
        });

        return results.map(item => ({ ...item, category: 'bestiary' }));
// Process:
    // Process:
    }

    /**
     * Wipes cached data for a category to force a reload from disk.
     */
    clearCache(category) {
// Process: if (this.cache.has(category))
        // Process: if (this.cache.has(category))
        if (this.cache.has(category)) {
            this.cache.delete(category);
// Process: this.logToRenderer(`[5eParser] Cache cleared for: $catego...
            // Process: this.logToRenderer(`[5eParser] Cache cleared for: $catego...
            this.logToRenderer(`[5eParser] Cache cleared for: ${category}`);
        }
// Process:
    // Process:
    }

    async generateTrap({ tier, threat, type, environment }) {
// Process: let traps = await this._loadCategoryData('traps')
        // Process: let traps = await this._loadCategoryData('traps')
        let traps = await this._loadCategoryData('traps');

        if (tier && tier !== 'random') {
// Process: traps = traps.filter(t => t.rating && t.rating.some(r => ...
            // Process: traps = traps.filter(t => t.rating && t.rating.some(r => ...
            traps = traps.filter(t => t.rating && t.rating.some(r => r.tier === parseInt(tier, 10)));
        }
// Process: if (threat && threat !== 'random')
        // Process: if (threat && threat !== 'random')
        if (threat && threat !== 'random') {
            traps = traps.filter(t => t.rating && t.rating.some(r => r.threat.toLowerCase() === threat.toLowerCase()));
// Process:
        // Process:
        }
        if (type && type !== 'random') {
// Process: traps = traps.filter(t => t.trapHazType === type)
            // Process: traps = traps.filter(t => t.trapHazType === type)
            traps = traps.filter(t => t.trapHazType === type);
        }
// Process: if (environment && environment !== 'random')
        // Process: if (environment && environment !== 'random')
        if (environment && environment !== 'random') {
            const environmentKeywords = {
// Process: 'dungeon': /dungeon|tomb|crypt|lair|hallway/i,
                // Process: 'dungeon': /dungeon|tomb|crypt|lair|hallway/i,
                'dungeon': /dungeon|tomb|crypt|lair|hallway/i,
                'wilderness': /forest|jungle|swamp|mountain|wilderness|cave/i,
// Process: 'urban': /city|sewer|building|room/i,
                // Process: 'urban': /city|sewer|building|room/i,
                'urban': /city|sewer|building|room/i,
                'planar': /planar|plane|feywild|shadowfell/i,
// Process: 'aquatic': /water|aquatic|ship/i
                // Process: 'aquatic': /water|aquatic|ship/i
                'aquatic': /water|aquatic|ship/i
            };
// Process: const regex = environmentKeywords[environment]
            // Process: const regex = environmentKeywords[environment]
            const regex = environmentKeywords[environment];
            if (regex) {
// Process: traps = traps.filter(t => regex.test(JSON.stringify(t.ent...
                // Process: traps = traps.filter(t => regex.test(JSON.stringify(t.ent...
                traps = traps.filter(t => regex.test(JSON.stringify(t.entries)));
            }
// Process:
        // Process:
        }

        if (traps.length === 0) {
// Process: return null // No trap found with the given criteria
            // Process: return null
            return null; // No trap found with the given criteria
        }

// Process: return traps[Math.floor(Math.random() * traps.length)]
        // Process: return traps[Math.floor(Math.random() * traps.length)]
        return traps[Math.floor(Math.random() * traps.length)];
    }

// Process: async getSpecies()
    // Process: async getSpecies()
    async getSpecies() {
        const raceData = await this._loadCategoryData('races');
        // A species is a race entry that does NOT have a `raceName` property, which would mark it as a subrace.
// Process: return raceData.filter(r => !r.raceName)
        // Process: return raceData.filter(r => !r.raceName)
        return raceData.filter(r => !r.raceName);
    }

// Process: async getLineages(speciesName, speciesSource)
    // Process: async getLineages(speciesName, speciesSource)
    async getLineages(speciesName, speciesSource) {
        const allRaces = await this._loadCategoryData('races');

        // Standard check for subraces/lineages defined as separate objects
/**
 * Auto-generated documentation
 */
// Process: const standardLineages = allRaces.filter(r => r.raceName ...
        // Process: const standardLineages = allRaces.filter(r => r.raceName ...
        const standardLineages = allRaces.filter(r => r.raceName === speciesName);

        // Special handling for XPHB-style inline lineage tables
        const inlineLineages = [];
/**
 * Auto-generated documentation
 */
// Process: const baseRace = allRaces.find(r => r.name === speciesNam...
        // Process: const baseRace = allRaces.find(r => r.name === speciesNam...
        const baseRace = allRaces.find(r => r.name === speciesName && r.source === speciesSource);

        if (baseRace && baseRace.entries) {
/**
 * Auto-generated documentation
 */
// Process: const lineageEntry = baseRace.entries.find(e => e.name &&...
            // Process: const lineageEntry = baseRace.entries.find(e => e.name &&...
            const lineageEntry = baseRace.entries.find(e => e.name && e.name.includes("Lineage"));
            if (lineageEntry && lineageEntry.entries) {
/**
 * Auto-generated documentation
 */
// Process: const lineageTable = lineageEntry.entries.find(e => e.typ...
                // Process: const lineageTable = lineageEntry.entries.find(e => e.typ...
                const lineageTable = lineageEntry.entries.find(e => e.type === "table" && e.caption && e.caption.includes("Lineages"));
                if (lineageTable && lineageTable.rows) {
// Process: for (const row of lineageTable.rows)
                    // Process: for (const row of lineageTable.rows)
                    for (const row of lineageTable.rows) {
                        const lineageName = row[0];
                        // Create a synthetic lineage object for the dropdown menu
// Process: inlineLineages.push(
                        // Process: inlineLineages.push(
                        inlineLineages.push({
                            name: lineageName,
// Process: source: speciesSource, // Use the parent's source
                            // Process: source: speciesSource,
                            source: speciesSource, // Use the parent's source
                            raceName: speciesName,
// Process: raceSource: speciesSource,
                            // Process: raceSource: speciesSource,
                            raceSource: speciesSource,
                        });
// Process:
                    // Process:
                    }
                }
// Process:
            // Process:
            }
        }

        // Combine and return both types of lineages
// Process: return [...standardLineages, ...inlineLineages]
        // Process: return [...standardLineages, ...inlineLineages]
        return [...standardLineages, ...inlineLineages];
    }

// Process: async getClasses()
    // Process: async getClasses()
    async getClasses() {
        const classData = await this._loadCategoryData('classes');
        // A class is a class entry that does NOT have a `className` property.
// Process: return classData.filter(c => !c.className)
        // Process: return classData.filter(c => !c.className)
        return classData.filter(c => !c.className);
    }

// Process: async getSubclasses(className, classSource)
    // Process: async getSubclasses(className, classSource)
    async getSubclasses(className, classSource) {
        const classData = await this._loadCategoryData('classes');
        // A subclass is a class entry that DOES have a `className` property.
// Process: return classData.filter(sc => sc.className === className)
        // Process: return classData.filter(sc => sc.className === className)
        return classData.filter(sc => sc.className === className);
    }

// Process: async getBackgrounds()
    // Process: async getBackgrounds()
    async getBackgrounds() {
        return await this._loadCategoryData('backgrounds');
// Process:
    // Process:
    }

    async getBackgroundTraits(backgroundName, backgroundSource) {
// Process: const backgrounds = await this._loadCategoryData('backgro...
        // Process: const backgrounds = await this._loadCategoryData('backgro...
        const backgrounds = await this._loadCategoryData('backgrounds');

/**
 * Auto-generated documentation
 */
        const findTraitsRecursive = (bg) => {
// Process: if (!bg) return null
            // Process: if (!bg) return null
            if (!bg) return null;

            if (bg._copy && bg._copy.name && bg._copy.source) {
/**
 * Auto-generated documentation
 */
// Process: const originalBg = backgrounds.find(b => b.name === bg._c...
                // Process: const originalBg = backgrounds.find(b => b.name === bg._c...
                const originalBg = backgrounds.find(b => b.name === bg._copy.name && b.source === bg._copy.source);
                if (originalBg) return findTraitsRecursive(originalBg);
// Process:
            // Process:
            }

            // If the current background doesn't have trait entries, check if it's a reprint.
            if (!bg.entries || !bg.entries.some(e => e.name === "Suggested Characteristics")) {
/**
 * Auto-generated documentation
 */
// Process: const originalBg = backgrounds.find(b => b.reprintedAs &&...
                // Process: const originalBg = backgrounds.find(b => b.reprintedAs &&...
                const originalBg = backgrounds.find(b => b.reprintedAs && b.reprintedAs.includes(`${bg.name}|${bg.source}`));
                if (originalBg) return findTraitsRecursive(originalBg);
// Process:
            // Process:
            }

            if (!bg.entries) return null;

// Process: let characteristicsEntry = bg.entries.find(e => e.name ==...
            // Process: let characteristicsEntry = bg.entries.find(e => e.name ==...
            let characteristicsEntry = bg.entries.find(e => e.name === "Suggested Characteristics" && e.type === "entries");

            // Fallback for VRGR backgrounds that use "Horror Characteristics"
            if (!characteristicsEntry) {
// Process: characteristicsEntry = bg.entries.find(e => e.name === "H...
                // Process: characteristicsEntry = bg.entries.find(e => e.name === "H...
                characteristicsEntry = bg.entries.find(e => e.name === "Horror Characteristics" && e.type === "section");
            }

// Process: if (!characteristicsEntry || !characteristicsEntry.entrie...
            // Process: if (!characteristicsEntry || !characteristicsEntry.entrie...
            if (!characteristicsEntry || !characteristicsEntry.entries) return null;

            const traits = { trait: [], ideal: [], bond: [], flaw: [] };
// Process: const traitTypes = ["Personality Trait", "Ideal", "Bond",...
            // Process: const traitTypes = ["Personality Trait", "Ideal", "Bond",...
            const traitTypes = ["Personality Trait", "Ideal", "Bond", "Flaw"];

            for (const traitType of traitTypes) {
// Process: const lookupKey = traitType === "Personality Trait" ? "tr...
                // Process: const lookupKey = traitType === "Personality Trait" ? "tr...
                const lookupKey = traitType === "Personality Trait" ? "trait" : traitType.toLowerCase();
/**
 * Auto-generated documentation
 */
                const table = characteristicsEntry.entries.find(e => {
// Process: if (e.type !== "table") return false
                    // Process: if (e.type !== "table") return false
                    if (e.type !== "table") return false;
                    const caption = e.caption || (e.colLabels && e.colLabels.length > 1 ? e.colLabels[1] : '');
// Process: return caption.toLowerCase().includes(lookupKey)
                    // Process: return caption.toLowerCase().includes(lookupKey)
                    return caption.toLowerCase().includes(lookupKey);
                });

// Process: if (table && table.rows && table.rows.length > 0)
                // Process: if (table && table.rows && table.rows.length > 0)
                if (table && table.rows && table.rows.length > 0) {
/**
 * Auto-generated documentation
 */
                    const getTraitText = (rawTrait) => {
// Process: let text = `No trait text found for $traitType.`
                        // Process: let text = `No trait text found for $traitType.`
                        let text = `No trait text found for ${traitType}.`;
                        if (typeof rawTrait === 'object' && rawTrait && rawTrait.entry) text = rawTrait.entry;
// Process: else if (typeof rawTrait === 'string') text = rawTrait
                        // Process: else if (typeof rawTrait === 'string') text = rawTrait
                        else if (typeof rawTrait === 'string') text = rawTrait;
                        else if (rawTrait) text = JSON.stringify(rawTrait);
// Process: return text.replace(/\@.*?\|(.*?)\/g, '$1').replace(/\@.*...
                        // Process: return text.replace(/\@.*?\|(.*?)\/g, '$1').replace(/\@.*...
                        return text.replace(/\{@.*?\|(.*?)\}/g, '$1').replace(/\{@.*? (.*?)\}/g, '$1');
                    };

// Process: const firstIndex = Math.floor(Math.random() * table.rows....
                    // Process: const firstIndex = Math.floor(Math.random() * table.rows....
                    const firstIndex = Math.floor(Math.random() * table.rows.length);
                    traits[lookupKey].push(getTraitText(table.rows[firstIndex][1]));

                    // Push a second, different trait for all categories
// Process: if (table.rows.length > 1)
                    // Process: if (table.rows.length > 1)
                    if (table.rows.length > 1) {
                        let secondIndex;
// Process: do
                        // Process: do
                        do {
                            secondIndex = Math.floor(Math.random() * table.rows.length);
// Process: while (secondIndex === firstIndex)
                        // Process: while (secondIndex === firstIndex)
                        } while (secondIndex === firstIndex);
                        traits[lookupKey].push(getTraitText(table.rows[secondIndex][1]));
// Process: else
                    // Process: else
                    } else {
                        // If only one option, it will be the same as the first. This is acceptable.
                        traits[lookupKey].push(getTraitText(table.rows[firstIndex][1]));
// Process:
                    // Process:
                    }
                } else {
// Process: return null // Indicate that traits could not be found
                    // Process: return null
                    return null; // Indicate that traits could not be found
                }
// Process:
            // Process:
            }
            return traits;
// Process:
        // Process:
        };

/**
 * Auto-generated documentation
 */
        const background = backgrounds.find(b => b.name === backgroundName && b.source === backgroundSource);
// Process: let foundTraits = findTraitsRecursive(background)
        // Process: let foundTraits = findTraitsRecursive(background)
        let foundTraits = findTraitsRecursive(background);

        if (foundTraits) return foundTraits;

        // Fallback to random tables if no traits are found
// Process: this.logToRenderer(`[5eParser] Could not find traits for ...
        // Process: this.logToRenderer(`[5eParser] Could not find traits for ...
        this.logToRenderer(`[5eParser] Could not find traits for background: ${backgroundName} [${backgroundSource}]. Using fallback tables.`);

        try {
// Process: const traitData = JSON.parse(await fs.readFile(path.join(...
            // Process: const traitData = JSON.parse(await fs.readFile(path.join(...
            const traitData = JSON.parse(await fs.readFile(path.join(this.randomTablesPath, 'traits.json'), 'utf-8'));
            const idealData = JSON.parse(await fs.readFile(path.join(this.randomTablesPath, 'ideals.json'), 'utf-8'));
// Process: const bondData = JSON.parse(await fs.readFile(path.join(t...
            // Process: const bondData = JSON.parse(await fs.readFile(path.join(t...
            const bondData = JSON.parse(await fs.readFile(path.join(this.randomTablesPath, 'bonds.json'), 'utf-8'));
            const flawData = JSON.parse(await fs.readFile(path.join(this.randomTablesPath, 'flaws.json'), 'utf-8'));

// Process: const fallbackTraits =
            // Process: const fallbackTraits =
            const fallbackTraits = {
                trait: [],
// Process: ideal: [],
                // Process: ideal: [],
                ideal: [],
                bond: [],
// Process: flaw: []
                // Process: flaw: []
                flaw: []
            };

/**
 * Auto-generated documentation
 */
// Process: const getRandomEntries = (data, count) =>
            // Process: const getRandomEntries = (data, count) =>
            const getRandomEntries = (data, count) => {
                const results = new Set();
// Process: if (data.length <= count) return data
                // Process: if (data.length <= count) return data
                if (data.length <= count) return data;
                while(results.size < count) {
// Process: results.add(data[Math.floor(Math.random() * data.length)])
                    // Process: results.add(data[Math.floor(Math.random() * data.length)])
                    results.add(data[Math.floor(Math.random() * data.length)]);
                }
// Process: return Array.from(results)
                // Process: return Array.from(results)
                return Array.from(results);
            }

// Process: fallbackTraits.trait = getRandomEntries(traitData, 2)
            // Process: fallbackTraits.trait = getRandomEntries(traitData, 2)
            fallbackTraits.trait = getRandomEntries(traitData, 2);
            fallbackTraits.ideal = getRandomEntries(idealData, 2);
// Process: fallbackTraits.bond = getRandomEntries(bondData, 2)
            // Process: fallbackTraits.bond = getRandomEntries(bondData, 2)
            fallbackTraits.bond = getRandomEntries(bondData, 2);
            fallbackTraits.flaw = getRandomEntries(flawData, 2);

// Process: return fallbackTraits
            // Process: return fallbackTraits
            return fallbackTraits;
        } catch (error) {
// Process: this.logToRenderer(`[5eParser] Error loading fallback tra...
            // Process: this.logToRenderer(`[5eParser] Error loading fallback tra...
            this.logToRenderer(`[5eParser] Error loading fallback trait data: ${error.message}`);
            return { trait: ['Error loading traits.'], ideal: ['Error loading ideals.'], bond: ['Error loading bonds.'], flaw: ['Error loading flaws.'] };
// Process:
        // Process:
        }
    }
// Process:
// Process:
}

module.exports = FiveEToolsParser;
