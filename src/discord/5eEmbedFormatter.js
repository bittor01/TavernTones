// Process: const  EmbedBuilder  = require('discord.js')
const { EmbedBuilder } = require('discord.js');

/**
 * Utility to add a field to a Discord embed only if a valid value is provided.
 * @param {EmbedBuilder} embed - The embed object to modify.
 * @param {string} name - The title of the field.
 * @param {string|null|undefined} value - The content of the field.
 * @param {boolean} [inline=false] - Whether the field should be inline.
 */
function addFieldIfPresent(embed, name, value, inline = false) {
    // Check if the value is truthy before adding the field
    // Process: if (value)
    if (value) {
        // Append the field to the embed builder
        embed.addFields({ name, value, inline });
    // Process:
    }
}

/**
 * Formats D&D 5e spell components (V, S, M) into a readable string.
 * @param {object} components - The components object from the data source.
 * @returns {string} A human-readable representation of components.
 */
// Process: function formatComponents(components)
function formatComponents(components) {
    // Return "None" if no components are defined
    if (!components) return 'None';
    // Array to hold individual component parts
    // Process: let parts = []
    let parts = [];
    // Check for Verbal component
    if (components.v) parts.push('V');
    // Check for Somatic component
    // Process: if (components.s) parts.push('S')
    if (components.s) parts.push('S');
    if (components.m) {
        // Material can be a string or an object with a text property
        // Process: let material = typeof components.m === 'string' ? compone...
        let material = typeof components.m === 'string' ? components.m : components.m.text;
        // Format with the material description in parentheses
        parts.push(`M (${material})`);
    // Process:
    }
    // Join parts with commas and return
    return parts.join(', ');
// Process:
}

/**
 * Formats D&D 5e spell duration into a readable string.
 * @param {object[]} duration - The duration array from the data source.
 * @returns {string} A human-readable duration.
 */
function formatDuration(duration) {
    // Return N/A if duration data is missing or empty
    // Process: if (!duration || duration.length === 0) return 'N/A'
    if (!duration || duration.length === 0) return 'N/A';
    // Get the first duration entry
    const dur = duration[0];
    // Handle instantaneous effects
    // Process: if (dur.type === 'instant') return 'Instantaneous'
    if (dur.type === 'instant') return 'Instantaneous';
    // Handle permanent effects
    if (dur.type === 'permanent') return 'Until dispelled';
    // Handle timed durations (e.g., 1 hour)
    // Process: if (dur.type === 'timed')
    if (dur.type === 'timed') {
        // Construct basic duration text
        let text = `${dur.duration.amount} ${dur.duration.type}(s)`;
        // Append concentration indicator if applicable
        // Process: if (dur.concentration) text += ' (Concentration)'
        if (dur.concentration) text += ' (Concentration)';
        return text;
    // Process:
    }
    // Fallback for special or unhandled duration types
    return 'Special';
// Process:
}

/**
 * Formats D&D 5e spell range into a readable string.
 * @param {object} range - The range object from the data source.
 * @returns {string} A human-readable range description.
 */
function formatRange(range) {
    // Return N/A if range data is missing
    // Process: if (!range) return 'N/A'
    if (!range) return 'N/A';
    // Handle single-point ranges (e.g., 60 feet)
    if (range.type === 'point') {
        // Self-range is a special case
        // Process: if (range.distance.type === 'self') return 'Self'
        if (range.distance.type === 'self') return 'Self';
        // Otherwise return the numeric distance and unit
        return `${range.distance.amount} ${range.distance.type}`;
    // Process:
    }
    // Handle area-of-effect ranges (radius, cone, etc.)
    if (range.type === 'radius' || range.type === 'sphere' || range.type === 'hemisphere' || range.type === 'cone' || range.type === 'line' || range.type === 'cube') {
        // Return distance-unit followed by the shape
        // Process: return `$range.distance.amount-$range.distance.type $rang...
        return `${range.distance.amount}-${range.distance.type} ${range.type}`;
    }
    // Fallback for complex or special range types
    // Process: return 'Special'
    return 'Special';
}

