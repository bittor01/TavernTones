require('dotenv').config({ path: 'environmentvars.env' }); // Load environment variables from .env file
console.log('Main.js script started');
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
console.log('Electron loaded.');
const path = require('path');
console.log('Path loaded.');
const { Client, GatewayIntentBits, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, StringSelectMenuBuilder } = require('discord.js');
console.log('Discord.js Client loaded.');
const { joinVoiceChannel, entersState, VoiceConnectionStatus } = require('@discordjs/voice');
console.log('Discord.js Voice loaded.');
const DropdownHandler = require('./DropdownHandler.js');
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.MessageContent, GatewayIntentBits.DirectMessages] });
console.log('Discord client instantiated.');
const axios = require('axios');
console.log('Axios loaded.');
const BackendAudioPlayer = require('./BackendAudioPlayer.js');
const CommandHandler = require('./CommandHandler.js');
const MagicItemGenerator = require('./MagicItemGenerator.js');
const VehicleEncounterBuilder = require('./VehicleEncounterBuilder.js');
const FiveEToolsParser = require('./5eParser.js');
const { format5eResult, formatEntries } = require('./5eEmbedFormatter.js');
const fs = require('fs').promises;

const DISCORD_TOKEN = process.env.DISCORD_TOKEN; // Use the token from environment variables
const VOICE_CHANNEL_ID = process.env.VOICE_CHANNEL_ID;
const BOT_ROLE_ID = process.env.BOT_ROLE_ID;
const DEFAULT_LOCAL_FOLDER = process.env.DEFAULT_LOCAL_FOLDER;
const TEXT_CHANNEL_ID = process.env.TEXT_CHANNEL_ID;
let connection;
let musicPlayer;
let isAppReady = false; // Flag to indicate if the app is ready
let initiativeTracker;
let fiveEToolsParser;
const maSelections = new Map();
const encounterSelections = new Map();
const vehicleSelections = new Map();
const npcSelections = new Map();
const trapSelections = new Map();


// --- State Management ---
const autosavePath = path.join(app.getPath('userData'), 'autosave.json');

const DND_CONDITIONS = {
    "Blinded": { emoji: "🙈", color: "#6c757d", text: "You can't see and automatically fail any ability check that requires sight. Attack rolls against you have Advantage, and your attack rolls have Disadvantage." },
    "Burning": { emoji: "🔥", color: "#e74c3c", text: "A burning creature takes 1d4 Fire damage at the start of each of its turns. A creature can end this damage by using its action to make a DC 10 Dexterity check to extinguish the flames." },
    "Charmed": { emoji: "😍", color: "#e83e8c", text: "You can't attack the charmer or target the charmer with harmful abilities or magical effects. The charmer has Advantage on any ability check to interact socially with you." },
    "Deafened": { emoji: "🙉", color: "#adb5bd", text: "You can't hear and automatically fail any ability check that requires hearing." },
    "Exhaustion": { emoji: "😩", color: "#fd7e14", text: "This condition is cumulative. Each time you receive it, you gain 1 Exhaustion level. You die if your Exhaustion level is 6. When you make a D20 Test the roll is reduced by 2 times your Exhaustion level. Your Speed is reduced by a number of feet equal to 5 times your Exhaustion level." },
    "Frightened": { emoji: "😨", color: "#6f42c1", text: "You have Disadvantage on ability checks and attack rolls while the source of your fear is within line of sight. You can't willingly move closer to the source of your fear." },
    "Grappled": { emoji: "🤼", color: "#fd7e14", text: "Your speed becomes 0, and you can't benefit from any bonus to your speed. The condition ends if the grappler is incapacitated. The condition also ends if an effect removes the grappled creature from the reach of the grappler." },
    "Incapacitated": { emoji: "😵", color: "#6c757d", text: "You can't take actions or reactions. Your Concentration in broken. You can't speak." },
    "Invisible": { emoji: "👻", color: "#f8f9fa", text: "You are Concealed. You aren't affected by any effect that requires its target to be seen unless the effect's creator can somehow see you. Any equipment you are wearing or carrying is also concealed. Attack rolls against you have Disadvantage, and your attack rolls have Advantage. If a creature can somehow see you, you don't gain this benefit against that creature." },
    "Paralyzed": { emoji: "⚡", color: "#007bff", text: "You are Incapacitated and can't move or speak. You automatically fail Strength and Dexterity saving throws. Attack rolls against you have Advantage. Any attack that hits you is a critical hit if the attacker is within 5 feet of you. (Incapacitated: You can't take actions or reactions. Your Concentration in broken. You can't speak.)" },
    "Petrified": { emoji: "🪨", color: "#343a40", text: "You have the Incapacitated condition. Your Speed is 0 and can't increase. You automatically fail Strength and Dexterity saving throws. Attack rolls against you have Advantage. Any attack roll that hits you is a Critical Hit if the attacker is within 5 feet of you. (Incapacitated: You can't take actions or reactions. Your Concentration in broken. You can't speak.)" },
    "Poisoned": { emoji: "🤢", color: "#28a745", text: "You have Disadvantage on attack rolls and ability checks." },
    "Prone": { emoji: "🛌", color: "#ffc107", text: "Your only movement option is to crawl, unless you stand up and thereby end the condition. You have Disadvantage on attack rolls. An attack roll against you has Advantage if the attacker is within 5 feet of you. Otherwise, the attack roll has Disadvantage." },
    "Restrained": { emoji: "⛓️", color: "#6c757d", text: "Your speed becomes 0, and you can't benefit from any bonus to your speed. Attack rolls against you have Advantage, and your attack rolls have Disadvantage. You have Disadvantage on Dexterity saving throws." },
    "Stunned": { emoji: "😵‍💫", color: "#ffc107", text: "You are Incapacitated, can't move, and can speak only falteringly. You automatically fail Strength and Dexterity saving throws. Attack rolls against you have Advantage. Any attack roll that hits you is a Critical Hit if the attacker is within 5 feet of you. (Incapacitated: You can't take actions or reactions. Your Concentration in broken. You can't speak.)" },
    "Unconscious": { emoji: "😴", color: "#343a40", text: "You are Incapacitated, can't move or speak, and are unaware of your surroundings. You drop whatever you're holding and fall prone. You automatically fail Strength and Dexterity saving throws. Attack rolls against you have Advantage. Any attack that hits you is a critical hit if the attacker is within 5 feet of you. (Incapacitated: You can't take actions or reactions. Your Concentration in broken. You can't speak.) (Prone: Your only movement option is to crawl, unless you stand up and thereby end the condition. You have Disadvantage on attack rolls. An attack roll against you has Advantage if the attacker is within 5 feet of you. Otherwise, the attack roll has Disadvantage.)" }
};

const hpBarEmojiMap = {
    '#007bff': ':blue_square:',      // Blue
    '#28a745': ':green_square:',     // Green
    '#ffc107': ':yellow_square:',    // Yellow
    '#dc3545': ':red_square:',       // Red
    '#8a2be2': ':purple_square:',    // Purple
    '#6c757d': ':x:',               // Grey (Dead)
    'empty': ':black_large_square:'
};

async function sendInitiativeUpdate(initiativeOrder, currentTurnIndex) {
    if (isAppReady && mainWindow.webContents) {
        mainWindow.webContents.send('update-initiative-list', { initiativeOrder, currentTurnIndex });
    }
    else {
        await sleep(100);
        sendInitiativeUpdate(initiativeOrder, currentTurnIndex);
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

//Begin UI
// Electron Setup
let mainWindow;
let windowloaded = false;
async function createWindow(showWindow = true) {
    console.log('createWindow() called.');
    mainWindow = new BrowserWindow({
        show: false, // Do not show the window until it's ready
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            enableRemoteModule: false,
            nodeIntegration: true
        }
    });

    if (showWindow) {
        mainWindow.maximize();
        mainWindow.show();
        console.log('Window created and shown.');
    } else {
        console.log('Window created minimized.');
    }

    await mainWindow.loadFile('index.html');
    console.log('index.html loaded.');
    windowloaded = true;
}

let gamifyWindow; // Keep a reference to the window object

function createGamifyWindow() {
    // If the window already exists, focus it
    if (gamifyWindow) {
        gamifyWindow.focus();
        return;
    }

    gamifyWindow = new BrowserWindow({
        width: 1200,
        height: 900,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            enableRemoteModule: false,
            nodeIntegration: true // Keep consistent with mainWindow
        }
    });

    gamifyWindow.maximize();
    gamifyWindow.loadFile('json-gamify.html');

    // Optional: Open DevTools for debugging
    // gamifyWindow.webContents.openDevTools();

    gamifyWindow.on('closed', () => {
        // Dereference the window object
        gamifyWindow = null;
    });
}

async function apploader() {
    await app.whenReady().then(() => {
        console.log('App is ready.');
        fiveEToolsParser = new FiveEToolsParser(logToRenderer); // Initialize parser early

        const isGamifyLaunch = process.argv.includes('--tool=gamify');

        // Create the main window, but don't show it if we are launching the gamify tool
        createWindow(!isGamifyLaunch);

        // If it's a gamify launch, also create the gamify window
        if (isGamifyLaunch) {
            createGamifyWindow();
        }

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                createWindow(!isGamifyLaunch);
                if (isGamifyLaunch) {
                    createGamifyWindow();
                }
            }
        });
        isAppReady = true;
        ipcloader();
    });
}

ipcMain.handle('get-dnd-conditions', async () => {
    return DND_CONDITIONS;
});

apploader();



