// Performance and security update
// Use the promise-based version of the filesystem module for cleaner async/await code
const fs = require('fs').promises;
// Import the path module to resolve file and directory locations consistently across platforms
const path = require('path');

// Configuration for various 5e data categories, defining their storage type, path, and JSON keys
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
// Array of keys derived from categorySources for iteration and validation
const searchableCategories = Object.keys(categorySources);

/**
 * FiveEToolsParser handles loading, caching, and searching of D&D 5e data
 * following the 5eTools JSON schema format.
 */
class FiveEToolsParser {
    /**
     * Initializes the parser with logging capabilities and directory paths.
     */
    constructor(logToRenderer, app, config) {
        // Store a reference to the logging function for communication with the UI
        this.logToRenderer = logToRenderer;

        // Check if essential paths are configured; if not, the parser cannot operate
        if (!config || !config.bestiaryPath || !config.randomTablesPath) {
            this.logToRenderer('[5eParser] ERROR: Configuration with folder paths not provided. Parser will not function.');
            this.bestiaryPath = '';
            this.randomTablesPath = '';
            this.cache = new Map();
            return;
        }

        // Store the bestiary directory path
        this.bestiaryPath = config.bestiaryPath;
        // Construct the origin tables path within the random tables directory
        this.randomTablesPath = path.join(config.randomTablesPath, 'origin');
        // Initialize an in-memory cache to store loaded JSON data and speed up searches
        this.cache = new Map();
    }

    /**
     * Loads all JSON data from a category source (file or directory).
     * Caches the data and de-duplicates items based on name and source.
     * @param {string} category The category to load (e.g., 'spells', 'items').
     * @returns {Promise<Array>} Resolves to an array of all items in that category.
     */
    async _loadCategoryData(category) {
        // Return cached data immediately if available to save time and I/O
        if (this.cache.has(category)) {
            return this.cache.get(category);
        }

        // Verify that the requested category is known to the system
        const sourceInfo = categorySources[category];
        if (!sourceInfo) {
            this.logToRenderer(`[5eParser] Unknown category: ${category}`);
            return [];
        }

        // Limitation: Current implementation only officially supports the 'bestiary' category
        if (category !== 'bestiary') {
            this.logToRenderer(`[5eParser] Category ${category} is not supported in this version.`);
            return [];
        }

        // Map to hold unique items, preventing duplicates if multiple files contain the same monster
        const itemMap = new Map();

        // Helper to process a JSON object and extract items based on the category's keys
        const processJsonData = (jsonData) => {
            // Keys can be a single string or an array of strings
            const dataKeys = Array.isArray(sourceInfo.key) ? sourceInfo.key : [sourceInfo.key];
            for (const dataKey of dataKeys) {
                // Check if the expected key exists and contains an array of items
                if (jsonData[dataKey] && Array.isArray(jsonData[dataKey])) {
                    for (const item of jsonData[dataKey]) {
                        // Ensure the item has identifying properties before caching
                        if (item.name && item.source) {
                            const uniqueKey = `${item.name}__${item.source}`;
                            itemMap.set(uniqueKey, item);
                        }
                    }
                }
            }
        };

        try {
            // If the source is a directory, iterate through every JSON file inside it
            if (sourceInfo.type === 'directory') {
                const files = await fs.readdir(this.bestiaryPath);
                for (const file of files) {
                    // Only process files with the .json extension
                    if (path.extname(file) === '.json') {
                        const filePath = path.join(this.bestiaryPath, file);
                        const fileContent = await fs.readFile(filePath, 'utf8');
                        // Parse file content and extract items
                        processJsonData(JSON.parse(fileContent));
                    }
                }
            }

            // Convert the unique item map into a flat array for easier searching
            const allItems = Array.from(itemMap.values());
            // Store the result in the cache for future requests
            this.cache.set(category, allItems);
            this.logToRenderer(`[5eParser] Loaded and cached ${allItems.length} de-duplicated items for category: ${category}`);
            return allItems;
        } catch (error) {
            // Log any filesystem or parsing errors to the renderer
            this.logToRenderer(`[5eParser] Error loading data for category ${category}: ${error.message}`);
            return [];
        }
    }

