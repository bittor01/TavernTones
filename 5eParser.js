const fs = require('fs').promises;
const path = require('path');

const dataPath = path.join(__dirname, 'reference', '5etoolsdata');
const categorySources = {
    'spells': { type: 'directory', path: 'spells', key: 'spell' },
    'items': { type: 'file', path: 'items.json', key: 'item' },
    'classes': { type: 'directory', path: 'class', key: 'class' },
    'bestiary': { type: 'directory', path: 'bestiary', key: 'monster' },
    'feats': { type: 'file', path: 'feats.json', key: 'feat' },
    'backgrounds': { type: 'file', path: 'backgrounds.json', key: 'background' },
    'races': { type: 'file', path: 'races.json', key: 'race' },
    'traps': { type: 'file', path: 'trapshazards.json', key: 'trap' },
    'vehicles': { type: 'file', path: 'vehicles.json', key: 'vehicle' },
};
const searchableCategories = Object.keys(categorySources);

class FiveEToolsParser {
    constructor(logToRenderer) {
        this.logToRenderer = logToRenderer;
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
            const dataKey = sourceInfo.key;
            if (jsonData[dataKey] && Array.isArray(jsonData[dataKey])) {
                for (const item of jsonData[dataKey]) {
                    if (item.name && item.source) {
                        const uniqueKey = `${item.name}__${item.source}`;
                        itemMap.set(uniqueKey, item);
                    }
                }
            }
        };

        try {
            if (sourceInfo.type === 'directory') {
                const categoryPath = path.join(dataPath, sourceInfo.path);
                const files = await fs.readdir(categoryPath);
                for (const file of files) {
                    if (path.extname(file) === '.json') {
                        const filePath = path.join(categoryPath, file);
                        const fileContent = await fs.readFile(filePath, 'utf8');
                        processJsonData(JSON.parse(fileContent));
                    }
                }
            } else { // type === 'file'
                const filePath = path.join(dataPath, sourceInfo.path);
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
        const raceData = await this._loadCategoryData('races');
        const lineages = [];

        // Find the base species to check its _versions array
        const baseSpecies = raceData.find(r => r.name === speciesName && r.source === speciesSource);
        if (baseSpecies && baseSpecies._versions) {
            lineages.push(...baseSpecies._versions);
        }

        // Find all subraces that point to this species
        const subraces = raceData.filter(r => r.raceName === speciesName && r.raceSource === speciesSource);
        lineages.push(...subraces);

        return lineages;
    }

    async getClasses() {
        const classes = await this._loadCategoryData('classes');
        // Filter out any entries that are actually subclasses, identified by having a `className` property.
        return classes.filter(c => !c.className && c.name !== 'Sidekick');
    }

    async getSubclasses(className, classSource) {
        const classData = await this._loadCategoryData('classes');
        // Find all subclasses that belong to the specified base class.
        return classData.filter(sc => sc.className === className && sc.classSource === classSource);
    }
}

module.exports = FiveEToolsParser;