function createEmojiHpBar(creature) {
    const BAR_LENGTH = 8;
    const hp = creature.hp || 0;
    const maxHp = creature.maxHp || 1;
    const tempHp = creature.tempHp || 0;

    if (hp <= 0) {
        return hpBarEmojiMap['#6c757d'].repeat(BAR_LENGTH); // All dead blocks
    }

    const hpBlocks = Math.round((hp / maxHp) * BAR_LENGTH);
    const tempHpBlocks = Math.min(BAR_LENGTH, Math.round((tempHp / maxHp) * BAR_LENGTH)); // Cap at bar length

    const hpColorEmoji = hpBarEmojiMap[getHpColor(hp, maxHp)] || hpBarEmojiMap['#007bff'];
    const tempHpEmoji = '⭐';
    const emptyEmoji = hpBarEmojiMap['empty'];

    let bar = '';
    for (let i = 0; i < BAR_LENGTH; i++) {
        if (i < tempHpBlocks) {
            bar += tempHpEmoji;
        } else if (i < hpBlocks) {
            bar += hpColorEmoji;
        } else {
            bar += emptyEmoji;
        }
    }
    return bar;
}

function formatStatBlockForDiscord(monster) {
    // Part 1: Create the main embed with core stats
    const mainEmbed = new EmbedBuilder()
        .setColor(0x0099FF);

    let description = `# ${monster.name}\n*${monster.size} ${typeof monster.type === 'object' ? monster.type.type : monster.type}, ${monster.alignment}*\n\n`;
    const ac = monster.ac.map(a => (a.ac || a) + (a.from ? ` (${a.from.join(', ')})` : '')).join(', ');
    description += `**Armor Class** ${ac}\n`;
    description += `**Hit Points** ${monster.hp.average} (${monster.hp.formula})\n`;
    description += `**Speed** ${Object.entries(monster.speed).map(([type, val]) => `${type} ${val.number || val} ft.`).join(', ')}\n\n`;

    const formatMod = (score) => {
        const mod = Math.floor(((score || 10) - 10) / 2);
        return mod >= 0 ? `+${mod}` : `${mod}`;
    };
    description += `**STR** ${monster.str} (${formatMod(monster.str)}) | **DEX** ${monster.dex} (${formatMod(monster.dex)}) | **CON** ${monster.con} (${formatMod(monster.con)})\n`;
    description += `**INT** ${monster.int} (${formatMod(monster.int)}) | **WIS** ${monster.wis} (${formatMod(monster.wis)}) | **CHA** ${monster.cha} (${formatMod(monster.cha)})`;

    mainEmbed.setDescription(description);

    // Part 2: Prepare long fields for separate messages
    const longFields = [];
    const processEntries = (entries) => {
        if (!entries) return '';
        return entries.map(e => {
            if (typeof e === 'string') return e;
            if (e.name && e.entries) {
                 const entryText = e.entries.join(' ').replace(/{@(dice|damage|hit) ([^}]+)}/g, '($2)');
                 return `**_${e.name}._** ${entryText}`;
            }
            return '';
        }).join('\n\n');
    };

    if (monster.trait && monster.trait.length > 0) {
        longFields.push({ name: 'Traits', value: processEntries(monster.trait) });
    }
    if (monster.action && monster.action.length > 0) {
        longFields.push({ name: 'Actions', value: processEntries(monster.action) });
    }
    if (monster.legendary && monster.legendary.length > 0) {
        longFields.push({ name: 'Legendary Actions', value: processEntries(monster.legendary) });
    }
    if (monster.reaction && monster.reaction.length > 0) {
        longFields.push({ name: 'Reactions', value: processEntries(monster.reaction) });
    }

    return { mainEmbed, longFields };
}

function splitText(text, maxLength = 1024) {
    const chunks = [];
    if (!text) return chunks;

    let currentChunk = "";
    const lines = text.split('\n');

    for (const line of lines) {
        // If a single line is longer than the max length, split it forcefully
        if (line.length > maxLength) {
            if (currentChunk) {
                chunks.push(currentChunk);
                currentChunk = "";
            }
            const lineChunks = line.match(new RegExp(`.{1,${maxLength}}`, 'g')) || [];
            chunks.push(...lineChunks);
            continue;
        }

        // If adding the next line exceeds max length, push the current chunk
        if (currentChunk.length + line.length + 1 > maxLength) {
            chunks.push(currentChunk);
            currentChunk = "";
        }

        // Add the line to the current chunk
        currentChunk += (currentChunk ? '\n' : '') + line;
    }

    // Push the last remaining chunk
    if (currentChunk) {
        chunks.push(currentChunk);
    }

    return chunks;
}

async function checkAndShowReminders(creature, turnEvent) {
    if (!creature) return;

    let reminderMessages = [];
    // Check for text reminders
    const reminderText = creature.reminders ? creature.reminders[turnEvent] : '';
    if (reminderText) {
        reminderMessages.push(reminderText);
    }

    // Check for legendary action reminder on turn end
    if (turnEvent === 'end' && creature.isFriendly) {
        reminderMessages.push(`Legendary Action Reminder: End of ${creature.name}'s turn.`);
    }

    if (reminderMessages.length > 0) {
        const message = reminderMessages.join('\n\n');
        await dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: `Reminder for ${creature.name}`,
            message: `${turnEvent.charAt(0).toUpperCase() + turnEvent.slice(1)} of Turn`,
            detail: message,
            buttons: ['OK']
        });
    }
}

const InitiativeTracker = require('./InitiativeTracker.js');

