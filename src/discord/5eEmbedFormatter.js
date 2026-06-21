const { EmbedBuilder } = require('discord.js');

/**
 * Utility to add a field to a Discord embed only if a valid value is provided.
 * This prevents empty fields from causing Discord API errors or ugly UI.
 */
function addFieldIfPresent(embed, name, value, inline = false) {
    // Only proceed if the value is non-null and non-empty.
    if (value) {
        embed.addFields({ name, value, inline });
    }
}

/**
 * Formats D&D 5e spell components (V, S, M) into a readable string.
 * @param {object} components - The components object from the data source.
 * @returns {string} A human-readable representation of components.
 */
function formatComponents(components) {
    // Return "None" if no components are defined
    if (!components) return 'None';
    // Array to hold individual component parts
    let parts = [];
    // Check for Verbal component
    if (components.v) parts.push('V');
    // Check for Somatic component
    if (components.s) parts.push('S');
    if (components.m) {
        // Material can be a string or an object with a text property
        let material = typeof components.m === 'string' ? components.m : components.m.text;
        // Format with the material description in parentheses
        parts.push(`M (${material})`);
    }
    // Join parts with commas and return
    return parts.join(', ');
}

/**
 * Formats D&D 5e spell duration into a readable string.
 * @param {object[]} duration - The duration array from the data source.
 * @returns {string} A human-readable duration.
 */
function formatDuration(duration) {
    // Return N/A if duration data is missing or empty
    if (!duration || duration.length === 0) return 'N/A';
    // Get the first duration entry
    const dur = duration[0];
    // Handle instantaneous effects
    if (dur.type === 'instant') return 'Instantaneous';
    // Handle permanent effects
    if (dur.type === 'permanent') return 'Until dispelled';
    // Handle timed durations (e.g., 1 hour)
    if (dur.type === 'timed') {
        // Construct basic duration text
        let text = `${dur.duration.amount} ${dur.duration.type}(s)`;
        // Append concentration indicator if applicable
        if (dur.concentration) text += ' (Concentration)';
        return text;
    }
    // Fallback for special or unhandled duration types
    return 'Special';
}

/**
 * Formats D&D 5e spell range into a readable string.
 * @param {object} range - The range object from the data source.
 * @returns {string} A human-readable range description.
 */
function formatRange(range) {
    // Return N/A if range data is missing
    if (!range) return 'N/A';
    // Handle single-point ranges (e.g., 60 feet)
    if (range.type === 'point') {
        // Self-range is a special case
        if (range.distance.type === 'self') return 'Self';
        // Otherwise return the numeric distance and unit
        return `${range.distance.amount} ${range.distance.type}`;
    }
    // Handle area-of-effect ranges (radius, cone, etc.)
    if (range.type === 'radius' || range.type === 'sphere' || range.type === 'hemisphere' || range.type === 'cone' || range.type === 'line' || range.type === 'cube') {
        // Return distance-unit followed by the shape
        return `${range.distance.amount}-${range.distance.type} ${range.type}`;
    }
    // Fallback for complex or special range types
    return 'Special';
}

/**
 * Formats D&D 5e casting time into a readable string.
 * @param {object[]} time - The time array from the data source.
 * @returns {string} A human-readable casting time.
 */
function formatTime(time) {
    // Return N/A if time data is missing or empty
    if (!time || time.length === 0) return 'N/A';
    // Format the first entry (e.g., 1 action)
    return `${time[0].number} ${time[0].unit}`;
}

/**
 * Recursively flattens nested 'entries' arrays from D&D 5e JSON data into a clean string.
 * This handles the complex hierarchical structure used by 5eTools.
 */
function formatEntries(entries, level = 0) {
    let description = '';
    if (!entries) return description;

    for (const entry of entries) {
        if (typeof entry === 'string') {
            // Regex to strip 5eTools tags (like {@spell Fireball}) and replace with Markdown bold (**Fireball**).
            description += entry.replace(/{@(spell|item|condition|damage|dice|chance|filter|creature) ([^|}]+)\|?[^}]*}/g, '**$2**') + '\n';
        } else if (typeof entry === 'object' && entry !== null) {
            // Entry objects often contain a 'name' which acts as a sub-header.
            if (entry.name) {
                description += `\n**${entry.name}.** `;
            }
            // Format list-type entries into bulleted Discord lines.
            if (entry.type === 'list' && entry.items) {
                description += entry.items.map(item => `• ${formatEntries([item], level + 1)}`).join('');
            }
            // Deeply traverse nested entry blocks to ensure no content is missed.
            if (entry.entries) {
                description += formatEntries(entry.entries, level + 1);
            }
        }
    }
    return description;
}