/**
 * Formats D&D 5e casting time into a readable string.
 * @param {object[]} time - The time array from the data source.
 * @returns {string} A human-readable casting time.
 */
// Process: function formatTime(time)
function formatTime(time) {
    // Return N/A if time data is missing or empty
    if (!time || time.length === 0) return 'N/A';
    // Format the first entry (e.g., 1 action)
    // Process: return `$time[0].number $time[0].unit`
    return `${time[0].number} ${time[0].unit}`;
}

/**
 * Recursively flattens and formats nested 'entries' arrays from D&D 5e JSON data.
 * @param {any[]} entries - Array of strings or nested entry objects.
 * @param {number} [level=0] - Recursion depth.
 * @returns {string} A formatted description string.
 */
// Process: function formatEntries(entries, level = 0)
function formatEntries(entries, level = 0) {
    // Initialized the description string
    let description = '';
    // Return empty if no entries exist
    // Process: if (!entries) return description
    if (!entries) return description;

    // Process each entry in the array
    for (const entry of entries) {
        // Handle plain string entries
        // Process: if (typeof entry === 'string')
        if (typeof entry === 'string') {
            // Replace 5eTools-style tags (like {@spell Fireball}) with bolded text (**Fireball**)
            description += entry.replace(/{@(spell|item|condition|damage|dice|chance|filter|creature) ([^|}]+)\|?[^}]*}/g, '**$2**') + '\n';
        // Process: else if (typeof entry === 'object' && entry !== null)
        } else if (typeof entry === 'object' && entry !== null) {
            // Handle entry objects with a name property (often used for trait headers)
            if (entry.name) {
                // Add the header in bold
                // Process: description += `\n**$entry.name.** `
                description += `\n**${entry.name}.** `;
            }
            // Handle list-type entries
            // Process: if (entry.type === 'list' && entry.items)
            if (entry.type === 'list' && entry.items) {
                // Format each list item as a bullet point
                description += entry.items.map(item => `• ${formatEntries([item], level + 1)}`).join('');
            // Process:
            }
            // Recurse if the object contains its own nested entries
            if (entry.entries) {
                // Process: description += formatEntries(entry.entries, level + 1)
                description += formatEntries(entry.entries, level + 1);
            }
        // Process:
        }
    }
    // Return the compiled description
    // Process: return description
    return description;
}


/**
 * Formats a D&D 5e spell object into a Discord embed.
 * @param {object} item - The spell data object.
 * @returns {EmbedBuilder}
 */
// Process: function formatSpell(item)
function formatSpell(item) {
    // Initialize the embed with basic spell info
    const embed = new EmbedBuilder()
        // Process: .setColor(0x3498DB)
        .setColor(0x3498DB) // Use Blue color for spells
        .setTitle(item.name)
        // Format the main spell description entries
        // Process: .setDescription(formatEntries(item.entries))
        .setDescription(formatEntries(item.entries))
        // Show the source book in the footer
        .setFooter({ text: `Source: ${item.source}` });

    // Map single-letter school codes to full names
    // Process: const schoolMap =  'A': 'Abjuration', 'C': 'Conjuration',...
    const schoolMap = { 'A': 'Abjuration', 'C': 'Conjuration', 'D': 'Divination', 'E': 'Enchantment', 'V': 'Evocation', 'I': 'Illusion', 'N': 'Necromancy', 'T': 'Transmutation' };
    // Format the level display
    const levelText = item.level === 0 ? 'Cantrip' : `Level ${item.level}`;

    // Add key spell statistics as fields
    // Process: addFieldIfPresent(embed, 'Level', `$levelText $schoolMap[...
    addFieldIfPresent(embed, 'Level', `${levelText} ${schoolMap[item.school] || ''}`, true);
    addFieldIfPresent(embed, 'Casting Time', formatTime(item.time), true);
    // Process: addFieldIfPresent(embed, 'Range', formatRange(item.range)...
    addFieldIfPresent(embed, 'Range', formatRange(item.range), true);
    addFieldIfPresent(embed, 'Components', formatComponents(item.components), true);
    // Process: addFieldIfPresent(embed, 'Duration', formatDuration(item....
    addFieldIfPresent(embed, 'Duration', formatDuration(item.duration), true);

    // If there is information for casting at higher levels, add it
    if (item.entriesHigherLevel) {
        // Process: addFieldIfPresent(embed, 'At Higher Levels', formatEntrie...
        addFieldIfPresent(embed, 'At Higher Levels', formatEntries(item.entriesHigherLevel));
    }

    // Return the compiled embed
    // Process: return embed
    return embed;
}