    /**
     * Searches for items in a category where the name includes the query string.
     * @param {string} category Category to search in.
     * @param {string} query Search term.
     * @returns {Promise<Array>} List of matching items.
     */
    async searchByName(category, query) {
        // Guard against searching categories that aren't defined
        if (!searchableCategories.includes(category)) {
            this.logToRenderer(`[5eParser] Attempted to search non-searchable category: ${category}`);
            return [];
        }

        // Ensure category data is loaded and cached
        const items = await this._loadCategoryData(category);
        const lowerCaseQuery = query.toLowerCase();

        // Filter items where the name contains the query (case-insensitive)
        const results = items.filter(item => item.name && item.name.toLowerCase().includes(lowerCaseQuery));

        // Return clones of the items with the category property attached for context
        return results.map(item => ({ ...item, category: category }));
    }

    /**
     * Searches across ALL valid categories for a specific name query.
     * @param {string} query Search term.
     * @returns {Promise<Array>} Combined results from all categories.
     */
    async searchAllByName(query) {
        let allResults = [];
        // Iterate through each category and collect matches
        for (const category of searchableCategories) {
            const results = await this.searchByName(category, query);
            allResults = allResults.concat(results);
        }
        return allResults;
    }

    /**
     * Recursively converts nested 'entries' objects/arrays into a single flat string.
     * Useful for full-text search within monster abilities or spell descriptions.
     * @param {any} entries The entries to flatten.
     * @returns {string} Flattened string of text content.
     */
    _flattenEntries(entries) {
        // Return simple strings as-is
        if (typeof entries === 'string') {
            return entries;
        }
        // If it's an array, flatten each element and join with spaces
        if (Array.isArray(entries)) {
            return entries.map(e => this._flattenEntries(e)).join(' ');
        }
        // If it's an object, check common text-holding properties
        if (typeof entries === 'object' && entries !== null) {
            let content = '';
            // Add the name (title) of the entry if it exists
            if (entries.name) content += entries.name + ' ';
            // Recursively add nested entries
            if (entries.entries) content += this._flattenEntries(entries.entries);
            // Recursively add nested list items
            if (entries.items) content += this._flattenEntries(entries.items);
            return content;
        }
        return '';
    }

    /**
     * Searches for a term within both names and text content across all categories.
     * @param {string} query Search term.
     * @returns {Promise<Array>} List of items that match in name or content.
     */
    async searchByContent(query) {
        const lowerCaseQuery = query.toLowerCase();
        let allResults = [];

        // Scan every category one by one
        for (const category of searchableCategories) {
            const items = await this._loadCategoryData(category);
            const results = items.filter(item => {
                // Items must have a name to be valid
                if (!item.name) return false;

                // Check for a match in the name first (fastest)
                if (item.name.toLowerCase().includes(lowerCaseQuery)) {
                    return true;
                }

                // If no name match, flatten the description entries and search within them
                if (item.entries) {
                    const content = this._flattenEntries(item.entries).toLowerCase();
                    if (content.includes(lowerCaseQuery)) {
                        return true;
                    }
                }
                return false;
            });
            // Merge matching items into the master result list
            allResults = allResults.concat(results.map(item => ({ ...item, category: category })));
        }
        return allResults;
    }

    /**
     * Retrieves a single specific item based on name and book source.
     */
    async getExact(category, name, source) {
        const items = await this._loadCategoryData(category);
        // Look for the item that matches both name and source exactly
        const item = items.find(i => i.name === name && i.source === source);
        if (item) {
            return { ...item, category: category };
        }
        return null;
    }

    /**
     * Searches for monsters in the bestiary by their creature type (e.g., 'dragon', 'undead').
     */
    async searchByType(type) {
        const items = await this._loadCategoryData('bestiary');
        const lowerCaseType = type.toLowerCase();

        const results = items.filter(item => {
            if (!item.type) return false;
            // Handle both simple string types and complex type objects
            const itemType = typeof item.type === 'object' ? item.type.type : item.type;
            return itemType.toLowerCase() === lowerCaseType;
        });

        return results.map(item => ({ ...item, category: 'bestiary' }));
    }

    /**
     * Clears cached data for a specific category to force a reload from disk.
     */
    clearCache(category) {
        if (this.cache.has(category)) {
            this.cache.delete(category);
            this.logToRenderer(`[5eParser] Cleared cache for category: ${category}`);
        }
    }

