/**
 * @file Manages loading all 5etools data from JSON files into memory.
 * This module is responsible for reading data from the file system, parsing it,
 * and storing it in a structured way for the rest of the application to use.
 * @author jules
 */

const fs = require('fs').promises;
const path = require('path');

/**
 * The absolute path to the 5etools data directory.
 * It points to `mock-data` in a test environment and to a Docker volume path otherwise.
 * @type {string}
 */
const dataPath = process.env.NODE_ENV === 'test'
    ? path.resolve(process.cwd(), 'mock-data')
    : path.resolve('/usr/src/app/resources/5etoolsdata');

/**
 * A configuration object that maps data categories to their source files or directories.
 * - `type`: 'file' or 'directory'.
 * - `path`: The relative path within the `dataPath`.
 * - `key`: The key(s) within the JSON file that contain the array of data.
 * @type {Object.<string, {type: string, path: string, key: string|string[]}>}
 */
const categorySources = {
    'spells': { type: 'directory', path: 'spells', key: 'spell' },
    'items': { type: 'file', path: 'items.json', key: 'item' },
    'classes': { type: 'directory', path: 'class', key: ['class', 'subclass'] },
    'bestiary': { type: 'directory', path: 'bestiary', key: 'monster' },
    'feats': { type: 'file', path: 'feats.json', key: 'feat' },
    'backgrounds': { type: 'file', path: 'backgrounds.json', key: 'background' },
    'races': { type: 'file', path: 'races.json', key: ['race', 'subrace'] },
    'traps': { type: 'file', path: 'trapshazards.json', key: ['trap', 'hazard'] },
    'vehicles': { type: 'file', path: 'vehicles.json', key: 'vehicle' },
    'names': { type: 'file', path: 'names.json', key: 'name' },
};

/**
 * An array of all searchable category names, derived from `categorySources`.
 * @type {string[]}
 */
const searchableCategories = Object.keys(categorySources);

/**
 * A Map that holds all loaded 5etools data, keyed by category name.
 * The values are arrays of data objects.
 * @type {Map<string, Object[]>}
 */
const dataStore = new Map();

/**
 * A Map that holds all loaded monster templates, keyed by template name.
 * @type {Map<string, Object>}
 */
const templateStore = new Map();

/**
 * A flag to ensure data is only loaded once.
 * @type {boolean}
 */
let isDataLoaded = false;

/**
 * Loads all 5etools data from the source files into the `dataStore`.
 * It iterates through `categorySources`, reads the corresponding files/directories,
 * processes the JSON, and populates the in-memory store. It also triggers the loading
 * of auxiliary data like templates and NPC traits. This function is designed to be
 * called once at application startup.
 * @returns {Promise<void>} A promise that resolves when all data is loaded.
 */