async function ipcloader() {
    if (windowloaded) {
        logToRenderer('ipcloader() called.');
        initiativeTracker = new InitiativeTracker(logToRenderer, sendInitiativeUpdate, autosavePath);
        // --- All core IPC listeners should be registered after the app is ready ---
        ipcMain.on('open-gamify-tool', createGamifyWindow);

        ipcMain.handle('show-confirm-dialog', async (event, options) => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (!focusedWindow) return { response: options.cancelId || 1 }; // Default to cancel if no window
            return await dialog.showMessageBox(focusedWindow, options);
        });

        ipcMain.handle('open-task-file-dialog', async () => {
            const { filePaths } = await dialog.showOpenDialog(gamifyWindow, { // gamifyWindow should be the parent
                title: 'Select Task File',
                properties: ['openFile'],
                filters: [{ name: 'JSON Files', extensions: ['json'] }]
            });

            if (filePaths && filePaths.length > 0) {
                return filePaths[0];
            }
            return null;
        });

        ipcMain.handle('get-high-score', async () => {
            try {
                const settingsPath = path.join(__dirname, 'gamify-settings.json');
                const data = await fs.readFile(settingsPath, 'utf8');
                const settings = JSON.parse(data);
                return settings.highScore || 0;
            } catch (error) {
                if (error.code === 'ENOENT') {
                    const settingsPath = path.join(__dirname, 'gamify-settings.json');
                    await fs.writeFile(settingsPath, JSON.stringify({ highScore: 0 }, null, 2));
                    return 0;
                }
                logToRenderer(`Error reading high score: ${error}`);
                return 0;
            }
        });

        ipcMain.on('save-high-score', async (event, score) => {
            try {
                const settingsPath = path.join(__dirname, 'gamify-settings.json');
                let settings = {};
                try {
                    const data = await fs.readFile(settingsPath, 'utf8');
                    settings = JSON.parse(data);
                } catch (readError) {
                    // File might not exist, that's fine.
                }
                settings.highScore = score;
                await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
            } catch (error) {
                logToRenderer(`Error saving high score: ${error}`);
            }
        });

        async function loadTaskData(taskFilePath) {
            try {
                const data = await fs.readFile(taskFilePath, 'utf8');
                let taskData = JSON.parse(data); // Make mutable

                let { fileIndex, itemIndex } = taskData.progress;

                if (fileIndex >= taskData.files.length) {
                    return { success: true, taskComplete: true, taskData };
                }

                let itemFilePath = path.join(__dirname, taskData.files[fileIndex]);
                let itemList = JSON.parse(await fs.readFile(itemFilePath, 'utf8'));

                // Loop to find the next valid item, skipping empty files
                while (itemIndex >= itemList.length) {
                    fileIndex++;
                    itemIndex = 0;

                    if (fileIndex >= taskData.files.length) {
                        taskData.progress.fileIndex = fileIndex;
                        await fs.writeFile(taskFilePath, JSON.stringify(taskData, null, 2));
                        return { success: true, taskComplete: true, taskData };
                    }

                    itemFilePath = path.join(__dirname, taskData.files[fileIndex]);
                    itemList = JSON.parse(await fs.readFile(itemFilePath, 'utf8'));
                }

                // Update progress in the task file *before* returning
                taskData.progress.fileIndex = fileIndex;
                taskData.progress.itemIndex = itemIndex;
                await fs.writeFile(taskFilePath, JSON.stringify(taskData, null, 2));

                const item = itemList[itemIndex];
                if (!item) {
                     // This can happen if a file is empty from the start.
                     // The loop above should handle this, but as a safeguard:
                    return { success: false, error: "Encountered an empty or invalid file." };
                }

                // Try to get details if it's a spell, but don't fail if it's not
                let itemDetails = null;
                if (item.text && item.text.includes('-')) {
                    const itemName = item.text.split(' - ')[0].trim();
                    const spellDetailsResults = await fiveEToolsParser.searchByName('spells', itemName);

                    // Find the exact match from the search results
                    const exactMatch = spellDetailsResults.find(result => result.name.toLowerCase() === itemName.toLowerCase());

                    itemDetails = exactMatch ? await fiveEToolsParser.getExact('spells', exactMatch.name, exactMatch.source) : null;
                }

                return {
                    success: true,
                    taskData,
                    taskFilePath: taskFilePath, // Return the path of the loaded task
                    spell: item, // Keep 'spell' key for frontend compatibility for now
                    spellDetails: itemDetails,
                    spellCount: itemList.length,
                };
            } catch (error) {
                logToRenderer(`Error in loadTaskData for ${taskFilePath}: ${error}`);
                return { success: false, error: error.message };
            }
        }

        ipcMain.handle('load-task-by-path', async (event, filePath) => {
            // If the path is absolute (e.g., from a file dialog), use it directly.
            // Otherwise, join it with the base directory (for internal calls).
            const taskPath = path.isAbsolute(filePath) ? filePath : path.join(__dirname, filePath);
            return await loadTaskData(taskPath);
        });

        ipcMain.handle('get-task-data', async () => {
            const defaultTaskPath = path.join(__dirname, 'deck-editing-task.json');
            return await loadTaskData(defaultTaskPath);
        });

        ipcMain.handle('save-and-get-next-spell', async (event, { taskData, currentSpell, taskFilePath }) => {
            try {
                // 1. Save the current spell changes
                const currentItemFilePath = path.join(__dirname, taskData.files[taskData.progress.fileIndex]);
                const currentItemFileData = await fs.readFile(currentItemFilePath, 'utf8');
                let currentItemList = JSON.parse(currentItemFileData);
                currentItemList[taskData.progress.itemIndex] = currentSpell;
                await fs.writeFile(currentItemFilePath, JSON.stringify(currentItemList, null, 2));

                // 2. Update progress
                taskData.progress.itemIndex++;

                if (taskData.progress.itemIndex >= currentItemList.length) {
                    taskData.progress.itemIndex = 0;
                    taskData.progress.fileIndex++;
                    if (taskData.progress.fileIndex >= taskData.files.length) {
                        // Task complete!
                        await fs.writeFile(taskFilePath, JSON.stringify(taskData, null, 2));
                        return { success: true, taskComplete: true, taskData };
                    }
                }

                // 3. Save the new progress to the task file
                await fs.writeFile(taskFilePath, JSON.stringify(taskData, null, 2));

                // 4. Get the next spell and its details
                const nextFilePath = path.join(__dirname, taskData.files[taskData.progress.fileIndex]);
                const nextFileData = await fs.readFile(nextFilePath, 'utf8');
                const nextItemList = JSON.parse(nextFileData);
                const nextItem = nextItemList[taskData.progress.itemIndex];

                let nextItemDetails = null;
                if (nextItem.text && nextItem.text.includes('-')) {
                    const nextItemName = nextItem.text.split(' - ')[0].trim();
                    const spellDetailsResults = await fiveEToolsParser.searchByName('spells', nextItemName);
                    const exactMatch = spellDetailsResults.find(result => result.name.toLowerCase() === nextItemName.toLowerCase());
                    nextItemDetails = exactMatch ? await fiveEToolsParser.getExact('spells', exactMatch.name, exactMatch.source) : null;
                }

                return {
                    success: true,
                    taskData,
                    spell: nextItem,
                    spellDetails: nextItemDetails,
                    spellCount: nextItemList.length,
                };

            } catch (error) {
                logToRenderer(`Error in save-and-get-next-spell: ${error}`);
                return { success: false, error: error.message };
            }
        });

        ipcMain.handle('scrap-and-get-next-item', async (event, { taskData, currentItem, taskFilePath }) => {
            try {
                const currentItemFilePath = path.join(__dirname, taskData.files[taskData.progress.fileIndex]);
                let currentItemList = JSON.parse(await fs.readFile(currentItemFilePath, 'utf8'));

                // Use the title field for a more robust lookup
                const titleField = taskData.ui.titleField || 'name';
                const itemIndexToRemove = currentItemList.findIndex(item => item[titleField] === currentItem[titleField]);

                if (itemIndexToRemove === -1) {
                    // Fallback for safety, though it's a weak comparison
                    const fallbackIndex = currentItemList.findIndex(item => JSON.stringify(item) === JSON.stringify(currentItem));
                    if (fallbackIndex === -1) {
                        throw new Error(`Could not find the item with ${titleField} "${currentItem[titleField]}" to scrap in the file.`);
                    }
                    itemIndexToRemove = fallbackIndex;
                }

                currentItemList.splice(itemIndexToRemove, 1);
                await fs.writeFile(currentItemFilePath, JSON.stringify(currentItemList, null, 2));

                // After removing, the item at the same index is the next one.
                // We don't need to change the progress. The robust loadTaskData will handle
                // cases where the index is now out of bounds (e.g., last item deleted)
                // or the file has become empty.
                return await loadTaskData(taskFilePath);

            } catch (error) {
                logToRenderer(`Error in scrap-and-get-next-item: ${error}`);
                return { success: false, error: error.message };
            }
        });

        ipcMain.handle('undo-and-get-previous-spell', async (event, { taskData, previousSpellState, taskFilePath }) => {
            try {
                // 1. Determine the previous spell's position
                let prevFileIndex = taskData.progress.fileIndex;
                let prevItemIndex = taskData.progress.itemIndex - 1;

                if (prevItemIndex < 0) {
                    prevFileIndex--;
                    if (prevFileIndex < 0) {
                        return { success: false, error: "Already at the beginning." };
                    }
                    const prevFilePath = path.join(__dirname, taskData.files[prevFileIndex]);
                    const prevFileData = await fs.readFile(prevFilePath, 'utf8');
                    const prevSpellList = JSON.parse(prevFileData);
                    prevItemIndex = prevSpellList.length - 1;
                }

                // 2. Save the *previous* state back to the file
                const targetFilePath = path.join(__dirname, taskData.files[prevFileIndex]);
                const targetFileData = await fs.readFile(targetFilePath, 'utf8');
                let targetSpellList = JSON.parse(targetFileData);
                targetSpellList[prevItemIndex] = previousSpellState;
                await fs.writeFile(targetFilePath, JSON.stringify(targetSpellList, null, 2));

                // 3. Update progress to the previous spell's position
                taskData.progress.fileIndex = prevFileIndex;
                taskData.progress.itemIndex = prevItemIndex;

                // 4. Save the new progress to the task file
                await fs.writeFile(taskFilePath, JSON.stringify(taskData, null, 2));

                // 5. Get the details for the (now current) spell
                const spellName = previousSpellState.text.split(' - ')[0];
                const spellDetailsResults = await fiveEToolsParser.searchByName('spells', spellName);
                const spellDetails = spellDetailsResults.length > 0 ? await fiveEToolsParser.getExact('spells', spellDetailsResults[0].name, spellDetailsResults[0].source) : null;
                const spellCount = targetSpellList.length;

                return {
                    success: true,
                    taskData,
                    spell: previousSpellState,
                    spellDetails,
                    spellCount,
                };
            } catch (error) {
                logToRenderer(`Error in undo-and-get-previous-spell: ${error}`);
                return { success: false, error: error.message };
            }
        });

        ipcMain.handle('open-file-dialog', async () => {
            const { filePaths } = await dialog.showOpenDialog(mainWindow, {
                title: 'Select Music File',
                defaultPath: DEFAULT_LOCAL_FOLDER,
                properties: ['openFile'],
                filters: [
                    { name: 'Audio Files', extensions: ['mp3', 'wav', 'ogg'] }
                ]
            });

            if (filePaths && filePaths.length > 0) {
                // Here, you would typically do something with the selected file path,
                // like sending it back to the renderer process or loading the music.
                // For now, we'll just return it.
                return filePaths[0];
            }
            return null;
        });


        ipcMain.on('update-initiative', (event, { creatureId, initiative }) => {
            initiativeTracker.updateInitiative(creatureId, initiative);
        });

        ipcMain.on('push-initiative', async () => {
            logToRenderer(`'push-initiative-to-chat' invoked.`);
            const initiativeOrder = initiativeTracker.getInitiativeOrder();
            const currentTurnIndex = initiativeTracker.currentTurnIndex;
            if (initiativeOrder.length === 0) {
                logToRenderer('[push-initiative] Cannot push, initiative is empty.');
                return;
            }

            const channel = client.channels.cache.get(TEXT_CHANNEL_ID);
            if (!channel) {
                logToRenderer(`[push-initiative] FAILED to find channel with ID: ${TEXT_CHANNEL_ID}`);
                return;
            }
            logToRenderer(`[push-initiative] Found channel: ${channel.name}`);

            try {
                const embed = new EmbedBuilder()
                    .setColor(0x0099FF)
                    .setTitle('Initiative Order')
                    .setTimestamp();

                let description = '';
                initiativeOrder.forEach((creature, index) => {
                    const hpBar = createEmojiHpBar(creature);

                    let conditionEmojis = (creature.conditions || []).map(c => DND_CONDITIONS[c]?.emoji || '');
                    let conditionStr;
                    if (conditionEmojis.length > 3) {
                        conditionStr = conditionEmojis.slice(0, 3).join('') + '♾️';
                    } else {
                        conditionStr = conditionEmojis.join('');
                    }

                    const activeMarker = index === currentTurnIndex ? '`➤`' : '` `';
                    const initiativeStr = creature.initiative.toString();
                    const nameStr = (creature.name || '');

                    // New layout: Init | HP Bar | Name | Conditions
                    const line = `${activeMarker}${hpBar}${conditionStr} ${nameStr}`;
                    description += line + '\n';
                });

                embed.setDescription(description);

                logToRenderer(`[push-initiative] Attempting to send embed...`);
                await channel.send({ embeds: [embed] });
                logToRenderer('[push-initiative] Successfully pushed initiative to chat.');
            } catch (error) {
                logToRenderer(`[push-initiative] FAILED to send embed: ${error}`);
            }
        });

        ipcMain.on('next-turn', async () => {
            const turnInfo = initiativeTracker.nextTurn();
            if (turnInfo) {
                await checkAndShowReminders(turnInfo.oldCreature, 'end');
                await checkAndShowReminders(turnInfo.newCreature, 'start');
            }
        });

        ipcMain.on('copy-creature', (event, { creatureId }) => {
            const creature = initiativeTracker.getCreature(creatureId);
            if (creature) {
                mainWindow.webContents.send('populate-edit-form', creature);
            }
        });

        ipcMain.on('save-encounter', async () => {
            try {
                const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
                    title: 'Save Encounter',
                    defaultPath: app.getPath('userData'),
                    filters: [{ name: 'JSON Files', extensions: ['json'] }]
                });

                if (!canceled && filePath) {
                    initiativeTracker.saveEncounterToFile(filePath);
                }
            } catch (error) {
                logToRenderer(`Error saving encounter: ${error.message}`);
            }
        });

        ipcMain.handle('load-encounter-dialog', async () => {
            const confirmResult = await dialog.showMessageBox(mainWindow, {
                type: 'warning',
                title: 'Confirm Load',
                message: 'Are you sure you want to load a new encounter?',
                detail: 'This will overwrite the current encounter. You may want to save your current progress first.',
                buttons: ['Load Encounter', 'Cancel'],
                defaultId: 0,
                cancelId: 1
            });

            if (confirmResult.response === 1) { // User clicked 'Cancel'
                return;
            }

            const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
                title: 'Load Encounter',
                defaultPath: app.getPath('userData'),
                properties: ['openFile'],
                filters: [{ name: 'JSON Files', extensions: ['json'] }]
            });

            if (!canceled && filePaths && filePaths.length > 0) {
                const filePath = filePaths[0];
                initiativeTracker.loadEncounterFromFile(filePath);
            }
        });

        ipcMain.on('add-creature', (event, creature) => {
            const rollLogMessage = initiativeTracker.addCreature(creature);
            if (rollLogMessage) {
                mainWindow.webContents.send('dice-log', rollLogMessage);
            }
        });

        ipcMain.on('update-reminders', (event, { creatureId, reminders }) => {
            initiativeTracker.updateReminders(creatureId, reminders);
        });

        ipcMain.on('roll-stat', (event, { creatureId, rollType, stat, type }) => {
            const message = initiativeTracker.rollStat(creatureId, rollType, stat, type);
            if (message) {
                mainWindow.webContents.send('dice-log', message);
                const channel = client.channels.cache.get(TEXT_CHANNEL_ID);
                if (channel) {
                    channel.send(message);
                }
            }
        });

        ipcMain.on('roll-attack', (event, { creatureId, rollType }) => {
            const message = initiativeTracker.rollAttack(creatureId, rollType);
            if (message) {
                mainWindow.webContents.send('dice-log', message);
                const channel = client.channels.cache.get(TEXT_CHANNEL_ID);
                if (channel) {
                    channel.send(message);
                }
            }
        });

        ipcMain.on('reset-encounter', () => {
            initiativeTracker.resetEncounter();
        });

        ipcMain.on('clear-encounter', async () => {
            const result = await dialog.showMessageBox(mainWindow, {
                type: 'warning',
                title: 'Confirm Clear',
                message: 'Are you sure you want to clear the entire encounter? This cannot be undone.',
                detail: 'You may want to save the encounter first.',
                buttons: ['Clear Encounter', 'Cancel'],
                defaultId: 1,
                cancelId: 1
            });
            if (result.response === 0) { // 'Clear Encounter' button
                initiativeTracker.clearEncounter();
            }
        });

        ipcMain.on('edit-creature', (event, { creatureId }) => {
            const creature = initiativeTracker.editCreature(creatureId);
            if (creature) {
                mainWindow.webContents.send('populate-edit-form', creature);
            }
        });

        ipcMain.on('remove-creature', (event, { creatureId }) => {
            initiativeTracker.removeCreature(creatureId);
        });

        ipcMain.on('previous-turn', async () => {
            const turnInfo = initiativeTracker.previousTurn();
            if (turnInfo) {
                await checkAndShowReminders(turnInfo.oldCreature, 'end');
                await checkAndShowReminders(turnInfo.newCreature, 'start');
            }
        });

        ipcMain.on('add-temp-hp', (event, { creatureId, amount }) => {
            initiativeTracker.addTempHp(creatureId, amount);
        });

        ipcMain.on('update-hp', (event, { creatureId, amount }) => {
            const result = initiativeTracker.updateHp(creatureId, amount);
            if (result && result.concentrationCheckDC) {
                dialog.showMessageBox(mainWindow, { type: 'warning', title: 'Concentration Check', message: `${result.creature.name} must make a DC ${result.concentrationCheckDC} Constitution saving throw.`, buttons: ['OK']});
            }
        });

        ipcMain.on('add-condition', (event, { creatureId, condition }) => {
            logToRenderer(`Adding condition ${condition} to creature ${creatureId}`);
            initiativeTracker.addCondition(creatureId, condition);
        });

        ipcMain.on('remove-condition', (event, { creatureId, condition }) => {
            initiativeTracker.removeCondition(creatureId, condition);
        });

        ipcMain.on('update-creature-flag', (event, { creatureId, flag, value }) => {
            initiativeTracker.updateCreatureFlag(creatureId, flag, value);
        });

        ipcMain.handle('search-monsters', async (event, query) => {
            logToRenderer(`[IPC] Received "search-monsters" with query: "${query}"`);
            if (!fiveEToolsParser) {
                logToRenderer('[IPC] Parser not available.');
                return [];
            }
            const results = await fiveEToolsParser.searchByName('bestiary', query);
            logToRenderer(`[IPC] Found ${results.length} monsters, returning to renderer.`);
            return results;
        });

        ipcMain.handle('get-monster-details', async (event, { name, source }) => {
            logToRenderer(`[IPC] Received "get-monster-details" for: ${name} (${source})`);
            if (!fiveEToolsParser) {
                 logToRenderer('[IPC] Parser not available.');
                return null;
            }
            const monster = await fiveEToolsParser.getExact('bestiary', name, source);
            logToRenderer(`[IPC] Found monster details, returning to renderer.`);
            return monster;
        });

        ipcMain.on('push-dicelog-to-discord', async (event, logContent) => {
            const channel = client.channels.cache.get(TEXT_CHANNEL_ID);
            if (!channel) {
                logToRenderer(`[push-dicelog] FAILED to find channel with ID: ${TEXT_CHANNEL_ID}`);
                return;
            }
            try {
                const embed = new EmbedBuilder()
                    .setColor(0x0099FF)
                    .setTitle('Dice Rolls')
                    .setDescription(logContent)
                    .setTimestamp();
                await channel.send({ embeds: [embed] });
                logToRenderer('[push-dicelog] Successfully pushed dice log to chat.');
            } catch (error) {
                logToRenderer(`[push-dicelog] FAILED to send embed: ${error}`);
            }
        });

        ipcMain.on('push-statblock-to-discord', async (event, rawDataString) => {
            const channel = client.channels.cache.get(TEXT_CHANNEL_ID);
            if (!channel) {
                logToRenderer(`[push-statblock] FAILED to find channel with ID: ${TEXT_CHANNEL_ID}`);
                return;
            }
            try {
                const monster = JSON.parse(rawDataString);
                const { mainEmbed, longFields } = formatStatBlockForDiscord(monster);

                // Send the main embed
                const mainMessage = await channel.send({ embeds: [mainEmbed] });
                logToRenderer('[push-statblock] Successfully pushed main stat block embed.');

                // If there are long fields, create a thread and post them
                if (longFields.length > 0) {
                    const thread = await mainMessage.startThread({
                        name: `${monster.name} - Details`,
                        autoArchiveDuration: 60,
                    });

                    for (const field of longFields) {
                        const chunks = splitText(field.value, 1024);
                        for (let i = 0; i < chunks.length; i++) {
                            const chunkEmbed = new EmbedBuilder()
                                .setColor(0x0099FF)
                                .setTitle(chunks.length > 1 ? `${field.name} (${i + 1}/${chunks.length})` : field.name)
                                .setDescription(chunks[i]);
                            await thread.send({ embeds: [chunkEmbed] });
                        }
                    }
                    logToRenderer(`[push-statblock] Sent ${longFields.length} detail section(s) to thread.`);
                }
            } catch (error) {
                logToRenderer(`[push-statblock] FAILED to send embed: ${error}`);
            }
        });
    }
    else {
        logToRenderer('ipcloader() waiting for window to load...');
        await sleep(100);
        ipcloader();
    }  
}

