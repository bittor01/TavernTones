/**
 * @file Utility functions for processing and enriching 5etools data.
 * This includes resolving `_copy` entries, applying monster templates, and calculating derived stats.
 * @author jules
 */

const { templateStore } = require('./dataLoader');
const { CR_TO_XP } = require('./constants');

/**
 * Calculates the ability modifier for a given ability score.
 * The formula is `floor((score - 10) / 2)`.
 * @param {number} score The ability score (e.g., 14).
 * @returns {string} The modifier as a signed string (e.g., "+2", "-1"). Returns "+0" if the score is invalid.
 */
const getMod = (score) => {
    if (score === undefined || isNaN(score)) return '+0';
    const mod = Math.floor((score - 10) / 2);
    return mod >= 0 ? `+${mod}` : `${mod}`;
};

/**
 * Enriches a monster object with calculated fields.
 * This adds ability modifiers (e.g., `strMod`) and the monster's XP value based on its CR.
 * @param {object} monster The raw monster object from the data files.
 * @returns {object} The monster object with added `strMod`, `dexMod`, `conMod`, etc., and `xp` fields.
 */
function processMonsterData(monster) {
    const enrichedMonster = { ...monster };

    // Add ability modifiers
    if (enrichedMonster.str) enrichedMonster.strMod = getMod(enrichedMonster.str);
    if (enrichedMonster.dex) enrichedMonster.dexMod = getMod(enrichedMonster.dex);
    if (enrichedMonster.con) enrichedMonster.conMod = getMod(enrichedMonster.con);
    if (enrichedMonster.int) enrichedMonster.intMod = getMod(enrichedMonster.int);
    if (enrichedMonster.wis) enrichedMonster.wisMod = getMod(enrichedMonster.wis);
    if (enrichedMonster.cha) enrichedMonster.chaMod = getMod(enrichedMonster.cha);

    // Add XP from CR
    if (enrichedMonster.cr) {
        const crValue = typeof enrichedMonster.cr === 'object' ? enrichedMonster.cr.cr : enrichedMonster.cr;
        if (CR_TO_XP[crValue]) {
            enrichedMonster.xp = CR_TO_XP[crValue].toLocaleString();
        }
    }

    return enrichedMonster;
}


/**
 * Applies a monster template to a base monster object.
 * This function handles the `_mod` instructions within a template, such as appending
 * traits, actions, or other properties to the base monster.
 * @param {object} monster The base monster object to modify.
 * @param {object} template The template object to apply.
 * @returns {object} A new monster object with the template's modifications applied.
 */
function applyTemplate(monster, template) {
    const newMonster = { ...monster };

    if (template.apply && template.apply._mod) {
        for (const key in template.apply._mod) {
            const mods = template.apply._mod[key];
            if (Array.isArray(mods)) {
                for (const mod of mods) {
                    if (mod.mode === 'appendArr' && Array.isArray(mod.items)) {
                        newMonster[key] = (newMonster[key] || []).concat(mod.items);
                    }
                }
            }
        }
    }

    // A special case for the Dracolich template to change the monster's type to "undead".
    if (template.apply && template.apply._root && template.apply._root.type) {
        newMonster.type = template.apply._root.type.type;
    }

    return newMonster;
}


/**
 * Recursively resolves a `_copy` entry by merging it with its base item and applying any templates.
 * Many 5etools entries are defined as a `_copy` of a base entry with modifications. This function
 * finds the base item, applies any specified templates (e.g., for a "Zombie Beast"), and then
 * merges the modifications from the `_copy` entry itself.
 * @param {object} item The item to process, which may have a `_copy` property.
 * @param {string} category The category of the item (e.g., 'bestiary'), used for lookups.
 * @param {Map<string, Array<object>>} dataStore The complete data store for finding base items.
 * @returns {object} A fully resolved data object with all inherited and modified properties.
 */
function resolveCopy(item, category, dataStore) {
    let resolvedItem = item;

    // If the item is a copy, resolve it by merging with its base.
    if (item._copy && dataStore) {
        const baseItems = dataStore.get(category);
        if (baseItems) {
            const baseItem = baseItems.find(i => i.name === item._copy.name && i.source === item._copy.source);

            if (baseItem) {
                // Recursively resolve the base item first in case it is also a copy.
                let resolvedBase = resolveCopy(baseItem, category, dataStore);

                // Apply templates to the resolved base.
                if (item._copy._templates) {
                    for (const templateInfo of item._copy._templates) {
                        const template = templateStore.get(templateInfo.name);
                        if (template) {
                            resolvedBase = applyTemplate(resolvedBase, template);
                        }
                    }
                }

                // Merge the copy's modifications onto the templated base.
                const { _copy, ...mods } = item;
                const mergedItem = { ...resolvedBase };
                for (const key in mods) {
                    // Deep merge for arrays, shallow for others.
                    if (Array.isArray(mods[key]) && Array.isArray(mergedItem[key])) {
                        mergedItem[key] = mergedItem[key].concat(mods[key]);
                    } else {
                        mergedItem[key] = mods[key];
                    }
                }
                resolvedItem = mergedItem;
            }
        }
    }

    // After any copying and templating, process the final item if it's a monster
    // to add calculated fields like ability mods and XP.
    if (category === 'bestiary') {
        return processMonsterData(resolvedItem);
    }

    return resolvedItem;
}

module.exports = {
    resolveCopy,
};