/**
 * Formats a D&D 5e spell object into a Discord embed.
 * @param {object} item - The spell data object.
 * @returns {EmbedBuilder}
 */
function formatSpell(item) {
    // Initialize the embed with basic spell info
    const embed = new EmbedBuilder()
        .setColor(0x3498DB) // Use Blue color for spells
        .setTitle(item.name)
        // Format the main spell description entries
        .setDescription(formatEntries(item.entries))
        // Show the source book in the footer
        .setFooter({ text: `Source: ${item.source}` });

    // Map single-letter school codes to full names
    const schoolMap = { 'A': 'Abjuration', 'C': 'Conjuration', 'D': 'Divination', 'E': 'Enchantment', 'V': 'Evocation', 'I': 'Illusion', 'N': 'Necromancy', 'T': 'Transmutation' };
    // Format the level display
    const levelText = item.level === 0 ? 'Cantrip' : `Level ${item.level}`;

    // Add key spell statistics as fields
    addFieldIfPresent(embed, 'Level', `${levelText} ${schoolMap[item.school] || ''}`, true);
    addFieldIfPresent(embed, 'Casting Time', formatTime(item.time), true);
    addFieldIfPresent(embed, 'Range', formatRange(item.range), true);
    addFieldIfPresent(embed, 'Components', formatComponents(item.components), true);
    addFieldIfPresent(embed, 'Duration', formatDuration(item.duration), true);

    // If there is information for casting at higher levels, add it
    if (item.entriesHigherLevel) {
        addFieldIfPresent(embed, 'At Higher Levels', formatEntries(item.entriesHigherLevel));
    }

    // Return the compiled embed
    return embed;
}

/**
 * Formats a D&D 5e item object into a Discord embed.
 * @param {object} item - The item data object.
 * @returns {EmbedBuilder}
 */
function formatItem(item) {
    // Initialize the embed with item info
    const embed = new EmbedBuilder()
        .setColor(0x2ECC71) // Use Green color for items
        .setTitle(item.name)
        // Format the item description entries
        .setDescription(formatEntries(item.entries))
        // Show the source book in the footer
        .setFooter({ text: `Source: ${item.source}` });
    // Return the compiled embed
    return embed;
}

/**
 * Formats a D&D 5e monster object into a Discord embed.
 * @param {object} monster - The monster data object.
 * @returns {EmbedBuilder}
 */
function formatMonster(monster) {
    // Initialize the embed with monster info
    const embed = new EmbedBuilder()
        .setColor(0xE74C3C) // Use Red color for monsters
        .setTitle(monster.name)
        // Set basic monster metadata as description
        .setDescription(`*${monster.size} ${monster.type}, ${monster.alignment}*`)
        // Show the source book in the footer
        .setFooter({ text: `Source: ${monster.source}` });
    // TODO: Stat block formatting for actions, traits, and ability scores
    return embed;
}

/**
 * Fallback formatter for unknown D&D 5e data categories.
 * @param {object} item - The data object.
 * @returns {EmbedBuilder}
 */
function formatDefault(item) {
    // Use a neutral grey for unknown categories
    const embed = new EmbedBuilder()
        .setColor(0x95A5A6)
        .setTitle(item.name)
        // Attempt to format entries as a fallback
        .setDescription(formatEntries(item.entries))
        .setFooter({ text: `Source: ${item.source}` });
    // Return the compiled embed
    return embed;
}

/**
 * Main dispatcher for formatting 5e results based on their category.
 * @param {object} item - The item to format.
 * @returns {EmbedBuilder}
 */
function format5eResult(item) {
    // Select the appropriate formatter based on the item category
    switch (item.category) {
        case 'spells':
            return formatSpell(item);
        case 'items':
            return formatItem(item);
        case 'bestiary':
            return formatMonster(item);
        // Dispatch to default if category is unrecognized
        default:
            return formatDefault(item);
    }
}
module.exports = { format5eResult, formatEntries };
