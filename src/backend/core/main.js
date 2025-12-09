const { app, BrowserWindow, ipcMain, dialog, shell, protocol } = require('electron');
const path = require('path');
const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const { joinVoiceChannel, entersState, VoiceConnectionStatus } = require('@discordjs/voice');

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
const { mobRules } = require('../data/mobRules.js');
const DropdownHandler = require('../../discord/DropdownHandler.js');
const fs = require('fs');
const { DiceRoller } = require('@dice-roller/rpg-dice-roller');

let discordConfig;

let connection;
let musicPlayer;
let isAppReady = false; // Flag to indicate if the app is ready
let initiativeTracker;
let fiveEToolsParser;


// --- JSDoc Comments ---

/**
 * @file This is the main entry point for the TavernTones Electron application.
 * It handles window creation, application lifecycle events, IPC communication between
 * the main and renderer processes, and the initialization of all backend services
 * such as the Discord bot, music player, and initiative tracker.
 */

// --- Global State ---

/** @type {BrowserWindow | null} The main application window. */
let mainWindow;
/** @type {BrowserWindow | null} The settings window. */
let settingsWindow;
/** @type {boolean} Flag to indicate if the main window has loaded its content. */
let windowloaded = false;

// --- State Management ---
const autosavePath = path.join(app.getPath('userData'), 'autosave.json');

/**
 * A map of D&D 5e conditions to their emoji, color, and description.
 * @type {Object.<string, {emoji: string, color: string, text: string}>}
 */
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

// Function to send dice roll log messages to the renderer
async function logDiceRollToRenderer(message) {
    if (isAppReady && mainWindow.webContents) {
        mainWindow.webContents.send('dice-log', message);
    } else {
        await sleep(100);
        logDiceRollToRenderer(message);
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

//Begin UI
// Electron Setup
/**
 * Creates and loads the main application window.
 * @param {boolean} [showWindow=true] - Whether to show the window immediately after creation.
 * @returns {Promise<void>}
 */
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

/**
 * Creates and shows the settings window. If the window already exists, it focuses it.
 */
function createSettingsWindow() {
    if (settingsWindow) {
        settingsWindow.focus();
        return;
    }

    settingsWindow = new BrowserWindow({
        width: 500,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, '../../ui/settings/settings-preload.js'),
            contextIsolation: true,
            enableRemoteModule: false,
            nodeIntegration: true
        }
    });

    settingsWindow.loadFile(path.join(__dirname, '../../ui/settings/settings.html'));

    settingsWindow.on('closed', () => {
        settingsWindow = null;
    });
}

/**
 * The main application loader. This function is responsible for initializing the application,
 * creating the main window, checking for necessary configurations, and setting up all
 * backend services and IPC handlers. It runs once the Electron app is ready.
 */
async function apploader() {
    discordConfig = await getDiscordConfig();

    await app.whenReady().then(async () => {
        protocol.registerFileProtocol('safe-media', (request, callback) => {
            const url = request.url.substr(13); // 'safe-media://'.length
            const decodedPath = decodeURI(url);
            try {
                return callback(decodedPath);
            }
            catch (error) {
                console.error('Failed to register protocol', error);
                return callback('404');
            }
        });
        console.log('App is ready.');

        // Initialize components
        musicPlayer = new BackendAudioPlayer(logToRenderer, shell, discordConfig.defaultMusicPath);
        ipcloader(); // Load all IPC handlers BEFORE creating window
        fiveEToolsParser = new FiveEToolsParser(logToRenderer, app, discordConfig);

        // Create the main window first, so we can show dialogs.
        // Don't show it yet if we might need to show the settings window first.
        await createWindow(false);
        isAppReady = true;

        // Now, check for folder configuration.
        const { resourcesPath, randomTablesPath, tasksPath } = discordConfig;
        const pathsConfigured = resourcesPath && randomTablesPath && tasksPath;

        if (!pathsConfigured) {
            logToRenderer("Essential data folders are not configured.");
            await dialog.showMessageBox(mainWindow, {
                type: 'warning',
                title: 'Configuration Required',
                message: 'One or more essential data folders have not been set up. Please configure them in the settings.',
                buttons: ['Go to Settings']
            });
            createSettingsWindow();
            return; // Halt further initialization.
        }

        // If we've reached here, paths are configured, so we can show the main window.
        mainWindow.maximize();
        mainWindow.show();

        // Handle Discord Bot setup.
        if (!discordConfig || !discordConfig.token) {
            logToRenderer("Discord credentials not found. Bot functionality will be disabled.");
            mainWindow.webContents.send('discord-bot-status', { status: 'offline', message: 'Not Configured' });
        } else {
            initializeDiscordBot();
        }

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                // Re-check config on activate, in case it was the only window.
                if (pathsConfigured) {
                    createWindow(true);
                } else {
                    createSettingsWindow();
                }
            }
        });
    });
}