    /**
     * Randomly picks a trap from the database that matches specified criteria.
     */
    async generateTrap({ tier, threat, type, environment }) {
        let traps = await this._loadCategoryData('traps');

        // Filter by Tier if specified
        if (tier && tier !== 'random') {
            traps = traps.filter(t => t.rating && t.rating.some(r => r.tier === parseInt(tier, 10)));
        }
        // Filter by Threat level (Minor, Moderate, etc.)
        if (threat && threat !== 'random') {
            traps = traps.filter(t => t.rating && t.rating.some(r => r.threat.toLowerCase() === threat.toLowerCase()));
        }
        // Filter by Trap/Hazard type
        if (type && type !== 'random') {
            traps = traps.filter(t => t.trapHazType === type);
        }
        // Filter by environment using keywords found in the description text
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
                // Stringify the whole entry block to search for environmental keywords
                traps = traps.filter(t => regex.test(JSON.stringify(t.entries)));
            }
        }

        // Return null if no traps meet all the selected criteria
        if (traps.length === 0) {
            return null;
        }

        // Return a single random entry from the filtered list
        return traps[Math.floor(Math.random() * traps.length)];
    }

    /**
     * Retrieves all base species (races) from the race data.
     */
    async getSpecies() {
        const raceData = await this._loadCategoryData('races');
        // Filter out subraces by ensuring 'raceName' is absent
        return raceData.filter(r => !r.raceName);
    }

    /**
     * Retrieves lineages or subraces associated with a specific species.
     */
    async getLineages(speciesName, speciesSource) {
        const allRaces = await this._loadCategoryData('races');

        // Find standard subraces that explicitly reference the parent race name
        const standardLineages = allRaces.filter(r => r.raceName === speciesName);

        // Handle XPHB-style data where lineages are listed in a table within the base race entry
        const inlineLineages = [];
        const baseRace = allRaces.find(r => r.name === speciesName && r.source === speciesSource);

        if (baseRace && baseRace.entries) {
            // Look for an entry section specifically titled "Lineage"
            const lineageEntry = baseRace.entries.find(e => e.name && e.name.includes("Lineage"));
            if (lineageEntry && lineageEntry.entries) {
                // Find the table within that section that lists the lineage names
                const lineageTable = lineageEntry.entries.find(e => e.type === "table" && e.caption && e.caption.includes("Lineages"));
                if (lineageTable && lineageTable.rows) {
                    for (const row of lineageTable.rows) {
                        const lineageName = row[0];
                        // Create a synthetic object so these inline options appear as selectable subraces
                        inlineLineages.push({
                            name: lineageName,
                            source: speciesSource,
                            raceName: speciesName,
                            raceSource: speciesSource,
                        });
                    }
                }
            }
        }

        // Return both standard and inline discovered lineages
        return [...standardLineages, ...inlineLineages];
    }

    /**
     * Retrieves all base character classes.
     */
    async getClasses() {
        const classData = await this._loadCategoryData('classes');
        // Filter out subclasses by ensuring 'className' is absent
        return classData.filter(c => !c.className);
    }

    /**
     * Retrieves subclasses for a specific parent class.
     */
    async getSubclasses(className, classSource) {
        const classData = await this._loadCategoryData('classes');
        // Return entries that point to the parent class name
        return classData.filter(sc => sc.className === className);
    }

    /**
     * Loads and returns all character background data.
     */
    async getBackgrounds() {
        return await this._loadCategoryData('backgrounds');
    }

    /**
     * Finds or falls back to random personality traits, ideals, bonds, and flaws for a background.
     */
    async getBackgroundTraits(backgroundName, backgroundSource) {
        const backgrounds = await this._loadCategoryData('backgrounds');

        // Helper to find characteristic tables, handling inheritance and reprints
        const findTraitsRecursive = (bg) => {
            if (!bg) return null;

            // Handle backgrounds that copy data from another source entry
            if (bg._copy && bg._copy.name && bg._copy.source) {
                const originalBg = backgrounds.find(b => b.name === bg._copy.name && b.source === bg._copy.source);
                if (originalBg) return findTraitsRecursive(originalBg);
            }

            // Handle backgrounds that are reprints of an older version
            if (!bg.entries || !bg.entries.some(e => e.name === "Suggested Characteristics")) {
                const originalBg = backgrounds.find(b => b.reprintedAs && b.reprintedAs.includes(`${bg.name}|${bg.source}`));
                if (originalBg) return findTraitsRecursive(originalBg);
            }

            if (!bg.entries) return null;

            // Look for the "Suggested Characteristics" section
            let characteristicsEntry = bg.entries.find(e => e.name === "Suggested Characteristics" && e.type === "entries");

            // Fallback for Ravenloft (VRGR) style section naming
            if (!characteristicsEntry) {
                characteristicsEntry = bg.entries.find(e => e.name === "Horror Characteristics" && e.type === "section");
            }

            if (!characteristicsEntry || !characteristicsEntry.entries) return null;

            const traits = { trait: [], ideal: [], bond: [], flaw: [] };
            const traitTypes = ["Personality Trait", "Ideal", "Bond", "Flaw"];

            // Extract two random options for each of the four characteristic types
            for (const traitType of traitTypes) {
                const lookupKey = traitType === "Personality Trait" ? "trait" : traitType.toLowerCase();
                // Find the table that matches the trait type (usually by checking the caption or column headers)
                const table = characteristicsEntry.entries.find(e => {
                    if (e.type !== "table") return false;
                    const caption = e.caption || (e.colLabels && e.colLabels.length > 1 ? e.colLabels[1] : '');
                    return caption.toLowerCase().includes(lookupKey);
                });

                if (table && table.rows && table.rows.length > 0) {
                    // Helper to clean up 5eTools tags from the trait text
                    const getTraitText = (rawTrait) => {
                        let text = `No trait text found for ${traitType}.`;
                        if (typeof rawTrait === 'object' && rawTrait && rawTrait.entry) text = rawTrait.entry;
                        else if (typeof rawTrait === 'string') text = rawTrait;
                        else if (rawTrait) text = JSON.stringify(rawTrait);
                        return text.replace(/\{@.*?\|(.*?)\}/g, '$1').replace(/\{@.*? (.*?)\}/g, '$1');
                    };

                    // Pick the first random trait
                    const firstIndex = Math.floor(Math.random() * table.rows.length);
                    traits[lookupKey].push(getTraitText(table.rows[firstIndex][1]));

                    // Pick a second, different trait if available
                    if (table.rows.length > 1) {
                        let secondIndex;
                        do {
                            secondIndex = Math.floor(Math.random() * table.rows.length);
                        } while (secondIndex === firstIndex);
                        traits[lookupKey].push(getTraitText(table.rows[secondIndex][1]));
                    } else {
                        // Fallback if only one trait exists in the table
                        traits[lookupKey].push(getTraitText(table.rows[firstIndex][1]));
                    }
                } else {
                    // If any table is missing, return null to trigger the global fallback
                    return null;
                }
            }
            return traits;
        };

        // Attempt to find the background and extract its specific traits
        const background = backgrounds.find(b => b.name === backgroundName && b.source === backgroundSource);
        let foundTraits = findTraitsRecursive(background);

        // Return specific traits if found
        if (foundTraits) return foundTraits;

        // Fallback: If the background has no tables, use generic global trait files
        this.logToRenderer(`[5eParser] Could not find traits for background: ${backgroundName} [${backgroundSource}]. Using fallback tables.`);

        try {
            // Load generic fallback data from the random tables folder
            const traitData = JSON.parse(await fs.readFile(path.join(this.randomTablesPath, 'traits.json'), 'utf-8'));
            const idealData = JSON.parse(await fs.readFile(path.join(this.randomTablesPath, 'ideals.json'), 'utf-8'));
            const bondData = JSON.parse(await fs.readFile(path.join(this.randomTablesPath, 'bonds.json'), 'utf-8'));
            const flawData = JSON.parse(await fs.readFile(path.join(this.randomTablesPath, 'flaws.json'), 'utf-8'));

            const fallbackTraits = { trait: [], ideal: [], bond: [], flaw: [] };

            // Helper to pick N unique random entries from an array
            const getRandomEntries = (data, count) => {
                const results = new Set();
                if (data.length <= count) return data;
                while(results.size < count) {
                    results.add(data[Math.floor(Math.random() * data.length)]);
                }
                return Array.from(results);
            }

            // Fill the results with random generic traits
            fallbackTraits.trait = getRandomEntries(traitData, 2);
            fallbackTraits.ideal = getRandomEntries(idealData, 2);
            fallbackTraits.bond = getRandomEntries(bondData, 2);
            fallbackTraits.flaw = getRandomEntries(flawData, 2);

            return fallbackTraits;
        } catch (error) {
            // Return error messages if even the fallback files fail to load
            this.logToRenderer(`[5eParser] Error loading fallback trait data: ${error.message}`);
            return { trait: ['Error loading traits.'], ideal: ['Error loading ideals.'], bond: ['Error loading bonds.'], flaw: ['Error loading flaws.'] };
        }
    }
}

// Export the parser for use in the main Electron process
module.exports = FiveEToolsParser;
