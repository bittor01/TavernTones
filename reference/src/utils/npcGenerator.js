/**
 * @file Contains the NpcGenerator class for creating detailed Non-Player Characters.
 * @author jules
 */

const { dataStore } = require('./dataLoader');
const { NameGenerator } = require('./nameGenerator');
const axios = require('axios');

/**
 * The base URL for the internal API calls made by the NPC generator.
 * @type {string}
 */
const API_BASE_URL = 'http://localhost:3000/api/oracle/v2/generate-npc';

/**
 * Converts a Challenge Rating (CR) string (e.g., "1/2", "5") into a numerical value for comparison.
 * @param {string|number} cr The CR to convert.
 * @returns {number} The numerical value of the CR.
 */
function getCrValue(cr) {
    if (cr === undefined || cr === null) return 0;
    if (cr.toString().includes('/')) {
        const parts = cr.toString().split('/');
        return parseFloat(parts[0]) / parseFloat(parts[1]);
    }
    return parseFloat(cr);
}

/**
 * A class for generating complex NPCs based on a set of options.
 * It can randomly select or use specified options for species, class, background, etc.
 */
class NpcGenerator {
    /**
     * Creates an instance of the NpcGenerator.
     * @param {object} options - The user-defined options for the NPC, such as species, class, or CR.
     */
    constructor(options) {
        this.options = options;
        this.data = {};
    }

    /**
     * Retrieves all main species from the data store.
     * @private
     * @returns {object[]} An array of species objects.
     */
    _getSpecies() {
        const raceData = dataStore.get('races') || [];
        return raceData.filter(r => !r.raceName);
    }

    /**
     * Retrieves all lineages (subraces) for a given species name.
     * @private
     * @param {string} speciesName - The name of the parent species.
     * @returns {object[]} An array of lineage objects.
     */
    _getLineages(speciesName) {
        const allRaces = dataStore.get('races') || [];
        return allRaces.filter(r => r.raceName === speciesName);
    }

    /**
     * Retrieves all main classes from the data store.
     * @private
     * @returns {object[]} An array of class objects.
     */
    _getClasses() {
        const classData = dataStore.get('classes') || [];
        return classData.filter(c => !c.className);
    }

    /**
     * Retrieves all subclasses for a given class name.
     * @private
     * @param {string} className - The name of the parent class.
     * @returns {object[]} An array of subclass objects.
     */
    _getSubclasses(className) {
        const classData = dataStore.get('classes') || [];
        return classData.filter(sc => sc.className === className);
    }

    /**
     * Retrieves all backgrounds from the data store.
     * @private
     * @returns {object[]} An array of background objects.
     */
    _getBackgrounds() {
        return dataStore.get('backgrounds') || [];
    }

    /**
     * Resolves all NPC options, either by using the provided options or by selecting randomly.
     * This method populates `this.data` with the final selections for species, class, etc.
     * @private
     */
    _resolveOptions() {
        console.log('[NPCGenerator] Resolving options:', this.options);

        // Resolve Species
        if (this.options.species) {
            this.data.species = this._getSpecies().find(s => s.name === this.options.species.name && s.source === this.options.species.source);
        } else {
            const allSpecies = this._getSpecies();
            this.data.species = allSpecies[Math.floor(Math.random() * allSpecies.length)];
        }
        if (!this.data.species) {
            this.data.species = { name: 'Unknown Species', source: 'System' };
        }

        // Resolve Lineage (if any)
        const availableLineages = this._getLineages(this.data.species.name);
        if (this.options.lineage) {
            this.data.lineage = availableLineages.find(l => l.name === this.options.lineage.name && l.source === this.options.lineage.source);
        } else if (availableLineages.length > 0) {
            this.data.lineage = availableLineages[Math.floor(Math.random() * availableLineages.length)];
        } else {
            this.data.lineage = {};
        }

        // Resolve Class
        if (this.options.class) {
            this.data.class = this._getClasses().find(c => c.name === this.options.class.name && c.source === this.options.class.source);
        } else {
            const allClasses = this._getClasses();
            this.data.class = allClasses[Math.floor(Math.random() * allClasses.length)];
        }
        if (!this.data.class) {
            this.data.class = { name: 'Unknown Class', source: 'System' };
        }

        // Resolve Subclass (if any)
        const availableSubclasses = this._getSubclasses(this.data.class.name);
        if (this.options.subclass) {
            this.data.subclass = availableSubclasses.find(sc => sc.name === this.options.subclass.name && sc.source === this.options.subclass.source);
        } else if (availableSubclasses.length > 0) {
            this.data.subclass = availableSubclasses[Math.floor(Math.random() * availableSubclasses.length)];
        } else {
            this.data.subclass = {};
        }

        // Resolve Background
        if (this.options.background) {
            this.data.background = this._getBackgrounds().find(b => b.name === this.options.background.name && b.source === this.options.background.source);
        } else {
            const allBackgrounds = this._getBackgrounds();
            this.data.background = allBackgrounds[Math.floor(Math.random() * allBackgrounds.length)];
        }
        if (!this.data.background) {
            this.data.background = { name: 'Unknown Background', source: 'System' };
        }
    }

