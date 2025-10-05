/**
 * @file Contains the NameGenerator class for creating species-appropriate names.
 * @author jules
 */

const { dataStore } = require('./dataLoader');

/**
 * A class to generate names for characters based on their species.
 * It uses the pre-loaded name data from 5etools.
 */
class NameGenerator {
    /**
     * Initializes the NameGenerator by fetching the name data from the central data store.
     */
    constructor() {
        this.nameData = dataStore.get('names') || [];
    }

    /**
     * Selects a random element from an array.
     * @private
     * @param {Array<any>} arr The array to choose from.
     * @returns {any|null} A random element from the array, or null if the array is empty.
     */
    _getRandom(arr) {
        if (!arr || arr.length === 0) return null;
        return arr[Math.floor(Math.random() * arr.length)];
    }

    /**
     * Generates a name for a given species.
     * It attempts to find a matching name table for the species. If found, it combines a
     * first name and, if available, a last name. If no specific table is found, it falls
     * back to a random name table.
     * @param {string} speciesName The name of the species (e.g., "Elf", "Dwarf").
     * @returns {string} The generated full name (e.g., "John Doe") or a fallback "Unknown Name".
     */
    generate(speciesName) {
        console.log(`[NameGenerator] Generating name for species: "${speciesName}"`);
        // Find the correct name table, case-insensitive.
        let nameTable = this.nameData.find(nt => nt.name.toLowerCase() === speciesName.toLowerCase());

        // Fallback for species without a dedicated name table
        if (!nameTable) {
            console.log(`[NameGenerator] No specific table for "${speciesName}". Falling back to a random table.`);
            const availableTables = this.nameData.filter(nt => nt.tables && nt.tables.length > 0);
            if (availableTables.length > 0) {
                nameTable = this._getRandom(availableTables);
                console.log(`[NameGenerator] Selected random table: "${nameTable.name}"`);
            }
        }

        if (!nameTable) {
            console.error('[NameGenerator] CRITICAL: No name tables found at all.');
            return "Unknown Name";
        }

        // Separate tables into first names and last names, filtering out empty ones.
        const firstNameTables = [];
        const lastNameTables = [];
        const lastNameKeywords = ['clan', 'family', 'surname'];

        nameTable.tables.forEach(table => {
            const results = table.table.map(t => t.result);
            if (results.length === 0) return; // Skip empty tables

            const option = table.option.toLowerCase();
            const isLastNameTable = lastNameKeywords.some(keyword => option.includes(keyword));

            if (isLastNameTable) {
                lastNameTables.push(results);
            } else {
                firstNameTables.push(results);
            }
        });
        console.log(`[NameGenerator] Found ${firstNameTables.length} first name table(s) and ${lastNameTables.length} last name table(s).`);

        // A name cannot be generated without a first name table.
        if (firstNameTables.length === 0) {
            console.error(`[NameGenerator] CRITICAL: No valid first name tables found for "${nameTable.name}".`);
            return "Unknown Name";
        }

        // Randomly select one of the first name tables, then a name from it.
        const selectedFirstNameTable = this._getRandom(firstNameTables);
        const firstName = this._getRandom(selectedFirstNameTable);

        if (!firstName) {
            console.error('[NameGenerator] CRITICAL: Selected first name table was empty or failed to produce a name.');
            return "Unknown Name";
        }
        console.log(`[NameGenerator] Selected first name: "${firstName}"`);

        // If last name tables are available, randomly select one and get a name.
        if (lastNameTables.length > 0) {
            const selectedLastNameTable = this._getRandom(lastNameTables);
            const lastName = this._getRandom(selectedLastNameTable);
            if (lastName) {
                console.log(`[NameGenerator] Selected last name: "${lastName}"`);
                return `${firstName} ${lastName}`;
            }
        }

        // If no last name is available or selected, just return the first name.
        return firstName;
    }
}

module.exports = { NameGenerator };