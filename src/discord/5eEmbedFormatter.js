// Import EmbedBuilder from discord.js to create rich messages
const { EmbedBuilder } = require('discord.js');

/**
 * A helper function to add fields to an embed only if the value is not null or undefined.
 * This prevents empty fields from appearing or causing errors in the Discord UI.
 * @param {EmbedBuilder} embed The embed to modify.
 * @param {string} name The title of the field.
 * @param {string} value The content of the field.
 * @param {boolean} [inline=false] Whether the field should be displayed inline.
 */
function addFieldIfPresent(embed, name, value, inline = false) {
    // Check if value is truthy (not null, undefined, or empty string)
    if (value) {
        embed.addFields({ name, value, inline });
    }
}

/**
 * Formats D&D spell components (Verbal, Somatic, Material) into a readable string.
 * @param {object} components The components object from the 5e data.
 * @returns {string} A string like "V, S, M (a piece of copper)".
 */
function formatComponents(components) {
    // If no components exist, return 'None'
    if (!components) return 'None';
    let parts = [];
    // Check for Verbal component
    if (components.v) parts.push('V');
    // Check for Somatic component
    if (components.s) parts.push('S');
    // Check for Material component, which can be a string or an object with text
    if (components.m) {
        let material = typeof components.m === 'string' ? components.m : components.m.text;
        parts.push(`M (${material})`);
    }
    // Join all parts with a comma and space
    return parts.join(', ');
}

/**
 * Formats the duration of a spell into a user-friendly string.
 * @param {object[]} duration The duration array from the 5e data.
 * @returns {string} A string like "1 Minute (Concentration)".
 */
function formatDuration(duration) {
    // Return N/A if duration data is missing
    if (!duration || duration.length === 0) return 'N/A';
    const dur = duration[0];
    // Handle specific duration types
    if (dur.type === 'instant') return 'Instantaneous';
    if (dur.type === 'permanent') return 'Until dispelled';
    if (dur.type === 'timed') {
        let text = `${dur.duration.amount} ${dur.duration.type}(s)`;
        // Append (Concentration) if the spell requires it
        if (dur.concentration) text += ' (Concentration)';
        return text;
    }
    // Fallback for complex or unusual durations
    return 'Special';
}

/**
 * Formats the range and shape of a spell.
 * @param {object} range The range object from the 5e data.
 * @returns {string} A string like "60 feet" or "Self (15-foot cone)".
 */
function formatRange(range) {
    // Return N/A if range data is missing
    if (!range) return 'N/A';
    // Handle point-based ranges (Self, Touch, or distance)
    if (range.type === 'point') {
        if (range.distance.type === 'self') return 'Self';
        return `${range.distance.amount} ${range.distance.type}`;
    }
    // Handle area-of-effect shapes like cones, spheres, etc.
    if (range.type === 'radius' || range.type === 'sphere' || range.type === 'hemisphere' || range.type === 'cone' || range.type === 'line' || range.type === 'cube') {
        return `${range.distance.amount}-${range.distance.type} ${range.type}`;
    }
    // Fallback for special ranges
    return 'Special';
}

/**
 * Formats the casting time of a spell.
 * @param {object[]} time The time array from the 5e data.
 * @returns {string} A string like "1 action" or "10 minutes".
 */
function formatTime(time) {
    // Return N/A if casting time data is missing
    if (!time || time.length === 0) return 'N/A';
    return `${time[0].number} ${time[0].unit}`;
}

/**
 * Recursively flattens and formats the complex 'entries' array found in 5e data.
 * Handles nested objects, lists, and special 5eTools tags like {@spell Magic Missile}.
 * @param {any[]} entries The array of entries to format.
 * @param {number} [level=0] The recursion depth.
 * @returns {string} A flattened, Markdown-formatted string.
 */
function formatEntries(entries, level = 0) {
    let description = '';
    // Stop if there are no entries
    if (!entries) return description;

    for (const entry of entries) {
        // If it's a simple string, clean up any 5eTools tags using regex
        if (typeof entry === 'string') {
            // Replaces tags like {@spell Fireball} with just **Fireball**
            description += entry.replace(/{@(spell|item|condition|damage|dice|chance|filter|creature) ([^|}]+)\|?[^}]*}/g, '**$2**') + '\n';
        }
        // If it's an object, it might be a sub-header, a list, or a block of nested entries
        else if (typeof entry === 'object' && entry !== null) {
            // Add the name of the section in bold
            if (entry.name) {
                description += `\n**${entry.name}.** `;
            }
            // Handle list-type entries by prepending bullet points
            if (entry.type === 'list' && entry.items) {
                description += entry.items.map(item => `• ${formatEntries([item], level + 1)}`).join('');
            }
            // Recurse if there are nested entries
            if (entry.entries) {
                description += formatEntries(entry.entries, level + 1);
            }
        }
    }
    return description;
}