    /**
     * Fetches NPC statblock suggestions by making an internal API call.
     * @private
     * @returns {Promise<object|null>} A promise that resolves to the statblock suggestions or null.
     */
    async _getNpcStatblock() {
        const { cr } = this.options;
        if (cr === undefined) return null;

        try {
            const response = await axios.post(`${API_BASE_URL}/generate-npc-statblock`, { cr });
            return response.data;
        } catch (error) {
            console.error('Failed to fetch NPC statblock:', error.response ? error.response.data : error.message);
            return {
                easy: { name: 'Error', cr: 'N/A' },
                medium: { name: 'Error fetching statblock', cr: cr },
                hard: { name: 'Error', cr: 'N/A' },
            };
        }
    }

    /**
     * Retrieves the lists of personality traits, ideals, bonds, and flaws.
     * @private
     * @returns {object} An object containing arrays of traits, ideals, bonds, and flaws.
     */
    _getBackgroundTraits() {
        const { background } = this.data;
        if (!background) return { trait: ['N/A'], ideal: ['N/A'], bond: ['N/A'], flaw: ['N/A'] };

        return {
            trait: dataStore.get('npc-traits') || ['N/A'],
            ideal: dataStore.get('npc-ideals') || ['N/A'],
            bond: dataStore.get('npc-bonds') || ['N/A'],
            flaw: dataStore.get('npc-flaws') || ['N/A'],
        };
    }

    /**
     * Selects a specified number of random items from an array.
     * @private
     * @param {Array<any>} arr The array to select from.
     * @param {number} num The number of items to select.
     * @returns {Array<any>} An array containing the randomly selected items.
     */
    _getRandomItems(arr, num) {
        if (!arr || arr.length === 0) return ['N/A'];
        if (arr.length <= num) return arr;
        const shuffled = [...arr].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, num);
    }

    /**
     * The main generation method. It orchestrates the entire process of resolving options,
     * fetching statblocks, generating a name, and assembling the final NPC object.
     * @returns {Promise<object>} A promise that resolves to the complete NPC object.
     */
    async generate() {
        this._resolveOptions();
        const { species, lineage, class: charClass, subclass, background } = this.data;

        let statblockSuggestions = null;
        if (this.options.mode === 'npc' && this.options.cr) {
            statblockSuggestions = await this._getNpcStatblock();
        }

        const traits = this._getBackgroundTraits();
        const nameGenerator = new NameGenerator();

        return {
            name: nameGenerator.generate(species.name),
            species,
            lineage: lineage || {},
            class: charClass,
            subclass: subclass || {},
            background,
            statblockSuggestions,
            trait: this._getRandomItems(traits.trait, 2),
            ideal: this._getRandomItems(traits.ideal, 2),
            bond: this._getRandomItems(traits.bond, 2),
            flaw: this._getRandomItems(traits.flaw, 2),
        };
    }
}

module.exports = { NpcGenerator };