const fs = require('fs');
const path = require('path');

const backgroundsFilePath = path.join(__dirname, 'reference/5etoolsdata/backgrounds.json');
const outputDir = path.join(__dirname, 'randomtables/origin');

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

const backgroundsData = JSON.parse(fs.readFileSync(backgroundsFilePath, 'utf-8'));

const allTraits = new Set();
const allIdeals = new Set();
const allBonds = new Set();
const allFlaws = new Set();

function extractEntries(entries, tableType) {
    const results = new Set();
    for (const entry of entries) {
        if (entry.type === 'entries' && entry.name === 'Suggested Characteristics') {
            for (const subEntry of entry.entries) {
                if (subEntry.type === 'table' && subEntry.colLabels && subEntry.colLabels[1] === tableType) {
                    for (const row of subEntry.rows) {
                        results.add(row[1]);
                    }
                }
            }
        } else if (entry.type === 'table' && entry.colLabels && entry.colLabels[1] === tableType) {
            for (const row of entry.rows) {
                results.add(row[1]);
            }
        } else if (entry.type === 'section' && entry.name === 'Horror Characteristics') {
            for (const subEntry of entry.entries) {
                if (subEntry.type === 'table' && subEntry.caption && subEntry.caption.includes(tableType)) {
                     for (const row of subEntry.rows) {
                        results.add(row[1]);
                    }
                }
            }
        } else if (entry.type === 'entries' && entry.entries) {
             const nestedResults = extractEntries(entry.entries, tableType);
             nestedResults.forEach(item => results.add(item));
        }
    }
    return results;
}

for (const background of backgroundsData.background) {
    if (background.entries) {
        extractEntries(background.entries, 'Personality Trait').forEach(item => allTraits.add(item));
        extractEntries(background.entries, 'Ideal').forEach(item => allIdeals.add(item));
        extractEntries(background.entries, 'Bond').forEach(item => allBonds.add(item));
        extractEntries(background.entries, 'Flaw').forEach(item => allFlaws.add(item));
    }
}

fs.writeFileSync(path.join(outputDir, 'traits.json'), JSON.stringify(Array.from(allTraits), null, 2));
fs.writeFileSync(path.join(outputDir, 'ideals.json'), JSON.stringify(Array.from(allIdeals), null, 2));
fs.writeFileSync(path.join(outputDir, 'bonds.json'), JSON.stringify(Array.from(allBonds), null, 2));
fs.writeFileSync(path.join(outputDir, 'flaws.json'), JSON.stringify(Array.from(allFlaws), null, 2));

console.log('Background data extracted successfully.');