/**
 * Formats a Spell object into a detailed Discord embed.
 * @param {object} item The spell data object.
 * @returns {EmbedBuilder} The constructed embed.
 */
function formatSpell(item) {
    // Initialize the embed with the spell's name and its primary description
    const embed = new EmbedBuilder()
        .setColor(0x3498DB) // Blue color for spells
        .setTitle(item.name)
        .setDescription(formatEntries(item.entries))
        .setFooter({ text: `Source: ${item.source}` });

    // Map single-letter school codes to full names
    const schoolMap = { 'A': 'Abjuration', 'C': 'Conjuration', 'D': 'Divination', 'E': 'Enchantment', 'V': 'Evocation', 'I': 'Illusion', 'N': 'Necromancy', 'T': 'Transmutation' };
    // Determine the level text (e.g. Cantrip or Level 1)
    const levelText = item.level === 0 ? 'Cantrip' : `Level ${item.level}`;

    // Add standard spell fields if the data exists
    addFieldIfPresent(embed, 'Level', `${levelText} ${schoolMap[item.school] || ''}`, true);
    addFieldIfPresent(embed, 'Casting Time', formatTime(item.time), true);
    addFieldIfPresent(embed, 'Range', formatRange(item.range), true);
    addFieldIfPresent(embed, 'Components', formatComponents(item.components), true);
    addFieldIfPresent(embed, 'Duration', formatDuration(item.duration), true);

    // If there is special logic for casting at a higher level, add it as a separate block
    if (item.entriesHigherLevel) {
        addFieldIfPresent(embed, 'At Higher Levels', formatEntries(item.entriesHigherLevel));
    }

    return embed;
}

/**
 * Formats a generic Item object into a Discord embed.
 * @param {object} item The item data object.
 * @returns {EmbedBuilder} The constructed embed.
 */
function formatItem(item) {
    // Initialize the embed with the item's name and description
    const embed = new EmbedBuilder()
        .setColor(0x2ECC71) // Green color for items
        .setTitle(item.name)
        .setDescription(formatEntries(item.entries))
        .setFooter({ text: `Source: ${item.source}` });
    return embed;
}

/**
 * Formats a Monster object into a Discord embed.
 * @param {object} monster The monster data object.
 * @returns {EmbedBuilder} The constructed embed.
 */
function formatMonster(monster) {
    // Initialize the embed with basic monster info
    const embed = new EmbedBuilder()
        .setColor(0xE74C3C) // Red color for monsters
        .setTitle(monster.name)
        .setDescription(`*${monster.size} ${monster.type}, ${monster.alignment}*`)
        .setFooter({ text: `Source: ${monster.source}` });
    // Note: Complex stats like HP, AC, and Actions are currently omitted and require further implementation.
    return embed;
}

/**
 * Fallback formatter for any unrecognized 5e data category.
 * @param {object} item The data object.
 * @returns {EmbedBuilder} A basic embed.
 */
function formatDefault(item) {
    const embed = new EmbedBuilder()
        .setColor(0x95A5A6) // Grey color for default entries
        .setTitle(item.name)
        .setDescription(formatEntries(item.entries))
        .setFooter({ text: `Source: ${item.source}` });
    return embed;
}

/**
 * Main entry point for formatting any 5e result based on its category.
 * @param {object} item The data object containing a 'category' property.
 * @returns {EmbedBuilder} The appropriate Discord embed for the category.
 */
function format5eResult(item) {
    switch (item.category) {
        case 'spells':
            return formatSpell(item);
        case 'items':
            return formatItem(item);
        case 'bestiary':
            return formatMonster(item);
        // Additional categories can be added here in the future
        default:
            return formatDefault(item);
    }
}

// Export the formatting functions for use in CommandHandler or elsewhere
module.exports = { format5eResult, formatEntries };
