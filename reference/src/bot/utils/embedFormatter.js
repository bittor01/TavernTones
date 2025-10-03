/**
 * @file A suite of functions for formatting 5etools data into rich Discord embeds.
 * This module is responsible for the presentation layer of the bot's responses.
 * @author jules
 */

const { EmbedBuilder } = require('discord.js');
const { EMBED_COLORS } = require('./embedColors');
const { splitText } = require('../../utils/textUtils');

/**
 * Adds a field to an embed, but only if the value is not null or undefined.
 * Automatically splits long values into multiple fields to respect Discord's character limit.
 * @private
 * @param {EmbedBuilder} embed The embed to add the field to.
 * @param {string} name The name of the field.
 * @param {string} value The value of the field.
 * @param {boolean} [inline=false] Whether the field should be displayed inline.
 */
function addFieldIfPresent(embed, name, value, inline = false) {
    if (!value || typeof value !== 'string') return;

    const chunks = splitText(value);
    if (chunks.length === 1) {
        embed.addFields({ name, value: chunks[0], inline });
    } else {
        chunks.forEach((chunk, index) => {
            const fieldName = `${name} (Part ${index + 1}/${chunks.length})`;
            embed.addFields({ name: fieldName, value: chunk, inline });
        });
    }
}

/**
 * Formats a spell's components object into a human-readable string.
 * @private
 * @param {object} components - The components object (e.g., `{v: true, s: true, m: "a feather"}`).
 * @returns {string} The formatted string (e.g., "V, S, M (a feather)").
 */
function formatComponents(components) {
    if (!components) return 'None';
    let parts = [];
    if (components.v) parts.push('V');
    if (components.s) parts.push('S');
    if (components.m) {
        let material = typeof components.m === 'string' ? components.m : components.m.text;
        parts.push(`M (${material})`);
    }
    return parts.join(', ');
}

/**
 * Formats a spell's duration array into a human-readable string.
 * @private
 * @param {Array<object>} duration - The duration array from the spell data.
 * @returns {string} The formatted duration (e.g., "1 minute (Concentration)").
 */
function formatDuration(duration) {
    if (!duration || duration.length === 0) return 'N/A';
    const dur = duration[0];
    if (dur.type === 'instant') return 'Instantaneous';
    if (dur.type === 'permanent') return 'Until dispelled';
    if (dur.type === 'timed') {
        let text = `${dur.duration.amount} ${dur.duration.type}(s)`;
        if (dur.concentration) text += ' (Concentration)';
        return text;
    }
    return 'Special';
}

/**
 * Formats a spell's range object into a human-readable string.
 * @private
 * @param {object} range - The range object from the spell data.
 * @returns {string} The formatted range (e.g., "60 feet", "Self").
 */
function formatRange(range) {
    if (!range) return 'N/A';
    if (range.type === 'point') {
        if (range.distance.type === 'self') return 'Self';
        return `${range.distance.amount} ${range.distance.type}`;
    }
    if (range.type === 'radius' || range.type === 'sphere' || range.type === 'hemisphere' || range.type === 'cone' || range.type === 'line' || range.type === 'cube') {
        return `${range.distance.amount}-${range.distance.type} ${range.type}`;
    }
    return 'Special';
}

/**
 * Formats a spell's casting time array into a human-readable string.
 * @private
 * @param {Array<object>} time - The casting time array from the spell data.
 * @returns {string} The formatted time (e.g., "1 action").
 */
function formatTime(time) {
    if (!time || time.length === 0) return 'N/A';
    return `${time[0].number} ${time[0].unit}`;
}

/**
 * Recursively flattens and formats the complex `entries` array found in 5etools data.
 * It handles nested lists, named sections, and simple strings, converting them into a
 * single description string with basic markdown. It also cleans up 5etools' custom `{@...}` tags.
 * @param {Array<string|object>} entries - The array of entries to format.
 * @param {number} [level=0] - The current recursion level (for potential future use, e.g., indentation).
 * @returns {string} A formatted string representing the content of the entries.
 */
