console.log('Main.js script started');
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
console.log('Electron loaded.');
const path = require('path');
console.log('Path loaded.');
const { Client, GatewayIntentBits, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, StringSelectMenuBuilder } = require('discord.js');
console.log('Discord.js Client loaded.');
const { joinVoiceChannel, entersState, VoiceConnectionStatus } = require('@discordjs/voice');
console.log('Discord.js Voice loaded.');
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.MessageContent, GatewayIntentBits.DirectMessages] });
client.npcDropdownHandlers = new Map();
console.log('Discord client instantiated.');
const axios = require('axios');
console.log('Axios loaded.');
const BackendAudioPlayer = require('./BackendAudioPlayer.js');
const CommandHandler = require('../../discord/CommandHandler.js');
const FiveEToolsParser = require('./5eParser.js');
const { getDiscordConfig, setDiscordConfig } = require('./config.js');
const { format5eResult } = require('../../discord/5eEmbedFormatter.js');
const DropdownHandler = require('../../discord/DropdownHandler.js');
const fs = require('fs').promises;

let discordConfig;

async function ensureExternalDataFolders() {
    const basePath = app.isPackaged ? path.dirname(app.getPath('exe')) : app.getAppPath();
    const dataFolderPath = path.join(basePath, 'TavernTones_Data');

    // Define source and destination paths
    const sourceResourcesPath = path.join(app.getAppPath(), 'resources');
    const destResourcesPath = path.join(dataFolderPath, 'resources');
    const sourceRandomTablesPath = path.join(app.getAppPath(), 'randomtables');
    const destRandomTablesPath = path.join(dataFolderPath, 'randomtables');

    const copyIfMissing = async (source, dest, type) => {
        try {
            await fs.access(dest);
        } catch (error) {
            if (error.code === 'ENOENT') {
                logToRenderer(`External '${type}' folder not found. Copying default data...`);
                await fs.cp(source, dest, { recursive: true });
            } else {
                throw error; // Rethrow other errors
            }
        }
    };

    try {
        await copyIfMissing(sourceResourcesPath, destResourcesPath, 'resources');
        await copyIfMissing(sourceRandomTablesPath, destRandomTablesPath, 'randomtables');
    } catch (error) {
        console.error('Error ensuring external data folders:', error);
        dialog.showErrorBox('Data Folder Error', `Could not create or copy data folders. Please check permissions and restart.\n\n${error.message}`);
    }
}

let connection;
let musicPlayer;
let isAppReady = false; // Flag to indicate if the app is ready
let initiativeTracker;
let fiveEToolsParser;


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
let settingsWindow;
let windowloaded = false;
async function createWindow(showWindow = true) {
    console.log('createWindow() called.');
    mainWindow = new BrowserWindow({
        show: false, // Do not show the window until it's ready
        webPreferences: {
            preload: path.join(__dirname, '../../ui/preload.js'),
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

    await mainWindow.loadFile(path.join(__dirname, '../../ui/Index.html'));
    console.log('index.html loaded.');
    windowloaded = true;
}

function createSettingsWindow() {
    if (settingsWindow) {
        settingsWindow.focus();
        return;
    }

    settingsWindow = new BrowserWindow({
        width: 500,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, '../../ui/settings/settings-preload.js'),
            contextIsolation: true,
            enableRemoteModule: false
        }
    });

    settingsWindow.loadFile(path.join(__dirname, '../../ui/settings/settings.html'));

    settingsWindow.on('closed', () => {
        settingsWindow = null;
    });
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
            preload: path.join(__dirname, '../../ui/preload.js'),
            contextIsolation: true,
            enableRemoteModule: false,
            nodeIntegration: true // Keep consistent with mainWindow
        }
    });

    gamifyWindow.maximize();
    gamifyWindow.loadFile(path.join(__dirname, '../../jsontool/json-gamify.html'));

    // Optional: Open DevTools for debugging
    // gamifyWindow.webContents.openDevTools();

    gamifyWindow.on('closed', () => {
        // Dereference the window object
        gamifyWindow = null;
    });
}