async function loadData() {
    if (isDataLoaded) {
        console.log('Data already loaded. Skipping.');
        return;
    }
    console.log('Loading 5etools data into memory...');
    for (const category of searchableCategories) {
        const sourceInfo = categorySources[category];
        const itemMap = new Map();
        const categoryCounts = {};

        const processJsonData = (jsonData) => {
            const dataKeys = Array.isArray(sourceInfo.key) ? sourceInfo.key : [sourceInfo.key];
            for (const dataKey of dataKeys) {
                if (jsonData[dataKey] && Array.isArray(jsonData[dataKey])) {
                    if (!categoryCounts[dataKey]) {
                        categoryCounts[dataKey] = 0;
                    }
                    for (const item of jsonData[dataKey]) {
                        if (item.name && item.source) {
                            const uniqueKey = `${item.name}|${item.source}`;
                            if (!itemMap.has(uniqueKey)) {
                                if (category === 'traps') {
                                    if (item.trapHazType) {
                                        item._type = item.trapHazType.toUpperCase();
                                    } else if (dataKey === 'trap' || dataKey === 'hazard') {
                                        item._type = dataKey.toUpperCase();
                                    }
                                }
                                itemMap.set(uniqueKey, item);
                            }
                        }
                    }
                    if (!categoryCounts[dataKey]) {
                        categoryCounts[dataKey] = 0;
                    }
                    categoryCounts[dataKey] += jsonData[dataKey].length;
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
            dataStore.set(category, allItems);

            // Log the total count for the category
            console.log(`[DataLoader] Loaded ${allItems.length} total items for category: ${category}`);
            // Log the count for each sub-key
            for (const [key, count] of Object.entries(categoryCounts)) {
                console.log(`  - ${key}: ${count}`);
            }


        } catch (error) {
            // If a mock file doesn't exist, log it but don't crash the server.
            if (error.code === 'ENOENT') {
                console.warn(`[DataLoader] Mock data file or directory not found for category '${category}'. Skipping.`);
            } else {
                console.error(`[DataLoader] Error loading data for category ${category}: ${error.message}`);
            }
            // Ensure the category exists in the map, even if loading failed.
            if (!dataStore.has(category)) {
                dataStore.set(category, []);
            }
        }
    }
    console.log('Data loading complete.');
    await loadCustomSpellData(); // Load the special spell data
    await loadTemplates(); // Load monster templates
    await loadNpcTraits(); // Load NPC trait data
    isDataLoaded = true;
}

/**
 * Loads pre-processed NPC trait data (ideals, bonds, flaws, etc.) into the `dataStore`.
 * This data is generated by the `example/extract_background_data.js` script and is
 * essential for the NPC generator.
 * @returns {Promise<void>} A promise that resolves when the data is loaded.
 */
async function loadNpcTraits() {
    const traitDataPath = path.resolve('randomtables', 'origin');
    console.log(`Loading NPC trait data from ${traitDataPath}...`);
    const traitFiles = {
        'npc-traits': 'traits.json',
        'npc-ideals': 'ideals.json',
        'npc-bonds': 'bonds.json',
        'npc-flaws': 'flaws.json',
    };

    try {
        for (const [key, fileName] of Object.entries(traitFiles)) {
            const filePath = path.join(traitDataPath, fileName);
            const fileContent = await fs.readFile(filePath, 'utf8');
            const jsonData = JSON.parse(fileContent);
            dataStore.set(key, jsonData);
            console.log(`[DataLoader] Loaded ${jsonData.length} items for ${key}.`);
        }
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.error(`[DataLoader] FATAL: NPC trait file not found at '${error.path}'. Make sure to run the 'extract_background_data.js' script first.`);
            // In a real app, you might want to exit here if this data is critical
        } else {
            console.error(`[DataLoader] Error loading NPC trait data: ${error.message}`);
        }
    }
}

/**
 * Loads custom spell data, categorized by level, into the `dataStore`.
 * This data is used specifically for the random item/shop generators.
 * @returns {Promise<void>} A promise that resolves when the data is loaded.
 */
async function loadCustomSpellData() {
    // This path is now absolute from the project root, making it work inside Docker
    const spellDataPath = path.resolve('resources', 'randomtables', 'spells');
    console.log(`Loading custom spell data from ${spellDataPath}...`);
    try {
        const files = await fs.readdir(spellDataPath);
        for (const file of files) {
            if (file.startsWith('lvl') && file.endsWith('.json')) {
                const level = file.match(/lvl(\d+)/)[1];
                const key = `spells-lvl${level}`;
                const filePath = path.join(spellDataPath, file);
                const fileContent = await fs.readFile(filePath, 'utf8');
                const jsonData = JSON.parse(fileContent);
                dataStore.set(key, jsonData);
                console.log(`[DataLoader] Loaded ${jsonData.length} items for custom spell level: ${level}`);
            }
        }
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.warn(`[DataLoader] Custom spell directory not found at '${spellDataPath}'. This is normal if not using the custom item generator.`);
        } else {
            console.error(`[DataLoader] Error loading custom spell data: ${error.message}`);
        }
    }
}

/**
 * Loads monster templates from the bestiary data into the `templateStore`.
 * These templates are used to apply modifications to base monster stat blocks.
 * @returns {Promise<void>} A promise that resolves when the templates are loaded.
 */
async function loadTemplates() {
    const templatePath = path.join(dataPath, 'bestiary', 'template.json');
    try {
        const fileContent = await fs.readFile(templatePath, 'utf8');
        const jsonData = JSON.parse(fileContent);
        if (jsonData.monsterTemplate) {
            for (const template of jsonData.monsterTemplate) {
                templateStore.set(template.name, template);
            }
            console.log(`[DataLoader] Loaded ${templateStore.size} monster templates.`);
        }
    } catch (error) {
        console.error(`[DataLoader] Could not load monster templates: ${error.message}`);
    }
}

module.exports = {
    loadData,
    dataStore,
    templateStore,
    searchableCategories
};