ipcMain.handle('get-dnd-conditions', async () => {
    return DND_CONDITIONS;
});

ipcMain.handle('get-mob-rules-data', async () => {
    return mobRules;
});

ipcMain.handle('get-image-as-data-url', async (event, relativePath) => {
    logToRenderer(`[IPC] Received 'get-image-as-data-url' request with relative path: ${relativePath}`);
    const basePath = app.isPackaged ? process.resourcesPath : app.getAppPath();
    logToRenderer(`[IPC] Determined base path: ${basePath} (isPackaged: ${app.isPackaged})`);

    const absoluteImagePath = app.isPackaged ? path.join(basePath, 'MobRules', 'MobRules.png') : path.join(basePath, relativePath);
    logToRenderer(`[IPC] Constructed absolute image path: ${absoluteImagePath}`);

    try {
        logToRenderer(`[IPC] Attempting to read file at: ${absoluteImagePath}`);
        const data = await fs.readFile(absoluteImagePath);
        const extension = path.extname(absoluteImagePath).substring(1);
        const dataUrl = `data:image/${extension};base64,${data.toString('base64')}`;
        logToRenderer(`[IPC] Successfully read and encoded image.`);
        return { success: true, dataUrl: dataUrl, absolutePath: absoluteImagePath };
    } catch (error) {
        const errorMessage = `Failed to read image file. Error: ${error.message}`;
        logToRenderer(`[IPC] Error: ${errorMessage}`);
        return { success: false, error: errorMessage, absolutePath: absoluteImagePath };
    }
});

// Disable hardware acceleration for headless environments (e.g., Playwright)
// This prevents crashes related to GPU initialization.
app.disableHardwareAcceleration();

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