/**
 * Formats a D&D 5e item object into a Discord embed.
 * @param {object} item - The item data object.
 * @returns {EmbedBuilder}
 */
// Process: function formatItem(item)
function formatItem(item) {
    // Initialize the embed with item info
    const embed = new EmbedBuilder()
        // Process: .setColor(0x2ECC71)
        .setColor(0x2ECC71) // Use Green color for items
        .setTitle(item.name)
        // Format the item description entries
        // Process: .setDescription(formatEntries(item.entries))
        .setDescription(formatEntries(item.entries))
        // Show the source book in the footer
        .setFooter({ text: `Source: ${item.source}` });
    // Return the compiled embed
    // Process: return embed
    return embed;
}

/**
 * Formats a D&D 5e monster object into a Discord embed.
 * @param {object} monster - The monster data object.
 * @returns {EmbedBuilder}
 */
// Process: function formatMonster(monster)
function formatMonster(monster) {
    // Initialize the embed with monster info
    const embed = new EmbedBuilder()
        // Process: .setColor(0xE74C3C)
        .setColor(0xE74C3C) // Use Red color for monsters
        .setTitle(monster.name)
        // Set basic monster metadata as description
        // Process: .setDescription(`*$monster.size $monster.type, $monster.a...
        .setDescription(`*${monster.size} ${monster.type}, ${monster.alignment}*`)
        // Show the source book in the footer
        .setFooter({ text: `Source: ${monster.source}` });
    // TODO: Stat block formatting for actions, traits, and ability scores
    // Process: return embed
    return embed;
}

/**
 * Fallback formatter for unknown D&D 5e data categories.
 * @param {object} item - The data object.
 * @returns {EmbedBuilder}
 */
// Process: function formatDefault(item)
function formatDefault(item) {
    // Use a neutral grey for unknown categories
    const embed = new EmbedBuilder()
        // Process: .setColor(0x95A5A6)
        .setColor(0x95A5A6)
        .setTitle(item.name)
        // Attempt to format entries as a fallback
        // Process: .setDescription(formatEntries(item.entries))
        .setDescription(formatEntries(item.entries))
        .setFooter({ text: `Source: ${item.source}` });
    // Return the compiled embed
    // Process: return embed
    return embed;
}

/**
 * Main dispatcher for formatting 5e results based on their category.
 * @param {object} item - The item to format.
 * @returns {EmbedBuilder}
 */
// Process: function format5eResult(item)
function format5eResult(item) {
    // Select the appropriate formatter based on the item category
    switch (item.category) {
        // Process: case 'spells':
        case 'spells':
            return formatSpell(item);
        // Process: case 'items':
        case 'items':
            return formatItem(item);
        // Process: case 'bestiary':
        case 'bestiary':
            return formatMonster(item);
        // Dispatch to default if category is unrecognized
        // Process: default:
        default:
            return formatDefault(item);
    // Process:
    }
}

// Process: module.exports =  format5eResult, formatEntries
module.exports = { format5eResult, formatEntries };