function formatEntries(entries, level = 0) {
    let description = '';
    if (!entries) return description;

    for (const entry of entries) {
        if (typeof entry === 'string') {
            // Replace 5etools tags like {@spell fireball} with bold text.
            description += entry.replace(/{@(spell|item|condition|damage|dice|chance|filter|creature) ([^|}]+)\|?[^}]*}/g, '**$2**') + '\n';
        } else if (typeof entry === 'object' && entry !== null) {
            if (entry.name) {
                description += `\n**${entry.name}.** `;
            }
            if (entry.type === 'list' && entry.items) {
                description += entry.items.map(item => `• ${formatEntries([item], level + 1)}`).join('');
            }
            if (entry.entries) {
                description += formatEntries(entry.entries, level + 1);
            }
        }
    }
    return description;
}

/**
 * Creates a rich embed for a spell.
 * @private
 * @param {object} item - The full spell data object.
 * @returns {EmbedBuilder} A Discord embed representing the spell.
 */
function formatSpell(item) {
    const embed = new EmbedBuilder()
        .setColor(EMBED_COLORS.SPELL)
        .setTitle(item.name)
        .setDescription(formatEntries(item.entries))
        .setFooter({ text: `Source: ${item.source}` });

    const schoolMap = { 'A': 'Abjuration', 'C': 'Conjuration', 'D': 'Divination', 'E': 'Enchantment', 'V': 'Evocation', 'I': 'Illusion', 'N': 'Necromancy', 'T': 'Transmutation' };
    const levelText = item.level === 0 ? 'Cantrip' : `Level ${item.level}`;

    addFieldIfPresent(embed, 'Level', `${levelText} ${schoolMap[item.school] || ''}`, true);
    addFieldIfPresent(embed, 'Casting Time', formatTime(item.time), true);
    addFieldIfPresent(embed, 'Range', formatRange(item.range), true);
    addFieldIfPresent(embed, 'Components', formatComponents(item.components), true);
    addFieldIfPresent(embed, 'Duration', formatDuration(item.duration), true);

    if (item.entriesHigherLevel) {
        addFieldIfPresent(embed, 'At Higher Levels', formatEntries(item.entriesHigherLevel));
    }

    return embed;
}

/**
 * Creates a rich embed for a magic item.
 * @private
 * @param {object} item - The full item data object.
 * @returns {EmbedBuilder} A Discord embed representing the item.
 */
function formatItem(item) {
    const embed = new EmbedBuilder()
        .setColor(EMBED_COLORS.ITEM)
        .setTitle(item.name)
        .setDescription(formatEntries(item.entries))
        .setFooter({ text: `Source: ${item.source}` });
    return embed;
}

/**
 * Creates a rich embed for a monster stat block.
 * @private
 * @param {object} monster - The full monster data object.
 * @returns {EmbedBuilder} A Discord embed representing the monster.
 */