// Function to send log messages to the renderer
async function logToRenderer(message) {
    if (isAppReady) {
        mainWindow.webContents.send('log-message', message);
    }
    else {
        await sleep(100);
        logToRenderer(message);
    }
}
musicPlayer = new BackendAudioPlayer(logToRenderer, shell);
musicPlayer.on('status-change', (status) => {
    if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('music-player-status', status);
    }
});

/*
client.on('error', error => {
    logToRenderer('An error occurred: ', error);
});
*/

client.once('clientReady', async () => {
    const shutdown = async () => {
        try {
            console.log('Cleaning up and exiting.');
            // Remove all event listeners
            client.removeAllListeners();
            if (musicPlayer && musicPlayer.player) {
                musicPlayer.player.removeAllListeners();
            }
            if (connection) {
                connection.removeAllListeners();
            }
            app.removeAllListeners();
            ipcMain.removeAllListeners();

            // Close any other resources, e.g., voice connections
            if (connection) {
                connection.destroy();
            }

            // Optionally logout
            await client.destroy();

            app.quit();
        }
        catch (error) {
            console.log('Error during shutdown:', error);
        }
    };
    app.on('before-quit', shutdown);

    logToRenderer('TavernTones is online!');

    //Connect to the voice channel
    const voiceChannel = client.channels.cache.get(VOICE_CHANNEL_ID);
    if (voiceChannel && voiceChannel.isVoiceBased()) {
        try {
            connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: voiceChannel.guild.id,
                adapterCreator: voiceChannel.guild.voiceAdapterCreator,
            });

            // Listen for connection status changes
            connection.on(VoiceConnectionStatus.Ready, () => {
                logToRenderer('The bot has connected to the channel!');
                musicPlayer.setConnection(connection); // Pass connection to the player
            });

            connection.on(VoiceConnectionStatus.Disconnected, () => {
                logToRenderer('The bot has been disconnected. Attempting to reconnect...');
                setTimeout(() => {
                    joinVoiceChannel({
                        channelId: voiceChannel.id,
                        guildId: voiceChannel.guild.id,
                        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
                    });
                }, 5000);
            });

            connection.on(VoiceConnectionStatus.Signalling, () => {
                logToRenderer('The bot is attempting to establish a connection.');
            });

            connection.on(VoiceConnectionStatus.Destroyed, () => {
                logToRenderer('The connection has been destroyed.');
            });

            logToRenderer(`Joined voice channel: ${voiceChannel.name}: ${connection.state.status}`);

            await entersState(connection, VoiceConnectionStatus.Ready, 60000);
            logToRenderer('Connection is ready!');
        }
        catch (error) {
            logToRenderer('Error joining voice channel: ', error);
        }
    }
    else {
        logToRenderer('Voice channel not found or is not a voice channel!');
    }

    // Simplified IPC Handlers
    ipcMain.on('play-music', (event, filePathFromRenderer) => {
        logToRenderer(`IPC 'play-music' received for: ${filePathFromRenderer || 'current track'}`);
        musicPlayer.playFile(filePathFromRenderer);
    });

    ipcMain.on('pause-music', () => {
        logToRenderer(`IPC 'pause-music' received.`);
        musicPlayer.pause();
    });

    logToRenderer(`Logged in as ${client.user.tag}`);

    const commandHandler = new CommandHandler(client, logToRenderer, musicPlayer, { BOT_ROLE_ID, DEFAULT_LOCAL_FOLDER }, fiveEToolsParser);
    client.commandHandler = commandHandler; // Attach commandHandler to the client object
    client.on('messageCreate', message => commandHandler.handleMessage(message));

    client.on('interactionCreate', async interaction => {
        if (interaction.isStringSelectMenu()) {
            const { customId, values, message } = interaction;
            const [customIdBase] = customId.split('|');

            if (customIdBase.startsWith('trap-')) {
                const selections = trapSelections.get(interaction.message.id) || {};
                const type = customIdBase.replace('trap-', '').replace('-select', '');

                if (values[0] === 'random') {
                    delete selections[type];
                } else {
                    selections[type] = values[0];
                }

                trapSelections.set(interaction.message.id, selections);
                await _updateTrapComponents(interaction, selections);
                return;
            }

            if (customIdBase.startsWith('npc-')) {
                const selections = npcSelections.get(interaction.message.id) || {};
                const value = values[0];

                if (value.startsWith('!page_')) {
                    const newPage = parseInt(value.split('_')[1], 10);
                    await _updateNpcComponents(interaction, selections, { dropdownToUpdate: customIdBase, newPage: newPage });
                    return;
                }

                const type = customIdBase.replace('npc-', '').replace('-select', '');
                selections[type] = value;

                // If a species/class was changed, reset the sub-selection
                if (type === 'species') delete selections.lineage;
                if (type === 'class') delete selections.subclass;

                npcSelections.set(interaction.message.id, selections);
                await _updateNpcComponents(interaction, selections);
                return;
            }

            if (customId === 'vehicle-tag-select') {
                const selections = vehicleSelections.get(message.id) || {};
                selections.tag = values[0];
                vehicleSelections.set(message.id, selections);
                await interaction.deferUpdate();
                return;
            }

            if (customId === 'vehicle-style-select') {
                const selections = vehicleSelections.get(message.id) || {};
                selections.style = values[0];
                vehicleSelections.set(message.id, selections);
                await interaction.deferUpdate();
                return;
            }

            if (customId === 'encounter-creature-select') {
                const selections = encounterSelections.get(message.id) || {};
                selections.creature = values[0];
                encounterSelections.set(message.id, selections);
                await interaction.deferUpdate();
                return;
            }

            if (customId === 'encounter-difficulty-select') {
                const selections = encounterSelections.get(message.id) || {};
                selections.difficulty = values[0];
                encounterSelections.set(message.id, selections);
                await interaction.deferUpdate();
                return;
            }

            if (customId === '5e-result-select') {
                await interaction.deferUpdate();
                const [category, source, name] = values[0].split('__');

                const item = await fiveEToolsParser.getExact(category, name, source);

                if (item) {
                    const embed = format5eResult(item);
                    await interaction.editReply({ embeds: [embed], components: [] }); // Remove the dropdown
                } else {
                    await interaction.editReply({ content: 'Sorry, I couldn\'t retrieve the details for that item.', components: [] });
                }
                return; // Stop further processing for this interaction
            }

            const [prefix, selectType] = customId.split('-');

            if (prefix === 'ma') {
                // Update state
                const selections = maSelections.get(message.id) || { mode: 'loot', size: 'Average' };
                selections[selectType] = values[0];
                maSelections.set(message.id, selections);
                logToRenderer(`[MA Command] Selections updated: ${JSON.stringify(selections)}`);

                // Get current full state
                const currentMode = selections.mode;
                const currentSize = selections.size;

                // Rebuild mode select menu
                const modeSelect = new StringSelectMenuBuilder()
                    .setCustomId('ma-mode-select')
                    .setPlaceholder('Select Mode')
                    .addOptions([
                        { label: 'Loot', value: 'loot', default: currentMode === 'loot' },
                        { label: 'Shop', value: 'shop', default: currentMode === 'shop' }
                    ]);

                // Rebuild size select menu
                const sizeSelect = new StringSelectMenuBuilder()
                    .setCustomId('ma-size-select')
                    .setPlaceholder('Select Size')
                    .addOptions([
                        { label: 'Huge', value: 'Huge', default: currentSize === 'Huge' },
                        { label: 'Large', value: 'Large', default: currentSize === 'Large' },
                        { label: 'Average', value: 'Average', default: currentSize === 'Average' },
                        { label: 'Small', value: 'Small', default: currentSize === 'Small' },
                        { label: 'Tiny', value: 'Tiny', default: currentSize === 'Tiny' }
                    ]);

                // Rebuild button row
                const configureButton = new ButtonBuilder()
                    .setCustomId('ma-configure-button')
                    .setLabel('Configure & Generate')
                    .setStyle(ButtonStyle.Primary);

                const cancelButton = new ButtonBuilder()
                    .setCustomId('ma-cancel-button')
                    .setLabel('Cancel')
                    .setStyle(ButtonStyle.Secondary);

                // Package into ActionRows
                const row1 = new ActionRowBuilder().addComponents(modeSelect);
                const row2 = new ActionRowBuilder().addComponents(sizeSelect);
                const row3 = new ActionRowBuilder().addComponents(configureButton, cancelButton);

                // Update the message
                await interaction.update({ components: [row1, row2, row3] });
            }
            return;
        }

        if (interaction.isButton()) {
            if (interaction.customId === 'trap-proceed-button') {
                await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
                const selections = trapSelections.get(interaction.message.id) || {};
                const trap = await fiveEToolsParser.generateTrap(selections);

                if (!trap) {
                    await interaction.editReply({ content: 'Could not find a trap matching your criteria. Please try broadening your search.' });
                    return;
                }

                const embed = new EmbedBuilder()
                    .setColor(0xE74C3C) // Red for traps
                    .setTitle(`Trap: ${trap.name}`)
                    .setDescription(formatEntries(trap.entries));

                await interaction.channel.send({ embeds: [embed] });
                await interaction.editReply({ content: 'Trap generated!' });
                trapSelections.delete(interaction.message.id);
                return;
            }

            if (interaction.customId === 'npc-proceed-button') {
                const selections = npcSelections.get(interaction.message.id) || {};
                if (selections.mode === 'npc') {
                    const modal = new ModalBuilder()
                        .setCustomId(`npc-modal-${interaction.message.id}`)
                        .setTitle('NPC Details');
                    const partyLevelInput = new TextInputBuilder()
                        .setCustomId('partyLevel')
                        .setLabel("Average Party Level (1-20)")
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true);
                    modal.addComponents(new ActionRowBuilder().addComponents(partyLevelInput));
                    await interaction.showModal(modal);
                } else {
                    // Directly generate character idea
                    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
                    await _handleNpcGeneration(interaction, selections);
                    npcSelections.delete(interaction.message.id);
                }
                return;
            }

            if (interaction.customId === 'vehicle-proceed-button') {
                const selections = vehicleSelections.get(interaction.message.id) || {};

                const modal = new ModalBuilder()
                    .setCustomId(`vehicle-modal|${selections.tag || 'random'}|${selections.style || 'random'}`)
                    .setTitle('Vehicle Encounter Details');

                const totalHpInput = new TextInputBuilder()
                    .setCustomId('totalHp')
                    .setLabel("Total Vehicle HP Budget")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const numVehiclesInput = new TextInputBuilder()
                    .setCustomId('numVehicles')
                    .setLabel("Ideal Number of Vehicles")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                modal.addComponents(new ActionRowBuilder().addComponents(totalHpInput));
                modal.addComponents(new ActionRowBuilder().addComponents(numVehiclesInput));

                await interaction.showModal(modal);
                return;
            }

            if (interaction.customId.startsWith('encounter-proceed-button')) {
                const parts = interaction.customId.split('|');
                const selections = encounterSelections.get(interaction.message.id) || {};

                let modalCustomId;
                if (parts.length > 1 && parts[1] === 'type') {
                    // Type-based encounter
                    const type = parts[2];
                    if (!selections.difficulty) {
                        await interaction.reply({ content: 'Please select a difficulty before proceeding.', flags: [MessageFlags.Ephemeral] });
                        return;
                    }
                    modalCustomId = `encounter-modal|type|${type}|${selections.difficulty}`;
                } else {
                    // Creature-based encounter
                    if (!selections.creature || !selections.difficulty) {
                        await interaction.reply({ content: 'Please select a creature and a difficulty before proceeding.', flags: [MessageFlags.Ephemeral] });
                        return;
                    }
                    modalCustomId = `encounter-modal|creature|${selections.creature}|${selections.difficulty}`;
                }

                const modal = new ModalBuilder()
                    .setCustomId(modalCustomId)
                    .setTitle('Encounter Details');

                const partyLevelInput = new TextInputBuilder()
                    .setCustomId('partyLevel')
                    .setLabel("Average Party Level (1-20)")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const partySizeInput = new TextInputBuilder()
                    .setCustomId('partySize')
                    .setLabel("Number of Party Members")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const multiplierInput = new TextInputBuilder()
                    .setCustomId('multiplier')
                    .setLabel("Difficulty Multiplier (optional, default 1.0)")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(partyLevelInput),
                    new ActionRowBuilder().addComponents(partySizeInput),
                    new ActionRowBuilder().addComponents(multiplierInput)
                );

                await interaction.showModal(modal);
                // Clean up the selections map after use
                encounterSelections.delete(interaction.message.id);
                return;
            }

            if (interaction.customId === 'ma-cancel-button') {
                maSelections.delete(interaction.message.id);

                const originalRows = interaction.message.components;
                const row1 = new ActionRowBuilder().addComponents(originalRows[0].components);
                const row2 = new ActionRowBuilder().addComponents(originalRows[1].components);

                const configureButton = new ButtonBuilder()
                    .setCustomId('ma-configure-button')
                    .setLabel('Configure & Generate')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(true);

                const cancelButton = new ButtonBuilder()
                    .setCustomId('ma-cancel-button')
                    .setLabel('Cancelled')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true);

                const row3 = new ActionRowBuilder().addComponents(configureButton, cancelButton);

                await interaction.update({ components: [row1, row2, row3] });
                return;
            }

            if (interaction.customId.startsWith('vehicle-rerun')) {
                await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
                const [, tag, name, source, hp] = interaction.customId.split('|');

                // We're just generating a single vehicle, so a "balanced" encounter with numVehicles: 1 works perfectly.
                const result = await client.commandHandler.vehicleEncounterBuilder.generateEncounter({
                    tag,
                    style: 'balanced',
                    totalHp: parseInt(hp, 10),
                    numVehicles: 1
                });

                if (result.error) {
                    await interaction.editReply({ content: `Error on rerun: ${result.error}` });
                    return;
                }

                // This section is duplicated from the successful modal submit, could be refactored.
                const summaryEmbed = new EmbedBuilder()
                    .setColor(0x2ECC71)
                    .setTitle(`Vehicle Encounter Generated! (Balanced)`)
                    .setDescription(`**Tag:** ${tag}\n**HP Budget:** ${result.totalValue.toLocaleString()} / ${result.budget.toLocaleString()}`)
                    .addFields({ name: 'Vehicles', value: result.encounter.map(v => `• ${v.name} (HP: ${v.hp})`).join('\n') || 'None' });

                const originalMessage = await interaction.channel.send({ embeds: [summaryEmbed] });
                const thread = await originalMessage.startThread({
                    name: `Vehicle Encounter Details (Balanced)`,
                    autoArchiveDuration: 60,
                });

                for (const vehicle of result.encounter) {
                     const fullVehicleData = await fiveEToolsParser.getExact('vehicles', vehicle.name, vehicle.source);
                     const vehicleDetails = `**${fullVehicleData.name}**\n` +
                                           `AC: ${fullVehicleData.ac[0].ac || 'N/A'}\n` +
                                           `HP: ${fullVehicleData.hp.average || 'N/A'}\n` +
                                           `Crew: ${fullVehicleData.capCrew || 'N/A'}`;
                    await thread.send(vehicleDetails);
                }
                await interaction.editReply({ content: `Vehicle encounter generated! You can view it here: ${originalMessage.url}` });
                return;
            }

            if (interaction.customId === 'ma-configure-button') {
                const modal = new ModalBuilder()
                    .setCustomId(`ma-config-modal-${interaction.message.id}`)
                    .setTitle('Configure Magic Item Generation');

                const nicknameInput = new TextInputBuilder()
                    .setCustomId('ma-nickname-input')
                    .setLabel("Nickname (Optional)")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false);

                const numRollsInput = new TextInputBuilder()
                    .setCustomId('ma-numrolls-input')
                    .setLabel("Number of Items (e.g., 5 or 1d4+1)")
                    .setStyle(TextInputStyle.Short)
                    .setValue('10')
                    .setRequired(true);

                const partyLevelInput = new TextInputBuilder()
                    .setCustomId('ma-partylevel-input')
                    .setLabel("Average Party Level")
                    .setStyle(TextInputStyle.Short)
                    .setValue('20')
                    .setRequired(true);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(nicknameInput),
                    new ActionRowBuilder().addComponents(numRollsInput),
                    new ActionRowBuilder().addComponents(partyLevelInput)
                );

                await interaction.showModal(modal);
                return;
            }
        }

