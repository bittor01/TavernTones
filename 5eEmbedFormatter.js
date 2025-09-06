const { EmbedBuilder } = require('discord.js');

// A helper function to add fields to an embed only if the value is not null or undefined
function addFieldIfPresent(embed, name, value, inline = false) {
    if (value) {
        embed.addFields({ name, value, inline });
    }
}

// A helper to format spell components
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

// A helper to format spell duration
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

// A helper to format spell range
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

// A helper to format spell casting time
function formatTime(time) {
    if (!time || time.length === 0) return 'N/A';
    return `${time[0].number} ${time[0].unit}`;
}

// A helper to recursively flatten and format the 'entries' array
function formatEntries(entries, level = 0) {
    let description = '';
    if (!entries) return description;

    for (const entry of entries) {
        if (typeof entry === 'string') {
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


function formatSpell(item) {
    const embed = new EmbedBuilder()
        .setColor(0x3498DB) // Blue for spells
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

function formatItem(item) {
    // Placeholder for item formatting
    const embed = new EmbedBuilder()
        .setColor(0x2ECC71) // Green for items
        .setTitle(item.name)
        .setDescription(formatEntries(item.entries))
        .setFooter({ text: `Source: ${item.source}` });
    return embed;
}

function formatMonster(monster) {
    // Placeholder for monster formatting
    const embed = new EmbedBuilder()
        .setColor(0xE74C3C) // Red for monsters
        .setTitle(monster.name)
        .setDescription(`*${monster.size} ${monster.type}, ${monster.alignment}*`)
        .setFooter({ text: `Source: ${monster.source}` });
    // This will need significant work to display stats, actions, etc.
    return embed;
}

function formatDefault(item) {
    // A fallback for any other category
    const embed = new EmbedBuilder()
        .setColor(0x95A5A6) // Grey for default
        .setTitle(item.name)
        .setDescription(formatEntries(item.entries))
        .setFooter({ text: `Source: ${item.source}` });
    return embed;
}


function format5eResult(item) {
    switch (item.category) {
        case 'spells':
            return formatSpell(item);
        case 'items':
            return formatItem(item);
        case 'bestiary':
            return formatMonster(item);
        // Add cases for other categories as needed
        default:
            return formatDefault(item);
    }
}

module.exports = { format5eResult };