function formatMonster(monster) {
    let monsterTypeStr = monster.type;
    if (typeof monster.type === 'object' && monster.type !== null) {
        monsterTypeStr = monster.type.type;
        if (monster.type.tags && monster.type.tags.length > 0) {
            monsterTypeStr += ` (${monster.type.tags.join(', ')})`;
        }
    }

    const description = monster.size && monsterTypeStr && monster.alignment
        ? `*${monster.size} ${monsterTypeStr}, ${monster.alignment}*`
        : '*No description available.*';

    const embed = new EmbedBuilder()
        .setColor(EMBED_COLORS.MONSTER)
        .setTitle(monster.name)
        .setDescription(description)
        .setFooter({ text: `Source: ${monster.source}` });

    if (monster.ac) {
        const acString = monster.ac.map(acValue => {
            if (typeof acValue === 'number') return acValue.toString();
            if (typeof acValue === 'object' && acValue.ac) {
                let text = acValue.ac.toString();
                if (acValue.from) text += ` (${acValue.from.join(', ')})`;
                if (acValue.condition) text += ` ${acValue.condition.replace(/{@(spell|item|condition|damage|dice|chance|filter|creature) ([^|}]+)\|?[^}]*}/g, '**$2**')}`;
                return text;
            }
            return acValue.toString();
        }).join(' or ');
        addFieldIfPresent(embed, 'Armor Class', acString, true);
    }
    if(monster.hp) addFieldIfPresent(embed, 'Hit Points', `${monster.hp.average} (${monster.hp.formula})`, true);
    if(monster.speed) addFieldIfPresent(embed, 'Speed', Object.entries(monster.speed).map(([type, speed]) => `${type.charAt(0).toUpperCase() + type.slice(1)} ${speed} ft.`).join(', '), true);

    embed.addFields({ name: '\u200B', value: '\u200B' }); // Spacer

    if (monster.str !== undefined) addFieldIfPresent(embed, 'STR', `${monster.str} (${monster.strMod || '+0'})`, true);
    if (monster.dex !== undefined) addFieldIfPresent(embed, 'DEX', `${monster.dex} (${monster.dexMod || '+0'})`, true);
    if (monster.con !== undefined) addFieldIfPresent(embed, 'CON', `${monster.con} (${monster.conMod || '+0'})`, true);
    if (monster.int !== undefined) addFieldIfPresent(embed, 'INT', `${monster.int} (${monster.intMod || '+0'})`, true);
    if (monster.wis !== undefined) addFieldIfPresent(embed, 'WIS', `${monster.wis} (${monster.wisMod || '+0'})`, true);
    if (monster.cha !== undefined) addFieldIfPresent(embed, 'CHA', `${monster.cha} (${monster.chaMod || '+0'})`, true);

    if(monster.skill) addFieldIfPresent(embed, 'Skills', Object.entries(monster.skill).map(([skill, value]) => `${skill.charAt(0).toUpperCase() + skill.slice(1)} ${value}`).join(', '));
    if(monster.senses) addFieldIfPresent(embed, 'Senses', monster.senses.join(', '));
    if(monster.languages) addFieldIfPresent(embed, 'Languages', monster.languages.join(', '));
    if(monster.cr) {
        const crValue = typeof monster.cr === 'object' ? monster.cr.cr : monster.cr;
        const xpText = monster.xp ? `(${monster.xp} XP)` : '';
        addFieldIfPresent(embed, 'Challenge', `${crValue} ${xpText}`, true);
    }

    if (monster.trait) {
        const traits = monster.trait.map(t => `**${t.name}.** ${formatEntries(t.entries)}`).join('\n');
        addFieldIfPresent(embed, 'Traits', traits);
    }
    if (monster.action) {
        const actions = monster.action.map(a => `**${a.name}.** ${formatEntries(a.entries)}`).join('\n');
        addFieldIfPresent(embed, 'Actions', actions);
    }
    if (monster.legendary) {
        const legendaryActions = monster.legendary.map(l => `**${l.name}.** ${formatEntries(l.entries)}`).join('\n');
        addFieldIfPresent(embed, 'Legendary Actions', legendaryActions);
    }

    return embed;
}

/**
 * Creates a default, fallback embed for data types that do not have a specialized formatter.
 * @private
 * @param {object} item - The data object.
 * @returns {EmbedBuilder} A generic Discord embed.
 */
function formatDefault(item) {
    const description = formatEntries(item.entries);
    const embed = new EmbedBuilder()
        .setColor(EMBED_COLORS.DEFAULT)
        .setTitle(item.name)
        .setDescription(description || '*No description available.*')
        .setFooter({ text: `Source: ${item.source}` });
    return embed;
}

/**
 * The main exported formatter function. It acts as a dispatcher, inspecting the item's
 * `category` property and calling the appropriate specialized formatter.
 * @param {object} item The full, resolved data object, including a `category` property.
 * @returns {EmbedBuilder} A fully formatted Discord embed for the given item.
 */
function formatDetailResult(item) {
    switch (item.category) {
        case 'spells':
            return formatSpell(item);
        case 'items':
            return formatItem(item);
        case 'bestiary':
            return formatMonster(item);
        case 'feats':
        case 'races':
        case 'backgrounds': {
            const embed = new EmbedBuilder()
                .setColor(EMBED_COLORS.CHARACTER)
                .setTitle(item.name)
                .setFooter({ text: `Source: ${item.source}` });

            const description = item.entries ? formatEntries(item.entries) : (item.entry ? formatEntries(item.entry) : '');
            embed.setDescription(description || '*No description available.*');

            return embed;
        }
        default:
            return formatDefault(item);
    }
}

module.exports = { formatDetailResult, formatEntries };