async function _handleNpcGeneration(interaction, selections) {
    // Translate the selections from the interaction into the format NpcGenerator expects
    const generatorOptions = {
        mode: selections.mode,
        species: selections.species,
        lineage: selections.lineage,
        class: selections.class,
        subclass: selections.subclass,
        background: selections.background,
        partyLevel: selections.partyLevel,
    };

    const result = await client.commandHandler.npcGenerator.generateCharacter(generatorOptions);
    if (result.error) {
        await interaction.editReply({ content: `Error: ${result.error}` });
        return;
    }
    const embed = formatNpcResult(result);
    await interaction.channel.send({ embeds: [embed] });
    await interaction.editReply({ content: 'Generation complete!' });
}

async function _updateTrapComponents(interaction, selections) {
    await interaction.deferUpdate();

    const allTraps = await fiveEToolsParser._loadCategoryData('traps');

    const createDropdown = (id, placeholder, allOptions, selectedValue, filterKey) => {
        const otherSelections = { ...selections };
        delete otherSelections[filterKey];

        const availableOptions = allOptions.map(opt => {
            if (opt.value === 'random') return { ...opt, disabled: false };

            let filteredTraps = allTraps;
            // Filter by all OTHER active selections
            for (const [key, value] of Object.entries(otherSelections)) {
                if (value && value !== 'random') {
                    if (key === 'tier') filteredTraps = filteredTraps.filter(t => t.rating?.some(r => r.tier === parseInt(value)));
                    else if (key === 'threat') filteredTraps = filteredTraps.filter(t => t.rating?.some(r => r.threat.toLowerCase() === value));
                    else if (key === 'type') filteredTraps = filteredTraps.filter(t => t.trapHazType === value);
                }
            }

            // Now, check if any of the remaining traps match the CURRENT option
            let isPossible = false;
            if (filterKey === 'tier') isPossible = filteredTraps.some(t => t.rating?.some(r => r.tier === parseInt(opt.value)));
            else if (filterKey === 'threat') isPossible = filteredTraps.some(t => t.rating?.some(r => r.threat.toLowerCase() === opt.value));
            else if (filterKey === 'type') isPossible = filteredTraps.some(t => t.trapHazType === opt.value);
            else isPossible = true; // Environment is not strictly enforced by data, so we don't disable

            return { ...opt, default: opt.value === selectedValue, disabled: !isPossible };
        });

        return new StringSelectMenuBuilder()
            .setCustomId(id)
            .setPlaceholder(placeholder)
            .addOptions(availableOptions);
    };

    const tierOpts = [
        { label: 'Any Tier', value: 'random' }, { label: 'Tier 1 (Levels 1-4)', value: '1' },
        { label: 'Tier 2 (Levels 5-10)', value: '2' }, { label: 'Tier 3 (Levels 11-16)', value: '3' },
        { label: 'Tier 4 (Levels 17-20)', value: '4' }
    ];
    const threatOpts = [
        { label: 'Any Threat', value: 'random' }, { label: 'Setback', value: 'setback' },
        { label: 'Dangerous', value: 'dangerous' }, { label: 'Deadly', value: 'deadly' }
    ];
    const typeOpts = [
        { label: 'Any Type', value: 'random' }, { label: 'Mechanical', value: 'MECH' },
        { label: 'Magical', value: 'MAG' }, { label: 'Simple', value: 'SMPL' }
    ];
    const envOpts = [
        { label: 'Any Environment', value: 'random' }, { label: 'Dungeon / Tomb', value: 'dungeon' },
        { label: 'Wilderness / Cave', value: 'wilderness' }, { label: 'Urban / Building', value: 'urban' },
        { label: 'Planar / Magical', value: 'planar' }, { label: 'Aquatic', value: 'aquatic' }
    ];

    const tierSelect = createDropdown('trap-tier-select', selections.tier ? tierOpts.find(o=>o.value===selections.tier).label : 'Select Party Tier (Optional)', tierOpts, selections.tier, 'tier');
    const threatSelect = createDropdown('trap-threat-select', selections.threat ? threatOpts.find(o=>o.value===selections.threat).label : 'Select Threat Level (Optional)', threatOpts, selections.threat, 'threat');
    const typeSelect = createDropdown('trap-type-select', selections.type ? typeOpts.find(o=>o.value===selections.type).label : 'Select Trap Type (Optional)', typeOpts, selections.type, 'type');
    const environmentSelect = createDropdown('trap-environment-select', selections.environment ? envOpts.find(o=>o.value===selections.environment).label : 'Select Environment (Optional)', envOpts, selections.environment, 'environment');

    const proceedButton = new ButtonBuilder().setCustomId('trap-proceed-button').setLabel('Generate').setStyle(ButtonStyle.Success);

    await interaction.editReply({
        components: [
            new ActionRowBuilder().addComponents(tierSelect),
            new ActionRowBuilder().addComponents(threatSelect),
            new ActionRowBuilder().addComponents(typeSelect),
            new ActionRowBuilder().addComponents(environmentSelect),
            new ActionRowBuilder().addComponents(proceedButton),
        ]
    });
}