async function apploader() {
    discordConfig = await getDiscordConfig();
    await app.whenReady().then(async () => {
        console.log('App is ready.');
        await ensureExternalDataFolders(); // Ensure data folders exist
        fiveEToolsParser = new FiveEToolsParser(logToRenderer, app); // Initialize parser early

        const isGamifyLaunch = process.argv.includes('--tool=gamify');

        // Create the main window, but don't show it if we are launching the gamify tool
        createWindow(!isGamifyLaunch);

        if (!discordConfig || !discordConfig.token) {
            // Use a timeout to ensure the main window is ready before showing the dialog
            setTimeout(() => {
                if (mainWindow) {
                    dialog.showMessageBox(mainWindow, {
                        type: 'warning',
                        title: 'Discord Not Configured',
                        message: 'No Discord credentials found.',
                        detail: 'The application will start, but all Discord-related features will be disabled. Please configure them in the settings and restart the app to enable them.',
                        buttons: ['OK']
                    });
                }
            }, 1000);
        }


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
        initializeDiscordBot();
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

const InitiativeTracker = require('../features/InitiativeTracker.js');

async function ipcloader() {
    // Settings window IPC
    ipcMain.on('get-discord-config', async (event) => {
        event.sender.send('discord-config', await getDiscordConfig());
    });

    ipcMain.on('set-discord-config', async (event, config) => {
        await setDiscordConfig(config);
        await dialog.showMessageBox(null, {
            type: 'info',
            title: 'Settings Saved',
            message: 'Your settings have been saved. The application will now restart to apply the changes.',
            buttons: ['OK']
        });
        app.relaunch();
        app.quit();
    });

    ipcMain.on('open-settings-window', createSettingsWindow);

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
            const settingsPath = path.join(app.getPath('userData'), 'gamify-settings.json');
            try {
                const data = await fs.readFile(settingsPath, 'utf8');
                const settings = JSON.parse(data);
                return settings.highScore || 0;
            } catch (error) {
                if (error.code === 'ENOENT') {
                    await fs.writeFile(settingsPath, JSON.stringify({ highScore: 0 }, null, 2));
                    return 0;
                }
                logToRenderer(`Error reading high score: ${error}`);
                return 0;
            }
        });

        ipcMain.on('save-high-score', async (event, score) => {
            const settingsPath = path.join(app.getPath('userData'), 'gamify-settings.json');
            try {
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
            const basePath = app.isPackaged ? path.dirname(app.getPath('exe')) : app.getAppPath();
            try {
                const data = await fs.readFile(taskFilePath, 'utf8');
                let taskData = JSON.parse(data); // Make mutable

                let { fileIndex, itemIndex } = taskData.progress;

                if (fileIndex >= taskData.files.length) {
                    return { success: true, taskComplete: true, taskData };
                }

                let itemFilePath = path.join(basePath, taskData.files[fileIndex]);
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

                    itemFilePath = path.join(basePath, taskData.files[fileIndex]);
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
            const basePath = app.isPackaged ? path.dirname(app.getPath('exe')) : app.getAppPath();
            const taskPath = path.isAbsolute(filePath) ? filePath : path.join(basePath, filePath);
            return await loadTaskData(taskPath);
        });

        ipcMain.handle('get-task-data', async () => {
            const basePath = app.isPackaged ? path.dirname(app.getPath('exe')) : app.getAppPath();
            const defaultTaskPath = path.join(basePath, 'src/jsontool/deck-editing-task.json');
            return await loadTaskData(defaultTaskPath);
        });

        ipcMain.handle('save-and-get-next-spell', async (event, { taskData, currentSpell, taskFilePath }) => {
            const basePath = app.isPackaged ? path.dirname(app.getPath('exe')) : app.getAppPath();
            try {
                // 1. Save the current spell changes
                const currentItemFilePath = path.join(basePath, taskData.files[taskData.progress.fileIndex]);
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
                const nextFilePath = path.join(basePath, taskData.files[taskData.progress.fileIndex]);
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
            const basePath = app.isPackaged ? path.dirname(app.getPath('exe')) : app.getAppPath();
            try {
                const currentItemFilePath = path.join(basePath, taskData.files[taskData.progress.fileIndex]);
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
            const basePath = app.isPackaged ? path.dirname(app.getPath('exe')) : app.getAppPath();
            try {
                // 1. Determine the previous spell's position
                let prevFileIndex = taskData.progress.fileIndex;
                let prevItemIndex = taskData.progress.itemIndex - 1;

                if (prevItemIndex < 0) {
                    prevFileIndex--;
                    if (prevFileIndex < 0) {
                        return { success: false, error: "Already at the beginning." };
                    }
                    const prevFilePath = path.join(basePath, taskData.files[prevFileIndex]);
                    const prevFileData = await fs.readFile(prevFilePath, 'utf8');
                    const prevSpellList = JSON.parse(prevFileData);
                    prevItemIndex = prevSpellList.length - 1;
                }

                // 2. Save the *previous* state back to the file
                const targetFilePath = path.join(basePath, taskData.files[prevFileIndex]);
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
                defaultPath: discordConfig.defaultLocalFolder,
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

            if (!discordConfig.textChannel) {
                logToRenderer('[push-initiative] No text channel configured.');
                return;
            }

            const channel = client.channels.cache.get(discordConfig.textChannel);
            if (!channel) {
                logToRenderer(`[push-initiative] FAILED to find channel with ID: ${discordConfig.textChannel}`);
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
                if (discordConfig.textChannel) {
                    const channel = client.channels.cache.get(discordConfig.textChannel);
                    if (channel) {
                        channel.send(message);
                    }
                }
            }
        });

        ipcMain.on('roll-attack', (event, { creatureId, rollType }) => {
            const message = initiativeTracker.rollAttack(creatureId, rollType);
            if (message) {
                mainWindow.webContents.send('dice-log', message);
                if (discordConfig.textChannel) {
                    const channel = client.channels.cache.get(discordConfig.textChannel);
                    if (channel) {
                        channel.send(message);
                    }
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
            if (!discordConfig.textChannel) {
                logToRenderer('[push-dicelog] No text channel configured.');
                return;
            }
            const channel = client.channels.cache.get(discordConfig.textChannel);
            if (!channel) {
                logToRenderer(`[push-dicelog] FAILED to find channel with ID: ${discordConfig.textChannel}`);
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
            if (!discordConfig.textChannel) {
                logToRenderer('[push-statblock] No text channel configured.');
                return;
            }
            const channel = client.channels.cache.get(discordConfig.textChannel);
            if (!channel) {
                logToRenderer(`[push-statblock] FAILED to find channel with ID: ${discordConfig.textChannel}`);
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

function initializeDiscordBot() {
    if (!discordConfig || !discordConfig.token) {
        logToRenderer('Discord token not found. Bot not started.');
        if (mainWindow && mainWindow.webContents) {
            // Send status to renderer to disable UI elements
            mainWindow.webContents.send('discord-status', { connected: false });
        }
        return;
    }

    client.login(discordConfig.token).catch(error => {
        logToRenderer(`Discord login failed: ${error.message}`);
        dialog.showErrorBox('Discord Login Failed', `Could not log in to Discord. Please check your token in the settings.\n\n${error.message}`);
        if (mainWindow && mainWindow.webContents) {
            // Send status to renderer to disable UI elements
            mainWindow.webContents.send('discord-status', { connected: false });
        }
    });
}

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
    if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('discord-status', { connected: true });
    }

    //Connect to the voice channel
    const voiceChannel = client.channels.cache.get(discordConfig.voiceChannel);
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

    const basePath = app.isPackaged
        ? path.dirname(app.getPath('exe'))
        : app.getAppPath();
    const commandHandler = new CommandHandler(client, logToRenderer, musicPlayer, { BOT_ROLE_ID: discordConfig.botRoleId, DEFAULT_LOCAL_FOLDER: discordConfig.defaultLocalFolder }, fiveEToolsParser, basePath);
    client.commandHandler = commandHandler; // Attach commandHandler to the client object
    client.on('messageCreate', message => commandHandler.handleMessage(message));

    client.on('interactionCreate', async interaction => {
        if (interaction.isStringSelectMenu()) {
            const { customId, values } = interaction;

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
        }
    });
});

let memoryUsage = process.memoryUsage().rss; // Get the initial memory usage
const startingMemUse = memoryUsage;
setInterval(() => {
    memoryUsage = process.memoryUsage().rss;
    logToRenderer(`Memory usage is ${((memoryUsage - startingMemUse) / 1024 / 1024).toFixed(2)} MB higher than at launch (${(memoryUsage / 1024 / 1024).toFixed(2)} MB total)`);
}, 60000);


function getHpColor(current, max) {
    if (current <= 0) return '#6c757d'; // Grey
    if (current > max) return '#8a2be2'; // Purple

    const percentage = (current / max) * 100;
    if (percentage <= 25) return '#dc3545'; // Red
    if (percentage <= 50) return '#ffc107'; // Yellow
    if (percentage <= 75) return '#28a745'; // Green
    return '#007bff'; // Blue
}