function formatMobRulesForDiscord(creatureName) {
    const { discord: discordData, imagePath } = mobRules;

    const mainEmbed = new EmbedBuilder()
        .setColor(0xFFA500) // Orange for rules
        .setTitle(`${discordData.title}: ${creatureName}`)
        .setDescription(discordData.description)
        .addFields(...discordData.fields)
        .setImage(`attachment://${path.basename(imagePath)}`); // Set the image to be an attachment

    return { mainEmbed, imagePath };
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

/**
 * Registers all IPC (Inter-Process Communication) handlers for the application.
 * This function sets up listeners for events from the renderer process, allowing
 * the frontend to interact with the backend services like the file system,
 * music player, initiative tracker, and more.
 */
async function ipcloader() {
    // Helper function to open a directory selection dialog
    const selectDirectory = async (title) => {
        const { filePaths } = await dialog.showOpenDialog(settingsWindow || mainWindow, {
            title,
            properties: ['openDirectory']
        });
        return filePaths && filePaths.length > 0 ? filePaths[0] : null;
    };

    // IPC Handlers for individual folder browsing
    ipcMain.handle('select-resources-folder', () => selectDirectory('Select Resources Folder'));
    ipcMain.handle('select-random-tables-folder', () => selectDirectory('Select Random Tables Folder'));
    ipcMain.handle('select-tasks-folder', () => selectDirectory('Select Tasks Folder'));
    ipcMain.handle('select-music-folder', () => selectDirectory('Select Default Music Folder'));

    // IPC Handler for setting up all default folders
    ipcMain.handle('setup-default-folders', async () => {
        const { filePaths } = await dialog.showOpenDialog(mainWindow, {
            title: 'Select a Parent Directory for TavernTones Data',
            properties: ['openDirectory']
        });

        if (!filePaths || filePaths.length === 0) {
            return null; // User cancelled
        }

        const parentDir = filePaths[0];
        const dataDir = path.join(parentDir, 'TavernTones_Data');

        try {
            await fs.mkdir(dataDir, { recursive: true });

            const paths = {
                resourcesPath: path.join(dataDir, 'resources'),
                randomTablesPath: path.join(dataDir, 'randomtables'),
                tasksPath: path.join(dataDir, 'tasks'),
                defaultMusicPath: path.join(dataDir, 'music')
            };

            // Create all subdirectories
            for (const p of Object.values(paths)) {
                await fs.mkdir(p, { recursive: true });
            }

            // Copy default data
            const sourcePath = app.isPackaged ? path.join(process.resourcesPath, 'app') : app.getAppPath();
            await fs.cp(path.join(sourcePath, 'resources'), paths.resourcesPath, { recursive: true });
            await fs.cp(path.join(sourcePath, 'randomtables'), paths.randomTablesPath, { recursive: true });
            // For tasks, we'll just create the directory for now, user can place tasks there.

            await dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'Success',
                message: `Default folders created inside:\n${dataDir}\n\nPlease place your task files in the 'tasks' folder.`,
                buttons: ['OK']
            });

            return paths;
        } catch (error) {
            console.error('Failed to create default folders:', error);
            await dialog.showErrorBox('Error', 'Failed to create default data folders. Please check permissions and try again.');
            return null;
        }
    });


    // Settings window IPC
    ipcMain.on('get-discord-config', async (event) => {
        event.sender.send('discord-config', await getDiscordConfig());
    });

    ipcMain.on('set-discord-config', async (event, config) => {
        await setDiscordConfig(config);

        // --- Update the live configuration ---
        // The in-memory config needs to be updated to reflect the newly saved settings.
        discordConfig = config;
        // The music player instance also needs to be told about the new path.
        if (musicPlayer) {
            musicPlayer.musicFolder = config.defaultMusicPath;
            logToRenderer(`[IPC] Updated music player's default folder to: ${musicPlayer.musicFolder}`);
        }
        // --- End of update ---

        await dialog.showMessageBox(null, {
            type: 'info',
            title: 'Settings Saved',
            message: 'Your settings have been saved. Please close and reopen the application to apply all changes.',
            buttons: ['OK']
        });
        // Close the settings window after saving
        if (settingsWindow) {
            settingsWindow.close();
        }
    });

    ipcMain.on('open-settings-window', createSettingsWindow);

    logToRenderer('ipcloader() called.');
    musicPlayer.on('status-change', (status) => {
        if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('music-player-status', status);
        }
    });
    musicPlayer.on('sound-finished', (slotId) => {
        if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('sound-finished', slotId);
        }
    });
    initiativeTracker = new InitiativeTracker(logToRenderer, logDiceRollToRenderer, sendInitiativeUpdate, autosavePath);
    // --- All core IPC listeners should be registered after the app is ready ---
    ipcMain.on('request-initial-load', () => {
        if (initiativeTracker) {
            initiativeTracker.sendFullState();
        }
    });

    // Music Player IPC Handlers
    ipcMain.on('load-music-file', (event, filePath) => {
        logToRenderer(`IPC 'load-music-file' received for: ${filePath}`);
        if (filePath) {
            musicPlayer.loadFile(filePath);
        }
    });

    ipcMain.on('play-music', () => {
        logToRenderer(`IPC 'play-music' (command) received.`);
        musicPlayer.play();
    });

    ipcMain.on('pause-music', () => {
        logToRenderer(`IPC 'pause-music' received.`);
        musicPlayer.pause();
    });

    ipcMain.handle('get-preview-audio-data', async () => {
        const filePath = musicPlayer.getPreviewFilePath();
        if (!filePath) {
            return { success: false, error: 'No file available for preview.' };
        }
        // Encode the file path to handle special characters and create a URL
        const safeUrl = `safe-media://${encodeURI(filePath.replace(/\\/g, '/'))}`;
        return { success: true, url: safeUrl };
    });

    ipcMain.handle('show-confirm-dialog', async (event, options) => {
        const focusedWindow = BrowserWindow.getFocusedWindow();
        if (!focusedWindow) return { response: options.cancelId || 1 }; // Default to cancel if no window
        return await dialog.showMessageBox(focusedWindow, options);
    });

    ipcMain.handle('open-file-dialog', async () => {
        const { filePaths } = await dialog.showOpenDialog(mainWindow, {
            title: 'Select Music File',
            defaultPath: discordConfig.defaultMusicPath,
            properties: ['openFile'],
            filters: [
                { name: 'Audio Files', extensions: ['mp3', 'wav', 'ogg'] }
            ]
        });

        if (filePaths && filePaths.length > 0) {
            return filePaths[0];
        }
        return null;
    });

    // --- Soundboard IPC ---
    ipcMain.handle('open-soundboard-file-dialog', async () => {
        const { filePaths } = await dialog.showOpenDialog(mainWindow, {
            title: 'Select Sound(s)',
            defaultPath: discordConfig.defaultMusicPath,
            properties: ['openFile', 'multiSelections'],
            filters: [
                { name: 'Audio Files', extensions: ['mp3', 'wav', 'ogg'] }
            ]
        });

        if (filePaths && filePaths.length > 0) {
            return filePaths;
        }
        return [];
    });

    ipcMain.on('play-sound', (event, { slotId }) => {
        // We need the renderer to tell us WHAT file to play, or we store it in backend.
        // The renderer state seems to hold the file path, so it should send it, 
        // OR the renderer sends "play slot X" and the backend looks up what slot X is.
        // But currently main.js doesn't store soundboard state. 
        // The renderer calls 'play-sound' with { slotId }... wait.
        // My implementation plan said: "Trigger BackendAudioPlayer.playSound(file)".
        // BUT the renderer's `play-sound` event in the *existing code (renderer.js)* 
        // implies it might send just ID? 
        // Let's check renderer.js again.
        // Actually I haven't written the renderer code yet, but the *existing* placeholder code in renderer.js:
        // window.electron.ipcRenderer.send('play-sound', { slotId });
        // It doesn't send the file path. Ideally the backend should know, OR the renderer should send it.
        // To keep backend stateless regarding UI config if possible, I'll update renderer to send the path always.
        // Updating `main.js` to expect `filePath` in the payload.
    });

    // Redoing the above block properly:
    ipcMain.on('play-sound', (event, { slotId, filePath }) => {
        logToRenderer(`IPC 'play-sound' slot ${slotId}, file: ${filePath}`);
        if (filePath && musicPlayer) {
            musicPlayer.playSound(filePath, slotId);
            // Notify renderer of state change? 
            // The renderer usually updates its own UI state, but if we want valid feedback:
            mainWindow.webContents.send('soundboard-state-change', { slotId, isPlaying: true });
        }
    });

    ipcMain.on('stop-sound', (event, { slotId }) => {
        logToRenderer(`IPC 'stop-sound' slot ${slotId}`);
        if (musicPlayer) {
            musicPlayer.stopSound(slotId);
            mainWindow.webContents.send('soundboard-state-change', { slotId, isPlaying: false });
        }
    });

    ipcMain.on('set-soundboard-volume', (event, { volume }) => {
        if (musicPlayer) {
            musicPlayer.setSoundboardVolume(volume);
        }
    });

    // --- Soundboard Persistence ---
    const soundboardConfigPath = path.join(app.getPath('userData'), 'soundboard.json');

    ipcMain.handle('get-soundboard-state', async () => {
        try {
            if (fs.existsSync(soundboardConfigPath)) {
                // Using promises for reading
                const data = await fs.promises.readFile(soundboardConfigPath, 'utf-8');
                return JSON.parse(data);
            }
        } catch (error) {
            console.error('Error loading soundboard config:', error);
        }
        return null;
    });

    ipcMain.on('save-soundboard-state', (event, state) => {
        try {
            fs.promises.writeFile(soundboardConfigPath, JSON.stringify(state, null, 2))
                .catch(err => console.error("Error saving soundboard:", err));
        } catch (error) {
            console.error('Error initiating save soundboard:', error);
        }
    });

    ipcMain.handle('save-soundboard-preset', async (event, state) => {
        const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
            title: 'Save Soundboard Preset',
            defaultPath: 'soundboard-preset.json',
            filters: [{ name: 'JSON', extensions: ['json'] }]
        });

        if (!canceled && filePath) {
            try {
                await fs.promises.writeFile(filePath, JSON.stringify(state, null, 2));
                return { success: true, filePath };
            } catch (error) {
                console.error('Error saving preset:', error);
                return { success: false, error: error.message };
            }
        }
        return { canceled: true };
    });

    ipcMain.handle('load-soundboard-preset', async () => {
        const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
            title: 'Load Soundboard Preset',
            filters: [{ name: 'JSON', extensions: ['json'] }],
            properties: ['openFile']
        });

        if (!canceled && filePaths.length > 0) {
            try {
                const data = await fs.promises.readFile(filePaths[0], 'utf-8');
                return { success: true, state: JSON.parse(data) };
            } catch (error) {
                console.error('Error loading preset:', error);
                return { success: false, error: error.message };
            }
        }
        return { canceled: true };
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
                let nameStr = creature.name || '';
                if (creature.isMob) {
                    const currentCount = (creature.singleCreatureHP > 0) ? Math.ceil(creature.hp / creature.singleCreatureHP) : 0;
                    nameStr = `Mob of ${currentCount} ${creature.name}`;
                }

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
            // When copying, we want to populate the "Add" form, not the "Edit" form.
            // We give it a new ID to ensure it's a distinct creature.
            const newCreature = { ...creature, id: Date.now() };
            mainWindow.webContents.send('populate-add-form', newCreature);
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

    ipcMain.on('update-creature', (event, creature) => {
        initiativeTracker.updateCreature(creature);
    });

    ipcMain.on('update-reminders', (event, { creatureId, reminders }) => {
        initiativeTracker.updateReminders(creatureId, reminders);
    });

    ipcMain.on('roll-stat', (event, { creatureId, rollType, stat, type }) => {
        const result = initiativeTracker.rollStat(creatureId, rollType, stat, type);
        if (result) {
            const { message, embed } = result;
            mainWindow.webContents.send('dice-log', message);
            if (discordConfig.textChannel) {
                const channel = client.channels.cache.get(discordConfig.textChannel);
                if (channel) {
                    channel.send({ embeds: [embed] });
                }
            }
        }
    });

    ipcMain.on('roll-attack', (event, { creatureId, rollType }) => {
        const result = initiativeTracker.rollAttack(creatureId, rollType);
        if (result) {
            const { message, embed } = result;
            mainWindow.webContents.send('dice-log', message);
            if (discordConfig.textChannel) {
                const channel = client.channels.cache.get(discordConfig.textChannel);
                if (channel) {
                    channel.send({ embeds: [embed] });
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
            dialog.showMessageBox(mainWindow, { type: 'warning', title: 'Concentration Check', message: `${result.creature.name} must make a DC ${result.concentrationCheckDC} Constitution saving throw.`, buttons: ['OK'] });
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

    ipcMain.on('push-mob-rules-to-discord', async (event, { creatureName, absoluteImagePath }) => {
        if (!creatureName || !absoluteImagePath) {
            const errorMsg = `[push-mob-rules] Error: Missing creatureName or absoluteImagePath.`;
            logToRenderer(errorMsg);
            dialog.showErrorBox('Discord Error', `Could not push mob rules. Data from UI was incomplete.`);
            return;
        }

        if (!discordConfig.textChannel) {
            logToRenderer('[push-mob-rules] No text channel configured.');
            return;
        }
        const channel = client.channels.cache.get(discordConfig.textChannel);
        if (!channel) {
            logToRenderer(`[push-mob-rules] FAILED to find channel with ID: ${discordConfig.textChannel}`);
            return;
        }

        try {
            logToRenderer(`[push-mob-rules] Reading image file into buffer from: ${absoluteImagePath}`);
            const imageBuffer = await fs.readFile(absoluteImagePath);
            logToRenderer(`[push-mob-rules] Successfully read image into buffer (${imageBuffer.length} bytes).`);

            const { mainEmbed } = formatMobRulesForDiscord(creatureName);

            await channel.send({
                embeds: [mainEmbed],
                files: [{
                    attachment: imageBuffer, // Send the buffer directly
                    name: path.basename(absoluteImagePath)
                }]
            });
            logToRenderer('[push-mob-rules] Successfully pushed mob rules embed with image buffer.');
        } catch (error) {
            logToRenderer(`[push-mob-rules] FAILED to send embed: ${error.message}`);
            logToRenderer(`[push-mob-rules] Error stack: ${error.stack}`);
            dialog.showErrorBox('Discord Error', `Failed to read image file or send to Discord. Please check the file at: ${absoluteImagePath}\n\n${error.message}`);
        }
    });
}

/**
 * Sends a log message to the renderer process to be displayed in the UI.
 * It waits until the app is ready before sending the message.
 * @param {string} message - The message to log.
 */
async function logToRenderer(...args) {
    const message = args.map(arg => {
        if (arg instanceof Error) return arg.stack || arg.message;
        if (typeof arg === 'object') return JSON.stringify(arg);
        return arg;
    }).join(' ');

    if (isAppReady) {
        mainWindow.webContents.send('log-message', message);
    }
    else {
        await sleep(100);
        logToRenderer(message);
    }
}

/*
client.on('error', error => {
    logToRenderer('An error occurred: ', error);
});
*/

/**
 * Initializes and logs in the Discord bot using the token from the configuration.
 * Handles login errors and notifies the user.
 */
function initializeDiscordBot() {
    if (!discordConfig || !discordConfig.token) {
        logToRenderer('Discord token not found. Bot not started.');
        return;
    }

    client.login(discordConfig.token).catch(error => {
        logToRenderer(`Discord login failed: ${error.message}`);
        dialog.showErrorBox('Discord Login Failed', `Could not log in to Discord. Please check your token in the settings.\n\n${error.message}`);
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


    logToRenderer(`Logged in as ${client.user.tag}`);

    const basePath = app.isPackaged
        ? path.dirname(app.getPath('exe'))
        : app.getAppPath();
    const commandHandler = new CommandHandler(client, logToRenderer, musicPlayer, discordConfig, fiveEToolsParser);
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