async function _updateNpcComponents(interaction, selections, updateOptions = {}) {
    await interaction.deferUpdate();

    const components = [];

    // --- Mode Dropdown ---
    const modeSelect = new StringSelectMenuBuilder()
        .setCustomId('npc-mode-select')
        .setPlaceholder('Select Mode')
        .addOptions([
            { label: 'Character Idea', value: 'idea', default: selections.mode === 'idea' },
            { label: 'NPC (with Stat Block)', value: 'npc', default: selections.mode === 'npc' }
        ]);
    components.push(new ActionRowBuilder().addComponents(modeSelect));

    // --- Species Dropdown ---
    const speciesList = await fiveEToolsParser.getSpecies();
    const speciesOptions = speciesList.map(s => ({
        label: `${s.name} (${s.source})`,
        value: `species|${s.name}|${s.source}`
    })).sort((a, b) => a.label.localeCompare(b.label));
    const speciesHandler = new DropdownHandler({
        customId: 'npc-species-select',
        options: speciesOptions,
        placeholder: selections.species ? selections.species.split('|')[1] : 'Select a Species (Optional)',
        topPinned: [{ label: 'Any Species (Random)', value: 'random' }]
    });
    const speciesPage = updateOptions.dropdownToUpdate === 'npc-species-select' ? updateOptions.newPage : 1;
    components.push(speciesHandler.createActionRow(speciesPage));

    // --- Lineage Dropdown (if species is selected) ---
    if (selections.species && selections.species !== 'random') {
        const [, speciesName, speciesSource] = selections.species.split('|');
        const lineageList = await fiveEToolsParser.getLineages(speciesName, speciesSource);
        if (lineageList.length > 0) {
            const lineageOptions = lineageList.map(l => ({
                label: `${l.name} (${l.source})`,
                value: `lineage|${l.name}|${l.source}`
            })).sort((a, b) => a.label.localeCompare(b.label));
            const lineageHandler = new DropdownHandler({
                customId: 'npc-lineage-select',
                options: lineageOptions,
                placeholder: selections.lineage ? selections.lineage.split('|')[1] : 'Select a Lineage (Optional)',
                topPinned: [{ label: 'Any Lineage (Random)', value: 'random' }]
            });
            const lineagePage = updateOptions.dropdownToUpdate === 'npc-lineage-select' ? updateOptions.newPage : 1;
            components.push(lineageHandler.createActionRow(lineagePage));
        }
    }

    // --- Class Dropdown ---
    const classList = await fiveEToolsParser.getClasses();
    const classOptions = classList.map(c => ({
        label: `${c.name} (${c.source})`,
        value: `class|${c.name}|${c.source}`
    })).sort((a, b) => a.label.localeCompare(b.label));
    const classHandler = new DropdownHandler({
        customId: 'npc-class-select',
        options: classOptions,
        placeholder: selections.class ? selections.class.split('|')[1] : 'Select a Class (Optional)',
        topPinned: [{ label: 'Any Class (Random)', value: 'random' }]
    });
    const classPage = updateOptions.dropdownToUpdate === 'npc-class-select' ? updateOptions.newPage : 1;
    components.push(classHandler.createActionRow(classPage));

    // --- Subclass Dropdown (if class is selected) ---
    if (selections.class && selections.class !== 'random') {
        const [, className, classSource] = selections.class.split('|');
        const subclass_list = await fiveEToolsParser.getSubclasses(className, classSource);
        if (subclass_list.length > 0) {
            const subclassOptions = subclass_list.map(sc => ({
                label: `${sc.name} (${sc.source})`,
                value: `subclass|${sc.name}|${sc.source}`
            })).sort((a, b) => a.label.localeCompare(b.label));
            const subclassHandler = new DropdownHandler({
                customId: 'npc-subclass-select',
                options: subclassOptions,
                placeholder: selections.subclass ? selections.subclass.split('|')[1] : 'Select a Subclass (Optional)',
                topPinned: [{ label: 'Any Subclass (Random)', value: 'random' }]
            });
            const subclassPage = updateOptions.dropdownToUpdate === 'npc-subclass-select' ? updateOptions.newPage : 1;
            components.push(subclassHandler.createActionRow(subclassPage));
        }
    }

    // --- Background Dropdown ---
    const backgroundList = await fiveEToolsParser._loadCategoryData('backgrounds');
    const backgroundOptions = backgroundList.map(b => ({
        label: `${b.name} (${b.source})`,
        value: `background|${b.name}|${b.source}`
    })).sort((a, b) => a.label.localeCompare(b.label));
    const backgroundHandler = new DropdownHandler({
        customId: 'npc-background-select',
        options: backgroundOptions,
        placeholder: selections.background ? selections.background.split('|')[1] : 'Select a Background (Optional)',
        topPinned: [{ label: 'Any Background (Random)', value: 'random' }]
    });
    const backgroundPage = updateOptions.dropdownToUpdate === 'npc-background-select' ? updateOptions.newPage : 1;
    components.push(backgroundHandler.createActionRow(backgroundPage));

    // --- Generate Button ---
    const proceedButton = new ButtonBuilder()
        .setCustomId('npc-proceed-button')
        .setLabel('Generate')
        .setStyle(ButtonStyle.Success);
    components.push(new ActionRowBuilder().addComponents(proceedButton));

    await interaction.editReply({ components: components.slice(0, 5) }); // Max 5 action rows
}

        if (interaction.isModalSubmit()) {
            if (interaction.customId.startsWith('tda_ante_modal')) {
                return client.commandHandler.tdaManager.handleAnteModalSubmit(interaction);
            }

            if (interaction.customId.startsWith('npc-modal-')) {
                const messageId = interaction.customId.replace('npc-modal-', '');
                const selections = npcSelections.get(messageId) || {};
                selections.partyLevel = parseInt(interaction.fields.getTextInputValue('partyLevel'), 10);

                await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
                await _handleNpcGeneration(interaction, selections);
                npcSelections.delete(messageId);
                return;
            }

            if (interaction.customId.startsWith('vehicle-modal|')) {
                await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

                const parts = interaction.customId.split('|');
                const tag = parts[1];
                let style = parts[2];

                if (style === 'random') {
                    style = ['flagship', 'balanced'][Math.floor(Math.random() * 2)];
                }

                const totalHp = parseInt(interaction.fields.getTextInputValue('totalHp'), 10);
                const numVehicles = parseInt(interaction.fields.getTextInputValue('numVehicles'), 10);

                if (isNaN(totalHp) || totalHp <= 0 || isNaN(numVehicles) || numVehicles <= 0) {
                    await interaction.editReply({ content: 'Invalid Total HP. Please provide a positive number.' });
                    return;
                }
                if (style === 'balanced' && (isNaN(numVehicles) || numVehicles <= 0)) {
                    await interaction.editReply({ content: 'Invalid Number of Vehicles. Please provide a positive number for a balanced fight.' });
                    return;
                }

                const result = await client.commandHandler.vehicleEncounterBuilder.generateEncounter({
                    tag,
                    style,
                    totalHp,
                    numVehicles
                });

                if (result.error) {
                    let components = [];
                    let content = `Error: ${result.error}`;

                    if (result.lower || result.higher) {
                        const buttonRow = new ActionRowBuilder();
                        content += `\nWould you like to try generating a single-vehicle encounter with the closest option?`;
                        if (result.lower) {
                            content += `\n- Closest Lower: ${result.lower.name} (${result.lower.hp} HP)`;
                            buttonRow.addComponents(
                                new ButtonBuilder()
                                    .setCustomId(`vehicle-rerun|${tag}|${result.lower.name}|${result.lower.source}|${result.lower.hp}`)
                                    .setLabel(`Use ${result.lower.name}`)
                                    .setStyle(ButtonStyle.Primary)
                            );
                        }
                        if (result.higher) {
                            content += `\n- Closest Higher: ${result.higher.name} (${result.higher.hp} HP)`;
                            buttonRow.addComponents(
                                new ButtonBuilder()
                                    .setCustomId(`vehicle-rerun|${tag}|${result.higher.name}|${result.higher.source}|${result.higher.hp}`)
                                    .setLabel(`Use ${result.higher.name}`)
                                    .setStyle(ButtonStyle.Primary)
                            );
                        }
                        components.push(buttonRow);
                    }
                    await interaction.editReply({ content, components });
                    return;
                }

                // Fancier formatting
                const summaryEmbed = new EmbedBuilder()
                    .setColor(0x2ECC71)
                    .setTitle(`Vehicle Encounter Generated! (${style})`)
                    .setDescription(`**Tag:** ${tag}\n**HP Budget:** ${result.totalValue.toLocaleString()} / ${result.budget.toLocaleString()}`)
                    .addFields({
                        name: 'Vehicles',
                        value: result.encounter.map(v => `• ${v.name} (HP: ${v.hp})`).join('\n') || 'None'
                    });

                const originalMessage = await interaction.channel.send({ embeds: [summaryEmbed] });
                const thread = await originalMessage.startThread({
                    name: `Vehicle Encounter Details (${style})`,
                    autoArchiveDuration: 60,
                });

                for (const vehicle of result.encounter) {
                    const vehicleDetails = `**${vehicle.name}**\n` +
                                           `AC: ${vehicle.ac}\n` +
                                           `HP: ${vehicle.hp}\n` +
                                           `Crew: ${vehicle.capCrew || 'N/A'}`;
                    await thread.send(vehicleDetails);
                }

                await interaction.editReply({ content: `Vehicle encounter generated! You can view it here: ${originalMessage.url}` });
                return;
            }

            if (interaction.customId.startsWith('encounter-modal|')) {
                await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

                const parts = interaction.customId.split('|');
                const encounterType = parts[1];
                const difficulty = parts.pop();

                const partyLevel = parseInt(interaction.fields.getTextInputValue('partyLevel'), 10);
                const partySize = parseInt(interaction.fields.getTextInputValue('partySize'), 10);
                const multiplier = parseFloat(interaction.fields.getTextInputValue('multiplier')) || 1.0;

                if (isNaN(partyLevel) || isNaN(partySize) || partyLevel < 1 || partyLevel > 20 || partySize < 1) {
                    await interaction.editReply({ content: 'Invalid party level or size. Level must be 1-20, and size must be at least 1.' });
                    return;
                }

                let encounterParams = { partyLevel, partySize, difficulty, multiplier };
                let mainCreature;

                if (encounterType === 'creature') {
                    const creatureValue = parts.slice(2).join('|');
                    const [category, source, name] = creatureValue.split('|');
                    mainCreature = await fiveEToolsParser.getExact(category, name, source);
                    if (!mainCreature) {
                        await interaction.editReply({ content: 'Sorry, I couldn\'t retrieve the details for the selected creature.' });
                        return;
                    }
                    mainCreature.xp = client.commandHandler.encounterBuilder.crToXp[mainCreature.cr] || 0;
                    mainCreature.type = typeof mainCreature.type === 'object' ? mainCreature.type.type : mainCreature.type;
                    encounterParams.mainCreature = mainCreature;
                } else { // type === 'type'
                    const creatureType = parts[2];
                    encounterParams.creatureType = creatureType;
                }

                const result = await client.commandHandler.encounterBuilder.generateEncounter(encounterParams);

                if (result.error) {
                    await interaction.editReply({ content: `Error generating encounter: ${result.error}` });
                    return;
                }

                const { encounter, totalXp, xpBudget } = result;

                const summaryEmbed = new EmbedBuilder()
                    .setColor(0x2ECC71)
                    .setTitle('Encounter Generated!')
                    .setDescription(`**XP Budget:** ${totalXp.toLocaleString()} / ${xpBudget.toLocaleString()}`)
                    .addFields({ name: 'Creatures', value: encounter.map(m => {
                        if (m.isMob) {
                            return `1x Mob of ${m.count} ${m.name}`;
                        }
                        return `${m.count}x ${m.name}`;
                    }).join('\n') || 'None' });

                const originalMessage = await interaction.channel.send({ embeds: [summaryEmbed] });

                const threadName = mainCreature
                    ? `Encounter Details for ${mainCreature.name}`
                    : `Encounter Details for ${encounterParams.creatureType}`;
                const thread = await originalMessage.startThread({
                    name: threadName,
                    autoArchiveDuration: 60,
                });

                for (const monster of encounter) {
                    const fullMonsterData = await fiveEToolsParser.getExact('bestiary', monster.name, monster.source);
                    if (fullMonsterData) {
                        const { mainEmbed, longFields } = formatStatBlockForDiscord(fullMonsterData);
                        await thread.send({ embeds: [mainEmbed] });
                        if (longFields.length > 0) {
                            for (const field of longFields) {
                                const chunks = splitText(field.value, 1024);
                                for (let i = 0; i < chunks.length; i++) {
                                    const chunkEmbed = new EmbedBuilder()
                                        .setColor(0x0099FF)
                                        .setTitle(chunks.length > 1 ? `${field.name} (${i + 1}/${chunks.length})` : field.name)
                                        .setDescription(chunks[i]);
                                    await thread.send({ embeds: [chunkEmbed] });
                                }
                            }
                        }
                    }
                }

                await interaction.editReply({ content: `Encounter generated! You can view it here: ${originalMessage.url}` });

                return;
            }
            const parts = interaction.customId.split('-');
            const prefix = parts[0];
            const context = parts[1];
            const messageId = parts[3]; // ma-config-modal-messageId

            if (prefix === 'ma' && context === 'config' && messageId) {
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });

                const selections = maSelections.get(messageId) || { mode: 'loot', size: 'Average' };
                logToRenderer(`[MA Command] Passing to generator: ${JSON.stringify(selections)}`);

                const nickname = interaction.fields.getTextInputValue('ma-nickname-input');
                const numRolls = interaction.fields.getTextInputValue('ma-numrolls-input');
                const partyLevel = parseInt(interaction.fields.getTextInputValue('ma-partylevel-input'), 10);

                const generator = new MagicItemGenerator({ ...selections, numRolls, partyLevel, nickname });
                const results = generator.generate();

                const threadName = nickname || `Magic Items - ${new Date().toLocaleString()}`;
                const thread = await interaction.channel.threads.create({
                    name: threadName,
                    autoArchiveDuration: 60,
                    startMessage: interaction.message,
                });

                // Hit/Miss Grid
                const { itemTypes } = require('./MagicItemData.js');
                const gridLabelMap = {
                    "Reusable Item (Gizmo)": "Giz",
                    "Single-use Scroll/Tablet": "Scr",
                    "Glyph/Ward/Trap": "GWT",
                    "Enchanted Ammunition": "Amm",
                    "Potion": "Pot",
                    "Poison, Ingested": "Ing",
                    "Poison, Inhaled": "Inh",
                    "Poison, Contact": "Con",
                    "Poison, Injury": "Inj"
                };
                let hitMissGrid = '## Hit/Miss Grid\n`Lvl:  0  1  2  3  4  5  6  7  8  9`\n';
                const hitSet = new Set(results.hits.map(h => `${h.itemType}-${h.level}`));
                itemTypes.forEach(type => {
                    let line = `**\`${gridLabelMap[type] || type.substring(0, 3)}\`**:`;
                    for (let i = 0; i < 10; i++) {
                        line += hitSet.has(`${type}-${i}`) ? ' ✅' : ' ❌';
                    }
                    hitMissGrid += line + '\n';
                });
                await thread.send(hitMissGrid);

                // Generated Items
                if (results.items.length > 0) {
                    const groupedItems = results.items.reduce((acc, item) => {
                        if (!acc[item.itemType]) {
                            acc[item.itemType] = [];
                        }
                        acc[item.itemType].push(item);
                        return acc;
                    }, {});

                    let itemsMessage = '## Generated Items\n';
                    for (const itemType in groupedItems) {
                        itemsMessage += `### ${itemType}\n`;
                        for (const item of groupedItems[itemType]) {
                            let line = `**Lvl ${item.level}**: ${item.spellName}`;
                            if (item.price !== null) {
                                if (typeof item.price === 'number') {
                                    line += ` - *${item.price} gp*`;
                                } else {
                                    line += ` - *${item.price}*`;
                                }
                            }

                            if ((itemsMessage + line + '\n').length > 2000) {
                                await thread.send(itemsMessage);
                                itemsMessage = '';
                            }
                            itemsMessage += line + '\n';
                        }
                    }
                    if (itemsMessage.length > '## Generated Items\n'.length) {
                        await thread.send(itemsMessage);
                    }
                } else {
                    await thread.send("No items were generated based on the rolls.");
                }

                // Disable buttons on original message
                const originalMessage = interaction.message;
                if (originalMessage) {
                    const originalRows = originalMessage.components;
                    const row1 = new ActionRowBuilder().addComponents(originalRows[0].components);
                    const row2 = new ActionRowBuilder().addComponents(originalRows[1].components);

                    const configureButton = new ButtonBuilder()
                        .setCustomId('ma-configure-button')
                        .setLabel('Generated')
                        .setStyle(ButtonStyle.Success)
                        .setDisabled(true);

                    const cancelButton = new ButtonBuilder()
                        .setCustomId('ma-cancel-button')
                        .setLabel('Cancel')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true);

                    const row3 = new ActionRowBuilder().addComponents(configureButton, cancelButton);
                    await originalMessage.edit({ components: [row1, row2, row3] });
                }

                maSelections.delete(messageId);
                await interaction.editReply({ content: `Magic items generated in thread: <#${thread.id}>`, ephemeral: true });
            }
        }
    });
});

client.login(DISCORD_TOKEN);

let memoryUsage = process.memoryUsage().rss; // Get the initial memory usage
const startingMemUse = memoryUsage;
setInterval(() => {
    memoryUsage = process.memoryUsage().rss;
    logToRenderer(`Memory usage is ${((memoryUsage - startingMemUse) / 1024 / 1024).toFixed(2)} MB higher than at launch (${(memoryUsage / 1024 / 1024).toFixed(2)} MB total)`);
}, 60000);

function formatNpcResult(result) {
    const embed = new EmbedBuilder()
        .setColor(0x9B59B6) // Purple for NPCs
        .setTitle(`Generated ${result.mode === 'npc' ? 'NPC' : 'Character Idea'}: ${result.name}`)
        .setDescription(`A **${result.lineage.name || result.species.name} ${result.subclass.name || result.class.name}** who was a(n) **${result.background.name}**.`);

    if (result.traits) {
        embed.addFields({ name: 'Personality Traits', value: `${result.traits[0]}\n-OR-\n${result.traits[1]}` });
    }
    if (result.ideal) {
        embed.addFields({ name: 'Ideal', value: result.ideal });
    }
    if (result.bond) {
        embed.addFields({ name: 'Bond', value: result.bond });
    }
    if (result.flaw) {
        embed.addFields({ name: 'Flaw', value: result.flaw });
    }

    if (result.mode === 'npc' && result.statblockSuggestions) {
        const { easy, medium, hard } = result.statblockSuggestions;
        const statblockValue = `**Easy:** ${easy.name} (CR ${easy.cr})\n` +
                               `**Medium:** ${medium.name} (CR ${medium.cr})\n` +
                               `**Hard:** ${hard.name} (CR ${hard.cr})`;
        embed.addFields({ name: 'Suggested Stat Blocks', value: statblockValue });
    }

    return embed;
}

function getHpColor(current, max) {
    if (current <= 0) return '#6c757d'; // Grey
    if (current > max) return '#8a2be2'; // Purple

    const percentage = (current / max) * 100;
    if (percentage <= 25) return '#dc3545'; // Red
    if (percentage <= 50) return '#ffc107'; // Yellow
    if (percentage <= 75) return '#28a745'; // Green
    return '#007bff'; // Blue
}